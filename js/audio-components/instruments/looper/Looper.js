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
        this.divisions = 32; // Default a 32 divisioni
        this.currentSlice = 0;
        this.sliceDuration = 0;
        this.waveformData = null;
        
        // Stato del playback
        this.startTime = 0;
        this.startOffset = 0;

        // Aggiungi parametri per la lunghezza della slice
        this.sliceLength = 4; // Default: 4 beats per slice
        this.beatDuration = 60 / this.tempo; // durata di un beat in secondi

        this.pitch = 1.0; // Default pitch value
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
            // Proteggi i calcoli della durata
            try {
                const totalBeats = this.divisions * this.sliceLength;
                const tempoInSeconds = 60 / this.tempo;
                const totalDuration = tempoInSeconds * totalBeats;
                
                // Verifica che i valori siano finiti e validi
                if (isFinite(totalDuration) && totalDuration > 0) {
                    this.sliceDuration = totalDuration / this.divisions;
                } else {
                    console.warn('Invalid duration calculation:', {
                        totalBeats,
                        tempoInSeconds,
                        totalDuration
                    });
                    // Usa un valore di fallback basato sulla durata del buffer
                    this.sliceDuration = this.buffer.duration / this.divisions;
                }
            } catch (error) {
                console.warn('Error calculating slice duration:', error);
                // Fallback sicuro
                this.sliceDuration = this.buffer.duration / this.divisions;
            }
        }
    }

    onBeat(beat) {
        // Calcola quale slice suonare in base al beat corrente
        const beatsPerSlice = this.sliceLength;
        const slice = Math.floor((beat % (this.divisions * beatsPerSlice)) / beatsPerSlice);
        
        if (slice !== this.currentSlice) {
            this.currentSlice = slice;
            this.playSlice(slice);
        }
    }

    playSlice(sliceIndex) {
        if (!this.buffer || !this.isPlaying) return;
        
        try {
            // Ferma il source precedente se esiste e sta suonando
            if (this.source) {
                try {
                    if (this.source.playbackState === 'playing') {
                        this.source.stop();
                    }
                    this.source.disconnect();
                } catch (error) {
                    console.log('Source cleanup error:', error);
                }
            }

            // Semplifica la riproduzione rimuovendo l'envelope
            this.source = this.context.createBufferSource();
            this.source.buffer = this.buffer;
            this.source.connect(this.instrumentOutput);

            // Applica il pitch
            this.source.playbackRate.value = this.pitch;

            const now = this.context.currentTime;
            const startTime = sliceIndex * this.sliceDuration;
            const maxDuration = this.buffer.duration - startTime;
            const safeDuration = Math.min(this.sliceDuration, maxDuration);

            this.source.start(now, startTime, safeDuration);
            
            // Aggiorna l'indice dello slice corrente e notifica il renderer
            this.currentSlice = sliceIndex;
            this.renderer.updateCurrentSlice(sliceIndex);

        } catch (error) {
            console.error('Error playing slice:', error);
        }
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
        this.stop();
    }
}
