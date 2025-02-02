import { AbstractInstrument } from "../../abstract/AbstractInstrument.js";
import { TB303Render } from "./TB303Render.js";
import { MIDIMapping } from "../../../core/MIDIMapping.js";  // Aggiungi questa riga

class Envelope {
    constructor() {
        this.points = [];
        this.length = 1;
        this.active = false;
    }
}

export class TB303 extends AbstractInstrument {
    constructor(context) {
        super(context);
        
        // Inizializza prima l'ID e le chiavi
        this.instanceId = 'tb303_' + Date.now();
        this.envelopeStorageKey = `tb303_envelopes_${this.instanceId}`;
        
        // Inizializza i parametri PRIMA di creare il renderer
        this.parameters = {
            cutoff: 0.5,
            resonance: 0.7,
            decay: 0.2,
            envMod: 0.5,
            distortion: 0.3,
            slideTime: 0.055,
            minDecayTime: 0.03,
            maxDecayTime: 0.8,
            accent: 0.5,
            glide: 0.5,
            octave: 0,
            tempo: 120
        };

        // Setup audio dopo i parametri ma prima del renderer
        this.setupAudio();
        
        // Inizializza altre proprietà necessarie
        this.sequence = Array(32).fill().map(() => ({
            note: null,
            accent: false,
            slide: false,
            gate: false
        }));
        
        this.currentNoteTime = 0;
        this.decayTime = this.parameters.decay * 0.5 + 0.1;
        this.envModAmount = this.parameters.envMod;
        this.slideTime = this.parameters.slideTime;
        this.lastNoteFrequency = null;
        
        // Inizializza gli inviluppi
        this.setupEnvelopes();
        this.lastModulationTime = 0;
        this.modulationStartTime = 0;
        
        // MIDI mapping
        this.midiMapping = new MIDIMapping();

        // Ora che tutto è inizializzato, crea il renderer
        this.renderer = new TB303Render(this.instanceId, this);
        
        // Setup degli eventi dopo che il renderer è stato creato
        this.setupEvents();
        
        // Carica gli inviluppi salvati
        this.loadEnvelopes();
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
        
        this.parameters = {
            cutoff: 0.5,
            resonance: 0.7,
            decay: 0.2,
            envMod: 0.5,
            distortion: 0.3,
            slideTime: 0.055,
            minDecayTime: 0.03,  // Tempo minimo di decay
            maxDecayTime: 0.8,   // Tempo massimo di decay
            octave: 0            // Aggiunto parametro ottava
        };
    }

    // Nuovo metodo per calcolare la frequenza del filtro
    calculateCutoffFrequency(normalizedValue) {
        // Assicurati che il valore sia valido e limitato
        const safeValue = Math.max(0, Math.min(1, normalizedValue));
        try {
            const freq = Math.exp(Math.log(20) + safeValue * Math.log(20000 / 20));
            return Math.min(Math.max(20, freq), 20000); // Limita tra 20Hz e 20kHz
        } catch (error) {
            console.error('Error calculating cutoff:', error);
            return 1000; // Valore di fallback sicuro
        }
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

        this.processEnvelopes(time);
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
        this.renderer.setParameterChangeCallback((param, value, callback) => {
            // Gestione richiesta stato inviluppo
            if (param.startsWith('get') && param.endsWith('Envelope')) {
                const baseParam = param.replace(/^get|Envelope$/g, '').toLowerCase();
                if (callback && typeof callback === 'function') {
                    callback(this.getEnvelopeState(baseParam));
                }
                return;
            }
    
            // Gestione update inviluppo
            if (param.endsWith('Envelope')) {
                const baseParam = param.replace('Envelope', '');
                console.log('Attivando modulazione per:', baseParam, value);
                this.updateEnvelope(
                    baseParam, 
                    value
                );
                return;
            }
    
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
                case 'octave':
                    // Il renderer gestisce già la trasposizione delle note
                    // Qui non serve fare nulla perché le note vengono già 
                    // trasposte quando vengono inviate attraverso sequenceChangeCallback
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
        try {
            const freq = this.getNoteFrequency(note);
            // Verifica che la frequenza sia valida
            if (!isFinite(freq) || freq <= 0) {
                console.warn('Invalid frequency:', freq, 'for note:', note);
                return;
            }
    
            const baseTime = time || this.context.currentTime;
            if (!isFinite(baseTime)) {
                console.warn('Invalid time:', baseTime);
                return;
            }
    
            // Reset scheduled values if not sliding
            if (!slide) {
                this.clearScheduledValues(baseTime);
            }
        
            // Set oscillator frequency
            if (slide && this.lastNoteFrequency) {
                const slideTime = this.slideTime * (this.envelopes.glide?.lastValue || 1);
                if (isFinite(slideTime) && slideTime > 0) {
                    this.osc.frequency.linearRampToValueAtTime(freq, baseTime + slideTime);
                } else {
                    this.osc.frequency.setValueAtTime(freq, baseTime);
                }
            } else {
                this.osc.frequency.setValueAtTime(freq, baseTime);
            }
        
            this.lastNoteFrequency = freq;
        
            // Validate modifiers
            const accentMod = accent ? 2 : 1;
            const envAmount = Math.max(0, Math.min(10, this.envModAmount * accentMod));
            
            const baseDecayTime = Math.max(0.001, this.decayTime);
            const accentedDecayTime = accent ? baseDecayTime * 1.2 : baseDecayTime;
            const finalDecayTime = Math.max(this.parameters.minDecayTime, 
                                          Math.min(accentedDecayTime, this.parameters.maxDecayTime));
            
            const attackTime = 0.003;
            
            // Ensure all values are valid before scheduling
            if (isFinite(baseTime) && isFinite(attackTime) && isFinite(finalDecayTime)) {
                // Amplitude envelope
                this.vca.gain.cancelScheduledValues(baseTime);
                this.vca.gain.setValueAtTime(0, baseTime);
                this.vca.gain.linearRampToValueAtTime(
                    Math.min(0.8 * accentMod, 1), 
                    baseTime + attackTime
                );
                this.vca.gain.setTargetAtTime(0.0001, baseTime + attackTime, finalDecayTime / 3);
            
                // Filter envelope
                const baseFreq = this.calculateCutoffFrequency(this.parameters.cutoff);
                if (isFinite(baseFreq)) {
                    const maxFreq = Math.min(baseFreq * (1 + envAmount * 4), 20000);
                    
                    this.filter.frequency.cancelScheduledValues(baseTime);
                    this.filter.frequency.setValueAtTime(baseFreq, baseTime);
                    this.filter.frequency.linearRampToValueAtTime(maxFreq, baseTime + attackTime);
                    this.filter.frequency.setTargetAtTime(
                        baseFreq, 
                        baseTime + attackTime, 
                        finalDecayTime / 4
                    );
                }
            
                // Accent gain
                const accentGainValue = Math.min(accent ? 1.4 : 1, 2);
                this.accentGain.gain.setTargetAtTime(accentGainValue, baseTime, 0.005);
            }
        } catch (error) {
            console.error('Error in playNote:', error, {
                note, time, accent, slide,
                currentTime: this.context.currentTime
            });
        }
    }

    setupEnvelopes() {
        this.envelopes = {
            cutoff: new Envelope(),
            resonance: new Envelope(),
            envMod: new Envelope(),
            decay: new Envelope(),
            accent: new Envelope(),
            distortion: new Envelope(),
            glide: new Envelope()
        };
    }

    updateEnvelope(param, data) {
        if (!this.envelopes[param]) {
            this.envelopes[param] = new Envelope();
        }
        
        const env = this.envelopes[param];
        
        // Gestisci lo stato active
        if (typeof data.active === 'boolean') {
            env.active = data.active;
            
            if (!data.active) {
                // Quando disattiviamo l'envelope:
                env.points = [];          // Rimuovi i punti
                env.length = 1;          // Reset della lunghezza
                // Ripristina il valore originale del parametro
                this.setParam(param, this.parameters[param]);
                this.modulationStartTime = 0;  // Reset del tempo di modulazione
                return;
            }
        }
    
        // Aggiorna i punti solo se l'envelope è attivo
        if (env.active && Array.isArray(data.points)) {
            env.points = data.points
                .filter(p => p && typeof p.time === 'number' && typeof p.value === 'number')
                .map(p => ({
                    time: Math.max(0, Math.min(1, parseFloat(p.time))),
                    value: Math.max(0, Math.min(1, parseFloat(p.value)))
                }))
                .sort((a, b) => a.time - b.time);
    
            if (data.length && data.length > 0) {
                env.length = parseFloat(data.length);
            }
    
            // Resetta il tempo di inizio quando aggiungiamo nuovi punti
            this.modulationStartTime = this.context.currentTime;
        }
    }
    
    processEnvelopes(time) {
        if (!time) return;
    
        Object.entries(this.envelopes).forEach(([param, env]) => {
            if (!env.active || !env.points || env.points.length < 2) return;
    
            try {
                // Usa il tempo assoluto dell'AudioContext per la modulazione
                const absoluteTime = this.context.currentTime;
                const tempo = this.parameters.tempo || 120;
                const cycleDuration = env.length * 4 * 60 / tempo;
                
                // Calcola la posizione nel ciclo usando il tempo assoluto
                const cyclePosition = ((absoluteTime - this.modulationStartTime) % cycleDuration) / cycleDuration;
    
                // Ordina i punti e assicurati che ci sia sempre un punto a 0 e 1
                let points = [...env.points].sort((a, b) => a.time - b.time);
                
                // Trova i punti di inizio e fine per l'interpolazione
                let startPoint = points[points.length - 1];
                let endPoint = points[0];
    
                // Trova i punti corretti per la posizione attuale
                for (let i = 0; i < points.length - 1; i++) {
                    if (cyclePosition >= points[i].time && cyclePosition < points[i + 1].time) {
                        startPoint = points[i];
                        endPoint = points[i + 1];
                        break;
                    }
                }
    
                // Se siamo oltre l'ultimo punto, collega all'inizio del ciclo successivo
                if (cyclePosition > points[points.length - 1].time) {
                    startPoint = points[points.length - 1];
                    endPoint = points[0];
                    // Aggiusta la posizione per l'interpolazione tra fine e inizio
                    const adjustedPosition = (cyclePosition - startPoint.time) / (1 - startPoint.time);
                    const value = this.interpolateValue(startPoint.value, endPoint.value, adjustedPosition);
                    this.setParam(param, value);
                } else {
                    // Interpolazione normale
                    const segmentDuration = endPoint.time - startPoint.time;
                    const segmentPosition = segmentDuration <= 0 ? 0 : 
                        (cyclePosition - startPoint.time) / segmentDuration;
                    const value = this.interpolateValue(startPoint.value, endPoint.value, segmentPosition);
                    this.setParam(param, value);
                }
    
                if (this.debug) {
                    console.log(`Envelope ${param}:`, {
                        absoluteTime,
                        cyclePosition,
                        value: this.parameters[param],
                        startPoint,
                        endPoint
                    });
                }
    
            } catch (error) {
                console.error('Error in envelope processing:', error);
            }
        });
    }
    

    interpolateValue(start, end, pos) {
        // Assicurati che pos sia tra 0 e 1
        pos = Math.max(0, Math.min(1, pos));
        
        // Interpolazione con curva esponenziale per transizioni più musicali
        const curve = 0.4;
        pos = Math.pow(pos, curve) / (Math.pow(pos, curve) + Math.pow(1 - pos, curve));
        
        return start + (end - start) * pos;
    }

    setParam(param, value) {
        if (!isFinite(value)) return;
        
        // Limita il valore tra 0 e 1
        value = Math.max(0, Math.min(1, value));
        
        // Aggiorna il parametro interno
        this.parameters[param] = value;

        // Applica il valore immediatamente
        const now = this.context.currentTime;
        
        switch(param) {
            case 'cutoff':
                const freq = this.calculateCutoffFrequency(value);
                this.filter.frequency.setValueAtTime(freq, now);
                break;
            case 'resonance':
                this.filter.Q.setValueAtTime(value * 30, now);
                break;
            case 'envMod':
                this.envModAmount = value * 2;
                break;
            case 'decay':
                this.decayTime = this.parameters.minDecayTime +
                    Math.pow(value, 2) * (this.parameters.maxDecayTime - this.parameters.minDecayTime);
                break;
            case 'accent':
                this.accentGain.gain.setValueAtTime(0.7 + (value * 0.6), now);
                break;
            case 'distortion':
                this.updateDistortion(value);
                break;
            case 'glide':
                this.slideTime = value * 0.2;
                break;
        }

        // Aggiorna l'UI (throttled)
        if (!this.lastUIUpdate || Date.now() - this.lastUIUpdate > 16) {
            requestAnimationFrame(() => {
                this.renderer?.updateKnobValue?.(param, value);
            });
            this.lastUIUpdate = Date.now();
        }
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

    loadEnvelopes() {
        try {
            const savedEnvelopes = localStorage.getItem(this.envelopeStorageKey);
            if (savedEnvelopes) {
                const parsed = JSON.parse(savedEnvelopes);
                parsed.forEach((env, param) => {
                    if (this.envelopes.has(param)) {
                        this.envelopes[param].points = env.points;
                        this.envelopes[param].length = env.length;
                        this.envelopes[param].active = env.active;
                    }
                });
            }
        } catch (error) {
            console.warn('Failed to load envelopes:', error);
        }
    }

    saveEnvelopes() {
        try {
            const envelopesToSave = Object.keys(this.envelopes)
                .filter(param => this.envelopes[param].active)
                .map(param => ({
                    param,
                    points: this.envelopes[param].points,
                    length: this.envelopes[param].length,
                    active: this.envelopes[param].active
                }));
            localStorage.setItem(this.envelopeStorageKey, JSON.stringify(envelopesToSave));
        } catch (error) {
            console.warn('Failed to save envelopes:', error);
        }
    }

    // Aggiungi un metodo per resettare gli inviluppi
    resetEnvelopes() {
        Object.values(this.envelopes).forEach(env => {
            env.active = false;
            env.points = [];
        });
        localStorage.removeItem(this.envelopeStorageKey);
    }

    // Metodo per ottenere lo stato di un inviluppo
    getEnvelopeState(param) {
        const env = this.envelopes[param];
        if (!env) {
            return {
                active: false,
                points: [],
                length: 1
            };
        }
        
        return {
            active: env.active,
            points: env.points || [], // Non clonare l'array per mantenere i riferimenti
            length: env.length || 1
        };
    }

    // Sostituisci onMIDIMessage con handleInstrumentMIDI
    handleInstrumentMIDI(message) {
        const result = this.midiMapping.handleMIDIMessage(message);
        console.log('TB303 MIDI result:', result, 'from message:', message.data);
        
        if (result.mapped) {
            if (result.trigger && result.param?.startsWith('pattern')) {
                // Estrai il numero dal nome del pattern (pattern1 -> 1)
                const patternNum = result.param.replace('pattern', '');
                console.log('Loading pattern from MIDI:', patternNum);
                
                // Prima attiva visualmente il pulsante
                const buttons = this.renderer.container.querySelectorAll('.memory-btn');
                buttons.forEach(btn => btn.classList.remove('active'));
                
                const selectedBtn = this.renderer.container.querySelector(`.memory-btn[data-slot="${patternNum}"]`);
                if (selectedBtn) {
                    selectedBtn.classList.add('active');
                }

                // Forza il caricamento del pattern
                this.renderer.loadPattern(patternNum);
                console.log('Pattern loaded:', patternNum);
            } else if (!result.param?.startsWith('pattern')) {
                // Gestisci i controlli normali (non pattern)
                this.updateParameter(result.param, result.value);
                this.renderer.updateKnobValue(result.param, result.value);
            }
        }
    }

    // Aggiungi questo nuovo metodo
    updateParameter(param, value) {
        if (!this.parameters[param]) return;
        
        this.parameters[param] = value;
        
        switch(param) {
            case 'cutoff':
                const freq = this.calculateCutoffFrequency(value);
                this.filter.frequency.setValueAtTime(freq, this.context.currentTime);
                break;
            case 'resonance':
                this.filter.Q.value = value * 30;
                break;
            case 'envMod':
                this.envModAmount = value * 2;
                break;
            case 'decay':
                this.decayTime = this.parameters.minDecayTime + 
                    Math.pow(value, 2) * (this.parameters.maxDecayTime - this.parameters.minDecayTime);
                break;
            case 'accent':
                this.accentGain.gain.value = 0.7 + (value * 0.6);
                break;
            case 'distortion':
                this.updateDistortion(value);
                break;
            case 'glide':
                this.slideTime = value * 0.2;
                break;
            case 'octave':
                // Limita il valore tra -2 e 2
                const octaveValue = Math.round(value * 4) - 2;
                this.parameters.octave = octaveValue;
                if (this.renderer) {
                    this.renderer.currentOctaveShift = octaveValue;
                    this.renderer.updateSequenceOctaves();
                }
                break;
        }
    }

    // Aggiungi questo metodo per gestire il ripristino delle mappature MIDI
    restoreMIDIMappings(mappings) {
        if (this.midiMapping && mappings) {
            this.midiMapping.setMappings(mappings);
        }
    }
}