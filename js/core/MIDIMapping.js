export class MIDIMapping {
    constructor() {
        this.mappings = new Map();
        this.learningParam = null;
    }

    startLearning(param) {
        console.log('Starting MIDI learning for:', param);
        this.learningParam = param;
    }

    stopLearning() {
        console.log('Stopping MIDI learning');
        this.learningParam = null;
    }

    handleMIDIMessage(message) {
        const [status, data1, data2] = message.data;
        
        // Log per debug
        console.log('MIDI message:', {status, data1, data2});

        // Se siamo in modalità learning
        if (this.learningParam) {
            // Accetta solo Control Change messages (0xB0)
            if ((status & 0xF0) === 0xB0) {
                console.log('Learning new mapping:', {
                    param: this.learningParam,
                    control: data1
                });
                this.mappings.set(this.learningParam, {
                    control: data1,
                    channel: status & 0x0F
                });
                this.learningParam = null;
                return { mapped: true, param: this.learningParam, value: data2 / 127 };
            }
            return { mapped: false };
        }

        // Gestione normale dei messaggi MIDI
        for (const [param, mapping] of this.mappings.entries()) {
            if ((status & 0xF0) === 0xB0 && // Control Change
                data1 === mapping.control && 
                (status & 0x0F) === mapping.channel) {
                
                console.log('Handling MIDI control:', {
                    param,
                    value: data2 / 127
                });
                
                return {
                    mapped: true,
                    param: param,
                    value: data2 / 127
                };
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
