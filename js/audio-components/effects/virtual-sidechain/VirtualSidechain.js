import { AbstractEffect } from '../../abstract/AbstractEffect.js';
import { VirtualSidechainRender } from './VirtualSidechainRender.js';

export class VirtualSidechain extends AbstractEffect {
    constructor(context) {
        super(context);
        this.instanceId = 'sidechain_' + Date.now();
        this.renderer = new VirtualSidechainRender(this.instanceId, this);
        
        // Sequencer state
        this.sequence = new Array(32).fill(false);
        this.currentStep = 0;
        
        // Sidechain parameters
        this.parameters = {
            attack: 0.1,
            release: 0.5,
            depth: 0.7,
            curve: 0.5,
            type: 0
        };

        // Timing and sync
        this.tempo = 120;
        this.lastTriggerTime = 0;
        this.nextTriggerTime = 0;

        // Audio nodes - riorganizza la catena audio per usare il sistema dry/wet
        this.gainNode = this.context.createGain();
        this.gainNode.gain.value = 1;

        // Collega l'input al dry path (suono non processato)
        this.input.connect(this.dryGain);
        
        // Collega l'input al wet path (suono con sidechain)
        this.input.connect(this.gainNode);
        this.gainNode.connect(this.wetGain);

        // Imposta mix iniziale a 50/50
        this.setWetDryMix(0.5);

        // Sync properties
        this.isSynced = true;
        this.sequenceLength = 32;
        this.internalStep = 0;
        this.lastBeatTime = 0;
        this.tempo = 120; // Default tempo
        this.beatDuration = 60 / this.tempo;
    }

    toggleStep(step) {
        this.sequence[step] = !this.sequence[step];
    }

    setType(type) {
        this.parameters.type = type;
    }

    updateParameter(param, value) {
        if (param in this.parameters) {
            this.parameters[param] = value;
        }
    }

    toggleSync() {
        this.isSynced = !this.isSynced;
        if (!this.isSynced) {
            // Start internal clock when not synced
            this.startInternalClock();
        } else {
            // Stop internal clock when synced
            this.stopInternalClock();
        }
    }

    setLength(length) {
        this.sequenceLength = length;
        // Truncate or extend sequence if needed
        if (this.sequence.length > length) {
            this.sequence = this.sequence.slice(0, length);
        } else while (this.sequence.length < length) {
            this.sequence.push(false);
        }
    }

    startInternalClock() {
        if (this.clockInterval) return;
        
        const tick = () => {
            const now = this.context.currentTime;
            if (now - this.lastBeatTime >= this.beatDuration) {
                this.internalStep = (this.internalStep + 1) % this.sequenceLength;
                this.lastBeatTime = now;
                
                if (this.sequence[this.internalStep]) {
                    this.triggerSidechain(now);
                }
                
                requestAnimationFrame(() => {
                    this.renderer.highlightStep(this.internalStep);
                });
            }
            this.clockInterval = requestAnimationFrame(tick);
        };
        
        tick();
    }

    stopInternalClock() {
        if (this.clockInterval) {
            cancelAnimationFrame(this.clockInterval);
            this.clockInterval = null;
        }
    }

    onBeat(beat, time) {
        if (!this.isSynced) return;

        // Adelantiamo leggermente il timing per compensare la latenza
        const lookahead = 0.005; // 5ms di anticipo
        const stepIndex = beat % this.sequenceLength;
        this.currentStep = stepIndex;

        requestAnimationFrame(() => {
            this.renderer.highlightStep(stepIndex);
        });
        
        if (this.sequence[stepIndex]) {
            // Triggeriamo il sidechain con un leggero anticipo
            this.triggerSidechain(time - lookahead);
        }
    }

    triggerSidechain(time) {
        const { attack, release, depth, curve, type } = this.parameters;
        
        const attackTime = attack * 0.1;
        const releaseTime = release * 0.5;
        const targetGain = Math.max(0.0001, 1 - depth);
        
        // Miglioriamo la precisione del timing
        const scheduleTime = Math.max(time, this.context.currentTime);
        const resetTime = scheduleTime + attackTime + releaseTime;

        this.gainNode.gain.cancelScheduledValues(scheduleTime);
        this.gainNode.gain.setValueAtTime(1, scheduleTime);
        
        switch(type) {
            case 0: // Classic
                this.gainNode.gain.linearRampToValueAtTime(targetGain, scheduleTime + attackTime);
                this.gainNode.gain.exponentialRampToValueAtTime(1, resetTime);
                break;
            
            case 1: // Modern
                this.gainNode.gain.exponentialRampToValueAtTime(targetGain, scheduleTime + attackTime);
                this.gainNode.gain.setTargetAtTime(1, scheduleTime + attackTime, releaseTime * 0.3);
                break;
            
            case 2: // Punch
                this.gainNode.gain.linearRampToValueAtTime(targetGain, scheduleTime + attackTime * 0.5);
                this.gainNode.gain.setTargetAtTime(1, scheduleTime + attackTime, releaseTime * 0.2);
                break;
        }

        // Assicuriamoci che il gain torni a 1
        this.gainNode.gain.setValueAtTime(1, resetTime + 0.01);
    }

    // Aggiungi metodo per il controllo del mix
    updateMix(value) {
        this.setWetDryMix(value);
    }

    // Implementa metodi per salvataggio/caricamento stato
    getState() {
        return {
            sequence: [...this.sequence],
            parameters: {...this.parameters}
        };
    }

    setState(state) {
        if (state.sequence) {
            this.sequence = [...state.sequence];
            this.sequence.forEach((active, step) => {
                this.renderer.updateStepState(step, active);
            });
        }
        if (state.parameters) {
            Object.assign(this.parameters, state.parameters);
        }
    }
}
