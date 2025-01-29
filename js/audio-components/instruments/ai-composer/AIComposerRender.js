import { AbstractHTMLRender } from "../../abstract/AbstractHTMLRender.js";

export class AIComposerRender extends AbstractHTMLRender {
    constructor(instanceId, composerInstance) {
        super();
        this.instanceId = instanceId;
        this.composer = composerInstance;
        this.container.classList.add('ai-composer');
        this.createInterface();
    }

    createInterface() {
        this.container.innerHTML = `
            <div class="ai-composer-panel">
                <div class="controls-section">
                    <div class="control-group">
                        <label>Waveform</label>
                        <select class="waveform-select">
                            <option value="sawtooth">Saw</option>
                            <option value="square">Square</option>
                            <option value="triangle">Triangle</option>
                            <option value="sine">Sine</option>
                        </select>
                    </div>
                    <div class="control-group">
                        <label>Scale</label>
                        <select class="scale-select">
                            <option value="minor">Minor</option>
                            <option value="major">Major</option>
                            <option value="pentatonic">Pentatonic</option>
                        </select>
                    </div>
                    <div class="control-group">
                        <label>Root</label>
                        <select class="root-select">
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
                    </div>
                    <div class="control-group">
                        <label>Complexity</label>
                        <input type="range" class="complexity-slider" min="0" max="1" step="0.01" value="0.5">
                    </div>
                    <div class="control-group">
                        <label>Variation</label>
                        <input type="range" class="variation-slider" min="0" max="1" step="0.01" value="0.3">
                    </div>
                    <div class="action-buttons">
                        <button class="generate-btn">Generate</button>
                        <button class="play-btn">Play</button>
                    </div>
                </div>
            </div>
            <div class="sequence-grid"></div>
        `;

        this.createSequenceGrid();
        this.setupEventListeners();
    }

    createSequenceGrid() {
        const grid = this.container.querySelector('.sequence-grid');
        for (let i = 0; i < 16; i++) {
            const step = document.createElement('div');
            step.className = 'step';
            step.innerHTML = '<span class="note-display">-</span>';
            grid.appendChild(step);
        }
    }

    setupEventListeners() {
        // Setup all control listeners
        this.container.querySelector('.waveform-select').addEventListener('change', e => {
            this.composer.updateParameter('waveform', e.target.value);
        });

        this.container.querySelector('.generate-btn').addEventListener('click', () => {
            this.composer.generatePattern();
        });

        this.container.querySelector('.play-btn').addEventListener('click', () => {
            if (this.composer.isPlaying) {
                this.composer.stop();
                e.target.textContent = 'Play';
            } else {
                this.composer.start();
                e.target.textContent = 'Stop';
            }
        });
    }

    updatePattern(pattern) {
        // Usa requestAnimationFrame per evitare aggiornamenti troppo frequenti
        if (this.updateRequest) {
            cancelAnimationFrame(this.updateRequest);
        }

        this.updateRequest = requestAnimationFrame(() => {
            const steps = this.container.querySelectorAll('.step');
            pattern.forEach((step, i) => {
                const el = steps[i];
                const noteDisplay = el.querySelector('.note-display');
                
                // Aggiorna solo se necessario
                if (el.classList.contains('active') !== step.active) {
                    el.classList.toggle('active', step.active);
                }
                
                const noteText = step.note ? this.formatNote(step.note) : '-';
                if (noteDisplay.textContent !== noteText) {
                    noteDisplay.textContent = noteText;
                }
            });
            this.updateRequest = null;
        });
    }

    highlightStep(step) {
        // Usa requestAnimationFrame per l'evidenziazione del passo corrente
        if (this.highlightRequest) {
            cancelAnimationFrame(this.highlightRequest);
        }

        this.highlightRequest = requestAnimationFrame(() => {
            const steps = this.container.querySelectorAll('.step');
            const currentStep = steps[this.currentHighlightedStep];
            if (currentStep) {
                currentStep.classList.remove('current');
            }
            
            steps[step]?.classList.add('current');
            this.currentHighlightedStep = step;
            this.highlightRequest = null;
        });
    }

    formatNote(midiNote) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midiNote / 12) - 1;
        const note = notes[midiNote % 12];
        return `${note}${octave}`;
    }
}
