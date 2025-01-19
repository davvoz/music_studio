export class VUMeter {
    constructor(context) {
        // Initialize configuration first
        this.config = {
            fps: 30,
            dbMin: -48,
            dbMax: 3,
            peakHoldTime: 1000,
            volume: 1.0,
            width: {
                scale: 20,
                meter: 30
            },
            height: 150
        };

        this.state = {
            running: false,
            peakHold: -Infinity,
            peakHoldTimer: null
        };

        // Create canvases first
        this.createCanvases();
        
        // Then setup everything else
        this.setupAudioNodes(context);
        this.setupVisualElements();
        this.setupWorker();
    }

    createCanvases() {
        // Main container
        this.container = document.createElement('div');
        this.container.className = 'vu-meter-container';

        // Scale canvas
        this.scaleCanvas = document.createElement('canvas');
        this.scaleCanvas.width = this.config.width.scale;
        this.scaleCanvas.height = this.config.height;
        this.scaleCanvas.className = 'vu-meter-scale';

        // Meter canvas
        this.meterCanvas = document.createElement('canvas');
        this.meterCanvas.width = this.config.width.meter;
        this.meterCanvas.height = this.config.height;
        this.meterCanvas.className = 'vu-meter';
        this.meterCtx = this.meterCanvas.getContext('2d');

        this.container.append(this.scaleCanvas, this.meterCanvas);
    }

    setupAudioNodes(context) {
        this.analyzer = context.createAnalyser();
        this.analyzer.fftSize = 2048;
        this.analyzer.smoothingTimeConstant = 0.5;
        this.inputGain = context.createGain();
        this.inputGain.connect(this.analyzer);
        this.dataArray = new Float32Array(this.analyzer.frequencyBinCount);
    }

    setupVisualElements() {
        this.drawScale();
    }

    setupWorker() {
        this.worker = new Worker('./js/workers/VUMeterWorker.js');
        this.worker.onmessage = (e) => {
            this.updateMeter(e.data.rms, e.data.peak);
        };
    }

    drawScale() {
        const ctx = this.scaleCanvas.getContext('2d');
        const width = this.scaleCanvas.width;
        const height = this.scaleCanvas.height;

        // Background
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(0, 0, width, height);

        // Draw dB scale
        ctx.fillStyle = '#ecf0f1';
        ctx.font = '8px monospace';
        ctx.textAlign = 'right';

        for (let db = this.config.dbMax; db >= this.config.dbMin; db -= 6) {
            const y = this.dbToY(db);
            // Scale line
            ctx.fillRect(width - 8, y, 5, 1);
            // dB value
            ctx.fillText(db.toString(), width - 10, y + 3);
        }

        // Draw color zones
        const zoneHeight = 2;
        for (let y = 0; y < height; y += zoneHeight) {
            const db = this.yToDb(y);
            ctx.fillStyle = this.getDbColor(db);
            ctx.fillRect(0, y, 3, zoneHeight);
        }
    }

    updateMeter(rmsDb, peakDb) {
        // Update peak hold
        if (peakDb > this.state.peakHold) {
            this.state.peakHold = peakDb;
            clearTimeout(this.state.peakHoldTimer);
            this.state.peakHoldTimer = setTimeout(() => {
                this.state.peakHold = -Infinity;
            }, this.config.peakHoldTime);
        }

        const ctx = this.meterCtx;
        const width = this.meterCanvas.width;
        const height = this.meterCanvas.height;

        // Clear
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(0, 0, width, height);

        // Draw RMS meter
        const rmsY = this.dbToY(rmsDb);
        const gradient = ctx.createLinearGradient(0, height, 0, rmsY);
        gradient.addColorStop(0, this.getDbColor(this.config.dbMin));
        gradient.addColorStop(1, this.getDbColor(rmsDb));
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, rmsY, width * 0.8, height - rmsY);

        // Draw peak indicator
        const peakY = this.dbToY(peakDb);
        ctx.fillStyle = '#ecf0f1';
        ctx.fillRect(0, peakY, width, 2);

        // Draw peak hold
        const holdY = this.dbToY(this.state.peakHold);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(0, holdY, width, 1);
    }

    dbToY(db) {
        const range = this.config.dbMax - this.config.dbMin;
        const normalized = (db - this.config.dbMin) / range;
        return this.config.height * (1 - normalized);
    }

    yToDb(y) {
        const range = this.config.dbMax - this.config.dbMin;
        const normalized = 1 - (y / this.meterCanvas.height);
        return this.config.dbMin + (range * normalized);
    }

    getDbColor(db) {
        if (db >= 0) return '#e74c3c';      // Red
        if (db >= -6) return '#e67e22';     // Orange
        if (db >= -12) return '#f1c40f';    // Yellow
        return '#2ecc71';                    // Green
    }

    connect(source) {
        source.connect(this.inputGain);
    }

    disconnect() {
        this.inputGain.disconnect();
    }

    start() {
        if (!this.state.running) {
            this.state.running = true;
            this.update();
        }
    }

    stop() {
        this.state.running = false;
    }

    update() {
        if (!this.state.running) return;

        this.analyzer.getFloatTimeDomainData(this.dataArray);
        this.worker.postMessage({
            data: Array.from(this.dataArray),
            sampleRate: this.analyzer.context.sampleRate,
            volume: this.config.volume
        });

        setTimeout(() => this.update(), 1000 / this.config.fps);
    }

    setVolume(value) {
        this.config.volume = Math.max(0, Math.min(1, value));
        this.inputGain.gain.value = this.config.volume;
    }

    getElement() {
        return this.container;
    }
}
