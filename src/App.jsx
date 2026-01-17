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
  const [spotifyError, setSpotifyError] = useState(null);

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
      console.log('🔐 Detected Spotify callback with code');
      setLoading(true);

      handleCallback()
        .then(() => {
          console.log('✅ Token exchange successful, analyzing music...');
          return analyzeSoulInstrument();
        })
        .then(analysis => {
          console.log('✅ Soul analysis complete:', analysis);
          setSoulAnalysis(analysis);
          setLoading(false);
          // Clean URL AFTER everything succeeds
          window.history.replaceState({}, document.title, '/');
        })
        .catch(err => {
          console.error("❌ Spotify Login Failed:", err);
          setSpotifyError(err.message || 'Failed to connect to Spotify');
          setLoading(false);
          // Clean URL even on error
          window.history.replaceState({}, document.title, '/');
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

        // Apply Spotify Music Profile (Valence & Energy)
        if (soulAnalysis) {
          audioEngine.setMusicProfile(soulAnalysis.valence, soulAnalysis.energy);
          console.log(`🎭 Applied Soul Profile: Valence=${soulAnalysis.valence.toFixed(2)}, Energy=${soulAnalysis.energy.toFixed(2)}`);
        }

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
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
        position: 'relative',
        zIndex: 50
      }}>
        <div className="fade-in" style={{ textAlign: 'center', maxWidth: '600px' }}>
          <h1 className="gradient-text" style={{
            fontSize: 'clamp(3rem, 10vw, 6rem)',
            fontWeight: 900,
            marginBottom: '1rem',
            letterSpacing: '-0.02em'
          }}>
            SoundMingle
          </h1>
          <p style={{
            fontSize: '1.25rem',
            opacity: 0.7,
            marginBottom: '3rem',
            fontWeight: 300
          }}>
            Your musical soul, harmonized with the world
          </p>

          {scanning ? (
            <div className="slide-up" style={{ padding: '3rem 0' }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <div className="spinner" style={{ margin: '0 auto 1.5rem' }}></div>
                <Bluetooth style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  color: 'var(--primary)'
                }} size={32} className="pulse-glow" />
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--primary)' }}>
                Discovering your sound...
              </h2>
            </div>
          ) : loading ? (
            <div className="spinner" style={{ margin: '3rem auto' }}></div>
          ) : soulAnalysis ? (
            <div className="glass-panel slide-up" style={{ padding: '2.5rem', maxWidth: '400px', margin: '0 auto' }}>
              <div style={{
                width: '80px',
                height: '80px',
                margin: '0 auto 1.5rem',
                background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }} className="pulse-glow">
                <Music size={40} />
              </div>
              <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                {INSTRUMENTS_LIST.find(i => i.id === soulAnalysis.instrument)?.name}
              </h2>
              <p style={{ opacity: 0.6, marginBottom: '2rem', fontSize: '0.9rem' }}>
                Your soul instrument
              </p>
              <button onClick={handleStartWithSoul} className="btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                <Radio size={20} /> Start Jamming
              </button>
            </div>
          ) : (
            <div className="slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
              {spotifyError && (
                <div style={{
                  padding: '1rem 1.5rem',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '12px',
                  color: '#ef4444',
                  fontSize: '0.875rem',
                  maxWidth: '400px'
                }}>
                  <strong>⚠️ Connection Failed:</strong> {spotifyError}
                  <button
                    onClick={() => setSpotifyError(null)}
                    style={{
                      marginLeft: '1rem',
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      opacity: 0.7
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
              <button onClick={loginWithSpotify} className="btn-spotify">
                <LogIn size={24} /> Connect with Spotify
              </button>
              <div style={{ marginTop: '2rem' }}>
                <p style={{ fontSize: '0.875rem', opacity: 0.5, marginBottom: '1rem' }}>
                  Or quick start with:
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', maxWidth: '500px' }}>
                  {INSTRUMENTS_LIST.slice(0, 4).map(inst => (
                    <button key={inst.id} onClick={() => {
                      setSoulAnalysis({ instrument: inst.id, topGenres: [], topArtists: [], topTracks: [], valence: 0.5, energy: 0.5 });
                    }} className="instrument-card" style={{ padding: '1rem', textAlign: 'center' }}>
                      <inst.icon size={24} style={{ margin: '0 auto 0.5rem', color: inst.color }} />
                      <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>{inst.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column', position: 'relative' }}>
      {/* Mobile-aware flex direction: column on small, row on md+ (handled by media query in CSS naturally or inline styles) */}
      <div style={{ display: 'flex', flex: 1, flexDirection: window.innerWidth > 768 ? 'row' : 'column', position: 'relative' }}>

        {/* FORCE AUDIO OVERLAY */}
        {!audioContextRunning && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.9)', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <button onClick={forceAudioStart} className="btn-primary" style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Volume2 size={32} /> TAP TO UNMUTE
            </button>
          </div>
        )}

        {/* DIAGNOSTICS TOGGLE */}
        <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 60 }}>
          <button onClick={() => setShowDiagnostics(!showDiagnostics)} style={{
            background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', padding: '0.5rem', color: 'white'
          }}>
            <Settings size={20} />
          </button>
        </div>

        {/* DIAGNOSTICS PANEL */}
        {showDiagnostics && (
          <div className="glass-panel" style={{
            position: 'fixed', top: '4rem', right: '1rem', zIndex: 60,
            padding: '1rem', fontSize: '0.75rem', fontFamily: 'monospace',
            color: '#ef4444', border: '1px solid currentColor', width: '250px'
          }}>
            <h4 style={{ fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>DIAGNOSTICS</h4>
            <div>Context: <span style={{ color: audioContextRunning ? '#22c55e' : '#ef4444' }}>{audioContextRunning ? 'RUNNING' : 'SUSPENDED'}</span></div>
            <div>Transport: <span style={{ color: transportState === 'started' ? '#22c55e' : '#eab308' }}>{transportState}</span></div>
            <div>Genre: {activeGenre}</div>
            <div>Participants: {others.length + 1}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <button onClick={testBeep} style={{ padding: '0.5rem', background: 'white', color: 'black', borderRadius: '4px', fontWeight: 'bold' }}>
                🔊 TEST BEEP
              </button>
              <button onClick={() => { Tone.Transport.stop(); Tone.Transport.start(); }} style={{ padding: '0.5rem', background: '#2563eb', color: 'white', borderRadius: '4px' }}>
                🔄 RESTART
              </button>
              <button onClick={() => window.location.reload()} style={{ padding: '0.5rem', background: '#7f1d1d', color: 'white', borderRadius: '4px' }}>
                ⚠️ RELOAD
              </button>
            </div>
          </div>
        )}

        {/* SIDEBAR - SOUL RADAR */}
        <div className="glass-panel" style={{
          margin: '1rem', padding: '1.5rem',
          width: window.innerWidth > 768 ? '320px' : 'calc(100% - 2rem)',
          display: 'flex', flexDirection: 'column', zIndex: 50
        }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Radio className="text-secondary pulse-glow" size={24} />
            <span className="gradient-text">Soul Radar</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', maxHeight: '60vh' }}>
            {/* My Instrument */}
            <div style={{
              padding: '1rem', background: 'rgba(255,255,255,0.05)',
              borderRadius: '12px', border: '1px solid rgba(34, 197, 94, 0.3)',
              display: 'flex', alignItems: 'center', gap: '1rem'
            }}>
              <div style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }}>
                <Music size={16} color="#60a5fa" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 600 }}>You ({myInstrument?.name})</span>
                <span style={{ fontSize: '0.75rem', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', background: 'currentColor', borderRadius: '50%' }}></span> Live
                </span>
              </div>
            </div>

            {/* Others */}
            {others.map(u => (
              <div key={u.id} style={{
                padding: '1rem', background: 'rgba(255,255,255,0.02)',
                borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem'
              }}>
                <div style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }}>
                  <Music size={16} color={u.color} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{INSTRUMENTS_LIST.find(i => i.id === u.instrument)?.name}</span>
                </div>
              </div>
            ))}

            {others.length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5, fontSize: '0.9rem', fontStyle: 'italic' }}>
                Waiting for other souls...
              </div>
            )}
          </div>
        </div>

        {/* MAIN RADAR VISUALIZATION */}
        <div className="glass-panel" style={{
          flex: 1, margin: '1rem', position: 'relative', overflow: 'hidden',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          {/* Background Grid */}
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.1, pointerEvents: 'none',
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }}></div>

          <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', marginBottom: '3rem' }}>
            <h2 className="gradient-text pulse-glow" style={{
              fontSize: 'clamp(2rem, 5vw, 4rem)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em'
            }}>
              {activeGenre}
            </h2>
            <div style={{ fontSize: '1.1rem', opacity: 0.7, marginTop: '1rem' }}>
              Ensemble Size: {others.length + 1}
            </div>
          </div>

          <div style={{
            position: 'relative', width: '300px', height: '300px',
            border: '2px dashed rgba(255,255,255,0.1)', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <div className="radar-ping" style={{
              position: 'absolute', inset: 0, border: '1px solid var(--primary)', borderRadius: '50%'
            }}></div>

            {/* My Centered Icon */}
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 20, boxShadow: '0 0 30px rgba(99,102,241,0.3)'
            }}>
              {myInstrument && <myInstrument.icon size={40} color={myInstrument.color} />}
            </div>

            {/* Orbiting Users */}
            {others.map((u, i) => {
              const angle = (i / others.length) * 2 * Math.PI;
              const r = 120; // Radius
              const x = Math.cos(angle) * r;
              const y = Math.sin(angle) * r;

              return (
                <div key={u.id} style={{
                  position: 'absolute',
                  width: '48px', height: '48px',
                  background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transform: `translate(${x}px, ${y}px)`,
                  transition: 'transform 1s ease-in-out'
                }}>
                  <Music size={20} color={u.color} />
                </div>
              );
            })}
          </div>

          {/* On-Screen Log (Minimally intrusive) */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, width: '100%',
            padding: '1rem', background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
            fontSize: '0.75rem', fontFamily: 'monospace', height: '100px',
            overflowY: 'auto', pointerEvents: 'none', opacity: 0.6
          }}>
            {debugLog.map((l, i) => (
              <div key={i} style={{ marginBottom: '2px' }}>
                <span style={{ color: '#4ade80', marginRight: '8px' }}>➜</span>
                {l.replace('ℹ️', '').replace('❌', '')}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
