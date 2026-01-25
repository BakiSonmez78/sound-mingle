import * as Tone from 'tone';

/**
 * Stem Separator - Separates audio into 4 stems using frequency filtering
 * Not as good as AI-based separation (Spleeter/Moises) but works in browser
 */
class StemSeparator {
    constructor() {
        this.stems = {
            bass: null,      // 20-250 Hz
            drums: null,     // 250-2000 Hz (percussive)
            vocals: null,    // 2000-8000 Hz
            other: null      // Everything else
        };

        this.player = null;
        this.filters = {};
    }

    /**
     * Load audio from URL (Spotify preview or uploaded file)
     */
    async loadAudio(url) {
        try {
            this.player = new Tone.Player(url).toDestination();
            await Tone.loaded();

            // Create filters for each stem
            this.createFilters();

            console.log('✅ Audio loaded and stems prepared');
            return true;
        } catch (error) {
            console.error('❌ Failed to load audio:', error);
            return false;
        }
    }

    /**
     * Create frequency filters for stem separation
     */
    createFilters() {
        const master = Tone.getDestination();

        // BASS: Low-pass filter (20-250 Hz)
        this.filters.bass = new Tone.Filter({
            type: 'lowpass',
            frequency: 250,
            rolloff: -24
        }).connect(master);

        // DRUMS: Band-pass filter (250-2000 Hz) + transient emphasis
        this.filters.drums = new Tone.Filter({
            type: 'bandpass',
            frequency: 1000,
            Q: 0.5
        }).connect(master);

        // VOCALS: Band-pass filter (2000-8000 Hz)
        this.filters.vocals = new Tone.Filter({
            type: 'bandpass',
            frequency: 4000,
            Q: 1
        }).connect(master);

        // OTHER: High-pass filter (8000+ Hz)
        this.filters.other = new Tone.Filter({
            type: 'highpass',
            frequency: 8000,
            rolloff: -12
        }).connect(master);
    }

    /**
     * Play specific stem
     * @param {string} stemName - 'bass', 'drums', 'vocals', or 'other'
     * @param {number} startTime - When to start (for sync)
     */
    playStem(stemName, startTime = 0) {
        if (!this.player || !this.filters[stemName]) {
            console.error('❌ Stem not available:', stemName);
            return;
        }

        // Disconnect from all filters
        this.player.disconnect();

        // Connect only to selected stem filter
        this.player.connect(this.filters[stemName]);

        // Start playback
        if (startTime > 0) {
            this.player.start(startTime);
        } else {
            this.player.start();
        }

        console.log(`🎵 Playing stem: ${stemName}`);
    }

    /**
     * Stop playback
     */
    stop() {
        if (this.player) {
            this.player.stop();
        }
    }

    /**
     * Get available stems
     */
    getAvailableStems() {
        return Object.keys(this.stems);
    }
}

export const stemSeparator = new StemSeparator();
