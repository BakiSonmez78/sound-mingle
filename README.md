# SoundMingle 🎵

A real-time musical collaboration platform that analyzes your Spotify listening history to determine your "soul instrument" and connects you with other musicians for harmonious jam sessions.

## Features

- 🎸 **Soul Instrument Detection**: Analyzes your Spotify data to assign you an instrument based on your music taste
- 🎼 **Ensemble Director (Audio Engine 5.0)**: Intelligent music system with:
  - Role-based instrument assignment (Rhythm vs Lead)
  - Harmonic locking (Mediterranean/Phrygian mode)
  - Real instrument samples via Tone.js
  - Dynamic chord progressions
- 🌐 **Real-time Collaboration**: Socket.io powered multi-user sessions
- 🎹 **Supported Instruments**:
  - Classical Guitar
  - Bağlama (Turkish Saz)
  - Bass Guitar
  - Electric Guitar
  - Jazz Drums
  - Violin
  - Cello

## Tech Stack

- **Frontend**: React + Vite
- **Audio**: Tone.js (Web Audio API)
- **Real-time**: Socket.io
- **Auth**: Spotify OAuth (PKCE)
- **Styling**: Tailwind CSS

## Setup

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/sound-mingle.git
cd sound-mingle
```

2. Install dependencies:
```bash
npm install
```

3. Configure Spotify App:
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Create a new app
   - Add redirect URI: `http://localhost:5173/callback` (for local dev)
   - Copy your Client ID to `src/spotify.js`

4. Start the development server:
```bash
npm run dev
```

5. In a separate terminal, start the Socket.io server:
```bash
node server.js
```

## Deployment

### Using Vercel (Recommended)

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Update Spotify Redirect URI with your Vercel URL + `/callback`

### Using localhost.run (Temporary Testing)

```bash
ssh -R 80:localhost:5174 nokey@localhost.run
```

Then update Spotify Redirect URI with the provided URL.

## Musical Theory

The Ensemble Director implements sophisticated music theory rules:

- **Mediterranean Lock**: Bağlama triggers Phrygian Dominant scale (Hicaz)
- **Twin Guitars**: Automatic role split (Rhythm/Lead)
- **Harmonic Compatibility**: All instruments forced to compatible scales
- **Dynamic BPM**: Smooth tempo transitions when instruments join/leave

## License

MIT

## Credits

Built with ❤️ using:
- [Tone.js](https://tonejs.github.io/)
- [Socket.io](https://socket.io/)
- [Spotify Web API](https://developer.spotify.com/)
