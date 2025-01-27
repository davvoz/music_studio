import { TB303 } from '../audio-components/instruments/tb303/TB303.js';
import { DrumMachine } from '../audio-components/instruments/drummer/DrumMachine.js';
import { Sampler } from '../audio-components/instruments/sampler/Sampler.js';  // Aggiungi questa riga
import { Looper } from '../audio-components/instruments/looper/Looper.js';  // Aggiungi questa riga

export class RenderEngine {
    constructor(audioEngine) {
        this.audioEngine = audioEngine;
        this.container = document.createElement('div');
        this.container.className = 'studio-container';
        this.beatIndicators = [];
        this.currentBeatDisplay = null;
        this.transportState = null;
        
        // Basic setup
        this.setupTransportSection();
        this.setupInstrumentRack();
        this.setupMixerSection();

        // Performance settings
        this.frameRequest = null;
        this.lastRenderTime = 0;
        this.renderInterval = 1000 / 30;
        this.pendingUIUpdate = false;
        this.lastUIUpdateTime = 0;
        this.minUIUpdateInterval = 33;
        this.debounceTimeout = null;
        this.isAnimating = false;
        this.instrumentCache = new Map();
        this.uiUpdateQueue = new Set();
        this.lastUIUpdate = 0;
        this.updateInterval = 1000 / 60;

        // Setup audio engine beat callback
        this.audioEngine.onBeatUpdate = (beat) => {
            const normalizedBeat = beat % 32;
            this.updateTransportDisplay(normalizedBeat);
        };
    }

    setupTransportSection() {
        const transport = document.createElement('div');
        transport.className = 'transport-section';

        // Transport state display
        this.transportState = document.createElement('div');
        this.transportState.className = 'transport-state';
        this.transportState.textContent = 'STOPPED';

        // Play/Stop buttons
        const playButton = document.createElement('button');
        playButton.textContent = '►';
        playButton.onclick = () => {
            this.audioEngine.start();
            this.transportState.textContent = 'PLAYING';
            playButton.classList.add('active');
            stopButton.classList.remove('active');
        };

        const stopButton = document.createElement('button');
        stopButton.textContent = '■';
        stopButton.onclick = () => {
            this.audioEngine.stop();
            this.transportState.textContent = 'STOPPED';
            stopButton.classList.add('active');
            playButton.classList.remove('active');
        };

        // Add metronome button after play/stop buttons
        const metronomeButton = document.createElement('button');
        metronomeButton.textContent = '🔔';
        metronomeButton.className = 'metronome-button';
        metronomeButton.onclick = () => {
            const isEnabled = this.audioEngine.toggleMetronome();
            metronomeButton.classList.toggle('active', isEnabled);
        };

        // Add Instrument button in transport section
        const addButton = document.createElement('button');
        addButton.className = 'add-instrument-btn';
        addButton.textContent = '+ Add Instrument';
        addButton.onclick = () => this.showInstrumentModal();

        // Aggiungi i pulsanti per il progetto dopo il pulsante Add Instrument
        const projectControls = document.createElement('div');
        projectControls.className = 'project-controls';
        
        const saveProjectBtn = document.createElement('button');
        saveProjectBtn.className = 'save-project-btn';
        saveProjectBtn.textContent = 'Save Project';
        saveProjectBtn.onclick = () => this.saveProject();

        const loadProjectBtn = document.createElement('button');
        loadProjectBtn.className = 'load-project-btn';
        loadProjectBtn.textContent = 'Load Project';
        loadProjectBtn.onclick = () => this.loadProject();

        projectControls.append(saveProjectBtn, loadProjectBtn);

        // Tempo section
        const tempoSection = document.createElement('div');
        tempoSection.className = 'tempo-section';
        
        const tempoLabel = document.createElement('span');
        tempoLabel.textContent = 'BPM: ';
        
        const tempoInput = document.createElement('input');
        tempoInput.type = 'number';
        tempoInput.value = this.audioEngine.tempo / 4; // Dividiamo per 4 il valore visualizzato
        tempoInput.min = '30';
        tempoInput.max = '300';
        
        // Use change instead of input event
        let tempoTimeout;
        tempoInput.addEventListener('change', (e) => {
            clearTimeout(tempoTimeout);
            tempoTimeout = setTimeout(() => {
                const displayValue = parseInt(e.target.value);
                const actualTempo = displayValue * 4;
                this.audioEngine.setTempo(actualTempo);
            }, 100);
        }, { passive: true });

        // Beat indicators
        const beatDisplay = document.createElement('div');
        beatDisplay.className = 'beat-display';
        
        for (let i = 0; i < 16; i++) {
            const beat = document.createElement('div');
            beat.className = 'beat-indicator';
            if (i % 4 === 0) beat.classList.add('bar-start');
            beatDisplay.appendChild(beat);
            this.beatIndicators.push(beat);
        }

        // Current beat/bar display
        this.currentBeatDisplay = document.createElement('div');
        this.currentBeatDisplay.className = 'current-beat';
        this.currentBeatDisplay.textContent = '1.1';

        tempoSection.append(tempoLabel, tempoInput);
        transport.append(
            this.transportState,
            playButton, 
            stopButton, 
            //metronomeButton,
            addButton,  // Add the button here
            projectControls,  // Aggiungi i controlli del progetto
            tempoSection,
            //beatDisplay,
            //this.currentBeatDisplay
        );
        
        this.container.appendChild(transport);

        // Setup beat update listener
        this.audioEngine.onBeatUpdate = (beat) => {
            this.updateBeatIndicators(beat);
        };
    }

    saveProject() {
        const project = {
            tempo: this.audioEngine.tempo,
            instruments: []
        };

        this.audioEngine.instruments.forEach((instrument, id) => {
            const type = instrument.constructor.name;
            const config = {
                id,
                type,
                parameters: instrument.parameters,
                sequence: instrument.sequence,
                // Aggiungi le mappature MIDI se l'instrument le supporta
                midiMappings: instrument.midiMapping?.getMappings() || {}
            };
            project.instruments.push(config);
        });

        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const projectKey = `music_studio_project_${timestamp}`;
            localStorage.setItem(projectKey, JSON.stringify(project));

            // Salva la lista dei progetti
            const projectsList = JSON.parse(localStorage.getItem('music_studio_projects') || '[]');
            projectsList.push({
                key: projectKey,
                name: `Project ${timestamp}`,
                date: timestamp
            });
            localStorage.setItem('music_studio_projects', JSON.stringify(projectsList));

            alert('Project saved successfully!');
        } catch (error) {
            console.error('Error saving project:', error);
            alert('Error saving project!');
        }
    }

    loadProject() {
        const projectsList = JSON.parse(localStorage.getItem('music_studio_projects') || '[]');
        if (projectsList.length === 0) {
            alert('No saved projects found!');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'project-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Load Project</h2>
                <div class="projects-list">
                    ${projectsList.map(proj => `
                        <div class="project-item" data-key="${proj.key}">
                            <span>${proj.name}</span>
                            <span class="project-date">${new Date(proj.date).toLocaleString()}</span>
                            <button class="delete-project">✕</button>
                        </div>
                    `).join('')}
                </div>
                <button class="modal-close">Close</button>
            </div>
        `;

        modal.querySelector('.modal-close').onclick = () => modal.remove();

        modal.addEventListener('click', async (e) => {
            const projectItem = e.target.closest('.project-item');
            const deleteBtn = e.target.closest('.delete-project');

            if (deleteBtn) {
                e.stopPropagation();
                const key = projectItem.dataset.key;
                if (confirm('Delete this project?')) {
                    localStorage.removeItem(key);
                    const updatedList = projectsList.filter(p => p.key !== key);
                    localStorage.setItem('music_studio_projects', JSON.stringify(updatedList));
                    projectItem.remove();
                }
                return;
            }

            if (projectItem) {
                const key = projectItem.dataset.key;
                const projectData = JSON.parse(localStorage.getItem(key));
                await this.loadProjectData(projectData);
                modal.remove();
            }
        });

        document.body.appendChild(modal);
    }

    async loadProjectData(project) {
        // Stop playback and clear current instruments
        this.audioEngine.stop();
        Array.from(this.audioEngine.instruments.keys()).forEach(id => {
            this.audioEngine.removeInstrument(id);
            const element = this.instrumentRack.querySelector(`[data-instance-id="${id}"]`);
            element?.remove();
        });

        // Set tempo
        this.audioEngine.setTempo(project.tempo);

        // Load instruments
        for (const inst of project.instruments) {
            try {
                const InstrumentClass = this.getInstrumentClass(inst.type);
                if (InstrumentClass) {
                    const instrument = new InstrumentClass(this.audioEngine.context);
                    
                    // Restore parameters and sequence
                    Object.assign(instrument.parameters, inst.parameters);
                    if (inst.sequence) {
                        instrument.sequence = inst.sequence;
                    }

                    // Restore MIDI mappings if available
                    if (inst.midiMappings && instrument.midiMapping) {
                        instrument.midiMapping.setMappings(inst.midiMappings);
                    }

                    // Add instrument to engine
                    this.audioEngine.addInstrument(inst.id, instrument);
                    this.addInstrumentUI(inst.id, instrument);

                    // Allow time for instrument initialization
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } catch (error) {
                console.error(`Error loading instrument ${inst.type}:`, error);
            }
        }
    }

    getInstrumentClass(type) {
        switch (type) {
            case 'TB303': return TB303;
            case 'DrumMachine': return DrumMachine;
            case 'Sampler': return Sampler;
            case 'Looper': return Looper;
            default: return null;
        }
    }

    updateBeatIndicators(currentBeat) {
        if (this.isAnimating) return;

        const now = performance.now();
        if (now - this.lastUIUpdateTime < this.minUIUpdateInterval || this.pendingUIUpdate) {
            return;
        }

        this.pendingUIUpdate = true;
        this.lastUIUpdateTime = now;

        requestAnimationFrame(() => {
            this.beatIndicators.forEach((indicator, index) => {
                indicator.classList.toggle('active', index === currentBeat);
            });
            
            const bar = Math.floor(currentBeat / 4) + 1;
            const beat = (currentBeat % 4) + 1;
            this.currentBeatDisplay.textContent = `${bar}.${beat}`;
            
            this.pendingUIUpdate = false;
        });
    }

    updateTransportDisplay(beat) {
        if (this.isUpdating) return;
        
        const now = performance.now();
        if (now - this.lastBeatUpdate < this.minUpdateInterval) {
            if (!this.frameRequest) {
                this.frameRequest = requestAnimationFrame(() => this.updateTransportDisplay(beat));
            }
            return;
        }

        this.isUpdating = true;
        this.lastBeatUpdate = now;
        
        // Batch DOM updates
        requestAnimationFrame(() => {
            // Update transport display for 32 steps instead of 16
            const totalSteps = 32;
            const currentBar = Math.floor(beat / 8) + 1;
            const currentBeat = (beat % 8) + 1;
            
            if (this.transportDisplay) {
                this.transportDisplay.textContent = 
                    `BAR ${currentBar} : BEAT ${currentBeat}`;
            }
            this.isUpdating = false;
            this.frameRequest = null;
        });
    }

    setupInstrumentRack() {
        this.instrumentRack = document.createElement('div');
        this.instrumentRack.className = 'instrument-rack';
        this.instrumentRack.style.display = 'flex';
        this.instrumentRack.style.flexDirection = 'column';
        this.instrumentRack.style.gap = '20px';
        this.container.appendChild(this.instrumentRack);
    }

    setupMixerSection() {
        const mixer = document.createElement('div');
        mixer.className = 'mixer-section';
        
        const masterFader = document.createElement('input');
        masterFader.type = 'range';
        masterFader.min = 0;
        masterFader.max = 1;
        masterFader.step = 0.01;
        masterFader.value = 0.8;
        masterFader.onInput = (e) => {
            this.audioEngine.masterOutput.gain.value = e.target.value;
        };

        mixer.appendChild(masterFader);
        this.container.appendChild(mixer);
    }

    showInstrumentModal() {
        const modal = document.createElement('div');
        modal.className = 'instrument-modal';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        
        const title = document.createElement('h2');
        title.textContent = 'Select Instrument';
        
        const instruments = [
            { id: 'tb303', name: 'TB-303', class: TB303 },
            { id: 'drummer', name: 'Drum Machine', class: DrumMachine },
            { id: 'sampler', name: 'Sampler', class: Sampler }  ,// Aggiungi questa riga
            { id: 'looper', name: 'Looper', class: Looper }  // Aggiungi questa riga
        ];
        
        const list = document.createElement('div');
        list.className = 'instrument-list';
        
        instruments.forEach(inst => {
            const item = document.createElement('button');
            item.className = 'instrument-choice';
            item.textContent = inst.name;
            item.onclick = () => {
                const id = `${inst.id}_${Date.now()}`;
                const instrument = new inst.class(this.audioEngine.context);
                this.audioEngine.addInstrument(id, instrument);
                this.addInstrumentUI(id, instrument);
                modal.remove();
            };
            list.appendChild(item);
        });
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'modal-close';
        closeBtn.textContent = '✕';
        closeBtn.onclick = () => modal.remove();
        
        modalContent.append(closeBtn, title, list);
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
    }

    queueInstrumentUpdate(id, callback) {
        if (!this.uiUpdateQueue.has(id)) {
            this.uiUpdateQueue.add(id);
            requestAnimationFrame(() => {
                callback();
                this.uiUpdateQueue.delete(id);
            });
        }
    }

    addInstrumentUI(id, instrumentComponent) {
        this.queueInstrumentUpdate(id, () => {
            const instrumentContainer = document.createElement('div');
            instrumentContainer.className = 'instrument-container';
            instrumentContainer.dataset.type = instrumentComponent.constructor.name.toLowerCase();
            instrumentContainer.dataset.instanceId = id;  // Aggiungi l'ID dell'istanza

            // Create header with basic controls
            const header = document.createElement('div');
            header.className = 'instrument-header';

            const title = document.createElement('h3');
            title.textContent = instrumentComponent.constructor.name;
            
            const collapseBtn = document.createElement('button');
            collapseBtn.className = 'collapse-btn';
            collapseBtn.innerHTML = '▼';

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-instrument';
            removeBtn.textContent = '✕';

            const muteBtn = document.createElement('button');
            muteBtn.textContent = 'Mute';
            muteBtn.className = 'mute-btn';

            const soloBtn = document.createElement('button');
            soloBtn.textContent = 'Solo';
            soloBtn.className = 'solo-btn';

            // Add click handlers
            muteBtn.onclick = (e) => {
                e.stopPropagation();
                const shouldMute = !muteBtn.classList.contains('active');
                if (!shouldMute && soloBtn.classList.contains('active')) {
                    soloBtn.classList.remove('active');
                    this.audioEngine.soloInstrument(id, false);
                }
                this.audioEngine.muteInstrument(id, shouldMute);
            };

            soloBtn.onclick = (e) => {
                e.stopPropagation();
                const shouldSolo = !soloBtn.classList.contains('active');
                if (shouldSolo) {
                    muteBtn.classList.remove('active');
                }
                this.audioEngine.soloInstrument(id, shouldSolo);
            };

            // Listen for state changes
            const stateChangeHandler = (e) => {
                if (e.detail.id === id) {
                    const { muted, soloed } = e.detail.state;
                    muteBtn.classList.toggle('active', muted);
                    soloBtn.classList.toggle('active', soloed);
                    instrumentContainer.classList.toggle('muted', muted);
                    instrumentContainer.classList.toggle('soloed', soloed);
                }
            };

            window.addEventListener('instrumentStateChange', stateChangeHandler);
            
            // Cleanup on remove
            instrumentContainer.addEventListener('remove', () => {
                window.removeEventListener('instrumentStateChange', stateChangeHandler);
            });

            // Aggiungi l'event listener per il collapse
            header.addEventListener('click', (e) => {
                // Ignora i click sui pulsanti
                if (e.target.tagName === 'BUTTON') return;
                
                const type = instrumentContainer.dataset.type;
                const isCollapsed = instrumentContainer.classList.toggle('collapsed');
                localStorage.setItem(`${type}-${id}-collapsed`, isCollapsed);
                collapseBtn.style.transform = `rotate(${isCollapsed ? '0' : '180'}deg)`;
            });

            // Assemble header
            header.append(title, collapseBtn, removeBtn, muteBtn, soloBtn);

            // Add instrument panel
            const instrumentPanel = document.createElement('div');
            instrumentPanel.className = 'instrument-panel';
            instrumentPanel.appendChild(instrumentComponent.render());

            // Assemble container
            instrumentContainer.append(header, instrumentPanel);
            this.instrumentRack.appendChild(instrumentContainer);

            // Restore collapse state from localStorage
            const type = instrumentContainer.dataset.type;
            const isCollapsed = localStorage.getItem(`${type}-${id}-collapsed`) === 'true';
            if (isCollapsed) {
                instrumentContainer.classList.add('collapsed');
                collapseBtn.style.transform = 'rotate(0deg)';
            }
        });
    }

    setupVUMeter(canvas, instrument) {
        const ctx = canvas.getContext('2d');
        const analyser = instrument.connectAnalyser();
        const worker = new Worker('./js/workers/VUMeterWorker.js');
        
        const dataArray = new Float32Array(analyser.fftSize);
        
        const drawVU = () => {
            analyser.getFloatTimeDomainData(dataArray);
            
            worker.postMessage({
                data: Array.from(dataArray),
                sampleRate: this.audioEngine.context.sampleRate,
                volume: instrument.getVolume?.() || 1
            });

            requestAnimationFrame(drawVU);
        };

        worker.onmessage = (e) => {
            const { rms, peak } = e.data;
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw background
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw meter
            const height = Math.max(0, canvas.height * (1 + rms/60));
            const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
            gradient.addColorStop(0, '#2ecc71');
            gradient.addColorStop(0.6, '#f1c40f');
            gradient.addColorStop(0.8, '#e67e22');
            gradient.addColorStop(1, '#e74c3c');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, canvas.height - height, canvas.width, height);
        };

        drawVU();
    }

    render() {
        return this.container;
    }
}
