const { createServer } = require("http");
const { Server } = require("socket.io");
const { createClient } = require("@supabase/supabase-js");

const PORT = Number(process.env.PORT) || 3001;
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://talk-anyone.vercel.app",
];
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL.replace(/\/$/, ""));
}

const httpServer = createServer((req, res) => {
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "TALK ANYONE connection server" }));
    return;
  }
  res.writeHead(404);
  res.end("Not found");
});

const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, methods: ["GET", "POST"] },
});

const waitingUsers = [];
const partners = new Map();
const blockedUsers = new Map();

// Supabase reporting
const db = process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY)
  : null;
const savingReports = new Set();
const REPORT_REASONS = new Set([
  "harassment",
  "inappropriate-content",
  "spam",
  "hate-speech",
  "hate-or-threats",
  "other",
]);
const reportCooldowns = new Map();
const REPORT_COOLDOWN_MS = 60 * 1000;

function removeFromWaiting(id) {
  for (let i = waitingUsers.length - 1; i >= 0; i--) {
    if (waitingUsers[i] === id) waitingUsers.splice(i, 1);
  }
}

function cleanWaitingQueue() {
  for (let i = waitingUsers.length - 1; i >= 0; i--) {
    const id = waitingUsers[i];
    if (!io.sockets.sockets.has(id) || partners.has(id)) {
      waitingUsers.splice(i, 1);
    }
  }
}

function hasBlocked(user1, user2) {
  return (
    blockedUsers.get(user1)?.has(user2) ||
    blockedUsers.get(user2)?.has(user1) ||
    false
  );
}

function blockUser(user1, user2) {
  if (!blockedUsers.has(user1)) blockedUsers.set(user1, new Set());
  blockedUsers.get(user1).add(user2);
}

function disconnectPartner(id) {
  const partnerId = partners.get(id);
  if (!partnerId) return;
  partners.delete(id);
  if (partners.get(partnerId) === id) {
    partners.delete(partnerId);
    io.to(partnerId).emit("partner-left");
  }
}

function findPartner(socket) {
  if (!socket.connected) return;
  if (partners.has(socket.id)) {
    socket.emit("match-error", "You are already connected.");
    return;
  }
  removeFromWaiting(socket.id);
  cleanWaitingQueue();
  const index = waitingUsers.findIndex(
    (candidate) => candidate !== socket.id && !hasBlocked(socket.id, candidate)
  );
  if (index === -1) {
    waitingUsers.push(socket.id);
    socket.emit("waiting");
    return;
  }
  const [partnerId] = waitingUsers.splice(index, 1);
  partners.set(socket.id, partnerId);
  partners.set(partnerId, socket.id);
  io.to(partnerId).emit("partner-found", { initiator: true });
  socket.emit("partner-found", { initiator: false });
  console.log("Two users matched!");
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("find-partner", () => findPartner(socket));

  socket.on("chat-message", (message) => {
    const partnerId = partners.get(socket.id);
    if (!partnerId || typeof message !== "string") return;
    const text = message.trim().slice(0, 1000);
    if (text) io.to(partnerId).emit("chat-message", text);
  });

  socket.on("next-partner", () => {
    disconnectPartner(socket.id);
    removeFromWaiting(socket.id);
    findPartner(socket);
  });

  socket.on("block-user", () => {
    const partnerId = partners.get(socket.id);
    if (!partnerId) {
      socket.emit("block-error", "No stranger to block.");
      return;
    }
    blockUser(socket.id, partnerId);
    disconnectPartner(socket.id);
    removeFromWaiting(socket.id);
    socket.emit("user-blocked", "User blocked successfully.");
    io.to(partnerId).emit("blocked-by-partner");
    console.log("User blocked:", socket.id);
  });

  // Frontend sends: socket.emit("report-user", { reason: "spam" }, callback)
  // callback receives { ok: boolean, message: string }.
  socket.on("report-user", async (payload, acknowledge) => {
    const reply = (ok, message) => {
      if (typeof acknowledge === "function") acknowledge({ ok, message });
    };
    const partnerId = partners.get(socket.id);
    if (!partnerId || partners.get(partnerId) !== socket.id) {
      reply(false, "You must be connected to someone to report them.");
      return;
    }
    const reason = payload && typeof payload === "object" ? payload.reason : undefined;
    if (typeof reason !== "string" || !REPORT_REASONS.has(reason)) {
      reply(false, "Please choose a valid report reason.");
      return;
    }
    const now = Date.now();
    const previous = reportCooldowns.get(socket.id) || 0;
    if (savingReports.has(socket.id) || now - previous < REPORT_COOLDOWN_MS) {
      reply(false, "Please wait before sending another report.");
      return;
    }
    if (!db) {
      reply(false, "Reporting is not configured.");
      return;
    }

    savingReports.add(socket.id);

    try {
      const { error } = await db.from("reports").insert({
        reporter_socket_id: socket.id,
        reported_socket_id: partnerId,
        reason,
      });

      if (error) throw error;

      reportCooldowns.set(socket.id, Date.now());
      console.log("Report saved to Supabase:", reason);
    } catch (error) {
      console.error("Report saving failed:", error.message);
      reply(false, "Could not save report. Please try again.");
      return;
    } finally {
      savingReports.delete(socket.id);
    }
    reply(true, "Report received. Thank you.");
  });

  socket.on("webrtc-offer", (offer) => {
    const partnerId = partners.get(socket.id);
    if (partnerId) io.to(partnerId).emit("webrtc-offer", offer);
  });
  socket.on("webrtc-answer", (answer) => {
    const partnerId = partners.get(socket.id);
    if (partnerId) io.to(partnerId).emit("webrtc-answer", answer);
  });
  socket.on("ice-candidate", (candidate) => {
    const partnerId = partners.get(socket.id);
    if (partnerId) io.to(partnerId).emit("ice-candidate", candidate);
  });

  socket.on("disconnect", () => {
    removeFromWaiting(socket.id);
    disconnectPartner(socket.id);
    blockedUsers.delete(socket.id);
    reportCooldowns.delete(socket.id);
    for (const blocked of blockedUsers.values()) blocked.delete(socket.id);
    console.log("User disconnected:", socket.id);
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`TALK ANYONE connection server running on port ${PORT}`);
});
