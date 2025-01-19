export class AudioEngine {
    constructor() {
        this.context = new AudioContext();
        this.instruments = new Map();
        this.masterOutput = this.context.createGain();
        this.masterOutput.connect(this.context.destination);
        
        // Timing properties
        this.tempo = 120;
        this.isPlaying = false;
        this.currentBeat = 0;
        this.scheduleAheadTime = 0.1;
        this.lookAhead = 25.0; // milliseconds
        
        // Internal scheduling
        this.nextNoteTime = 0.0;
        this.timerID = null;

        this.onBeatUpdate = null; // Callback for UI updates

        // Add metronome properties
        this.metronomeEnabled = false;
        this.metronomeGain = this.context.createGain();
        this.metronomeGain.connect(this.masterOutput);
        this.metronomeGain.gain.value = 0.5;
    }

    addInstrument(id, instrument) {
        instrument.connect(this.masterOutput);
        this.instruments.set(id, instrument);
    }

    removeInstrument(id) {
        const instrument = this.instruments.get(id);
        if (instrument) {
            instrument.disconnect();
            this.instruments.delete(id);
        }
    }

    start() {
        if (this.isPlaying) return;

        if (this.context.state === 'suspended') {
            this.context.resume();
        }

        this.isPlaying = true;
        this.currentBeat = 0;
        this.nextNoteTime = this.context.currentTime;
        this.scheduler();
    }

    stop() {
        this.isPlaying = false;
        this.currentBeat = 0;
        clearTimeout(this.timerID);
        this.instruments.forEach(instrument => instrument.allNotesOff?.());
    }

    scheduler() {
        while (this.nextNoteTime < this.context.currentTime + this.scheduleAheadTime) {
            this.scheduleBeat(this.currentBeat, this.nextNoteTime);
            this.nextBeat();
        }
        this.timerID = setTimeout(() => this.scheduler(), this.lookAhead);
    }

    scheduleBeat(beat, time) {
        // Notify all instruments of the upcoming beat
        this.instruments.forEach(instrument => {
            instrument.onBeat?.(beat, time);
        });
        
        // Update UI
        if (this.onBeatUpdate) {
            // Use requestAnimationFrame for smooth UI updates
            requestAnimationFrame(() => this.onBeatUpdate(beat));
        }

        // Add metronome sound
        if (this.metronomeEnabled) {
            this.playMetronomeSound(beat, time);
        }
    }

    playMetronomeSound(beat, time) {
        const osc = this.context.createOscillator();
        const gainNode = this.context.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(this.metronomeGain);
        
        // High pitch for first beat of bar, low pitch for others
        osc.frequency.value = beat % 4 === 0 ? 1000 : 800;
        
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
        this.currentBeat = (this.currentBeat + 1) % 16; // Assuming 16 beats per bar
    }

    setTempo(newTempo) {
        this.tempo = Math.max(30, Math.min(3000, newTempo));
    }
}
