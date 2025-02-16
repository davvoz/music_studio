import { AbstractHTMLRender } from "../../abstract/AbstractHTMLRender.js";
import { Knob } from "../../../components/Knob.js"; // Aggiungi l'import del Knob

export class AIComposerRender extends AbstractHTMLRender {
    constructor(instanceId, composerInstance) {
        super();
        this.instanceId = instanceId;
        this.composer = composerInstance;
        this.container.classList.add('ai-composer');
        this.knobs = new Map(); // Aggiungi map per i knob
        this.createInterface();
    }

    createInterface() {
        // Main panel
        const panel = document.createElement('div');
        panel.className = 'ai-composer-panel';

        // Controls section
        const controlsSection = document.createElement('div');
        controlsSection.className = 'controls-section';

        // Create waveform control
        const waveformGroup = this.createControlGroup('Waveform', 
            this.createSelect('waveform-select', [
                { value: 'sawtooth', text: 'Saw' },
                { value: 'square', text: 'Square' },
                { value: 'triangle', text: 'Triangle' },
                { value: 'sine', text: 'Sine' }
            ])
        );

        // Create knobs container
        const knobsContainer = document.createElement('div');
        knobsContainer.className = 'knobs-container';

        // Define knobs
        const knobs = {
            cutoff: { name: 'CUTOFF', value: this.composer.parameters.cutoff },
            resonance: { name: 'RES', value: this.composer.parameters.resonance },
            attack: { name: 'ATT', value: this.composer.parameters.attack },
            decay: { name: 'DEC', value: this.composer.parameters.decay },
            sustain: { name: 'SUS', value: this.composer.parameters.sustain },
            release: { name: 'REL', value: this.composer.parameters.release }
        };

        // Create and append knobs
        Object.entries(knobs).forEach(([param, config]) => {
            const knobWrapper = this.createKnob(param, config.name, config.value);
            knobsContainer.appendChild(knobWrapper);
        });

        // Append elements in the correct order
        controlsSection.appendChild(knobsContainer);
        controlsSection.appendChild(waveformGroup);

        // Create and append other controls
        const otherControls = [
            this.createControlGroup('Scale', this.createSelect('scale-select', [
                { value: 'minor', text: 'Minor' },
                { value: 'major', text: 'Major' },
                { value: 'pentatonic', text: 'Pentatonic' }
            ])),
            this.createControlGroup('Root', this.createSelect('root-select', 
                ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
                .map(note => ({ value: note, text: note }))
            )),
            this.createControlGroup('Complexity', this.createSlider('complexity-slider', 
                { min: 0, max: 1, step: 0.01, value: 0.5 }
            )),
            this.createControlGroup('Variation', this.createSlider('variation-slider', 
                { min: 0, max: 1, step: 0.01, value: 0.3 }
            ))
        ];

        otherControls.forEach(control => controlsSection.appendChild(control));

        // Create and append action buttons
        const actionButtons = document.createElement('div');
        actionButtons.className = 'action-buttons';
        ['Generate', 'Play'].forEach(text => {
            const button = document.createElement('button');
            button.className = `${text.toLowerCase()}-btn`;
            button.textContent = text;
            actionButtons.appendChild(button);
        });
        controlsSection.appendChild(actionButtons);

        // Append everything to panel and container
        panel.appendChild(controlsSection);
        this.container.appendChild(panel);

        // Create and append sequence grid
        const sequenceGrid = document.createElement('div');
        sequenceGrid.className = 'sequence-grid';
        this.container.appendChild(sequenceGrid);

        this.createSequenceGrid();
        this.setupEventListeners();
    }

    createControlGroup(label, control) {
        const group = document.createElement('div');
        group.className = 'control-group';
        
        const labelEl = document.createElement('label');
        labelEl.textContent = label;
        
        group.appendChild(labelEl);
        group.appendChild(control);
        return group;
    }

    createSelect(className, options) {
        const select = document.createElement('select');
        select.className = className;
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.text;
            select.appendChild(option);
        });
        return select;
    }

    createSlider(className, params) {
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = className;
        Object.entries(params).forEach(([key, value]) => {
            slider[key] = value;
        });
        return slider;
    }

    createKnob(param, label, initialValue) {
        const knobWrapper = document.createElement('div');
        knobWrapper.className = 'knob-wrap';
        knobWrapper.setAttribute('data-param', param);

        const knobContainer = document.createElement('div');
        knobContainer.className = 'knob-container';

        const knobElement = document.createElement('div');
        knobElement.className = 'knob';

        const labelElement = document.createElement('span');
        labelElement.textContent = label;

        knobContainer.appendChild(knobElement);
        knobWrapper.appendChild(knobContainer);
        knobWrapper.appendChild(labelElement);

        // Configura il knob in base al parametro
        const config = {
            min: 0,
            max: 1,
            value: initialValue,
            size: 40,
            onChange: (v) => {
                // Invia direttamente al composer invece di usare il callback
                this.composer.updateParameter(param, v);
            }
        };

        // Configurazioni specifiche per parametro
        switch(param) {
            case 'attack':
            case 'release':
                config.max = 2;
                break;
        }

        const knob = new Knob(knobElement, config);
        this.knobs.set(param, knob);

        return knobWrapper;
    }

    createSequenceGrid() {
        const grid = this.container.querySelector('.sequence-grid');
        for (let i = 0; i < 16; i++) {
            const step = document.createElement('div');
            step.className = 'step';
            step.innerHTML = '<span class="note-display">-</span>';
            grid.appendChild(step);
        }
    }

    setupEventListeners() {
        // Rimuovi i vecchi listener per gli slider
        // Setup all control listeners
        this.container.querySelector('.waveform-select').addEventListener('change', e => {
            this.composer.updateParameter('waveform', e.target.value);
        });

        this.container.querySelector('.generate-btn').addEventListener('click', () => {
            this.composer.generatePattern();
        });

        this.container.querySelector('.play-btn').addEventListener('click', () => {
            if (this.composer.isPlaying) {
                this.composer.stop();
                e.target.textContent = 'Play';
            } else {
                this.composer.start();
                e.target.textContent = 'Stop';
            }
        });
    }

    updatePattern(pattern) {
        // Usa requestAnimationFrame per evitare aggiornamenti troppo frequenti
        if (this.updateRequest) {
            cancelAnimationFrame(this.updateRequest);
        }

        this.updateRequest = requestAnimationFrame(() => {
            const steps = this.container.querySelectorAll('.step');
            pattern.forEach((step, i) => {
                const el = steps[i];
                const noteDisplay = el.querySelector('.note-display');
                
                // Aggiorna solo se necessario
                if (el.classList.contains('active') !== step.active) {
                    el.classList.toggle('active', step.active);
                }
                
                const noteText = step.note ? this.formatNote(step.note) : '-';
                if (noteDisplay.textContent !== noteText) {
                    noteDisplay.textContent = noteText;
                }
            });
            this.updateRequest = null;
        });
    }

    highlightStep(step) {
        // Usa requestAnimationFrame per l'evidenziazione del passo corrente
        if (this.highlightRequest) {
            cancelAnimationFrame(this.highlightRequest);
        }

        this.highlightRequest = requestAnimationFrame(() => {
            const steps = this.container.querySelectorAll('.step');
            const currentStep = steps[this.currentHighlightedStep];
            if (currentStep) {
                currentStep.classList.remove('current');
            }
            
            steps[step]?.classList.add('current');
            this.currentHighlightedStep = step;
            this.highlightRequest = null;
        });
    }

    formatNote(midiNote) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midiNote / 12) - 1;
        const note = notes[midiNote % 12];
        return `${note}${octave}`;
    }
}
