/**
 * electron/preload.js — Context Bridge
 *
 * Exposes a minimal, safe API from the main process to the renderer.
 * The renderer (React) runs with contextIsolation: true so it cannot
 * access Node.js APIs directly.
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // App metadata
  getVersion:    () => ipcRenderer.invoke("get-app-version"),

  // Open a URL in the system browser
  openExternal:  (url) => ipcRenderer.invoke("open-external", url),

  // Detect that we're running inside Electron (renderer can check this)
  isElectron:    true,

  // Backend base URL — always localhost in the desktop app
  apiBase:       "http://127.0.0.1:8000",
});
