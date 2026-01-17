// Spotify API Configuration
const CLIENT_ID = 'f6cb72bb936e49e39171ab6e1c6696ba';
const REDIRECT_URI = window.location.origin + '/callback';
const SCOPES = [
    'user-top-read',
    'user-read-recently-played',
    'user-library-read'
].join(' ');

// Generate random string for state parameter
const generateRandomString = (length) => {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () => possible.charAt(Math.floor(Math.random() * possible.length))).join('');
};

// PKCE Code Verifier and Challenge
const generateCodeVerifier = () => generateRandomString(128);

const generateCodeChallenge = async (verifier) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
};

// Redirect to Spotify Login
export const loginWithSpotify = async () => {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateRandomString(16);

    // Store verifier for later use
    localStorage.setItem('spotify_code_verifier', codeVerifier);
    localStorage.setItem('spotify_auth_state', state);

    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        scope: SCOPES,
        state: state,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge
    });

    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
};

// Handle OAuth Callback
export const handleCallback = async () => {
    console.log('🔐 Spotify Callback: Starting token exchange...');

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const storedState = localStorage.getItem('spotify_auth_state');
    const codeVerifier = localStorage.getItem('spotify_code_verifier');

    console.log('📋 Callback params:', {
        hasCode: !!code,
        hasState: !!state,
        stateMatch: state === storedState,
        hasVerifier: !!codeVerifier
    });

    if (!code) {
        console.error('❌ No authorization code in callback');
        throw new Error('No authorization code received');
    }

    if (state !== storedState) {
        console.error('❌ State mismatch:', { received: state, stored: storedState });
        throw new Error('Invalid state parameter - possible CSRF attack');
    }

    if (!codeVerifier) {
        console.error('❌ No code verifier found in localStorage');
        throw new Error('Missing code verifier');
    }

    // Exchange code for token
    console.log('🔄 Exchanging code for access token...');
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: CLIENT_ID,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
            code_verifier: codeVerifier
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Token exchange failed:', response.status, errorData);
        throw new Error(`Token exchange failed: ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Token received successfully');

    localStorage.setItem('spotify_access_token', data.access_token);
    localStorage.setItem('spotify_refresh_token', data.refresh_token);
    localStorage.setItem('spotify_token_expiry', Date.now() + data.expires_in * 1000);

    // Clean up URL
    window.history.replaceState({}, document.title, '/');

    return data.access_token;
};

// Get Access Token (with refresh if needed)
export const getAccessToken = async () => {
    const token = localStorage.getItem('spotify_access_token');
    const expiry = localStorage.getItem('spotify_token_expiry');

    if (token && expiry && Date.now() < parseInt(expiry)) {
        return token;
    }

    // Token expired, need to refresh
    const refreshToken = localStorage.getItem('spotify_refresh_token');
    if (!refreshToken) return null;

    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: CLIENT_ID,
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        })
    });

    if (!response.ok) {
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_refresh_token');
        return null;
    }

    const data = await response.json();
    localStorage.setItem('spotify_access_token', data.access_token);
    localStorage.setItem('spotify_token_expiry', Date.now() + data.expires_in * 1000);

    return data.access_token;
};

// Fetch User's Top Artists
export const getTopArtists = async () => {
    const token = await getAccessToken();
    if (!token) return null;

    const response = await fetch('https://api.spotify.com/v1/me/top/artists?limit=20&time_range=medium_term', {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.items;
};

// Fetch User's Top Tracks
export const getTopTracks = async () => {
    const token = await getAccessToken();
    if (!token) return null;

    const response = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=medium_term', {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.items;
};

// Analyze Music Taste and Determine Soul Instrument
export const analyzeSoulInstrument = async () => {
    const artists = await getTopArtists();
    const tracks = await getTopTracks();

    if (!artists || !tracks) return null;

    // 2. Fetch Audio Features for these tracks (Valence & Energy)
    const trackIds = tracks.map(t => t.id).join(',');
    const featuresResponse = await fetch(`https://api.spotify.com/v1/audio-features?ids=${trackIds}`, {
        headers: { 'Authorization': `Bearer ${await getAccessToken()}` }
    });
    const featuresData = await featuresResponse.json();
    const features = featuresData.audio_features;

    // Calculate averages
    let totalValence = 0;
    let totalEnergy = 0;
    let validTracks = 0;

    features.forEach(f => {
        if (f && f.valence !== undefined && f.energy !== undefined) {
            totalValence += f.valence;
            totalEnergy += f.energy;
            validTracks++;
        }
    });

    const avgValence = validTracks > 0 ? totalValence / validTracks : 0.5;
    const avgEnergy = validTracks > 0 ? totalEnergy / validTracks : 0.5;

    console.log(`Music Profile: Valence=${avgValence.toFixed(2)} (${avgValence > 0.5 ? 'Happy' : 'Sad'}), Energy=${avgEnergy.toFixed(2)} (${avgEnergy > 0.6 ? 'High' : 'Low'})`);

    // Collect all genres
    const genreCounts = {};
    artists.forEach(artist => {
        artist.genres.forEach(genre => {
            genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        });
    });

    // Sort genres by frequency
    const sortedGenres = Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([genre]) => genre);

    console.log('Top genres:', sortedGenres.slice(0, 10));

    // Genre to Instrument Mapping
    const instrumentMapping = {
        // Classical / Orchestral
        classical: 'violin',
        opera: 'cello',
        orchestra: 'cello',
        baroque: 'violin',

        // Turkish / Anatolian
        turkish: 'baglama',
        anatolian: 'baglama',
        'turkish folk': 'baglama',
        arabesque: 'baglama',

        // Rock / Metal
        rock: 'electric_guitar',
        metal: 'electric_guitar',
        'hard rock': 'electric_guitar',
        'alternative rock': 'electric_guitar',
        punk: 'electric_guitar',
        grunge: 'electric_guitar',

        // Jazz / Blues
        jazz: 'bass',
        blues: 'bass',
        soul: 'bass',
        funk: 'bass',

        // Folk / Acoustic
        folk: 'classical_guitar',
        acoustic: 'classical_guitar',
        'singer-songwriter': 'classical_guitar',
        indie: 'classical_guitar',
        'indie folk': 'classical_guitar',

        // Pop / Electronic (neutral - defaults to drums)
        pop: 'jazz_drums',
        dance: 'jazz_drums',
        electronic: 'jazz_drums',
        edm: 'jazz_drums',

        // Latin / Flamenco
        flamenco: 'classical_guitar',
        latin: 'classical_guitar',
        bossa: 'classical_guitar',

        // World
        world: 'baglama',
        ethnic: 'baglama'
    };

    // Find matching instrument
    let soulInstrument = 'classical_guitar'; // Default

    for (const genre of sortedGenres) {
        const lowerGenre = genre.toLowerCase();

        // Check for partial matches
        for (const [key, instrument] of Object.entries(instrumentMapping)) {
            if (lowerGenre.includes(key) || key.includes(lowerGenre)) {
                soulInstrument = instrument;
                console.log(`Matched genre "${genre}" to instrument "${instrument}"`);
                break;
            }
        }

        if (soulInstrument !== 'classical_guitar') break;
    }

    return {
        instrument: soulInstrument,
        valence: avgValence,
        energy: avgEnergy,
        topGenres: sortedGenres.slice(0, 5),
        topArtists: artists.slice(0, 5).map(a => a.name),
        topTracks: tracks.slice(0, 5).map(t => t.name)
    };
};

// Check if user is logged in
export const isLoggedIn = () => {
    return !!localStorage.getItem('spotify_access_token');
};

// Logout
export const logout = () => {
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_refresh_token');
    localStorage.removeItem('spotify_token_expiry');
    localStorage.removeItem('spotify_code_verifier');
    localStorage.removeItem('spotify_auth_state');
};
