export class PatternGrid {
    constructor(steps = 16, instrumentId) {
        this.steps = steps;
        this.instrumentId = instrumentId;
        this.patterns = new Map();
        this.currentPatternId = 'pattern1';
        this.onPatternChange = null; // Callback for pattern changes
        
        // Create default pattern
        this.addPattern('pattern1', 'Pattern 1');
        
        this.currentStep = -1;
        this.element = this.createGrid();
    }

    addPattern(id, name) {
        this.patterns.set(id, {
            name: name,
            config: null,  // Configurazione strumento
            sequence: Array(this.steps).fill(false)
        });
    }

    createGrid() {
        const container = document.createElement('div');
        container.className = 'pattern-grid';

        // Pattern selector
        const selectorDiv = document.createElement('div');
        selectorDiv.className = 'pattern-selector';
        
        const select = document.createElement('select');
        select.className = 'pattern-select';
        this.updatePatternSelector(select);
        
        select.addEventListener('change', (e) => {
            this.switchPattern(e.target.value);
        });

        const addButton = document.createElement('button');
        addButton.textContent = '+';
        addButton.className = 'add-pattern-btn';
        addButton.addEventListener('click', () => this.createNewPattern());

        selectorDiv.appendChild(select);
        selectorDiv.appendChild(addButton);

        // Aggiungi pulsante per salvare la configurazione
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save Config';
        saveButton.className = 'save-pattern-btn';
        saveButton.addEventListener('click', () => this.saveCurrentConfig());
        selectorDiv.appendChild(saveButton);

        container.appendChild(selectorDiv);

        // Add beat numbers
        const numberRow = document.createElement('div');
        numberRow.className = 'pattern-numbers';
        
        for (let step = 0; step < this.steps; step++) {
            const numberCell = document.createElement('div');
            numberCell.className = 'beat-number';
            numberCell.textContent = (step + 1).toString();
            if (step % 4 === 0) numberCell.classList.add('bar-start');
            numberRow.appendChild(numberCell);
        }
        container.appendChild(numberRow);

        // Create pattern row
        const rowDiv = document.createElement('div');
        rowDiv.className = 'pattern-row';

        for (let step = 0; step < this.steps; step++) {
            const cell = document.createElement('div');
            cell.className = 'pattern-cell';
            if (step % 4 === 0) cell.classList.add('bar-start');
            cell.dataset.row = 0;
            cell.dataset.step = step;

            cell.addEventListener('click', () => this.toggleStep(0, step));
            rowDiv.appendChild(cell);
        }
        container.appendChild(rowDiv);

        return container;
    }

    createNewPattern() {
        const patternId = `pattern${this.patterns.size + 1}`;
        const patternName = `Pattern ${this.patterns.size + 1}`;
        this.addPattern(patternId, patternName);
        this.updatePatternSelector();
        this.switchPattern(patternId);
    }

    updatePatternSelector(select = this.element.querySelector('.pattern-select')) {
        select.innerHTML = '';
        this.patterns.forEach((pattern, id) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = pattern.name;
            option.selected = id === this.currentPatternId;
            select.appendChild(option);
        });
    }

    switchPattern(patternId) {
        this.currentPatternId = patternId;
        const pattern = this.patterns.get(patternId);
        
        if (pattern && this.onPatternChange) {
            // Notifica lo strumento del cambio pattern
            this.onPatternChange('load', patternId, pattern.config);
        }
        
        this.updateGrid();
    }

    updateGrid() {
        const pattern = this.patterns.get(this.currentPatternId);
        if (!pattern) return;

        const cells = this.element.querySelectorAll('.pattern-cell');
        cells.forEach((cell, index) => {
            cell.classList.toggle('active', pattern.sequence[index]);
        });
    }

    toggleStep(row, step) {
        const pattern = this.patterns.get(this.currentPatternId);
        if (!pattern) return;

        pattern.sequence[step] = !pattern.sequence[step];
        this.updateCell(row, step);
    }

    updateCell(row, step) {
        const cell = this.element.querySelector(
            `[data-row="${row}"][data-step="${step}"]`
        );
        if (cell) {
            const pattern = this.patterns.get(this.currentPatternId);
            cell.classList.toggle('active', pattern.sequence[step]);
        }
    }

    highlightStep(step) {
        // Remove previous highlight
        if (this.currentStep >= 0) {
            const prevCells = this.element.querySelectorAll(
                `[data-step="${this.currentStep}"]`
            );
            prevCells.forEach(cell => cell.classList.remove('current'));
        }

        // Add new highlight
        this.currentStep = step;
        const currentCells = this.element.querySelectorAll(
            `[data-step="${step}"]`
        );
        currentCells.forEach(cell => cell.classList.add('current'));
    }

    getActiveNotesForStep(step) {
        const pattern = this.patterns.get(this.currentPatternId);
        if (!pattern) return [];
        return pattern.sequence[step] ? [0] : [];
    }

    clear() {
        const pattern = this.patterns.get(this.currentPatternId);
        if (pattern) {
            pattern.sequence.fill(false);
            this.updateGrid();
        }
    }

    getElement() {
        return this.element;
    }

    getCurrentPatternId() {
        return this.currentPatternId;
    }

    saveCurrentConfig() {
        const pattern = this.patterns.get(this.currentPatternId);
        if (pattern && this.onPatternChange) {
            // Richiedi la configurazione attuale allo strumento
            this.onPatternChange('save', this.currentPatternId);
        }
    }

    setPatternConfig(patternId, config) {
        const pattern = this.patterns.get(patternId);
        if (pattern) {
            pattern.config = config;
        }
    }

    setPatternChangeCallback(callback) {
        this.onPatternChange = callback;
    }
}
