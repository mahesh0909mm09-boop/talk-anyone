
const { createServer } = require("http");
const { Server } = require("socket.io");

// Works on your Mac and on Render
const PORT = Number(process.env.PORT) || 3001;

// Allowed frontend websites
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://talk-anyone.vercel.app",
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(
    process.env.FRONTEND_URL.replace(/\/$/, "")
  );
}

// Health check for online hosting
const httpServer = createServer((req, res) => {
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, {
      "Content-Type": "application/json",
    });

    res.end(
      JSON.stringify({
        status: "ok",
        service: "TALK ANYONE connection server",
      })
    );
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

// Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

// Matching and blocking
const waitingUsers = [];
const partners = new Map();
const blockedUsers = new Map();

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

function hasBlocked(user1, user2) {
  return (
    blockedUsers.get(user1)?.has(user2) ||
    blockedUsers.get(user2)?.has(user1) ||
    false
  );
}

function blockUser(user1, user2) {
  if (!blockedUsers.has(user1)) {
    blockedUsers.set(user1, new Set());
  }

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
    socket.emit(
      "match-error",
      "You are already connected."
    );
    return;
  }

  removeFromWaiting(socket.id);
  cleanWaitingQueue();

  // Find an eligible waiting stranger.
  // Keep blocked candidates in the queue for other users.
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

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Find random stranger
  socket.on("find-partner", () => {
    findPartner(socket);
  });

  // Text chat
  socket.on("chat-message", (message) => {
    const partnerId = partners.get(socket.id);

    if (!partnerId) return;
    if (typeof message !== "string") return;

    const text = message.trim().slice(0, 1000);

    if (text) {
      io.to(partnerId).emit("chat-message", text);
    }
  });

  // Next stranger
  socket.on("next-partner", () => {
    disconnectPartner(socket.id);
    removeFromWaiting(socket.id);
    findPartner(socket);
  });

  // Block current stranger
  socket.on("block-user", () => {
    const partnerId = partners.get(socket.id);

    if (!partnerId) {
      socket.emit(
        "block-error",
        "No stranger to block."
      );
      return;
    }

    blockUser(socket.id, partnerId);

    disconnectPartner(socket.id);
    removeFromWaiting(socket.id);

    socket.emit(
      "user-blocked",
      "User blocked successfully."
    );

    io.to(partnerId).emit("blocked-by-partner");

    console.log("User blocked:", socket.id);
  });

  // WebRTC video/audio signaling
  socket.on("webrtc-offer", (offer) => {
    const partnerId = partners.get(socket.id);

    if (partnerId) {
      io.to(partnerId).emit("webrtc-offer", offer);
    }
  });

  socket.on("webrtc-answer", (answer) => {
    const partnerId = partners.get(socket.id);

    if (partnerId) {
      io.to(partnerId).emit("webrtc-answer", answer);
    }
  });

  socket.on("ice-candidate", (candidate) => {
    const partnerId = partners.get(socket.id);

    if (partnerId) {
      io.to(partnerId).emit("ice-candidate", candidate);
    }
  });

  // Disconnect cleanup
  socket.on("disconnect", () => {
    removeFromWaiting(socket.id);
    disconnectPartner(socket.id);

    blockedUsers.delete(socket.id);

    for (const blocked of blockedUsers.values()) {
      blocked.delete(socket.id);
    }

    console.log("User disconnected:", socket.id);
  });
});

// Start the connection server
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(
    `TALK ANYONE connection server running on port ${PORT}`
  );
});
