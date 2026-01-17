import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());

// Serve static files from dist folder (production)
app.use(express.static(join(__dirname, 'dist')));

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all for prototype
        methods: ["GET", "POST"]
    }
});

let users = {};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', (userData) => {
        users[socket.id] = { ...userData, id: socket.id, x: Math.random() * 300, y: Math.random() * 300 };
        // Broadcast to everyone including sender
        io.emit('state_update', Object.values(users));
    });

    socket.on('move', (pos) => {
        if (users[socket.id]) {
            users[socket.id].x = pos.x;
            users[socket.id].y = pos.y;
            socket.broadcast.emit('user_moved', { id: socket.id, x: pos.x, y: pos.y });
        }
    });

    socket.on('instrument_change', (inst) => {
        if (users[socket.id]) {
            users[socket.id].instrument = inst;
            io.emit('state_update', Object.values(users));
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        delete users[socket.id];
        io.emit('state_update', Object.values(users));
    });
});

// Serve index.html for all routes (SPA)
app.get('*', (req, res) => {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
