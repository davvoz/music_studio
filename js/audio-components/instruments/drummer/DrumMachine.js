import { AbstractInstrument } from "../../abstract/AbstractInstrument.js";
import { DrumMachineRender } from "./DrumMachineRender.js";
import { MIDIMapping } from "../../../core/MIDIMapping.js";  // Add this import

export class DrumMachine extends AbstractInstrument {
    constructor(context) {
        super(context);
        
        // Inizializza prima l'ID e il MIDI mapping
        this.instanceId = 'drum_' + Date.now();
        this.midiMapping = new MIDIMapping();

        // Ora crea il renderer passando sia l'ID che l'istanza
        this.renderer = new DrumMachineRender(this.instanceId, this);

        this.drums = {
            kick: { buffer: null },
            snare: { buffer: null },
            hihat: { buffer: null },
            clap: { buffer: null }
        };

        this.sequence = {
            kick:  Array(32).fill({ active: false, velocity: 1 }),
            snare: Array(32).fill({ active: false, velocity: 1 }),
            hihat: Array(32).fill({ active: false, velocity: 1 }),
            clap:  Array(32).fill({ active: false, velocity: 1 })
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

        this.selectedLength = 32; // Aggiungi questa linea

        // Inizializza MIDI mapping con supporto al salvataggio
        this.midiMapping = new MIDIMapping();
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
                    this.selectedLength = parseInt(value);
                    this.renderer.updatePatternLength?.(value);
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

    onBeat(beat, time) {
        // Calcola correttamente l'indice dello step considerando la suddivisione in due parti
        const stepIndex = beat % 32;
        if (stepIndex >= this.selectedLength) return;
        
        const safeTime = Math.max(this.context.currentTime, time);
        
        requestAnimationFrame(() => {
            this.renderer.highlightStep?.(stepIndex);
        });

        for (const [drum, sequence] of Object.entries(this.sequence)) {
            const step = sequence[stepIndex];
            if (step?.active && this.drums[drum]?.buffer) {
                // Normalizza il volume per evitare differenze tra le due metà
                const normalizedVelocity = Math.min(step.velocity, 1.5);
                // Applica il volume corretto considerando sia il volume del drum che la velocity dello step
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
        const savedPattern = localStorage.getItem(`${this.instanceId}-pattern-${slot}`);
        if (!savedPattern) {
            console.log('No pattern found in slot:', slot);
                // Resetta il pattern corrente se non ne viene trovato uno salvato
            this.clearPattern();
            return;
        }

        try {
            const pattern = JSON.parse(savedPattern);
            // Reset della sequenza prima di caricare il nuovo pattern
            this.clearPattern();
            
            // Carica il nuovo pattern
            Object.entries(pattern).forEach(([drum, steps]) => {
                if (this.sequence[drum]) {
                    this.sequence[drum] = steps.map(value => ({
                        active: value > 0,
                        velocity: value === 2 ? 1.5 : value === 1 ? 1 : 0
                    }));
                }
            });

            // Aggiorna l'interfaccia
            requestAnimationFrame(() => {
                this.renderer.updateSequenceDisplay(this.sequence);
            });
            
            localStorage.setItem(`${this.instanceId}-last-pattern`, slot);
            console.log('Pattern loaded from slot:', slot);
        } catch (error) {
            console.error('Error loading pattern:', error);
            // In caso di errore, pulisci il pattern
            this.clearPattern();
        }
    }

    clearPattern() {
        // Resetta tutte le sequenze
        Object.keys(this.sequence).forEach(drum => {
            this.sequence[drum] = Array(32).fill({ active: false, velocity: 1 });
        });
        // Aggiorna l'interfaccia
        requestAnimationFrame(() => {
            this.renderer.updateSequenceDisplay(this.sequence);
        });
    }

    saveCurrentPattern(slot) {
        try {
            // Crea una copia profonda del pattern corrente
            const pattern = {};
            Object.entries(this.sequence).forEach(([drum, steps]) => {
                pattern[drum] = steps.map(step => 
                    step.active ? (step.velocity > 1 ? 2 : 1) : 0
                );
            });

            // Salva il pattern
            const patternString = JSON.stringify(pattern);
            localStorage.setItem(`${this.instanceId}-pattern-${slot}`, patternString);
            localStorage.setItem(`${this.instanceId}-last-pattern`, slot);
            
            console.log('Pattern saved to slot:', slot);
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
                
                // Prima attiva visualmente il pulsante
                const buttons = this.renderer.container.querySelectorAll('.memory-btn');
                buttons.forEach(btn => btn.classList.remove('active'));
                
                const selectedBtn = this.renderer.container.querySelector(`.memory-btn[data-slot="${patternNum}"]`);
                if (selectedBtn) {
                    selectedBtn.classList.add('active');
                }

                // Carica il pattern
                const savedPattern = localStorage.getItem(`${this.instanceId}-pattern-${patternNum}`);
                if (savedPattern) {
                    const pattern = JSON.parse(savedPattern);
                    
                    // Reset della sequenza prima di caricare il nuovo pattern
                    this.clearPattern();
                    
                    // Carica il nuovo pattern
                    Object.entries(pattern).forEach(([drum, steps]) => {
                        if (this.sequence[drum]) {
                            this.sequence[drum] = steps.map(value => ({
                                active: value > 0,
                                velocity: value === 2 ? 1.5 : value === 1 ? 1 : 0
                            }));
                        }
                    });

                    // Aggiorna l'interfaccia
                    this.renderer.updateSequenceDisplay(this.sequence);
                    localStorage.setItem(`${this.instanceId}-last-pattern`, patternNum);
                    console.log('Drum pattern loaded:', patternNum);
                }
            }
        }
    }
}
