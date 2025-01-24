export class MIDIManager {
    constructor() {
        this.inputs = [];
        this.handlers = new Set();
        this.debugMode = true; // Enable logging by default
    }

    async init() {
        if (!navigator.requestMIDIAccess) return;
        try {
            const access = await navigator.requestMIDIAccess();
            for (let input of access.inputs.values()) {
                this.inputs.push(input);
                input.onmidimessage = (msg) => this.dispatch(msg);
            }
        } catch (e) {
            console.warn('MIDI init failed', e);
        }
    }

    addHandler(fn) {
        this.handlers.add(fn);
    }

    removeHandler(fn) {
        this.handlers.delete(fn);
    }

    dispatch(message) {
        if (this.debugMode) {
            const [status, data1, data2] = message.data;
            const channel = status & 0xF;
            const type = status & 0xF0;
            
            let eventType = 'Unknown';
            switch(type) {
                case 0x90: eventType = data2 > 0 ? 'Note On' : 'Note Off'; break;
                case 0x80: eventType = 'Note Off'; break;
                case 0xB0: eventType = 'Control Change'; break;
                case 0xE0: eventType = 'Pitch Bend'; break;
                case 0xA0: eventType = 'Aftertouch'; break;
                case 0xD0: eventType = 'Channel Pressure'; break;
                case 0xC0: eventType = 'Program Change'; break;
            }

            console.log(
                `MIDI Input [${eventType}] -`,
                `Channel: ${channel + 1},`,
                `Data1: ${data1},`,
                `Data2: ${data2}`
            );
        }

        this.handlers.forEach(fn => fn(message));
    }

    setDebugMode(enabled) {
        this.debugMode = enabled;
    }
}