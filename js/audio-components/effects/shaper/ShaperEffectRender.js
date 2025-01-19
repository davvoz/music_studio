import { AbstractHTMLRender } from '../../abstract/AbstractHTMLRender.js';
import { Knob } from '../../../components/Knob.js';

export class ShaperEffectRender extends AbstractHTMLRender {
    constructor() {
        super();
        this.container.classList.add('shaper-effect');
        this.paramChangeCallback = null;
        this.createInterface();
    }

    createInterface() {
        this.container.innerHTML = `
            <div class="shaper-container">
                <div class="shaper-controls"></div>
                <div class="shaper-type">
                    <select class="type-selector">
                        <option value="soft">Soft</option>
                        <option value="hard">Hard</option>
                        <option value="sine">Sine</option>
                        <option value="fuzz">Fuzz</option>
                    </select>
                </div>
            </div>
        `;

        const controls = this.container.querySelector('.shaper-controls');
        
        // Create knobs
        const driveKnob = this.createKnob('drive', 'DRIVE', 1, 100, 1);
        const mixKnob = this.createKnob('mix', 'MIX', 0, 1, 0);
        
        controls.appendChild(driveKnob);
        controls.appendChild(mixKnob);

        // Add type selector event
        this.container.querySelector('.type-selector').addEventListener('change', (e) => {
            this.paramChangeCallback?.('type', e.target.value);
        });
    }

    createKnob(param, label, min, max, defaultValue) {
        const wrap = document.createElement('div');
        wrap.className = 'knob-wrap';
        wrap.innerHTML = `<div class="knob shaperknob"></div><span>${label}</span>`;

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
