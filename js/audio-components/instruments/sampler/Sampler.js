import { AbstractInstrument } from "../../abstract/AbstractInstrument.js";
import { SamplerRender } from "./SamplerRender.js";

export class Sampler extends AbstractInstrument {
    constructor(context) {
        super(context);
        this.renderer = new SamplerRender();
        this.currentSample = null;
        
        this.parameters = {
            gain: 1.0,         // Aumentato il gain default
            patternLength: 32,  // Aggiungi la lunghezza del pattern di default
            globalPitch: 0,    // Aggiungi pitch globale
            globalLength: 1.0  // Aggiungi length globale
        };

        // Initialize sequence with length parameter
        this.sequence = Array(32).fill().map(() => ({
            active: false,
            velocity: 0.8,
            pitch: 0,
            length: 1,
            startOffset: 0
        }));

        this.currentPattern = 0;
        this.patterns = Array(8).fill().map(() => Array(32).fill().map(() => ({
            active: false,
            velocity: 0.8,
            pitch: 0,
            length: 1
        })));

        // Audio routing
        this.gainNode = this.context.createGain();
        this.gainNode.connect(this.instrumentOutput);
        this.gainNode.gain.value = this.parameters.gain;

        this.setupEventListeners(); // Aggiungi questa chiamata
    }

    setupEventListeners() {
        this.renderer.setParameterChangeCallback((param, value) => {
            console.log('Parameter change:', param, value); // Debug
            switch(param) {
                case 'loadSample':
                    this.loadSample(value);
                    break;
                case 'updateSequence':
                    console.log('Updating sequence:', value); // Debug
                    this.updateSequence(
                        value.step, 
                        value.active, 
                        value.pitch, 
                        value.velocity,
                        value.length,  // Aggiungi il parametro length
                        value.startOffset  // Aggiungi startOffset qui
                    );
                    break;
                case 'savePattern':
                    this.savePattern(value);
                    break;
                case 'loadPattern':
                    this.loadPattern(value);
                    break;
                case 'generatePattern':
                    this.generatePattern(value);
                    break;
                case 'patternLength':
                    this.parameters.patternLength = parseInt(value);
                    // Aggiorna visivamente gli step attivi/inattivi
                    this.renderer.updatePatternLength?.(value);
                    break;
                case 'globalPitch':
                case 'globalLength':
                    this.parameters[param] = value;
                    break;
                default:
                    this.parameters[param] = value;
            }
        });
    }

    async loadSample(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
            this.currentSample = { buffer: audioBuffer, name: file.name };
            console.log('Sample loaded:', this.currentSample.name); // Debug
            return true;
        } catch (error) {
            console.error('Error loading sample:', error);
            throw error;
        }
    }

    onBeat(beat, time) {
        // Always loop through the full sequence
        const stepIndex = beat % this.sequence.length;
        const step = this.sequence[stepIndex];

        if (step?.active && this.currentSample?.buffer) {
            this.playSample(
                step.pitch,
                step.velocity,
                step.length,
                time,
                step.startOffset
            );
        }

        requestAnimationFrame(() => {
            this.renderer.highlightStep?.(stepIndex);
        });
    }

    playSample(pitch = 0, velocity = 1, length = 1, time = this.context.currentTime, startOffset = 0) {
        if (!this.currentSample?.buffer) {
            console.log('No sample loaded'); // Debug
            return;
        }

        const source = this.context.createBufferSource();
        source.buffer = this.currentSample.buffer;
        
        // Applica il pitch globale
        const finalPitch = pitch + this.parameters.globalPitch;
        source.playbackRate.value = Math.pow(2, finalPitch/12);
        
        source.connect(this.gainNode);
        
        // Aumentato il gain complessivo
        const finalGain = velocity * this.parameters.gain * 1.5; // Moltiplicatore extra
        
        // Imposta il gain con rampa per evitare click
        this.gainNode.gain.cancelScheduledValues(time);
        this.gainNode.gain.setValueAtTime(0, time);
        this.gainNode.gain.linearRampToValueAtTime(finalGain, time + 0.005);
        
        // Calcola durata e offset
        const baseDuration = this.currentSample.buffer.duration;
        const actualDuration = Math.max(0.01, baseDuration * length * this.parameters.globalLength); // Previeni durate negative o zero
        const actualStart = Math.min(baseDuration * startOffset, baseDuration - 0.01); // Previeni start oltre la fine

        console.log('Playing sample:', {
            pitch,
            velocity,
            length,
            actualDuration,
            startOffset,
            actualStart,
            time
        });

        try {
            source.start(time, actualStart, actualDuration);
            
            // Fade out alla fine per evitare click
            this.gainNode.gain.setValueAtTime(finalGain, time + actualDuration - 0.005);
            this.gainNode.gain.linearRampToValueAtTime(0, time + actualDuration);
        } catch (error) {
            console.error('Error playing sample:', error);
        }
    }

    updateSequence(step, active, pitch = 0, velocity = 1, length = 1, startOffset = 0) {
        // Validazione dei valori
        length = Math.max(0.01, Math.min(4, length)); // Limita la lunghezza tra 0.01 e 4
        velocity = Math.max(0, Math.min(1, velocity)); // Limita la velocity tra 0 e 1
        startOffset = Math.max(0, Math.min(1, startOffset)); // Limita lo startOffset tra 0 e 1

        this.sequence[step] = { 
            active, 
            pitch, 
            velocity, 
            length,
            startOffset
        };
        
        console.log('Sequence updated:', this.sequence[step]);
    }

    savePattern(patternNum) {
        // Pattern numbers are 1-based in UI, 0-based in array
        const index = patternNum - 1;
        this.patterns[index] = JSON.parse(JSON.stringify(this.sequence));
        // Save to localStorage
        localStorage.setItem(`sampler-pattern-${index}`, JSON.stringify(this.sequence));
    }

    loadPattern(patternNum) {
        const index = patternNum - 1;
        // Try loading from localStorage first
        const saved = localStorage.getItem(`sampler-pattern-${index}`);
        if (saved) {
            this.patterns[index] = JSON.parse(saved);
        }
        
        this.sequence = JSON.parse(JSON.stringify(this.patterns[index]));
        this.currentPattern = index;
        
        // Pass the sequence to the renderer to update UI
        this.renderer.updateSequenceUI(this.sequence);
    }

    generatePattern(type) {
        const length = this.parameters.patternLength;
        let pattern = Array(32).fill().map(() => ({
            active: false,
            velocity: 0.8,
            pitch: 0,
            length: 1,
            startOffset: 0
        }));

        // First fill 'length' steps
        for (let i = 0; i < length; i++) {
            pattern[i] = this.generateRandomStep();
        }

        // Then replicate these steps up to 32
        for (let i = length; i < 32; i++) {
            pattern[i] = JSON.parse(JSON.stringify(pattern[i % length]));
        }

        this.sequence = pattern;
        this.renderer.updateSequenceUI(this.sequence);
    }

    generateRandomStep() {
        return {
            active: Math.random() < 0.4,
            pitch: Math.floor(Math.random() * 25) - 12,
            velocity: 0.5 + Math.random() * 0.5,
            length: 0.1 + Math.random() * 0.9,
            startOffset: Math.random() < 0.3 ? Math.random() * 0.5 : 0
        };
    }

    generateRandomPattern() {
        return Array(32).fill().map(() => ({
            active: Math.random() < 0.4,
            pitch: Math.floor(Math.random() * 25) - 12,
            velocity: 0.5 + Math.random() * 0.5,
            length: 0.1 + Math.random() * 0.9,
            startOffset: Math.random() < 0.3 ? Math.random() * 0.5 : 0
        }));
    }

    generateMelodicPattern(scale = 'minor') {
        const scales = {
            minor: [-12, -10, -8, -7, -5, -3, -1, 0, 2, 4, 5, 7, 9, 11],
            major: [-12, -10, -8, -7, -5, -4, -2, 0, 2, 4, 5, 7, 9, 11]
        };
        const notes = scales[scale];
        
        return Array(32).fill().map((_, i) => {
            const isActive = Math.random() < 0.5;
            return {
                active: isActive,
                pitch: isActive ? notes[Math.floor(Math.random() * notes.length)] : 0,
                velocity: 0.6 + Math.random() * 0.4,
                length: 0.2 + Math.random() * 0.8,
                startOffset: Math.random() < 0.2 ? Math.random() * 0.3 : 0
            };
        });
    }

    generatePercussivePattern() {
        return Array(32).fill().map((_, i) => {
            const isAccent = i % 4 === 0;
            const isActive = isAccent ? true : Math.random() < 0.3;
            
            return {
                active: isActive,
                pitch: Math.floor(Math.random() * 7) - 3,
                velocity: isAccent ? 1 : 0.6 + Math.random() * 0.3,
                length: isAccent ? 0.4 : 0.05 + Math.random() * 0.2,
                startOffset: Math.random() < 0.4 ? Math.random() * 0.2 : 0
            };
        });
    }
}
