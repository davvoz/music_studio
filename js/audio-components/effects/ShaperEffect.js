import { AbstractEffect } from '../abstract/AbstractEffect.js';
import { ShaperEffectRender } from './shaper/ShaperEffectRender.js';

export class ShaperEffect extends AbstractEffect {
    constructor(context) {
        super(context);
        this.renderer = new ShaperEffectRender();
        
        // Create shaper node
        this.shaper = this.context.createWaveShaper();
        this.drive = this.context.createGain();
        
        // Set initial values
        this.drive.gain.value = 1;
        this.currentType = 'soft';
        this.updateCurve();
        
        // Connect shaper chain
        this.input.connect(this.drive);
        this.drive.connect(this.shaper);
        this.shaper.connect(this.wetGain);
        
        this.setupEvents();
    }

    setupEvents() {
        this.renderer.setParameterChangeCallback((param, value) => {
            switch(param) {
                case 'drive':
                    this.setDrive(value);
                    break;
                case 'mix':
                    this.setWetDryMix(value);
                    break;
                case 'type':
                    this.currentType = value;
                    this.updateCurve();
                    break;
            }
        });
    }

    setDrive(amount) {
        const value = Math.max(1, Math.min(100, amount));
        this.drive.gain.value = value;
        this.updateCurve();
    }

    updateCurve() {
        const samples = 44100;
        const curve = new Float32Array(samples);
        const driveAmount = this.drive.gain.value;

        for (let i = 0; i < samples; ++i) {
            const x = (i * 2) / samples - 1;
            curve[i] = this.applyCurveType(x, driveAmount);
        }

        this.shaper.curve = curve;
    }

    applyCurveType(x, drive) {
        const normalized = x * drive;
        
        switch(this.currentType) {
            case 'hard':
                return Math.sign(normalized) * (1 - Math.exp(-Math.abs(normalized)));
            case 'soft':
                return Math.tanh(normalized);
            case 'sine':
                return Math.sin(normalized * Math.PI / 2);
            case 'fuzz':
                return Math.sign(normalized) * Math.sqrt(Math.abs(normalized));
            default:
                return Math.tanh(normalized);
        }
    }
}
