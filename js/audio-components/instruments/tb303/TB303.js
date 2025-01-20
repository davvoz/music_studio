import { AbstractInstrument } from "../../abstract/AbstractInstrument.js";
import { TB303Render } from "./TB303Render.js";

export class TB303 extends AbstractInstrument {
    constructor(context) {
        super(context);
        this.renderer = new TB303Render();
        
        // Inizializza la sequenza con 32 step vuoti
        this.sequence = Array(32).fill().map(() => ({
            note: null,
            accent: false,
            slide: false,
            gate: false
        }));
        
        // Inizializza prima i parametri
        this.parameters = {
            cutoff: 0.5,
            resonance: 0.7,
            decay: 0.2,
            envMod: 0.5,
            distortion: 0.3,
            slideTime: 0.055,
            minDecayTime: 0.03,  // Tempo minimo di decay
            maxDecayTime: 0.8    // Tempo massimo di decay
        };
        
        // Variabili di stato
        this.currentNoteTime = 0;
        this.decayTime = this.parameters.decay * 0.5 + 0.1;
        this.envModAmount = this.parameters.envMod;
        this.slideTime = this.parameters.slideTime;
        this.lastNoteFrequency = null;

        // Setup dopo l'inizializzazione dei parametri
        this.setupAudio();
        this.setupEvents();
    }

    setupAudio() {
        // Oscillator
        this.osc = this.context.createOscillator();
        this.osc.type = 'sawtooth';

        // Filter chain
        this.filter = this.context.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.Q.value = 8.0;

        // VCA chain
        this.vca = this.context.createGain();
        this.vca.gain.value = 0;

        // Accent chain
        this.accentGain = this.context.createGain();
        this.accentGain.gain.value = 1;

        // Catena della distorsione semplificata
        this.preGain = this.context.createGain();
        this.distortion = this.context.createWaveShaper();
        this.postGain = this.context.createGain();
        
        // Audio routing corretto
        this.osc.connect(this.filter);
        this.filter.connect(this.vca);
        this.vca.connect(this.preGain);
        this.preGain.connect(this.distortion);
        this.distortion.connect(this.postGain);
        this.postGain.connect(this.accentGain);
        this.accentGain.connect(this.instrumentOutput);
        
        // Impostazioni iniziali modificate
        this.filter.frequency.value = this.calculateCutoffFrequency(this.parameters.cutoff);
        this.filter.Q.value = this.parameters.resonance * 30;
        this.vca.gain.value = 0;
        this.preGain.gain.value = 1.0;   // Valore fisso
        this.postGain.gain.value = 0.7;  // Volume fisso di output
        
        this.osc.start();
    }

    // Nuovo metodo per calcolare la frequenza del filtro
    calculateCutoffFrequency(normalizedValue) {
        return Math.exp(Math.log(20) + normalizedValue * Math.log(20000 / 20));
    }

    onBeat(beat, time) {
        // Use the entire sequence length
        const stepIndex = beat % this.sequence.length;
        const step = this.sequence[stepIndex];
        if (!step) return;

        const { note, accent, slide } = step;
        if (note) {
            this.playNote(note, time, accent, slide);
            // Programmiamo lo stop della nota
            const gateTime = 0.1; // 100ms di durata della nota
            const releaseTime = time + gateTime;
            
            this.vca.gain.setValueAtTime(0, releaseTime);
            this.filter.frequency.setValueAtTime(this.calculateCutoffFrequency(this.parameters.cutoff), releaseTime);
        }

        requestAnimationFrame(() => {
            this.renderer.highlightStep?.(stepIndex);
        });
    }

    clearScheduledValues(time) {
        this.vca.gain.cancelScheduledValues(time);
        this.filter.frequency.cancelScheduledValues(time);
        this.accentGain.gain.cancelScheduledValues(time);
        this.osc.frequency.cancelScheduledValues(time);
    }

    updateDistortion(amount) {
        // Curva di distorsione migliorata
        const curve = new Float32Array(44100);
        const k = amount * 50; // Ridotto ulteriormente
        
        for (let i = 0; i < 44100; i++) {
            const x = (i * 2) / 44100 - 1;
            // Normalizzazione della curva per mantenere il volume costante
            if (amount > 0) {
                curve[i] = Math.tanh(k * x) / Math.tanh(k);
            } else {
                curve[i] = x;
            }
        }
        
        this.distortion.curve = curve;
        
        // Livelli fissi per mantenere il volume costante
        this.preGain.gain.value = 1.0;  // Sempre a 1
        this.postGain.gain.value = 0.7; // Volume fisso di output
    }

    setupEvents() {
        this.renderer.setParameterChangeCallback((param, value) => {
            // Memorizza sempre il nuovo valore
            this.parameters[param] = value;

            switch(param) {
                case 'cutoff':
                    const freq = this.calculateCutoffFrequency(value);
                    // Reset immediato di eventuali automazioni
                    this.filter.frequency.cancelScheduledValues(this.context.currentTime);
                    this.filter.frequency.setValueAtTime(freq, this.context.currentTime);
                    break;
                case 'resonance':
                    this.filter.Q.value = value * 30;
                    break;
                case 'decay':
                    // Scala logaritmica per il decay
                    this.decayTime = this.parameters.minDecayTime + 
                        Math.pow(value, 2) * (this.parameters.maxDecayTime - this.parameters.minDecayTime);
                    break;
                case 'envMod':
                    this.envModAmount = value * 2;
                    break;
                case 'distortion':
                    this.updateDistortion(value);
                    break;
                case 'waveform':
                    this.osc.type = value;
                    break;
                case 'slideTime':
                    this.slideTime = value * 0.1 + 0.02;
                    break;
            }
        });

        this.renderer.setSequenceChangeCallback((step, data) => {
            this.sequence[step] = data;
        });
    }

    getNoteFrequency(note) {
        const notes = {'C':0,'C#':1,'D':2,'D#':3,'E':4,'F':5,'F#':6,'G':7,'G#':8,'A':9,'A#':10,'B':11};
        const [pitch, octave] = [note.slice(0,-1), parseInt(note.slice(-1))];
        return 440 * Math.pow(2, (notes[pitch] + (octave - 4) * 12) / 12);
    }

    getCurrentConfig() {
        return {
            sequence: this.sequencer.getSequence(),
            parameters: {
                cutoff: this.filter.frequency.value,
                resonance: this.filter.Q.value,
                envMod: this.envModAmount,
                decay: this.envelope.decay,
                accent: this.accentAmount,
                // ... altri parametri specifici del TB303
            }
        };
    }

    loadConfig(config) {
        if (!config) return;

        // Carica la sequenza
        if (config.sequence) {
            this.sequencer.setSequence(config.sequence);
        }

        // Carica i parametri
        if (config.parameters) {
            const p = config.parameters;
            this.filter.frequency.value = p.cutoff;
            this.filter.Q.value = p.resonance;
            this.envModAmount = p.envMod;
            this.envelope.decay = p.decay;
            this.accentAmount = p.accent;
            
            // Aggiorna UI
            this.updateUI();
        }
    }

    playNote(note, time, accent = false, slide = false) {
        const freq = this.getNoteFrequency(note);
        const baseTime = time || this.context.currentTime;
        
        // Reset scheduled values if not sliding
        if (!slide) {
            this.clearScheduledValues(baseTime);
        }
    
        // Set oscillator frequency
        if (slide && this.lastNoteFrequency) {
            this.osc.frequency.linearRampToValueAtTime(freq, baseTime + this.slideTime);
        } else {
            this.osc.frequency.setValueAtTime(freq, baseTime);
        }
    
        // Store current frequency for next note's slide
        this.lastNoteFrequency = freq;
    
        // Calcoli migliorati per l'envelope
        const accentMod = accent ? 2 : 1;
        const envAmount = this.envModAmount * accentMod;
        
        // Decay time calculation migliorato
        const baseDecayTime = this.decayTime;
        const accentedDecayTime = accent ? baseDecayTime * 1.2 : baseDecayTime;
        const finalDecayTime = Math.max(this.parameters.minDecayTime, 
                                      Math.min(accentedDecayTime, this.parameters.maxDecayTime));
        
        // Attack più rapido
        const attackTime = 0.003;
        
        // Amplitude envelope migliorato
        this.vca.gain.cancelScheduledValues(baseTime);
        this.vca.gain.setValueAtTime(0, baseTime);
        this.vca.gain.linearRampToValueAtTime(0.8 * accentMod, baseTime + attackTime);
        
        // Decay con curva esponenziale più naturale
        this.vca.gain.setTargetAtTime(0.0001, baseTime + attackTime, finalDecayTime / 3);
    
        // Filter envelope migliorato
        const baseFreq = this.calculateCutoffFrequency(this.parameters.cutoff);
        const maxFreq = Math.min(baseFreq * (1 + envAmount * 4), 20000);
        
        this.filter.frequency.cancelScheduledValues(baseTime);
        this.filter.frequency.setValueAtTime(baseFreq, baseTime);
        this.filter.frequency.linearRampToValueAtTime(maxFreq, baseTime + attackTime);
        this.filter.frequency.setTargetAtTime(baseFreq, baseTime + attackTime, finalDecayTime / 4);
        
        // Accent gain con transizione più morbida
        const accentGainValue = accent ? 1.4 : 1;
        this.accentGain.gain.setTargetAtTime(accentGainValue, baseTime, 0.005);
    }
}