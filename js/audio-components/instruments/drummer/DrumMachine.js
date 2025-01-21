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

                this.parameters[param] = value;
                
                // Applica i cambiamenti immediatamente
                if (param.endsWith('Volume')) {
                    this.updateVolume(param.replace('Volume', ''), value);
                } else if (param.endsWith('Pitch')) {
                    this.updatePitch(param.replace('Pitch', ''), value);
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
        const baseURL = this.getBaseURL();
        const defaultSamples = {
            kick: `${baseURL}/assets/audio/drums/Kick.wav`,
            snare: `${baseURL}/assets/audio/drums/Snare.wav`,
            hihat: `${baseURL}/assets/audio/drums/HiHat.wav`,
            clap: `${baseURL}/assets/audio/drums/Clap.wav`
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
            source.stop(time + 1);

            source.onended = () => {
                source.disconnect();
                gain.disconnect();
            };
        } catch (error) {
            console.warn('Sample playback error:', error);
        }
    }

    onBeat(beat, time) {
        // Assicuriamoci che il beat sia sempre tra 0 e 31
        const normalizedBeat = beat % 32;
        const safeTime = Math.max(this.context.currentTime, time);
        
        requestAnimationFrame(() => {
            this.renderer.highlightStep?.(normalizedBeat);
        });

        for (const [drum, sequence] of Object.entries(this.sequence)) {
            const step = sequence[normalizedBeat];
            if (step?.active && this.drums[drum]?.buffer) {
                this.playSample(drum, safeTime, step.velocity);
            }
        }
    }
}
