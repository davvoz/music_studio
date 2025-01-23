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

        const knob = new Knob(knobWrapper.querySelector('.knob'), config);
        // Salva il riferimento al knob
        this.knobs = this.knobs || new Map();
        this.knobs.set(param, knob);

        // Aggiungi il bottone per l'envelope
        const envButton = document.createElement('button');
        envButton.className = 'env-button';
        envButton.innerHTML = 'ENV';
        envButton.setAttribute('data-param', param);
        knobWrapper.appendChild(envButton);

        envButton.addEventListener('click', () => this.showEnvelopeEditor(param));

        // Sostituisci la creazione del bottone disable con un toggle
        const toggleEnvBtn = document.createElement('button');
        toggleEnvBtn.className = 'env-toggle-btn';
        toggleEnvBtn.textContent = 'On'; // Cambiato da 'Toggle Env' a 'On'
        toggleEnvBtn.setAttribute('data-active', 'true'); // Stato iniziale attivo
        
        toggleEnvBtn.addEventListener('click', () => {
            const isActive = toggleEnvBtn.getAttribute('data-active') === 'true';
            const newState = !isActive;
            
            toggleEnvBtn.setAttribute('data-active', newState);
            toggleEnvBtn.textContent = newState ? 'On' : 'Off'; // Testo più corto
            
            this.paramChangeCallback?.(`${param}Envelope`, {
                active: newState,
                // Non modifichiamo i points esistenti
                points: undefined, // undefined significa "mantieni i punti esistenti"
                length: undefined, // undefined significa "mantieni la lunghezza esistente"
                curve: undefined  // undefined significa "mantieni la curva esistente"
            });
        });
        
        knobWrapper.appendChild(toggleEnvBtn);
    }

    updateKnobValue(param, value) {
        const knob = this.knobs.get(param);
        if (knob) {
            knob.setValue(value, true); // true = senza triggare l'evento onChange
        }
    }

    showEnvelopeEditor(param) {
        const modal = document.createElement('div');
        modal.className = 'envelope-editor-modal';
        
        modal.innerHTML = `
            <div class="envelope-editor-header">
                <span>${param.toUpperCase()} ENVELOPE</span>
                <div class="envelope-status"></div>
            </div>
            <canvas width="400" height="200"></canvas>
            <div class="envelope-controls">
                <div class="length-control">
                    <label>Length (bars): </label>
                    <input type="number" min="1" max="32" value="1" class="length-input">
                </div>
                <div class="envelope-tools">
                    <button class="curve-btn" data-curve="linear">Linear</button>
                    <button class="curve-btn" data-curve="exp">Exp</button>
                    <button class="curve-btn" data-curve="sine">Sine</button>
                </div>
                <button class="clear-btn">Clear</button>
                <button class="apply-btn">Apply</button>
                <button class="close-btn">Close</button>
            </div>
        `;

        this.container.appendChild(modal);
        
        const canvas = modal.querySelector('canvas');
        const ctx = canvas.getContext('2d');
        const points = [];
        let isDragging = false;
        let currentCurve = 'linear';

        // Aggiungi una variabile per lo stato iniziale
        let envelopeIsActive = false;

        // Prima definisci tutte le funzioni di disegno
        const drawGrid = () => {
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 0.5;
            
            // Linee orizzontali
            for (let i = 0; i <= 10; i++) {
                const y = i * canvas.height / 10;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
                ctx.stroke();
            }
            
            // Linee verticali per le battute
            const bars = parseInt(modal.querySelector('.length-input').value);
            for (let i = 0; i <= bars * 4; i++) {
                const x = i * canvas.width / (bars * 4);
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
                ctx.stroke();
            }
        };

        const drawEnvelope = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawGrid();
            
            if (points.length < 2) return;
            
            ctx.beginPath();
            ctx.strokeStyle = '#FF9500';
            ctx.lineWidth = 2;
            
            points.sort((a, b) => a.time - b.time);
            
            // Disegna curva
            ctx.moveTo(points[0].time * canvas.width, (1 - points[0].value) * canvas.height);
            
            for (let i = 0; i < points.length - 1; i++) {
                const current = points[i];
                const next = points[i + 1];
                
                if (currentCurve === 'exp') {
                    ctx.bezierCurveTo(
                        current.time * canvas.width + 50, (1 - current.value) * canvas.height,
                        next.time * canvas.width - 50, (1 - next.value) * canvas.height,
                        next.time * canvas.width, (1 - next.value) * canvas.height
                    );
                } else if (currentCurve === 'sine') {
                    const steps = 20;
                    for (let j = 0; j <= steps; j++) {
                        const t = j / steps;
                        const x = current.time + (next.time - current.time) * t;
                        const y = current.value + (next.value - current.value) * 
                                 (0.5 - 0.5 * Math.cos(Math.PI * t));
                        ctx.lineTo(x * canvas.width, (1 - y) * canvas.height);
                    }
                } else {
                    ctx.lineTo(next.time * canvas.width, (1 - next.value) * canvas.height);
                }
            }
            
            ctx.stroke();
            
            // Disegna punti
            points.forEach(point => {
                ctx.beginPath();
                ctx.arc(
                    point.time * canvas.width,
                    (1 - point.value) * canvas.height,
                    5, 0, Math.PI * 2
                );
                ctx.fillStyle = '#FF9500';
                ctx.fill();
            });
        };

        // Ora possiamo usare drawEnvelope nel callback
        const getEnvelopeCallback = (envelopeState) => {
            try {
                if (envelopeState && Array.isArray(envelopeState.points)) {
                    points.push(...envelopeState.points);
                    if (envelopeState.length) {
                        modal.querySelector('.length-input').value = envelopeState.length;
                    }
                    envelopeIsActive = envelopeState.active !== false;
                    drawEnvelope();
                }
            } catch (error) {
                console.warn('Error loading envelope state:', error);
            }
        };

        // Richiedi lo stato dell'inviluppo in modo sicuro
        this.paramChangeCallback?.(`get${param}Envelope`, null, getEnvelopeCallback);
        

        canvas.addEventListener('mousedown', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / canvas.width));
            const y = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / canvas.height));
            
            points.push({ time: x, value: y });
            isDragging = true;
            drawEnvelope();
        });

        canvas.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const rect = canvas.getBoundingClientRect();
            const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / canvas.width));
            const y = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / canvas.height));
            
            // Aggiungi punti solo se abbastanza distanti dall'ultimo
            const lastPoint = points[points.length - 1];
            const distance = Math.hypot(x - lastPoint.time, y - lastPoint.value);
            
            if (distance > 0.01) {  // Soglia minima di distanza
                points.push({ time: x, value: y });
                drawEnvelope();
            }
        });

        canvas.addEventListener('mouseup', () => {
            isDragging = false;
        });

        modal.querySelector('.apply-btn').addEventListener('click', () => {
            if (points.length === 0) {
                console.log('No points to apply');
                return;
            }

            const length = parseInt(modal.querySelector('.length-input').value);
            
            // Ordina e normalizza i punti
            const sortedPoints = points
                .sort((a, b) => a.time - b.time)
                .map(p => ({
                    time: Math.max(0, Math.min(1, p.time)),
                    value: Math.max(0, Math.min(1, p.value))
                }));

            console.log('Applying envelope:', {
                param,
                points: sortedPoints,
                length
            });

            this.paramChangeCallback?.(`${param}Envelope`, {
                points: sortedPoints,
                length,
                curve: currentCurve
            });

            modal.remove();
        });

        modal.querySelector('.clear-btn').addEventListener('click', () => {
            points.length = 0;
            drawEnvelope();
            // Disattiva l'inviluppo quando si fa clear
            this.paramChangeCallback?.(`${param}Envelope`, {
                points: [],
                length: 1,
                curve: 'linear',
                active: false
            });
        });

        modal.querySelector('.close-btn').addEventListener('click', () => {
            modal.remove();
        });

        modal.querySelectorAll('.curve-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                currentCurve = btn.dataset.curve;
                modal.querySelectorAll('.curve-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                drawEnvelope();
            });
        });

        drawEnvelope();
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
