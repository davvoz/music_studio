import { AbstractInstrument } from "../../abstract/AbstractInstrument.js";
import { SamplerRender } from "./SamplerRender.js";
import { MIDIMapping } from "../../../core/MIDIMapping.js";  // Aggiungi questo import

export class Sampler extends AbstractInstrument {
    constructor(context) {
        super(context);
        // Aggiungi un ID univoco per ogni istanza
        this.instanceId = 'sampler_' + Date.now();
        this.midiMapping = new MIDIMapping(); // Aggiungi il supporto MIDI
        // Passa sia l'ID che l'istanza del sampler
        this.renderer = new SamplerRender(this.instanceId, this);
        this.currentSample = null;
        
        this.parameters = {
            gain: 1.0,         // Aumentato il gain default
            patternLength: 32,  // Aggiungi la lunghezza del pattern di default
            globalPitch: 0,    // Aggiungi pitch globale
            globalLength: 1.0,  // Aggiungi length globale
            filterCutoff: 1.0,     // Nuovo parametro
            filterResonance: 0.0,  // Nuovo parametro
            filterType: 'lowpass'  // Nuovo parametro
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

        // Correggi l'ordine di creazione e configurazione della catena audio
        this.gainNode = this.context.createGain();
        this.filter = this.context.createBiquadFilter();
        
        // Imposta i valori iniziali del filtro in modo più aggressivo
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 2000; // Frequenza iniziale più bassa per sentire l'effetto
        this.filter.Q.value = 5; // Q iniziale più alto
        
        // Correggi il routing audio
        this.gainNode.connect(this.filter);
        this.filter.connect(this.instrumentOutput);
        this.gainNode.gain.value = this.parameters.gain;

        this.setupEventListeners(); // Aggiungi questa chiamata
        this.selectedLength = 32; // Aggiungi questa linea
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
                    this.selectedLength = parseInt(value);
                    this.parameters.patternLength = parseInt(value);
                    // Aggiorna visivamente gli step attivi/inattivi
                    this.renderer.updatePatternLength?.(value);
                    break;
                case 'globalPitch':
                case 'globalLength':
                    this.parameters[param] = value;
                    break;
                case 'filterCutoff':
                    this.updateFilterCutoff(value);
                    break;
                case 'filterResonance':
                    this.updateFilterResonance(value);
                    break;
                case 'filterType':
                    this.filter.type = value;
                    console.log('Filter type:', value);
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
        // Always loop through all 32 steps
        const stepIndex = beat % 32;
        const step = this.sequence[stepIndex];
        
        // Play step if active and sample is loaded
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
        
        // Correggi il routing: source -> gainNode -> filter -> output
        source.connect(this.gainNode);
        
        // Rimuovi il gainNode extra che bypassava il filtro
        const mainGain = velocity * this.parameters.gain * 1.5;
        
        this.gainNode.gain.cancelScheduledValues(time);
        this.gainNode.gain.setValueAtTime(0, time);
        this.gainNode.gain.linearRampToValueAtTime(mainGain, time + 0.005);
        
        const baseDuration = this.currentSample.buffer.duration;
        const actualDuration = Math.max(0.01, baseDuration * length * this.parameters.globalLength);
        const actualStart = Math.min(baseDuration * startOffset, baseDuration - 0.01);

        try {
            source.start(time, actualStart, actualDuration);
            this.gainNode.gain.setValueAtTime(mainGain, time + actualDuration - 0.005);
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
        // Usa l'ID univoco nella chiave del localStorage
        localStorage.setItem(`${this.instanceId}-pattern-${index}`, JSON.stringify(this.sequence));
    }

    loadPattern(patternNum) {
        const index = patternNum - 1;
        // Usa l'ID univoco per recuperare il pattern
        const saved = localStorage.getItem(`${this.instanceId}-pattern-${index}`);
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

    // Aggiungi questo metodo per gestire i messaggi MIDI
    handleInstrumentMIDI(message) {
        const result = this.midiMapping.handleMIDIMessage(message);
        console.log('Sampler MIDI result:', result, 'from message:', message.data);
        
        if (result.mapped) {
            // Converti il nome del parametro nel formato corretto per l'UI
            const uiParam = this.getUIParamName(result.param);
            
            switch(result.param) {
                case 'filterCutoff':
                    this.updateFilterCutoff(result.value);
                    this.renderer.updateControl('filter-cutoff', result.value);
                    break;
                case 'filterResonance':
                    this.updateFilterResonance(result.value);
                    this.renderer.updateControl('filter-resonance', result.value);
                    break;
                case 'gain':
                    this.parameters.gain = result.value * 2; // Scala 0-2
                    this.gainNode.gain.value = this.parameters.gain;
                    this.renderer.updateControl('global-gain', result.value * 2);
                    break;
                case 'globalPitch':
                    const pitchValue = (result.value * 48) - 24; // Scala -24 to +24
                    this.parameters.globalPitch = pitchValue;
                    this.renderer.updateControl('global-pitch', pitchValue);
                    break;
                case 'globalLength':
                    const lengthValue = result.value * 4; // Scala 0-4
                    this.parameters.globalLength = lengthValue;
                    this.renderer.updateControl('global-length', lengthValue);
                    break;
                default:
                    if (!result.param?.startsWith('pattern')) {
                        this.updateParameter(result.param, result.value);
                        this.renderer.updateControl(uiParam, result.value);
                    }
            }
        }

        // Gestione pattern triggers
        if (result.mapped && result.trigger && result.param?.startsWith('pattern')) {
            const patternNum = parseInt(result.param.replace('pattern', ''));
            this.loadPattern(patternNum);
            
            // Update UI
            const buttons = this.renderer.container.querySelectorAll('.pattern-btn');
            buttons.forEach(btn => btn.classList.remove('active'));
            const selectedBtn = this.renderer.container.querySelector(`.pattern-btn[data-pattern="${patternNum}"]`);
            if (selectedBtn) {
                selectedBtn.classList.add('active');
            }
        }

        // Aggiorna lo stato del mapping MIDI nell'UI
        if (result.justMapped) {
            this.renderer.updateMidiMapping(result.param, true);
        }
    }

    // Utility per convertire i nomi dei parametri
    getUIParamName(param) {
        const mapping = {
            'filterCutoff': 'filter-cutoff',
            'filterResonance': 'filter-resonance',
            'gain': 'global-gain',
            'globalPitch': 'global-pitch',
            'globalLength': 'global-length'
        };
        return mapping[param] || param;
    }

    updateFilterCutoff(value) {
        const minFreq = 20;
        const maxFreq = 20000;
        this.parameters.filterCutoff = value;
        
        // Usa una scala logaritmica più precisa per la frequenza
        const normValue = Math.max(0, Math.min(1, value)); // Assicurati che il valore sia tra 0 e 1
        const frequency = minFreq * Math.pow(maxFreq/minFreq, normValue);
        
        // Applica immediatamente il cambiamento
        const now = this.context.currentTime;
        this.filter.frequency.cancelScheduledValues(now);
        this.filter.frequency.exponentialRampToValueAtTime(frequency, now + 0.016);
        
        console.log('Filter frequency:', frequency, 'Hz');
    }

    updateFilterResonance(value) {
        this.parameters.filterResonance = value;
        
        // Usa una scala più aggressiva per la risonanza
        const normValue = Math.max(0, Math.min(1, value));
        const Q = normValue * 30; // Aumentato il range della risonanza
        
        // Applica immediatamente il cambiamento
        const now = this.context.currentTime;
        this.filter.Q.cancelScheduledValues(now);
        this.filter.Q.linearRampToValueAtTime(Q, now + 0.016);
        
        console.log('Filter Q:', Q);
    }

    updateParameter(param, value) {
        if (!this.parameters[param]) return;
        
        this.parameters[param] = value;
        
        switch(param) {
            case 'filterCutoff':
                this.updateFilterCutoff(value);
                break;
            case 'filterResonance':
                this.updateFilterResonance(value);
                break;
            case 'filterType':
                this.filter.type = value;
                console.log('Filter type set to:', value);
                break;
            // ...existing parameter cases...
        }
    }

    restoreMIDIMappings(mappings) {
        if (this.midiMapping && mappings) {
            this.midiMapping.setMappings(mappings);
            this.renderer?.updateMIDIMappings?.(mappings);
        }
    }
}
