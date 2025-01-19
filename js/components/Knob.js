export class Knob {
    constructor(element, options = {}) {
        this.element = element;
        this.options = {
            min: options.min || 0,
            max: options.max || 1,
            value: options.value || 0.5,
            step: options.step || 0.01,
            size: options.size || 40,
            onChange: options.onChange || (() => {})
        };

        this.value = this.options.value;
        this.isDragging = false;
        this.lastY = 0;
        this.setup();
    }

    setup() {
        this.element.style.width = `${this.options.size}px`;
        this.element.style.height = `${this.options.size}px`;
        
        this.element.innerHTML = `
            <div class="knob-body">
                <div class="knob-indicator"></div>
            </div>
            <div class="knob-value">${this.formatValue(this.value)}</div>
        `;

        this.addEventListeners();
        this.updateRotation();
    }

    addEventListeners() {
        const moveHandler = (e) => {
            if (!this.isDragging) return;
            e.preventDefault();
            
            const y = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
            const delta = (this.lastY - y) * 0.5;
            this.lastY = y;

            const range = this.options.max - this.options.min;
            const deltaValue = (delta / 100) * range;
            this.setValue(this.value + deltaValue);
        };

        const startHandler = (e) => {
            this.isDragging = true;
            this.lastY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
            this.element.classList.add('active');
        };

        const endHandler = () => {
            this.isDragging = false;
            this.element.classList.remove('active');
        };

        // Mouse & Touch events
        this.element.addEventListener('mousedown', startHandler);
        this.element.addEventListener('touchstart', startHandler, { passive: false });
        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('touchmove', moveHandler, { passive: false });
        document.addEventListener('mouseup', endHandler);
        document.addEventListener('touchend', endHandler);
    }

    setValue(newValue) {
        const value = Math.min(this.options.max, 
                     Math.max(this.options.min, newValue));
        const stepped = Math.round(value / this.options.step) * this.options.step;
        
        if (stepped !== this.value) {
            this.value = stepped;
            this.updateRotation();
            this.updateDisplay();
            this.options.onChange(this.value);
        }
    }

    updateRotation() {
        const percent = (this.value - this.options.min) / 
                       (this.options.max - this.options.min);
        const degrees = -150 + (percent * 300); // standard -150 to +150 range
        this.element.querySelector('.knob-indicator')
            .style.transform = `rotate(${degrees}deg)`;
    }

    updateDisplay() {
        this.element.querySelector('.knob-value')
            .textContent = this.formatValue(this.value);
    }

    formatValue(value) {
        return Number(value.toFixed(2));
    }
}
