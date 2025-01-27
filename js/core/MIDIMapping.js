export class MIDIMapping {
    constructor() {
        this.mappings = new Map();
        this.learningCallback = null;
        this.currentParameter = null;
        this.isLearning = false;
    }

    startLearning(param) {
        this.learningParam = param;
        console.log('MIDI Learning started for:', param);
    }

    stopLearning() {
        this.learningParam = null;
    }

    handleMIDIMessage(message) {
        const [status, cc, value] = message.data;
        
        // Gestisci solo Control Change messages
        if ((status & 0xF0) === 0xB0) {
            const channel = status & 0xF;
            
            // Se siamo in modalità learning
            if (this.learningParam) {
                console.log('Mapping:', {
                    param: this.learningParam,
                    cc: cc,
                    channel: channel
                });
                
                this.mappings.set(`${channel}_${cc}`, this.learningParam);
                const mappedParam = this.learningParam;
                this.learningParam = null;
                return { mapped: true, param: mappedParam };
            }
            
            // Altrimenti controlla se il controllo è mappato
            const param = this.mappings.get(`${channel}_${cc}`);
            if (param) {
                return {
                    mapped: true,
                    param: param,
                    value: value / 127
                };
            }
        }
        
        return { mapped: false };
    }

    clearMapping(param) {
        for (const [key, value] of this.mappings.entries()) {
            if (value === param) {
                this.mappings.delete(key);
            }
        }
    }

    getMappingForParam(param) {
        for (const [key, value] of this.mappings.entries()) {
            if (value === param) {
                const [channel, cc] = key.split('_');
                return { channel: parseInt(channel), cc: parseInt(cc) };
            }
        }
        return null;
    }

    // Nuovo metodo per ottenere tutte le mappature
    getMappings() {
        const mappingsObject = {};
        this.mappings.forEach((value, key) => {
            mappingsObject[key] = value;
        });
        return mappingsObject;
    }

    // Nuovo metodo per impostare le mappature da un oggetto
    setMappings(mappingsObject) {
        this.mappings.clear();
        Object.entries(mappingsObject).forEach(([key, value]) => {
            this.mappings.set(key, value);
        });
    }
}
