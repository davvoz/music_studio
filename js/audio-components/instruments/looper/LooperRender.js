import { AbstractHTMLRender } from "../../abstract/AbstractHTMLRender.js";

export class LooperRender extends AbstractHTMLRender {
    constructor(instanceId, looperInstance) {
        super();
        this.instanceId = instanceId;
        this.looper = looperInstance;
        this.paramChangeCallback = null;
        this.canvas = null;
        this.ctx = null;
        this.container.classList.add('looper-clip');
        this.createInterface();
        this.isDragging = false;
        this.activeMarker = null;
    }

    createInterface() {
        this.container.innerHTML = `
            <div class="looper-clip">
                <div class="clip-header">
                    <div class="clip-info">
                        <div class="sound-selector">
                            <select class="sound-select" title="Select sound">
                                <option value="">No sounds loaded</option>
                            </select>
                            <button class="add-sound-btn" title="Add new sound">+</button>
                            <button class="remove-sound-btn" title="Remove sound">-</button>
                        </div>
                        <div class="clip-title">No clip loaded</div>
                        <div class="clip-status"></div>
                    </div>
                    <div class="transport-controls">
                        <button class="load-btn" title="Load audio file">Load</button>
                        <button class="play-btn" title="Play/Stop (Spacebar)">Play</button>
                        <div class="division-control">
                            <label>Slices:</label>
                            <select class="divisions-select" title="Number of slices">
                                <option value="32">32</option>
                                <option value="16">16</option>
                                <option value="8">8</option>
                                <option value="4">4</option>
                                <option value="2">2</option>
                                <option value="1">1</option>
                            </select>
                        </div>
                        <div class="length-control">
                            <label>Length:</label>
                            <select class="slice-length-select" title="Slice length in beats">
                                <option value="1">1 Beat</option>
                                <option value="2">2 Beats</option>
                                <option value="4" selected>4 Beats</option>
                                <option value="8">8 Beats</option>
                                <option value="16">16 Beats</option>
                            </select>
                        </div>
                        <div class="pitch-control-wrapper">
                            <label>Pitch:</label>
                            <input type="range" class="pitch-control" 
                                   min="0.25" max="4" step="0.01" value="1"
                                   title="Pitch control (Shift + Mouse Wheel)">
                            <span class="pitch-value">1.00x</span>
                        </div>
                        <div class="start-step-control">
                            <label>Start Step:</label>
                            <select class="start-step-select" title="Starting step">
                                <option value="0">0</option>
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="waveform-view">
                    <div class="loading-overlay">Loading...</div>
                    <canvas></canvas>
                    <div class="slice-preview"></div>
                    <div class="grid"></div>
                    <div class="slice-markers"></div>
                </div>
                <div class="keyboard-shortcuts">
                    <button class="show-shortcuts" title="Show keyboard shortcuts">⌨️</button>
                </div>
            </div>
        `;

        this.canvas = this.container.querySelector('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.setupCanvas();
        this.setupEventListeners();

        // Aggiungi gestione delle divisioni
        const divisionsSelect = this.container.querySelector('.divisions-select');
        divisionsSelect.addEventListener('change', (e) => {
            const divisions = parseInt(e.target.value);
            this.looper.setDivisions(divisions);
            this.updateGrid(divisions);
            this.drawWaveform();
        });

        // Aggiungi gestione della lunghezza della slice
        const sliceLengthSelect = this.container.querySelector('.slice-length-select');
        sliceLengthSelect.addEventListener('change', (e) => {
            const length = parseInt(e.target.value);
            this.looper.setSliceLength(length);
        });

        // Aggiungi gestione del pitch
        const pitchControl = this.container.querySelector('.pitch-control');
        const pitchValue = this.container.querySelector('.pitch-value');
        
        pitchControl.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            pitchValue.textContent = `${value.toFixed(2)}x`;
            this.looper.setPitch(value);
        });

        // Aggiungi gestione dei suoni
        const soundSelect = this.container.querySelector('.sound-select');
        soundSelect.addEventListener('change', (e) => {
            const soundName = e.target.value;
            if (soundName) {
                this.looper.loadSound(soundName);
            }
        });

        const addSoundBtn = this.container.querySelector('.add-sound-btn');
        addSoundBtn.addEventListener('click', () => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'audio/*';
            fileInput.style.display = 'none';
            this.container.appendChild(fileInput);
            
            fileInput.onchange = async (e) => {
                if (e.target.files[0]) {
                    const file = e.target.files[0];
                    const name = file.name.replace(/\.[^/.]+$/, "");
                    await this.looper.addSound(name, file);
                }
                fileInput.remove();
            };
            
            fileInput.click();
        });

        const removeSoundBtn = this.container.querySelector('.remove-sound-btn');
        removeSoundBtn.addEventListener('click', () => {
            const soundName = this.container.querySelector('.sound-select').value;
            if (soundName && confirm(`Remove sound "${soundName}"?`)) {
                this.looper.removeSound(soundName);
                this.updateSoundsList(Array.from(this.looper.sounds.keys()));
            }
        });

        // Salva la configurazione quando i controlli vengono modificati
        const saveConfig = () => this.looper.saveCurrentConfig();
        this.container.querySelector('.divisions-select').addEventListener('change', saveConfig);
        this.container.querySelector('.slice-length-select').addEventListener('change', saveConfig);
        this.container.querySelector('.pitch-control').addEventListener('input', saveConfig);
        this.container.querySelector('.start-step-select').addEventListener('change', saveConfig);

        this.setupKeyboardShortcuts();
        this.setupSlicePreview();
    }

    setupCanvas() {
        const resizeCanvas = () => {
            const container = this.canvas.parentElement;
            const rect = container.getBoundingClientRect();
            
            // Verifica se le dimensioni sono effettivamente cambiate
            if (this.canvas.width !== rect.width || this.canvas.height !== rect.height) {
                this.canvas.width = rect.width;
                this.canvas.height = rect.height;
                this.canvas.style.width = '100%';
                this.canvas.style.height = '100%';
                
                // Pulisci il canvas prima di ridisegnare
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                
                if (this.looper.waveformData) {
                    this.drawWaveform();
                }
            }
        };

        // Chiama resizeCanvas immediatamente
        resizeCanvas();

        // Usa ResizeObserver per monitorare i cambiamenti di dimensione
        const resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(resizeCanvas);
        });
        resizeObserver.observe(this.canvas.parentElement);

        // Aggiungi anche un listener per il resize della finestra
        window.addEventListener('resize', () => {
            requestAnimationFrame(resizeCanvas);
        });
    }

    drawWaveform() {
        if (!this.canvas || !this.ctx || !this.looper.waveformData) return;

        const { width, height } = this.canvas;
        this.ctx.clearRect(0, 0, width, height);

        // Background
        this.ctx.fillStyle = '#1E2328';
        this.ctx.fillRect(0, 0, width, height);

        // Draw grid first
        this.drawGrid(this.looper.divisions);

        const data = this.looper.waveformData;
        const sliceWidth = width / this.looper.divisions;

        // Disegna ogni slice separatamente
        for (let i = 0; i < this.looper.divisions; i++) {
            const isMuted = this.looper.sliceSettings[i]?.muted;
            const isReversed = this.looper.sliceSettings[i]?.reversed;
            const startX = i * sliceWidth;
            const samplesPerSlice = Math.floor(data.length / this.looper.divisions);
            const sliceStart = i * samplesPerSlice;
            
            this.ctx.beginPath();
            this.ctx.strokeStyle = isMuted ? 'rgba(255, 149, 0, 0.3)' : '#FF9500';
            this.ctx.lineWidth = 2;

            const middle = height / 2;
            const step = sliceWidth / samplesPerSlice;

            // Raccogli i punti per questa slice
            let points = [];
            for (let j = 0; j < samplesPerSlice; j++) {
                const value = data[sliceStart + j];
                points.push({
                    x: startX + (j * step),
                    y: middle - (value * height/2),
                    mirror: middle + (value * height/2)
                });
            }

            // Se la slice è invertita, inverti i punti
            if (isReversed) {
                points.reverse();
                // Aggiusta le coordinate x dopo l'inversione
                points.forEach((point, j) => {
                    point.x = startX + (j * step);
                });
            }

            // Disegna la forma d'onda
            this.ctx.moveTo(points[0].x, points[0].y);
            // Disegna la parte superiore
            points.forEach(point => {
                this.ctx.lineTo(point.x, point.y);
            });
            // Disegna la parte inferiore (specchio)
            for (let j = points.length - 1; j >= 0; j--) {
                this.ctx.lineTo(points[j].x, points[j].mirror);
            }

            this.ctx.closePath();
            this.ctx.fillStyle = isMuted ? 'rgba(255, 149, 0, 0.1)' : 'rgba(255, 149, 0, 0.2)';
            this.ctx.fill();
            this.ctx.stroke();
        }

        // Highlight current slice
        if (this.looper.isPlaying && this.looper.currentSlice !== null) {
            const sliceX = this.looper.currentSlice * sliceWidth;
            this.ctx.fillStyle = 'rgba(255, 149, 0, 0.3)';
            this.ctx.fillRect(sliceX, 0, sliceWidth, height);
        }
    }

    drawGrid(divisions) {
        const { width, height } = this.canvas;
        
        // Calcola la regione di loop
        const loopStartX = width * this.looper.loopStart;
        const loopEndX = width * this.looper.loopEnd;
        const loopWidth = loopEndX - loopStartX;
        
        // Draw vertical grid lines within loop region
        for (let i = 0; i <= divisions; i++) {
            const x = loopStartX + (i / divisions) * loopWidth;
            this.ctx.beginPath();
            this.ctx.strokeStyle = 'rgba(255, 149, 0, 0.2)';
            this.ctx.lineWidth = i % 4 === 0 ? 2 : 1;
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }
    }

    drawBeatGrid() {
        const { width, height } = this.canvas;
        const beatsPerBar = 4;
        const totalBars = 4; // Default 4 bars display
        const pixelsPerBeat = width / (totalBars * beatsPerBar);

        // Draw vertical beat lines
        for (let i = 0; i <= totalBars * beatsPerBar; i++) {
            const x = i * pixelsPerBeat;
            this.ctx.beginPath();
            this.ctx.strokeStyle = i % beatsPerBar === 0 ? 
                'rgba(255, 149, 0, 0.5)' : 'rgba(255, 149, 0, 0.2)';
            this.ctx.lineWidth = i % beatsPerBar === 0 ? 2 : 1;
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }

        // Draw current beat marker
        const currentBeat = this.looper.globalPlaybackEnabled ? 
            Math.floor(this.looper.getCurrentPosition() / (60 / this.looper.tempo)) % (totalBars * beatsPerBar) :
            0;
        
        const beatX = currentBeat * pixelsPerBeat;
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#00FF00';
        this.ctx.lineWidth = 2;
        this.ctx.moveTo(beatX, 0);
        this.ctx.lineTo(beatX, height);
        this.ctx.stroke();
    }

    setupEventListeners() {
        const loadBtn = this.container.querySelector('.load-btn');
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'audio/*';
        fileInput.style.display = 'none';
        this.container.appendChild(fileInput);

        loadBtn.onclick = () => fileInput.click();
        fileInput.onchange = async (e) => {
            if (e.target.files[0]) {
                loadBtn.disabled = true;
                loadBtn.textContent = 'Loading...';
                await this.looper.loadFile(e.target.files[0]);
                loadBtn.disabled = false;
                loadBtn.textContent = 'Load';
            }
        };

        const playBtn = this.container.querySelector('.play-btn');
        playBtn.onclick = () => {
            if (this.looper.isPlaying) {
                this.looper.stop();
                playBtn.textContent = 'Play';
                playBtn.classList.remove('active');
            } else {
                this.looper.play();
                playBtn.textContent = 'Stop';
                playBtn.classList.add('active');
            }
        };

        const loopBtn = this.container.querySelector('.loop-btn');

        if (loopBtn) {
            loopBtn.onclick = () => {
                const isLooping = !this.looper.parameters.isLooping;
                loopBtn.classList.toggle('active', isLooping);
                this.paramChangeCallback?.('isLooping', isLooping);
            };
        }

        const startStepSelect = this.container.querySelector('.start-step-select');
        startStepSelect.addEventListener('change', (e) => {
            this.looper.setStartingStep(e.target.value);
        });
    }

    updateGrid(divisions) {
        const grid = this.container.querySelector('.grid');
        const sliceMarkers = this.container.querySelector('.slice-markers');
        
        grid.innerHTML = '';
        sliceMarkers.innerHTML = '';
        
        // Crea le linee della griglia per ogni divisione
        for (let i = 0; i <= divisions; i++) {
            const line = document.createElement('div');
            line.className = 'grid-line';
            line.style.left = `${(i / divisions) * 100}%`;
            grid.appendChild(line);
            
            if (i < divisions) {
                const marker = document.createElement('div');
                marker.className = 'slice-marker';
                marker.style.left = `${(i / divisions) * 100}%`;
                marker.style.width = `${100 / divisions}%`;
                sliceMarkers.appendChild(marker);
            }
        }
    }

    updateDisplay(filename, duration, waveformData) {
        // Aggiorna il titolo della clip
        const clipTitle = this.container.querySelector('.clip-title');
        if (clipTitle) {
            clipTitle.textContent = filename || 'No clip loaded';
        }

        // Aggiorna il tempo se esiste l'elemento
        const clipTime = this.container.querySelector('.clip-time');
        if (clipTime) {
            clipTime.textContent = this.formatTime(duration);
        }
        
        if (waveformData) {
            // Forza il ridimensionamento del canvas prima di disegnare
            const container = this.canvas.parentElement;
            const rect = container.getBoundingClientRect();
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
            
            // Pulisci completamente il canvas
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Ora disegna la nuova forma d'onda
            this.drawWaveform();
        }
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    setParameterChangeCallback(callback) {
        this.paramChangeCallback = callback;
    }

    updatePlayhead(position) {
        // Usa solo il drawWaveform per l'aggiornamento visuale
        requestAnimationFrame(() => this.drawWaveform());
    }

    updateCurrentSlice(sliceIndex) {
        if (this.looper.isPlaying) {
            requestAnimationFrame(() => this.drawWaveform());
            
            // Aggiorna anche i marker delle slice nel DOM
            const markers = this.container.querySelectorAll('.slice-marker');
            markers.forEach((marker, i) => {
                marker.classList.toggle('active', i === sliceIndex);
            });
        }
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;
            
            if (e.code === 'Space') {
                e.preventDefault();
                this.container.querySelector('.play-btn').click();
            }
        });
        
        // Pitch control with Shift + Mouse Wheel
        this.container.querySelector('.waveform-view').addEventListener('wheel', (e) => {
            if (e.shiftKey) {
                e.preventDefault();
                const pitchControl = this.container.querySelector('.pitch-control');
                const step = e.deltaY > 0 ? -0.01 : 0.01;
                pitchControl.value = parseFloat(pitchControl.value) + step;
                pitchControl.dispatchEvent(new Event('input'));
            }
        });
    }

    setupSlicePreview() {
        const slicePreview = this.container.querySelector('.slice-preview');
        const waveformView = this.container.querySelector('.waveform-view');
        const sliceMarkers = this.container.querySelector('.slice-markers');
        
        // Aggiorna i marker delle slice per includere i controlli
        const updateSliceMarkers = () => {
            sliceMarkers.innerHTML = '';
            for (let i = 0; i < this.looper.divisions; i++) {
                const marker = document.createElement('div');
                marker.className = 'slice-marker';
                marker.style.left = `${(i / this.looper.divisions) * 100}%`;
                marker.style.width = `${100 / this.looper.divisions}%`;
                
                if (this.looper.sliceSettings[i]?.muted) {
                    marker.classList.add('muted');
                }
                if (this.looper.sliceSettings[i]?.reversed) {
                    marker.classList.add('reversed');
                }
                
                const controls = document.createElement('div');
                controls.className = 'slice-controls';
                controls.innerHTML = `
                    <button class="copy-btn" title="Copy Slice">C</button>
                    <button class="mute-btn ${this.looper.sliceSettings[i]?.muted ? 'active' : ''}" title="Mute Slice">M</button>
                    <button class="reverse-btn ${this.looper.sliceSettings[i]?.reversed ? 'active' : ''}" title="Reverse Slice">R</button>
                    <button class="paste-btn" title="Paste Slice">P</button>
                `;
                
                const muteBtn = controls.querySelector('.mute-btn');
                const copyBtn = controls.querySelector('.copy-btn');
                const reverseBtn = controls.querySelector('.reverse-btn');
                const pasteBtn = controls.querySelector('.paste-btn');
                
                muteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.looper.toggleSliceMute(i);
                    muteBtn.classList.toggle('active');
                    marker.classList.toggle('muted');
                });
                
                reverseBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.looper.toggleSliceReverse(i);
                    reverseBtn.classList.toggle('active');
                    marker.classList.toggle('reversed');
                });
                
                copyBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.looper.copySlice(i);
                    copyBtn.classList.add('active');
                    setTimeout(() => copyBtn.classList.remove('active'), 200);
                });
                
                pasteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.looper.pasteSlice(i);
                    pasteBtn.classList.add('active');
                    setTimeout(() => pasteBtn.classList.remove('active'), 200);
                });
                
                marker.appendChild(controls);
                sliceMarkers.appendChild(marker);
            }
        };

        // Aggiorna i marker quando cambiano le divisioni
        this.container.querySelector('.divisions-select').addEventListener('change', () => {
            requestAnimationFrame(updateSliceMarkers);
        });
        
        // Inizializza i marker
        updateSliceMarkers();
        
        waveformView.addEventListener('mousemove', (e) => {
            if (!this.looper.buffer) return;
            
            const rect = waveformView.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const sliceIndex = Math.floor((x / rect.width) * this.looper.divisions);
            
            if (sliceIndex >= 0 && sliceIndex < this.looper.divisions) {
                slicePreview.style.display = 'block';
                slicePreview.style.left = `${(sliceIndex / this.looper.divisions) * 100}%`;
                slicePreview.style.width = `${100 / this.looper.divisions}%`;
                slicePreview.textContent = `Slice ${sliceIndex + 1}`;
            }
        });
        
        waveformView.addEventListener('mouseleave', () => {
            slicePreview.style.display = 'none';
        });
        
        waveformView.addEventListener('click', (e) => {
            if (!this.looper.buffer) return;
            
            const rect = waveformView.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const sliceIndex = Math.floor((x / rect.width) * this.looper.divisions);
            
            if (sliceIndex >= 0 && sliceIndex < this.looper.divisions) {
                this.looper.playSlice(sliceIndex);
            }
        });
    }

    showLoading() {
        const loadingOverlay = this.container.querySelector('.loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.add('active');
        }
    }

    hideLoading() {
        const loadingOverlay = this.container.querySelector('.loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.remove('active');
        }
    }

    showError(message) {
        const statusElement = this.container.querySelector('.clip-status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.classList.add('error');
            // Auto-hide the error after 5 seconds
            setTimeout(() => {
                statusElement.textContent = '';
                statusElement.classList.remove('error');
            }, 5000);
        }
    }

    updateSoundsList(soundNames) {
        const select = this.container.querySelector('.sound-select');
        select.innerHTML = soundNames.length ? 
            soundNames.map(name => `<option value="${name}">${name}</option>`).join('') :
            '<option value="">No sounds loaded</option>';
        select.value = this.looper.currentSoundName || '';
    }

    updateControls(config) {
        this.container.querySelector('.divisions-select').value = config.divisions;
        this.container.querySelector('.slice-length-select').value = config.sliceLength;
        this.container.querySelector('.pitch-control').value = config.pitch;
        this.container.querySelector('.start-step-select').value = config.startingStep;
        this.container.querySelector('.pitch-value').textContent = `${config.pitch.toFixed(2)}x`;
    }

    updatePlayButton(isPlaying) {
        const playBtn = this.container.querySelector('.play-btn');
        if (playBtn) {
            playBtn.textContent = isPlaying ? 'Stop' : 'Play';
            playBtn.classList.toggle('active', isPlaying);
        }
    }
}
