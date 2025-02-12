export class MIDIMapping {
    constructor() {
        this.mappings = new Map();
        this.learningParam = null;
        this.lastNotePressed = null;
        this.learnTimeout = null;
        this.learningState = null; // Add this to track learning state
        this.apc40Mode = true; // Add this flag for APC40 specific handling
    }

    startLearning(param) {
        this.learningState = { param };
        window.dispatchEvent(new CustomEvent('midi-learning-started', {
            bubbles: true,
            detail: { param }
        }));
    }

    stopLearning() {
        if (!this.learningState) return;
        const param = this.learningState.param;
        this.learningState = null;
    }

    handleMIDIMessage(message) {
        const [status, data1, data2] = message.data;
        const messageType = status & 0xF0;
        const channel = status & 0x0F;

        // Learning mode
        if (this.learningState) {
            if ((messageType === 0xB0) || (messageType === 0x90 && data2 > 0)) {
                const param = this.learningState.param;
                
                this.mappings.set(param, {
                    control: data1,
                    channel: channel,
                    type: messageType === 0xB0 ? 'cc' : 'note'
                });

                window.dispatchEvent(new CustomEvent('midi-mapped', {
                    bubbles: true,
                    detail: { 
                        param,
                        hasMapping: true,
                        value: messageType === 0xB0 ? data2 / 127 : 1
                    }
                }));

                this.stopLearning();
                return { mapped: true, param, value: data2 / 127, trigger: messageType === 0x90 };
            }
            return { mapped: false };
        }

        // Check mappings without recursion
        let result = { mapped: false };
        
        this.mappings.forEach((mapping, param) => {
            if (mapping.control === data1 && mapping.channel === channel) {
                if (mapping.type === 'note' && messageType === 0x90 && data2 > 0) {
                    result = { mapped: true, param, trigger: true };
                } else if (mapping.type === 'cc' && messageType === 0xB0) {
                    result = { mapped: true, param, value: data2 / 127 };
                }
            }
        });

        return result;
    }

    getMappings() {
        return Object.fromEntries(this.mappings);
    }

    setMappings(mappings) {
        this.mappings.clear();
        for (const [param, mapping] of Object.entries(mappings)) {
            this.mappings.set(param, mapping);
        }
    }

    clearMapping(param) {
        this.mappings.delete(param);
    }
}
