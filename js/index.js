import { AudioEngine } from './core/AudioEngine.js';
import { RenderEngine } from './core/RenderEngine.js';
import { TB303 } from './audio-components/instruments/tb303/TB303.js';
import { DrumMachine } from './audio-components/instruments/drummer/DrumMachine.js';
import { Sampler } from './audio-components/instruments/sampler/Sampler.js';
import { MIDIManager } from './core/MIDIManager.js';
import { Looper } from './audio-components/instruments/looper/Looper.js';

document.addEventListener('DOMContentLoaded', async () => {
    const audioEngine = new AudioEngine();
    const renderEngine = new RenderEngine(audioEngine);
    const midiManager = new MIDIManager();
    await midiManager.init();
    
    // Prevent scrolling on touch devices
    document.body.addEventListener('touchmove', (e) => {
        if (e.target.closest('.drummachineknob') || e.target.closest('.drum-cell')) {
            e.preventDefault();
        }
    }, { passive: false });

    document.body.appendChild(renderEngine.render());

   
    
    // Forward MIDI messages to each instrument
    midiManager.addHandler((message) => {
        audioEngine.instruments.forEach(inst => {
            inst.onMIDIMessage?.(message);
        });
    });

  
});
