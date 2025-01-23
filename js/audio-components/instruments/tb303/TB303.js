import { AbstractInstrument } from "../../abstract/AbstractInstrument.js";
import { TB303Render } from "./TB303Render.js";

export class TB303 extends AbstractInstrument {
    constructor(context) {
        super(context);
        // Aggiungi ID univoco
        this.instanceId = 'tb303_' + Date.now();
        // Aggiungi una chiave unica per salvare gli inviluppi
        this.envelopeStorageKey = `tb303_envelopes_${this.instanceId}`;
        // Passa l'ID al renderer
        this.renderer = new TB303Render(this.instanceId);
        
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
            maxDecayTime: 0.8,    // Tempo massimo di decay
            accent: 0.5,        // Aggiunto
            glide: 0.5,        // Aggiunto
            octave: 0,
            tempo: 120         // Aggiunto
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

        // Aggiungi gestione degli inviluppi
        this.envelopes = new Map();
        this.modulationLength = 1; // Lunghezza base in misure
        this.setupModulationEnvelopes();
        this.lastModulationTime = 0;
        this.modulationStartTime = 0;

        // Inizializza gli inviluppi dall'eventuale storage
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

        this.processModulations(time);
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
                this.updateModulation(
                    baseParam, 
                    value.points, 
                    value.length, 
                    value.active !== false
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
                const slideTime = this.slideTime * (this.envelopes.get('glide')?.lastValue || 1);
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

    setupModulationEnvelopes() {
        const parameters = ['cutoff', 'resonance', 'envMod', 'decay', 'accent', 'distortion', 'glide'];  // Aggiunto glide
        
        parameters.forEach(param => {
            this.envelopes.set(param, {
                points: [], // Array di {time, value}
                active: false,
                length: this.modulationLength,
                lastValue: this.parameters[param]
            });
        });
    }

    updateModulation(param, points, length, active = true) {
        console.log('updateModulation:', param, points?.length, length, active);
        const envelope = this.envelopes.get(param);
        if (!envelope) {
            console.warn('No envelope found for:', param);
            return;
        }

        try {
            // Se riceviamo solo l'aggiornamento dello stato active
            if (points === undefined && length === undefined) {
                envelope.active = active;
                // Mantieni tutti gli altri valori invariati
                this.saveEnvelopes();
                return;
            }

            if (!active || points.length === 0) {
                // Reset dell'inviluppo
                envelope.points = [];
                envelope.active = false;
                envelope.lastValue = this.parameters[param]; // Torna al valore base del parametro
                envelope.length = 1;
                
                // Resetta immediatamente il parametro al suo valore di default
                this.applyModulation(param, this.parameters[param], this.context.currentTime);
                
                // Salva lo stato
                this.saveEnvelopes();
                return;
            }

            // Assicurati che i punti siano validi e ordinati
            const formattedPoints = points
                .filter(p => p && isFinite(p.time) && isFinite(p.value))
                .map(p => ({
                    time: Math.max(0, Math.min(1, p.time)),
                    value: Math.max(0, Math.min(1, p.value))
                }))
                .sort((a, b) => a.time - b.time);

            // Aggiungi punti di controllo se necessario
            if (formattedPoints.length === 0) {
                formattedPoints.push({ time: 0, value: 0.5 }, { time: 1, value: 0.5 });
            } else if (formattedPoints.length === 1) {
                formattedPoints.push({ 
                    time: 1, 
                    value: formattedPoints[0].value 
                });
            }

            // Assicurati che ci sia un punto all'inizio e alla fine
            if (formattedPoints[0].time > 0) {
                formattedPoints.unshift({ time: 0, value: formattedPoints[0].value });
            }
            if (formattedPoints[formattedPoints.length - 1].time < 1) {
                formattedPoints.push({
                    time: 1,
                    value: formattedPoints[formattedPoints.length - 1].value
                });
            }

            envelope.points = formattedPoints;
            envelope.length = Math.max(1, length || this.modulationLength);
            envelope.active = true;
            envelope.lastValue = formattedPoints[0].value;

            // Salva l'inviluppo quando viene aggiornato
            this.saveEnvelopes();

            console.log('Envelope updated:', {
                param,
                active: envelope.active,
                points: envelope.points,
                length: envelope.length
            });
        } catch (error) {
            console.error('Error formatting modulation points:', error);
            envelope.active = false;
        }
    }

    processModulations(time) {
        if (!time || !isFinite(time)) return;
    
        // Reset cycle if needed
        if (!this.modulationStartTime || time < this.lastModulationTime) {
            this.modulationStartTime = time;
        }
        this.lastModulationTime = time;
    
        const currentTime = time - this.modulationStartTime;
        
        this.envelopes.forEach((envelope, param) => {
            if (!envelope.active || envelope.points.length < 2) return;
    
            try {
                // Calcola la durata in secondi con protezione da NaN
                const tempo = Math.max(1, this.parameters.tempo || 120); // Protezione da tempo invalido
                const barDuration = (60 / tempo) * 4;
                const modulationDuration = barDuration * Math.max(1, envelope.length || 1);
                
                // Assicurati che currentTime e modulationDuration siano validi
                if (!isFinite(currentTime) || !isFinite(modulationDuration) || modulationDuration <= 0) {
                    console.warn('Invalid timing values:', { currentTime, modulationDuration });
                    return;
                }
    
                // Calcola la posizione nel ciclo con protezione da NaN
                const cyclePosition = ((currentTime % modulationDuration) / modulationDuration) || 0;
                
                // Verifica che cyclePosition sia valido
                if (!isFinite(cyclePosition)) {
                    console.warn('Invalid cycle position:', cyclePosition);
                    return;
                }
    
                // Trova i punti di interpolazione
                const points = envelope.points;
                let startPoint = points[0];
                let endPoint = points[1];
    
                // Trova i punti corretti per l'interpolazione
                for (let i = 0; i < points.length - 1; i++) {
                    if (points[i].time <= cyclePosition && points[i + 1].time > cyclePosition) {
                        startPoint = points[i];
                        endPoint = points[i + 1];
                        break;
                    }
                }
    
                // Se siamo oltre l'ultimo punto, interpola tra l'ultimo e il primo
                if (cyclePosition > points[points.length - 1].time) {
                    startPoint = points[points.length - 1];
                    endPoint = points[0];
                }
    
                // Calcola il valore interpolato con protezione da errori
                let interpolatedValue;
                if (endPoint.time <= startPoint.time) {
                    const wrapPosition = Math.max(0, Math.min(1, 
                        (cyclePosition - startPoint.time) / (1 - startPoint.time)
                    ));
                    interpolatedValue = startPoint.value + 
                        (points[0].value - startPoint.value) * wrapPosition;
                } else {
                    const segmentLength = endPoint.time - startPoint.time;
                    if (segmentLength <= 0) {
                        interpolatedValue = startPoint.value;
                    } else {
                        const segmentProgress = (cyclePosition - startPoint.time) / segmentLength;
                        interpolatedValue = startPoint.value + 
                            (endPoint.value - startPoint.value) * segmentProgress;
                    }
                }
    
                // Verifica finale del valore interpolato
                if (isFinite(interpolatedValue)) {
                    const normalizedValue = Math.max(0, Math.min(1, interpolatedValue));
                    this.applyModulation(param, normalizedValue, time);
                } else {
                    console.warn('Invalid interpolation for', param, {
                        startPoint,
                        endPoint,
                        cyclePosition,
                        interpolatedValue
                    });
                }
    
            } catch (error) {
                console.error('Error in modulation processing:', error);
                envelope.active = false;
            }
        });
    }

    applyModulation(param, value, time) {
        if (!isFinite(value) || !isFinite(time)) {
            console.warn('Invalid modulation values:', { param, value, time });
            return;
        }
        const currentTime = time || this.context.currentTime;
        const transitionTime = 0.005; // 5ms di transizione per evitare click
    
        try {
            // Aggiorna il knob visualmente
            requestAnimationFrame(() => {
                this.renderer.updateKnobValue(param, value);
            });

            switch(param) {
                case 'cutoff':
                    const freq = this.calculateCutoffFrequency(value);
                    this.filter.frequency.linearRampToValueAtTime(freq, currentTime + transitionTime);
                    break;
                case 'resonance':
                    this.filter.Q.linearRampToValueAtTime(value * 30, currentTime + transitionTime);
                    break;
                case 'envMod':
                    this.envModAmount = value * 2;
                    break;
                case 'decay':
                    this.decayTime = this.parameters.minDecayTime + 
                        (this.parameters.maxDecayTime - this.parameters.minDecayTime) * value;
                    break;
                case 'accent':
                    this.accentGain.gain.linearRampToValueAtTime(
                        0.7 + (value * 0.6), 
                        currentTime + transitionTime
                    );
                    break;
                case 'distortion':
                    this.updateDistortion(value);
                    break;
                case 'glide':
                    this.slideTime = value * 0.2;
                    break;
            }
        } catch (error) {
            console.error(`Error applying modulation for ${param}:`, error);
        }
    }

    // Aggiungi questo metodo di debug
    logModulationState() {
        this.envelopes.forEach((envelope, param) => {
            console.log(`${param} modulation:`, {
                active: envelope.active,
                points: envelope.points,
                length: envelope.length,
                lastValue: envelope.lastValue
            });
        });
    }

    // Aggiungi questo metodo di supporto
    getInterpolatedValue(startPoint, endPoint, position) {
        if (!startPoint || !endPoint || !isFinite(position)) return null;

        try {
            const segmentProgress = Math.max(0, Math.min(1, position));
            return startPoint.value + (endPoint.value - startPoint.value) * segmentProgress;
        } catch (error) {
            console.error('Interpolation error:', error);
            return null;
        }
    }

    loadEnvelopes() {
        try {
            const savedEnvelopes = localStorage.getItem(this.envelopeStorageKey);
            if (savedEnvelopes) {
                const parsed = JSON.parse(savedEnvelopes);
                parsed.forEach((env, param) => {
                    if (this.envelopes.has(param)) {
                        this.envelopes.get(param).points = env.points;
                        this.envelopes.get(param).length = env.length;
                        this.envelopes.get(param).active = env.active;
                    }
                });
            }
        } catch (error) {
            console.warn('Failed to load envelopes:', error);
        }
    }

    saveEnvelopes() {
        try {
            const envelopesToSave = Array.from(this.envelopes.entries())
                .filter(([_, env]) => env.active)
                .map(([param, env]) => ({
                    param,
                    points: env.points,
                    length: env.length,
                    active: env.active
                }));
            localStorage.setItem(this.envelopeStorageKey, JSON.stringify(envelopesToSave));
        } catch (error) {
            console.warn('Failed to save envelopes:', error);
        }
    }

    // Aggiungi un metodo per resettare gli inviluppi
    resetEnvelopes() {
        this.envelopes.forEach(env => {
            env.active = false;
            env.points = [];
            env.lastValue = null;
        });
        localStorage.removeItem(this.envelopeStorageKey);
    }

    // Metodo per ottenere lo stato di un inviluppo
    getEnvelopeState(param) {
        const env = this.envelopes.get(param);
        if (!env) {
            console.warn('No envelope found for parameter:', param);
            return {
                active: false,
                points: [],
                length: 1
            };
        }
        
        return {
            active: env.active,
            points: [...(env.points || [])], // Crea una copia dell'array
            length: env.length || 1
        };
    }
}