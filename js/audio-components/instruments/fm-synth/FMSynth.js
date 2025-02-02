import { AbstractInstrument } from "../../abstract/AbstractInstrument.js";
import { FMSynthRender } from "./FMSynthRender.js";

export const FMAlgorithms = {
    SIMPLE: [
        [0, 1, 0, 0],  // Op1 -> Op2
        [0, 0, 0, 1],  // Op2 -> Op4
        [0, 0, 0, 1],  // Op3 -> Op4
        [0, 0, 0, 0]   // Op4 -> output
    ],
    CASCADE: [
        [0, 1, 0, 0],  // Op1 -> Op2
        [0, 0, 1, 0],  // Op2 -> Op3
        [0, 0, 0, 1],  // Op3 -> Op4
        [0, 0, 0, 0]   // Op4 -> output
    ],
    PARALLEL: [
        [0, 0, 0, 1],  // Op1 -> Op4
        [0, 0, 0, 1],  // Op2 -> Op4
        [0, 0, 0, 1],  // Op3 -> Op4
        [0, 0, 0, 0]   // Op4 -> output
    ],
    FEEDBACK: [
        [1, 1, 0, 0],  // Op1 -> Op1, Op2
        [0, 0, 1, 0],  // Op2 -> Op3
        [0, 0, 0, 1],  // Op3 -> Op4
        [0, 0, 0, 0]   // Op4 -> output
    ]
};

class Operator {
    constructor(context) {
        this.context = context;
        this.setupNodes();
        this.isPlaying = false;
        // NON avviare l'oscillatore nel costruttore
    }

    setupNodes() {
        // Disconnetti eventuali nodi esistenti
        if (this.gainNode) this.gainNode.disconnect();
        if (this.outputGain) this.outputGain.disconnect();
        if (this.analyzer) this.analyzer.disconnect();

        // Crea i nodi base
        this.oscillator = this.context.createOscillator();
        this.gainNode = this.context.createGain();
        this.outputGain = this.context.createGain();
        this.analyzer = this.context.createAnalyser();

        // Collegamenti base
        this.oscillator.connect(this.gainNode);
        this.gainNode.connect(this.outputGain);
        this.gainNode.connect(this.analyzer);

        // Setup analyzer
        this.analyzer.fftSize = 2048;
        this.waveformData = new Float32Array(this.analyzer.frequencyBinCount);

        // Parametri base
        this.parameters = {
            frequency: 440,
            ratio: 1,
            gain: 0.5,  // Modifica da 0 a 0.5
            detune: 0,
            waveform: 'sine'
        };

        // Imposta i valori iniziali di gain a valori udibili
        this.gainNode.gain.value = 0.5;  // Gain di base
        this.outputGain.gain.value = 0.5; // Output gain di base
    }

    connect(destination) {
        this.outputGain.connect(destination);
    }

    disconnect() {
        this.outputGain.disconnect();
    }

    setFrequency(value) {
        this.parameters.frequency = value;
        this.oscillator.frequency.setValueAtTime(
            value * this.parameters.ratio,
            this.oscillator.context.currentTime
        );
    }

    setRatio(value) {
        this.parameters.ratio = value;
        this.oscillator.frequency.setValueAtTime(
            this.parameters.frequency * value,
            this.oscillator.context.currentTime
        );
    }

    setGain(value) {
        // Assicurati che il gain non sia mai 0
        const safeValue = Math.max(0.0001, value);
        this.parameters.gain = safeValue;
        this.gainNode.gain.setTargetAtTime(safeValue, this.context.currentTime, 0.01);
    }

    setDetune(value) {
        this.oscillator.detune.setValueAtTime(value, this.oscillator.context.currentTime);
    }

    setWaveform(type) {
        this.oscillator.type = type;
    }

    getWaveformData() {
        this.analyzer.getFloatTimeDomainData(this.waveformData);
        return this.waveformData;
    }

    start() {
        if (!this.isPlaying) {
            this.setupNodes();
            try {
                this.oscillator.start();
                this.isPlaying = true;
                
                // Applica i parametri salvati dopo l'avvio
                if (this.savedParameters) {
                    Object.entries(this.savedParameters).forEach(([key, value]) => {
                        if (typeof value === 'number' && isFinite(value)) {
                            const method = `set${key.charAt(0).toUpperCase() + key.slice(1)}`;
                            if (this[method]) this[method](value);
                        }
                    });
                }
            } catch (error) {
                console.warn('Error starting oscillator:', error);
            }
        }
    }

    stop() {
        if (this.isPlaying) {
            this.savedParameters = { ...this.parameters };
            try {
                this.oscillator?.stop();
                this.disconnect();  // Aggiungi questa riga
                this.gainNode?.disconnect();  // Aggiungi questa riga
                this.outputGain?.disconnect(); // Aggiungi questa riga
                this.analyzer?.disconnect();   // Aggiungi questa riga
            } catch (error) {
                console.warn('Error stopping oscillator:', error);
            }
            this.isPlaying = false;
            this.oscillator = null;
            this.gainNode = null;  // Aggiungi questa riga
            this.outputGain = null; // Aggiungi questa riga
            this.analyzer = null;   // Aggiungi questa riga
        }
    }

    // Aggingi questo metodo
    cleanup() {
        this.stop();
        this.disconnect();
        this.gainNode?.disconnect();
        this.outputGain?.disconnect();
        this.analyzer?.disconnect();
    }
}

class Envelope {
    constructor() {
        this.points = [];
        this.length = 1;
        this.active = false;
        this.lastValue = 0;
    }
}

export class FMSynth extends AbstractInstrument {
    constructor(context) {
        super(context);
        this.instanceId = 'fmsynth_' + Date.now();

        // Inizializza i parametri
        this.parameters = {
            cutoff: 0.5,
            resonance: 0.7,
            envMod: 0.5,
            decay: 0.2,
            waveform: 'sawtooth',
            tempo: 120,
            modDepth: 0.5,
            modRatio: 1,
            modGain: 0.5,
            carrierGain: 0.8,
            modShape: 'sine',      // Forma d'onda modulatore
            feedback: 0,           // Feedback del modulatore
            harmonicity: 1,        // Rapporto armonico
            modIndex: 0.5,         // Indice di modulazione
            subOscLevel: 0,        // Livello sub oscillatore
            subOscShape: 'sine',    // Forma d'onda sub oscillatore
            // ADSR Ampiezza
            ampAttack: 0.01,
            ampDecay: 0.2,
            ampSustain: 0.7,
            ampRelease: 0.3,
            // ADSR Filtro
            filterAttack: 0.05,
            filterDecay: 0.2,
            filterSustain: 0.3,
            filterRelease: 0.2,
            // ADSR Modulatore
            modAttack: 0.01,
            modDecay: 0.1,
            modSustain: 1.0,
            modRelease: 0.1,
            // Curve degli inviluppi
            ampCurve: 2,      // Esponenziale positivo
            filterCurve: 3,    // Più esponenziale
            modCurve: 1,       // Lineare
            modDetune: 0,       // Detune del modulatore in cents
            modPhase: 0,        // Fase iniziale del modulatore
            // Aggiungi nuovi parametri per il modulatore
            modMix: 0.5,           // Mix tra modulazione lineare e esponenziale
            modSync: false,        // Sync del modulatore con il carrier
            modFoldback: 0,        // Quantità di foldback per distorsione
            
            // Aggiungi parametri per il carrier
            carrierDetune: 0,      // Detune del carrier in cents
            carrierPhase: 0,       // Fase iniziale del carrier
            carrierSpread: 0,      // Spread stereo
            
            // Filtro avanzato
            filterType: 'lowpass', // lowpass, highpass, bandpass
            filterDrive: 0,        // Overdrive del filtro
            filterTracking: 0,     // Key tracking del filtro
            
            // Effetti aggiuntivi
            bitcrush: 1,          // Bit reduction
            ringMod: 0,           // Ring modulation amount
            foldback: 0,          // Foldback distortion

            // LFO 1
            lfo1Rate: 0.5,      // 0-20Hz o sync al tempo
            lfo1Depth: 0.5,
            lfo1Shape: 'sine',  // sine, triangle, square, saw
            lfo1Sync: true,     // sync al tempo
            lfo1Target: 'none', // cutoff, modDepth, pitch, etc.
            lfo1Division: '1/4', // divisione ritmica quando sync è true
            
            // LFO 2
            lfo2Rate: 0.5,
            lfo2Depth: 0.5,
            lfo2Shape: 'sine',
            lfo2Sync: true,
            lfo2Target: 'none',
            lfo2Division: '1/8'
        };

        // Setup audio
        this.setupAudio();  // Solo una volta!

        // Setup LFO targets DOPO aver creato i nodi audio
        this.lfoTargets = {
            none: null,
            cutoff: this.filter.frequency,
            modDepth: this.modGainNode.gain,
            pitch: this.carrier.frequency,
            resonance: this.filter.Q,
            pan: this.stereoSpread.pan,
            feedback: this.feedbackGain.gain
        };

        // Setup LFO dopo i target
        this.setupLFOs();

        // Sequencer e altro setup
        this.sequence = Array(32).fill().map(() => ({
            note: null,
            accent: false,
            slide: false
        }));

        this.currentFrequency = 440;
        this.lastNoteFrequency = null;

        // Crea il renderer
        this.renderer = new FMSynthRender(this.instanceId, this);

        // Setup eventi
        this.setupEvents();
    }

    setupAudio() {
        // Carrier (portante)
        this.carrier = this.context.createOscillator();
        this.carrierGain = this.context.createGain();
        
        // Modulator (modulatore)
        this.modulator = this.context.createOscillator();
        this.modGainNode = this.context.createGain();
        
        // Filter chain
        this.filter = this.context.createBiquadFilter();
        
        // Setup iniziale nodi
        this.carrier.type = 'sawtooth';
        this.modulator.type = 'sine';
        this.filter.type = 'lowpass';
        this.filter.Q.value = 8.0;
        
        // Imposta tutti i gain a 0 inizialmente
        this.carrierGain.gain.value = 0;
        this.modGainNode.gain.value = 0;
        
        // Collegamenti FM
        this.modulator.connect(this.modGainNode);
        this.modGainNode.connect(this.carrier.frequency);
        this.carrier.connect(this.carrierGain);
        this.carrierGain.connect(this.filter);
        this.filter.connect(this.instrumentOutput);
        
        // Feedback path
        this.feedbackGain = this.context.createGain();
        this.feedbackDelay = this.context.createDelay(0.01);
        this.modulator.connect(this.feedbackGain);
        this.feedbackGain.connect(this.feedbackDelay);
        this.feedbackDelay.connect(this.modulator.frequency);
        this.feedbackGain.gain.value = 0;

        // Sub oscillator
        this.subOsc = this.context.createOscillator();
        this.subOscGain = this.context.createGain();
        this.subOsc.connect(this.subOscGain);
        this.subOscGain.connect(this.filter);
        this.subOscGain.gain.value = 0; // Imposta il gain del sub a 0

        // Start oscillators
        this.carrier.start();
        this.modulator.start();
        this.subOsc.start();

        // Setup valori iniziali del filtro
        this.filter.frequency.value = this.calculateCutoffFrequency(this.parameters.cutoff);

        // Aggiungi nodi per gli effetti
        this.stereoSpread = this.context.createStereoPanner();
        this.bitCrusher = this.createBitCrusher();
        this.ringModulator = this.createRingModulator();
        this.foldbackDistortion = this.createFoldbackDistortion();
        
        // Modifica la catena audio
        this.carrier.connect(this.carrierGain);
        this.carrierGain.connect(this.filter);
        this.filter.connect(this.bitCrusher);
        this.bitCrusher.connect(this.ringModulator);
        this.ringModulator.connect(this.foldbackDistortion);
        this.foldbackDistortion.connect(this.stereoSpread);
        this.stereoSpread.connect(this.instrumentOutput);
    }

    setupEvents() {
        this.renderer.setParamChangeCallback((param, value) => {
            this.updateParameter(param, value);
        });

        this.renderer.setSequenceChangeCallback((index, data) => {
            this.sequence[index] = data;
        });
    }

    applyADSR(param, time, adsr, minValue, maxValue, curve = 1) {
        const { a, d, s, r } = adsr;
        const sustainValue = minValue + (maxValue - minValue) * s;
        
        // Reset e cancella valori precedenti
        param.cancelScheduledValues(time);
        param.setValueAtTime(minValue, time);

        // Attack fase
        if (a > 0) {
            param.linearRampToValueAtTime(maxValue, time + a);
        } else {
            param.setValueAtTime(maxValue, time);
        }

        // Decay e Sustain fase
        if (d > 0) {
            this.applyCurvedRamp(param, time + a, d, maxValue, sustainValue, curve);
        } else {
            param.setValueAtTime(sustainValue, time + a);
        }

        // Release fase
        const gateTime = 0.1; // Tempo di gate fisso per il sequencer
        const releaseStart = time + a + d + gateTime;
        
        if (r > 0) {
            this.applyCurvedRamp(param, releaseStart, r, sustainValue, minValue, curve);
        } else {
            param.setValueAtTime(minValue, releaseStart);
        }
    }

    applyCurvedRamp(param, startTime, duration, startValue, endValue, curve) {
        const steps = 20;
        const timeStep = duration / steps;
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const curvedT = Math.pow(t, curve);
            const value = startValue + (endValue - startValue) * curvedT;
            
            // Previeni valori non validi
            const safeValue = Math.max(0.0001, value);
            param.setValueAtTime(safeValue, startTime + timeStep * i);
        }
    }

    getNoteFrequency(note) {
        if (!note) return null;
        
        const notes = {'C':0,'C#':1,'D':2,'D#':3,'E':4,'F':5,'F#':6,'G':7,'G#':8,'A':9,'A#':10,'B':11};
        const [pitch, octave] = [note.slice(0,-1), parseInt(note.slice(-1))];
        return 440 * Math.pow(2, (notes[pitch] + (octave - 4) * 12) / 12);
    }

    updateModulation() {
        if (!this.modulator || !this.modGainNode) return;

        const now = this.context.currentTime;
        
        // Calcola parametri FM
        const baseFreq = this.currentFrequency || 440;
        const ratio = this.parameters.modRatio;
        const harmonicity = this.parameters.harmonicity;
        
        // Calcola frequenza del modulatore
        const modFreq = baseFreq * ratio * harmonicity;
        
        // Applica detune
        const detuneInCents = this.parameters.modDetune;
        const detuneRatio = Math.pow(2, detuneInCents / 1200);
        const finalModFreq = modFreq * detuneRatio;
        
        // Calcola profondità di modulazione
        const depth = this.parameters.modDepth;
        const modIndex = baseFreq * depth * this.parameters.modIndex;
        
        // Applica i parametri
        if (isFinite(finalModFreq) && finalModFreq > 0) {
            this.modulator.frequency.setValueAtTime(finalModFreq, now);
        }
        if (isFinite(modIndex) && modIndex >= 0) {
            this.modGainNode.gain.setValueAtTime(modIndex, now);
        }
        
        // Aggiorna il feedback
        const feedbackAmount = this.parameters.feedback * 1000;
        this.feedbackGain.gain.setValueAtTime(feedbackAmount, now);
    }

    generateRandomPattern(length = 32, key = 'C') {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const startIndex = notes.indexOf(key);
        const reorderedNotes = [...notes.slice(startIndex), ...notes.slice(0, startIndex)];
        
        return Array(length).fill().map(() => {
            if (Math.random() < 0.7) {
                return {
                    note: reorderedNotes[Math.floor(Math.random() * 5)] + 
                          (Math.random() < 0.7 ? '3' : '4'),
                    accent: Math.random() < 0.3,
                    slide: Math.random() < 0.2
                };
            }
            return { note: '', accent: false, slide: false };
        });
    }

    updateParameter(param, value) {
        this.parameters[param] = value;

        // Aggiungi i nuovi parametri ADSR
        const adsrParams = [
            'ampAttack', 'ampDecay', 'ampSustain', 'ampRelease',
            'filterAttack', 'filterDecay', 'filterSustain', 'filterRelease',
            'modAttack', 'modDecay', 'modSustain', 'modRelease',
            'ampCurve', 'filterCurve', 'modCurve'
        ];

        if (adsrParams.includes(param)) {
            // Non serve fare nulla qui, i valori verranno usati alla prossima nota
            return;
        }

        switch(param) {
            case 'cutoff':
                // Usa il nuovo metodo anche qui
                const freq = this.calculateCutoffFrequency(value);
                this.filter.frequency.value = freq;
                break;
            case 'resonance':
                this.filter.Q.value = value * 30;
                break;
            case 'modDepth':
            case 'modRatio':
            case 'modDetune':
            case 'modPhase':
            case 'modIndex':
            case 'harmonicity':
                this.updateModulation();
                break;
            case 'waveform':
                this.carrier.type = value;
                this.renderer?.updateWaveformSelection('carrier', value);
                break;
            case 'modShape':
                this.modulator.type = value;
                this.renderer?.updateWaveformSelection('modulator', value);
                break;
            case 'feedback':
                this.feedbackGain.gain.setTargetAtTime(value * 100, this.context.currentTime, 0.01);
                break;
            case 'subOscLevel':
                this.subOscGain.gain.setTargetAtTime(value, this.context.currentTime, 0.01);
                break;
            case 'subOscShape':
                this.subOsc.type = value;
                this.renderer?.updateWaveformSelection('sub', value);
                break;
            case 'bitcrush':
                const bits = Math.floor(value * 15) + 1; // 1-16 bits
                this.parameters.bitcrush = bits;
                // Il valore verrà applicato nel prossimo ciclo di processamento
                break;
                
            case 'ringMod':
                if (this.ringModulator) {
                    this.ringModulator.gain.setTargetAtTime(value, this.context.currentTime, 0.01);
                }
                break;
                
            case 'foldback':
                const thresh = Math.max(0.1, value); // Previeni valori troppo bassi
                if (this.foldbackDistortion) {
                    const curve = new Float32Array(44100);
                    for (let i = 0; i < 44100; i++) {
                        let x = (i * 2) / 44100 - 1;
                        if (x > thresh || x < -thresh) {
                            x = ((Math.abs(x) - thresh) % (2 * thresh)) * (x < 0 ? -1 : 1);
                        }
                        curve[i] = x;
                    }
                    this.foldbackDistortion.curve = curve;
                }
                break;
                
            case 'carrierSpread':
                if (this.stereoSpread) {
                    this.stereoSpread.pan.setValueAtTime((value - 0.5) * 2, this.context.currentTime);
                }
                break;
        }

        // Gestione parametri LFO
        if (param.startsWith('lfo')) {
            const lfoNumber = param.charAt(3);
            this.parameters[param] = value;
            this.updateLFO(parseInt(lfoNumber));
        }
    }

    calculateCutoffFrequency(normalizedValue) {
        // Assicurati che il valore sia valido e limitato tra 0 e 1
        const safeValue = Math.max(0, Math.min(1, normalizedValue));
        
        // Usa scala logaritmica per una risposta più musicale
        const minFreq = 20;    // 20 Hz
        const maxFreq = 20000; // 20 kHz
        
        try {
            // Formula: minFreq * (maxFreq/minFreq)^normalizedValue
            const freq = minFreq * Math.pow(maxFreq/minFreq, safeValue);
            return Math.min(Math.max(20, freq), 20000); // Limita tra 20Hz e 20kHz
        } catch (error) {
            console.error('Error calculating cutoff:', error);
            return 1000; // Valore di fallback sicuro
        }
    }

    createBitCrusher() {
        // Crea un nodo ScriptProcessor per il bitcrushing
        const bufferSize = 4096;
        const crusher = this.context.createScriptProcessor(bufferSize, 1, 1);
        let bits = 16; // Default a 16 bit
        
        crusher.onaudioprocess = (e) => {
            const input = e.inputBuffer.getChannelData(0);
            const output = e.outputBuffer.getChannelData(0);
            const step = Math.pow(0.5, bits);
            
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.floor(input[i] / step) * step;
            }
        };

        return crusher;
    }

    createRingModulator() {
        // Crea un oscillatore e un gain per la ring modulation
        const modOsc = this.context.createOscillator();
        const modGain = this.context.createGain();
        
        modOsc.frequency.value = 100; // Frequenza base
        modOsc.type = 'sine';
        modGain.gain.value = 0; // Start disabilitato
        
        modOsc.connect(modGain);
        modOsc.start();
        
        return modGain;
    }

    createFoldbackDistortion() {
        // Crea un nodo per la foldback distortion
        const foldback = this.context.createWaveShaper();
        const threshold = 0.5;
        
        const curve = new Float32Array(44100);
        for (let i = 0; i < 44100; i++) {
            let x = (i * 2) / 44100 - 1;
            if (x > threshold || x < -threshold) {
                x = ((Math.abs(x) - threshold) % (2 * threshold)) * (x < 0 ? -1 : 1);
            }
            curve[i] = x;
        }
        
        foldback.curve = curve;
        return foldback;
    }

    setupLFOs() {
        // LFO 1
        this.createLFO(1);
        this.createLFO(2);
        
        // Imposta i valori iniziali
        this.updateLFO(1);
        this.updateLFO(2);
    }

    createLFO(number) {
        const lfo = this.context.createOscillator();
        const gain = this.context.createGain();
        lfo.connect(gain);
        gain.gain.value = 0;
        lfo.start();

        if (number === 1) {
            this.lfo1 = lfo;
            this.lfo1Gain = gain;
        } else {
            this.lfo2 = lfo;
            this.lfo2Gain = gain;
        }
    }

    updateLFO(lfoNumber) {
        const lfo = lfoNumber === 1 ? this.lfo1 : this.lfo2;
        const lfoGain = lfoNumber === 1 ? this.lfo1Gain : this.lfo2Gain;
        const params = lfoNumber === 1 ? 
            { rate: this.parameters.lfo1Rate, depth: this.parameters.lfo1Depth, 
              shape: this.parameters.lfo1Shape, sync: this.parameters.lfo1Sync, 
              target: this.parameters.lfo1Target, division: this.parameters.lfo1Division } :
            { rate: this.parameters.lfo2Rate, depth: this.parameters.lfo2Depth, 
              shape: this.parameters.lfo2Shape, sync: this.parameters.lfo2Sync, 
              target: this.parameters.lfo2Target, division: this.parameters.lfo2Division };

        // Disconnetti vecchie connessioni
        lfoGain.disconnect();

        // Imposta forma d'onda
        lfo.type = params.shape;

        // Calcola e imposta la frequenza con maggiore precisione
        const now = this.context.currentTime;
        if (params.sync) {
            const bpm = this.parameters.tempo;
            const divisionMap = {
                '1/1': 1/16,  // Una battuta completa (4/4)
                '1/2': 1/8,   // Mezza battuta
                '1/4': 1/4,   // Un quarto
                '1/8': 1/2,   // Un ottavo
                '1/16': 1,    // Un sedicesimo
                '1/32': 2     // Un trentaduesimo
            };
            
            // Calcola la frequenza in Hz per la divisione ritmica
            const beatsPerSecond = bpm / 60;
            const freq = beatsPerSecond * divisionMap[params.division];
            
            // Non fermare/riavviare l'oscillatore, usa setValueAtTime
            lfo.frequency.setValueAtTime(freq, now);
            
            console.log(`LFO ${lfoNumber} sync - BPM: ${bpm}, Division: ${params.division}, Freq: ${freq}Hz`);
        } else {
            // Modalità free-running
            const freeRunningFreq = params.rate * 20; // 0-20Hz range
            lfo.frequency.setValueAtTime(freeRunningFreq, now);
        }

        // Gestione target e depth
        const target = this.lfoTargets[params.target];
        if (target) {
            const depth = this.calculateLFODepth(params.target, params.depth);
            lfoGain.gain.setValueAtTime(depth, now);
            lfoGain.connect(target);
        }
    }

    calculateLFODepth(target, normalizedDepth) {
        const depthMap = {
            cutoff: 5000,     // Aumentato per effetto più evidente
            modDepth: 2000,   // Aumentato
            pitch: 400,       // Aumentato
            resonance: 30,    // Aumentato
            pan: 1,           // Pan rimane uguale
            feedback: 1000    // Aumentato
        };
        return (depthMap[target] || 1) * normalizedDepth;
    }

    cleanup() {
        this.carrier?.stop();
        this.modulator?.stop();
        this.carrier?.disconnect();
        this.modulator?.disconnect();
        this.filter?.disconnect();
        this.carrierGain?.disconnect();
        this.modGainNode?.disconnect();
        this.stereoSpread?.disconnect();
        this.bitCrusher?.disconnect();
        this.ringModulator?.disconnect();
        this.foldbackDistortion?.disconnect();
        this.lfo1?.stop();
        this.lfo2?.stop();
        this.lfo1?.disconnect();
        this.lfo2?.disconnect();
        this.lfo1Gain?.disconnect();
        this.lfo2Gain?.disconnect();
        if (this.lfo1) {
            this.lfo1.stop();
            this.lfo1.disconnect();
            this.lfo1 = null;
        }
        if (this.lfo2) {
            this.lfo2.stop();
            this.lfo2.disconnect();
            this.lfo2 = null;
        }
        if (this.lfo1Gain) {
            this.lfo1Gain.disconnect();
            this.lfo1Gain = null;
        }
        if (this.lfo2Gain) {
            this.lfo2Gain.disconnect();
            this.lfo2Gain = null;
        }
    }

    onBeat(beat, time) {
        const stepIndex = beat % 32;
        const step = this.sequence[stepIndex];
        
        if (!step?.note) return;

        const frequency = this.getNoteFrequency(step.note);
        if (frequency) {
            this.playNote(frequency, time, step.accent, step.slide);
        }

        this.renderer.highlightStep?.(stepIndex);

        // Resetta la fase degli LFO sul primo beat della battuta
        if (beat % 16 === 0) {  // Assumendo una battuta di 4/4 con 16 step
            if (this.parameters.lfo1Sync) this.updateLFO(1);
            if (this.parameters.lfo2Sync) this.updateLFO(2);
        }
    }

    playNote(frequency, time, accent = false, slide = false) {
        const now = time || this.context.currentTime;
        this.currentFrequency = frequency;

        // Reset tutti i valori prima della nota
        this.carrierGain.gain.cancelScheduledValues(now);
        this.modGainNode.gain.cancelScheduledValues(now);
        this.subOscGain.gain.cancelScheduledValues(now);
        this.filter.frequency.cancelScheduledValues(now);

        // Applica gli ADSR
        this.applyADSR(this.carrierGain.gain, now, {
            a: this.parameters.ampAttack,
            d: this.parameters.ampDecay,
            s: this.parameters.ampSustain,
            r: this.parameters.ampRelease
        }, 0, this.parameters.carrierGain * (accent ? 1.5 : 1), this.parameters.ampCurve);

        // ADSR per il filtro
        const baseFreq = this.calculateCutoffFrequency(this.parameters.cutoff);
        const maxFreq = this.calculateCutoffFrequency(1.0);
        this.applyADSR(this.filter.frequency, now, {
            a: this.parameters.filterAttack,
            d: this.parameters.filterDecay,
            s: this.parameters.filterSustain,
            r: this.parameters.filterRelease
        }, baseFreq, maxFreq, this.parameters.filterCurve);

        // ADSR per il modulatore
        this.applyADSR(this.modGainNode.gain, now, {
            a: this.parameters.modAttack,
            d: this.parameters.modDecay,
            s: this.parameters.modSustain,
            r: this.parameters.modRelease
        }, 0, this.parameters.modDepth * frequency, this.parameters.modCurve);

        // Gestione frequenze e slide
        if (slide && this.lastNoteFrequency) {
            const slideTime = 0.1;
            this.carrier.frequency.linearRampToValueAtTime(frequency, now + slideTime);
            this.modulator.frequency.linearRampToValueAtTime(
                frequency * this.parameters.harmonicity, now + slideTime);
            this.subOsc.frequency.linearRampToValueAtTime(frequency / 2, now + slideTime);
        } else {
            this.carrier.frequency.setValueAtTime(frequency, now);
            this.modulator.frequency.setValueAtTime(
                frequency * this.parameters.harmonicity, now);
            this.subOsc.frequency.setValueAtTime(frequency / 2, now);

            // Phase reset se non c'è slide
            if (this.parameters.modSync) {
                const phase = this.parameters.modPhase * Math.PI * 2;
                this.modulator.phase = phase;
            }
        }

        this.lastNoteFrequency = frequency;
        this.updateModulation();
    }

    getEnvelopeState(param) {
        const env = this.envelopes?.[param];
        return {
            active: env?.active || false,
            points: env?.points || [],
            length: env?.length || 1
        };
    }
}
