import { AudioEngine } from './core/AudioEngine.js';
import { RenderEngine } from './core/RenderEngine.js';
import { TB303 } from './audio-components/instruments/tb303/TB303.js';
import { DrumMachine } from './audio-components/instruments/drummer/DrumMachine.js';
import { Sampler } from './audio-components/instruments/sampler/Sampler.js';

document.addEventListener('DOMContentLoaded', () => {
    const audioEngine = new AudioEngine();
    const renderEngine = new RenderEngine(audioEngine);
    
    // Prevent scrolling on touch devices
    document.body.addEventListener('touchmove', (e) => {
        if (e.target.closest('.drummachineknob') || e.target.closest('.drum-cell')) {
            e.preventDefault();
        }
    }, { passive: false });

    document.body.appendChild(renderEngine.render());

    // Example: Add a MonoSynth
    //add a sampler
    const sampler = new Sampler(audioEngine.context);
    audioEngine.addInstrument('sampler', sampler);
    renderEngine.addInstrumentUI('sampler', sampler);   

    // Add TB-303
    const tb303 = new TB303(audioEngine.context);
    audioEngine.addInstrument('tb303', tb303);
    renderEngine.addInstrumentUI('tb303', tb303);
    
    // Add Drum Machine
    const drummer = new DrumMachine(audioEngine.context);
    audioEngine.addInstrument('drummer', drummer);
    renderEngine.addInstrumentUI('drummer', drummer);
    
});
