// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  sendToMain: (channel, data) => ipcRenderer.send(channel, data),
  receiveFromMain: (channel, func) =>
    ipcRenderer.on(channel, (event, ...args) => func(...args)),
  getOscPort: () => ipcRenderer.invoke('getOscPort'),
    updateOscPort: (newPort) => ipcRenderer.send('updateOscPort', newPort),
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args)
});
