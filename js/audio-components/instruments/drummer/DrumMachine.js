import { AbstractInstrument } from "../../abstract/AbstractInstrument.js";
import { DrumMachineRender } from "./DrumMachineRender.js";

export class DrumMachine extends AbstractInstrument {
    constructor(context) {
        super(context);
        this.renderer = new DrumMachineRender();

        this.drums = {
            kick: { buffer: null },
            snare: { buffer: null },
            hihat: { buffer: null },
            clap: { buffer: null }
        };

        this.sequence = {
            kick:  Array(16).fill({ active: false, velocity: 1 }),
            snare: Array(16).fill({ active: false, velocity: 1 }),
            hihat: Array(16).fill({ active: false, velocity: 1 }),
            clap:  Array(16).fill({ active: false, velocity: 1 })
        };

        this.parameters = {
            kickVolume: 0.8, snareVolume: 0.7, hihatVolume: 0.6, clapVolume: 0.7,
            kickPitch: 1, snarePitch: 1, hihatPitch: 1, clapPitch: 1
        };

        this.parameterQueue = new Map();
        this.parameterUpdateScheduled = false;

        this.setupAudio();
        this.setupEvents();
    }

    setupAudio() {
        for (const drum of Object.keys(this.drums)) {
            this.drums[drum].gain = this.context.createGain();
            this.drums[drum].gain.connect(this.instrumentOutput);
            this.drums[drum].gain.gain.value = this.parameters[`${drum}Volume`];
        }
    }

    setupEvents() {
        let paramUpdateTimeout = null;
        let paramQueue = new Map();

        this.parameterChangeCallback = async (param, value) => {
            try {
                if (param === 'loadSample') {
                    await this.loadSampleFromFile(value.drum, value.file);
                    return;
                }

                this.parameters[param] = value;
                paramQueue.set(param, value);

                if (!paramUpdateTimeout) {
                    paramUpdateTimeout = setTimeout(() => {
                        this.batchUpdateParameters(paramQueue);
                        paramQueue.clear();
                        paramUpdateTimeout = null;
                    }, 16);
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

    batchUpdateParameters(queue) {
        for (const [param, value] of queue.entries()) {
            if (param.endsWith('Volume')) {
                this.updateVolume(param.replace('Volume', ''), value);
            } else if (param.endsWith('Pitch')) {
                this.updatePitch(param.replace('Pitch', ''), value);
            }
        }
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

            gain.gain.setValueAtTime(velocity, time);

            source.connect(gain);
            gain.connect(this.drums[name].gain);

            source.start(time);
            source.stop(time + 1); // 1 secondo di default

            source.onended = () => {
                source.disconnect();
                gain.disconnect();
            };
        } catch (error) {
            console.warn('Sample playback error:', error);
        }
    }

    onBeat(beat, time) {
        const safeTime = Math.max(this.context.currentTime, time);
        
        requestAnimationFrame(() => {
            this.renderer.highlightStep?.(beat);
        });

        for (const [drum, sequence] of Object.entries(this.sequence)) {
            const step = sequence[beat];
            if (step?.active && this.drums[drum]?.buffer) {
                this.playSample(drum, safeTime, step.velocity);
            }
        }
    }
}
