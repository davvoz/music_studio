import { AbstractHTMLRender } from "../../abstract/AbstractHTMLRender.js";
import { Knob } from "../../../components/Knob.js";

export class TB303Render extends AbstractHTMLRender {
    constructor(instanceId) {
        super();
        this.instanceId = instanceId;
        this.container.classList.add('tb303-mini');
        this.container.setAttribute('data-instance-id', this.instanceId);
        this.paramChangeCallback = null;
        this.sequenceChangeCallback = null;
        this.createInterface();
        this.isSaveMode = false;
        this.isSaving = false;  // Nuovo flag per evitare salvataggi multipli
    }

    createInterface() {
        this.container.innerHTML = `
        <div class="tb303-container">
            <div class="tb303-controls">
                <div class="tb303-knobs"></div>
                <div class="knob-wrap">
                    <div class="wave-selector">
                        <button class="wave-btn active" data-wave="sawtooth">
                            <svg viewBox="0 0 40 20">
                                <path d="M5,15 L20,5 L20,15 L35,5" stroke="currentColor" fill="none" stroke-width="2"/>
                            </svg>
                        </button>
                        <button class="wave-btn" data-wave="square">
                            <svg viewBox="0 0 40 20">
                                <path d="M5,15 L5,5 L20,5 L20,15 L35,15 L35,5" stroke="currentColor" fill="none" stroke-width="2"/>
                            </svg>
                        </button>
                    </div>
                    <span>WAVE</span>
                </div>
                <div class="knob-wrap pattern-selector">
                    <div class="pattern-buttonsi">
                        <div class="pattern-type">
                            <button class="pattern-btn" data-pattern="random">RND</button>
                            <button class="pattern-btn" data-pattern="minor">MIN</button>
                            <button class="pattern-btn" data-pattern="major">MAJ</button>
                        </div>
                        <div class="pattern-length">
                            <button class="length-btn" data-length="4">4</button>
                            <button class="length-btn" data-length="8">8</button>
                            <button class="length-btn" data-length="16">16</button>
                            <button class="length-btn" data-length="32">32</button>
                        </div>
                    </div>
                    <div class="pattern-memory">
                        <button class="memory-btn" data-slot="1">1</button>
                        <button class="memory-btn" data-slot="2">2</button>
                        <button class="memory-btn" data-slot="3">3</button>
                        <button class="memory-btn" data-slot="4">4</button>
                    </div>
                    <div class="pattern-actions">
                        <button class="save-btn">SAVE</button>
                    </div>
                    <span>PATTERN</span>
                </div>
            </div>
            <div class="tb303-sequence"></div>
            </div>
        `;

        const knobs = {
            cutoff: 'CUTOFF',
            resonance: 'RES',
            envMod: 'ENV',
            decay: 'DECAY',
            accent: 'ACC',
            distortion: 'DIST'  // Aggiunto controllo distorsione
        };

        const knobsContainer = this.container.querySelector('.tb303-knobs');
        Object.entries(knobs).forEach(([param, label]) => {
            this.createKnob(param, label, knobsContainer);
        });

        this.createCompactSequencer();
        this.setupEventListeners();
        this.addCopyPasteControls(this.container.querySelector('.tb303-sequence'));
    }

    createKnob(param, label, container) {
        const knobWrapper = document.createElement('div');
        knobWrapper.className = 'knob-wrap';
        knobWrapper.innerHTML = `<div class="knob"></div><span>${label}</span>`;
        container.appendChild(knobWrapper);

        const config = {
            min: 0, 
            max: 1,
            value: 0.5,
            size: 60,
            startAngle: 30,
            endAngle: 330,
            numTicks: 11,
            onChange: (v) => this.paramChangeCallback?.(param, v)
        };

        // Configurazioni specifiche per ogni knob
        switch(param) {
            case 'cutoff':
                config.startAngle = 30;
                config.endAngle = 330;
                break;
            case 'resonance':
                config.value = 0.7;
                break;
            case 'distortion':
                config.value = 0.3;
                break;
        }

        new Knob(knobWrapper.querySelector('.knob'), config);
    }

    createCompactSequencer() {
        const seq = this.container.querySelector('.tb303-sequence');
        // Modifica da 16 a 32 step
        const steps = Array(32).fill().map(() => {
            const step = document.createElement('div');
            step.className = 'step';
            step.innerHTML = `
                <select class="note">
                    <option value="">-</option>
                    ${this.getNoteOptions()}
                </select>
                <div class="controls">
                    <button data-type="accent">A</button>
                    <button data-type="slide">S</button>
                </div>
            `;
            return step;
        });

        seq.append(...steps);
    }

    getNoteOptions() {
        return ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
            .map(note => ['1', '2'].map(oct => 
                `<option value="${note}${oct}">${note}${oct}</option>`
            )).flat().join('');
    }

    setupEventListeners() {
        this.container.querySelectorAll('.wave-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.container.querySelectorAll('.wave-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.paramChangeCallback?.('waveform', btn.dataset.wave);
            });
        });

        // Add button click handlers
        this.container.querySelectorAll('.controls button').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('active');
                const step = btn.closest('.step');
                const index = Array.from(step.parentNode.children).indexOf(step);
                if (index >= 0) {
                    this.sequenceChangeCallback?.(index, this.getStepData(step));
                }
            });
        });

        // Handle note changes
        this.container.querySelectorAll('.note').forEach((select, index) => {
            select.addEventListener('change', () => {
                const step = select.closest('.step');
                this.sequenceChangeCallback?.(index, this.getStepData(step));
            });
        });

        // Replace the old random pattern handlers with the new unified approach
        this.container.querySelectorAll('.pattern-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.pattern;
                switch(type) {
                    case 'random':
                        this.generateRandomPattern();
                        break;
                    case 'minor':
                        this.generateRandomMinorPattern();
                        break;
                    case 'major':
                        this.generateRandomMajorPattern();
                        break;
                }
                // Visual feedback
                btn.classList.add('active');
                setTimeout(() => btn.classList.remove('active'), 200);
            });
        });

        // Gestione salvataggio pattern
        let selectedSlot = null;
        
        this.container.querySelectorAll('.memory-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.isSaving) return; // Previeni click multipli durante il salvataggio
                
                if (this.isSaveMode) {
                    this.isSaving = true;  // Blocca altri salvataggi
                    this.savePattern(btn.dataset.slot);
                    this.isSaveMode = false;
                    this.container.querySelectorAll('.memory-btn').forEach(b => b.classList.remove('saving'));
                    btn.classList.add('saved');
                    setTimeout(() => {
                        btn.classList.remove('saved');
                        this.isSaving = false;  // Riabilita i salvataggi
                    }, 300);
                } else {
                    this.loadPattern(btn.dataset.slot);
                    this.container.querySelectorAll('.memory-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                }
            });
        });

        this.container.querySelector('.save-btn').addEventListener('click', () => {
            if (this.isSaving) return; // Previeni click multipli durante il salvataggio
            
            this.isSaveMode = !this.isSaveMode;
            this.container.querySelectorAll('.memory-btn').forEach(btn => {
                btn.classList.toggle('saving', this.isSaveMode);
            });
        });

        // Gestione dei pattern length buttons
        let selectedLength = 16; // Default pattern length
        this.container.querySelectorAll('.length-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.container.querySelectorAll('.length-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedLength = parseInt(btn.dataset.length);
            });
        });

        // Modifica della gestione dei pattern buttons
        this.container.querySelectorAll('.pattern-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.pattern;
                switch(type) {
                    case 'random':
                        this.generateRandomPattern(selectedLength);
                        break;
                    case 'minor':
                        this.generateRandomMinorPattern(selectedLength);
                        break;
                    case 'major':
                        this.generateRandomMajorPattern(selectedLength);
                        break;
                }
                btn.classList.add('active');
                setTimeout(() => btn.classList.remove('active'), 200);
            });
        });

        // Attiva il bottone 16 di default
        this.container.querySelector('.length-btn[data-length="16"]').classList.add('active');
    }

    getStepData(step) {
        return {
            note: step.querySelector('.note').value,
            accent: step.querySelector('[data-type="accent"]').classList.contains('active'),
            slide: step.querySelector('[data-type="slide"]').classList.contains('active')
        };
    }

    generateRandomPattern(length = 16) {
        this.clearAllSteps();
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octaves = ['1', '2'];
        
        // Prima genera il pattern base della lunghezza richiesta
        const basePattern = [];
        for (let i = 0; i < length; i++) {
            if (Math.random() < 0.7) {
                basePattern.push({
                    note: notes[Math.floor(Math.random() * notes.length)] + 
                          octaves[Math.floor(Math.random() * octaves.length)],
                    accent: Math.random() < 0.3,
                    slide: Math.random() < 0.2
                });
            } else {
                basePattern.push({ note: '', accent: false, slide: false });
            }
        }

        // Poi applica il pattern ripetendolo per tutti i 32 step
        const steps = this.container.querySelectorAll('.step');
        for (let i = 0; i < 32; i++) {
            const patternStep = basePattern[i % length];
            const step = steps[i];
            
            step.querySelector('.note').value = patternStep.note;
            step.querySelector('[data-type="accent"]').classList.toggle('active', patternStep.accent);
            step.querySelector('[data-type="slide"]').classList.toggle('active', patternStep.slide);
            
            this.sequenceChangeCallback?.(i, this.getStepData(step));
        }
    }

    generateRandomMinorPattern(length = 16) {
        this.clearAllSteps();
        // Natural minor scale (Aeolian mode): W-H-W-W-H-W-W
        // Relative to C: C, D, Eb, F, G, Ab, Bb
        const minorScaleNotes = {
            'C': ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'Bb'],
            'C#': ['C#', 'D#', 'E', 'F#', 'G#', 'A', 'B'],
            'D': ['D', 'E', 'F', 'G', 'A', 'Bb', 'C'],
            'D#': ['D#', 'F', 'F#', 'G#', 'A#', 'B', 'C#'],
            'E': ['E', 'F#', 'G', 'A', 'B', 'C', 'D'],
            'F': ['F', 'G', 'Ab', 'Bb', 'C', 'Db', 'Eb'],
            'F#': ['F#', 'G#', 'A', 'B', 'C#', 'D', 'E'],
            'G': ['G', 'A', 'Bb', 'C', 'D', 'Eb', 'F'],
            'G#': ['G#', 'A#', 'B', 'C#', 'D#', 'E', 'F#'],
            'A': ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
            'A#': ['A#', 'C', 'C#', 'D#', 'F', 'F#', 'G#'],
            'B': ['B', 'C#', 'D', 'E', 'F#', 'G', 'A']
        };

        const roots = Object.keys(minorScaleNotes);
        const root = roots[Math.floor(Math.random() * roots.length)];
        const scale = minorScaleNotes[root];
        const octaves = ['1', '2'];
        
        // Genera il pattern base
        const basePattern = [];
        for (let i = 0; i < length; i++) {
            if (Math.random() < 0.7) {
                basePattern.push({
                    note: scale[Math.floor(Math.random() * scale.length)] + 
                          octaves[Math.floor(Math.random() * octaves.length)],
                    accent: Math.random() < 0.3,
                    slide: Math.random() < 0.2
                });
            } else {
                basePattern.push({ note: '', accent: false, slide: false });
            }
        }

        // Applica il pattern in loop
        const steps = this.container.querySelectorAll('.step');
        for (let i = 0; i < 32; i++) {
            const patternStep = basePattern[i % length];
            const step = steps[i];
            
            step.querySelector('.note').value = patternStep.note;
            step.querySelector('[data-type="accent"]').classList.toggle('active', patternStep.accent);
            step.querySelector('[data-type="slide"]').classList.toggle('active', patternStep.slide);
            
            this.sequenceChangeCallback?.(i, this.getStepData(step));
        }
    }

    generateRandomMajorPattern(length = 16) {
        this.clearAllSteps();
        // Major scale: W-W-H-W-W-W-H
        const majorScaleNotes = {
            'C': ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
            'C#': ['C#', 'D#', 'F', 'F#', 'G#', 'A#', 'C'],
            'D': ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
            'D#': ['D#', 'F', 'G', 'G#', 'A#', 'C', 'D'],
            'E': ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'],
            'F': ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'],
            'F#': ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'F'],
            'G': ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
            'G#': ['G#', 'A#', 'C', 'C#', 'D#', 'F', 'G'],
            'A': ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'],
            'A#': ['A#', 'C', 'D', 'D#', 'F', 'G', 'A'],
            'B': ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#']
        };

        const roots = Object.keys(majorScaleNotes);
        const root = roots[Math.floor(Math.random() * roots.length)];
        const scale = majorScaleNotes[root];
        const octaves = ['1', '2'];
        
        // Genera il pattern base
        const basePattern = [];
        for (let i = 0; i < length; i++) {
            if (Math.random() < 0.7) {
                basePattern.push({
                    note: scale[Math.floor(Math.random() * scale.length)] + 
                          octaves[Math.floor(Math.random() * octaves.length)],
                    accent: (i % 4 === 0) ? Math.random() < 0.5 : Math.random() < 0.2,
                    slide: Math.random() < 0.15
                });
            } else {
                basePattern.push({ note: '', accent: false, slide: false });
            }
        }

        // Applica il pattern in loop
        const steps = this.container.querySelectorAll('.step');
        for (let i = 0; i < 32; i++) {
            const patternStep = basePattern[i % length];
            const step = steps[i];
            
            step.querySelector('.note').value = patternStep.note;
            step.querySelector('[data-type="accent"]').classList.toggle('active', patternStep.accent);
            step.querySelector('[data-type="slide"]').classList.toggle('active', patternStep.slide);
            
            this.sequenceChangeCallback?.(i, this.getStepData(step));
        }
    }

    clearAllSteps() {
        this.container.querySelectorAll('.step').forEach((step, index) => {
            step.querySelector('.note').value = '';
            step.querySelector('[data-type="accent"]').classList.remove('active');
            step.querySelector('[data-type="slide"]').classList.remove('active');
            this.sequenceChangeCallback?.(index, this.getStepData(step));
        });
    }

    savePattern(slot) {
        const pattern = {};
        this.container.querySelectorAll('.step').forEach((step, index) => {
            pattern[index] = {
                note: step.querySelector('.note').value,
                accent: step.querySelector('[data-type="accent"]').classList.contains('active'),
                slide: step.querySelector('[data-type="slide"]').classList.contains('active')
            };
        });
        // Usa l'ID univoco nella chiave del localStorage
        localStorage.setItem(`${this.instanceId}-pattern-${slot}`, JSON.stringify(pattern));
        // Salva l'ultimo pattern usato per questa istanza
        localStorage.setItem(`${this.instanceId}-last-pattern`, slot);
    }

    loadPattern(slot) {
        // Usa l'ID univoco per recuperare il pattern
        const savedPattern = localStorage.getItem(`${this.instanceId}-pattern-${slot}`);
        if (!savedPattern) return;

        const pattern = JSON.parse(savedPattern);
        const updates = [];

        this.container.querySelectorAll('.step').forEach((step, index) => {
            const data = pattern[index];
            if (data) {
                step.querySelector('.note').value = data.note;
                step.querySelector('[data-type="accent"]').classList.toggle('active', data.accent);
                step.querySelector('[data-type="slide"]').classList.toggle('active', data.slide);
                updates.push([index, data]);
            }
        });

        requestAnimationFrame(() => {
            updates.forEach(([index, data]) => {
                this.sequenceChangeCallback?.(index, data);
            });
        });
    }

    setParameterChangeCallback(callback) {
        this.paramChangeCallback = callback;
    }

    setSequenceChangeCallback(callback) {
        this.sequenceChangeCallback = callback;
    }

    highlightStep(stepIndex) {
        // Rimuovi l'evidenziazione precedente
        this.container.querySelectorAll('.step').forEach(step => 
            step.classList.remove('playing'));
        
        // Evidenzia lo step corrente
        const currentStep = this.container.querySelectorAll('.step')[stepIndex];
        if (currentStep) {
            currentStep.classList.add('playing');
        }
    }

    addCopyPasteControls(container) {
        // Add your implementation for copy-paste controls here
    }

    copySteps(start, end) {
        return Array.from(this.container.querySelectorAll('.step'))
            .slice(start, end)
            .map(step => this.getStepData(step));
    }

    pasteSteps(data, targetStep) {
        data.forEach((stepData, index) => {
            const step = this.container.querySelectorAll('.step')[targetStep + index];
            if (step) {
                step.querySelector('.note').value = stepData.note;
                step.querySelector('[data-type="accent"]').classList.toggle('active', stepData.accent);
                step.querySelector('[data-type="slide"]').classList.toggle('active', stepData.slide);
                this.sequenceChangeCallback?.(targetStep + index, stepData);
            }
        });
    }
}
