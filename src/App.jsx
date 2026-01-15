import React, { useState, useEffect, useRef } from 'react';
import { Music, Disc, Zap, Activity, Users, RefreshCw, Bluetooth, Radio, LogIn, Volume2, Settings, Play } from 'lucide-react';
import * as Tone from 'tone';
import { io } from 'socket.io-client';
import { audioEngine } from './audio/engine';
import { loginWithSpotify, handleCallback, analyzeSoulInstrument, isLoggedIn } from './spotify';

const INSTRUMENTS_LIST = [
  { id: 'classical_guitar', name: 'Classical Guitar', icon: Music, color: '#f59e0b' },
  { id: 'baglama', name: 'Bağlama', icon: Music, color: '#d97706' },
  { id: 'bass', name: 'Bass Guitar', icon: Zap, color: '#ef4444' },
  { id: 'electric_guitar', name: 'Electric Guitar', icon: Zap, color: '#3b82f6' },
  { id: 'jazz_drums', name: 'Jazz Drums', icon: Disc, color: '#10b981' },
  { id: 'violin', name: 'Violin', icon: Activity, color: '#8b5cf6' },
  { id: 'cello', name: 'Cello', icon: Activity, color: '#6366f1' },
];

const socket = io('/', { autoConnect: false });

function App() {
  const [started, setStarted] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [myInstrument, setMyInstrument] = useState(null);
  const [others, setOthers] = useState([]);
  const [activeGenre, setActiveGenre] = useState('');
  const [harmony, setHarmony] = useState({ score: 0, description: '' });
  const [loading, setLoading] = useState(false);
  const [debugLog, setDebugLog] = useState([]);
  const [soulAnalysis, setSoulAnalysis] = useState(null);

  // Audio Diagnostics State
  const [audioContextRunning, setAudioContextRunning] = useState(false);
  const [transportState, setTransportState] = useState('stopped');
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const connectionRef = useRef(false);

  useEffect(() => {
    // Spotify Callback Handling
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      setLoading(true);
      handleCallback().then(() => analyzeSoulInstrument()).then(analysis => {
        setSoulAnalysis(analysis);
        setLoading(false);
      }).catch(err => {
        console.error("Spotify Login Failed", err);
        setLoading(false);
      });
    }

    // Audio State Polling
    const checkAudio = setInterval(() => {
      setAudioContextRunning(Tone.context.state === 'running');
      setTransportState(Tone.Transport.state);
    }, 500);
    return () => clearInterval(checkAudio);
  }, []);

  // Debug Logger (On Screen)
  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;
    const addLog = (msg) => setDebugLog(prev => [...prev.slice(-4), msg]);

    console.log = (...args) => {
      const msg = args.join(' ');
      if (msg.includes('Audio') || msg.includes('Soundfont') || msg.includes('Switching')) {
        addLog(`ℹ️ ${msg}`);
      }
      originalLog(...args);
    };
    console.error = (...args) => {
      addLog(`❌ ${args.join(' ')}`);
      originalError(...args);
    };
    return () => { console.log = originalLog; console.error = originalError; };
  }, []);

  // Socket Listeners
  useEffect(() => {
    socket.on('state_update', (users) => {
      const myId = socket.id;
      const otherUsers = users.filter(u => u.id !== myId).map(u => ({
        ...u,
        color: INSTRUMENTS_LIST.find(i => i.id === u.instrument)?.color || '#fff'
      }));
      setOthers(otherUsers);
    });
    socket.on('user_moved', data => setOthers(prev => prev.map(u => u.id === data.id ? { ...u, x: data.x, y: data.y } : u)));
    return () => { socket.off('state_update'); socket.off('user_moved'); };
  }, []);

  // Music Loop Logic
  useEffect(() => {
    if (!started) return;
    const interval = setInterval(() => {
      const allInst = [
        { type: myInstrument.id },
        ...others.map(u => ({ type: u.instrument }))
      ];
      audioEngine.updateSession(allInst);

      const types = allInst.map(i => i.type);
      let genre = 'Solo';
      const has = t => types.includes(t);
      if (types.length >= 4) genre = 'Orchestral Ensemble';
      else if (has('bass') && has('electric_guitar')) genre = 'Heavy Metal Jam';
      else if (has('classical_guitar') && has('baglama')) genre = 'Folk Fusion';
      else if (types.length > 1) genre = 'Free Jam';
      setActiveGenre(genre);

      const { score, description } = calculateHarmony(allInst);
      setHarmony({ score, description });
    }, 500);
    return () => clearInterval(interval);
  }, [started, others, myInstrument]);

  const calculateHarmony = (instruments) => {
    const types = instruments.map(i => i.type);
    const has = t => types.includes(t);
    if (has('bass') && has('electric_guitar')) return { score: 95, description: "Rock Partners" };
    if (instruments.length < 2) return { score: 100, description: "Finding Partner..." };
    return { score: 85, description: "Jamming" };
  };

  const forceAudioStart = async () => {
    await Tone.start();
    await Tone.context.resume();
    console.log("Forced Audio Resume");
  };

  const testBeep = () => {
    const osc = new Tone.Oscillator(440, "sine").toDestination().start();
    osc.stop("+0.2");
    console.log("Test Beep Triggered");
  };

  const handleStartWithSoul = async () => {
    if (!soulAnalysis && !myInstrument) return; // Fallback logic needed

    // Default to Guitar if no analysis
    const instId = soulAnalysis ? soulAnalysis.instrument : 'classical_guitar';
    const inst = INSTRUMENTS_LIST.find(i => i.id === instId) || INSTRUMENTS_LIST[0];

    await forceAudioStart();

    setMyInstrument(inst);
    setScanning(true);

    setTimeout(async () => {
      setLoading(true);
      setScanning(false);
      try {
        await audioEngine.init();
        // audioEngine.startOrchestra(); // Handled by updateSession loop now
        // Force start transport just in case
        Tone.Transport.start();

        socket.connect();
        socket.emit('join', { instrument: inst.id, name: 'User' });
        connectionRef.current = true;
        setStarted(true);
      } catch (e) {
        console.error("Init failed", e);
        setStarted(true);
      } finally {
        setLoading(false);
      }
    }, 2000);
  };

  if (!started) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-transparent backdrop-blur-md relative z-50">
        <h1 className="text-6xl font-black mb-4 bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">
          SoundMingle
        </h1>

        {scanning ? (
          <div className="flex flex-col items-center animate-in fade-in zoom-in py-12">
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-4 border-blue-500 border-t-transparent animate-spin mb-4"></div>
              <Bluetooth className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-400 animate-pulse" size={32} />
            </div>
            <h2 className="text-2xl font-bold text-blue-400 mb-2">Searching...</h2>
          </div>
        ) : loading ? (
          <div className="animate-pulse text-2xl font-bold text-accent py-12">Loading Audio...</div>
        ) : soulAnalysis ? (
          <div className="glass-panel p-8 max-w-md w-full animate-in slide-in-from-bottom-10">
            <h2 className="text-3xl font-black text-white mb-2 capitalize">
              {INSTRUMENTS_LIST.find(i => i.id === soulAnalysis.instrument)?.name}
            </h2>
            <button onClick={handleStartWithSoul} className="w-full py-4 bg-green-500 text-black font-bold rounded-xl text-lg mt-4 flex items-center justify-center gap-2">
              <Radio size={20} /> Broadcast My Soul
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <button onClick={loginWithSpotify} className="flex items-center gap-3 px-8 py-4 bg-[#1DB954] text-black font-bold rounded-full text-xl hover:scale-105 transition shadow-xl">
              <LogIn size={24} /> Connect Spotify
            </button>
            <div className="grid grid-cols-3 gap-2 mt-8 opacity-50">
              {INSTRUMENTS_LIST.map(inst => (
                <button key={inst.id} onClick={() => {
                  setSoulAnalysis({ instrument: inst.id, topGenres: [], topArtists: [], topTracks: [] });
                }} className="p-2 border border-white/10 rounded text-xs">{inst.name}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col md:flex-row relative">
      {/* FORCE AUDIO OVERLAY */}
      {!audioContextRunning && (
        <div className="fixed top-0 left-0 w-full h-full bg-black/90 z-[100] flex items-center justify-center">
          <button onClick={forceAudioStart} className="px-12 py-8 bg-red-600 text-white font-black text-3xl rounded-2xl animate-bounce flex items-center gap-4">
            <Volume2 size={48} /> TAP TO UNMUTE
          </button>
        </div>
      )}

      {/* DIAGNOSTICS PANEL (Top Right) */}
      <div className="fixed top-4 right-4 z-[60]">
        <button onClick={() => setShowDiagnostics(!showDiagnostics)} className="p-2 bg-gray-800 rounded-full text-white opacity-50 hover:opacity-100">
          <Settings size={20} />
        </button>
      </div>

      {showDiagnostics && (
        <div className="fixed top-16 right-4 z-[60] bg-black/90 border border-red-500 p-4 rounded text-xs font-mono w-64 text-red-400">
          <h4 className="font-bold underline mb-2">AUDIO DIAGNOSTICS</h4>
          <div>Context: <span className={audioContextRunning ? "text-green-500" : "text-red-500"}>{audioContextRunning ? 'RUNNING' : 'SUSPENDED'}</span></div>
          <div>Transport: <span className={transportState === 'started' ? "text-green-500" : "text-yellow-500"}>{transportState}</span></div>
          <div>Genre: {activeGenre}</div>
          <div>Participants: {others.length + 1}</div>
          <div className="mt-4 flex flex-col gap-2">
            <button onClick={testBeep} className="bg-white text-black p-2 font-bold rounded hover:bg-gray-200">
              🔊 TEST BEEP (RAW)
            </button>
            <button onClick={() => { Tone.Transport.stop(); Tone.Transport.start(); }} className="bg-blue-600 text-white p-2 rounded">
              🔄 RESTART TRANSPORT
            </button>
            <button onClick={() => window.location.reload()} className="bg-red-900 text-white p-2 rounded">
              ⚠️ RELOAD APP
            </button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="md:w-80 glass-panel m-4 p-4 flex flex-col z-50">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Radio className="text-red-500 animate-pulse" /> Soul Radar
        </h3>
        <div className="space-y-3 overflow-y-auto max-h-[60vh]">
          {/* My Instrument */}
          <div className="p-3 glass-panel bg-white/5 flex items-center gap-3 border border-green-500/30">
            <Music size={16} className="text-blue-400" />
            <div className="flex flex-col">
              <span className="text-sm font-bold">You ({myInstrument?.name})</span>
              <span className="text-xs text-green-400">● Live</span>
            </div>
          </div>
          {/* Others */}
          {others.map(u => (
            <div key={u.id} className="p-3 glass-panel flex items-center gap-3">
              <Music size={16} color={u.color} />
              <div className="flex flex-col">
                <span className="font-bold text-sm">Found: {INSTRUMENTS_LIST.find(i => i.id === u.instrument)?.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Radar */}
      <div className="flex-1 m-4 relative glass-panel overflow-hidden flex flex-col items-center justify-center">
        <div className="radar-grid opacity-30 pointer-events-none absolute inset-0"></div>
        <div className="z-10 text-center mb-10">
          <h2 className="text-4xl md:text-6xl font-black tracking-widest uppercase text-white drop-shadow-lg animate-pulse">
            {activeGenre}
          </h2>
          <div className="text-xl text-gray-400 mt-4">Ensemble Size: {others.length + 1}</div>
        </div>
        <div className="relative w-64 h-64 md:w-96 md:h-96 border-4 border-dashed border-white/20 rounded-full flex items-center justify-center mb-8">
          <div className="absolute inset-0 rounded-full border border-blue-500/20 animate-ping"></div>
          <div className="absolute w-24 h-24 rounded-full flex items-center justify-center bg-white/10 backdrop-blur-md z-20">
            {myInstrument && <myInstrument.icon size={48} color={myInstrument.color} />}
          </div>
          {others.map((u, i) => {
            const angle = (i / others.length) * 2 * Math.PI; const r = 140;
            return <div key={u.id} className="absolute w-12 h-12 bg-black/50 border border-white/30 rounded-full flex items-center justify-center"
              style={{ transform: `translate(${Math.cos(angle) * r}px, ${Math.sin(angle) * r}px)` }}><Music size={20} color={u.color} /></div>
          })}
        </div>

        {/* On-Screen Log */}
        <div className="fixed bottom-0 left-0 w-full p-2 bg-black/90 text-[10px] text-left font-mono h-24 overflow-y-auto pointer-events-none opacity-50">
          {debugLog.map((l, i) => <div key={i} className="text-green-400">{l}</div>)}
        </div>
      </div>
    </div>
  );
}

export default App;
