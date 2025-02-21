import { AbstractHTMLRender } from "../../abstract/AbstractHTMLRender.js";
import { Knob } from "../../../components/Knob.js";

export class SamplerRender extends AbstractHTMLRender {
    constructor(instanceId, sampler) {  // Aggiungi parametro sampler
        super();
        this.instanceId = instanceId;
        this.sampler = sampler;  // Salva il riferimento al sampler
        this.container.classList.add('sampler');
        this.container.setAttribute('data-instance-id', this.instanceId);
        this.paramChangeCallback = null;
        this.setupUI();
    }

    setParameterChangeCallback(callback) {
        this.paramChangeCallback = callback;
    }

    updateSampleInfo(filename) {
        const sampleInfo = this.container.querySelector('.sample-info');
        if (sampleInfo) {
            sampleInfo.textContent = filename;
            sampleInfo.style.color = '#00ff9d'; // Change color to indicate success
        }
    }

    setupUI() {
        this.container.innerHTML = `
            <div class="sampler-container">
                <div class="sampler-header">
                    <div class="sample-loader">
                        <button class="load-sample-btn">Load Sample</button>
                        <input type="file" accept="audio/*" style="display: none;">
                        <span class="sample-info">No sample loaded</span>
                    </div>
                    <div class="global-controls">
                        <div class="control-group">
                            <label>Level</label>
                            <input type="range" class="global-gain" min="0" max="2" value="1" step="0.1">
                            <span class="global-gain-value">1.0</span>
                            <button class="midi-learn-btn" data-param="gain"><span>MIDI</span></button>
                        </div>
                        <div class="control-group">
                            <label>Global Pitch</label>
                            <input type="range" class="global-pitch" min="-24" max="24" value="0" step="1">
                            <span class="global-pitch-value">0</span>
                            <button class="midi-learn-btn" data-param="globalPitch"><span>MIDI</span></button>
                        </div>
                        <div class="control-group">
                            <label>Global Length</label>
                            <input type="range" class="global-length" min="0.1" max="4" value="1" step="0.1">
                            <span class="global-length-value">1.0</span>
                            <button class="midi-learn-btn" data-param="globalLength"><span>MIDI</span></button>
                        </div>
                        <div class="control-group">
                            <label>Filter Cutoff</label>
                            <input type="range" class="filter-cutoff" min="0" max="1" value="1" step="0.01">
                            <span class="filter-cutoff-value">20000</span>
                            <button class="midi-learn-btn" data-param="filterCutoff"><span>MIDI</span></button>
                        </div>
                        <div class="control-group">
                            <label>Filter Resonance</label>
                            <input type="range" class="filter-resonance" min="0" max="1" value="0" step="0.01">
                            <span class="filter-resonance-value">0</span>
                            <button class="midi-learn-btn" data-param="filterResonance"><span>MIDI</span></button>
                        </div>
                        <div class="control-group">
                            <label>Filter Type</label>
                            <select class="filter-type">
                                <option value="lowpass">Low Pass</option>
                                <option value="highpass">High Pass</option>
                                <option value="bandpass">Band Pass</option>
                            </select>
                        </div>
                    </div>
                    <div class="pattern-controls">
                        <div class="pattern-types">
                            <button class="pattern-type-btn" data-type="random">RND</button>
                            <button class="pattern-type-btn" data-type="minor">MIN</button>
                            <button class="pattern-type-btn" data-type="major">MAJ</button>
                            <button class="pattern-type-btn" data-type="perc">PRC</button>
                        </div>
                        <div class="pattern-length">
                            <button class="length-btn" data-length="4">4</button>
                            <button class="length-btn" data-length="8">8</button>
                            <button class="length-btn" data-length="16">16</button>
                            <button class="length-btn active" data-length="32">32</button>
                        </div>
                        <div class="pattern-memory">
                            ${Array(8).fill().map((_, i) => `
                                <div class="memory-slot">
                                    <button class="pattern-btn" data-pattern="${i + 1}">${i + 1}</button>
                                    <button class="midi-learn-btn" data-param="pattern${i + 1}">
                                        <span>MIDI</span>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                        <button class="save-pattern">SAVE</button>
                    </div>
                </div>
                <div class="sequence-grido"></div>
            </div>
        `;

        this.createSequencer();
        this.setupEventListeners();
        this.setupFilterControls();
    }

    setupEventListeners() {
        // Sample loading
        const loadBtn = this.container.querySelector('.load-sample-btn');
        const fileInput = this.container.querySelector('input[type="file"]');

        loadBtn.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.paramChangeCallback?.('loadSample', file);
                this.updateSampleInfo(file.name);
            }
        });

        // Global controls listeners
        const globalPitchSlider = this.container.querySelector('.global-pitch');
        const globalLengthSlider = this.container.querySelector('.global-length');
        const globalPitchValue = this.container.querySelector('.global-pitch-value');
        const globalLengthValue = this.container.querySelector('.global-length-value');

        globalPitchSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            globalPitchValue.textContent = value;
            this.paramChangeCallback?.('globalPitch', value);
        });

        globalLengthSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value).toFixed(1);
            globalLengthValue.textContent = value;
            this.paramChangeCallback?.('globalLength', parseFloat(value));
        });

        // Gain control listener
        const gainSlider = this.container.querySelector('.global-gain');
        const gainValue = this.container.querySelector('.global-gain-value');

        gainSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value).toFixed(1);
            gainValue.textContent = value;
            this.paramChangeCallback?.('gain', parseFloat(value));
        });

        // Other control listeners
        this.container.querySelectorAll('select').forEach(select => {
            select.addEventListener('change', (e) => {
                const param = e.target.classList[0].replace('-select', '');
                this.paramChangeCallback?.(param, e.target.value);
            });
        });

        // Pattern controls
        let saveMode = false;
        const saveBtn = this.container.querySelector('.save-pattern');
        const patternBtns = this.container.querySelectorAll('.pattern-btn');

        saveBtn.addEventListener('click', () => {
            saveMode = !saveMode;
            saveBtn.classList.toggle('active', saveMode);
            this.container.classList.toggle('save-mode', saveMode);
        });

        patternBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const patternNum = parseInt(btn.dataset.pattern);
                if (saveMode) {
                    this.paramChangeCallback?.('savePattern', patternNum);
                    saveMode = false;
                    saveBtn.classList.remove('active');
                    this.container.classList.remove('save-mode');
                    
                    // Visual feedback
                    btn.classList.add('saved');
                    setTimeout(() => btn.classList.remove('saved'), 200);
                } else {
                    this.paramChangeCallback?.('loadPattern', patternNum);
                    patternBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                }
            });
        });

        // Pattern type buttons
        this.container.querySelectorAll('.pattern-type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.type;
                this.paramChangeCallback?.('generatePattern', type);
                
                // Visual feedback
                btn.classList.add('active');
                setTimeout(() => btn.classList.remove('active'), 200);
            });
        });

        // Pattern length buttons handler - come nella TB303
        let selectedLength = 16; // Default pattern length
        this.container.querySelectorAll('.length-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const length = parseInt(btn.dataset.length);
                selectedLength = length;
                this.container.querySelectorAll('.length-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Genera un nuovo pattern quando cambia la lunghezza
                this.paramChangeCallback?.('patternLength', length);
            });
        });

        // Aggiungi handler per MIDI learn
        this.container.addEventListener('click', (e) => {
            const midiBtn = e.target.closest('.midi-learn-btn');
            if (!midiBtn) return;
            
            e.stopPropagation();
            console.log('MIDI learn clicked for:', midiBtn.dataset.param);
            
            // Reset altri pulsanti MIDI learn attivi
            this.container.querySelectorAll('.midi-learn-btn.learning').forEach(btn => {
                if (btn !== midiBtn) {
                    btn.classList.remove('learning');
                    this.sampler.midiMapping.stopLearning();
                }
            });

            // Toggle modalità apprendimento
            const isLearning = midiBtn.classList.toggle('learning');
            
            if (isLearning) {
                this.sampler.midiMapping.startLearning(midiBtn.dataset.param);
                
                // Evidenzia visivamente il pulsante attivo
                midiBtn.style.transform = 'scale(1)';
                midiBtn.style.opacity = '1';
                
                // Timeout di sicurezza (10 secondi)
                setTimeout(() => {
                    if (midiBtn.classList.contains('learning')) {
                        midiBtn.classList.remove('learning');
                        this.sampler.midiMapping.stopLearning();
                    }
                }, 10000);
            } else {
                this.sampler.midiMapping.stopLearning();
            }
        });
    }

    setupFilterControls() {
        const cutoffSlider = this.container.querySelector('.filter-cutoff');
        const resonanceSlider = this.container.querySelector('.filter-resonance');
        const filterType = this.container.querySelector('.filter-type');
        const cutoffValue = this.container.querySelector('.filter-cutoff-value');
        const resonanceValue = this.container.querySelector('.filter-resonance-value');

        cutoffSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            const freq = Math.round(Math.exp(Math.log(20) + value * (Math.log(20000) - Math.log(20))));
            cutoffValue.textContent = freq + 'Hz';
            this.paramChangeCallback?.('filterCutoff', value);
        });

        resonanceSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            resonanceValue.textContent = Math.round(value * 30);
            this.paramChangeCallback?.('filterResonance', value);
        });

        filterType.addEventListener('change', (e) => {
            this.paramChangeCallback?.('filterType', e.target.value);
        });
    }

    createSequencer() {
        const grid = this.container.querySelector('.sequence-grido');
        const row = document.createElement('div');
        row.className = 'sequence-row';

        for (let step = 0; step < 32; step++) {
            const cell = document.createElement('div');
            cell.className = 'sequence-cell';
            cell.dataset.step = step;
            
            if (step % 8 === 0) cell.classList.add('bar-start');
            if (step % 4 === 0) cell.classList.add('beat-start');

            cell.innerHTML = `
                <div class="step-controls">
                    <button class="step-toggle">ON</button>
                    <select class="pitch-select">
                        ${Array.from({length: 25}, (_, i) => i - 12)
                            .map(v => `<option value="${v}">${v > 0 ? '+' + v : v}</option>`)
                            .join('')}
                    </select>
                    <input type="range" class="velocity-slider" min="0" max="1" step="0.1" value="0.8">
                    <label>VEL</label>
                    <input type="range" class="length-slider" min="0" max="1" step="0.001" value="0.25">
                    <label>LEN</label>
                    <label for="start-slider" data-value="0%">START</label>
                    <input type="range" class="start-slider" min="0" max="1" step="0.001" value="0">
                </div>
            `;

            this.setupStepEvents(cell, step);
            row.appendChild(cell);
        }

        grid.appendChild(row);
    }

    setupStepEvents(cell, step) {
        const toggleBtn = cell.querySelector('.step-toggle');
        const velocitySlider = cell.querySelector('.velocity-slider');
        const lengthSlider = cell.querySelector('.length-slider');
        const pitchSelect = cell.querySelector('.pitch-select');
        const startSlider = cell.querySelector('.start-slider');

        // Fix velocity slider display
        const velocityLabel = cell.querySelector('label[for="velocity-slider"]');
        velocitySlider.addEventListener('input', () => {
            const value = Math.round(velocitySlider.value * 100);
            velocityLabel?.setAttribute('data-value', `${value}%`);
            if (cell.classList.contains('active')) {
                this.updateStep(cell, step);
            }
        });

        // Toggle button handler
        toggleBtn.addEventListener('click', () => {
            const isActive = cell.classList.toggle('active');
            toggleBtn.textContent = isActive ? 'ON' : 'OFF';
            toggleBtn.classList.toggle('active', isActive);
            this.updateStep(cell, step);
        });

        // Control change handlers
        [velocitySlider, lengthSlider, pitchSelect, startSlider].forEach(control => {
            control.addEventListener('change', () => {
                // Update only if step is active
                if (cell.classList.contains('active')) {
                    this.updateStep(cell, step);
                }
            });
        });

        // Aggiungi l'event listener per l'input continuo dello slider
        startSlider.addEventListener('input', () => {
            const value = Math.round(startSlider.value * 100);
            const label = cell.querySelector('label[for="start-slider"]');
            label.setAttribute('data-value', `${value}%`);
            
            // Aggiorna in tempo reale se lo step è attivo
            if (cell.classList.contains('active')) {
                this.updateStep(cell, step);
            }
        });
    }

    toggleStep(cell, step) {
        const isActive = cell.classList.toggle('active');
        console.log('Toggle step:', { step, isActive }); // Debug
        this.updateStep(cell, step);
    }

    updateStep(cell, step) {
        const controls = cell.querySelector('.step-controls');
        const rawLengthValue = parseFloat(controls.querySelector('.length-slider').value);
        
        // Modifica la scala logaritmica per la lunghezza
        const minLen = 0.01;  // Lunghezza minima 1%
        const maxLen = 4;     // Lunghezza massima 400%
        const lengthValue = Math.exp(Math.log(minLen) + (Math.log(maxLen) - Math.log(minLen)) * rawLengthValue);
        
        const data = {
            step,
            active: cell.classList.contains('active'),
            velocity: parseFloat(controls.querySelector('.velocity-slider').value),
            length: Math.round(lengthValue * 1000) / 1000, // 3 decimali di precisione
            pitch: parseInt(controls.querySelector('.pitch-select').value),
            startOffset: parseFloat(controls.querySelector('.start-slider').value)
        };
        
        console.log('Step update data:', { ...data, rawLength: rawLengthValue });
        this.paramChangeCallback?.('updateSequence', data);
    }

    highlightStep(step) {
        this.container.querySelectorAll('.sequence-cell').forEach(cell => {
            cell.classList.remove('playing');
        });
        const currentCell = this.container.querySelector(`[data-step="${step}"]`);
        if (currentCell) currentCell.classList.add('playing');
    }

    updateSequenceUI(sequence) {
        const steps = this.container.querySelectorAll('.sequence-cell');
        sequence.forEach((step, i) => {
            const cell = steps[i];
            if (cell) {
                cell.classList.toggle('active', step.active);
                const controls = cell.querySelector('.step-controls');
                if (controls) {
                    controls.querySelector('.pitch-select').value = step.pitch;
                    controls.querySelector('.velocity-slider').value = step.velocity;
                    controls.querySelector('.length-slider').value = step.length;
                    controls.querySelector('.start-slider').value = step.startOffset;
                    const toggleBtn = controls.querySelector('.step-toggle');
                    toggleBtn.textContent = step.active ? 'ON' : 'OFF';
                    toggleBtn.classList.toggle('active', step.active);
                }
            }
        });
    }

    updatePatternLength(length) {
        // Only visually indicate pattern length, don't disable steps
        const cells = this.container.querySelectorAll('.sequence-cell');
        cells.forEach((cell, index) => {
            cell.classList.toggle('pattern-highlight', index < length);
        });
    }

    savePattern(patternNum) {
        // Pattern numbers are 1-based in UI, 0-based in array
        const index = patternNum - 1;
        const pattern = {};
        this.container.querySelectorAll('.sequence-cell').forEach((cell, i) => {
            pattern[i] = {
                active: cell.classList.contains('active'),
                pitch: parseInt(cell.querySelector('.pitch-select').value),
                velocity: parseFloat(cell.querySelector('.velocity-slider').value),
                length: parseFloat(cell.querySelector('.length-slider').value),
                startOffset: parseFloat(cell.querySelector('.start-slider').value)
            };
        });
        // Usa l'ID univoco nella chiave del localStorage
        localStorage.setItem(`${this.instanceId}-pattern-${index}`, JSON.stringify(pattern));
    }

    loadPattern(patternNum) {
        const index = patternNum - 1;
        // Usa l'ID univoco per recuperare il pattern
        const savedPattern = localStorage.getItem(`${this.instanceId}-pattern-${index}`);
        if (!savedPattern) return;

        const pattern = JSON.parse(savedPattern);
        const updates = [];

        this.container.querySelectorAll('.sequence-cell').forEach((cell, i) => {
            const data = pattern[i];
            if (data) {
                cell.classList.toggle('active', data.active);
                cell.querySelector('.pitch-select').value = data.pitch;
                cell.querySelector('.velocity-slider').value = data.velocity;
                cell.querySelector('.length-slider').value = data.length;
                cell.querySelector('.start-slider').value = data.startOffset;
                
                const toggleBtn = cell.querySelector('.step-toggle');
                if (toggleBtn) {
                    toggleBtn.textContent = data.active ? 'ON' : 'OFF';
                    toggleBtn.classList.toggle('active', data.active);
                }

                updates.push([i, data]);
            }
        });

        // Batch update sequence
        requestAnimationFrame(() => {
            updates.forEach(([index, data]) => {
                this.paramChangeCallback?.('updateSequence', {
                    step: index,
                    ...data
                });
            });
        });
    }

    createMemorySlot(index) {
        const slot = document.createElement('div');
        slot.className = 'memory-slot';
        slot.dataset.slot = index.toString();

        const btn = document.createElement('button');
        btn.className = 'memory-btn';
        btn.dataset.slot = index.toString();
        btn.textContent = index.toString();

        const midiLearnBtn = this.createMidiLearnButton(index);

        slot.append(btn, midiLearnBtn);
        return slot;
    }

    createMidiLearnButton(index) {
        const btn = document.createElement('button');
        btn.className = 'midi-learn-btn';
        btn.dataset.param = `pattern${index}`;
        
        const span = document.createElement('span');
        span.textContent = 'MIDI';
        btn.appendChild(span);
        
        return btn;
    }

    // Aggiungi questo nuovo metodo per aggiornare i controlli UI
    updateControl(param, value) {
        const control = this.container.querySelector(`.${param}`);
        if (!control) return;

        // Aggiorna il valore del controllo
        control.value = value;

        // Aggiorna anche il display del valore
        const valueDisplay = this.container.querySelector(`.${param}-value`);
        if (valueDisplay) {
            switch(param) {
                case 'filter-cutoff':
                    const freq = Math.round(Math.exp(Math.log(20) + value * (Math.log(20000) - Math.log(20))));
                    valueDisplay.textContent = freq + 'Hz';
                    break;
                case 'filter-resonance':
                    valueDisplay.textContent = Math.round(value * 30);
                    break;
                case 'global-gain':
                    valueDisplay.textContent = value.toFixed(1);
                    break;
                case 'global-pitch':
                    valueDisplay.textContent = Math.round(value);
                    break;
                case 'global-length':
                    valueDisplay.textContent = value.toFixed(1);
                    break;
                default:
                    valueDisplay.textContent = value;
            }
        }
    }

    // Aggiungi questo metodo per aggiornare lo stato dei pulsanti MIDI
    updateMidiMapping(param, isMapped) {
        const midiBtn = this.container.querySelector(`.midi-learn-btn[data-param="${param}"]`);
        if (midiBtn) {
            midiBtn.classList.toggle('mapped', isMapped);
            midiBtn.classList.remove('learning');
        }
    }
}
