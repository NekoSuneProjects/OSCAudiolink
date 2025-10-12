const { ipcRenderer } = require('electron');
const dgram = require('dgram');
const math = require('mathjs');

let audioContext;
let analyser;
let source;
let stream;
let isAnalyzing = false;
let oscPort = 9000;
const oscClient = dgram.createSocket('udp4');

// AudioLink-inspired settings
const audioLinkSettings = {
    gain: 1.0,
    bass: 1.5,       // Increased gain for bass
    low: 1.2,        // Increased gain for low
    mid: 1.0,
    treble: 1.0,
    legancy: false,
    thresholds: [0.35, 0.35, 0.45, 0.45], // Lowered thresholds for bass and low
    crossovers: [0.0, 0.25, 0.5, 0.75],
    fadeLength: 0.25,
    fadeExpFalloff: 0.75,
};

async function loadAudioDevices() {
    const audioSelect = document.getElementById('audioDeviceSelect');
    audioSelect.innerHTML = '';

    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputDevices = devices.filter(device => device.kind === 'audioinput');

        audioInputDevices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || 'Microphone ' + (audioSelect.length + 1);
            audioSelect.appendChild(option);
        });

        if (audioInputDevices.length === 0) {
            const noDevicesOption = document.createElement('option');
            noDevicesOption.value = '';
            noDevicesOption.text = 'No audio input devices found';
            audioSelect.appendChild(noDevicesOption);
        }
    } catch (error) {
        console.error('Error loading audio devices:', error);
    }
}

loadAudioDevices();

document.getElementById('toggleAudio').addEventListener('click', async () => {
    if (isAnalyzing) {
        stopAudioAnalysis();
    } else {
        const selectedDeviceId = document.getElementById('audioDeviceSelect').value;
        oscPort = document.getElementById('portInput').value || 9000;
        if (selectedDeviceId) {
            await setupAudioAnalysis(selectedDeviceId);
        } else {
            alert('Please select an audio input device.');
        }
    }
});

async function setupAudioAnalysis(deviceId) {
    if (audioContext) {
        stopAudioAnalysis();
    }

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = audioLinkSettings.fadeExpFalloff;

    stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } });
    source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    isAnalyzing = true;
    document.getElementById('toggleAudio').textContent = 'Stop Audio';

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function visualize() {
        if (!isAnalyzing) return;

        analyser.getByteFrequencyData(dataArray);
        const levels = calculateLevels(dataArray);
        updateWaveform(levels);

        sendOsc(levels, audioLinkSettings.legancy);

        requestAnimationFrame(visualize);
    }

    visualize();
}

function stopAudioAnalysis() {
    if (source) {
        source.disconnect();
    }
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    if (audioContext) {
        audioContext.close();
    }
    isAnalyzing = false;
    document.getElementById('toggleAudio').textContent = 'Start Audio';
}

function calculateLevels(dataArray) {
    const sampleRate = 44100;
    const frequencyBands = {
        bass: [20, 150],
        low: [150, 500],
        mid: [500, 4000],
        treble: [4000, 15000]
    };

    const levels = [];

    function getIndex(freq) {
        return Math.floor((dataArray.length * freq) / sampleRate);
    }

    for (const [band, [lowFreq, highFreq]] of Object.entries(frequencyBands)) {
        const lowIndex = getIndex(lowFreq);
        const highIndex = getIndex(highFreq);
        const bandPower = dataArray.slice(lowIndex, highIndex).reduce((acc, val) => acc + val, 0);

        // Apply gain and normalize based on AudioLink-like settings
        let normalizedLevel;
        switch (band) {
            case 'bass':
                normalizedLevel = Math.min(Math.max(Math.pow(bandPower * audioLinkSettings.bass, 0.6) / 100, 0), 1);
                break;
            case 'low':
                normalizedLevel = Math.min(Math.max(Math.pow(bandPower * audioLinkSettings.low, 0.6) / 150, 0), 1);
                break;
            case 'mid':
                normalizedLevel = Math.min(Math.max(Math.pow(bandPower * audioLinkSettings.mid, 0.5) / 200, 0), 1);
                break;
            case 'treble':
                normalizedLevel = Math.min(Math.max(Math.pow(bandPower * audioLinkSettings.treble, 0.5) / 200, 0), 1);
                break;
        }

        const threshold = audioLinkSettings.thresholds[Object.keys(frequencyBands).indexOf(band)];
        normalizedLevel = (normalizedLevel > threshold) ? (normalizedLevel - threshold) / (1 - threshold) : 0;

        levels.push(Math.min(normalizedLevel, 1));
    }

    return levels;
}

// Send OSC messages for VRChat
function sendOsc(levels, legacy) {
    let parameters
    parameters = [
        "/avatar/parameters/HUE",
        "/avatar/parameters/Low",
        "/avatar/parameters/Mid",
        "/avatar/parameters/Treble",
        "/avatar/parameters/VRCOSC/NekosAudiolink/Bass",
        "/avatar/parameters/VRCOSC/NekosAudiolink/Low",
        "/avatar/parameters/VRCOSC/NekosAudiolink/Mid",
        "/avatar/parameters/VRCOSC/NekosAudiolink/Treble"
    ];

    levels.forEach((level, i) => {
        const formattedLevel = parseFloat(level.toFixed(2));
        const buffer = createOscMessage(parameters[i], formattedLevel);

        console.log(`Sending OSC message - Address: ${parameters[i]}, Value: ${formattedLevel}`);

        oscClient.send(buffer, oscPort, '127.0.0.1', (error) => {
            if (error) console.error('OSC Error:', error);
        });
    });
}

// Helper function to create OSC message buffer for a float value
function createOscMessage(address, value) {
    const encoder = new TextEncoder();
    const addressBuffer = encoder.encode(address + '\0');
    const typeTag = encoder.encode(',f\0\0');

    const floatBuffer = Buffer.alloc(4);
    floatBuffer.writeFloatBE(value, 0);

    const addressPadded = Buffer.concat([addressBuffer, Buffer.alloc(4 - (addressBuffer.length % 4))]);
    return Buffer.concat([addressPadded, typeTag, floatBuffer]);
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

document.getElementById('portInput').addEventListener('change', (event) => {
    const newPort = parseInt(event.target.value, 10);
    if (!isNaN(newPort)) {
        window.electronAPI.updateOscPort(newPort); // Update main process
    }
});

async function loadSettings() {
    const oscPort = await window.electronAPI.getOscPort();
    document.getElementById('portInput').value = oscPort;
}

loadSettings();
