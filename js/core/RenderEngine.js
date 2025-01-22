import { TB303 } from '../audio-components/instruments/tb303/TB303.js';
import { DrumMachine } from '../audio-components/instruments/drummer/DrumMachine.js';
import { Sampler } from '../audio-components/instruments/sampler/Sampler.js';  // Aggiungi questa riga

export class RenderEngine {
    constructor(audioEngine) {
        this.audioEngine = audioEngine;
        this.container = document.createElement('div');
        this.container.className = 'studio-container';
        this.beatIndicators = [];
        this.currentBeatDisplay = null;
        this.transportState = null;
        this.setupTransportSection();
        this.setupInstrumentRack();
        this.setupMixerSection();

        // Setup audio engine beat callback
        this.audioEngine.onBeatUpdate = (beat) => {
            // Ensure we're using a 32-step pattern
            const normalizedBeat = beat % 32;  // Add this line
            this.updateTransportDisplay(normalizedBeat);
        };

        // Add performance optimizations
        this.frameRequest = null;
        this.lastRenderTime = 0;
        this.renderInterval = 1000 / 30; // 30 FPS max for UI updates

        // Optimize UI updates
        this.pendingUIUpdate = false;
        this.lastUIUpdateTime = 0;
        this.minUIUpdateInterval = 33; // ~30fps

        // Add debounce utility
        this.debounceTimeout = null;
        this.isAnimating = false;

        // Aggiungi performance optimizations
        this.frameRequest = null;
        this.lastBeatUpdate = 0;
        this.minUpdateInterval = 16; // ~60fps
        this.pendingUpdates = new Map();
        this.isUpdating = false;
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
            { id: 'sampler', name: 'Sampler', class: Sampler }  // Aggiungi questa riga
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

    addInstrumentUI(id, instrumentComponent) {
        const instrumentContainer = document.createElement('div');
        instrumentContainer.className = 'instrument-container';
        instrumentContainer.dataset.type = instrumentComponent.constructor.name.toLowerCase();

        // Create header
        const header = document.createElement('div');
        header.className = 'instrument-header';

        // Add title
        const title = document.createElement('h3');
        title.textContent = instrumentComponent.constructor.name;
        
        // Add collapse button with optimized animation
        const collapseBtn = document.createElement('button');
        collapseBtn.className = 'collapse-btn';
        collapseBtn.innerHTML = '▼';
        
        // Optimize collapse animation
        const handleCollapse = (e) => {
            if (this.isAnimating) return;
            e.stopPropagation();
            
            this.isAnimating = true;
            const panel = instrumentContainer.querySelector('.instrument-panel');
            
            // Use CSS transform instead of height animation
            requestAnimationFrame(() => {
                instrumentContainer.classList.toggle('collapsed');
                collapseBtn.style.transform = 
                    instrumentContainer.classList.contains('collapsed') 
                        ? 'rotate(0deg)' 
                        : 'rotate(180deg)';
                
                // Save state after animation is complete
                clearTimeout(this.debounceTimeout);
                this.debounceTimeout = setTimeout(() => {
                    const type = instrumentContainer.dataset.type;
                    localStorage.setItem(`${type}-${id}-collapsed`, 
                        instrumentContainer.classList.contains('collapsed'));
                    this.isAnimating = false;
                }, 200);
            });
        };

        collapseBtn.onclick = handleCollapse;
        header.onclick = (e) => {
            if (!this.isAnimating) handleCollapse(e);
        };

        // Add remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-instrument';
        removeBtn.textContent = '✕';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            this.audioEngine.removeInstrument(id);
            instrumentContainer.remove();
        };

        // Add mute button
        const muteBtn = document.createElement('button');
        muteBtn.textContent = 'Mute';
        muteBtn.className = 'mute-btn';
        muteBtn.onclick = (e) => {
            e.stopPropagation();
            const shouldMute = !muteBtn.classList.contains('active');
            // Se stiamo unmutando uno strumento in solo, disattiva il solo
            if (!shouldMute && soloBtn.classList.contains('active')) {
                soloBtn.classList.remove('active');
                this.audioEngine.soloInstrument(id, false);
            }
            this.audioEngine.muteInstrument(id, shouldMute);
        };

        // Add solo button
        const soloBtn = document.createElement('button');
        soloBtn.textContent = 'Solo';
        soloBtn.className = 'solo-btn';
        soloBtn.onclick = (e) => {
            e.stopPropagation();
            const shouldSolo = !soloBtn.classList.contains('active');
            
            if (shouldSolo) {
                // Se stiamo attivando il solo, disattiva il mute
                muteBtn.classList.remove('active');
            }
            
            this.audioEngine.soloInstrument(id, shouldSolo);
        };

        // Listen for state changes with cleanup
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
        
        // Cleanup event listener when instrument is removed
        instrumentContainer.addEventListener('remove', () => {
            window.removeEventListener('instrumentStateChange', stateChangeHandler);
        });

        // Set data attribute for targeting
        instrumentContainer.dataset.instrumentId = id;

        // Assemble header
        header.appendChild(title);
        header.appendChild(collapseBtn);
        header.appendChild(removeBtn);
        header.appendChild(muteBtn);
        header.appendChild(soloBtn);

        // Make entire header clickable for collapse
        header.onclick = () => collapseBtn.click();

        // Instrument panel
        const instrumentPanel = document.createElement('div');
        instrumentPanel.className = 'instrument-panel';
        instrumentPanel.appendChild(instrumentComponent.render());

        // Assemble the layout
        instrumentContainer.append(header, instrumentPanel);
        this.instrumentRack.appendChild(instrumentContainer);

        // Restore collapsed state from localStorage
        const type = instrumentContainer.dataset.type;
        const isCollapsed = localStorage.getItem(`${type}-${id}-collapsed`) === 'true';
        if (isCollapsed) {
            instrumentContainer.classList.add('collapsed');
            collapseBtn.style.transform = 'rotate(0deg)';
        }

        // Optimize event delegation
        instrumentContainer.addEventListener('click', (e) => {
            const target = e.target;
            if (target.classList.contains('collapse-btn')) {
                this.handleCollapse(instrumentContainer);
            } else if (target.classList.contains('remove-instrument')) {
                this.handleRemove(id, instrumentContainer);
            } else if (target.classList.contains('mute-btn')) {
                this.handleMute(id, target);
            } else if (target.classList.contains('solo-btn')) {
                this.handleSolo(id, target);
            }
        }, { passive: true });
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
