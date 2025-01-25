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
        this.beatDuration = 60 / this.tempo;
        this.pitch = 1.0;
    }

    async loadFile(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            this.buffer = await this.context.decodeAudioData(arrayBuffer);
            this.updateSliceDuration();
            this.generateWaveformData();
            this.renderer.updateDisplay(file.name, this.buffer.duration, this.waveformData);
        } catch (error) {
            console.error('Error loading audio file:', error);
        }
    }

    setDivisions(num) {
        this.divisions = num;
        this.updateSliceDuration();
        this.currentSlice = 0; // Reset current slice
    }

    setSliceLength(length) {
        this.sliceLength = length;
        this.updateSliceDuration();
    }

    setPitch(value) {
        this.pitch = value;
    }

    updateSliceDuration() {
        if (this.buffer) {
            try {
                // Calcola semplicemente la durata di ogni slice
                this.sliceDuration = this.buffer.duration / this.divisions;
            } catch (error) {
                console.warn('Error calculating slice duration:', error);
                this.sliceDuration = this.buffer.duration / this.divisions;
            }
        }
    }

    onBeat(beat) {
        if (!this.buffer) return;

        // Normalizza il beat in base alla lunghezza della slice
        const beatInPattern = beat % (this.divisions * this.sliceLength);
        const slice = Math.floor(beatInPattern / this.sliceLength);
        
        if (slice !== this.currentSlice) {
            this.currentSlice = slice;
            this.playSlice(slice);
        }
    }

    playSlice(sliceIndex) {
        if (!this.buffer || !this.isPlaying) return;
        
        try {
            // Cleanup precedente source
            if (this.source) {
                this.source.stop();
                this.source.disconnect();
            }

            this.source = this.context.createBufferSource();
            this.source.buffer = this.buffer;
            this.source.playbackRate.value = this.pitch;
            this.source.connect(this.instrumentOutput); // <-- Questa riga mancava!

            const startTime = sliceIndex * this.sliceDuration;
            const safeDuration = Math.min(this.sliceDuration, this.buffer.duration - startTime);
            
            this.source.start(this.context.currentTime, startTime, safeDuration);
            this.currentSlice = sliceIndex;
            this.renderer.updateCurrentSlice(sliceIndex);
        } catch (error) {
            console.error('Error playing slice:', error);
        }
    }

    playFullSample() {
        if (!this.buffer) return;
        this.isPlaying = true;

        // Ferma e disconnette eventuali source precedenti
        if (this.source) {
            try {
                this.source.stop();
                this.source.disconnect();
            } catch (error) {
                console.log('Source cleanup error:', error);
            }
        }

        // Crea una nuova sorgente e riproduce l'intero buffer
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
                // Controlla se il source è attivo prima di fermarlo
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
        // Rimuovi la chiamata a this.stop() se vuoi lasciar suonare il campione
        // this.stop();
    }
}
