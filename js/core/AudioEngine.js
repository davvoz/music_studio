export class AudioEngine {
    constructor() {
        // Add buffer size adjustment
        this.context = new AudioContext({
            latencyHint: 'interactive',
            sampleRate: 44100
        });
        
        this.instruments = new Map();
        this.masterOutput = this.context.createGain();
        this.masterOutput.connect(this.context.destination);
        
        // Timing properties
        this.tempo = 120;
        this.isPlaying = false;
        this.currentBeat = 0;
        this.totalBeats = 32; // Aggiungi questo
        // Increase scheduler ahead time
        this.scheduleAheadTime = 0.1; // Quanto tempo in anticipo schedulare (secondi)
        this.lookAhead = 25.0; // milliseconds
        
        // Internal scheduling
        this.nextNoteTime = 0.0;

        this.onBeatUpdate = null; // Callback for UI updates

        // Add metronome properties
        this.metronomeEnabled = false;
        this.metronomeGain = this.context.createGain();
        this.metronomeGain.connect(this.masterOutput);
        this.metronomeGain.gain.value = 0.5;

        // Prevent audio suspension
        this.setupAudioResume();

        // Performance optimization
        this.scheduleQueue = [];
        this.isProcessing = false;

        // Inizializza il worker
        const blob = new Blob([`
            let timerID = null;
            let interval = 25;
            
            self.onmessage = function(e) {
                if (e.data === "start") {
                    timerID = setInterval(() => postMessage("tick"), interval);
                }
                else if (e.data === "stop") {
                    clearInterval(timerID);
                    timerID = null;
                }
            };
        `], { type: "text/javascript" });

        this.timerWorker = new Worker(URL.createObjectURL(blob));
        this.timerWorker.onmessage = () => {
            if (this.isPlaying) this.processTick();
        };

        // Add performance mode flag
        this.isHighPerformanceMode = true;

        // Add solo instrument property
        this.isSoloedInstrument = null;

        // Track mute/solo states
        this.instrumentStates = new Map();

        // Add MIDI learn state
        this.midiLearnTarget = null;
        this.midiMappings = new Map(); // { midiNote: { id, control, type } }
        this.lastMidiId = 0; // Aggiungi contatore per ID univoci
        
        // Setup MIDI handling if available
        if (navigator.requestMIDIAccess) {
            navigator.requestMIDIAccess()
                .then(access => this.initializeMIDI(access))
                .catch(err => console.warn('MIDI not available:', err));
        }

        // Struttura semplificata per APC40
        this.APC40 = {
            CHANNEL: 0,          // APC40 usa il canale 1
            STATUS_NOTE_ON: 144, // 0x90 - Note On sul canale 1
            STATUS_NOTE_OFF: 128 // 0x80 - Note Off sul canale 1
        };

        // Mappa semplice per i controlli MIDI
        this.midiControls = new Map();

        // Aggiungi tracking dello stato dei pulsanti
        this.buttonStates = new Map();

        // Solo le mappature MIDI essenziali
        this.midiMappings = new Map(); // { noteNumber: { id, action } }
        this.midiLearnTarget = null;

        // Migliora la struttura delle mappature MIDI
        this.midiMappings = new Map(); // { `${midiNote}-${channel}`: { id, control } }
        this.midiLearnTarget = null;

        // Semplifica la gestione MIDI
        this.midiMappings = new Map();  // formato: { `${note}-${channel}-${control}-${id}`: { id, control } }

        // Struttura semplificata per i mapping MIDI
        this.midiMappings = new Map();
        this.midiLearnTarget = null;

        // Debug flag
        this.DEBUG = true;

        // MIDI setup - RIMUOVI TUTTE LE ALTRE DICHIARAZIONI di midiMappings nel costruttore
        this.midiMappings = new Map();
        this.midiLearnTarget = null;
        this.DEBUG = true;

        // Costanti APC40
        this.APC40 = {
            MUTE_CHANNEL: 0,
            SOLO_CHANNEL: 1,
            NOTE_ON: 144,    // 0x90
            NOTE_OFF: 128    // 0x80
        };

        // Configurazione specifica APC40
        this.midiControlMap = new Map();  // { instrumentId -> { mute: noteNumber, solo: noteNumber } }
        this.DEBUG = true;

        // Struttura MIDI semplificata per l'APC40
        this.midiMappings = new Map(); // { note: { id, type } }
        this.midiLearnTarget = null;
        this.DEBUG = true;

        // Semplifica al massimo la gestione MIDI
        this.midiControlMap = new Map();  // { note: { id, type, state: boolean } }
        this.midiLearnTarget = null;

        // Aggiungi output MIDI per l'APC40
        this.midiOutput = null;
        if (navigator.requestMIDIAccess) {
            navigator.requestMIDIAccess()
                .then(access => {
                    this.initializeMIDI(access);
                    // Prendi il primo output disponibile (APC40)
                    this.midiOutput = access.outputs.values().next().value;
                })
                .catch(err => console.warn('MIDI not available:', err));
        }

        // Semplifica la struttura MIDI
        this.midiControlMap = new Map(); // { noteNumber: { id: string, type: 'mute'|'solo' } }
        this.midiLearnTarget = null;
        this.DEBUG = true;
        this.midiOutput = null;

        // Rimuovi tutte le strutture MIDI tranne quelle base
        this.midiOutput = null;
        this.midiControlMap = new Map();
        this.midiLearnTarget = null;
        this.DEBUG = true;

        // Setup MIDI base
        if (navigator.requestMIDIAccess) {
            navigator.requestMIDIAccess()
                .then(access => {
                    this.initializeMIDI(access);
                    this.midiOutput = access.outputs.values().next().value;
                })
                .catch(err => console.warn('MIDI not available:', err));
        }
    }

    setupAudioResume() {
        let resumeTimeout;
        
        // Replace multiple listeners with single passive listener
        const resumeAudio = () => {
            if (this.context.state === 'suspended' && this.isPlaying) {
                this.context.resume();
            }
        };

        // Use single event listener with capture
        window.addEventListener('touchstart', resumeAudio, { 
            passive: true, 
            capture: true 
        });

        // Periodic check with longer interval
        setInterval(resumeAudio, 2000);
    }

    addInstrument(id, instrument) {
        instrument.connect(this.masterOutput);
        this.instruments.set(id, instrument);
        this.instrumentStates.set(id, { muted: false, soloed: false });
    }

    removeInstrument(id) {
        const instrument = this.instruments.get(id);
        if (instrument) {
            instrument.disconnect();
            this.instruments.delete(id);
        }
        this.instrumentStates.delete(id);
        this.updateMuteSoloStates();

        // Rimuovi tutti i mapping MIDI associati a questo strumento
        for (const [key, mapping] of this.midiMappings.entries()) {
            if (mapping.id === id) {
                this.midiMappings.delete(key);
            }
        }

        // Rimuovi i controlli MIDI associati
        for (const [note, control] of this.midiControls.entries()) {
            if (control.id === id) {
                this.midiControls.delete(note);
            }
        }

        // Rimuovi tutte le mappature MIDI per questo strumento
        for (const [note, mapping] of this.midiMappings.entries()) {
            if (mapping.id === id) {
                this.midiMappings.delete(note);
            }
        }

        // Rimuovi tutte le mappature MIDI per questo strumento
        for (const [key, mapping] of this.midiMappings.entries()) {
            if (mapping.id === id) {
                this.midiMappings.delete(key);
            }
        }
    }

    start() {
        if (this.isPlaying) return;

        // Assicurati che il contesto audio sia attivo
        if (this.context.state === 'suspended') {
            this.context.resume().then(() => this.startPlayback());
        } else {
            this.startPlayback();
        }

        // Notifica tutti gli strumenti
        this.instruments.forEach((instrument) => {
            if (typeof instrument.onTransportStart === 'function') {
                instrument.onTransportStart();
            }
        });
    }

    startPlayback() {
        this.isPlaying = true;
        this.currentBeat = 0;
        this.nextNoteTime = this.context.currentTime;
        this.totalBeats = 32; // Add this line to explicitly set total beats
        this.timerWorker.postMessage("start");
    }

    stop() {
        this.isPlaying = false;
        this.currentBeat = 0;
        this.timerWorker.postMessage("stop");
        this.instruments.forEach(instrument => instrument.allNotesOff?.());

        // Notifica tutti gli strumenti
        this.instruments.forEach(instrument => {
            instrument.allNotesOff?.();
            if (typeof instrument.onTransportStop === 'function') {
                instrument.onTransportStop();
            }
        });
    }

    processTick() {
        // Add high performance mode check
        if (!this.isHighPerformanceMode) {
            if (document.hidden || this.isAnimating) return;
        }

        // Schedule notes until we reach the lookahead window
        while (this.nextNoteTime < this.context.currentTime + this.scheduleAheadTime) {
            this.scheduleBeat(this.currentBeat, this.nextNoteTime);
            this.advanceNote();
        }
    }

    processScheduledEvents(time) {
        if (this.isProcessing) return;
        this.isProcessing = true;

        // Use requestIdleCallback for non-critical operations
        requestIdleCallback(() => {
            this.scheduleBeat(this.currentBeat, time);
            this.nextBeat();
            this.isProcessing = false;
        });
    }

    scheduler() {
        // Verifica che il contesto sia attivo prima di schedulare
        if (this.context.state === 'suspended') {
            this.context.resume();
        }

        while (this.nextNoteTime < this.context.currentTime + this.scheduleAheadTime) {
            // Usa un tempo più corretto per 32 step
            const secondsPerBeat = 60.0 / (this.tempo * 2); // Dividi il tempo per 2 per ottenere 32 step
            this.scheduleBeat(this.currentBeat, this.nextNoteTime);
            this.nextNoteTime += secondsPerBeat;
            this.currentBeat = (this.currentBeat + 1) % 32;
        }
    }

    scheduleBeat(beat, time) {
        const normalizedBeat = beat % 32; // Ensure we're always using 32 steps
        
        // Calcola il tempo preciso per questo beat
        const secondsPerBeat = 60.0 / this.tempo;
        const preciseTime = time;
        
        this.instruments.forEach(instrument => {
            if (instrument.onBeat) {
                instrument.onBeat(normalizedBeat, preciseTime);
            }
        });
        
        if (this.onBeatUpdate) {
            requestAnimationFrame(() => this.onBeatUpdate(normalizedBeat));
        }

        if (this.metronomeEnabled) {
            this.playMetronomeSound(normalizedBeat, time);
        }
    }

    playMetronomeSound(beat, time) {
        const osc = this.context.createOscillator();
        const gainNode = this.context.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(this.metronomeGain);
        
        // Modifichiamo il metronomo per supportare 32 step
        // Suono alto per l'inizio di ogni gruppo di 8 step
        osc.frequency.value = beat % 8 === 0 ? 1000 : 800;
        
        gainNode.gain.setValueAtTime(0, time);
        gainNode.gain.linearRampToValueAtTime(1, time + 0.001);
        gainNode.gain.linearRampToValueAtTime(0, time + 0.05);
        
        osc.start(time);
        osc.stop(time + 0.05);
    }

    toggleMetronome() {
        this.metronomeEnabled = !this.metronomeEnabled;
        return this.metronomeEnabled;
    }

    nextBeat() {
        const secondsPerBeat = 60.0 / this.tempo;
        this.nextNoteTime += secondsPerBeat;
        // Ensure we're using 32 steps and the beat counter works correctly
        this.currentBeat = (this.currentBeat + 1) % 32;
    }

    advanceNote() {
        // Usa un tempo più corretto per 32 step
        const secondsPerBeat = 60.0 / (this.tempo * 2); // Dividi il tempo per 2
        this.nextNoteTime += secondsPerBeat;
        this.currentBeat = (this.currentBeat + 1) % 32;
    }

    setTempo(newTempo) {
        // Dividi il tempo per 2 per mantenere il timing corretto con 32 step
        this.tempo = Math.max(30, Math.min(3000, newTempo)) / 2;
    }

    muteInstrument(id, shouldMute) {
        const state = this.instrumentStates.get(id);
        if (!state) return;

        // Aggiorna lo stato
        state.muted = shouldMute;
        
        // Aggiorna l'audio
        const instrument = this.instruments.get(id);
        if (instrument) {
            instrument.setMuted(shouldMute);
        }

        this.updateMuteSoloStates();
        this.updateInstrumentState(id, shouldMute, this.instrumentStates.get(id)?.soloed || false);
    }

    soloInstrument(id, shouldSolo) {
        const state = this.instrumentStates.get(id);
        if (!state) return;

        state.soloed = shouldSolo;

        // Se stiamo attivando il solo, disattiva il mute
        if (shouldSolo) {
            state.muted = false;
        }

        this.updateMuteSoloStates();
        this.updateInstrumentState(id, this.instrumentStates.get(id)?.muted || false, shouldSolo);
    }

    updateMuteSoloStates() {
        const hasSoloedInstruments = Array.from(this.instrumentStates.values())
            .some(state => state.soloed);

        this.instruments.forEach((instrument, id) => {
            const state = this.instrumentStates.get(id);
            if (!state) return;

            // Calculate effective mute state
            const shouldBeMuted = state.muted || (hasSoloedInstruments && !state.soloed);
            
            // Update instrument audio state
            instrument.setMuted(shouldBeMuted);

            // Emit state change for UI
            this.emitInstrumentStateChange(id, {
                muted: shouldBeMuted,
                soloed: state.soloed
            });
        });
    }

    emitInstrumentStateChange(id, state) {
        const event = new CustomEvent('instrumentStateChange', {
            detail: { id, state }
        });
        window.dispatchEvent(event);
    }

    initializeMIDI(access) {
        access.inputs.forEach(input => {
            input.onmidimessage = (message) => this.handleMIDIMessage(message);
        });
    }

    // Semplifica la gestione MIDI temporaneamente
    handleMIDIMessage(message) {
        // Per ora lasciamo vuoto, lo implementeremo dopo
    }

    // Debug helper
    printMidiMappings() {
        console.log('=== MIDI Mappings ===');
        for (const [note, mapping] of this.midiMappings.entries()) {
            console.log(`Note ${note}:`, mapping);
        }
    }
    
    // Debug helper migliorato
    logMidiMappings() {
        console.log('=== Current MIDI Mappings ===');
        for (const [key, mapping] of this.midiMappings.entries()) {
            const [note, channel, control, id] = key.split('-');
            console.log({
                key,
                note,
                channel,
                control,
                id,
                mapping
            });
        }
    }
}
