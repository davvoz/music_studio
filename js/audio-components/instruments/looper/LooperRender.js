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
    }

    createInterface() {
        this.container.innerHTML = `
            <div class="looper-clip">
                <div class="clip-header">
                    <div class="clip-title">No clip loaded</div>
                    <div class="transport-controls">
                        <button class="load-btn">Load</button>
                        <button class="play-btn">Play</button>
                        <select class="divisions-select">
                            <option value="32">32 Slices</option>
                            <option value="16">16 Slices</option>
                            <option value="8">8 Slices</option>
                            <option value="4">4 Slices</option>
                            <option value="2">2 Slices</option>
                            <option value="1">1 Slice</option>
                        </select>
                        <select class="slice-length-select">
                            <option value="1">1 Beat</option>
                            <option value="2">2 Beats</option>
                            <option value="4" selected>4 Beats</option>
                            <option value="8">8 Beats</option>
                            <option value="16">16 Beats</option>
                        </select>
                        <input type="range" class="pitch-control" 
                               min="0.5" max="2" step="0.01" value="1"
                               title="Pitch">
                        <span class="pitch-value">1.00x</span>
                    </div>
                </div>
                <div class="waveform-view">
                    <canvas></canvas>
                    <div class="grid"></div>
                    <div class="playhead"></div>
                    <div class="slice-markers"></div>
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
    }

    setupCanvas() {
        const resizeCanvas = () => {
            const container = this.canvas.parentElement;
            const rect = container.getBoundingClientRect();
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
            
            if (this.looper.waveformData) {
                this.drawWaveform();
            }
        };

        resizeCanvas();
        new ResizeObserver(resizeCanvas).observe(this.canvas.parentElement);
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

        // Draw waveform
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#FF9500';
        this.ctx.lineWidth = 2;

        const data = this.looper.waveformData;
        const step = width / data.length;
        const middle = height / 2;

        // Disegna parte superiore
        data.forEach((value, i) => {
            const x = i * step;
            const y = middle - (value * height/2);
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        });

        // Disegna parte inferiore (specchio)
        for (let i = data.length - 1; i >= 0; i--) {
            const x = i * step;
            const y = middle + (data[i] * height/2);
            this.ctx.lineTo(x, y);
        }

        this.ctx.closePath();
        this.ctx.fillStyle = 'rgba(255, 149, 0, 0.2)';
        this.ctx.fill();
        this.ctx.stroke();

        // Highlight current slice
        if (this.looper.isPlaying && this.looper.currentSlice !== null) {
            const sliceWidth = width / this.looper.divisions;
            const sliceX = this.looper.currentSlice * sliceWidth;
            
            // Aggiungi un'ombreggiatura per lo slice attivo
            this.ctx.fillStyle = 'rgba(255, 149, 0, 0.3)';
            this.ctx.fillRect(sliceX, 0, sliceWidth, height);
            
            // Aggiungi bordi luminosi allo slice attivo
            this.ctx.strokeStyle = '#FF9500';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(sliceX, 0, sliceWidth, height);
            
            // Aggiungi un indicatore numerico dello slice
            this.ctx.fillStyle = '#FF9500';
            this.ctx.font = '12px Share Tech Mono';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
                `${this.looper.currentSlice + 1}/${this.looper.divisions}`,
                sliceX + sliceWidth/2,
                20
            );
        }
    }

    drawGrid(divisions) {
        const { width, height } = this.canvas;
        
        // Draw vertical grid lines
        for (let i = 0; i <= divisions; i++) {
            const x = (i / divisions) * width;
            this.ctx.beginPath();
            this.ctx.strokeStyle = 'rgba(255, 149, 0, 0.2)';
            this.ctx.lineWidth = i % 4 === 0 ? 2 : 1; // Linee più spesse ogni 4 divisioni
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
        const playhead = this.container.querySelector('.playhead');
        if (playhead && this.looper.originalDuration) {
            const percent = (position / this.looper.originalDuration) * 100;
            playhead.style.left = `${percent}%`;
        }

        requestAnimationFrame(() => {
            this.drawWaveform(); // Ridisegna tutto per mostrare la posizione corrente
        });
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
}
