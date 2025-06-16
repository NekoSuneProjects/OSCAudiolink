function calculateLevels(dataArray) {
    const sampleRate = 44100;
    const frequencyBands = {
        bass: [20, 300],    // Extended bass range for improved sensitivity
        low: [300, 500],
        mid: [500, 4000],
        treble: [4000, 15000]
    };

    // Get gain values from sliders
    const bassGain = parseFloat(document.getElementById('bassGain').value || 3.0); // Boost bass by default
    const lowGain = parseFloat(document.getElementById('lowGain').value || 1);
    const midGain = parseFloat(document.getElementById('midGain').value || 1);
    const trebleGain = parseFloat(document.getElementById('trebleGain').value || 1);

    const levels = [];

    function getIndex(freq) {
        return Math.floor((dataArray.length * freq) / sampleRate);
    }

    for (const [band, [lowFreq, highFreq]] of Object.entries(frequencyBands)) {
        const lowIndex = getIndex(lowFreq);
        const highIndex = getIndex(highFreq);
        const bandPower = dataArray.slice(lowIndex, highIndex).reduce((acc, val) => acc + val, 0);

        // Adjust the normalization and apply gain to improve bass sensitivity
        let normalizedLevel;
        if (band === 'bass') {
            // Apply a different normalization for bass to make it more sensitive
            normalizedLevel = Math.min(Math.max(Math.pow(bandPower, 0.6) / 150, 0), 1); 
            normalizedLevel *= bassGain; // Boost bass with additional gain
        } else {
            // Use default normalization for other bands
            normalizedLevel = Math.min(Math.max(Math.pow(bandPower, 0.5) / 200, 0), 1);
            switch (band) {
                case 'low':
                    normalizedLevel *= lowGain;
                    break;
                case 'mid':
                    normalizedLevel *= midGain;
                    break;
                case 'treble':
                    normalizedLevel *= trebleGain;
                    break;
            }
        }

        levels.push(Math.min(normalizedLevel, 1)); // Cap each level at 1
    }

    return levels;
}

function updateWaveform(levels) {
    const canvas = document.getElementById('audioCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const colors = ['red', 'green', 'blue', 'purple'];
    levels.forEach((level, i) => {
        ctx.fillStyle = colors[i];
        ctx.fillRect(i * (canvas.width / 4), canvas.height - level * canvas.height, canvas.width / 4 - 10, level * canvas.height);
    });
}

module.exports = {
    updateWaveform,
    calculateLevels
};