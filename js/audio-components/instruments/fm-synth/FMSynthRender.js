import { AbstractHTMLRender } from "../../abstract/AbstractHTMLRender.js";
import { Knob } from "../../../components/Knob.js";
import { FMAlgorithms } from "./FMSynth.js";  // Importa gli algoritmi

export class FMSynthRender extends AbstractHTMLRender {
    constructor(instanceId, fmSynthInstance) {
        super();

        if (!instanceId || !fmSynthInstance) {
            throw new Error('ID and FM synth instance are required');
        }

        this.instanceId = instanceId;
        this.fmSynth = fmSynthInstance;
        this.container.classList.add('fm-synth');

        // Callbacks
        this.paramChangeCallback = null;
        this.sequenceChangeCallback = null;

        // Cache dei canvas e contesti
        this.operatorCanvases = new Map();
        this.knobs = new Map();

        this.operatorStates = new Array(4).fill().map(() => ({
            isActive: true,
            currentWave: 'sine'
        }));

        this.createInterface();
        this.setupEventDelegation();
    }

    // Aggiungi metodo per aggiornare il display dell'algoritmo
    updateAlgorithmDisplay(algorithmName) {
        const buttons = this.container.querySelectorAll('.algo-btn');
        buttons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.algo === algorithmName);
        });
    }

    createInterface() {
        this.container.innerHTML = `
            <div class="fm-synth-container">
                <div class="fm-synth-controls">
                    ${this.createControlsHTML()}
                </div>
                <div class="fm-synth-sequence">
                    ${this.createSequencerHTML()}
                </div>
            </div>
        `;

        this.setupKnobs();
        this.setupEventListeners();
    }

    createControlsHTML() {
        return `
            <div class="controls-sectione">
                ${this.createCarrierSection()}
                ${this.createModulatorSection()}
                ${this.createSubSection()}
                ${this.createEffectsSection()}
                ${this.createADSRSection()}
            </div>
            <div class="pattern-controls">
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
                <div class="pattern-buttons">
                    <button class="pattern-btn" data-pattern="random">RND</button>
                    <button class="pattern-btn" data-pattern="minor">MIN</button>
                    <button class="pattern-btn" data-pattern="major">MAJ</button>
                    <button class="pattern-btn clear-pattern">CLR</button>
                </div>
            </div>
        `;
    }

    createCarrierSection() {
        return `
            <div class="knob-row carrier-controls">
                <h3>CARRIER</h3>
                ${this.createKnobHtml('carrierGain', 'LEVEL')}
                ${this.createKnobHtml('cutoff', 'CUTOFF')}
                ${this.createKnobHtml('resonance', 'RES')}
                <div class="wave-selector carrier-waves">
                    <button class="wave-btn active" data-wave="sawtooth">SAW</button>
                    <button class="wave-btn" data-wave="square">SQR</button>
                    <button class="wave-btn" data-wave="sine">SIN</button>
                </div>
            </div>
        `;
    }

    createModulatorSection() {
        return `
            <div class="knob-row modulator-controls">
                <h3>MODULATOR</h3>
                ${this.createKnobHtml('modDepth', 'DEPTH')}
                ${this.createKnobHtml('modRatio', 'RATIO')}  
                ${this.createKnobHtml('harmonicity', 'HARM')}
                ${this.createKnobHtml('feedback', 'FEEDB')}
                ${this.createKnobHtml('modDetune', 'DETUNE')}
                ${this.createKnobHtml('modPhase', 'PHASE')}
                <div class="wave-selector mod-waves">
                    <button class="wave-btn active" data-wave="sine">SIN</button>
                    <button class="wave-btn" data-wave="triangle">TRI</button>
                    <button class="wave-btn" data-wave="square">SQR</button>
                    <button class="wave-btn" data-wave="sawtooth">SAW</button>
                </div>
            </div>
        `;
    }

    createSubSection() {
        return `
            <div class="knob-row sub-controls">
                <h3>SUB OSC</h3>
                ${this.createKnobHtml('subOscLevel', 'LEVEL')}
                <div class="wave-selector sub-waves">
                    <button class="wave-btn active" data-wave="sine">SIN</button>
                    <button class="wave-btn" data-wave="square">SQR</button>
                </div>
            </div>
        `;
    }

    createEffectsSection() {
        return `
            <div class="knob-row effects-controls">
            <div class="effects-controls-container">
                ${this.createEffectsKnobs()}
                </div>
                ${this.createLFOSection()}
                <div class="filter-type-selector">
                    <button class="filter-btn active" data-type="lowpass">LP</button>
                    <button class="filter-btn" data-type="highpass">HP</button>
                    <button class="filter-btn" data-type="bandpass">BP</button>
                </div>
            </div>
        `;
    }

    createLFOSection() {
        const createLFOControls = (num) => `
            <div class="lfo-group">
                <h4>LFO ${num}</h4>
                ${this.createKnobHtml(`lfo${num}Rate`, 'RATE')}
                ${this.createKnobHtml(`lfo${num}Depth`, 'DEPTH')}
                <div class="lfo-controls">
                    <select class="lfo-shape" data-lfo="${num}">
                        <option value="sine">Sine</option>
                        <option value="triangle">Tri</option>
                        <option value="square">Sqr</option>
                        <option value="sawtooth">Saw</option>
                    </select>
                    <select class="lfo-target" data-lfo="${num}">
                        <option value="none">Off</option>
                        <option value="cutoff">Cutoff</option>
                        <option value="modDepth">ModDepth</option>
                        <option value="pitch">Pitch</option>
                        <option value="resonance">Res</option>
                        <option value="pan">Pan</option>
                        <option value="feedback">Feedb</option>
                    </select>
                    <select class="lfo-division" data-lfo="${num}">
                        <option value="1/1">1/1</option>
                        <option value="1/2">1/2</option>
                        <option value="1/4">1/4</option>
                        <option value="1/8">1/8</option>
                        <option value="1/16">1/16</option>
                        <option value="1/32">1/32</option>
                    </select>
                    <button class="lfo-sync-btn ${num}" data-lfo="${num}">SYNC</button>
                </div>
            </div>
        `;

        return `
            <div class="lfo-section">
                ${createLFOControls(1)}
                ${createLFOControls(2)}
            </div>
        `;
    }

    createEffectsKnobs() {
        return `
            ${this.createKnobHtml('bitcrush', 'CRUSH')}
            ${this.createKnobHtml('ringMod', 'RING')}
            ${this.createKnobHtml('foldback', 'FOLD')}
            ${this.createKnobHtml('carrierSpread', 'SPREAD')}
        `;
    }

    createADSRSection() {
        return `
            <div class="adsr-section">
                <div class="adsr-group amp-adsr">
                    <h3>AMP ADSR</h3>
                    ${this.createKnobHtml('ampAttack', 'A')}
                    ${this.createKnobHtml('ampDecay', 'D')}
                    ${this.createKnobHtml('ampSustain', 'S')}
                    ${this.createKnobHtml('ampRelease', 'R')}
                    ${this.createKnobHtml('ampCurve', 'CURVE')}
                </div>
                <div class="adsr-group filter-adsr">
                    <h3>FILTER ADSR</h3>
                    ${this.createKnobHtml('filterAttack', 'A')}
                    ${this.createKnobHtml('filterDecay', 'D')}
                    ${this.createKnobHtml('filterSustain', 'S')}
                    ${this.createKnobHtml('filterRelease', 'R')}
                    ${this.createKnobHtml('filterCurve', 'CURVE')}
                </div>
                <div class="adsr-group mod-adsr">
                    <h3>MOD ADSR</h3>
                    ${this.createKnobHtml('modAttack', 'A')}
                    ${this.createKnobHtml('modDecay', 'D')}
                    ${this.createKnobHtml('modSustain', 'S')}
                    ${this.createKnobHtml('modRelease', 'R')}
                    ${this.createKnobHtml('modCurve', 'CURVE')}
                </div>
            </div>
        `;
    }

    createKnobHtml(param, label) {
        return `
            <div class="knob-wrap" data-param="${param}">
                <div class="knob-container">
                    <div class="knob"></div>
                    <button class="midi-learn-btn">
                        <span>MIDI</span>
                    </button>
                </div>
                <div class="knob-controls">
                    <button class="env-button" data-param="${param}">ENV</button>
                </div>
                <label>${label}</label>
            </div>
        `;
    }

    createWaveformSelector(opIndex) {
        const waves = ['sine', 'square', 'triangle', 'sawtooth'];
        const currentWave = this.operatorStates[opIndex].currentWave;
        
        return `
            <div class="waveform-selector">
                ${waves.map(wave => `
                    <button class="wave-btn ${wave === currentWave ? 'active' : ''}" 
                            data-wave="${wave}" data-operator="${opIndex}">
                        ${this.getWaveformIcon(wave)}
                    </button>
                `).join('')}
            </div>
        `;
    }

    getWaveformIcon(type) {
        const icons = {
            sine: '∿',
            square: '⊓',
            triangle: '△',
            sawtooth: '⋀'
        };
        return icons[type] || '∿';
    }

    createOperatorKnobs(opIndex) {
        const knobs = [
            { param: `op${opIndex + 1}_ratio`, label: 'RATIO' },
            { param: `op${opIndex + 1}_gain`, label: 'LEVEL' },
            { param: `op${opIndex + 1}_detune`, label: 'DETUNE' }
        ];

        return knobs.map(knob => `
            <div class="knob-wrap" data-param="${knob.param}">
                <div class="knob-container">
                    <div class="knob"></div>
                    <button class="midi-learn-btn">
                        <span>MIDI</span>
                    </button>
                </div>
                <div class="knob-controls">
                    <button class="env-button" data-param="${knob.param}">ENV</button>
                </div>
                <label>${knob.label}</label>
            </div>
        `).join('');
    }

    createGlobalControlsHTML() {
        return `
            <div class="global-panel">
                <h3>Global</h3>
                <div class="global-controls">
                    <!-- Global parameter knobs -->
                </div>
            </div>
        `;
    }

    createRoutingMatrixHTML() {
        return `
            <div class="routing-panel">
                <h3>Algorithm</h3>
                <div class="algorithm-buttons">
                    ${Object.keys(FMAlgorithms).map(algo => `
                        <button class="algo-btn" data-algo="${algo}">
                            ${algo}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Metodo per ottenere il canvas di un operatore
    getOperatorCanvas(index) {
        return this.container.querySelector(
            `.operator-panel[data-operator="${index + 1}"] canvas`
        );
    }

    setupKnobs() {
        // Setup dei knob per ogni operatore
        this.container.querySelectorAll('.knob-wrap').forEach(wrap => {
            const param = wrap.dataset.param;
            const knobElement = wrap.querySelector('.knob');

            if (knobElement) {
                const knob = new Knob(knobElement, {
                    min: 0,
                    max: 1,
                    value: 0.5,
                    onChange: (value) => {
                        this.paramChangeCallback?.(param, value);
                    }
                });

                this.knobs.set(param, knob);
            }
        });
    }

    setupEventListeners() {
        // Event listener per le forme d'onda di ogni sezione
        const sections = [
            { selector: '.carrier-waves', param: 'waveform' },
            { selector: '.mod-waves', param: 'modShape' },
            { selector: '.sub-waves', param: 'subOscShape' }
        ];

        sections.forEach(({ selector, param }) => {
            const container = this.container.querySelector(selector);
            if (!container) return;

            container.querySelectorAll('.wave-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    // Rimuovi active solo dai bottoni dello stesso gruppo
                    container.querySelectorAll('.wave-btn').forEach(b => 
                        b.classList.remove('active'));
                    btn.classList.add('active');
                    this.paramChangeCallback?.(param, btn.dataset.wave);
                });
            });
        });

        // Event listener per il sequencer
        this.setupSequencer();

        // Event listener per i pattern buttons - CORRETTO
        this.container.querySelectorAll('.pattern-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.pattern;
                const key = this.container.querySelector('.key-select')?.value || 'C';
                if (!this.fmSynth?.generateRandomPattern) {
                    console.warn('generateRandomPattern not found on fmSynth instance');
                    return;
                }
                const pattern = this.fmSynth.generateRandomPattern(32, key);
                if (!pattern) return;
                
                // Update UI and sequence only if we have valid steps
                for (let i = 0; i < 32; i++) {
                    const step = pattern[i] || { note: '', accent: false, slide: false };
                    this.updateStepUI(i, step);
                    this.sequenceChangeCallback?.(i, step);
                }
            });
        });

        // Aggiungi handler per il clear pattern
        this.container.querySelector('.clear-pattern')?.addEventListener('click', () => {
            // Pulisci tutti gli step
            this.container.querySelectorAll('.step').forEach((step, index) => {
                // Reset visuale
                step.querySelector('.note-select').value = '';
                step.querySelector('.velocity-btn').classList.remove('active');
                step.querySelector('.glide-btn').classList.remove('active');
                
                // Notifica il cambio
                this.sequenceChangeCallback?.(index, {
                    note: '',
                    accent: false,
                    slide: false
                });
            });
        });

        // Event listener per i pulsanti ENV
        this.container.addEventListener('click', e => {
            if (e.target.classList.contains('env-button')) {
                const param = e.target.dataset.param;
                const envState = this.fmSynth.getEnvelopeState?.(param);
                this.showEnvelopeEditor(param, envState);
            }
        });

        // Aggiungi gestione filter type
        this.container.querySelector('.filter-type-selector')?.addEventListener('click', e => {
            const btn = e.target.closest('.filter-btn');
            if (!btn) return;
            
            this.container.querySelectorAll('.filter-btn').forEach(b => 
                b.classList.remove('active'));
            btn.classList.add('active');
            
            this.paramChangeCallback?.('filterType', btn.dataset.type);
        });

        // LFO controls listeners
        ['1', '2'].forEach(lfoNum => {
            // Shape change
            this.container.querySelector(`.lfo-shape[data-lfo="${lfoNum}"]`)
                ?.addEventListener('change', (e) => {
                    this.paramChangeCallback?.(`lfo${lfoNum}Shape`, e.target.value);
                });

            // Target change
            this.container.querySelector(`.lfo-target[data-lfo="${lfoNum}"]`)
                ?.addEventListener('change', (e) => {
                    this.paramChangeCallback?.(`lfo${lfoNum}Target`, e.target.value);
                });

            // Division change
            this.container.querySelector(`.lfo-division[data-lfo="${lfoNum}"]`)
                ?.addEventListener('change', (e) => {
                    this.paramChangeCallback?.(`lfo${lfoNum}Division`, e.target.value);
                });

            // Sync toggle
            this.container.querySelector(`.lfo-sync-btn[data-lfo="${lfoNum}"]`)
                ?.addEventListener('click', (e) => {
                    const btn = e.target;
                    const isSync = btn.classList.toggle('active');
                    this.paramChangeCallback?.(`lfo${lfoNum}Sync`, isSync);
                });
        });
    }

    updateWaveformDisplay(operatorIndex, wave) {
        const operatorPanel = this.container.querySelector(`.operator-panel[data-operator="${operatorIndex + 1}"]`);
        const waveButtons = operatorPanel.querySelectorAll('.wave-btn');
        waveButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.wave === wave);
        });
    }

    updateParameter(param, value, isModulation = false) {
        const knob = this.knobs.get(param);
        if (knob) {
            knob.setValue(value, true);
            
            const wrap = this.container.querySelector(`[data-param="${param}"]`);
            if (wrap) {
                wrap.classList.toggle('modulated', isModulation);
            }
        }
    }

    updateRoutingMatrix() {
        // Aggiorna la visualizzazione della matrice di routing
    }

    getRoutingMatrix() {
        return this.container.querySelectorAll('.routing-cell input').map(input => parseFloat(input.value));
    }

    createSequencerHTML() {
        return `
            <div class="sequencer-grid">
                ${Array(32).fill().map((_, i) => `
                    <div class="step" data-step="${i}">
                        <select class="note-select">
                            <option value="">-</option>
                            ${this.createNoteOptions()}
                        </select>
                        <div class="step-controls">
                            <button class="velocity-btn" title="Velocity">V</button>
                            <button class="glide-btn" title="Glide">G</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    createNoteOptions() {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octaves = [1, 2, 3, 4, 5];
        return octaves.map(octave => 
            notes.map(note => 
                `<option value="${note}${octave}">${note}${octave}</option>`
            ).join('')
        ).join('');
    }

    setupSequencer() {
        const sequencer = this.container.querySelector('.sequencer-grid');
        if (!sequencer) return;

        // Gestione note
        sequencer.addEventListener('change', (e) => {
            if (e.target.classList.contains('note-select')) {
                const step = e.target.closest('.step');
                const stepIndex = parseInt(step.dataset.step);
                this.updateStep(stepIndex);
            }
        });

        // Gestione velocity e glide
        sequencer.addEventListener('click', (e) => {
            if (e.target.matches('.velocity-btn, .glide-btn')) {
                e.target.classList.toggle('active');
                const step = e.target.closest('.step');
                const stepIndex = parseInt(step.dataset.step);
                this.updateStep(stepIndex);
            }
        });
    }

    updateStep(index) {
        const step = this.container.querySelector(`.step[data-step="${index}"]`);
        if (!step) return;

        const data = {
            note: step.querySelector('.note-select').value,
            velocity: step.querySelector('.velocity-btn').classList.contains('active') ? 1.5 : 1,
            glide: step.querySelector('.glide-btn').classList.contains('active')
        };

        this.sequenceChangeCallback?.(index, data);
    }

    highlightStep(index) {
        requestAnimationFrame(() => {
            // Rimuovi la classe current da tutti gli step
            this.container.querySelectorAll('.step').forEach(step => {
                step.classList.remove('current');
            });
            
            // Aggiungi la classe current allo step corrente
            const currentStep = this.container.querySelector(`.step[data-step="${index}"]`);
            if (currentStep) {
                currentStep.classList.add('current');
                // Rimosso scrollIntoView per evitare lo scroll automatico
            }
        });
    }

    createSequencer() {
        // Crea il sequencer
    }

    setupEventDelegation() {
        // Event listener per il sequencer
    }

    setParamChangeCallback(callback) {
        this.paramChangeCallback = callback;
    }

    setSequenceChangeCallback(callback) {
        this.sequenceChangeCallback = callback;
    }
    
    setPresetChangeCallback(callback) {
        this.presetChangeCallback = callback;
    }

    updateOperatorState(index, isActive) {
        const panel = this.container.querySelector(`.operator-panel[data-operator="${index + 1}"]`);
        if (panel) {
            panel.classList.toggle('active', isActive);
            const toggle = panel.querySelector('.operator-toggle');
            toggle.textContent = isActive ? 'ON' : 'OFF';
            toggle.classList.toggle('on', isActive);
            toggle.classList.toggle('off', !isActive);
        }
    }

    setWaveform(operatorIndex, waveform) {
        const panel = this.container.querySelector(`.operator-panel[data-operator="${operatorIndex + 1}"]`);
        if (panel) {
            const waveButtons = panel.querySelectorAll('.wave-btn');
            waveButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.wave === waveform);
            });
        }
    }

    updateWaveformSelection(section, waveform) {
        const selectors = {
            carrier: '.carrier-waves',
            modulator: '.mod-waves',
            sub: '.sub-waves'
        };

        const container = this.container.querySelector(selectors[section]);
        if (!container) return;

        container.querySelectorAll('.wave-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.wave === waveform);
        });
    }

    showEnvelopeEditor(param, currentState = null) {
        const modal = document.createElement('div');
        modal.className = 'envelope-editor-modal';
        
        modal.innerHTML = `
            <div class="envelope-editor-header">
                <span>${param.toUpperCase()} ENVELOPE</span>
                <div class="envelope-status">${currentState?.active ? 'ACTIVE' : 'INACTIVE'}</div>
            </div>
            <div class="envelope-canvas-container">
                <canvas width="360" height="180"></canvas>
            </div>
            <div class="envelope-controls">
                <div class="length-control">
                    <label>LENGTH:</label>
                    <input type="number" min="1" max="32" value="${currentState?.length || 1}" class="length-input">
                </div>
                <div class="buttons-container">
                    <button class="clear-btn">Clear</button>
                    <button class="apply-btn">Apply</button>
                    <button class="disable-btn">Disable</button>
                    <button class="close-btn">Close</button>
                </div>
            </div>
        `;

        this.container.appendChild(modal);
        this.setupEnvelopeEditor(modal, param, currentState?.points || []);
    }

    setupEnvelopeEditor(modal, param, initialPoints = []) {
        const canvas = modal.querySelector('canvas');
        const ctx = canvas.getContext('2d');
        let points = [...initialPoints];
        let isDragging = false;
        let lastPoint = null;

        const drawGrid = () => {
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 0.5;
            
            // Griglia verticale più fitta
            for (let i = 0; i <= 16; i++) {
                const x = (i / 16) * canvas.width;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
                ctx.stroke();
            }
            
            // Griglia orizzontale più fitta
            for (let i = 0; i <= 8; i++) {
                const y = (i / 8) * canvas.height;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
                ctx.stroke();
            }
        };

        const drawEnvelope = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawGrid();

            if (points.length >= 2) {
                // Disegna la linea dell'inviluppo
                ctx.beginPath();
                ctx.strokeStyle = '#FF9500';
                ctx.lineWidth = 2;
                
                const sortedPoints = [...points].sort((a, b) => a.time - b.time);
                ctx.moveTo(sortedPoints[0].time * canvas.width, (1 - sortedPoints[0].value) * canvas.height);
                
                sortedPoints.forEach(point => {
                    ctx.lineTo(point.time * canvas.width, (1 - point.value) * canvas.height);
                });
                
                ctx.stroke();

                // Aggiungi glow effect
                ctx.strokeStyle = 'rgba(255, 149, 0, 0.3)';
                ctx.lineWidth = 4;
                ctx.stroke();

                // Disegna i punti di controllo
                sortedPoints.forEach(point => {
                    ctx.beginPath();
                    ctx.arc(
                        point.time * canvas.width,
                        (1 - point.value) * canvas.height,
                        4, 0, Math.PI * 2
                    );
                    ctx.fillStyle = '#FF9500';
                    ctx.fill();
                });
            }
        };

        canvas.addEventListener('mousedown', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / canvas.width;
            const y = 1 - (e.clientY - rect.top) / canvas.height;
            
            isDragging = true;
            lastPoint = { time: x, value: y };
            points = [lastPoint];
            drawEnvelope();
        });

        canvas.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / canvas.width;
            const y = 1 - (e.clientY - rect.top) / canvas.height;
            
            if (Math.abs(x - lastPoint.time) > 0.01 || Math.abs(y - lastPoint.value) > 0.01) {
                lastPoint = { time: x, value: y };
                points.push(lastPoint);
                drawEnvelope();
            }
        });

        canvas.addEventListener('mouseup', () => {
            isDragging = false;
        });

        modal.querySelector('.apply-btn').addEventListener('click', () => {
            if (points.length < 2) {
                alert('Add at least 2 points');
                return;
            }

            const sortedPoints = points
                .sort((a, b) => a.time - b.time)
                .map(p => ({
                    time: Math.max(0, Math.min(1, p.time)),
                    value: Math.max(0, Math.min(1, p.value))
                }));

            if (sortedPoints[0].time > 0) {
                sortedPoints.unshift({ 
                    time: 0, 
                    value: sortedPoints[0].value 
                });
            }
            if (sortedPoints[sortedPoints.length - 1].time < 1) {
                sortedPoints.push({ 
                    time: 1, 
                    value: sortedPoints[sortedPoints.length - 1].value 
                });
            }

            const envelopeData = {
                active: true,
                points: sortedPoints,
                length: parseInt(modal.querySelector('.length-input').value) || 1
            };

            const envButton = this.container.querySelector(
                `.env-button[data-param="${param}"]`
            );
            if (envButton) {
                envButton.classList.add('has-envelope');
            }

            this.paramChangeCallback?.(`${param}Envelope`, envelopeData);
            modal.remove();
        });

        modal.querySelector('.disable-btn').addEventListener('click', () => {
            this.fmSynth.updateParameter(`${param}Envelope`, { active: false });
            modal.remove();
        });

        modal.querySelector('.clear-btn').addEventListener('click', () => {
            points = [];
            drawEnvelope();
        });

        modal.querySelector('.close-btn').addEventListener('click', () => {
            modal.remove();
        });

        drawGrid();
        drawEnvelope();
    }

    updateStepUI(index, data = {}) {
        const step = this.container.querySelector(`.step[data-step="${index}"]`);
        if (!step) return;

        const { note = '', accent = false, slide = false } = data;
        const noteSelect = step.querySelector('.note-select');
        const velocityBtn = step.querySelector('.velocity-btn');
        const glideBtn = step.querySelector('.glide-btn');

        if (noteSelect) noteSelect.value = note;
        if (velocityBtn) velocityBtn.classList.toggle('active', accent);
        if (glideBtn) glideBtn.classList.toggle('active', slide);
    }
}
