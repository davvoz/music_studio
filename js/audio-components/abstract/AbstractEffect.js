import { AbstractAudioComponent } from './AbstractAudioComponent.js';
import { AbstractHTMLRender } from './AbstractHTMLRender.js';

export class AbstractEffect extends AbstractAudioComponent {
    constructor(context, id) {
        super(context);
        this.id = id;
        this.renderer = new AbstractHTMLRender();
        
        // Create wet/dry mix
        this.dryGain = this.context.createGain();
        this.wetGain = this.context.createGain();
        this.outputGain = this.context.createGain();
        
        // Set initial values
        this.dryGain.gain.value = 1;
        this.wetGain.gain.value = 0;
        this.outputGain.gain.value = 1;
        
        // Connect the base routing
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.outputGain);
        this.wetGain.connect(this.outputGain);
        this.outputGain.connect(this.output);
    }

    setWetDryMix(value) {
        // value 0-1: 0 = dry, 1 = wet
        this.wetGain.gain.value = value;
        this.dryGain.gain.value = 1 - value;
    }
}
