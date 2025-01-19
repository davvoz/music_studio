import { AbstractHTMLRender } from "../../abstract/AbstractHTMLRender.js";
import { Knob } from "../../../components/Knob.js";

export class TB303Render extends AbstractHTMLRender {
    constructor() {
        super();
        this.container.classList.add('tb303-mini');
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
                    <div class="pattern-buttons">
                        <button class="pattern-btn" data-pattern="random">RND</button>
                        <button class="pattern-btn" data-pattern="minor">MIN</button>
                        <button class="pattern-btn" data-pattern="major">MAJ</button>
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
        const steps = Array(16).fill().map(() => {
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
    }

    getStepData(step) {
        return {
            note: step.querySelector('.note').value,
            accent: step.querySelector('[data-type="accent"]').classList.contains('active'),
            slide: step.querySelector('[data-type="slide"]').classList.contains('active')
        };
    }

    generateRandomPattern() {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octaves = ['1', '2'];
        
        this.container.querySelectorAll('.step').forEach((step, index) => {
            // 70% chance of having a note
            if (Math.random() < 0.7) {
                const note = notes[Math.floor(Math.random() * notes.length)];
                const octave = octaves[Math.floor(Math.random() * octaves.length)];
                step.querySelector('.note').value = note + octave;
                
                // 30% chance of accent
                const accent = Math.random() < 0.3;
                step.querySelector('[data-type="accent"]').classList.toggle('active', accent);
                
                // 20% chance of slide if there's a next note
                const slide = Math.random() < 0.2;
                step.querySelector('[data-type="slide"]').classList.toggle('active', slide);
            } else {
                step.querySelector('.note').value = '';
                step.querySelector('[data-type="accent"]').classList.remove('active');
                step.querySelector('[data-type="slide"]').classList.remove('active');
            }
            
            // Notify sequence change
            this.sequenceChangeCallback?.(index, this.getStepData(step));
        });
    }

    generateRandomMinorPattern() {
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

        // Scegli una tonica casuale
        const roots = Object.keys(minorScaleNotes);
        const root = roots[Math.floor(Math.random() * roots.length)];
        const scale = minorScaleNotes[root];
        const octaves = ['1', '2'];
        
        this.container.querySelectorAll('.step').forEach((step, index) => {
            if (Math.random() < 0.7) { // 70% chance of having a note
                const note = scale[Math.floor(Math.random() * scale.length)];
                const octave = octaves[Math.floor(Math.random() * octaves.length)];
                step.querySelector('.note').value = note + octave;
                
                const accent = Math.random() < 0.3;
                step.querySelector('[data-type="accent"]').classList.toggle('active', accent);
                
                const slide = Math.random() < 0.2;
                step.querySelector('[data-type="slide"]').classList.toggle('active', slide);
            } else {
                step.querySelector('.note').value = '';
                step.querySelector('[data-type="accent"]').classList.remove('active');
                step.querySelector('[data-type="slide"]').classList.remove('active');
            }
            
            this.sequenceChangeCallback?.(index, this.getStepData(step));
        });
    }

    generateRandomMajorPattern() {
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

        // Scegli una tonica casuale
        const roots = Object.keys(majorScaleNotes);
        const root = roots[Math.floor(Math.random() * roots.length)];
        const scale = majorScaleNotes[root];
        const octaves = ['1', '2'];
        
        this.container.querySelectorAll('.step').forEach((step, index) => {
            if (Math.random() < 0.7) { // 70% chance of having a note
                const note = scale[Math.floor(Math.random() * scale.length)];
                const octave = octaves[Math.floor(Math.random() * octaves.length)];
                step.querySelector('.note').value = note + octave;
                
                // Maggiore probabilità di accenti sui tempi forti (1, 5, 9, 13)
                const accent = (index % 4 === 0) ? Math.random() < 0.5 : Math.random() < 0.2;
                step.querySelector('[data-type="accent"]').classList.toggle('active', accent);
                
                // Slide più probabili tra note vicine
                const slide = Math.random() < 0.15; // Leggermente meno slide per un feel più "maggiore"
                step.querySelector('[data-type="slide"]').classList.toggle('active', slide);
            } else {
                step.querySelector('.note').value = '';
                step.querySelector('[data-type="accent"]').classList.remove('active');
                step.querySelector('[data-type="slide"]').classList.remove('active');
            }
            
            this.sequenceChangeCallback?.(index, this.getStepData(step));
        });
    }

    savePattern(slot) {
        // Cattura il pattern prima di qualsiasi animazione
        const pattern = {
            steps: Array.from(this.container.querySelectorAll('.step')).map(step => this.getStepData(step))
        };
        localStorage.setItem(`tb303-pattern-${slot}`, JSON.stringify(pattern));
    }

    loadPattern(slot) {
        const savedPattern = localStorage.getItem(`tb303-pattern-${slot}`);
        if (!savedPattern) return;
        
        const pattern = JSON.parse(savedPattern);
        // Raggruppa tutte le modifiche prima di notificare
        const updates = [];
        
        this.container.querySelectorAll('.step').forEach((step, index) => {
            const data = pattern.steps[index];
            if (data) {
                step.querySelector('.note').value = data.note;
                step.querySelector('[data-type="accent"]').classList.toggle('active', data.accent);
                step.querySelector('[data-type="slide"]').classList.toggle('active', data.slide);
                updates.push([index, data]);
            }
        });
        
        // Notifica tutte le modifiche in un unico batch
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
}
