let sequence = {};
let parameters = {};

self.onmessage = function(e) {
    const { type, data } = e.data;
    
    switch(type) {
        case 'updateSequence':
            sequence[data.drum] = data.steps;
            break;
            
        case 'updateParameters':
            parameters = { ...parameters, ...data };
            break;
            
        case 'processBeat':
            const { beat, time } = data;
            processBeat(beat, time);
            break;
    }
};

function processBeat(beat, time) {
    const activeSounds = [];
    
    for (const [drum, steps] of Object.entries(sequence)) {
        if (steps[beat]?.active) {
            activeSounds.push({
                drum,
                time,
                velocity: steps[beat].velocity,
                parameters: {
                    pitch: parameters[`${drum}Pitch`] || 1,
                    attack: parameters[`${drum}Attack`] || 0.01,
                    decay: parameters[`${drum}Decay`] || 0.1,
                    sustain: parameters[`${drum}Sustain`] || 0.5,
                    release: parameters[`${drum}Release`] || 0.1
                }
            });
        }
    }
    
    self.postMessage({ type: 'playSounds', data: activeSounds });
}
