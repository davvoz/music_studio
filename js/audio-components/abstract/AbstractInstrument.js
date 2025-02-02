import { AbstractHTMLRender } from './AbstractHTMLRender.js';
import { AbstractAudioComponent } from './AbstractAudioComponent.js';
import { VUMeter } from '../../components/VUMeter.js';
import { DelayEffect } from '../effects/DelayEffect.js';
import { ShaperEffect } from '../effects/ShaperEffect.js';
import { MIDIMapping } from '../../core/MIDIMapping.js';  // Aggiungi questa importazione

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
        
        // Set initial values
        this.rackVolume.gain.value = 0.8;
        this._savedVolume = 0.8;
        this._isMuted = false;
        this._isSoloed = false;
        
        // Connect the audio chain with effects
        this.instrumentOutput.connect(this.shaper.input);
        this.shaper.connect(this.delay.input);
        this.delay.connect(this.rackVolume);
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
        mixerSection.appendChild(volumeContainer);
        mixerSection.appendChild(this.vuMeter.getElement());
        
        // Add effects controls
        const shaperControls = this.shaper.renderer.render();
        const delayControls = this.delay.renderer.render();
        mixerSection.appendChild(shaperControls);
        mixerSection.appendChild(delayControls);
        
        container.appendChild(mixerSection);
        return container;
    }

    onBeat(beat, time) {
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
        console.log('AbstractInstrument MIDI result:', result);
        
        if (result.mapped) {
            // Gestisci i controlli del rack
            if (result.param === 'volume') {
                const value = result.value;
                this.setVolume(value);
                
                // Aggiorna UI
                const volumeSlider = this.renderer.container.querySelector('.rack-volume');
                if (volumeSlider) {
                    volumeSlider.value = value;
                    volumeSlider.dispatchEvent(new Event('input'));
                }
                return;
            }

            // Lascia che le classi figlie gestiscano i loro controlli specifici
            if (this.handleInstrumentMIDI) {
                this.handleInstrumentMIDI(message);
            }
        }
    }
}

