import { AbstractHTMLRender } from "../../abstract/AbstractHTMLRender.js";

export class AIComposerRender extends AbstractHTMLRender {
    constructor(instanceId, composerInstance) {
        super();
        this.instanceId = instanceId;
        this.composer = composerInstance;
        this.container.classList.add('ai-composer');
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

        // Create ADSR controls
        const adsrControls = [
            { name: 'Attack', min: 0, max: 2, step: 0.01, value: 0.01 },
            { name: 'Decay', min: 0, max: 1, step: 0.01, value: 0.1 },
            { name: 'Sustain', min: 0, max: 1, step: 0.01, value: 0.7 },
            { name: 'Release', min: 0, max: 2, step: 0.01, value: 0.3 }
        ].map(param => this.createControlGroup(param.name, 
            this.createSlider(`${param.name.toLowerCase()}-slider`, param))
        );

        // Create scale control
        const scaleGroup = this.createControlGroup('Scale',
            this.createSelect('scale-select', [
                { value: 'minor', text: 'Minor' },
                { value: 'major', text: 'Major' },
                { value: 'pentatonic', text: 'Pentatonic' }
            ])
        );

        // Create root note control
        const rootGroup = this.createControlGroup('Root',
            this.createSelect('root-select', [
                'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'
            ].map(note => ({ value: note, text: note })))
        );

        // Create complexity and variation controls
        const complexityGroup = this.createControlGroup('Complexity',
            this.createSlider('complexity-slider', { min: 0, max: 1, step: 0.01, value: 0.5 })
        );
        const variationGroup = this.createControlGroup('Variation',
            this.createSlider('variation-slider', { min: 0, max: 1, step: 0.01, value: 0.3 })
        );

        // Create action buttons
        const actionButtons = document.createElement('div');
        actionButtons.className = 'action-buttons';
        ['Generate', 'Play'].forEach(text => {
            const button = document.createElement('button');
            button.className = `${text.toLowerCase()}-btn`;
            button.textContent = text;
            actionButtons.appendChild(button);
        });

        // Append all controls
        [waveformGroup, ...adsrControls, scaleGroup, rootGroup, 
         complexityGroup, variationGroup, actionButtons].forEach(el => 
            controlsSection.appendChild(el)
        );

        panel.appendChild(controlsSection);

        // Create sequence grid container
        const sequenceGrid = document.createElement('div');
        sequenceGrid.className = 'sequence-grid';

        // Append everything to container
        this.container.appendChild(panel);
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

        // ADSR listeners
        ['attack', 'decay', 'sustain', 'release'].forEach(param => {
            this.container.querySelector(`.${param}-slider`).addEventListener('input', e => {
                this.composer.updateParameter(param, parseFloat(e.target.value));
            });
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
