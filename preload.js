// preload.js
const { ipcRenderer } = require("electron");

// Directly expose to window (since contextIsolation = false)
window.electronAPI = {
  sendToMain: (channel, data) => ipcRenderer.send(channel, data),
  receiveFromMain: (channel, func) => ipcRenderer.on(channel, (_, ...args) => func(...args)),
  getOscPort: () => ipcRenderer.invoke('getOscPort'),
  updateOscPort: (newPort) => ipcRenderer.send('updateOscPort', newPort),
  getSetting: (key, defaultValue) => ipcRenderer.invoke('getSetting', key, defaultValue),
  saveSetting: (key, value) => ipcRenderer.invoke('saveSetting', key, value),
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args)
};
