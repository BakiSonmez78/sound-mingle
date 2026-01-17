import * as Tone from 'tone';

// --- ENSEMBLE DIRECTOR THEORY ---
const THEORY = {
    SCALES: {
        "PHRYGIAN_DOMINANT": ["A3", "Bb3", "C#4", "D4", "E4", "F4", "G4", "A4"], // Turkish/Vampire
        "HARMONIC_MINOR": ["A3", "B3", "C4", "D4", "E4", "F4", "G#4", "A4"], // Neoclassical
        "BLUES_HEX": ["E3", "G3", "A3", "Bb3", "B3", "D4", "E4"], // Rock Lead
        "IONIAN": ["C3", "D3", "E3", "F3", "G3", "A3", "B3", "C4"] // Happy Pop
    },
    PROGRESSIONS: {
        "MEDITERRANEAN": [ // Andalusian Cadence (Am - G - F - E)
            { root: "A3", type: "min", scale: "PHRYGIAN_DOMINANT", duration: "1m" },
            { root: "G3", type: "maj", scale: "PHRYGIAN_DOMINANT", duration: "1m" },
            { root: "F3", type: "maj", scale: "PHRYGIAN_DOMINANT", duration: "1m" },
            { root: "E3", type: "maj", scale: "PHRYGIAN_DOMINANT", duration: "1m" }
        ],
        "TWIN_GUITARS": [ // Spanish Romance Style
            { root: "E3", type: "min", scale: "HARMONIC_MINOR", duration: "2m" },
            { root: "A3", type: "min", scale: "HARMONIC_MINOR", duration: "2m" }
        ],
        "JAZZ_STANDARD": [ // ii-V-I
            { root: "D3", type: "min7", scale: "IONIAN", duration: "1m" },
            { root: "G3", type: "dom7", scale: "IONIAN", duration: "1m" },
            { root: "C3", type: "maj7", scale: "IONIAN", duration: "2m" }
        ]
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
            progressionIndex: 0
        };
    }

    async init() {
        await Tone.start();
        if (Tone.context.state !== 'running') await Tone.context.resume();
        console.log('🎵 Audio Engine 5.0 (Ensemble Director) Starting...');

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

        // 1. CONDUCTOR (Global Harmony State)
        const conductor = new Tone.Loop((time) => {
            const currentVibeInfo = this.determineVibe(this.activeParticipants); // Get live progression
            const prog = currentVibeInfo.prog;

            const step = prog[this.director.progressionIndex % prog.length];
            this.director.currentStep = step;
            this.director.scale = THEORY.SCALES[step.scale];
            this.director.notes = this.getChordNotes(step.root, step.type);

            this.director.progressionIndex++;
        }, "1m").start(0);
        this.loops.push(conductor);

        // 2. RHYTHM SECTION (Chords & Bass)
        const rhythmLoop = new Tone.Loop((time) => {
            this.activeParticipants.forEach(p => {
                // Guitar Rhythm (Strum)
                if (p.role === 'RHYTHM' && p.type === 'classical_guitar') {
                    // Strum on 1 and 3 (Quarter notes)
                    this.strum(p.type, this.director.notes, "4n", time, 0.7);
                    this.strum(p.type, this.director.notes, "4n", time + Tone.Time("2n").toSeconds(), 0.6);
                }

                // Bass Support
                if (p.role === 'SUPPORT' && p.type === 'bass') {
                    const root = Tone.Frequency(this.director.currentStep.root).transpose(-12).toNote();
                    this.play(p.type, root, "4n", time, 0.9);
                    // Simple octave on offbeat
                    this.play(p.type, root, "8n", time + Tone.Time("8n").toSeconds() * 3, 0.6);
                }

                // Percussion
                if (p.role === 'PERCUSSION') {
                    this.synths.kick.triggerAttackRelease("C1", "4n", time);
                    this.synths.ch.triggerAttackRelease("16n", time + 0.25);
                }
            });
        }, "1m").start(0);
        this.loops.push(rhythmLoop);

        // 3. SOLO SECTION (Melody & Arpeggios)
        const leadLoop = new Tone.Loop((time) => {
            this.activeParticipants.forEach(p => {
                if (p.role === 'LEAD') {
                    // Solo Logic: Pick notes from current Scale
                    if (Math.random() > 0.3) {
                        const scale = this.director.scale;
                        const note = scale[Math.floor(Math.random() * scale.length)];

                        // Humanize timing
                        const offset = Math.random() * 0.1;
                        this.play(p.type, note, "8n", time + offset, 0.8);

                        // If it's a Twin Guitar situation, do a little arpeggio run
                        if (p.type === 'classical_guitar') {
                            const n2 = scale[Math.floor(Math.random() * scale.length)];
                            this.play(p.type, n2, "8n", time + Tone.Time("8n").toSeconds() + offset, 0.7);
                        }
                    }
                }
            });
        }, "4n").start(0);
        this.loops.push(leadLoop);

        Tone.Transport.start();
        this.isPlaying = true;
    }

    getChordNotes(root, type) {
        const r = Tone.Frequency(root).toNote();
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
}

export const audioEngine = new AudioEngine();
