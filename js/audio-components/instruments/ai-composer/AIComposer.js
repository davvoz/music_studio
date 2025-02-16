import { AbstractInstrument } from '../../abstract/AbstractInstrument.js';
import { AIComposerRender } from './AIComposerRender.js';

export class AIComposer extends AbstractInstrument {
    constructor(context) {
        super(context);
        
        // Initialize parameters first
        this.parameters = {
            waveform: 'sawtooth',
            cutoff: 0.5,
            resonance: 0.3,
            attack: 0.02, // Leggermente aumentato per evitare click
            decay: 0.1,
            sustain: 0.5, // Ridotto per avere più headroom
            release: 0.3,
            tempo: 120,
            volume: 0.5  // Ridotto il volume di default
        };
        
        // Then setup synth which depends on parameters
        this.setupSynth();
        
        // Modifica la sequence per supportare 32 step
        this.sequence = new Array(32).fill().map(() => ({
            note: null,
            active: false
        }));

        // Aggiungi supporto per pattern A/B
        this.patternMode = {
            length: 16,    // lunghezza base del pattern
            chain: false,  // modalità concatenazione
            current: 'A'   // pattern corrente (A o B)
        };

        // Aggiungi contatori per le battute
        this.barCounter = {
            current: 0,    // battuta corrente
            length: 4,     // lunghezza in battute
            stepsPerBar: 4 // step per battuta
        };

        // Modifica patternMode
        this.patternMode = {
            length: 16,     // lunghezza base del pattern
            chain: false,   // modalità concatenazione
            current: 'A',   // pattern corrente (A o B)
            switchEvery: 1  // numero di battute prima dello switch
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

        // Pre-gain per controllare il segnale prima del filtro
        this.preGain = this.context.createGain();
        this.preGain.gain.value = 0.7; // Riduce il segnale prima del filtro

        // Filter setup with better defaults
        this.filter = this.context.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = this.calculateFilterFrequency(this.parameters.cutoff);
        this.filter.Q.value = this.parameters.resonance * 20; // Ridotto il range della risonanza

        // Envelope
        this.envelope = this.context.createGain();
        this.envelope.gain.value = 0;

        // Volume
        this.volumeNode = this.context.createGain();
        this.volumeNode.gain.value = this.parameters.volume;

        // Limiter
        this.limiter = this.context.createDynamicsCompressor();
        this.limiter.threshold.value = -6.0;  // Threshold più basso
        this.limiter.knee.value = 12.0;      // Knee più morbido
        this.limiter.ratio.value = 12.0;     // Ratio meno aggressivo
        this.limiter.attack.value = 0.002;   // Attack più veloce
        this.limiter.release.value = 0.1;    // Release più lungo

        // Connect nodes
        this.osc.connect(this.preGain);
        this.preGain.connect(this.filter);
        this.filter.connect(this.envelope);
        this.envelope.connect(this.volumeNode);
        this.volumeNode.connect(this.limiter);
        this.limiter.connect(this.instrumentOutput);

        this.osc.start();
    }

    calculateFilterFrequency(cutoff) {
        // Logarithmic scale from 20Hz to 20000Hz
        return Math.exp(cutoff * Math.log(20000)) + 20;
    }

    generatePattern() {
        const scale = this.scales[this.currentScale];
        const length = this.patternMode.chain ? 32 : 16;
        const pattern = [];

        for (let i = 0; i < length; i++) {
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
        
        // Anticlick: fade out veloce prima di cambiare frequenza
        this.osc.frequency.cancelScheduledValues(now);
        this.osc.frequency.setTargetAtTime(freq, now, 0.003);

        // ADSR envelope con valori più conservativi
        this.envelope.gain.cancelScheduledValues(now);
        this.envelope.gain.setValueAtTime(0, now);
        
        // Attack più graduale
        this.envelope.gain.linearRampToValueAtTime(
            0.3, // Ridotto il picco massimo
            now + this.parameters.attack
        );
        
        // Decay più graduale
        this.envelope.gain.linearRampToValueAtTime(
            0.3 * this.parameters.sustain, 
            now + this.parameters.attack + this.parameters.decay
        );
        
        // Release con curva esponenziale
        this.envelope.gain.setTargetAtTime(
            0,
            now + this.parameters.attack + this.parameters.decay,
            this.parameters.release * 0.3
        );
    }

    onBeat(beat) {
        if (!this.isPlaying) return;

        // Calcola la battuta corrente
        const absoluteBar = Math.floor(beat / this.barCounter.stepsPerBar);
        this.barCounter.current = absoluteBar % this.barCounter.length;

        // Determina quale pattern suonare (A o B)
        const usePatternB = this.patternMode.chain && 
                           Math.floor(this.barCounter.current / this.patternMode.switchEvery) % 2 === 1;

        // Calcola lo step all'interno del pattern corrente
        const baseStep = beat % 16; // sempre 16 step per pattern
        const step = usePatternB ? baseStep + 16 : baseStep;

        const note = this.sequence[step];
        if (note && note.active && note.note !== null) {
            this.playNote(note.note);
        }

        this.currentStep = step;
        this.renderer.highlightStep(step);
        
        // Aggiorna l'indicatore del pattern corrente
        this.renderer.updateActivePattern(usePatternB ? 'B' : 'A');
    }

    updateParameter(param, value) {
        this.parameters[param] = value;

        switch(param) {
            case 'cutoff':
                const freq = this.calculateFilterFrequency(value);
                this.filter.frequency.setTargetAtTime(freq, this.context.currentTime, 0.016);
                break;
            case 'resonance':
                // Limita la risonanza in base al cutoff per evitare picchi
                const maxResonance = Math.max(0, Math.min(20, 
                    20 * (1 - this.parameters.cutoff * 0.3)
                ));
                this.filter.Q.setTargetAtTime(
                    value * maxResonance, 
                    this.context.currentTime, 
                    0.016
                );
                break;
            case 'waveform':
                this.osc.type = value;
                break;
            case 'volume':
                this.volumeNode.gain.setTargetAtTime(
                    Math.min(0.8, value), // Limita il volume massimo
                    this.context.currentTime,
                    0.016
                );
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

    // Aggiungi metodi per gestire i pattern
    togglePatternChain(enabled) {
        this.patternMode.chain = enabled;
        this.barCounter.current = 0; // Reset counter when toggling
        this.renderer.updatePatternMode(this.patternMode);
    }

    copyPatternToB() {
        // Copia i primi 16 step negli ultimi 16
        for (let i = 0; i < 16; i++) {
            this.sequence[i + 16] = { ...this.sequence[i] };
        }
        this.renderer.updatePattern(this.sequence);
    }

    // Metodo per configurare la lunghezza delle battute
    setBarLength(bars) {
        this.barCounter.length = bars;
    }

    // Metodo per configurare ogni quante battute cambiare pattern
    setPatternSwitch(bars) {
        this.patternMode.switchEvery = bars;
    }
}
