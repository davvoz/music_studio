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
        console.log('Starting MIDI learning for:', param);
        this.learningParam = param;
        this.lastNotePressed = null;
        this.learningState = {
            param: param,
            notePressed: false
        };
        
        if (this.learnTimeout) {
            clearTimeout(this.learnTimeout);
        }
        
        this.learnTimeout = setTimeout(() => this.stopLearning(), 10000);
    }

    stopLearning() {
        console.log('Stopping MIDI learning');
        if (this.learnTimeout) {
            clearTimeout(this.learnTimeout);
            this.learnTimeout = null;
        }
        this.learningParam = null;
        this.lastNotePressed = null;
        this.learningState = null;
    }

    handleMIDIMessage(message) {
        const [status, data1, data2] = message.data;
        const messageType = status & 0xF0;
        const channel = status & 0x0F;

        console.log('MIDI message:', {
            status, data1, data2, messageType,
            isLearning: !!this.learningState,
            lastNote: this.lastNotePressed,
            param: this.learningParam,
            state: this.learningState,
            type: messageType === 0x90 ? 'Note On' : 
                  messageType === 0x80 ? 'Note Off' : 
                  messageType === 0xB0 ? 'Control Change' : 'Other'
        });

        // Learning mode
        if (this.learningState) {
            // Per i pattern gestiamo Note On/Off
            if (this.learningState.param.startsWith('pattern')) {
                if (messageType === 0x90 && data2 > 0) {
                    this.lastNotePressed = { note: data1, channel };
                    console.log('Learning note for pattern:', this.lastNotePressed);
                    return { mapped: false };
                } else if ((messageType === 0x80 || (messageType === 0x90 && data2 === 0)) && 
                          this.lastNotePressed?.note === data1) {
                    console.log('Completing pattern mapping:', this.learningState.param);
                    this.mappings.set(this.learningState.param, {
                        control: data1,
                        channel: channel,
                        type: 'note'
                    });
                    const param = this.learningState.param;
                    this.stopLearning();
                    return { mapped: true, param, trigger: true };
                }
            } 
            // Per tutti gli altri controlli gestiamo CC
            else if (messageType === 0xB0) {
                console.log('Learning CC for param:', this.learningState.param);
                this.mappings.set(this.learningState.param, {
                    control: data1,
                    channel: channel,
                    type: 'cc'
                });
                const param = this.learningState.param;
                this.stopLearning();
                return { mapped: true, param, value: data2 / 127 };
            }
            return { mapped: false };
        }

        // Normal operation - check mappings
        for (const [param, mapping] of this.mappings.entries()) {
            if (mapping.control === data1 && channel === mapping.channel) {
                if (mapping.type === 'note' && messageType === 0x90 && data2 > 0) {
                    // Note On per i pattern
                    console.log('Triggering pattern:', param);
                    return { mapped: true, param, trigger: true };
                } else if (mapping.type === 'cc' && messageType === 0xB0) {
                    // Control Change per i knob
                    console.log('Updating control:', param, data2 / 127);
                    return { mapped: true, param, value: data2 / 127 };
                }
            }
        }

        return { mapped: false };
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
