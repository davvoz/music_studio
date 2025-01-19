import { AbstractEffect } from '../abstract/AbstractEffect.js';
import { DelayEffectRender } from './delay/DelayEffectRender.js';

export class DelayEffect extends AbstractEffect {
    constructor(context) {
        super(context);
        this.renderer = new DelayEffectRender();
        
        // Create delay nodes
        this.delay = this.context.createDelay(2.0);
        this.feedback = this.context.createGain();
        
        // Set default values
        this.delay.delayTime.value = 0.3;
        this.feedback.gain.value = 0.4;
        
        // Connect delay chain
        this.input.connect(this.delay);
        this.delay.connect(this.feedback);
        this.feedback.connect(this.delay);
        this.delay.connect(this.wetGain);
        
        this.setupEvents();
    }

    setupEvents() {
        this.renderer.setParameterChangeCallback((param, value) => {
            switch(param) {
                case 'time':
                    this.delay.delayTime.value = value;
                    break;
                case 'feedback':
                    this.feedback.gain.value = value;
                    break;
                case 'mix':
                    this.setWetDryMix(value);
                    break;
            }
        });
    }
}
