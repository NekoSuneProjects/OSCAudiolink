// spotifyModule.js
const axios = require("axios");
const { ipcMain } = require("electron");

let mainWindow;
let store;

async function loadStore() {
  const { default: ElectronStore } = await import("electron-store");
  store = new ElectronStore();
}

function init(window) {
  mainWindow = window;
  loadStore().then(() => {
    console.log("Electron Store initialized");
  });
}

// Refresh Spotify token periodically
async function refreshSpotifyToken() {
  if (!store) await loadStore();
  const refreshToken = store.get("spotify_refresh_token");
  if (!refreshToken) return;

  try {
    const response = await axios.get(
      `http://yourserver.com/refresh_token?refresh_token=${refreshToken}`
    );
    const { access_token } = response.data;

    mainWindow.webContents.send("newAccessToken", access_token);
    store.set("spotify_access_token", access_token); // Update access token in store
  } catch (error) {
    console.error("Error refreshing Spotify token:", error);
  }
}

// Fetch the current track from Spotify
async function fetchCurrentTrack() {
  if (!store) await loadStore();
  const accessToken = store.get("spotify_access_token");
  if (!accessToken) return;

  try {
    const response = await axios.get(
      "https://api.spotify.com/v1/me/player/currently-playing",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    const track = response.data.item;
    if (track) {
      mainWindow.webContents.send("updateTrackInfo", {
        artist: track.artists[0].name,
        title: track.name
      });
    }
  } catch (error) {
    console.error("Error fetching Spotify track:", error);
  }
}

// Start token refresh periodically
function startTokenRefresh() {
  setInterval(refreshSpotifyToken, 50 * 60 * 1000);
}

// Store tokens received from the backend
ipcMain.on("tokensReceived", async (event, tokens) => {
  if (!store) await loadStore();
  store.set("spotify_access_token", tokens.accessToken);
  store.set("spotify_refresh_token", tokens.refreshToken);
});

module.exports = {
  init,
  fetchCurrentTrack,
  startTokenRefresh,
};
