// musicChatboxModule.js
const { ipcMain } = require('electron');
const oscModule = require('./oscModule');

ipcMain.on("updateTrackInfo", (event, { artist, title }) => {
    const trackInfoMessage = `Now Playing: ${artist} - ${title}`;
    oscModule.sendToChatbox(trackInfoMessage);
});

module.exports = {
    updateTrackInfo: (artist, title) => {
        const trackInfoMessage = `Now Playing: ${artist} - ${title}`;
        oscModule.sendToChatbox(trackInfoMessage);
    }
};
