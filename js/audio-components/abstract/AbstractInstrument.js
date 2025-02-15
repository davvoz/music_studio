import { AbstractHTMLRender } from './AbstractHTMLRender.js';
import { AbstractAudioComponent } from './AbstractAudioComponent.js';
import { VUMeter } from '../../components/VUMeter.js';
import { DelayEffect } from '../effects/DelayEffect.js';
import { ShaperEffect } from '../effects/ShaperEffect.js';
import { MIDIMapping } from '../../core/MIDIMapping.js';  // Aggiungi questa importazione
import { VirtualSidechain } from '../effects/virtual-sidechain/VirtualSidechain.js';  // Aggiungi questa importazione


export class AbstractInstrument extends AbstractAudioComponent {
    constructor(context, id) {
        super(context);
        this.id = id;
        this.renderer = new AbstractHTMLRender();
        
        // Create audio routing
        this.instrumentOutput = this.context.createGain();
        this.rackVolume = context.createGain();
        this.vuMeter = new VUMeter(context);
        
        // MIDI mapping
        this.midiMapping = new MIDIMapping();
        
        // Create effects
        this.delay = new DelayEffect(context);
        this.shaper = new ShaperEffect(context);
        this.virtualSidechain = new VirtualSidechain(context);
        
        // Set initial values
        this.rackVolume.gain.value = 0.8;
        this._savedVolume = 0.8;
        this._isMuted = false;
        this._isSoloed = false;
        
        // Connect the audio chain with effects
        this.instrumentOutput.connect(this.shaper.input);
        this.shaper.connect(this.delay.input);
        this.delay.connect(this.virtualSidechain.input);
        this.virtualSidechain.connect(this.rackVolume);
        this.rackVolume.connect(this.output);
        
        // Connect VU meter in parallel
        this.instrumentOutput.connect(this.vuMeter.inputGain);
        
        // Start VU meter
        this.vuMeter.start();

        this.audioContext = context; // Aggiungi questa riga
    }
    
    render() {
        const container = this.renderer.render();
        
        // Add rack mixer controls
        const mixerSection = document.createElement('div');
        mixerSection.className = 'rack-mixer';
        
        // Create effects container
        const effectsContainer = document.createElement('div');
        effectsContainer.className = 'effects-container';

        // Create a container for volume and VU meter
        const volumeAndVUContainer = document.createElement('div');
        volumeAndVUContainer.className = 'volume-vu-container effect-unit';

        // Add volume label
        const volumeLabel = document.createElement('div');
        volumeLabel.className = 'effect-label';
        volumeLabel.textContent = 'Volume';
        volumeAndVUContainer.appendChild(volumeLabel);

        // Volume controls
        const volumeContainer = document.createElement('div');
        volumeContainer.className = 'volume-container';

        // Volume slider
        const volumeSlider = document.createElement('input');
        volumeSlider.type = 'range';
        volumeSlider.min = 0;
        volumeSlider.max = 1;
        volumeSlider.step = 0.01;
        volumeSlider.value = this.rackVolume.gain.value;
        volumeSlider.className = 'rack-volume';

        // MIDI learn button for volume
        const midiLearnBtn = document.createElement('button');
        midiLearnBtn.className = 'midi-learn-btn';
        midiLearnBtn.innerHTML = '<span>MIDI</span>';
        midiLearnBtn.setAttribute('data-param', 'volume');

        let learningTimeout;
        midiLearnBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            clearTimeout(learningTimeout);
            
            // Reset altri pulsanti MIDI learn
            container.querySelectorAll('.midi-learn-btn.learning').forEach(btn => {
                if (btn !== midiLearnBtn) {
                    btn.classList.remove('learning');
                    this.midiMapping.stopLearning();
                }
            });

            const isLearning = midiLearnBtn.classList.toggle('learning');
            if (isLearning) {
                this.midiMapping.startLearning('volume');
                learningTimeout = setTimeout(() => {
                    midiLearnBtn.classList.remove('learning');
                    this.midiMapping.stopLearning();
                }, 10000);
            } else {
                this.midiMapping.stopLearning();
            }
        });

        volumeSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.setVolume(value);
            this.vuMeter?.setVolume(value);
        });

        volumeContainer.appendChild(volumeSlider);
        volumeContainer.appendChild(midiLearnBtn);
        volumeAndVUContainer.appendChild(volumeContainer);
        volumeAndVUContainer.appendChild(this.vuMeter.getElement());

        // Add volume-vu-container to effects container
        effectsContainer.appendChild(volumeAndVUContainer);

        // Add shaper effect with label
        const shaperContainer = document.createElement('div');
        shaperContainer.className = 'effect-unit';
        const shaperLabel = document.createElement('div');
        shaperLabel.className = 'effect-label';
        shaperLabel.textContent = 'Shaper';
        shaperContainer.appendChild(shaperLabel);
        shaperContainer.appendChild(this.shaper.renderer.render());

        // Add delay effect with label
        const delayContainer = document.createElement('div');
        delayContainer.className = 'effect-unit';
        const delayLabel = document.createElement('div');
        delayLabel.className = 'effect-label';
        delayLabel.textContent = 'Delay';
        delayContainer.appendChild(delayLabel);
        delayContainer.appendChild(this.delay.renderer.render());

        // Add effects to effects container
        effectsContainer.appendChild(shaperContainer);
        effectsContainer.appendChild(delayContainer);
        
        mixerSection.appendChild(effectsContainer);
        
        // Add sidechain controls with label
        const sidechainContainer = document.createElement('div');
        sidechainContainer.className = 'effect-unit';
        const sidechainLabel = document.createElement('div');
        sidechainLabel.className = 'effect-label';
        sidechainLabel.textContent = 'Virtual Sidechain';
        sidechainContainer.appendChild(sidechainLabel);
        sidechainContainer.appendChild(this.virtualSidechain.renderer.render());
        mixerSection.appendChild(sidechainContainer);
        
        container.appendChild(mixerSection);
        return container;
    }

    onBeat(beat, time) {
        // Forward beat to sidechain
        this.virtualSidechain.onBeat(beat, time);
        // Implementazione specifica dello strumento
    }

    // Helper method for child classes
    connectToInstrumentOutput(node) {
        node.connect(this.instrumentOutput);
    }

    setMuted(isMuted) {
        this._isMuted = isMuted;
        this._updateVolume();
    }

    setSolo(isSoloed) {
        this._isSoloed = isSoloed;
        this._updateVolume();
    }

    _updateVolume() {
        if (this._isMuted || (this._hasSoloedInstruments && !this._isSoloed)) {
            this.rackVolume.gain.setValueAtTime(0, this.context.currentTime);
        } else {
            this.rackVolume.gain.setValueAtTime(this._savedVolume, this.context.currentTime);
        }
    }

    setVolume(value) {
        this._savedVolume = value;
        if (!this._isMuted) {
            this.rackVolume.gain.setValueAtTime(value, this.context.currentTime);
        }
    }

    onMIDIMessage(message) {
        // Prima gestisci il MIDI mapping
        const result = this.midiMapping.handleMIDIMessage(message);
        
        if (result.mapped) {
            // Gestione del volume
            if (result.param === 'volume') {
                this.setVolume(result.value);
                const volumeSlider = this.renderer.container.querySelector('.rack-volume');
                if (volumeSlider) {
                    volumeSlider.value = result.value;
                    volumeSlider.dispatchEvent(new Event('input'));
                }
                return true;
            }
            
            // Gestione di altri parametri mappati
            if (this.handleInstrumentMIDI && typeof this.handleInstrumentMIDI === 'function') {
                return this.handleInstrumentMIDI(message);
            }
        }
        
        return false;
    }
}

