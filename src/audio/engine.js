import * as Tone from 'tone';

// --- ENSEMBLE DIRECTOR THEORY (Enhanced with HookTheory & AI) ---
const THEORY = {
    SCALES: {
        "PHRYGIAN_DOMINANT": ["A3", "Bb3", "C#4", "D4", "E4", "F4", "G4", "A4"],
        "HARMONIC_MINOR": ["A3", "B3", "C4", "D4", "E4", "F4", "G#4", "A4"],
        "BLUES_HEX": ["E3", "G3", "A3", "Bb3", "B3", "D4", "E4"],
        "IONIAN": ["C3", "D3", "E3", "F3", "G3", "A3", "B3", "C4"],
        "DORIAN": ["D3", "E3", "F3", "G3", "A3", "B3", "C4", "D4"] // Jazzy
    },
    // HookTheory: Probabilistic Chord Progressions (Markov Chain)
    // Structure: Current Chord -> { Next Chord: Probability }
    HOOK_THEORY_GRAPH: {
        "I": { "V": 0.3, "vi": 0.25, "IV": 0.3, "iii": 0.1, "ii": 0.05 },
        "ii": { "V": 0.8, "vi": 0.2 }, // ii -> V (Jazz standard)
        "iii": { "vi": 0.7, "IV": 0.3 },
        "IV": { "I": 0.4, "V": 0.4, "ii": 0.2 },
        "V": { "I": 0.7, "vi": 0.2, "IV": 0.1 }, // V -> I (Perfect Cadence)
        "vi": { "IV": 0.5, "V": 0.3, "iii": 0.2 }
    },
    // Progressions mapped to Roman Numerals
    PROGRESSIONS: {
        "MEDITERRANEAN": ["i", "VII", "VI", "V"], // i-VII-VI-V (Andalusian)
        "POP_HIT": ["I", "V", "vi", "IV"], // The "Axis of Awesome"
        "JAZZ_II_V_I": ["ii", "V", "I"],
        "EMOTIONAL": ["vi", "IV", "I", "V"]
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
            energy: 0.5   // 0-1: Calm to Energetic
        };

        // ORCHESTRA STATE
        this.director = {
            vibe: 'MEDITERRANEAN',
            currentStep: null,
            scale: [],
            notes: [],
            progressionIndex: 0,
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
        console.log('🎵 Audio Engine 6.0 (AI Composer) Starting...');

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
            console.error('❌ Failed to load AI:', e);
        }

        const master = new Tone.Limiter(-0.5).toDestination();
        const reverb = new Tone.Reverb({ decay: 4, wet: 0.3 }).connect(master);

        const load = (config) => new Promise(resolve => new Tone.Sampler({
            urls: config.urls, baseUrl: config.baseUrl,
            onload: () => resolve(true), onerror: () => resolve(false)
        }).toDestination()); // Dummy load to cache, real instantiation below

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
        this.synths.ch = new Tone.MetalSynth().connect(reverb); this.synths.ch.volume.value = -18;
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
        // instrumentList = ['classical_guitar', 'classical_guitar', 'bass']
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

        // HIERARCHY OF VIBE
        if (has('baglama')) return { name: 'MEDITERRANEAN', prog: THEORY.PROGRESSIONS.MEDITERRANEAN, bpm: 95 };
        if (has('electric_guitar')) return { name: 'ROCK', prog: THEORY.PROGRESSIONS.TWIN_GUITARS, bpm: 130 }; // Reuse minor prog for rock
        if (types.filter(t => t === 'classical_guitar').length >= 2) return { name: 'TWIN_GUITARS', prog: THEORY.PROGRESSIONS.TWIN_GUITARS, bpm: 110 };
        if (has('jazz_drums')) return { name: 'JAZZ', prog: THEORY.PROGRESSIONS.JAZZ_STANDARD, bpm: 120 };

        return { name: 'FOLK', prog: THEORY.PROGRESSIONS.MEDITERRANEAN, bpm: 100 }; // Default to Mediterranean/Folk
    }

    async updateSession(activeInstrumentTypes) {
        if (this.loading) return;
        this.activeParticipants = this.assignRoles(activeInstrumentTypes.map(i => i.type));

        if (this.activeParticipants.length === 0) { this.stop(); return; }

        const newVibe = this.determineVibe(this.activeParticipants);

        // State Update
        if (this.director.vibe !== newVibe.name) {
            console.log(`🎼 Director Command: Switch to ${newVibe.name} (${newVibe.bpm} BPM)`);
            this.director.vibe = newVibe.name;
            Tone.Transport.bpm.rampTo(newVibe.bpm, 1.5);
            // Reset progression to start clean
            this.director.progressionIndex = 0;
        }

        if (!this.isPlaying) {
            this.startOrchestra(newVibe.prog);
        }
    }

    startOrchestra(progressionSequence) {
        Tone.Transport.cancel();

        // 1. CONDUCTOR (Global Harmony State & AI)
        const conductor = new Tone.Loop(async (time) => { // Async loop for AI
            // Determine global vibe (BPM sets here)
            this.determineVibe(this.activeParticipants);

            // A. HookTheory: Smart Chord Selection
            const nextChordRoman = this.generateNextChord();
            const chordNotes = this.getRomanChordNotes(nextChordRoman);

            // Update Director State
            this.director.currentStep = { root: chordNotes[0], type: 'maj' }; // Simplified step obj
            this.director.notes = chordNotes;
            this.director.scale = this.getEmotionalScale(); // Dynamic scale based on valence

            // B. AI Melody Generation (Pre-fetch for next measure?)
            // For real-time, we'll just generate based on current chord immediately
            // Note: This might cause slight delay, but acceptable for demo
            if (this.ai.ready && Math.random() > 0.4) {
                const aiNotes = await this.generateAIMelody(chordNotes);
                this.director.aiMelodyBuffer = aiNotes;
            } else {
                this.director.aiMelodyBuffer = []; // Fallback to scale improvisation
            }

        }, "1m").start(0);
        this.loops.push(conductor);

        // 2. RHYTHM SECTION (Chords & Bass)
        const rhythmLoop = new Tone.Loop((time) => {
            this.activeParticipants.forEach(p => {
                // Guitar Rhythm (Strum)
                if (p.role === 'RHYTHM' && p.type === 'classical_guitar') {
                    // Strum on 1 and 3 (Quarter notes)
                    this.strum(p.type, this.director.notes, "4n", time, 0.7);
                    // Light strum on offbeat?
                    if (this.musicProfile.energy > 0.6) {
                        this.strum(p.type, this.director.notes, "8n", time + Tone.Time("4n").toSeconds(), 0.5);
                    }
                }

                // Bass Support
                if (p.role === 'SUPPORT' && p.type === 'bass') {
                    const root = Tone.Frequency(this.director.notes[0]).transpose(-12).toNote();
                    this.play(p.type, root, "4n", time, 0.9);
                    // Walking bass logic?
                    if (this.musicProfile.energy > 0.7) {
                        const fifth = Tone.Frequency(this.director.notes[2]).transpose(-12).toNote();
                        this.play(p.type, fifth, "4n", time + Tone.Time("2n").toSeconds(), 0.7);
                    }
                }

                // Percussion - Strict Jazz
                if (p.role === 'PERCUSSION') {
                    // Kick logic based on energy
                    this.synths.kick.triggerAttackRelease("C1", "8n", time);
                    if (this.musicProfile.energy > 0.8) {
                        this.synths.kick.triggerAttackRelease("C1", "8n", time + Tone.Time("4n").toSeconds());
                    }
                }
            });
        }, "1m").start(0);
        this.loops.push(rhythmLoop);

        // 3. SOLO SECTION (Melody & AI)
        const leadLoop = new Tone.Loop((time) => {
            this.activeParticipants.forEach((p, index) => {
                if (p.role === 'LEAD') {
                    const aiBuffer = this.director.aiMelodyBuffer || [];

                    if (aiBuffer.length > 0 && index < aiBuffer.length) {
                        // Play AI Generated Note
                        const note = aiBuffer[index % aiBuffer.length];
                        const duration = this.getNoteDuration();
                        this.play(p.type, note, duration, time + (index * 0.25), 0.8);
                    } else {
                        // Fallback: Probabilistic Improvisation
                        if (this.shouldPlayNote()) {
                            const scale = this.director.scale || [];
                            const note = scale[Math.floor(Math.random() * scale.length)];
                            const duration = this.getNoteDuration();
                            this.play(p.type, note, duration, time + (Math.random() * 0.5), 0.7);
                        }
                    }
                }
            });
        }, "1m").start(0);
        this.loops.push(leadLoop);

        Tone.Transport.bpm.rampTo(70, 0.1);
        this.isPlaying = true;
    }

    // --- HELPER METHODS ---

    getChord(root, type) {
        if (!root) return [];
        const r = Tone.Frequency(root);
        let intervals = [0, 4, 7];
        if (type === 'min') intervals = [0, 3, 7];
        if (type === 'dim') intervals = [0, 3, 6];
        if (type === 'min7') intervals = [0, 3, 7, 10];
        if (type === 'dom7') intervals = [0, 4, 7, 10];
        if (type === 'maj7') intervals = [0, 4, 7, 11];
        if (type === 'pwr') intervals = [0, 7, 12];
        return intervals.map(i => Tone.Frequency(r).transpose(i).toNote());
    }

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
        console.log(`🎭 Music Profile Updated: Valence=${valence.toFixed(2)}, Energy=${energy.toFixed(2)}`);
    }

    // Probabilistic note playing (Gemini's suggestion)
    shouldPlayNote() {
        // Lower energy = more silence (sparse notes)
        return Math.random() < this.musicProfile.energy;
    }

    // Dynamic note duration based on energy
    getNoteDuration() {
        // High energy = short notes (8n), Low energy = long notes (2n)
        return this.musicProfile.energy > 0.6 ? "8n" : "2n";
    }
    // Get scale based on valence (Happy = Major, Sad = Minor)
    getEmotionalScale() {
        if (this.musicProfile.valence > 0.5) {
            // Happy: Use Major scales
            return this.director.vibe === 'MEDITERRANEAN' ?
                THEORY.SCALES.PHRYGIAN_DOMINANT :
                THEORY.SCALES.IONIAN;
        } else {
            // Sad: Use Minor scales
            return THEORY.SCALES.HARMONIC_MINOR;
        }
    }

    // --- HOOKTHEORY LOGIC ---
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

    // New Helper: Convert Roman Numeral to Notes
    getRomanChordNotes(roman, keyRoot = "C3") {
        const scale = this.getEmotionalScale();
        const degrees = { 'I': 0, 'ii': 1, 'iii': 2, 'IV': 3, 'V': 4, 'vi': 5, 'VII': 6, 'i': 0 };
        const types = { 'I': 'maj', 'ii': 'min', 'iii': 'min', 'IV': 'maj', 'V': 'maj', 'vi': 'min', 'VII': 'dim', 'i': 'min' };

        const degree = degrees[roman] || 0;
        const type = types[roman] || 'maj';

        // Find root note
        // In a real app we'd map keyRoot to scale index, here we assume Key of A (Phrygian) or C (Ionian)
        // Simplified: Just pick from the current active scale
        const rootNote = scale[degree % scale.length];
        return this.getChord(rootNote, type);
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

        const seq = {
            notes: notes,
            totalQuantizedSteps: 4,
            quantizationInfo: { stepsPerQuarter: 4 }
        };

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
