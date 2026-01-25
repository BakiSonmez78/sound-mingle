import React, { useState, useEffect } from 'react';
import { Users, Music } from 'lucide-react';
import * as Tone from 'tone';
import { io } from 'socket.io-client';
import { stemSeparator } from './audio/stemSeparator';
import { loginWithSpotify, handleCallback, isLoggedIn, getRecentlyPlayed } from './spotify';

const STEM_TYPES = [
  { id: 'bass', name: 'Bass', color: '#ef4444', icon: '🎸' },
  { id: 'drums', name: 'Drums', color: '#10b981', icon: '🥁' },
  { id: 'vocals', name: 'Vocals', color: '#ec4899', icon: '🎤' },
  { id: 'other', name: 'Other', color: '#3b82f6', icon: '🎹' }
];

const socket = io('/', { autoConnect: false });

function App() {
  const [loading, setLoading] = useState(false);
  const [myStem, setMyStem] = useState(null);
  const [trackInfo, setTrackInfo] = useState(null);
  const [others, setOthers] = useState([]);
  const [error, setError] = useState(null);

  // Spotify Callback Handler
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      setLoading(true);

      handleCallback()
        .then(async () => {
          // Get recently played track
          const recentTrack = await getRecentlyPlayed();

          if (recentTrack && recentTrack.previewUrl) {
            setTrackInfo(recentTrack);

            // Load audio
            await stemSeparator.loadAudio(recentTrack.previewUrl);

            // Auto-assign stem (bass for first user)
            const assignedStem = STEM_TYPES[0];
            setMyStem(assignedStem.id);

            // Start audio context
            await Tone.start();

            // Start playing after short delay
            setTimeout(() => {
              stemSeparator.playStem(assignedStem.id);
              console.log('🎵 Playing:', recentTrack.name, '-', assignedStem.name);
            }, 500);

            // Connect to socket
            socket.connect();
            socket.emit('join', { stem: assignedStem.id, track: recentTrack.name });
          } else {
            setError('No recent track found. Please play a song on Spotify first!');
          }

          setLoading(false);
          window.history.replaceState({}, document.title, '/');
        })
        .catch(err => {
          setError(err.message || 'Failed to connect to Spotify');
          setLoading(false);
          window.history.replaceState({}, document.title, '/');
        });
    }
  }, []);

  // Socket listeners
  useEffect(() => {
    socket.on('state_update', (users) => {
      const myId = socket.id;
      setOthers(users.filter(u => u.id !== myId));
    });

    return () => socket.off('state_update');
  }, []);

  // Not logged in - show login
  if (!isLoggedIn() && !loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '2rem'
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(10px)',
          borderRadius: '24px',
          padding: '3rem',
          textAlign: 'center',
          maxWidth: '400px',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          <h1 style={{
            fontSize: '3rem',
            fontWeight: 900,
            marginBottom: '1rem',
            background: 'linear-gradient(135deg, #fff, #f0f0f0)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            SoundMingle
          </h1>
          <p style={{
            fontSize: '1.1rem',
            opacity: 0.9,
            marginBottom: '2rem',
            color: '#fff'
          }}>
            Play music together, one stem at a time
          </p>

          {error && (
            <div style={{
              padding: '1rem',
              background: 'rgba(239, 68, 68, 0.2)',
              borderRadius: '12px',
              marginBottom: '1.5rem',
              color: '#fff'
            }}>
              {error}
            </div>
          )}

          <button
            onClick={loginWithSpotify}
            style={{
              width: '100%',
              padding: '1rem 2rem',
              fontSize: '1.1rem',
              fontWeight: 600,
              background: '#1DB954',
              color: '#fff',
              border: 'none',
              borderRadius: '50px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              transition: 'transform 0.2s',
            }}
            onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
          >
            <Music size={24} />
            Connect Spotify
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '4px solid rgba(255,255,255,0.3)',
            borderTop: '4px solid #fff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1.5rem'
          }}></div>
          <p style={{ fontSize: '1.2rem' }}>Loading your music...</p>
        </div>
      </div>
    );
  }

  // Main app - playing music
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '2rem'
    }}>
      <div style={{
        maxWidth: '600px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '2rem',
          color: '#fff'
        }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 900,
            marginBottom: '0.5rem'
          }}>
            SoundMingle
          </h1>
          <p style={{ opacity: 0.9 }}>
            Playing together
          </p>
        </div>

        {/* Now Playing */}
        {trackInfo && (
          <div style={{
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(10px)',
            borderRadius: '20px',
            padding: '2rem',
            marginBottom: '1.5rem',
            border: '1px solid rgba(255,255,255,0.2)',
            textAlign: 'center'
          }}>
            {trackInfo.albumArt && (
              <img
                src={trackInfo.albumArt}
                alt="Album"
                style={{
                  width: '150px',
                  height: '150px',
                  borderRadius: '12px',
                  marginBottom: '1rem',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
                }}
              />
            )}
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              marginBottom: '0.5rem',
              color: '#fff'
            }}>
              {trackInfo.name}
            </h2>
            <p style={{
              fontSize: '1.1rem',
              opacity: 0.8,
              color: '#fff'
            }}>
              {trackInfo.artist}
            </p>
          </div>
        )}

        {/* My Stem */}
        {myStem && (
          <div style={{
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(10px)',
            borderRadius: '20px',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <div style={{
                fontSize: '3rem'
              }}>
                {STEM_TYPES.find(s => s.id === myStem)?.icon}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{
                  fontSize: '0.9rem',
                  opacity: 0.7,
                  marginBottom: '0.25rem',
                  color: '#fff'
                }}>
                  You're playing
                </p>
                <h3 style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: STEM_TYPES.find(s => s.id === myStem)?.color
                }}>
                  {STEM_TYPES.find(s => s.id === myStem)?.name}
                </h3>
              </div>
              <div style={{
                width: '12px',
                height: '12px',
                background: '#10b981',
                borderRadius: '50%',
                animation: 'pulse 2s infinite'
              }}></div>
            </div>
          </div>
        )}

        {/* Other Players */}
        {others.length > 0 && (
          <div style={{
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(10px)',
            borderRadius: '20px',
            padding: '1.5rem',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem',
              color: '#fff'
            }}>
              <Users size={20} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                Other Players ({others.length})
              </h3>
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              {others.map(user => (
                <div
                  key={user.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '0.75rem',
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '12px'
                  }}
                >
                  <div style={{ fontSize: '1.5rem' }}>
                    {STEM_TYPES.find(s => s.id === user.stem)?.icon || '🎵'}
                  </div>
                  <div style={{ flex: 1, color: '#fff' }}>
                    <p style={{
                      fontWeight: 600,
                      color: STEM_TYPES.find(s => s.id === user.stem)?.color || '#fff'
                    }}>
                      {STEM_TYPES.find(s => s.id === user.stem)?.name || 'Unknown'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {others.length === 0 && myStem && (
          <div style={{
            textAlign: 'center',
            padding: '2rem',
            color: '#fff',
            opacity: 0.7
          }}>
            <Users size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p>Waiting for others to join...</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default App;
