import { AbstractHTMLRender } from '../../abstract/AbstractHTMLRender.js';

export class VirtualSidechainRender extends AbstractHTMLRender {
    constructor(instanceId, sidechainInstance) {
        super();
        
        if (!instanceId) throw new Error('instanceId is required');
        if (!sidechainInstance) throw new Error('sidechainInstance is required');
        
        this.instanceId = instanceId;
        this.sidechain = sidechainInstance;
        this.container.classList.add('virtual-sidechain');
        this.createInterface();
    }

    createInterface() {
        // Transport controls
        const transport = document.createElement('div');
        transport.className = 'sc-transport';
        
        const syncToggle = document.createElement('button');
        syncToggle.className = 'sc-sync-toggle';
        syncToggle.textContent = 'SYNC';
        syncToggle.addEventListener('click', () => {
            this.sidechain.toggleSync();
            syncToggle.classList.toggle('active', this.sidechain.isSynced);
        });

        const lengthSelect = document.createElement('select');
        lengthSelect.className = 'sc-length';
        [4, 8, 16, 32].forEach(len => {
            const opt = document.createElement('option');
            opt.value = len;
            opt.textContent = `${len} Steps`;
            lengthSelect.appendChild(opt);
        });
        lengthSelect.value = '32';
        lengthSelect.addEventListener('change', (e) => {
            this.sidechain.setLength(parseInt(e.target.value));
        });

        transport.append(syncToggle, lengthSelect);

        // Add transport before sequencer
        this.container.appendChild(transport);

        // Sequencer grid
        const sequencer = document.createElement('div');
        sequencer.className = 'sidechain-sequencer';
        
        // Create 32 steps
        for (let i = 0; i < 32; i++) {
            const step = document.createElement('div');
            step.className = 'sc-step';
            step.dataset.step = i;
            step.addEventListener('click', () => {
                this.sidechain.toggleStep(i);
                step.classList.toggle('active');
            });
            sequencer.appendChild(step);
        }

        // Controls section
        const controls = document.createElement('div');
        controls.className = 'sidechain-controls';

        // Create knobs
        const knobs = {
            attack: { label: 'Attack', defaultValue: 0.05 },  // Più veloce
            release: { label: 'Release', defaultValue: 0.3 }, // Più veloce
            depth: { label: 'Depth', defaultValue: 0.9 },     // Più profondo
            curve: { label: 'Shape', defaultValue: 0.5 }
        };

        Object.entries(knobs).forEach(([param, config]) => {
            const knob = this.createKnob(param, config);
            controls.appendChild(knob);
        });

        // Create curve type selector
        const typeSelect = document.createElement('select');
        typeSelect.className = 'curve-type-select';
        ['Classic', 'Modern', 'Punch'].forEach((type, i) => {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = type;
            typeSelect.appendChild(option);
        });

        typeSelect.addEventListener('change', (e) => {
            this.sidechain.setType(parseInt(e.target.value));
        });

        controls.appendChild(typeSelect);

        // Aggiungi controllo mix dopo gli altri controlli
        const mixContainer = document.createElement('div');
        mixContainer.className = 'sc-knob-container';
        
        const mixLabel = document.createElement('span');
        mixLabel.textContent = 'Mix';
        
        const mixInput = document.createElement('input');
        mixInput.type = 'range';
        mixInput.min = 0;
        mixInput.max = 1;
        mixInput.step = 0.01;
        mixInput.value = 0.5; // Valore iniziale 50/50
        mixInput.className = 'sc-mix-control';
        
        mixInput.addEventListener('input', (e) => {
            this.sidechain.updateMix(parseFloat(e.target.value));
        });

        mixContainer.append(mixLabel, mixInput);
        controls.appendChild(mixContainer);

        // Assemble interface
        this.container.appendChild(sequencer);
        this.container.appendChild(controls);
    }

    createKnob(param, config) {
        const container = document.createElement('div');
        container.className = 'sc-knob-container';
        
        const label = document.createElement('span');
        label.textContent = config.label;
        
        const input = document.createElement('input');
        input.type = 'range';
        input.min = 0;
        input.max = 1;
        input.step = 0.01;
        input.value = config.defaultValue;
        
        input.addEventListener('input', (e) => {
            this.sidechain.updateParameter(param, parseFloat(e.target.value));
        });

        container.append(label, input);
        return container;
    }

    highlightStep(step) {
        this.container.querySelectorAll('.sc-step').forEach(s => 
            s.classList.remove('current'));
        this.container.querySelector(`.sc-step[data-step="${step}"]`)
            ?.classList.add('current');
    }

    updateStepState(step, active) {
        this.container.querySelector(`.sc-step[data-step="${step}"]`)
            ?.classList.toggle('active', active);
    }
}
