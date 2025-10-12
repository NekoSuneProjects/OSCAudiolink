const { app, BrowserWindow, ipcMain, Tray, Menu } = require('electron');
const dgram = require('dgram');
const settings = require('./settings');
const path = require('path');

const {
    updateOscMappings,
    sendOscMessage,
} = require('./modules/vrchatosc/oscModule');

let mainWindow;
const oscClient = dgram.createSocket('udp4');

let tray;

function createTray() {
    tray = new Tray(path.join(__dirname, 'assets/icon.ico')); // Use your app icon
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Show', click: () => mainWindow.show() },
        { label: 'Quit', click: () => app.quit() }
    ]);
    tray.setToolTip('OSCAudiolink');
    tray.setContextMenu(contextMenu);

    // Show window on tray icon click
    tray.on('click', () => mainWindow.show());
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true,
            preload: path.join(__dirname, 'preload.js'),
            backgroundThrottling: false // Keep the app running when in the background
        }
    });

    mainWindow.loadFile('index.html');

    // Optional: Hide the window instead of minimizing, if desired
    // --- Minimize to tray ---
    mainWindow.on('minimize', (event) => {
        event.preventDefault();
        mainWindow.hide();
    });

    // Optional: restore from tray
    mainWindow.on('restore', () => {
        mainWindow.show();
    });

    // --- Create the tray after window exists ---
    createTray();

    // Listen for changes to OSC port from renderer
    ipcMain.on('updateOscPort', (event, newPort) => {
        oscPort = newPort;
        settings.set('oscPort', oscPort);
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.on('updateOscMappings', (event, mappings) => {
    updateOscMappings(mappings);
});

// IPC event to send OSC messages for avatar parameters
ipcMain.on('setAvatarParam', (event, param, value) => {
    oscClient.send(Buffer.from(`${param} ${value}`), 9000, '127.0.0.1');
});

// Set up IPC handler to get the current oscPort
ipcMain.handle('getOscPort', (event) => {
    // Retrieve oscPort from settings or default if not set
    return settings.get('oscPort', 9000); // Default to 9000 if not set
});

// Similarly, set handlers for saving or retrieving other configurations
ipcMain.handle('saveOscPort', (event, port) => {
    settings.set('oscPort', port);
    return port;
});
