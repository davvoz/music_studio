import { AbstractHTMLRender } from "../../abstract/AbstractHTMLRender.js";
import { Knob } from "../../../components/Knob.js";

export class DrumMachineRender extends AbstractHTMLRender {
    constructor() {
        super();
        this.container.classList.add('drum-machine');
        this.paramChangeCallback = null;
        this.sequenceChangeCallback = null;
        this.isSaveMode = false;
        this.isSaving = false;  // Nuovo flag per evitare salvataggi multipli
        this.createInterface();
        this.setupEventListeners();
    }

    createInterface() {
        this.container.innerHTML = `
        <div class="drum-container">
            <div class="drum-controls">
                <div class="drum-samples">
                    <div class="sample-loader" data-drum="kick">
                        <span>KICK</span>
                        <input type="file" accept="audio/*" data-drum="kick">
                        <div class="sample-status">No sample loaded</div>
                    </div>
                    <div class="sample-loader" data-drum="snare">
                        <span>SNARE</span>
                        <input type="file" accept="audio/*" data-drum="snare">
                        <div class="sample-status">No sample loaded</div>
                    </div>
                    <div class="sample-loader" data-drum="hihat">
                        <span>HIHAT</span>
                        <input type="file" accept="audio/*" data-drum="hihat">
                        <div class="sample-status">No sample loaded</div>
                    </div>
                    <div class="sample-loader" data-drum="clap">
                        <span>CLAP</span>
                        <input type="file" accept="audio/*" data-drum="clap">
                        <div class="sample-status">No sample loaded</div>
                    </div>
                </div>
                <div class="drum-knobs"></div>
                <div class="knob-wrap pattern-selector">
                    <div class="pattern-buttons">
                        <button class="pattern-btn" data-pattern="basic">BASIC</button>
                        <button class="pattern-btn" data-pattern="house">HOUSE</button>
                        <button class="pattern-btn" data-pattern="break">BREAK</button>
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
            <div class="drum-grid"></div>
            </div>
        `;

        this.createKnobs();
        this.createSequencer();
        this.setupSampleLoaders();
    }

    createKnobs() {
        const knobs = {
            kickVolume: 'KICK',
            snareVolume: 'SNARE',
            hihatVolume: 'HIHAT',
            clapVolume: 'CLAP'
        };

        const knobsContainer = this.container.querySelector('.drum-knobs');
        
        Object.entries(knobs).forEach(([param, label]) => {
            const knobWrapper = document.createElement('div');
            knobWrapper.className = 'knob-wrap';
            knobWrapper.innerHTML = `<div class="knob"></div><span>${label}</span>`;
            knobsContainer.appendChild(knobWrapper);

            new Knob(knobWrapper.querySelector('.knob'), {
                min: 0,
                max: 1,
                value: 0.7,
                size: 60,
                startAngle: 30,
                endAngle: 330,
                onChange: (v) => this.paramChangeCallback?.(param, v)
            });
        });
    }

    createSequencer() {
        const grid = this.container.querySelector('.drum-grid');
        const drums = ['kick', 'snare', 'hihat', 'clap'];

        drums.forEach(drum => {
            const row = document.createElement('div');
            row.className = 'drum-row';
            row.dataset.drum = drum;

            for (let step = 0; step < 16; step++) {
                const cell = document.createElement('div');
                cell.className = 'drum-cell';
                cell.dataset.step = step;
                cell.addEventListener('click', () => {
                    cell.classList.toggle('active');
                    this.sequenceChangeCallback?.(
                        drum,
                        step,
                        cell.classList.contains('active')
                    );
                });
                row.appendChild(cell);
            }

            grid.appendChild(row);
        });
    }

    setupSampleLoaders() {
        // Gestione click sui sample loader
        this.container.querySelectorAll('.sample-loader').forEach(loader => {
            loader.addEventListener('click', () => {
                const input = loader.querySelector('input[type="file"]');
                input.click();
            });
        });

        // Gestione del cambiamento del file
        this.container.querySelectorAll('input[type="file"]').forEach(input => {
            input.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                const drum = e.target.dataset.drum;
                const status = input.parentElement.querySelector('.sample-status');
                
                if (file) {
                    try {
                        status.textContent = 'Loading...';
                        status.classList.add('loading');
                        
                        await this.paramChangeCallback?.('loadSample', { drum, file });
                        
                        status.textContent = file.name;
                        status.classList.remove('loading');
                        status.classList.add('loaded');
                    } catch (error) {
                        console.error('Error loading sample:', error);
                        status.textContent = 'Error loading sample';
                        status.classList.remove('loading');
                        status.classList.add('error');
                    }
                }
            });

            // Previeni la propagazione del click dell'input
            input.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        });
    }

    setupEventListeners() {
        // Pattern generation handlers
        this.container.querySelectorAll('.pattern-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.pattern;
                switch(type) {
                    case 'basic':
                        this.generateBasicPattern();
                        break;
                    case 'house':
                        this.generateHousePattern();
                        break;
                    case 'break':
                        this.generateBreakPattern();
                        break;
                }
                btn.classList.add('active');
                setTimeout(() => btn.classList.remove('active'), 200);
            });
        });

        // Pattern memory handlers
        this.container.querySelectorAll('.memory-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.isSaving) return;
                
                if (this.isSaveMode) {
                    this.isSaving = true;
                    this.savePattern(btn.dataset.slot);
                    this.isSaveMode = false;
                    this.container.querySelectorAll('.memory-btn').forEach(b => b.classList.remove('saving'));
                    btn.classList.add('saved');
                    setTimeout(() => {
                        btn.classList.remove('saved');
                        this.isSaving = false;
                    }, 300);
                } else {
                    this.loadPattern(btn.dataset.slot);
                    this.container.querySelectorAll('.memory-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                }
            });
        });

        this.container.querySelector('.save-btn').addEventListener('click', () => {
            if (this.isSaving) return;
            
            this.isSaveMode = !this.isSaveMode;
            this.container.querySelectorAll('.memory-btn').forEach(btn => {
                btn.classList.toggle('saving', this.isSaveMode);
            });
        });
    }

    generateBasicPattern() {
        const pattern = {
            kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
            snare: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
            hihat: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
            clap:  [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0]
        };
        this.applyPattern(pattern);
    }

    generateHousePattern() {
        const pattern = {
            kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
            snare: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
            hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
            clap:  [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,1]
        };
        this.applyPattern(pattern);
    }

    generateBreakPattern() {
        const pattern = {
            kick:  [1,0,0,1, 0,1,0,0, 1,0,1,0, 0,0,1,0],
            snare: [0,0,1,0, 1,0,0,1, 0,1,0,0, 1,0,0,1],
            hihat: [1,1,0,1, 1,0,1,1, 0,1,1,0, 1,1,0,1],
            clap:  [0,0,1,0, 0,1,0,0, 0,0,1,0, 1,0,0,0]
        };
        this.applyPattern(pattern);
    }

    applyPattern(pattern) {
        Object.entries(pattern).forEach(([drum, steps]) => {
            const row = this.container.querySelector(`.drum-row[data-drum="${drum}"]`);
            if (row) {
                steps.forEach((value, index) => {
                    const cell = row.querySelector(`[data-step="${index}"]`);
                    const isActive = Boolean(value);
                    cell.classList.toggle('active', isActive);
                    this.sequenceChangeCallback?.(drum, index, isActive);
                });
            }
        });
    }

    savePattern(slot) {
        const pattern = {};
        this.container.querySelectorAll('.drum-row').forEach(row => {
            const drum = row.dataset.drum;
            pattern[drum] = Array.from(row.querySelectorAll('.drum-cell')).map(cell => 
                cell.classList.contains('active') ? 1 : 0
            );
        });
        localStorage.setItem(`drum-pattern-${slot}`, JSON.stringify(pattern));
    }

    loadPattern(slot) {
        const savedPattern = localStorage.getItem(`drum-pattern-${slot}`);
        if (!savedPattern) return;

        const pattern = JSON.parse(savedPattern);
        const updates = [];

        Object.entries(pattern).forEach(([drum, steps]) => {
            const row = this.container.querySelector(`.drum-row[data-drum="${drum}"]`);
            if (row) {
                steps.forEach((value, index) => {
                    const cell = row.querySelector(`[data-step="${index}"]`);
                    const isActive = Boolean(value);
                    cell.classList.toggle('active', isActive);
                    updates.push([drum, index, isActive]);
                });
            }
        });

        // Batch update
        requestAnimationFrame(() => {
            updates.forEach(([drum, index, isActive]) => {
                this.sequenceChangeCallback?.(drum, index, isActive);
            });
        });
    }

    highlightStep(step) {
        // Remove previous highlight
        this.container.querySelectorAll('.drum-cell').forEach(cell => {
            cell.classList.remove('playing');
        });

        // Highlight current step
        this.container.querySelectorAll(`[data-step="${step}"]`).forEach(cell => {
            cell.classList.add('playing');
        });
    }

    setParameterChangeCallback(callback) {
        this.paramChangeCallback = callback;
    }

    setSequenceChangeCallback(callback) {
        this.sequenceChangeCallback = callback;
    }
}
