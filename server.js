const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

app.get('/chat/:roomId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/', (req, res) => {
    const randomRoom = Math.random().toString(36).substring(2, 10);
    res.redirect(`/chat/${randomRoom}`);
});

const roomMembers = {};

io.on('connection', (socket) => {
    let currentRoom = null;

    socket.on('join-room', ({ roomId }) => {
        currentRoom = roomId;
        socket.join(roomId);
        if (!roomMembers[roomId]) roomMembers[roomId] = new Set();
        roomMembers[roomId].add(socket.id);

        io.to(roomId).emit('room-status', { memberCount: roomMembers[roomId].size });
    });

    socket.on('send-message', (data) => {
        socket.to(data.roomId).emit('receive-message', data);
    });

    socket.on('edit-message', (data) => {
        socket.to(data.roomId).emit('message-edited', data);
    });

    socket.on('delete-message', (data) => {
        socket.to(data.roomId).emit('message-deleted', data);
    });

    socket.on('mark-read', (data) => {
        socket.to(data.roomId).emit('message-read-update', data);
    });

    socket.on('typing-status', (data) => {
        socket.to(data.roomId).emit('peer-typing', data);
    });

    socket.on('disconnect', () => {
        if (currentRoom && roomMembers[currentRoom]) {
            roomMembers[currentRoom].delete(socket.id);
            io.to(currentRoom).emit('room-status', { memberCount: roomMembers[currentRoom].size });
            if (roomMembers[currentRoom].size === 0) delete roomMembers[currentRoom];
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Telegram Chat Server live on port ${PORT}`));