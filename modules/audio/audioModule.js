let audioContext;
let analyser;
let source;
let stream;
let isAnalyzing = false;

const { updateWaveform, calculateLevels } = require("./waveform.js");

const audioLinkSettings = {
  gain: 1.0,
  bass: 1.5,
  low: 1.2,
  mid: 1.0,
  treble: 1.0,
  thresholds: [0.35, 0.35, 0.45, 0.45],
  crossovers: [0.0, 0.25, 0.5, 0.75],
  fadeLength: 0.25,
  fadeExpFalloff: 0.75
};

async function setupAudioAnalysis(deviceId) {
  if (audioContext) stopAudioAnalysis();

  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = audioLinkSettings.fadeExpFalloff;

  stream = await navigator.mediaDevices.getUserMedia({
    audio: { deviceId: { exact: deviceId } }
  });
  source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);

  isAnalyzing = true;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  visualize(dataArray);
}

function stopAudioAnalysis() {
  if (source) source.disconnect();
  if (stream) stream.getTracks().forEach((track) => track.stop());
  if (audioContext) audioContext.close();
  isAnalyzing = false;
}

function visualize(dataArray) {
  if (!isAnalyzing) return;

  analyser.getByteFrequencyData(dataArray);
  const levels = calculateLevels(dataArray);
  updateWaveform(levels);
  requestAnimationFrame(() => visualize(dataArray));
}

async function loadAudioDevices() {
  const audioSelect = document.getElementById("audioDeviceSelect");
  audioSelect.innerHTML = "";

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputDevices = devices.filter(
      (device) => device.kind === "audioinput"
    );

    audioInputDevices.forEach((device) => {
      const option = document.createElement("option");
      option.value = device.deviceId;
      option.text = device.label || "Microphone " + (audioSelect.length + 1);
      audioSelect.appendChild(option);
    });

    if (audioInputDevices.length === 0) {
      const noDevicesOption = document.createElement("option");
      noDevicesOption.value = "";
      noDevicesOption.text = "No audio input devices found";
      audioSelect.appendChild(noDevicesOption);
    }
  } catch (error) {
    console.error("Error loading audio devices:", error);
  }
}

module.exports = {
  setupAudioAnalysis,
  stopAudioAnalysis,
  visualize,
  loadAudioDevices
};
