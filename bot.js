
import { io } from 'socket.io-client';

// Connect directly to the Backend Port (3001), not the Frontend Vite Port
const socket = io('http://localhost:3001');

const BOT_NAME = "Virtual Bassist 🤖";
const INSTRUMENT = "bass";

console.log(`Connecting ${BOT_NAME} to Jam Session...`);

socket.on('connect', () => {
    console.log(`✅ ${BOT_NAME} Connected! ID: ${socket.id}`);

    // Join the session
    socket.emit('join', {
        instrument: INSTRUMENT,
        name: BOT_NAME
    });

    // Move around randomly to look alive on radar
    setInterval(() => {
        const x = (Math.random() - 0.5) * 50;
        const y = (Math.random() - 0.5) * 50;
        socket.emit('move', { x, y });
    }, 2000);
});

socket.on('disconnect', () => {
    console.log('❌ Disconnected');
});

socket.on('connect_error', (err) => {
    console.error('❌ Connection Error:', err.message);
});
