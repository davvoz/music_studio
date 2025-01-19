import { TB303 } from '../audio-components/instruments/tb303/TB303.js';
import { DrumMachine } from '../audio-components/instruments/drummer/DrumMachine.js';
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
        tempoInput.onchange = (e) => {
            const displayValue = parseInt(e.target.value);
            const actualTempo = displayValue * 4; // Moltiplichiamo per 4 il valore inserito
            this.audioEngine.setTempo(actualTempo);
        };

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
            metronomeButton,
            addButton,  // Add the button here
            tempoSection,
            beatDisplay,
            this.currentBeatDisplay
        );
        
        this.container.appendChild(transport);

        // Setup beat update listener
        this.audioEngine.onBeatUpdate = (beat) => {
            this.updateBeatIndicators(beat);
        };
    }

    updateBeatIndicators(currentBeat) {
        this.beatIndicators.forEach((indicator, index) => {
            indicator.classList.toggle('active', index === currentBeat);
        });
        
        const bar = Math.floor(currentBeat / 4) + 1;
        const beat = (currentBeat % 4) + 1;
        this.currentBeatDisplay.textContent = `${bar}.${beat}`;
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

        // Add remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-instrument';
        removeBtn.textContent = '✕';
        removeBtn.onclick = () => {
            this.audioEngine.removeInstrument(id);
            instrumentContainer.remove();
        };

        // Instrument panel
        const instrumentPanel = document.createElement('div');
        instrumentPanel.className = 'instrument-panel';
        instrumentPanel.appendChild(instrumentComponent.render());

        // Assemble the layout
        instrumentContainer.append(removeBtn, instrumentPanel);
        this.instrumentRack.appendChild(instrumentContainer);
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
