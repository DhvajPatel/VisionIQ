/**
 * electron/main.js — VisionIQ Electron Main Process
 *
 * Flow:
 *   1. Show splash window immediately
 *   2. Spawn bundled Python backend (visioniq_server.exe)
 *   3. Poll /api/health until models are loaded
 *   4. Open main BrowserWindow with React frontend
 *   5. Close splash
 *   6. On quit: kill Python process
 */

const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path   = require("path");
const fs     = require("fs");
const http   = require("http");
const { spawn } = require("child_process");

// ── constants ────────────────────────────────────────────────────────────────
const BACKEND_PORT    = 8000;
const BACKEND_HOST    = "127.0.0.1";
const HEALTH_URL      = `http://${BACKEND_HOST}:${BACKEND_PORT}/api/health`;
const POLL_INTERVAL   = 2000;   // ms between health checks
const STARTUP_TIMEOUT = 120000; // 2 min max wait for models to load

// ── resolve paths ─────────────────────────────────────────────────────────────
// In production (packed app):
//   resources/backend/visioniq_server.exe
//   resources/app/frontend/dist/index.html   (or resources/frontend/dist)
// In development:
//   backend/visioniq_server.exe  (if pre-built)  OR  python backend/app.py
//   frontend/dist/index.html     (after npm run build)

const isDev = !app.isPackaged;

function getBackendExe() {
  if (isDev) {
    // Dev: try the .exe first, fall back to python
    // __dirname is frontend/ so backend is ../backend/
    const devExe = path.join(__dirname, "..", "backend", "dist", "visioniq_server", "visioniq_server.exe");
    if (fs.existsSync(devExe)) return devExe;
    return null; // signal to use python fallback
  }
  return path.join(process.resourcesPath, "backend", "visioniq_server.exe");
}

function getFrontendIndex() {
  if (isDev) {
    // __dirname is frontend/ so dist is right here
    return path.join(__dirname, "dist", "index.html");
  }
  return path.join(process.resourcesPath, "frontend", "dist", "index.html");
}

function getSplashHtml() {
  // splash.html is copied to frontend/ alongside main.js
  return path.join(__dirname, "splash.html");
}

// ── state ─────────────────────────────────────────────────────────────────────
let splashWin  = null;
let mainWin    = null;
let backendProc = null;
let pollTimer  = null;
let startTimer = null;

// ── splash window ─────────────────────────────────────────────────────────────
function createSplash() {
  splashWin = new BrowserWindow({
    width:  480,
    height: 300,
    frame:  false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    center: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  splashWin.loadFile(getSplashHtml());
  splashWin.on("closed", () => { splashWin = null; });
}

// ── main window ───────────────────────────────────────────────────────────────
function createMainWindow() {
  mainWin = new BrowserWindow({
    width:  1280,
    height: 800,
    minWidth:  800,
    minHeight: 600,
    show: false,
    title: "VisionIQ — AI Vision",
    icon: path.join(__dirname, "public", "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // allow file:// → http://127.0.0.1 requests
    },
  });

  const indexPath = getFrontendIndex();
  mainWin.loadFile(indexPath);

  mainWin.once("ready-to-show", () => {
    if (splashWin) splashWin.close();
    mainWin.show();
    mainWin.focus();
    if (isDev) mainWin.webContents.openDevTools({ mode: "detach" });
  });

  mainWin.on("closed", () => { mainWin = null; });

  // Open external links in browser, not Electron
  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

// ── backend spawn ─────────────────────────────────────────────────────────────
function startBackend() {
  const exe = getBackendExe();

  if (exe) {
    // Packed .exe — set working dir to its folder so it finds history.db
    const cwd = path.dirname(exe);
    console.log("[backend] Spawning:", exe);
    backendProc = spawn(exe, [], { cwd, stdio: "pipe", windowsHide: true });
  } else {
    // Dev fallback — run python directly
    const backendDir = path.join(__dirname, "..", "backend");
    console.log("[backend] Dev fallback: python app.py");
    backendProc = spawn("python", ["app.py"], {
      cwd: backendDir,
      stdio: "pipe",
      windowsHide: true,
    });
  }

  backendProc.stdout.on("data", (d) => process.stdout.write(`[PY] ${d}`));
  backendProc.stderr.on("data", (d) => process.stderr.write(`[PY-ERR] ${d}`));
  backendProc.on("exit", (code) => {
    console.log(`[backend] Exited with code ${code}`);
  });
}

// ── health polling ────────────────────────────────────────────────────────────
function pollHealth(onReady, onTimeout) {
  const deadline = Date.now() + STARTUP_TIMEOUT;

  function check() {
    http.get(HEALTH_URL, (res) => {
      let body = "";
      res.on("data", (c) => { body += c; });
      res.on("end", () => {
        try {
          const data = JSON.parse(body);
          // Update splash progress via IPC if splash is still open
          if (splashWin) {
            splashWin.webContents.send("backend-status", data);
          }
          if (data.models_loaded) {
            clearTimeout(pollTimer);
            onReady();
          } else {
            if (Date.now() > deadline) { onTimeout(); return; }
            pollTimer = setTimeout(check, POLL_INTERVAL);
          }
        } catch (_) {
          if (Date.now() > deadline) { onTimeout(); return; }
          pollTimer = setTimeout(check, POLL_INTERVAL);
        }
      });
    }).on("error", () => {
      // Backend not yet up — keep polling
      if (Date.now() > deadline) { onTimeout(); return; }
      pollTimer = setTimeout(check, POLL_INTERVAL);
    });
  }

  // Give the process 1 second to start before first poll
  pollTimer = setTimeout(check, 1000);
}

// ── app lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createSplash();
  startBackend();

  pollHealth(
    // onReady: models loaded
    () => {
      createMainWindow();
    },
    // onTimeout: show error and let user decide
    () => {
      if (splashWin) splashWin.close();
      const choice = dialog.showMessageBoxSync({
        type:    "warning",
        title:   "VisionIQ — Slow Start",
        message: "Models are still loading (taking longer than 2 minutes).",
        detail:  "This can happen on first run while model weights are cached.\nOpen the app anyway?",
        buttons: ["Open Anyway", "Quit"],
        defaultId: 0,
      });
      if (choice === 0) {
        createMainWindow();
      } else {
        app.quit();
      }
    }
  );

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  clearTimeout(pollTimer);
  if (backendProc) {
    console.log("[backend] Killing Python process…");
    backendProc.kill("SIGTERM");
    // Windows fallback
    if (process.platform === "win32") {
      try {
        const { execSync } = require("child_process");
        execSync(`taskkill /PID ${backendProc.pid} /F /T`, { stdio: "ignore" });
      } catch (_) {}
    }
  }
});

// ── IPC handlers ──────────────────────────────────────────────────────────────
ipcMain.handle("get-app-version", () => app.getVersion());
ipcMain.handle("open-external",  (_, url) => shell.openExternal(url));
