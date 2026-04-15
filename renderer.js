const { loadAudioDevices, setupAudioAnalysis, stopAudioAnalysis } = require('./modules/audio/audioModule')
const { setOscPort, sendOsc, sendBeat, startOscReceiver, stopOscReceiver } = require('./modules/vrchatosc/oscModule')

let isAnalyzing = false
let receiverPort = 9001
let oscReceiveEnabled = false
let oscHistory = []
const maxHistory = 100
let beatState = false

async function initApp () {
  await loadAudioDevices()
  await loadSettings()
}

function handleAudioLevels (levels) {
  oscHistory.push([...levels])
  if (oscHistory.length > maxHistory) oscHistory.shift()
  updateOscGraph()

  const volume = levels.reduce((sum, value) => sum + value, 0) / levels.length
  const peak = Math.max(...levels)
  updateOscLog(levels, volume, peak)

  const newBeat = peak > 0.65
  if (newBeat !== beatState) {
    beatState = newBeat
    sendBeat(beatState ? 1 : 0)
  }

  sendOsc(levels)
}

async function initAudio () {
  const audioSelect = document.getElementById('audioDeviceSelect')
  const selectedDeviceId = audioSelect.value
  const selectedKind = audioSelect.selectedOptions[0]?.dataset.kind
  const portValue = parseInt(document.getElementById('portInput').value, 10)

  if (!selectedDeviceId) {
    alert('Please select an audio input device.')
    return
  }

  if (selectedKind === 'audiooutput') {
    alert('Playback devices cannot be used for getUserMedia capture. Please select a microphone input device.')
    return
  }

  await window.electronAPI.saveSetting('selectedAudioDevice', selectedDeviceId)
  await setupAudioAnalysis(selectedDeviceId, {
    onLevels: handleAudioLevels,
    onError: err => alert('Audio failed: ' + err.message)
  })

  isAnalyzing = true
  document.getElementById('toggleAudio').textContent = 'Stop Audio'
  if (!isNaN(portValue)) {
    setOscPort(portValue)
  }
}

async function loadSettings () {
  const storedOscPort = await window.electronAPI.getSetting('oscPort', 9000)
  const storedGain = await window.electronAPI.getSetting('gain', 2.0)
  const storedLowBoost = await window.electronAPI.getSetting('lowBoost', 2.6)
  const storedBassBoost = await window.electronAPI.getSetting('bassBoost', 3.0)
  const storedMidBoost = await window.electronAPI.getSetting('midBoost', 2.0)
  const storedTrebleBoost = await window.electronAPI.getSetting('trebleBoost', 3.4)
  const storedReceiverPort = await window.electronAPI.getSetting('receiverPort', 9001)
  const storedReceiveEnabled = await window.electronAPI.getSetting('receiveEnabled', false)

  document.getElementById('portInput').value = storedOscPort
  setOscPort(storedOscPort)

  document.getElementById('gainSlider').value = storedGain
  document.getElementById('lowBoostSlider').value = storedLowBoost
  document.getElementById('bassBoostSlider').value = storedBassBoost
  document.getElementById('midBoostSlider').value = storedMidBoost
  document.getElementById('trebleBoostSlider').value = storedTrebleBoost
  document.getElementById('gainValue').textContent = storedGain
  document.getElementById('lowBoostValue').textContent = storedLowBoost
  document.getElementById('bassBoostValue').textContent = storedBassBoost
  document.getElementById('midBoostValue').textContent = storedMidBoost
  document.getElementById('trebleBoostValue').textContent = storedTrebleBoost

  document.getElementById('receiverPortInput').value = storedReceiverPort
  document.getElementById('enableReceive').checked = storedReceiveEnabled
  receiverPort = storedReceiverPort
  oscReceiveEnabled = storedReceiveEnabled

  if (storedReceiveEnabled) {
    startOscReceiver(receiverPort, (address, args) => updateOscLogIncoming(address, args))
  }
}

function updateOscGraph () {
  const canvas = document.getElementById('oscGraph')
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const colors = ['red', 'green', 'blue', 'purple']
  const step = canvas.width / maxHistory

  oscHistory.forEach((levels, i) => {
    levels.forEach((level, j) => {
      ctx.fillStyle = colors[j]
      ctx.fillRect(i * step, canvas.height - level * canvas.height, step - 1, level * canvas.height)
    })
  })
}

function updateOscLog (levels, volume, peak) {
  const logText = document.getElementById('oscLogText')
  const timestamp = new Date().toLocaleTimeString()
  const logEntry = `${timestamp} OUT - Low: ${levels[0].toFixed(2)}, Bass: ${levels[1].toFixed(2)}, Mid: ${levels[2].toFixed(2)}, Treble: ${levels[3].toFixed(2)}, Volume: ${volume.toFixed(2)}, Peak: ${peak.toFixed(2)}\n`
  logText.value += logEntry
  logText.scrollTop = logText.scrollHeight
}

function updateOscLogIncoming (address, args) {
  const logText = document.getElementById('oscLogText')
  const timestamp = new Date().toLocaleTimeString()
  const argString = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(', ')
  const logEntry = `${timestamp} IN  - ${address} ${argString}\n`
  logText.value += logEntry
  logText.scrollTop = logText.scrollHeight
}

function toggleAudio () {
  const toggleButton = document.getElementById('toggleAudio')
  if (isAnalyzing) {
    stopAudioAnalysis()
    isAnalyzing = false
    toggleButton.textContent = 'Start Audio'
    return
  }

  initAudio()
}

initApp()

document.getElementById('toggleAudio').addEventListener('click', toggleAudio)

document.getElementById('portInput').addEventListener('change', async event => {
  const newPort = parseInt(event.target.value, 10)
  if (!isNaN(newPort)) {
    setOscPort(newPort)
    await window.electronAPI.saveSetting('oscPort', newPort)
    window.electronAPI.updateOscPort(newPort)
  }
})

document.getElementById('receiverPortInput').addEventListener('change', async e => {
  const newPort = parseInt(e.target.value, 10)
  if (!isNaN(newPort)) {
    receiverPort = newPort
    await window.electronAPI.saveSetting('receiverPort', newPort)
    if (oscReceiveEnabled) {
      stopOscReceiver()
      startOscReceiver(receiverPort, (address, args) => updateOscLogIncoming(address, args))
    }
  }
})

document.getElementById('enableReceive').addEventListener('change', async e => {
  oscReceiveEnabled = e.target.checked
  await window.electronAPI.saveSetting('receiveEnabled', oscReceiveEnabled)
  if (oscReceiveEnabled) {
    startOscReceiver(receiverPort, (address, args) => updateOscLogIncoming(address, args))
  } else {
    stopOscReceiver()
  }
})

document.getElementById('gainSlider').addEventListener('input', async e => {
  document.getElementById('gainValue').textContent = e.target.value
  await window.electronAPI.saveSetting('gain', parseFloat(e.target.value))
})

document.getElementById('lowBoostSlider').addEventListener('input', async e => {
  document.getElementById('lowBoostValue').textContent = e.target.value
  await window.electronAPI.saveSetting('lowBoost', parseFloat(e.target.value))
})

document.getElementById('bassBoostSlider').addEventListener('input', async e => {
  document.getElementById('bassBoostValue').textContent = e.target.value
  await window.electronAPI.saveSetting('bassBoost', parseFloat(e.target.value))
})

document.getElementById('midBoostSlider').addEventListener('input', async e => {
  document.getElementById('midBoostValue').textContent = e.target.value
  await window.electronAPI.saveSetting('midBoost', parseFloat(e.target.value))
})

document.getElementById('trebleBoostSlider').addEventListener('input', async e => {
  document.getElementById('trebleBoostValue').textContent = e.target.value
  await window.electronAPI.saveSetting('trebleBoost', parseFloat(e.target.value))
})

document.getElementById('audioDeviceSelect').addEventListener('change', async e => {
  await window.electronAPI.saveSetting('selectedAudioDevice', e.target.value)
})

document.getElementById('clearLog').addEventListener('click', () => {
  document.getElementById('oscLogText').value = ''
  oscHistory = []
  updateOscGraph()
})
