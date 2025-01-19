self.onmessage = function(e) {
    const { data, sampleRate, volume } = e.data;
    
    // RMS calculation
    const squares = data.reduce((acc, sample) => acc + (sample * sample), 0);
    const rms = Math.sqrt(squares / data.length);
    
    // Peak calculation
    const peak = Math.max(...data.map(Math.abs));
    
    // Convert to dB with volume compensation
    const rmsDb = 20 * Math.log10(rms * volume + 1e-6);
    const peakDb = 20 * Math.log10(peak * volume + 1e-6);
    
    self.postMessage({
        rms: rmsDb,
        peak: peakDb
    });
};
