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
            kick:  Array(16).fill(false),
            snare: Array(16).fill(false),
            hihat: Array(16).fill(false),
            clap:  Array(16).fill(false)
        };

        this.parameters = {
            kickVolume: 0.8,
            snareVolume: 0.7,
            hihatVolume: 0.6,
            clapVolume: 0.7
        };

        this.setupAudio();
        this.setupEvents();
    }

    setupAudio() {
        // Create individual gain nodes for each drum
        for (const drum of Object.keys(this.drums)) {
            this.drums[drum].gain = this.context.createGain();
            this.drums[drum].gain.connect(this.instrumentOutput);
            this.drums[drum].gain.gain.value = this.parameters[`${drum}Volume`];
        }
    }

    setupEvents() {
        this.renderer.setParameterChangeCallback(async (param, value) => {
            if (param === 'loadSample') {
                try {
                    await this.loadSampleFromFile(value.drum, value.file);
                } catch (error) {
                    console.error('Sample loading failed:', error);
                    throw error;
                }
                return;
            }

            this.parameters[param] = value;
            if (param.endsWith('Volume')) {
                const drum = param.replace('Volume', '');
                if (this.drums[drum]?.gain) {
                    this.drums[drum].gain.gain.value = value;
                }
            }
        });

        this.renderer.setSequenceChangeCallback((drum, step, value) => {
            this.sequence[drum][step] = value;
        });
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

    playSample(name, time) {
        if (!this.drums[name]?.buffer) return;

        const source = this.context.createBufferSource();
        source.buffer = this.drums[name].buffer;
        source.connect(this.drums[name].gain);
        source.start(time);
    }

    onBeat(beat, time) {
        // Notifica al renderer quale step sta suonando
        this.renderer.highlightStep?.(beat);

        // Suona i campioni programmati per questo beat
        for (const [drum, sequence] of Object.entries(this.sequence)) {
            if (sequence[beat]) {
                this.playSample(drum, time);
            }
        }
    }
}
