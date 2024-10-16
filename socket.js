"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReceiverSocketId = exports.server = exports.io = exports.app = void 0;
const socket_io_1 = require("socket.io");
const http_1 = __importDefault(require("http"));
const express_1 = __importDefault(require("express"));
const app = (0, express_1.default)();
exports.app = app;
const server = http_1.default.createServer(app);
exports.server = server;
const io = new socket_io_1.Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});
exports.io = io;
const userSocketMap = {};
const userStatusMap = {}; // { userId: inCall: boolean }
const getReceiverSocketId = (receiverId) => {
    return userSocketMap[receiverId];
};
exports.getReceiverSocketId = getReceiverSocketId;
io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;
    if (userId) {
        userSocketMap[userId] = socket.id;
        userStatusMap[userId] = false; // User is not in a call initially
        console.log(`User connected: ${userId}, Socket ID: ${socket.id}`);
        io.emit("getOnlineUsers", Object.keys(userSocketMap));
    }
    else {
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
            userStatusMap[userId] = true; // Mark the caller as in call
            userStatusMap[receiverId] = true; // Mark the receiver as in call
            io.to(receiverSocketId).emit("incomingCall", {
                signalData,
                from: userId,
                callType,
            });
            console.log(`Call initiated from ${userId} to ${receiverId}`);
        }
        else {
            socket.emit("callFailed", { message: "User is not available." });
            console.log(`Call initiation failed: ${receiverId} not found`);
        }
    });
    socket.on("answerCall", ({ to, signalData }) => {
        const receiverSocketId = getReceiverSocketId(to);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("callAccepted", { signalData });
            console.log(`Call answered by ${userId} for ${to}`);
        }
        else {
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
            userStatusMap[userId] = false; // Mark as not in call
        }
        else {
            socket.emit("callRejectFailed", { message: "Call recipient not found." });
            console.log(`Call rejection failed: ${to} not found`);
        }
    });
    socket.on("iceCandidate", ({ to, candidate }) => {
        const receiverSocketId = getReceiverSocketId(to);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("iceCandidate", { candidate });
            console.log(`ICE candidate sent from ${userId} to ${to}`);
        }
        else {
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
        userStatusMap[userId] = false;
        console.log(`Call ended by ${userId} for ${to}`);
    });
    socket.on("busy", ({ to }) => {
        const receiverSocketId = getReceiverSocketId(to);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("userBusy", { message: "User is busy." });
            console.log(`User ${to} is busy`);
        }
        else {
            socket.emit("busyFailed", { message: "User not available." });
            console.log(`User busy notification failed: ${to} not found`);
        }
    });
});
