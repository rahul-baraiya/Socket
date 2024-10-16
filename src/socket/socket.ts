import { Server, Socket } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

interface UserSocketMap {
  [userId: string]: string;
}

const userSocketMap: UserSocketMap = {};
const userStatusMap: { [userId: string]: boolean } = {}; // { userId: inCall: boolean }

const getReceiverSocketId = (receiverId: string): string | undefined => {
  return userSocketMap[receiverId];
};

io.on("connection", (socket: Socket) => {
  const userId: string | undefined = socket.handshake.query.userId as
    | string
    | undefined;

  if (userId) {
    userSocketMap[userId] = socket.id;
    userStatusMap[userId] = false; // User is not in a call initially
    console.log(`User connected: ${userId}, Socket ID: ${socket.id}`);

    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  } else {
    console.log("User connected without userId");
  }

  socket.on("disconnect", () => {
    if (userId) {
      delete userSocketMap[userId];
      delete userStatusMap[userId];
      io.emit("getOnlineUsers", Object.keys(userSocketMap));
      console.log(`User disconnected: ${userId}`);
    }
  });

  socket.on("callUser", ({ receiverId, signalData, callType }) => {
    const receiverSocketId = getReceiverSocketId(receiverId);

    if (receiverSocketId) {
      if (userStatusMap[receiverId]) {
        io.to(socket.id).emit("userBusy");
        return;
      }

      userStatusMap[userId!] = true; // Mark the caller as in call
      userStatusMap[receiverId] = true; // Mark the receiver as in call

      io.to(receiverSocketId).emit("incomingCall", {
        signalData,
        from: userId,
        callType,
      });
      console.log(`Call initiated from ${userId} to ${receiverId}`);
    } else {
      socket.emit("callFailed", { message: "User is not available." });
      console.log(`Call initiation failed: ${receiverId} not found`);
    }
  });

  socket.on("answerCall", ({ to, signalData }) => {
    const receiverSocketId = getReceiverSocketId(to);

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("callAccepted", { signalData });
      console.log(`Call answered by ${userId} for ${to}`);
    } else {
      socket.emit("callAnswerFailed", { message: "Call recipient not found." });
      console.log(`Call answer failed: ${to} not found`);
    }
  });

  socket.on("rejectCall", ({ to }) => {
    const receiverSocketId = getReceiverSocketId(to);

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("callRejected");
      console.log(`Call rejected by ${userId} for ${to}`);
      userStatusMap[to] = false; // Mark as not in call
      userStatusMap[userId!] = false; // Mark as not in call
    } else {
      socket.emit("callRejectFailed", { message: "Call recipient not found." });
      console.log(`Call rejection failed: ${to} not found`);
    }
  });

  socket.on("iceCandidate", ({ to, candidate }) => {
    const receiverSocketId = getReceiverSocketId(to);

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("iceCandidate", { candidate });
      console.log(`ICE candidate sent from ${userId} to ${to}`);
    } else {
      socket.emit("iceCandidateFailed", { message: "User not available." });
      console.log(`ICE candidate sending failed: ${to} not found`);
    }
  });

  socket.on("endCall", ({ to }) => {
    const receiverSocketId = getReceiverSocketId(to);

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("callEnded"); // Notify the receiver
    }

    // Notify the caller as well
    socket.emit("callEnded");

    userStatusMap[to] = false; // Mark both as not in call
    userStatusMap[userId!] = false;
    console.log(`Call ended by ${userId} for ${to}`);
  });

  socket.on("busy", ({ to }) => {
    const receiverSocketId = getReceiverSocketId(to);

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("userBusy", { message: "User is busy." });
      console.log(`User ${to} is busy`);
    } else {
      socket.emit("busyFailed", { message: "User not available." });
      console.log(`User busy notification failed: ${to} not found`);
    }
  });
});

export { app, io, server, getReceiverSocketId };
