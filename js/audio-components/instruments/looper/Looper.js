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

    setDivisions(num) {
        this.divisions = num;
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

    playSliceAtTime(sliceIndex, time) {
        if (!this.buffer || !this.isPlaying) return;
        
        try {
            const source = this.context.createBufferSource();
            source.buffer = this.buffer;
            source.playbackRate.value = this.pitch;
            
            const sliceStart = (sliceIndex * this.buffer.duration) / this.divisions;
            const sliceDuration = (this.buffer.duration / this.divisions);
            
            const gainNode = this.context.createGain();
            gainNode.connect(this.instrumentOutput);
            source.connect(gainNode);
            
            const fadeDuration = 0.002;
            gainNode.gain.setValueAtTime(0, time);
            gainNode.gain.linearRampToValueAtTime(1, time + fadeDuration);
            gainNode.gain.setValueAtTime(1, time + sliceDuration - fadeDuration);
            gainNode.gain.linearRampToValueAtTime(0, time + sliceDuration);
            
            source.start(time, sliceStart, sliceDuration);
            
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
            this.source.playbackRate.value = this.pitch;
            
            const gainNode = this.context.createGain();
            gainNode.connect(this.instrumentOutput);
            this.source.connect(gainNode);
            
            const startTime = this.context.currentTime;
            const fadeTime = 0.005;
            
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(1, startTime + fadeTime);
            gainNode.gain.setValueAtTime(1, startTime + this.sliceDuration - fadeTime);
            gainNode.gain.linearRampToValueAtTime(0, startTime + this.sliceDuration);

            const sliceStart = sliceIndex * this.sliceDuration;
            const safeDuration = Math.min(this.sliceDuration, this.buffer.duration - sliceStart);
            
            this.source.start(startTime, sliceStart, safeDuration);
            this.currentSlice = sliceIndex;
            this.renderer.updateCurrentSlice(sliceIndex);
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
}
