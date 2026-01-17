import * as Tone from 'tone';
import { Scale, Chord, Key } from "@tonaljs/tonal";

// --- ENSEMBLE DIRECTOR THEORY (Powered by Tonal.js & HookTheory) ---
const THEORY = {
    // HookTheory: Probabilistic Chord Progressions (Markov Chain)
    HOOK_THEORY_GRAPH: {
        "I": { "V": 0.3, "vi": 0.25, "IV": 0.3, "iii": 0.1, "ii": 0.05 },
        "ii": { "V": 0.8, "vi": 0.2 }, // ii -> V (Jazz standard)
        "iii": { "vi": 0.7, "IV": 0.3 },
        "IV": { "I": 0.4, "V": 0.4, "ii": 0.2 },
        "V": { "I": 0.7, "vi": 0.2, "IV": 0.1 }, // V -> I (Perfect Cadence)
        "vi": { "IV": 0.5, "V": 0.3, "iii": 0.2 }
    }
};

const SAMPLES = {
    classical_guitar: { urls: { "A3": "A3.mp3", "A4": "A4.mp3", "E3": "E3.mp3", "E4": "E4.mp3" }, baseUrl: "https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/samples/guitar-acoustic/" },
    electric_guitar: { urls: { "A3": "A3.mp3", "E4": "E4.mp3" }, baseUrl: "https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/samples/guitar-electric/" },
    bass: { urls: { "A2": "A2.mp3", "E2": "E2.mp3" }, baseUrl: "https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/samples/bass-electric/" },
    violin: { urls: { "A4": "A4.mp3", "E4": "E4.mp3" }, baseUrl: "https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/samples/violin/" },
    cello: { urls: { "A3": "A3.mp3", "C3": "C3.mp3" }, baseUrl: "https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/samples/cello/" }
};

class AudioEngine {
    constructor() {
        this.synths = {};
        this.loops = [];
        this.isPlaying = false;
        this.activeParticipants = []; // Stores { id, instrument, role }
        this.loading = true;

        // MUSIC PROFILE (from Spotify)
        this.musicProfile = {
            valence: 0.5, // 0-1: Sad to Happy
            energy: 0.5,  // 0-1: Calm to Energetic
            key: "C",     // Root Key
            mode: "major" // major/minor
        };

        // ORCHESTRA STATE
        this.director = {
            vibe: 'MEDITERRANEAN',
            currentStep: null,
            scale: [],
            notes: [],
            currentChord: 'I' // HookTheory state
        };

        // AI COMPOSER
        this.ai = {
            rnn: null,
            ready: false
        };
    }

    async init() {
        await Tone.start();
        if (Tone.context.state !== 'running') await Tone.context.resume();
        console.log('🎵 Audio Engine 7.0 (Tonal.js + AI) Starting...');

        // Initialize Magenta MusicRNN (Melody)
        try {
            if (window.mm) {
                // Pre-trained model for melody
                this.ai.rnn = new window.mm.MusicRNN('https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/melody_rnn');
                await this.ai.rnn.initialize();
                this.ai.ready = true;
                console.log('🤖 Google Magenta AI Ready!');
            } else {
                console.warn('⚠️ Magenta.js not found, falling back to algorithmic composition.');
            }
        } catch (e) {
            console.error('❌ AI Load Failed:', e);
        }

        const master = new Tone.Limiter(-0.5).toDestination();
        const reverb = new Tone.Reverb({ decay: 4, wet: 0.3 }).connect(master);

        // INSTANTIATION
        const mkSampler = (conf) => new Tone.Sampler({ urls: conf.urls, baseUrl: conf.baseUrl, onerror: () => console.warn('Sample fail') }).connect(reverb);

        this.synths.classical_guitar = mkSampler(SAMPLES.classical_guitar);
        this.synths.electric_guitar = mkSampler(SAMPLES.electric_guitar).connect(new Tone.Distortion(0.4));
        this.synths.bass = mkSampler(SAMPLES.bass).connect(master);
        this.synths.violin = mkSampler(SAMPLES.violin).connect(new Tone.Vibrato(5, 0.2));
        this.synths.cello = mkSampler(SAMPLES.cello).connect(new Tone.Vibrato(4, 0.2));

        // Synth Fallbacks
        this.synths.baglama = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sawtooth" }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.1 } }).connect(new Tone.PingPongDelay("8n", 0.3).connect(reverb));
        this.synths.kick = new Tone.MembraneSynth().connect(master);
        this.synths.snare = new Tone.NoiseSynth().connect(reverb);

        this.loading = false;
        Tone.Transport.bpm.value = 100;
        console.log('✅ Ensemble Ready');
    }

    stop() {
        Tone.Transport.stop();
        Tone.Transport.cancel();
        this.loops.forEach(l => l.stop());
        this.loops = [];
        this.isPlaying = false;
    }

    // --- SMART ROLE ASSIGNMENT ---
    assignRoles(instrumentList) {
        // Smart Role Assignment Logic
        const roles = [];
        const counts = {};

        instrumentList.forEach((inst, index) => {
            counts[inst] = (counts[inst] || 0) + 1;
            let role = 'SOLO'; // Default

            // Rule 1: Twin Guitars
            if (inst === 'classical_guitar') {
                if (counts[inst] === 1) role = 'RHYTHM'; // First guitar anchors
                else role = 'LEAD'; // Second guitar solos
            }

            // Rule 2: Bass always Support
            if (inst === 'bass') role = 'SUPPORT';

            // Rule 3: Percussion always Rhythm
            if (inst === 'jazz_drums') role = 'PERCUSSION';

            roles.push({ id: index, type: inst, role: role });
        });
        return roles;
    }

    determineVibe(roles) {
        const types = roles.map(r => r.type);
        const has = (t) => types.includes(t);

        // Dynamic BPM based on instruments
        if (has('baglama')) return { name: 'MEDITERRANEAN', bpm: 95 };
        if (has('electric_guitar')) return { name: 'ROCK', bpm: 130 };
        if (has('jazz_drums')) return { name: 'JAZZ', bpm: 120 };
        return { name: 'FOLK', bpm: 100 }; // Default to Mediterranean/Folk
    }

    async updateSession(activeInstrumentTypes) {
        if (this.loading) return;
        this.activeParticipants = this.assignRoles(activeInstrumentTypes.map(i => i.type));

        if (this.activeParticipants.length === 0) { this.stop(); return; }

        const vibe = this.determineVibe(this.activeParticipants);
        if (this.director.vibe !== vibe.name) {
            this.director.vibe = vibe.name;
            Tone.Transport.bpm.rampTo(vibe.bpm, 1.5);
        }

        if (!this.isPlaying) {
            this.startOrchestra();
        }
    }

    startOrchestra() {
        Tone.Transport.cancel();

        // 1. CONDUCTOR LOOP (Harmony & AI)
        const conductor = new Tone.Loop(async (time) => { // Async loop for AI
            // A. Smart Chord Progression (HookTheory)
            const nextChordRoman = this.generateNextChord();

            // B. Tonal.js Harmony Engine
            // Calculate actual notes from Roman Numeral + Dynamic Scale
            const chordNotes = this.getRomanChordNotes(nextChordRoman);

            this.director.notes = chordNotes; // Current active chord tones
            this.director.scale = this.getEmotionalScale(); // Current active scale for soloists

            // C. AI Melody Prefetch
            if (this.ai.ready && Math.random() < this.musicProfile.energy) {
                const aiNotes = await this.generateAIMelody(chordNotes);
                this.director.aiMelodyBuffer = aiNotes;
            } else {
                this.director.aiMelodyBuffer = [];
            }
        }, "1m").start(0);
        this.loops.push(conductor);

        // 2. RHYTHM LOOP (Euclidean Patterns)
        const rhythmLoop = new Tone.Loop((time) => {
            this.activeParticipants.forEach(p => {
                if (p.role === 'RHYTHM') {
                    // Dynamic Strumming based on Energy
                    const subdiv = this.musicProfile.energy > 0.6 ? "8n" : "4n";
                    this.strum(p.type, this.director.notes, subdiv, time, 0.6);
                }
                if (p.role === 'SUPPORT' && p.type === 'bass') {
                    // Root note on 1, Fifth on 3
                    const root = Tone.Frequency(this.director.notes[0]).transpose(-12).toNote();
                    this.play(p.type, root, "4n", time, 0.8);
                    if (this.musicProfile.energy > 0.5) {
                        const fifth = Tone.Frequency(this.director.notes[2]).transpose(-12).toNote();
                        this.play(p.type, fifth, "4n", time + Tone.Time("2n").toSeconds(), 0.7);
                    }
                }
                if (p.role === 'PERCUSSION') {
                    // Euclidean Kick: 4 hits in 16 steps (House) or random
                    this.synths.kick.triggerAttackRelease("C1", "8n", time);
                    if (this.musicProfile.energy > 0.8) {
                        this.synths.kick.triggerAttackRelease("C1", "8n", time + Tone.Time("4n").toSeconds());
                    }
                }
            });
        }, "1m").start(0);
        this.loops.push(rhythmLoop);

        // 3. LEAD LOOP (Melody)
        const leadLoop = new Tone.Loop((time) => {
            this.activeParticipants.forEach((p, index) => {
                if (p.role === 'LEAD' || p.role === 'SOLO') {
                    const aiBuffer = this.director.aiMelodyBuffer || [];

                    if (aiBuffer.length > 0 && index < aiBuffer.length) {
                        // AI Melody
                        const note = aiBuffer[index % aiBuffer.length];
                        this.play(p.type, note, "8n", time + (index * 0.25), 0.8);
                    } else {
                        // Tonal.js Smart Improvisation
                        // Pick random note from CURRENT SCALE (guaranteed to sound good)
                        if (Math.random() < this.musicProfile.energy) {
                            const scale = this.director.scale;
                            // Ensure scale exists, fallback to Pentatonic
                            const safeScale = scale && scale.length > 0 ? scale : ["C4", "D4", "E4", "G4", "A4"];
                            const note = safeScale[Math.floor(Math.random() * safeScale.length)];
                            this.play(p.type, note, "8n", time + (Math.random() * 0.5), 0.7);
                        }
                    }
                }
            });
        }, "1m").start(0);
        this.loops.push(leadLoop);

        this.isPlaying = true;
    }

    // --- HELPER METHODS ---

    play(inst, note, duration, time, gain = 1) {
        if (!this.synths[inst]) return;
        try { this.synths[inst].triggerAttackRelease(note, duration, time, gain); } catch (e) { }
    }

    strum(inst, notes, duration, time, gain = 1, spread = 0.05) {
        if (!this.synths[inst]) return;
        notes.forEach((note, i) => {
            try { this.synths[inst].triggerAttackRelease(note, duration, time + i * spread, gain); } catch (e) { }
        });
    }

    // Set music profile from Spotify analysis
    setMusicProfile(valence, energy) {
        this.musicProfile.valence = valence;
        this.musicProfile.energy = energy;

        // Convert Valence to Theory Mode (Tonal.js)
        // High Valence (>0.6) = Major / Lydian
        // Low Valence (<0.4) = Minor / Phrygian
        if (valence > 0.6) {
            this.musicProfile.mode = "major";
            this.musicProfile.key = "C"; // Happy C Major
        } else if (valence < 0.4) {
            this.musicProfile.mode = "harmonic minor";
            this.musicProfile.key = "A"; // Sad A Minor
        } else {
            this.musicProfile.mode = "dorian"; // Jazzy/Neutral
            this.musicProfile.key = "D";
        }
        console.log(`🎭 Theory Updated: Key=${this.musicProfile.key} ${this.musicProfile.mode}`);
    }

    // --- TONAL.JS & HOOKTHEORY LOGIC ---

    getEmotionalScale() {
        // Use Tonal.js to get exact notes of the scale
        // Example: Scale.get("c harmonic minor").notes => ["C", "D", "Eb", "F", "G", "Ab", "B"]
        const scaleName = `${this.musicProfile.key} ${this.musicProfile.mode}`;
        // Map notes to 4th octave for melody
        return Scale.get(scaleName).notes.map(n => n + "4");
    }

    generateNextChord() {
        const current = this.director.currentChord || 'I';
        const transitions = THEORY.HOOK_THEORY_GRAPH[current];
        if (!transitions) return 'I'; // Fallback to tonic

        // Weighted random selection
        const rand = Math.random();
        let cumulative = 0;
        for (const [chord, prob] of Object.entries(transitions)) {
            cumulative += prob;
            if (rand < cumulative) {
                this.director.currentChord = chord;
                return chord;
            }
        }
        return 'I';
    }

    getRomanChordNotes(roman) {
        // Tonal.js can handle Roman Numerals! via Key.majorKey or progression logic
        // But for simplicity, we map Roman to Scale Degrees
        const scaleNotes = this.getEmotionalScale(); // e.g. ["C4", "D4", "E4"...]
        const degrees = { 'I': 0, 'ii': 1, 'iii': 2, 'IV': 3, 'V': 4, 'vi': 5, 'VII': 6, 'i': 0 };

        const degreeIndex = degrees[roman] || 0;

        // Build triad (1-3-5) from Scale
        // This guarantees "In-Key" chords without detuning
        const note1 = scaleNotes[degreeIndex % scaleNotes.length];
        const note2 = scaleNotes[(degreeIndex + 2) % scaleNotes.length];
        const note3 = scaleNotes[(degreeIndex + 4) % scaleNotes.length];

        return [note1, note2, note3];
    }

    // --- MAGENTA AI MELODY ---
    async generateAIMelody(chordNotes) {
        if (!this.ai.ready) return chordNotes; // Fallback

        // Seed sequence from current chord
        const notes = chordNotes.map(n => ({
            pitch: Tone.Frequency(n).toMidi(),
            quantizedStartStep: 0,
            quantizedEndStep: 4
        }));

        const seq = { notes, totalQuantizedSteps: 4, quantizationInfo: { stepsPerQuarter: 4 } };

        try {
            // Ask AI for continuation
            const result = await this.ai.rnn.continueSequence(seq, 20, 1.2); // 20 steps, 1.2 temp
            return result.notes.map(n => Tone.Frequency(n.pitch, "midi").toNote());
        } catch (e) {
            console.warn('AI Gen Failed', e);
            return chordNotes;
        }
    }
}

export const audioEngine = new AudioEngine();
