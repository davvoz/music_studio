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
        const knobsContainer = this.container.querySelector('.drum-knobs');
        knobsContainer.innerHTML = '';
        
        const drums = ['kick', 'snare', 'hihat', 'clap'];
        drums.forEach(drum => {
            const drumGroup = document.createElement('div');
            drumGroup.className = 'drum-knob-group';

            const mainControls = document.createElement('div');
            mainControls.className = 'main-controls';
            
            // Volume knob
            const volKnob = this.createKnobElement(`${drum}Volume`, `${drum.toUpperCase()}`, 0, 1, 0.7);
            mainControls.appendChild(volKnob);
            
            // Pitch knob
            const pitchKnob = this.createKnobElement(`${drum}Pitch`, 'PITCH', 0.5, 2, 1);
            mainControls.appendChild(pitchKnob);
            
            drumGroup.appendChild(mainControls);
            knobsContainer.appendChild(drumGroup);
        });
    }

    createKnobElement(param, label, min, max, defaultValue) {
        const wrap = document.createElement('div');
        wrap.className = 'knob-wrap';
        wrap.innerHTML = `<div class="knob drummachineknob"></div><span>${label}</span>`;

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

        wrap.knob = knob;
        return wrap;
    }

    getDefaultFreq(drum) {
        // Rimuoviamo questa funzione dato che non serve più
    }

    getDefaultEnvelopeValue(param) {
        const defaults = {
            Attack: 0.01,
            Decay: 0.1,
            Sustain: 0.5,
            Release: 0.1
        };
        return defaults[param] || 0.1;
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
                    if (cell.classList.contains('active')) {
                        if (cell.classList.contains('accent')) {
                            cell.classList.remove('active', 'accent');
                            this.sequenceChangeCallback?.(drum, step, false, 0);
                        } else {
                            cell.classList.add('accent');
                            this.sequenceChangeCallback?.(drum, step, true, 1.5);
                        }
                    } else {
                        cell.classList.add('active');
                        this.sequenceChangeCallback?.(drum, step, true, 1);
                    }
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
        // Ottimizza gestione eventi
        this._eventThrottle = null;
        
        const handleEvent = (e) => {
            if (this._eventThrottle) return;
            
            this._eventThrottle = setTimeout(() => {
                this._eventThrottle = null;
            }, 16);

            const target = e.target;
            if (target.closest('.drum-cell')) {
                this.handleCellClick(target.closest('.drum-cell'));
            } else if (target.closest('.pattern-btn')) {
                this.handlePatternClick(target.closest('.pattern-btn'));
            } else if (target.closest('.memory-btn')) {
                this.handleMemoryClick(target.closest('.memory-btn'));
            } else if (target.closest('.save-btn')) {
                this.handleSaveClick(target.closest('.save-btn'));
            }
        };

        this.container.addEventListener('click', handleEvent);
        this.container.addEventListener('touchstart', handleEvent, { passive: true });
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    handleEvent = (e) => {
        requestIdleCallback(() => {
            const target = e.target;
            if (target.closest('.drum-cell')) {
                this.handleCellClick(target.closest('.drum-cell'));
            } else if (target.closest('.pattern-btn')) {
                this.handlePatternClick(target.closest('.pattern-btn'));
            }
            // ... altri handler
        });
    };

    handleCellClick(cell) {
        const drum = cell.parentElement.dataset.drum;
        const step = parseInt(cell.dataset.step);

        if (!cell.classList.contains('active')) {
            cell.classList.add('active');
            this.sequenceChangeCallback?.(drum, step, true, 1);
        } else if (!cell.classList.contains('accent')) {
            cell.classList.add('accent');
            this.sequenceChangeCallback?.(drum, step, true, 1.5);
        } else {
            cell.classList.remove('active', 'accent');
            this.sequenceChangeCallback?.(drum, step, false, 0);
        }
    }

    handlePatternClick(patternBtn) {
        const type = patternBtn.dataset.pattern;
        requestAnimationFrame(() => {
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
            patternBtn.classList.add('active');
            setTimeout(() => patternBtn.classList.remove('active'), 200);
        });
    }

    handleMemoryClick(memoryBtn) {
        if (!memoryBtn || this.isSaving) return;

        requestAnimationFrame(() => {
            if (this.isSaveMode) {
                this.handleSaveMode(memoryBtn);
            } else {
                this.handleLoadMode(memoryBtn);
            }
        });
    }

    handleSaveClick(saveBtn) {
        if (this.isSaving) return;
        
        requestAnimationFrame(() => {
            this.isSaveMode = !this.isSaveMode;
            this.container.querySelectorAll('.memory-btn').forEach(btn => {
                btn.classList.toggle('saving', this.isSaveMode);
            });
        });
    }

    handleSaveMode(btn) {
        this.isSaving = true;
        this.savePattern(btn.dataset.slot);
        this.isSaveMode = false;
        
        requestAnimationFrame(() => {
            this.container.querySelectorAll('.memory-btn').forEach(b => b.classList.remove('saving'));
            btn.classList.add('saved');
            setTimeout(() => {
                btn.classList.remove('saved');
                this.isSaving = false;
            }, 300);
        });
    }

    handleLoadMode(btn) {
        this.loadPattern(btn.dataset.slot);
        requestAnimationFrame(() => {
            this.container.querySelectorAll('.memory-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
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
                    this.sequenceChangeCallback?.(drum, index, isActive, isActive ? 1 : 0);
                });
            }
        });
    }

    savePattern(slot) {
        const pattern = {};
        this.container.querySelectorAll('.drum-row').forEach(row => {
            const drum = row.dataset.drum;
            pattern[drum] = Array.from(row.querySelectorAll('.drum-cell')).map(cell => {
                if (cell.classList.contains('accent')) return 2;
                if (cell.classList.contains('active')) return 1;
                return 0;
            });
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
                    cell.classList.remove('active', 'accent');
                    if (value === 2) {
                        cell.classList.add('active', 'accent');
                        updates.push([drum, index, true, 1.5]);
                    } else if (value === 1) {
                        cell.classList.add('active');
                        updates.push([drum, index, true, 1]);
                    } else {
                        updates.push([drum, index, false, 0]);
                    }
                });
            }
        });

        requestAnimationFrame(() => {
            updates.forEach(([drum, index, active, velocity]) => {
                this.sequenceChangeCallback?.(drum, index, active, velocity);
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
