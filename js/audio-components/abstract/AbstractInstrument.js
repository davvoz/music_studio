import { AbstractHTMLRender } from './AbstractHTMLRender.js';
import { AbstractAudioComponent } from './AbstractAudioComponent.js';
import { VUMeter } from '../../components/VUMeter.js';
import { DelayEffect } from '../effects/DelayEffect.js';
import { ShaperEffect } from '../effects/ShaperEffect.js';

export class AbstractInstrument extends AbstractAudioComponent {
    constructor(context, id) {
        super(context);
        this.id = id;
        this.renderer = new AbstractHTMLRender();
        
        // Create audio routing
        this.instrumentOutput = this.context.createGain();
        this.rackVolume = context.createGain();
        this.vuMeter = new VUMeter(context);
        
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
    }
    
    render() {
        const container = this.renderer.render();
        
        // Add rack mixer controls
        const mixerSection = document.createElement('div');
        mixerSection.className = 'rack-mixer';
        
        // Volume controls
        const volumeKnob = document.createElement('input');
        volumeKnob.type = 'range';
        volumeKnob.min = 0;
        volumeKnob.max = 1;
        volumeKnob.step = 0.01;
        volumeKnob.value = this.rackVolume.gain.value;
        volumeKnob.className = 'rack-volume';
        
        volumeKnob.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.setVolume(value);
            this.vuMeter.setVolume(value);
        });
        
        mixerSection.appendChild(volumeKnob);
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
}

