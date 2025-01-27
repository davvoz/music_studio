import { AbstractHTMLRender } from "../../abstract/AbstractHTMLRender.js";
import { Knob } from "../../../components/Knob.js";

export class DrumMachineRender extends AbstractHTMLRender {
    constructor(instanceId) {
        super();
        this.instanceId = instanceId;
        this.container.classList.add('drum-machine');
        this.container.setAttribute('data-instance-id', this.instanceId);
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
                <div class="pattern-selectore">
                    <div class="pattern-memory">
                        <button class="memory-btn" data-slot="1">1</button>
                        <button class="memory-btn" data-slot="2">2</button>
                        <button class="memory-btn" data-slot="3">3</button>
                        <button class="memory-btn" data-slot="4">4</button>
                    </div>
                    <div class="pattern-actionse">
                        <button class="save-btn">SAVE</button>
                    </div>
                </div>
            </div>
            <div class="drum-grid"></div>
            </div>
        `;

        this.createKnobs();
        this.createSequencer();
        this.setupSampleLoaders();
        this.addCopyPasteControls(this.container.querySelector('.drum-grid'));
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
        const stepsPerBar = 8; // 8 step per battuta
        const totalSteps = 32; // 4 battute da 8 step

        drums.forEach(drum => {
            const row = document.createElement('div');
            row.className = 'drum-row';
            row.dataset.drum = drum;

            for (let step = 0; step < totalSteps; step++) {
                const cell = document.createElement('div');
                cell.className = 'drum-cell';
                cell.dataset.step = step;
                
                // Aggiungiamo una classe per marcare l'inizio di ogni battuta
                if (step % stepsPerBar === 0) {
                    cell.classList.add('bar-start');
                }
                // Aggiungiamo una classe per marcare la metà di ogni battuta
                if (step % (stepsPerBar/2) === 0) {
                    cell.classList.add('half-bar');
                }

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
        this.container.addEventListener('click', (e) => {
            const target = e.target;
            if (target.closest('.memory-btn')) {
                this.handleMemoryClick(target.closest('.memory-btn'));
            } else if (target.closest('.save-btn')) {
                this.handleSaveClick(target.closest('.save-btn'));
            }
        });
    }

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

    handleMemoryClick(memoryBtn) {
        if (!memoryBtn) return;

        if (this.isSaveMode) {
            this.handleSaveMode(memoryBtn);
        } else {
            this.handleLoadMode(memoryBtn);
        }
    }

    handleSaveClick(saveBtn) {
        this.isSaveMode = !this.isSaveMode;
        this.container.querySelectorAll('.memory-btn').forEach(btn => {
            btn.classList.toggle('saving', this.isSaveMode);
        });
    }

    handleSaveMode(btn) {
        if (this.isSaving) return;  // Prevent multiple saves
        this.isSaving = true;
        
        const slot = btn.dataset.slot;
        this.paramChangeCallback?.('savePattern', slot);
        this.isSaveMode = false;
        
        this.container.querySelectorAll('.memory-btn').forEach(b => b.classList.remove('saving'));
        btn.classList.add('saved');
        setTimeout(() => {
            btn.classList.remove('saved');
            this.isSaving = false;
        }, 300);
    }

    handleLoadMode(btn) {
        const slot = btn.dataset.slot;
        
        // Rimuovi la classe active da tutti i pulsanti prima
        this.container.querySelectorAll('.memory-btn').forEach(b => 
            b.classList.remove('active')
        );
        
        // Aggiungi la classe active solo al pulsante selezionato
        btn.classList.add('active');
        
        // Chiama il callback per caricare il pattern
        this.paramChangeCallback?.('loadPattern', slot);
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
        // Usa l'ID univoco nella chiave del localStorage
        localStorage.setItem(`${this.instanceId}-pattern-${slot}`, JSON.stringify(pattern));
    }

    loadPattern(slot) {
        // Usa l'ID univoco per recuperare il pattern
        const savedPattern = localStorage.getItem(`${this.instanceId}-pattern-${slot}`);
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

    copySteps(start, end) {
        const data = {};
        this.container.querySelectorAll('.drum-row').forEach(row => {
            const drum = row.dataset.drum;
            data[drum] = Array.from(row.querySelectorAll('.drum-cell'))
                .slice(start, end)
                .map(cell => ({
                    active: cell.classList.contains('active'),
                    accent: cell.classList.contains('accent'),
                    velocity: cell.classList.contains('accent') ? 1.5 : 
                             cell.classList.contains('active') ? 1 : 0
                }));
        });
        return data;
    }

    pasteSteps(data, targetStep) {
        Object.entries(data).forEach(([drum, steps]) => {
            const row = this.container.querySelector(`.drum-row[data-drum="${drum}"]`);
            if (row) {
                steps.forEach((stepData, index) => {
                    const cell = row.querySelector(`[data-step="${targetStep + index}"]`);
                    if (cell) {
                        cell.classList.remove('active', 'accent');
                        if (stepData.accent) {
                            cell.classList.add('active', 'accent');
                        } else if (stepData.active) {
                            cell.classList.add('active');
                        }
                        this.sequenceChangeCallback?.(drum, targetStep + index, 
                            stepData.active, stepData.velocity);
                    }
                });
            }
        });
    }

    updateSequenceDisplay(sequence) {
        // Prima rimuoviamo tutte le classi active e accent
        this.container.querySelectorAll('.drum-cell').forEach(cell => {
            cell.classList.remove('active', 'accent');
        });

        // Poi applichiamo il nuovo stato
        Object.entries(sequence).forEach(([drum, steps]) => {
            const row = this.container.querySelector(`.drum-row[data-drum="${drum}"]`);
            if (row) {
                steps.forEach((step, index) => {
                    const cell = row.querySelector(`[data-step="${index}"]`);
                    if (cell) {
                        if (step.active) {
                            cell.classList.add('active');
                            if (step.velocity > 1) {
                                cell.classList.add('accent');
                            }
                        }
                    }
                });
            }
        });
    }
}
