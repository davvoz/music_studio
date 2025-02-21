import { AbstractInstrument } from "../../abstract/AbstractInstrument.js";
import { DrumMachineRender } from "./DrumMachineRender.js";
import { MIDIMapping } from "../../../core/MIDIMapping.js";  // Add this import

export class DrumMachine extends AbstractInstrument {
    constructor(context) {
        super(context);
        
        // Inizializza prima l'ID e il MIDI mapping
        this.instanceId = 'drum_' + Date.now();
        this.midiMapping = new MIDIMapping();

        // Inizializza la sequence
        this.sequence = {
            kick:  Array(128).fill().map(() => ({ active: false, velocity: 1 })),
            snare: Array(128).fill().map(() => ({ active: false, velocity: 1 })),
            hihat: Array(128).fill().map(() => ({ active: false, velocity: 1 })),
            clap:  Array(128).fill().map(() => ({ active: false, velocity: 1 }))
        };

        // Stati di navigazione e pattern
        this.currentBar = 0;      // Bar corrente
        this.playingBar = 0;      // Bar che sta suonando
        this.numBars = 4;         // Default a 4 bars
        this.selectedLength = 128; // 4 bars * 32 steps
        this.isEditMode = true;   // Modalità default è edit

        // Ora crea il renderer passando sia l'ID che l'istanza
        this.renderer = new DrumMachineRender(this.instanceId, this);

        this.drums = {
            kick: { buffer: null },
            snare: { buffer: null },
            hihat: { buffer: null },
            clap: { buffer: null }
        };

        this.parameters = {
            kickVolume: 0.8, snareVolume: 0.7, hihatVolume: 0.6, clapVolume: 0.7,
            kickPitch: 1, snarePitch: 1, hihatPitch: 1, clapPitch: 1
        };

        this.parameterQueue = new Map();
        this.parameterUpdateScheduled = false;

        this.setupAudio();
        this.setupEvents();
        this.loadDefaultSamples();

        // Carica il pattern salvato se esiste
        const lastUsedPattern = localStorage.getItem(`${this.instanceId}-last-pattern`);
        if (lastUsedPattern) {
            this.loadSavedPattern(lastUsedPattern);
        }

        this.selectedLength = 32; // Default a 1 bar (32 steps)
        this.totalBars = 1;      // Default a 1 bar
        this.currentSection = 0;   // Sezione corrente (0-3)
        this.beatCounter = 0;      // Contatore interno dei beat

        // Inizializza MIDI mapping con supporto al salvataggio
        this.midiMapping = new MIDIMapping();

        this.isEditMode = true;    // Modalità default è edit
        this.editingBar = 0;       // Bar che stiamo editando
        this.playingBar = 0;       // Bar che sta suonando

        this.currentBar = 0;     // Bar corrente (sia per edit che play)
        this.numBars = 1;        // Numero di battute (1-4)
        this.isEditMode = true;  // Modalità default è edit

        // Gestione pattern e navigazione
        this.currentBar = 0;     // Bar corrente
        this.numBars = 4;        // Default a 4 bars
        this.isEditMode = true;  // Modalità default è edit
        this.selectedLength = 128; // 4 bars * 32 steps
    }

    setupAudio() {
        for (const drum of Object.keys(this.drums)) {
            this.drums[drum].gain = this.context.createGain();
            this.drums[drum].gain.connect(this.instrumentOutput);
            this.drums[drum].gain.gain.value = this.parameters[`${drum}Volume`];
        }
    }

    setupEvents() {
        this.parameterChangeCallback = async (param, value) => {
            try {
                if (param === 'loadSample') {
                    await this.loadSampleFromFile(value.drum, value.file);
                    return;
                }
                if (param === 'loadPattern') {
                    this.loadSavedPattern(value);
                    return;
                }
                if (param === 'savePattern') {
                    this.saveCurrentPattern(value);
                    return;
                }

                this.parameters[param] = value;
                
                // Applica i cambiamenti immediatamente
                if (param.endsWith('Volume')) {
                    this.updateVolume(param.replace('Volume', ''), value);
                } else if (param.endsWith('Pitch')) {
                    this.updatePitch(param.replace('Pitch', ''), value);
                }

                if (param === 'patternLength') {
                    const steps = parseInt(value);
                    this.selectedLength = steps;
                    this.numBars = steps / 32; // Aggiorna il numero di battute
                    this.currentBar = 0;       // Reset alla prima battuta
                    this.playingBar = 0;       // Reset del playback
                    this.clearPattern();
                    this.renderer.updateView(0, this.numBars);
                }
            } catch (error) {
                console.warn('Parameter change error:', error);
            }
        };

        this.sequenceChangeCallback = (drum, step, active, velocity) => {
            if (!this.sequence[drum]) return;
            this.sequence[drum][step] = { active, velocity: velocity || 1 };
        };

        this.renderer.setParameterChangeCallback(this.parameterChangeCallback);
        this.renderer.setSequenceChangeCallback(this.sequenceChangeCallback);
    }

    updatePitch(drum, value) {
        this.parameters[`${drum}Pitch`] = Math.max(0.5, Math.min(2, value));
    }

    updateVolume(drum, value) {
        if (this.drums[drum]?.gain) {
            this.drums[drum].gain.gain.value = value;
        }
    }

    async loadSampleFromFile(drumName, file) {
        console.log(`Starting to load sample for ${drumName}`, file);
        
        try {
            if (!file.type.startsWith('audio/')) {
                throw new Error('Invalid file type. Please select an audio file.');
            }

            const arrayBuffer = await file.arrayBuffer();
            console.log(`File read successfully, decoding audio for ${drumName}`);
            
            const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
            console.log(`Audio decoded successfully for ${drumName}`);
            
            this.drums[drumName].buffer = audioBuffer;
            return true; // indicate successful loading
        } catch (error) {
            console.error(`Error loading drum sample ${drumName}:`, error);
            throw error; // re-throw to handle in the UI
        }
    }

    getBaseURL() {
        // Get the repository name from the current URL for GitHub Pages
        const pathArray = window.location.pathname.split('/');
        const repoName = pathArray[1]; // Will be empty for local, repo name for GH Pages
        return repoName ? `/${repoName}` : '';
    }

    async loadDefaultSamples() {
        const defaultSamples = {
            kick: './assets/audio/drums/Kick.wav',
            snare: './assets/audio/drums/Snare.wav',
            hihat: './assets/audio/drums/HiHat.wav',
            clap: './assets/audio/drums/Clap.wav'
        };

        for (const [drum, url] of Object.entries(defaultSamples)) {
            try {
                await this.loadSampleFromURL(drum, url);
                // Aggiorna lo stato visuale del sample loader
                const status = this.renderer.container.querySelector(
                    `.sample-loader[data-drum="${drum}"] .sample-status`
                );
                if (status) {
                    status.textContent = 'Default sample loaded';
                    status.classList.add('loaded');
                }
            } catch (error) {
                console.warn(`Could not load default sample for ${drum}:`, error);
            }
        }
    }

    async loadSampleFromURL(drumName, url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
            
            this.drums[drumName].buffer = audioBuffer;
            return true;
        } catch (error) {
            console.error(`Error loading drum sample ${drumName} from URL:`, error);
            throw error;
        }
    }

    // Modifica il metodo onBeat per usare il contatore interno
    onBeat(tick, time) {
        if (tick === 0) {
            // In play mode, avanziamo alla prossima bar
            this.playingBar = (this.playingBar + 1) % this.numBars;
            
            // In play mode, la vista segue il playback
            if (!this.isEditMode) {
                this.currentBar = this.playingBar;
                this.renderer.updateView(this.currentBar, this.numBars);
            }
        }

        // Calcola gli step globali e locali
        const playingStep = (this.playingBar * 32) + tick;  // Step effettivo per il playback
        const localStep = tick;  // Step locale per l'highlighting

        // Non suonare se siamo oltre la lunghezza del pattern
        if (playingStep >= this.selectedLength) {
            this.playingBar = 0;
            return;
        }

        const safeTime = Math.max(this.context.currentTime, time);

        // Highlight dello step corrente
        requestAnimationFrame(() => {
            this.renderer.highlightStep(localStep, this.playingBar);
        });

        // Riproduci i suoni usando lo step di playback
        for (const [drum, sequence] of Object.entries(this.sequence)) {
            if (sequence[playingStep]?.active && this.drums[drum]?.buffer) {
                const normalizedVelocity = Math.min(sequence[playingStep].velocity, 1.5);
                const finalVolume = normalizedVelocity * this.parameters[`${drum}Volume`];
                this.playSample(drum, safeTime, finalVolume);
            }
        }
    }

    playSample(name, time, velocity = 1) {
        if (!this.drums[name]?.buffer || !this.context) return;

        try {
            const source = this.context.createBufferSource();
            const gain = this.context.createGain();
            
            source.buffer = this.drums[name].buffer;
            source.playbackRate.setValueAtTime(
                this.parameters[`${name}Pitch`],
                this.context.currentTime
            );

            // Normalizza il volume per evitare valori troppo alti
            const normalizedVolume = Math.min(velocity, 1.5);
            gain.gain.setValueAtTime(normalizedVolume, time);

            source.connect(gain);
            gain.connect(this.drums[name].gain);

            source.start(time);
            source.stop(time + 1);

            source.onended = () => {
                source.disconnect();
                gain.disconnect();
            };
        } catch (error) {
            console.warn('Sample playback error:', error);
        }
    }

    loadSavedPattern(slot) {
        try {
            const savedData = localStorage.getItem(`${this.instanceId}-pattern-${slot}`);
            if (!savedData) {
                console.log('No pattern found in slot:', slot);
                return false;
            }

            const patternData = JSON.parse(savedData);
            
            // Ripristina i metadati del pattern
            this.numBars = patternData.numBars || 4;
            this.selectedLength = patternData.selectedLength || (this.numBars * 32);
            
            // Reset della sequenza
            this.clearPattern();
            
            // Carica il pattern
            Object.entries(patternData.sequence || {}).forEach(([drum, steps]) => {
                if (this.sequence[drum]) {
                    this.sequence[drum] = steps.map(value => ({
                        active: value > 0,
                        velocity: value === 2 ? 1.5 : value === 1 ? 1 : 0
                    }));
                }
            });

            // Aggiorna l'interfaccia
            this.renderer.updateView(0, this.numBars);
            return true;
        } catch (error) {
            console.error('Error loading pattern:', error);
            return false;
        }
    }

    // Reset delle sequenze con la lunghezza corretta
    clearPattern() {
        Object.keys(this.sequence).forEach(drum => {
            this.sequence[drum] = Array(this.selectedLength)
                .fill()
                .map(() => ({ active: false, velocity: 1 }));
        });
        
        requestAnimationFrame(() => {
            this.renderer.updateSequenceDisplay(this.sequence);
        });
    }

    saveCurrentPattern(slot) {
        try {
            const patternData = {
                numBars: this.numBars,
                selectedLength: this.selectedLength,
                sequence: {}
            };

            // Salva il pattern con i suoi metadati
            Object.entries(this.sequence).forEach(([drum, steps]) => {
                patternData.sequence[drum] = steps.map(step => 
                    step.active ? (step.velocity > 1 ? 2 : 1) : 0
                );
            });

            localStorage.setItem(`${this.instanceId}-pattern-${slot}`, JSON.stringify(patternData));
            localStorage.setItem(`${this.instanceId}-last-pattern`, slot);
            
            return true;
        } catch (error) {
            console.error('Error saving pattern:', error);
            return false;
        }
    }

    // Aggiungi questo metodo per gestire il ripristino delle mappature MIDI
    restoreMIDIMappings(mappings) {
        if (this.midiMapping && mappings) {
            this.midiMapping.setMappings(mappings);
            // Aggiorna l'UI se necessario
            this.renderer?.updateMIDIMappings?.(mappings);
        }
    }

    // Sostituisci onMIDIMessage con handleInstrumentMIDI
    handleInstrumentMIDI(message) {
        const result = this.midiMapping.handleMIDIMessage(message);
        console.log('DrumMachine MIDI result:', result, 'from message:', message.data);
        
        if (result.mapped) {
            if (result.trigger && result.param?.startsWith('pattern')) {
                // Estrai il numero del pattern
                const patternNum = result.param.replace('pattern', '');
                console.log('Loading drum pattern from MIDI:', patternNum);
                
                // Carica il pattern usando il metodo esistente
                if (this.loadSavedPattern(patternNum)) {
                    // Aggiorna l'interfaccia dei pulsanti
                    const buttons = this.renderer.container.querySelectorAll('.memory-btn');
                    buttons.forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.slot === patternNum);
                    });
                    
                    // Forza l'aggiornamento dell'interfaccia
                    this.renderer.updateSequenceDisplay(this.sequence);
                    localStorage.setItem(`${this.instanceId}-last-pattern`, patternNum);
                }
            }
        }
    }

    setEditMode(enabled) {
        this.isEditMode = enabled;
        this.renderer.setEditMode(enabled);
    }

    setNumBars(bars) {
        this.numBars = Math.max(1, Math.min(4, bars));
        this.selectedLength = this.numBars * 32;
        this.currentBar = Math.min(this.currentBar, this.numBars - 1);
        this.clearPattern();
        // Aggiorna la vista
        this.renderer.updateView(this.currentBar, this.numBars);
    }

    navigateToBar(barNumber) {
        if (barNumber >= 0 && barNumber < this.numBars) {
            this.currentBar = barNumber;
            this.renderer.updateView(this.currentBar, this.numBars);
        }
    }
}
