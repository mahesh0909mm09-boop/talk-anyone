
const { createServer } = require("http");
const { Server } = require("socket.io");

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const waitingUsers = [];
const partners = new Map();
const blockedUsers = new Map();

function removeFromWaiting(id) {
  const index = waitingUsers.indexOf(id);
  if (index !== -1) waitingUsers.splice(index, 1);
}

function hasBlocked(user1, user2) {
  return blockedUsers.get(user1)?.has(user2) ||
         blockedUsers.get(user2)?.has(user1);
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
  partners.delete(partnerId);

  io.to(partnerId).emit("partner-left");
}

function findPartner(socket) {
  if (partners.has(socket.id)) {
    socket.emit("match-error", "You are already connected.");
    return;
  }

  removeFromWaiting(socket.id);

  let partnerId;

  while (waitingUsers.length > 0) {
    const candidate = waitingUsers.shift();

    if (
      candidate !== socket.id &&
      io.sockets.sockets.has(candidate) &&
      !hasBlocked(socket.id, candidate)
    ) {
      partnerId = candidate;
      break;
    }
  }

  if (!partnerId) {
    waitingUsers.push(socket.id);
    socket.emit("waiting");
    return;
  }

  partners.set(socket.id, partnerId);
  partners.set(partnerId, socket.id);

  io.to(partnerId).emit("partner-found", { initiator: true });
  io.to(socket.id).emit("partner-found", { initiator: false });

  console.log("Two users matched!");
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("chat-message", (message) => {
    const partnerId = partners.get(socket.id);

    if (!partnerId) return;
    if (typeof message !== "string") return;

    const text = message.trim().slice(0, 1000);

    if (text) {
      io.to(partnerId).emit("chat-message", text);
    }
  });

  socket.on("find-partner", () => {
    findPartner(socket);
  });

  socket.on("next-partner", () => {
    disconnectPartner(socket.id);
    removeFromWaiting(socket.id);
    findPartner(socket);
  });

  // BLOCK CURRENT STRANGER
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
    console.log("User disconnected:", socket.id);
  });
});

httpServer.listen(3001, () => {
  console.log("TALK ANYONE connection server running on port 3001");
});
