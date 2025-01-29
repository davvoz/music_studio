import { AbstractInstrument } from '../../abstract/AbstractInstrument.js';
import { LooperRender } from './LooperRender.js';

export class Looper extends AbstractInstrument {
    constructor(context) {
        super(context);
        this.renderer = new LooperRender(this.id, this);
        
        // Buffer e source
        this.buffer = null;
        this.source = null;
        this.isPlaying = false;
        
        // Parametri di divisione
        this.divisions = 32;
        this.currentSlice = 0;
        this.sliceDuration = 0;
        this.waveformData = null;
        
        // Stato del playback
        this.startTime = 0;
        this.startOffset = 0;

        this.sliceLength = 4;
        this.tempo = 120;
        this.beatDuration = 60 / this.tempo;
        this.startingStep = 0;
        this.pitch = 1.0;
        this.lastBeatTime = 0;
        this.quantizeToGrid = true;
        this.currentBeat = 0;
        this.beatsPerSlice = 1;
        this.nextSliceTime = 0;

        // Aggiunta della gestione dei suoni multipli
        this.sounds = new Map(); // Map di {name: string, buffer: AudioBuffer, config: Object}
        this.currentSoundName = null;

        this.sliceSettings = []; // Array di oggetti {muted: boolean, reversed: boolean}
        this.initializeSliceSettings();

        this.clipboardSlice = null; // Per memorizzare la slice copiata
    }

    initializeSliceSettings() {
        this.sliceSettings = Array(this.divisions).fill().map(() => ({
            muted: false,
            reversed: false  // Riaggiungiamo questa proprietà
        }));
    }

    async loadFile(file) {
        try {
            this.renderer.showLoading();
            const arrayBuffer = await file.arrayBuffer();
            this.buffer = await this.context.decodeAudioData(arrayBuffer);
            this.updateSliceDuration();
            this.generateWaveformData();
            this.renderer.updateDisplay(file.name, this.buffer.duration, this.waveformData);
            this.renderer.hideLoading();
        } catch (error) {
            console.error('Error loading audio file:', error);
            this.renderer.showError('Failed to load audio file. Please try another file.');
            this.renderer.hideLoading();
        }
    }

    async addSound(name, file, config = {}) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = await this.context.decodeAudioData(arrayBuffer);
            
            this.sounds.set(name, {
                buffer,
                config: {
                    divisions: config.divisions || this.divisions,
                    sliceLength: config.sliceLength || this.sliceLength,
                    pitch: config.pitch || this.pitch,
                    startingStep: config.startingStep || this.startingStep
                }
            });
            
            if (!this.currentSoundName) {
                this.loadSound(name);
            }
            
            this.renderer.updateSoundsList(Array.from(this.sounds.keys()));
            return true;
        } catch (error) {
            console.error('Error adding sound:', error);
            return false;
        }
    }

    loadSound(name) {
        const sound = this.sounds.get(name);
        if (!sound) return false;

        const wasPlaying = this.isPlaying;
        this.stop();
        
        this.buffer = sound.buffer;
        this.currentSoundName = name;
        
        // Carica la configurazione salvata
        this.divisions = sound.config.divisions;
        this.sliceLength = sound.config.sliceLength;
        this.pitch = sound.config.pitch;
        this.startingStep = sound.config.startingStep;
        
        this.updateSliceDuration();
        
        // Rigenera i dati della forma d'onda con il nuovo buffer
        this.generateWaveformData();
        
        // Forza un aggiornamento completo del display
        requestAnimationFrame(() => {
            this.renderer.updateDisplay(name, this.buffer.duration, this.waveformData);
            this.renderer.updateControls(sound.config);
            
            // Riprendi la riproduzione se era attiva
            if (wasPlaying) {
                this.play();
                this.renderer.updatePlayButton(true);
            }
        });
        
        return true;
    }

    saveCurrentConfig() {
        if (!this.currentSoundName) return;
        
        const sound = this.sounds.get(this.currentSoundName);
        if (sound) {
            sound.config = {
                divisions: this.divisions,
                sliceLength: this.sliceLength,
                pitch: this.pitch,
                startingStep: this.startingStep
            };
        }
    }

    removeSound(name) {
        if (this.currentSoundName === name) {
            this.stop();
            this.buffer = null;
            this.currentSoundName = null;
        }
        return this.sounds.delete(name);
    }

    setDivisions(num) {
        this.divisions = num;
        this.initializeSliceSettings();
        this.updateSliceDuration();
        this.currentSlice = 0; // Reset current slice
    }

    setSliceLength(length) {
        this.sliceLength = length;
        this.beatsPerSlice = length;
        this.updateSliceDuration();
    }

    setPitch(value) {
        this.pitch = value;
    }

    setStartingStep(step) {
        this.startingStep = parseInt(step);
    }

    updateSliceDuration() {
        if (this.buffer) {
            const beatsPerMinute = this.tempo;
            const secondsPerBeat = 60 / beatsPerMinute;
            this.sliceDuration = secondsPerBeat * this.sliceLength;
        }
    }

    onBeat(beat, time) {
        if (!this.buffer || !this.isPlaying) return;

        const beatInPattern = beat % (this.divisions * this.beatsPerSlice);
        const currentSlice = Math.floor(beatInPattern / this.beatsPerSlice);
        
        const effectiveSlice = (currentSlice + parseInt(this.startingStep)) % this.divisions;

        if (effectiveSlice !== this.currentSlice) {
            this.currentSlice = effectiveSlice;
            this.playSliceAtTime(this.currentSlice, time);
            
            console.log(`Beat: ${beat}, Slice: ${effectiveSlice}, Time: ${time}`);
        }
    }

    toggleSliceMute(sliceIndex) {
        if (sliceIndex >= 0 && sliceIndex < this.sliceSettings.length) {
            this.sliceSettings[sliceIndex].muted = !this.sliceSettings[sliceIndex].muted;
        }
    }

    toggleSliceReverse(sliceIndex) {
        if (sliceIndex >= 0 && sliceIndex < this.sliceSettings.length) {
            this.sliceSettings[sliceIndex].reversed = !this.sliceSettings[sliceIndex].reversed;
        }
    }

    playSliceAtTime(sliceIndex, time) {
        if (!this.buffer || !this.isPlaying || this.sliceSettings[sliceIndex].muted) return;
        
        try {
            const source = this.context.createBufferSource();
            source.buffer = this.buffer;
            const sliceStart = (sliceIndex * this.buffer.duration) / this.divisions;
            const sliceDuration = this.buffer.duration / this.divisions;
            const sliceEnd = sliceStart + sliceDuration;
            
            const gainNode = this.context.createGain();
            gainNode.connect(this.instrumentOutput);
            source.connect(gainNode);
            
            gainNode.gain.setValueAtTime(0, time);
            gainNode.gain.linearRampToValueAtTime(1, time + 0.002);
            gainNode.gain.setValueAtTime(1, time + sliceDuration - 0.002);
            gainNode.gain.linearRampToValueAtTime(0, time + sliceDuration);

            if (this.sliceSettings[sliceIndex].reversed) {
                source.playbackRate.value = -this.pitch;
                // Per la riproduzione inversa, iniziamo dalla fine della slice
                source.start(time, sliceEnd);
            } else {
                source.playbackRate.value = this.pitch;
                source.start(time, sliceStart, sliceDuration);
            }
            
            // Assicuriamoci che la slice si fermi al momento giusto
            source.stop(time + sliceDuration);
            
            requestAnimationFrame(() => {
                this.renderer?.updateCurrentSlice(sliceIndex);
            });
            
            source.onended = () => {
                source.disconnect();
                gainNode.disconnect();
            };
        } catch (error) {
            console.error('Error playing slice:', error);
        }
    }

    playSlice(sliceIndex) {
        if (!this.buffer || !this.isPlaying) return;
        
        try {
            if (this.source) {
                this.source.stop();
                this.source.disconnect();
            }

            this.source = this.context.createBufferSource();
            this.source.buffer = this.buffer;
            
            const sliceStart = (sliceIndex * this.buffer.duration) / this.divisions;
            const sliceDuration = this.buffer.duration / this.divisions;
            const sliceEnd = sliceStart + sliceDuration;
            
            const gainNode = this.context.createGain();
            gainNode.connect(this.instrumentOutput);
            this.source.connect(gainNode);
            
            const startTime = this.context.currentTime;
            const fadeTime = 0.005;
            
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(1, startTime + fadeTime);
            gainNode.gain.setValueAtTime(1, startTime + sliceDuration - fadeTime);
            gainNode.gain.linearRampToValueAtTime(0, startTime + sliceDuration);

            if (this.sliceSettings[sliceIndex].reversed) {
                this.source.playbackRate.value = -this.pitch;
                // Per la riproduzione inversa, iniziamo dalla fine della slice
                this.source.start(startTime, sliceEnd);
                this.source.stop(startTime + sliceDuration);
            } else {
                this.source.playbackRate.value = this.pitch;
                this.source.start(startTime, sliceStart, sliceDuration);
            }
            
            this.currentSlice = sliceIndex;
            this.renderer.updateCurrentSlice(sliceIndex);
            
            this.source.onended = () => {
                this.source.disconnect();
                gainNode.disconnect();
            };
        } catch (error) {
            console.error('Error playing slice:', error);
        }
    }

    playFullSample() {
        if (!this.buffer) return;
        this.isPlaying = true;

        if (this.source) {
            try {
                this.source.stop();
                this.source.disconnect();
            } catch (error) {
                console.log('Source cleanup error:', error);
            }
        }

        this.source = this.context.createBufferSource();
        this.source.buffer = this.buffer;
        this.source.playbackRate.value = this.pitch;
        this.source.connect(this.instrumentOutput);
        this.source.start(this.context.currentTime, 0, this.buffer.duration);
    }

    generateWaveformData(samples = 1000) {
        if (!this.buffer) return;

        const rawData = this.buffer.getChannelData(0);
        const blockSize = Math.floor(rawData.length / samples);
        const filteredData = [];

        for (let i = 0; i < samples; i++) {
            const blockStart = blockSize * i;
            let blockSum = 0;
            for (let j = 0; j < blockSize; j++) {
                blockSum += Math.abs(rawData[blockStart + j]);
            }
            filteredData.push(blockSum / blockSize);
        }

        this.waveformData = filteredData;
        return filteredData;
    }

    play() {
        this.isPlaying = true;
    }

    stop() {
        this.isPlaying = false;
        if (this.source) {
            try {
                if (this.source.playbackState === 'playing') {
                    this.source.stop();
                }
                this.source.disconnect();
            } catch (error) {
                console.log('Stop error:', error);
            }
            this.source = null;
        }
        this.currentSlice = 0;
    }

    onTransportStart() {
        this.play();
    }

    onTransportStop() {
    }

    copySlice(sliceIndex) {
        if (!this.buffer || sliceIndex >= this.divisions) return;
        
        const sliceStart = (sliceIndex * this.buffer.duration) / this.divisions;
        const sliceDuration = this.buffer.duration / this.divisions;
        
        // Crea un nuovo AudioBuffer per la slice
        const sampleRate = this.buffer.sampleRate;
        const numberOfChannels = this.buffer.numberOfChannels;
        const sliceSamples = Math.floor(sliceDuration * sampleRate);
        
        const sliceBuffer = this.context.createBuffer(
            numberOfChannels,
            sliceSamples,
            sampleRate
        );
        
        // Copia i dati audio per ogni canale
        for (let channel = 0; channel < numberOfChannels; channel++) {
            const channelData = this.buffer.getChannelData(channel);
            const sliceData = sliceBuffer.getChannelData(channel);
            const startSample = Math.floor(sliceStart * sampleRate);
            
            for (let i = 0; i < sliceSamples; i++) {
                sliceData[i] = channelData[startSample + i];
            }
        }
        
        this.clipboardSlice = {
            buffer: sliceBuffer,
            muted: this.sliceSettings[sliceIndex].muted
        };
    }

    pasteSlice(targetIndex) {
        if (!this.clipboardSlice || !this.buffer || targetIndex >= this.divisions) return;
        
        const targetStart = (targetIndex * this.buffer.duration) / this.divisions;
        const sampleRate = this.buffer.sampleRate;
        const startSample = Math.floor(targetStart * sampleRate);
        
        // Copia i dati audio dalla slice copiata al buffer principale
        for (let channel = 0; channel < this.buffer.numberOfChannels; channel++) {
            const sourceData = this.clipboardSlice.buffer.getChannelData(channel);
            const targetData = this.buffer.getChannelData(channel);
            
            for (let i = 0; i < sourceData.length; i++) {
                if (startSample + i < targetData.length) {
                    targetData[startSample + i] = sourceData[i];
                }
            }
        }
        
        // Copia le impostazioni
        this.sliceSettings[targetIndex].muted = this.clipboardSlice.muted;
        
        // Aggiorna la visualizzazione
        this.generateWaveformData();
        this.renderer?.drawWaveform();
    }
}
