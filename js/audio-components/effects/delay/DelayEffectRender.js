import { AbstractHTMLRender } from '../../abstract/AbstractHTMLRender.js';
import { Knob } from '../../../components/Knob.js';

export class DelayEffectRender extends AbstractHTMLRender {
    constructor() {
        super();
        this.container.classList.add('delay-effect');
        this.paramChangeCallback = null;
        this.createInterface();
    }

    createInterface() {
        this.container.innerHTML = `
            <div class="delay-container">
                <div class="delay-controls"></div>
            </div>
        `;

        const controls = this.container.querySelector('.delay-controls');
        
        // Create knobs
        const timeKnob = this.createKnob('time', 'TIME', 0, 1, 0.3);
        const feedbackKnob = this.createKnob('feedback', 'FEEDBACK', 0, 0.9, 0.4);
        const mixKnob = this.createKnob('mix', 'MIX', 0, 1, 0);
        
        controls.appendChild(timeKnob);
        controls.appendChild(feedbackKnob);
        controls.appendChild(mixKnob);
    }

    createKnob(param, label, min, max, defaultValue) {
        const wrap = document.createElement('div');
        wrap.className = 'knob-wrap';
        wrap.innerHTML = `<div class="knob delayknob"></div><span>${label}</span>`;

        const knob = new Knob(wrap.querySelector('.knob'), {
            min,
            max,
            value: defaultValue,
            size: 45,
            startAngle: 30,
            endAngle: 330,
            onChange: (value) => {
                this.paramChangeCallback?.(param, value);
            }
        });

        return wrap;
    }

    setParameterChangeCallback(callback) {
        this.paramChangeCallback = callback;
    }
}
