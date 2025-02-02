import { AbstractHTMLRender } from "../../abstract/AbstractHTMLRender.js";
import { Knob } from "../../../components/Knob.js";

export class TB303Render extends AbstractHTMLRender {
    constructor(instanceId, tb303Instance) {  // Aggiungi il parametro tb303Instance
        super();
        
        if (!instanceId) {
            throw new Error('instanceId is required');
        }
        
        if (!tb303Instance) {
            throw new Error('tb303Instance is required');
        }
        
        if (!tb303Instance.parameters || typeof tb303Instance.parameters !== 'object') {
            console.error('TB303 instance:', tb303Instance);
            throw new Error('TB303 parameters not properly initialized');
        }

        this.instanceId = instanceId;
        this.tb303 = tb303Instance;  // Salva il riferimento all'istanza TB303
        
        // Verifica che i parametri esistano
        if (!this.tb303 || !this.tb303.parameters) {
            throw new Error('TB303 instance or parameters not properly initialized');
        }

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
        this.activeEnvelopeModal = null; // Aggiungi questa proprietà
    }

    createInterface() {
        this.container.innerHTML = `
        <div class="tb303-container">
            <div class="tb303-controls">
                <div class="tb303-knobs"></div>
                <div class="knob-wrapo">
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
                <div class="pattern-selector">
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
                        <div class="memory-slot" data-slot="1">
                            <button class="memory-btn" data-slot="1">1</button>
                            <button class="midi-learn-btn" data-param="pattern1"><span>MIDI</span></button>
                        </div>
                        <div class="memory-slot" data-slot="2">
                            <button class="memory-btn" data-slot="2">2</button>
                            <button class="midi-learn-btn" data-param="pattern2"><span>MIDI</span></button>
                        </div>
                        <div class="memory-slot" data-slot="3">
                            <button class="memory-btn" data-slot="3">3</button>
                            <button class="midi-learn-btn" data-param="pattern3"><span>MIDI</span></button>
                        </div>
                        <div class="memory-slot" data-slot="4">
                            <button class="memory-btn" data-slot="4">4</button>
                            <button class="midi-learn-btn" data-param="pattern4"><span>MIDI</span></button>
                        </div>
                    </div>
                    <div class="pattern-actions">
                        <button class="save-btn">SAVE</button>
                    </div>
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
        knobWrapper.setAttribute('data-param', param);

        // Crea il container del knob
        const knobContainer = document.createElement('div');
        knobContainer.className = 'knob-container';

        // Crea il div per il knob
        const knobElement = document.createElement('div');
        knobElement.className = 'knob';

        // Crea il pulsante MIDI learn
        const midiLearnBtn = document.createElement('button');
        midiLearnBtn.className = 'midi-learn-btn';
        midiLearnBtn.innerHTML = '<span>MIDI</span>';
        midiLearnBtn.setAttribute('data-param', param);

        // Crea i controlli aggiuntivi (tra cui ENV)
        const controlsWrapper = document.createElement('div');
        controlsWrapper.className = 'knob-controls';

        // Aggiungi il pulsante ENV
        const envButton = document.createElement('button');
        envButton.className = 'env-button';
        envButton.textContent = 'ENV';
        envButton.setAttribute('data-param', param);

        // Verifica lo stato iniziale dell'inviluppo
        const envState = this.tb303.getEnvelopeState(param);
        if (envState && envState.active) {
            envButton.classList.add('has-envelope');
        }

        // Crea la label - SPOSTATO QUI
        const labelElement = document.createElement('label');
        labelElement.textContent = label;

        // Assembla la struttura
        knobContainer.appendChild(knobElement);
        knobContainer.appendChild(midiLearnBtn);
        knobWrapper.appendChild(knobContainer);
        knobWrapper.appendChild(controlsWrapper);  // Aggiungi i controlli
        controlsWrapper.appendChild(envButton);
        knobWrapper.appendChild(labelElement);

        // Gestione MIDI learn
        let learningTimeout;
        
        midiLearnBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            clearTimeout(learningTimeout);
            
            // Reset altri pulsanti MIDI learn
            this.container.querySelectorAll('.midi-learn-btn.learning').forEach(btn => {
                if (btn !== midiLearnBtn) {
                    btn.classList.remove('learning');
                    this.tb303.midiMapping.stopLearning();
                }
            });

            // Toggle learning mode
            const isLearning = midiLearnBtn.classList.toggle('learning');
            
            if (isLearning) {
                this.tb303.midiMapping.startLearning(param);
                
                // Timeout di sicurezza
                learningTimeout = setTimeout(() => {
                    midiLearnBtn.classList.remove('learning');
                    this.tb303.midiMapping.stopLearning();
                }, 10000);
            } else {
                this.tb303.midiMapping.stopLearning();
            }
        });

        // Aggiungi l'event listener per il pulsante ENV
        envButton.addEventListener('click', () => {
            this.showEnvelopeEditor(param);
        });

        // Inizializza il knob
        const config = {
            min: 0,
            max: 1,
            value: this.tb303.parameters[param] || 0.5,
            size: 48,
            startAngle: 30,
            endAngle: 330,
            numTicks: 0,
            onChange: (v) => this.paramChangeCallback?.(param, v)
        };

        // Configura il knob in base al parametro
        switch(param) {
            case 'cutoff':
                config.value = this.tb303.parameters.cutoff;
                break;
            case 'resonance':
                config.value = this.tb303.parameters.resonance;
                break;
            case 'distortion':
                config.value = this.tb303.parameters.distortion;
                break;
            case 'octave':
                config.value = 0.5; // Valore centrale (0)
                config.onChange = (v) => {
                    const octaveValue = Math.round(v * 4) - 2; // Converte in range -2 to 2
                    this.currentOctaveShift = octaveValue;
                    this.paramChangeCallback?.(param, v);
                    this.updateSequenceOctaves();
                };
                break;
        }

        const knob = new Knob(knobElement, config);
        this.knobs = this.knobs || new Map();
        this.knobs.set(param, knob);

        container.appendChild(knobWrapper);
        return knobWrapper;
    }

    updateKnobValue(param, value) {
        const knob = this.knobs.get(param);
        if (knob) {
            knob.setValue(value, true); // true = senza triggare l'evento onChange
        }
    }

    showEnvelopeEditor(param) {
        if (this.activeEnvelopeModal) return;

        const modal = document.createElement('div');
        modal.className = 'envelope-editor-modal';
        this.activeEnvelopeModal = modal;
        
        // Prima aggiungiamo il modale al DOM
        this.container.appendChild(modal);

        const envState = this.tb303.getEnvelopeState(param);
        const isActive = envState.active;

        // Inizializza i punti dall'ultimo stato salvato
        const points = [...(envState.points || [])];

        modal.innerHTML = `
            <div class="envelope-editor-header">
                <span>${param.toUpperCase()} ENVELOPE</span>
                <div class="envelope-status">${isActive ? 'ACTIVE' : 'INACTIVE'}</div>
            </div>
            <div class="draw-mode-selector">
                <button class="draw-mode-btn active" data-mode="points">Points</button>
                <button class="draw-mode-btn" data-mode="clean">Clean</button>
            </div>
            <canvas width="400" height="200"></canvas>
            <div class="envelope-controls">
                <div class="length-control">
                    <label>Length (bars): </label>
                    <input type="number" min="1" max="32" value="${envState.length || 1}" class="length-input">
                </div>
                <button class="clear-btn">Clear</button>
                <button class="apply-btn">Apply</button>
                <button class="disable-btn">Disable</button>
                <button class="close-btn">Close</button>
            </div>
        `;

        const canvas = modal.querySelector('canvas');
        const ctx = canvas.getContext('2d');
        let isDragging = false;
        let drawMode = 'points'; // Default mode
        let tempPoints = []; // Per la modalità clean

        // Gestione modalità di disegno
        modal.querySelectorAll('.draw-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.querySelectorAll('.draw-mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                drawMode = btn.dataset.mode;
                points = [];
                drawEnvelope();
            });
        });

        // Modifica la gestione degli eventi del mouse
        canvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / canvas.width;
            const y = 1 - (e.clientY - rect.top) / canvas.height;
            
            if (drawMode === 'clean') {
                tempPoints = [];
                points = [];
            }
            
            points.push({ time: x, value: y });
            drawEnvelope();
        });

        canvas.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / canvas.width;
            const y = 1 - (e.clientY - rect.top) / canvas.height;
            
            if (drawMode === 'clean') {
                tempPoints.push({ time: x, value: y });
                drawEnvelope(true);
            } else {
                points.push({ time: x, value: y });
                drawEnvelope();
            }
        });

        canvas.addEventListener('mouseup', () => {
            isDragging = false;
            if (drawMode === 'clean' && tempPoints.length > 0) {
                // In modalità clean, usa solo il punto iniziale e finale
                points = [
                    tempPoints[0],
                    tempPoints[tempPoints.length - 1]
                ];
                tempPoints = [];
                drawEnvelope();
            }
        });

        const drawEnvelope = (isTemp = false) => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawGrid();
            
            if (drawMode === 'clean' && isTemp) {
                // Disegna una linea temporanea durante il trascinamento
                if (tempPoints.length >= 2) {
                    ctx.beginPath();
                    ctx.strokeStyle = '#FF9500';
                    ctx.lineWidth = 2;
                    
                    ctx.moveTo(tempPoints[0].time * canvas.width, 
                              (1 - tempPoints[0].value) * canvas.height);
                              
                    ctx.lineTo(tempPoints[tempPoints.length - 1].time * canvas.width, 
                              (1 - tempPoints[tempPoints.length - 1].value) * canvas.height);
                              
                    ctx.stroke();
                }
            } else if (points.length >= 2) {
                // Disegna i punti esistenti
                const sortedPoints = [...points].sort((a, b) => a.time - b.time);
                
                ctx.beginPath();
                ctx.strokeStyle = '#FF9500';
                ctx.lineWidth = 2;
                
                ctx.moveTo(sortedPoints[0].time * canvas.width, 
                          (1 - sortedPoints[0].value) * canvas.height);
                
                if (drawMode === 'clean') {
                    ctx.lineTo(sortedPoints[1].time * canvas.width, 
                              (1 - sortedPoints[1].value) * canvas.height);
                } else {
                    for (let i = 1; i < sortedPoints.length; i++) {
                        ctx.lineTo(sortedPoints[i].time * canvas.width, 
                                 (1 - sortedPoints[i].value) * canvas.height);
                    }
                }
                
                ctx.stroke();

                // Disegna i punti di controllo solo in modalità points
                if (drawMode === 'points') {
                    sortedPoints.forEach(point => {
                        ctx.beginPath();
                        ctx.arc(point.time * canvas.width, 
                               (1 - point.value) * canvas.height, 
                               5, 0, Math.PI * 2);
                        ctx.fillStyle = '#FF9500';
                        ctx.fill();
                    });
                }
            }
        };

        // Funzioni di disegno
        const drawGrid = () => {
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 0.5;
            
            // Griglia verticale
            const bars = parseInt(modal.querySelector('.length-input').value);
            for (let i = 0; i <= bars * 4; i++) {
                const x = (i / (bars * 4)) * canvas.width;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
                ctx.stroke();
            }
            
            // Griglia orizzontale
            for (let i = 0; i <= 10; i++) {
                const y = (i / 10) * canvas.height;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
                ctx.stroke();
            }
        };

        // Event listeners bottoni
        modal.querySelector('.clear-btn').addEventListener('click', () => {
            points.length = 0;
            drawEnvelope();
        });

        modal.querySelector('.apply-btn').addEventListener('click', () => {
            if (points.length < 2) {
                alert('Add at least 2 points');
                return;
            }

            const normalizedPoints = points
                .sort((a, b) => a.time - b.time)
                .map(p => ({
                    time: Math.max(0, Math.min(1, p.time)),
                    value: Math.max(0, Math.min(1, p.value))
                }));

            // Assicura punti agli estremi
            if (normalizedPoints[0].time > 0) {
                normalizedPoints.unshift({ time: 0, value: normalizedPoints[0].value });
            }
            if (normalizedPoints[normalizedPoints.length - 1].time < 1) {
                normalizedPoints.push({ time: 1, value: normalizedPoints[normalizedPoints.length - 1].value });
            }

            this.paramChangeCallback?.(`${param}Envelope`, {
                active: true,
                points: normalizedPoints,
                length: parseInt(modal.querySelector('.length-input').value) || 1
            });

            modal.remove();
            this.activeEnvelopeModal = null;
        });

        modal.querySelector('.close-btn').addEventListener('click', () => {
            modal.remove();
            this.activeEnvelopeModal = null;
        });

        // Aggiungi l'event listener per il pulsante Disable
        modal.querySelector('.disable-btn').addEventListener('click', () => {
            this.paramChangeCallback?.(`${param}Envelope`, { active: false });
            const envButton = this.container.querySelector(`.env-button[data-param="${param}"]`);
            envButton?.classList.remove('has-envelope');
            modal.remove();
            this.activeEnvelopeModal = null;
        });

        // Initial draw
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
                '.transpose-btn': this.handleTransposeButtonClick.bind(this),
                // Aggiungi handler per i pulsanti MIDI learn dei pattern
                '.memory-slot .midi-learn-btn': (e, target) => {
                    // Remove preventDefault since we're using a delegated event
                    // instead of direct event listener
                    
                    // Reset altri pulsanti MIDI learn
                    this.container.querySelectorAll('.midi-learn-btn.learning').forEach(btn => {
                        if (btn !== target) {
                            btn.classList.remove('learning');
                            this.tb303.midiMapping.stopLearning();
                        }
                    });

                    // Toggle learning mode
                    const isLearning = target.classList.toggle('learning');
                    
                    if (isLearning) {
                        this.tb303.midiMapping.startLearning(target.dataset.param);
                        
                        // Timeout di sicurezza (10 secondi)
                        setTimeout(() => {
                            if (target.classList.contains('learning')) {
                                target.classList.remove('learning');
                                this.tb303.midiMapping.stopLearning();
                            }
                        }, 10000);
                    } else {
                        this.tb303.midiMapping.stopLearning();
                    }
                }
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
            }, { passive: eventType !== 'click' }); // Only click events should be non-passive
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
            'B': ['B', 'C#', 'D#', 'E', 'F#', 'G', 'A']
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

    updateSequenceOctaves() {
        const steps = this.container.querySelectorAll('.step');
        steps.forEach((step, index) => {
            const currentData = this.getStepData(step);
            if (currentData.note) {
                this.sequenceChangeCallback?.(index, currentData);
            }
        });
    }
}
