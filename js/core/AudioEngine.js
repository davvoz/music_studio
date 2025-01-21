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
        // Increase scheduler ahead time
        this.scheduleAheadTime = 0.2; // Aumentato da 0.1 a 0.2
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
    }

    start() {
        if (this.isPlaying) return;

        // Assicurati che il contesto audio sia attivo
        if (this.context.state === 'suspended') {
            this.context.resume().then(() => this.startPlayback());
        } else {
            this.startPlayback();
        }
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
            this.scheduleBeat(this.currentBeat, this.nextNoteTime);
            this.nextBeat();
        }
    }

    scheduleBeat(beat, time) {
        const normalizedBeat = beat % 32; // Ensure we're always using 32 steps
        
        this.instruments.forEach(instrument => {
            instrument.onBeat?.(normalizedBeat, time);
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
        const secondsPerBeat = 60.0 / this.tempo;
        this.nextNoteTime += secondsPerBeat;
        this.currentBeat = (this.currentBeat + 1) % 32;
    }

    setTempo(newTempo) {
        this.tempo = Math.max(30, Math.min(3000, newTempo));
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
    }

    updateMuteSoloStates() {
        const hasSoloedInstruments = Array.from(this.instrumentStates.values())
            .some(state => state.soloed);

        this.instruments.forEach((instrument, id) => {
            const state = this.instrumentStates.get(id);
            if (!state) return;

            // Aggiorna lo stato dell'instrument
            instrument._hasSoloedInstruments = hasSoloedInstruments;
            instrument.setMuted(state.muted);
            instrument.setSolo(state.soloed);

            // Emetti evento per l'UI
            this.emitInstrumentStateChange(id, {
                muted: state.muted,
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
}
