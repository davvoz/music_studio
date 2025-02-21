import { AbstractHTMLRender } from "../../abstract/AbstractHTMLRender.js";
import { Knob } from "../../../components/Knob.js";

export class DrumMachineRender extends AbstractHTMLRender {
    constructor(instanceId, drumMachine) {  // Aggiungi il parametro drumMachine
        super();
        if (!instanceId) {
            throw new Error('instanceId is required');
        }
        if (!drumMachine) {
            throw new Error('drumMachine instance is required');
        }

        this.instanceId = instanceId;
        this.drumMachine = drumMachine;  // Salva il riferimento all'istanza DrumMachine
        this.container.classList.add('drum-machine');
        this.container.setAttribute('data-instance-id', this.instanceId);
        this.paramChangeCallback = null;
        this.sequenceChangeCallback = null;
        this.isSaveMode = false;
        this.isSaving = false;  // Nuovo flag per evitare salvataggi multipli
        this.currentSection = 0;
        this.patternLength = 128;
        this.createInterface();
        this.setupEventListeners();
    }

    createInterface() {
        const drumContainer = this.createDrumContainer();
        const drumControls = this.createDrumControls();
        const navigation = this.createNavigation();
        const drumGrid = this.createDrumGrid();

        drumContainer.append(drumControls, navigation, drumGrid);
        this.container.appendChild(drumContainer);

        this.initializeComponents();
    }

    createDrumContainer() {
        const container = document.createElement('div');
        container.className = 'drum-container';
        return container;
    }

    createDrumControls() {
        const controls = document.createElement('div');
        controls.className = 'drum-controls';

        const samples = this.createSamplesSection();
        const knobs = this.createKnobsContainer();
        const patternSelector = this.createPatternSelector();

        controls.append(samples, knobs, patternSelector);
        return controls;
    }

    createSamplesSection() {
        const samples = document.createElement('div');
        samples.className = 'drum-samples';
        
        ['kick', 'snare', 'hihat', 'clap'].forEach(drum => {
            samples.appendChild(this.createSampleLoader(drum));
        });

        return samples;
    }

    createSampleLoader(drum) {
        const loader = document.createElement('div');
        loader.className = 'sample-loader';
        loader.dataset.drum = drum;

        const span = document.createElement('span');
        span.textContent = drum.toUpperCase();

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        input.dataset.drum = drum;

        const status = document.createElement('div');
        status.className = 'sample-status';
        status.textContent = 'No sample loaded';

        loader.append(span, input, status);
        return loader;
    }

    createKnobsContainer() {
        const knobs = document.createElement('div');
        knobs.className = 'drum-knobs';
        return knobs;
    }

    createPatternSelector() {
        const selector = document.createElement('div');
        selector.className = 'pattern-selectore';

        const memory = this.createPatternMemory();
        const actions = this.createPatternActions();

        selector.append(memory, actions);
        return selector;
    }

    createPatternMemory() {
        const memory = document.createElement('div');
        memory.className = 'pattern-memory';

        for (let i = 1; i <= 4; i++) {
            memory.appendChild(this.createMemorySlot(i));
        }

        return memory;
    }

    createMemorySlot(index) {
        const slot = document.createElement('div');
        slot.className = 'memory-slot';
        slot.dataset.slot = index.toString();

        const memoryBtn = document.createElement('button');
        memoryBtn.className = 'memory-btn';
        memoryBtn.dataset.slot = index.toString();
        memoryBtn.textContent = index.toString();

        const midiLearnBtn = this.createMidiLearnButton(index);

        slot.append(memoryBtn, midiLearnBtn);
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

    createPatternActions() {
        const actions = document.createElement('div');
        actions.className = 'pattern-actionse';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'save-btn';
        saveBtn.textContent = 'SAVE';
        
        actions.appendChild(saveBtn);
        return actions;
    }

    createNavigation() {
        const nav = this.createBaseNavigation();
        const [navControls, lengthControl] = this.createNavigationComponents();
        nav.append(navControls, lengthControl);
        return nav;
    }

    createBaseNavigation() {
        const nav = document.createElement('div');
        nav.className = 'pattern-navigation';
        return nav;
    }

    createNavigationComponents() {
        const navControls = this.createNavControls();
        const lengthControl = this.createLengthControl();
        return [navControls, lengthControl];
    }

    createNavControls() {
        const navControls = document.createElement('div');
        navControls.className = 'nav-controls';

        const prevBtn = this.createNavigationButton('prev-section', '◀', true);
        const sectionDisplay = this.createSectionDisplay();
        const nextBtn = this.createNavigationButton('next-section', '▶', false);
        
        // Aggiungi i pulsanti copy/paste
        const copyBtn = document.createElement('button');
        copyBtn.className = 'nav-btn copy-btn';
        copyBtn.textContent = 'COPY';
        
        const pasteBtn = document.createElement('button');
        pasteBtn.className = 'nav-btn paste-btn';
        pasteBtn.textContent = 'PASTE';
        
        copyBtn.addEventListener('click', () => this.handleCopy());
        pasteBtn.addEventListener('click', () => this.handlePaste());

        navControls.append(prevBtn, sectionDisplay, nextBtn, copyBtn, pasteBtn);
        return navControls;
    }

    createNavigationButton(className, text, isDisabled) {
        const button = document.createElement('button');
        button.className = `nav-btn ${className}`;
        button.textContent = text;
        button.disabled = isDisabled;
        return button;
    }

    createSectionDisplay() {
        const sectionDisplay = document.createElement('span');
        sectionDisplay.className = 'section-display';
        sectionDisplay.textContent = '1/4';
        return sectionDisplay;
    }

    createLengthControl() {
        const lengthControl = document.createElement('div');
        lengthControl.className = 'pattern-length-control';

        const lengthLabel = document.createElement('span');
        lengthLabel.textContent = 'LENGTH';

        const lengthSelect = this.createLengthSelect();

        lengthControl.append(lengthLabel, lengthSelect);
        return lengthControl;
    }

    createLengthSelect() {
        const select = document.createElement('select');
        select.className = 'pattern-length-select';

        const lengths = [
            { value: '32', text: '1 BAR' },
            { value: '64', text: '2 BARS' },
            { value: '96', text: '3 BARS' },
            { value: '128', text: '4 BARS' }
        ];

        lengths.forEach(({ value, text }) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = text;
            option.selected = value === '128';
            select.appendChild(option);
        });

        // Aggiungi l'event listener per il cambio di lunghezza
        select.addEventListener('change', (e) => {
            this.paramChangeCallback?.('patternLength', e.target.value);
        });

        return select;
    }

    createDrumGrid() {
        const grid = document.createElement('div');
        grid.className = 'drum-grid';
        return grid;
    }

    initializeComponents() {
        this.createKnobs();
        this.createSequencer();
        this.setupSampleLoaders();
        this.addCopyPasteControls(this.container.querySelector('.drum-grid'));
        this.setupNavigationControls();
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
        grid.innerHTML = '';
        
        const drums = ['kick', 'snare', 'hihat', 'clap'];
        const STEPS = 32;
        const STEPS_PER_BAR = 8;

        drums.forEach(drum => {
            const row = document.createElement('div');
            row.className = 'drum-row';
            row.dataset.drum = drum;

            for (let step = 0; step < STEPS; step++) {
                const cell = document.createElement('div');
                cell.className = 'drum-cell';
                cell.dataset.step = step;
                
                // Marcatori per inizio battuta e metà battuta
                if (step % STEPS_PER_BAR === 0) {
                    cell.classList.add('bar-start');
                } else if (step % (STEPS_PER_BAR/2) === 0) {
                    cell.classList.add('half-bar');
                }

                cell.addEventListener('click', () => this.handleCellClick(cell));
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
        const handlers = {
            'click': {
                '.memory-btn': (e, target) => {
                    // Corretto il nome del metodo
                    if (this.isSaveMode) {
                        this.handleSaveMode(target);
                    } else {
                        this.handleLoadMode(target);
                    }
                },
                '.save-btn': (e, target) => {
                    this.isSaveMode = !this.isSaveMode;
                    this.container.querySelectorAll('.memory-btn').forEach(btn => {
                        btn.classList.toggle('saving', this.isSaveMode);
                    });
                },
                '.memory-slot .midi-learn-btn': (e, target) => {
                    e.stopPropagation();
                    
                    // Reset altri pulsanti MIDI learn
                    this.container.querySelectorAll('.midi-learn-btn.learning').forEach(btn => {
                        if (btn !== target) {
                            btn.classList.remove('learning');
                            this.drumMachine.midiMapping.stopLearning();
                        }
                    });

                    // Toggle learning mode
                    const isLearning = target.classList.toggle('learning');
                    
                    if (isLearning) {
                        this.drumMachine.midiMapping.startLearning(target.dataset.param);
                        
                        // Timeout di sicurezza
                        setTimeout(() => {
                            if (target.classList.contains('learning')) {
                                target.classList.remove('learning');
                                this.drumMachine.midiMapping.stopLearning();
                            }
                        }, 10000);
                    } else {
                        this.drumMachine.midiMapping.stopLearning();
                    }
                }
            }
        };

        // Use a single event listener per type with delegation
        Object.entries(handlers).forEach(([eventType, eventHandlers]) => {
            this.container.addEventListener(eventType, (e) => {
                for (const [selector, handler] of Object.entries(eventHandlers)) {
                    const target = e.target.closest(selector);
                    if (target) {
                        handler(e, target);
                        break;
                    }
                }
            }, { passive: eventType !== 'click' });
        });
    }

    handleCellClick(cell) {
        const drum = cell.parentElement.dataset.drum;
        const step = parseInt(cell.dataset.step);  // Ora contiene lo step globale

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
        
        // Feedback visivo immediato
        btn.classList.add('saving');
        
        // Salva il pattern
        if (this.drumMachine.saveCurrentPattern(slot)) {
            // Feedback di successo
            btn.classList.remove('saving');
            btn.classList.add('saved');
            
            // Reset dello stato
            setTimeout(() => {
                btn.classList.remove('saved');
                this.isSaveMode = false;
                this.isSaving = false;
                this.container.querySelectorAll('.memory-btn').forEach(b => {
                    b.classList.remove('saving');
                });
            }, 300);
        } else {
            // Feedback di errore
            btn.classList.remove('saving');
            btn.classList.add('error');
            setTimeout(() => {
                btn.classList.remove('error');
                this.isSaving = false;
            }, 300);
        }
    }

    handleLoadMode(btn) {
        const slot = btn.dataset.slot;
        
        // Feedback visivo immediato
        btn.classList.add('loading');
        
        // Rimuovi la selezione precedente
        this.container.querySelectorAll('.memory-btn').forEach(b => {
            b.classList.remove('active', 'loading');
        });
        
        // Carica il pattern
        if (this.drumMachine.loadSavedPattern(slot)) {
            // Feedback di successo
            btn.classList.remove('loading');
            btn.classList.add('active');
            
            // Aggiorna il selettore di lunghezza
            const lengthSelect = this.container.querySelector('.pattern-length-select');
            if (lengthSelect) {
                lengthSelect.value = this.drumMachine.selectedLength.toString();
            }
        } else {
            // Feedback di errore
            btn.classList.remove('loading');
            btn.classList.add('error');
            setTimeout(() => btn.classList.remove('error'), 300);
        }
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

    highlightStep(localStep, playingBar) {
        // Rimuovi tutti gli highlight precedenti
        this.container.querySelectorAll('.drum-cell.playing')
            .forEach(cell => cell.classList.remove('playing'));
        
        // In play mode o se stiamo visualizzando la battuta corrente
        if (!this.drumMachine.isEditMode || this.currentBar === playingBar) {
            // Calcola lo step corretto nella vista corrente
            const stepInView = localStep + (this.currentBar * 32);
            
            this.container.querySelectorAll(`.drum-cell[data-step="${stepInView}"]`)
                .forEach(cell => cell.classList.add('playing'));
        }
    }

    setParameterChangeCallback(callback) {
        this.paramChangeCallback = callback;
    }

    setSequenceChangeCallback(callback) {
        this.sequenceChangeCallback = callback;
    }

    copySteps(start, end) {
        const data = {};
        // Calcola l'offset basato sulla battuta corrente
        const barOffset = this.currentBar * 32;
        const globalStart = barOffset + start;
        const globalEnd = barOffset + end;
        
        this.container.querySelectorAll('.drum-row').forEach(row => {
            const drum = row.dataset.drum;
            data[drum] = Array.from(this.drumMachine.sequence[drum]
                .slice(globalStart, globalEnd)
                .map(step => ({
                    active: step.active,
                    accent: step.velocity > 1,
                    velocity: step.velocity
                })));
        });
        return data;
    }

    pasteSteps(data, targetStep) {
        // Calcola l'offset basato sulla battuta corrente
        const barOffset = this.currentBar * 32;
        const globalTargetStep = barOffset + targetStep;
        
        Object.entries(data).forEach(([drum, steps]) => {
            steps.forEach((stepData, index) => {
                const globalStep = globalTargetStep + index;
                // Verifica che non stiamo scrivendo oltre i limiti della sequenza
                if (globalStep < this.drumMachine.selectedLength) {
                    this.drumMachine.sequence[drum][globalStep] = {
                        active: stepData.active,
                        velocity: stepData.accent ? 1.5 : stepData.active ? 1 : 0
                    };
                }
            });
        });
        
        // Aggiorna la visualizzazione
        this.updateSequenceDisplay(this.drumMachine.sequence);
    }

    addCopyPasteControls(gridElement) {
        let copyStart = -1;
        let copyEnd = -1;
        let selectionBox = null;
    
        const clearSelection = () => {
            if (selectionBox) {
                selectionBox.remove();
                selectionBox = null;
            }
            copyStart = -1;
            copyEnd = -1;
        };
    
        const createSelectionBox = (start, end) => {
            if (selectionBox) selectionBox.remove();
            
            const startCell = gridElement.querySelector(`[data-step="${start}"]`);
            const endCell = gridElement.querySelector(`[data-step="${end}"]`);
            if (!startCell || !endCell) return;
            
            const rect = {
                left: Math.min(startCell.offsetLeft, endCell.offsetLeft),
                top: 0,
                width: Math.abs(endCell.offsetLeft - startCell.offsetLeft) + endCell.offsetWidth,
                height: gridElement.offsetHeight
            };
    
            selectionBox = document.createElement('div');
            selectionBox.className = 'selection-box';
            selectionBox.style.cssText = `
                position: absolute;
                left: ${rect.left}px;
                top: ${rect.top}px;
                width: ${rect.width}px;
                height: ${rect.height}px;
                background: rgba(0, 255, 157, 0.1);
                border: 1px solid rgba(0, 255, 157, 0.3);
                pointer-events: none;
                z-index: 1;
            `;
            
            gridElement.appendChild(selectionBox);
        };
    
        gridElement.addEventListener('mousedown', e => {
            const cell = e.target.closest('.drum-cell');
            if (!cell) return;
            
            copyStart = parseInt(cell.dataset.step) % 32; // Usiamo solo l'offset locale
            copyEnd = copyStart;
            createSelectionBox(copyStart, copyEnd);
        });
    
        gridElement.addEventListener('mousemove', e => {
            if (copyStart === -1) return;
            
            const cell = e.target.closest('.drum-cell');
            if (!cell) return;
            
            copyEnd = parseInt(cell.dataset.step) % 32; // Usiamo solo l'offset locale
            createSelectionBox(copyStart, copyEnd);
        });
    
        gridElement.addEventListener('mouseup', () => {
            if (copyStart !== -1 && copyEnd !== -1) {
                const start = Math.min(copyStart, copyEnd);
                const end = Math.max(copyStart, copyEnd) + 1;
                const copiedData = this.copySteps(start, end);
                
                // Salva i dati copiati nel localStorage
                localStorage.setItem('drumMachineCopyBuffer', JSON.stringify({
                    data: copiedData,
                    length: end - start
                }));
            }
            clearSelection();
        });
    
        // Gestione CTRL+V
        document.addEventListener('keydown', e => {
            if (e.ctrlKey && e.key === 'v') {
                const savedBuffer = localStorage.getItem('drumMachineCopyBuffer');
                if (savedBuffer) {
                    const { data, length } = JSON.parse(savedBuffer);
                    // Troviamo la cella più vicina al mouse
                    const mouseX = e.clientX;
                    const cells = Array.from(gridElement.querySelectorAll('.drum-cell'));
                    const targetCell = cells.reduce((closest, cell) => {
                        const rect = cell.getBoundingClientRect();
                        const distance = Math.abs(rect.left - mouseX);
                        return (!closest || distance < closest.distance) 
                            ? { cell, distance } 
                            : closest;
                    }, null);
    
                    if (targetCell) {
                        const targetStep = parseInt(targetCell.cell.dataset.step) % 32;
                        this.pasteSteps(data, targetStep);
                    }
                }
            }
        });
    }

    updateSequenceDisplay(sequence) {
        if (!sequence) return;  // Aggiungi questo check
        
        // Prima rimuoviamo tutte le classi active e accent
        this.container.querySelectorAll('.drum-cell').forEach(cell => {
            cell.classList.remove('active', 'accent');
        });

        // Poi applichiamo il nuovo stato
        Object.entries(sequence).forEach(([drum, steps]) => {
            const row = this.container.querySelector(`.drum-row[data-drum="${drum}"]`);
            if (row) {
                const visibleSteps = steps.slice(this.currentBar * 32, (this.currentBar + 1) * 32);
                visibleSteps.forEach((step, localIndex) => {
                    const cell = row.querySelector(`[data-step="${(this.currentBar * 32) + localIndex}"]`);
                    if (cell && step?.active) {
                        cell.classList.add('active');
                        if (step.velocity > 1) {
                            cell.classList.add('accent');
                        }
                    }
                });
            }
        });
    }

    setupNavigationControls() {
        this.navControls = {
            prev: this.container.querySelector('.prev-section'),
            next: this.container.querySelector('.next-section'),
            display: this.container.querySelector('.section-display'),
            edit: this.createEditModeButton()  // Ora il metodo esiste
        };

        // Aggiungi il bottone edit/play
        this.container.querySelector('.nav-controls').appendChild(this.navControls.edit);
        
        // Event handlers per la navigazione
        this.navControls.prev.addEventListener('click', () => {
            if (this.drumMachine.isEditMode) {
                this.drumMachine.navigateToBar(this.drumMachine.currentBar - 1);
            }
        });

        this.navControls.next.addEventListener('click', () => {
            if (this.drumMachine.isEditMode) {
                this.drumMachine.navigateToBar(this.drumMachine.currentBar + 1);
            }
        });

        // Inizializza la vista con i valori corretti
        this.updateView(this.drumMachine.currentBar, this.drumMachine.numBars);
    }

    updateView(barNumber, totalBars) {
        // Aggiorna lo stato interno
        this.currentBar = barNumber;

        // Aggiorna i controlli di navigazione
        if (this.navControls) {
            this.navControls.prev.disabled = !this.drumMachine.isEditMode || barNumber === 0;
            this.navControls.next.disabled = !this.drumMachine.isEditMode || barNumber === totalBars - 1;
            this.navControls.display.textContent = `BAR ${barNumber + 1}/${totalBars}`;
        }

        // Aggiorna la griglia con gli step corretti
        this.updateGridView();
    }

    setEditMode(enabled) {
        if (this.navControls?.edit) {
            this.navControls.edit.classList.toggle('active', enabled);
            this.navControls.edit.textContent = enabled ? 'EDIT' : 'PLAY';
        }

        // Aggiorna lo stato dei controlli di navigazione
        if (this.navControls) {
            this.navControls.prev.disabled = !enabled || this.drumMachine.currentBar === 0;
            this.navControls.next.disabled = !enabled || this.drumMachine.currentBar === this.drumMachine.numBars - 1;
        }
    }

    showBar(barNumber) {
        if (barNumber !== this.currentBar) {
            this.currentBar = barNumber;
            this.updateGridView();
            
            // Aggiorna il display
            const display = this.container.querySelector('.section-display');
            if (display) {
                display.textContent = `BAR ${barNumber + 1}`;
            }
        }
    }

    updateGridView() {
        if (!this.drumMachine?.sequence) return;  // Aggiungi questo check

        const startStep = this.currentBar * 32;
        const cells = this.container.querySelectorAll('.drum-cell');
        
        // Aggiorna gli step visualizzati
        cells.forEach(cell => {
            const originalStep = parseInt(cell.dataset.step) % 32; // Mantieni solo l'offset locale
            cell.dataset.step = originalStep + startStep; // Aggiungi l'offset della battuta
        });

        // Aggiorna lo stato delle celle dalla sequenza
        this.updateSequenceDisplay(this.drumMachine.sequence);
    }

    createEditModeButton() {
        const btn = document.createElement('button');
        btn.className = 'edit-mode-btn active';  // Attivo di default
        btn.textContent = 'EDIT';
        
        btn.addEventListener('click', () => {
            const isEdit = !this.drumMachine.isEditMode;
            this.drumMachine.setEditMode(isEdit);
        });

        return btn;
    }

    handleCopy() {
        // Copia l'intera battuta corrente
        const start = 0;
        const end = 32;
        const copiedData = this.copySteps(start, end);
        
        localStorage.setItem('drumMachineCopyBuffer', JSON.stringify({
            data: copiedData,
            length: end - start
        }));

        // Feedback visivo
        const copyBtn = this.container.querySelector('.copy-btn');
        copyBtn.classList.add('active');
        setTimeout(() => copyBtn.classList.remove('active'), 200);
    }

    handlePaste() {
        const savedBuffer = localStorage.getItem('drumMachineCopyBuffer');
        if (savedBuffer) {
            const { data } = JSON.parse(savedBuffer);
            this.pasteSteps(data, 0); // Incolliamo sempre all'inizio della battuta corrente
            
            // Feedback visivo
            const pasteBtn = this.container.querySelector('.paste-btn');
            pasteBtn.classList.add('active');
            setTimeout(() => pasteBtn.classList.remove('active'), 200);
        }
    }

    // Costanti per il layout del sequencer
    static GRID_CONSTANTS = {
        CELL_WIDTH: 30,
        CELL_SPACING: 4,
        STEPS_PER_PAGE: 32,
        STEPS_PER_BAR: 8,
        BAR_SPACING: 12
    };
}
