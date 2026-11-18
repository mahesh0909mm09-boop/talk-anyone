
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
    res.end(JSON.stringify({
      status: "ok",
      service: "TALK ANYONE connection server",
    }));
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

const waitingUsers = [];
const partners = new Map();
const blockedUsers = new Map();

const db =
  process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY
    ? createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SECRET_KEY
      )
    : null;

const savingReports = new Set();
const reportCooldowns = new Map();

const REPORT_COOLDOWN_MS = 60 * 1000;
const BLOCK_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REPORT_REASONS = new Set([
  "harassment",
  "inappropriate-content",
  "spam",
  "hate-speech",
  "hate-or-threats",
  "other",
]);

function removeFromWaiting(id) {
  for (let i = waitingUsers.length - 1; i >= 0; i--) {
    if (waitingUsers[i] === id) {
      waitingUsers.splice(i, 1);
    }
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

function blockUser(user1, user2) {
  if (!blockedUsers.has(user1)) {
    blockedUsers.set(user1, new Set());
  }

  blockedUsers.get(user1).add(user2);
}

function hasBlocked(user1, user2) {
  const socket1 = io.sockets.sockets.get(user1);
  const socket2 = io.sockets.sockets.get(user2);

  const browser1 = socket1?.data.browserId;
  const browser2 = socket2?.data.browserId;

  if (
    blockedUsers.get(user1)?.has(user2) ||
    blockedUsers.get(user2)?.has(user1)
  ) {
    return true;
  }

  if (browser1 && browser2) {
    if (browser1 === browser2) return true;

    if (socket1.data.blockedBrowserIds?.has(browser2)) {
      return true;
    }

    if (socket2.data.blockedBrowserIds?.has(browser1)) {
      return true;
    }
  }

  return false;
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

async function loadBrowserBlocks(socket) {
  const browserId = socket.data.browserId;

  const blocked = new Set();

  if (!browserId || !db) {
    socket.data.blockedBrowserIds = blocked;
    return;
  }

  let offset = 0;

  while (true) {
    const { data, error } = await db
      .from("browser_blocks")
      .select("blocker_id, blocked_id")
      .or(
        `blocker_id.eq.${browserId},blocked_id.eq.${browserId}`
      )
      .gt("expires_at", new Date().toISOString())
      .range(offset, offset + 499);

    if (error) throw error;

    for (const row of data || []) {
      const otherId =
        row.blocker_id === browserId
          ? row.blocked_id
          : row.blocker_id;

      blocked.add(otherId);
    }

    if (!data || data.length < 500) break;

    offset += 500;
  }

  socket.data.blockedBrowserIds = blocked;
}

function findPartner(socket) {
  if (!socket.connected) return;

  if (partners.has(socket.id)) {
    socket.emit(
      "match-error",
      "You are already connected."
    );
    return;
  }

  removeFromWaiting(socket.id);
  cleanWaitingQueue();

  const index = waitingUsers.findIndex((candidate) => {
    return (
      candidate !== socket.id &&
      !hasBlocked(socket.id, candidate)
    );
  });

  if (index === -1) {
    waitingUsers.push(socket.id);
    socket.emit("waiting");
    return;
  }

  const [partnerId] = waitingUsers.splice(index, 1);

  if (!io.sockets.sockets.has(partnerId)) {
    findPartner(socket);
    return;
  }

  partners.set(socket.id, partnerId);
  partners.set(partnerId, socket.id);

  io.to(partnerId).emit("partner-found", {
    initiator: true,
  });

  socket.emit("partner-found", {
    initiator: false,
  });

  console.log("Two users matched!");
}

async function searchForPartner(socket) {
  if (!socket.connected) return;

  const generation =
    (socket.data.searchGeneration || 0) + 1;

  socket.data.searchGeneration = generation;

  removeFromWaiting(socket.id);

  try {
    await loadBrowserBlocks(socket);

    if (!socket.connected) return;

    if (socket.data.searchGeneration !== generation) {
      return;
    }

    findPartner(socket);
  } catch (error) {
    console.error(
      "Block lookup failed:",
      error.message
    );

    if (
      socket.connected &&
      socket.data.searchGeneration === generation
    ) {
      socket.emit(
        "match-error",
        "Unable to check blocks. Please try again."
      );
    }
  }
}

async function saveBrowserBlock(blockerId, blockedId) {
  if (!db || !blockerId || !blockedId) {
    return false;
  }

  if (blockerId === blockedId) {
    return false;
  }

  const expiresAt = new Date(
    Date.now() + BLOCK_DURATION_MS
  ).toISOString();

  const { error } = await db
    .from("browser_blocks")
    .upsert(
      {
        blocker_id: blockerId,
        blocked_id: blockedId,
        expires_at: expiresAt,
      },
      {
        onConflict: "blocker_id,blocked_id",
      }
    );

  if (error) throw error;

  return true;
}

io.on("connection", (socket) => {
  const suppliedId = socket.handshake.auth?.browserId;

  socket.data.browserId =
    typeof suppliedId === "string" &&
    UUID_PATTERN.test(suppliedId)
      ? suppliedId.toLowerCase()
      : null;

  socket.data.blockedBrowserIds = new Set();
  socket.data.searchGeneration = 0;

  console.log("User connected:", socket.id);

  socket.on("find-partner", () => {
    void searchForPartner(socket);
  });

  socket.on("chat-message", (message) => {
    const partnerId = partners.get(socket.id);

    if (!partnerId || typeof message !== "string") {
      return;
    }

    const text = message.trim().slice(0, 1000);

    if (text) {
      io.to(partnerId).emit("chat-message", text);
    }
  });

  socket.on("next-partner", () => {
    disconnectPartner(socket.id);
    removeFromWaiting(socket.id);

    void searchForPartner(socket);
  });

  socket.on("block-user", async () => {
    const partnerId = partners.get(socket.id);

    if (!partnerId) {
      socket.emit(
        "block-error",
        "No stranger to block."
      );
      return;
    }

    const partnerSocket =
      io.sockets.sockets.get(partnerId);

    const blockerId = socket.data.browserId;
    const blockedId = partnerSocket?.data.browserId;

    // Block this connection immediately.
    blockUser(socket.id, partnerId);

    if (blockerId && blockedId) {
      socket.data.blockedBrowserIds.add(blockedId);

      if (partnerSocket) {
        partnerSocket.data.blockedBrowserIds.add(
          blockerId
        );
      }
    }

    disconnectPartner(socket.id);
    removeFromWaiting(socket.id);

    io.to(partnerId).emit("blocked-by-partner");

    try {
      const saved = await saveBrowserBlock(
        blockerId,
        blockedId
      );

      socket.emit(
        "user-blocked",
        saved
          ? "User blocked for 30 days on this browser."
          : "User blocked for this session only."
      );

      if (saved) {
        console.log(
          "Browser block saved to Supabase."
        );
      }
    } catch (error) {
      console.error(
        "Block saving failed:",
        error.message
      );

      socket.emit(
        "user-blocked",
        "User blocked for this session. Could not save block."
      );
    }
  });

  // Report User: existing Supabase functionality.
  socket.on(
    "report-user",
    async (payload, acknowledge) => {
      const reply = (ok, message) => {
        if (typeof acknowledge === "function") {
          acknowledge({ ok, message });
        }
      };

      const partnerId = partners.get(socket.id);

      if (
        !partnerId ||
        partners.get(partnerId) !== socket.id
      ) {
        reply(
          false,
          "You must be connected to someone to report them."
        );
        return;
      }

      const reason =
        payload && typeof payload === "object"
          ? payload.reason
          : undefined;

      if (
        typeof reason !== "string" ||
        !REPORT_REASONS.has(reason)
      ) {
        reply(
          false,
          "Please choose a valid report reason."
        );
        return;
      }

      const now = Date.now();

      const previous =
        reportCooldowns.get(socket.id) || 0;

      if (
        savingReports.has(socket.id) ||
        now - previous < REPORT_COOLDOWN_MS
      ) {
        reply(
          false,
          "Please wait before sending another report."
        );
        return;
      }

      if (!db) {
        reply(
          false,
          "Reporting is not configured."
        );
        return;
      }

      savingReports.add(socket.id);

      try {
        const { error } = await db
          .from("reports")
          .insert({
            reporter_socket_id: socket.id,
            reported_socket_id: partnerId,
            reason,
          });

        if (error) throw error;

        reportCooldowns.set(
          socket.id,
          Date.now()
        );

        console.log(
          "Report saved to Supabase:",
          reason
        );
      } catch (error) {
        console.error(
          "Report saving failed:",
          error.message
        );

        reply(
          false,
          "Could not save report. Please try again."
        );
        return;
      } finally {
        savingReports.delete(socket.id);
      }

      reply(
        true,
        "Report received. Thank you."
      );
    }
  );

  socket.on("webrtc-offer", (offer) => {
    const partnerId = partners.get(socket.id);

    if (partnerId) {
      io.to(partnerId).emit(
        "webrtc-offer",
        offer
      );
    }
  });

  socket.on("webrtc-answer", (answer) => {
    const partnerId = partners.get(socket.id);

    if (partnerId) {
      io.to(partnerId).emit(
        "webrtc-answer",
        answer
      );
    }
  });

  socket.on("ice-candidate", (candidate) => {
    const partnerId = partners.get(socket.id);

    if (partnerId) {
      io.to(partnerId).emit(
        "ice-candidate",
        candidate
      );
    }
  });

  socket.on("disconnect", () => {
    socket.data.searchGeneration++;

    removeFromWaiting(socket.id);
    disconnectPartner(socket.id);

    blockedUsers.delete(socket.id);
    reportCooldowns.delete(socket.id);

    for (const blocked of blockedUsers.values()) {
      blocked.delete(socket.id);
    }

    console.log(
      "User disconnected:",
      socket.id
    );
  });
});

// Remove expired blocks daily.
async function deleteExpiredBlocks() {
  if (!db) return;

  const { error } = await db
    .from("browser_blocks")
    .delete()
    .lte(
      "expires_at",
      new Date().toISOString()
    );

  if (error) {
    console.error(
      "Expired block cleanup failed:",
      error.message
    );
  }
}

if (db) {
  void deleteExpiredBlocks();

  const cleanupTimer = setInterval(
    () => void deleteExpiredBlocks(),
    24 * 60 * 60 * 1000
  );

  cleanupTimer.unref();
}

httpServer.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `TALK ANYONE connection server running on port ${PORT}`
    );
  }
);
