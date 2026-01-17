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
// Serve static files from dist folder (production)
const distPath = join(__dirname, 'dist');
import fs from 'fs';
if (fs.existsSync(distPath)) {
    console.log('✅ Dist folder found at:', distPath);
    console.log('📂 Contents:', fs.readdirSync(distPath));
} else {
    console.error('❌ DIST FOLDER NOT FOUND at:', distPath);
    console.error('⚠️ Did you run "npm run build"?');
    // We will attempt to serve anyway, but it will likely fail
}

app.use(express.static(distPath));

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

// Serve index.html for all routes (SPA) - must be after socket.io setup
// Serve index.html for all routes (SPA) - must be after socket.io setup
// Explicit root handler to fail loudly if static files miss
app.get('/', (req, res) => {
    const indexPath = join(__dirname, 'dist', 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(500).send(`
            <html>
                <body style="font-family: sans-serif; padding: 2rem; background: #1a1a1a; color: #fff;">
                    <h1>⚠️ SoundMingle Deployment Status</h1>
                    <p><strong>Status:</strong> Server is running, but Frontend (Build) is missing.</p>
                    <p>This means 'vite build' failed or didn't run on Render.</p>
                    <hr style="border-color: #333;">
                    <p><em>Attempting to debug deployment...</em></p>
                </body>
            </html>
        `);
    }
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
