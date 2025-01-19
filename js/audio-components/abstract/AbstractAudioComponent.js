export class AbstractAudioComponent {
    constructor(context) {
        if (!context) {
            throw new Error('AudioContext is required');
        }
        this.context = context;
        this.input = this.context.createGain();
        this.output = this.context.createGain();
    }
    connect(destination) {
        this.output.connect(destination);
    }

    disconnect() {
        this.output.disconnect();
    }
}