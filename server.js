/* STREAMING_CHUNK:Building Node.js Express & Socket.io Backend Server... */
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// Serve static directory
app.use(express.static(path.join(__dirname, 'public')));

// Dynamic chat link routing
app.get('/chat/:roomId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Fallback for root path - redirect to new random room
app.get('/', (req, res) => {
    const randomRoom = Math.random().toString(36).substring(2, 11);
    res.redirect(`/chat/${randomRoom}`);
});

// Track current connected room counts
const roomMembers = {};

io.on('connection', (socket) => {
    let currentRoom = null;

    // Join Private Link Room
    socket.on('join-room', ({ roomId }) => {
        currentRoom = roomId;
        socket.join(roomId);

        if (!roomMembers[roomId]) {
            roomMembers[roomId] = new Set();
        }
        roomMembers[roomId].add(socket.id);

        // Notify occupants of updated peer count
        io.to(roomId).emit('room-status', {
            memberCount: roomMembers[roomId].size
        });
    });

    // Handle outbound messages
    socket.on('send-message', (data) => {
        // Attach socket ID
        data.senderId = socket.id;

        // Broadcast to all sockets in room (including sender)
        io.to(data.roomId).emit('receive-message', data);
    });

    // Mark single/double read receipts
    socket.on('mark-read', ({ messageId, roomId }) => {
        // Notify sender that the peer has read the message
        socket.to(roomId).emit('message-read-update', { messageId });
    });

    // Dynamic typing status relay
    socket.on('typing-status', ({ roomId, isTyping }) => {
        socket.to(roomId).emit('peer-typing', {
            senderId: socket.id,
            isTyping
        });
    });

    // Disconnect cleanup
    socket.on('disconnect', () => {
        if (currentRoom && roomMembers[currentRoom]) {
            roomMembers[currentRoom].delete(socket.id);
            io.to(currentRoom).emit('room-status', {
                memberCount: roomMembers[currentRoom].size
            });
            if (roomMembers[currentRoom].size === 0) {
                delete roomMembers[currentRoom];
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Telegram Chat Server live at http://localhost:${PORT}`);
});