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
        this.currentOctaveShift = 0;  // Aggiunto per tenere traccia dello shift di ottava
        this.createInterface();
        this.isSaveMode = false;
        this.isSaving = false;  // Nuovo flag per evitare salvataggi multipli
        this.pendingUpdates = new Set();
        this.updateFrame = null;
        this.eventHandlers = new Map();
        this.setupEventDelegation();
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
                            <select class="key-select">
                                <option value="C">C</option>
                                <option value="C#">C#</option>
                                <option value="D">D</option>
                                <option value="D#">D#</option>
                                <option value="E">E</option>
                                <option value="F">F</option>
                                <option value="F#">F#</option>
                                <option value="G">G</option>
                                <option value="G#">G#</option>
                                <option value="A">A</option>
                                <option value="A#">A#</option>
                                <option value="B">B</option>
                            </select>
                            <button class="pattern-btn" data-pattern="random">RND</button>
                            <button class="pattern-btn" data-pattern="minor">MIN</button>
                            <button class="pattern-btn" data-pattern="major">MAJ</button>
                        </div>
                        <div class="pattern-transpose">
                            <button class="transpose-btn" data-dir="down">-8va</button>
                            <button class="transpose-btn" data-dir="up">+8va</button>
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
            distortion: 'DIST',
            octave: 'OCT'  // Aggiunto nuovo knob
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
        knobWrapper.setAttribute('data-param', param); // Aggiungi questo per lo stile CSS
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
            onChange: (v) => {
                if (param === 'octave') {
                    this.currentOctaveShift = Math.round(v * 4 - 2); // Converti da 0-1 a -2/+2
                    // Aggiorna tutte le note con la nuova ottava
                    this.container.querySelectorAll('.step').forEach((step, index) => {
                        this.sequenceChangeCallback?.(index, this.getStepData(step));
                    });
                }
                this.paramChangeCallback?.(param, v);
            }
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
            case 'octave':
                config.value = 0.5; // Centro (0)
                config.numTicks = 5;
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
        // Rimuovi tutti i vecchi event listener individuali e lascia solo
        // l'inizializzazione di base
        const selectedLength = 16;
        this.container.querySelector('.length-btn[data-length="16"]').classList.add('active');
    }

    setupEventDelegation() {
        // Rimuovi gli altri event listener e centralizza qui
        const handlers = {
            'click': {
                '.wave-btn': (e, target) => {
                    this.container.querySelectorAll('.wave-btn').forEach(btn => 
                        btn.classList.remove('active'));
                    target.classList.add('active');
                    this.paramChangeCallback?.('waveform', target.dataset.wave);
                },
                '.pattern-btn': this.handlePatternButtonClick.bind(this),
                '[data-type="accent"]': (e, target) => {
                    target.classList.toggle('active');
                    const step = target.closest('.step');
                    const index = Array.from(step.parentNode.children).indexOf(step);
                    this.sequenceChangeCallback?.(index, this.getStepData(step));
                },
                '[data-type="slide"]': (e, target) => {
                    target.classList.toggle('active');
                    const step = target.closest('.step');
                    const index = Array.from(step.parentNode.children).indexOf(step);
                    this.sequenceChangeCallback?.(index, this.getStepData(step));
                },
                '.memory-btn': this.handleMemoryButtonClick.bind(this),
                '.save-btn': this.handleSaveButtonClick.bind(this),
                '.length-btn': this.handleLengthButtonClick.bind(this),
                '.transpose-btn': this.handleTransposeButtonClick.bind(this)
            },
            'change': {
                '.note': this.handleNoteChange.bind(this),
                '.key-select': this.handleKeyChange.bind(this)
            }
        };

        // Rimuovi tutti gli altri event listener esistenti
        this.container.querySelectorAll('.controls button').forEach(btn => {
            btn.replaceWith(btn.cloneNode(true));
        });

        // Usa un singolo event listener per tipo
        Object.entries(handlers).forEach(([eventType, eventHandlers]) => {
            this.container.addEventListener(eventType, (e) => {
                for (const [selector, handler] of Object.entries(eventHandlers)) {
                    const target = e.target.closest(selector);
                    if (target) {
                        handler(e, target);
                        break;
                    }
                }
            }, { passive: true });
        });
    }

    handleWaveButtonClick(e, target) {
        this.queueUpdate(() => {
            this.container.querySelectorAll('.wave-btn').forEach(btn => 
                btn.classList.remove('active'));
            target.classList.add('active');
            this.paramChangeCallback?.('waveform', target.dataset.wave);
        });
    }

    handlePatternButtonClick(e, target) {
        const type = target.dataset.pattern;
        const length = parseInt(this.container.querySelector('.length-btn.active')?.dataset.length || '16');
        switch(type) {
            case 'random': this.generateRandomPattern(length); break;
            case 'minor': this.generateRandomMinorPattern(length); break;
            case 'major': this.generateRandomMajorPattern(length); break;
        }
        target.classList.add('active');
        setTimeout(() => target.classList.remove('active'), 200);
    }

    handleControlButtonClick(e, target) {
        if (!target.matches('[data-type="accent"], [data-type="slide"]')) return;
        
        const step = target.closest('.step');
        if (!step) return;

        target.classList.toggle('active');
        const index = Array.from(step.parentNode.children).indexOf(step);
        
        this.queueUpdate(() => {
            this.sequenceChangeCallback?.(index, this.getStepData(step));
        });
    }

    handleMemoryButtonClick(e, target) {
        if (this.isSaving) return;
        
        if (this.isSaveMode) {
            this.isSaving = true;
            this.savePattern(target.dataset.slot);
            this.isSaveMode = false;
            this.container.querySelectorAll('.memory-btn').forEach(b => b.classList.remove('saving'));
            target.classList.add('saved');
            setTimeout(() => {
                target.classList.remove('saved');
                this.isSaving = false;
            }, 300);
        } else {
            this.loadPattern(target.dataset.slot);
            this.container.querySelectorAll('.memory-btn').forEach(b => b.classList.remove('active'));
            target.classList.add('active');
        }
    }

    handleSaveButtonClick(e, target) {
        if (this.isSaving) return;
        this.isSaveMode = !this.isSaveMode;
        this.container.querySelectorAll('.memory-btn').forEach(btn => {
            btn.classList.toggle('saving', this.isSaveMode);
        });
    }

    handleLengthButtonClick(e, target) {
        this.container.querySelectorAll('.length-btn').forEach(b => b.classList.remove('active'));
        target.classList.add('active');
    }

    handleTransposeButtonClick(e, target) {
        this.transposePattern(target.dataset.dir);
        target.classList.add('active');
        setTimeout(() => target.classList.remove('active'), 200);
    }

    handleNoteChange(e, target) {
        const step = target.closest('.step');
        if (!step) return;
        const index = Array.from(step.parentNode.children).indexOf(step);
        this.sequenceChangeCallback?.(index, this.getStepData(step));
    }

    handleKeyChange(e, target) {
        // Implementa se necessario
    }

    highlightStep(stepIndex) {
        this.queueUpdate(() => {
            const steps = this.getCachedElement('.tb303-sequence').children;
            for (let i = 0; i < steps.length; i++) {
                steps[i].classList.toggle('playing', i === stepIndex);
            }
        });
    }

    handleWaveButtonClick(target) {
        if (!target.classList.contains('wave-btn')) return;
        
        this.container.querySelectorAll('.wave-btn').forEach(btn => 
            btn.classList.remove('active'));
        target.classList.add('active');
        this.paramChangeCallback?.('waveform', target.dataset.wave);
    }

    // Modifica il getStepData per usare direttamente currentOctaveShift
    getStepData(step) {
        const baseNote = step.querySelector('.note').value;
        if (!baseNote) {
            return {
                note: '',
                accent: step.querySelector('[data-type="accent"]').classList.contains('active'),
                slide: step.querySelector('[data-type="slide"]').classList.contains('active')
            };
        }

        // Usa il valore di ottava dal parametro
        const noteName = baseNote.slice(0, -1);
        const originalOctave = parseInt(baseNote.slice(-1));
        const newOctave = Math.max(0, Math.min(8, originalOctave + this.currentOctaveShift));
        
        return {
            note: noteName + newOctave,
            accent: step.querySelector('[data-type="accent"]').classList.contains('active'),
            slide: step.querySelector('[data-type="slide"]').classList.contains('active')
        };
    }

    generateRandomPattern(length = 16) {
        this.clearAllSteps();
        const selectedKey = this.container.querySelector('.key-select').value;
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const startIndex = notes.indexOf(selectedKey);
        const reorderedNotes = [...notes.slice(startIndex), ...notes.slice(0, startIndex)];
        
        const basePattern = [];
        for (let i = 0; i < length; i++) {
            if (Math.random() < 0.7) {
                // Usa direttamente l'ottava base senza adjustedOctave
                const baseOctave = Math.random() < 0.7 ? 1 : 2;
                basePattern.push({
                    note: (Math.random() < 0.6 ? 
                          reorderedNotes[Math.floor(Math.random() * 5)] : 
                          reorderedNotes[Math.floor(Math.random() * reorderedNotes.length)]) + baseOctave,
                    accent: Math.random() < 0.3,
                    slide: Math.random() < 0.2
                });
            } else {
                basePattern.push({ note: '', accent: false, slide: false });
            }
        }

        this.applyPattern(basePattern, length);
    }

    generateRandomMinorPattern(length = 16) {
        this.clearAllSteps();
        const selectedKey = this.container.querySelector('.key-select').value;
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

        const scale = minorScaleNotes[selectedKey];
        const basePattern = [];
        
        for (let i = 0; i < length; i++) {
            if (Math.random() < 0.7) {
                // Usa l'ottava base direttamente
                const baseOctave = Math.random() < 0.7 ? 1 : 2;
                basePattern.push({
                    note: scale[Math.floor(Math.random() * scale.length)] + baseOctave,
                    accent: Math.random() < 0.3,
                    slide: Math.random() < 0.2
                });
            } else {
                basePattern.push({ note: '', accent: false, slide: false });
            }
        }

        this.applyPattern(basePattern, length);
    }

    generateRandomMajorPattern(length = 16) {
        this.clearAllSteps();
        const selectedKey = this.container.querySelector('.key-select').value;
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

        const scale = majorScaleNotes[selectedKey];
        const basePattern = [];
        
        for (let i = 0; i < length; i++) {
            if (Math.random() < 0.7) {
                // Usa l'ottava base direttamente
                const baseOctave = Math.random() < 0.7 ? 1 : 2;
                basePattern.push({
                    note: scale[Math.floor(Math.random() * scale.length)] + baseOctave,
                    accent: (i % 4 === 0) ? Math.random() < 0.5 : Math.random() < 0.2,
                    slide: Math.random() < 0.15
                });
            } else {
                basePattern.push({ note: '', accent: false, slide: false });
            }
        }

        this.applyPattern(basePattern, length);
    }

    applyPattern(basePattern, length) {
        const steps = this.container.querySelectorAll('.step');
        for (let i = 0; i < 32; i++) {
            const patternStep = basePattern[i % length];
            const step = steps[i];
            
            // Rimuoviamo completamente la gestione della classe inactive
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
        if (this.updateFrame) return;
        
        this.updateFrame = requestAnimationFrame(() => {
            const steps = this.container.querySelectorAll('.step');
            steps.forEach(step => step.classList.remove('playing'));
            steps[stepIndex]?.classList.add('playing');
            this.updateFrame = null;
        });
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
