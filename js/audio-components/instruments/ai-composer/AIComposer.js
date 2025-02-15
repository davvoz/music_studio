import { AbstractInstrument } from '../../abstract/AbstractInstrument.js';
import { AIComposerRender } from './AIComposerRender.js';

export class AIComposer extends AbstractInstrument {
    constructor(context) {
        super(context);
        
        // Base synth setup
        this.setupSynth();
        
        // Sequence setup
        this.sequence = new Array(16).fill().map(() => ({
            note: null,
            active: false
        }));

        // Musical parameters
        this.parameters = {
            waveform: 'sawtooth',
            cutoff: 0.5,
            resonance: 0.3,
            attack: 0.01,
            decay: 0.1,
            sustain: 0.7,
            release: 0.3,
            tempo: 120
        };

        // Musical scales
        this.scales = {
            major: [0, 2, 4, 5, 7, 9, 11],
            minor: [0, 2, 3, 5, 7, 8, 10],
            pentatonic: [0, 2, 4, 7, 9]
        };

        // Current state
        this.currentScale = 'minor';
        this.currentKey = 'C';
        this.baseNote = 60; // Middle C
        this.octave = 0;
        this.isPlaying = false;
        this.currentStep = 0;

        // AI parameters
        this.complexity = 0.5;   // 0-1: influenza la complessità delle melodie
        this.variation = 0.3;    // 0-1: quanto varia dalle scale tradizionali

        this.renderer = new AIComposerRender(this.id, this);
    }

    setupSynth() {
        // Oscillator
        this.osc = this.context.createOscillator();
        this.osc.type = 'sawtooth';

        // Filter
        this.filter = this.context.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 2000;
        this.filter.Q.value = 5;

        // Envelope
        this.envelope = this.context.createGain();
        this.envelope.gain.value = 0;

        // Connect nodes
        this.osc.connect(this.filter);
        this.filter.connect(this.envelope);
        this.envelope.connect(this.instrumentOutput);

        this.osc.start();
    }

    generatePattern() {
        const scale = this.scales[this.currentScale];
        const pattern = [];

        for (let i = 0; i < 16; i++) {
            if (Math.random() < 0.6) { // Basic note probability
                const noteIndex = this.selectIntelligentNote(scale, i);
                const note = this.baseNote + scale[noteIndex];
                pattern[i] = { note, active: true };
            } else {
                pattern[i] = { note: null, active: false };
            }
        }

        this.sequence = pattern;
        this.renderer.updatePattern(pattern);
    }

    selectIntelligentNote(scale, position) {
        // Base probability for each note in scale
        let probabilities = new Array(scale.length).fill(1);

        // Favor root note on strong beats
        if (position % 4 === 0) {
            probabilities[0] *= 2;
        }

        // Add variation based on complexity
        if (Math.random() < this.complexity) {
            const randomIndex = Math.floor(Math.random() * scale.length);
            probabilities[randomIndex] *= 1.5;
        }

        // Calculate total probability
        const total = probabilities.reduce((a, b) => a + b, 0);
        let random = Math.random() * total;

        // Select note based on weighted probabilities
        for (let i = 0; i < probabilities.length; i++) {
            random -= probabilities[i];
            if (random <= 0) return i;
        }

        return 0;
    }

    playNote(note, time) {
        const now = time || this.context.currentTime;
        const freq = 440 * Math.pow(2, (note - 69) / 12);
        
        // Set oscillator frequency
        this.osc.frequency.setValueAtTime(freq, now);

        // ADSR envelope
        this.envelope.gain.cancelScheduledValues(now);
        this.envelope.gain.setValueAtTime(0, now);
        
        // Attack
        this.envelope.gain.linearRampToValueAtTime(0.8, now + this.parameters.attack);
        
        // Decay to sustain level
        this.envelope.gain.linearRampToValueAtTime(
            0.8 * this.parameters.sustain, 
            now + this.parameters.attack + this.parameters.decay
        );
        
        // Release
        this.envelope.gain.linearRampToValueAtTime(
            0, 
            now + this.parameters.attack + this.parameters.decay + this.parameters.release
        );
    }

    onBeat(beat) {
        if (!this.isPlaying) return;

        const step = beat % 16;
        const note = this.sequence[step];

        if (note && note.active && note.note !== null) {
            this.playNote(note.note);
        }

        this.currentStep = step;
        this.renderer.highlightStep(step);
    }

    updateParameter(param, value) {
        this.parameters[param] = value;

        switch(param) {
            case 'cutoff':
                const freq = Math.exp(value * Math.log(20000));
                this.filter.frequency.setValueAtTime(freq, this.context.currentTime);
                break;
            case 'resonance':
                this.filter.Q.value = value * 30;
                break;
            case 'waveform':
                this.osc.type = value;
                break;
            // ADSR parameters are automatically updated in this.parameters
        }
    }

    start() {
        this.isPlaying = true;
    }

    stop() {
        this.isPlaying = false;
        this.currentStep = 0;
        this.envelope.gain.cancelScheduledValues(this.context.currentTime);
        this.envelope.gain.setValueAtTime(0, this.context.currentTime);
    }
}
