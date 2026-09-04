/**
 * main.js — VisionIQ Electron Main Process
 *
 * Flow:
 *   1. Show splash window immediately
 *   2. Spawn bundled Python backend (visioniq_server.exe)
 *   3. Poll /api/health every 2 s until models_loaded = true
 *   4. Open main BrowserWindow with React frontend
 *   5. Close splash
 *   6. On quit: kill Python process cleanly
 */

const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path   = require("path");
const fs     = require("fs");
const http   = require("http");
const { spawn, execSync } = require("child_process");

// ── constants ────────────────────────────────────────────────────────────────
const BACKEND_PORT    = 8000;
const BACKEND_HOST    = "127.0.0.1";
const HEALTH_URL      = `http://${BACKEND_HOST}:${BACKEND_PORT}/api/health`;
const POLL_INTERVAL   = 2000;    // ms between health checks
const STARTUP_TIMEOUT = 300000;  // 5 min — first run loads ~500 MB of weights

const isDev = !app.isPackaged;

// ── path resolution ───────────────────────────────────────────────────────────
function getBackendExe() {
  if (isDev) {
    // Dev: pre-built exe lives in backend/dist/
    const devExe = path.join(__dirname, "..", "backend", "dist", "visioniq_server", "visioniq_server.exe");
    if (fs.existsSync(devExe)) return { exe: devExe, cwd: path.dirname(devExe) };
    return null; // fall back to python
  }
  // Production: bundled as extraResources → resources/backend/
  const exe = path.join(process.resourcesPath, "backend", "visioniq_server.exe");
  return { exe, cwd: path.dirname(exe) };
}

function getFrontendIndex() {
  if (isDev) return path.join(__dirname, "dist", "index.html");
  return path.join(process.resourcesPath, "frontend", "dist", "index.html");
}

function getSplashHtml() {
  return path.join(__dirname, "splash.html");
}

// ── globals ───────────────────────────────────────────────────────────────────
let splashWin   = null;
let mainWin     = null;
let backendProc = null;
let pollTimer   = null;

// ── splash ────────────────────────────────────────────────────────────────────
function createSplash() {
  splashWin = new BrowserWindow({
    width: 480, height: 300,
    frame: false, transparent: true,
    resizable: false, alwaysOnTop: true, center: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  splashWin.loadFile(getSplashHtml());
  splashWin.on("closed", () => { splashWin = null; });
}

function sendSplashStatus(msg, color) {
  if (splashWin && !splashWin.isDestroyed()) {
    splashWin.webContents.send("set-status", { msg, color });
  }
}

// ── main window ───────────────────────────────────────────────────────────────
function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1280, height: 800, minWidth: 800, minHeight: 600,
    show: false,
    title: "VisionIQ — AI Vision",
    icon: path.join(__dirname, "public", "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,   // allow file:// → http://127.0.0.1 fetch
    },
  });

  mainWin.loadFile(getFrontendIndex());

  mainWin.once("ready-to-show", () => {
    if (splashWin && !splashWin.isDestroyed()) splashWin.close();
    mainWin.show();
    mainWin.focus();
    if (isDev) mainWin.webContents.openDevTools({ mode: "detach" });
  });

  mainWin.on("closed", () => { mainWin = null; });
  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

// ── backend spawn ─────────────────────────────────────────────────────────────
function startBackend() {
  const result = getBackendExe();

  if (result) {
    const { exe, cwd } = result;
    console.log("[backend] Spawning exe:", exe);
    console.log("[backend] Working dir:", cwd);

    if (!fs.existsSync(exe)) {
      console.error("[backend] EXE NOT FOUND:", exe);
      dialog.showErrorBox("VisionIQ — Backend Missing",
        `Backend executable not found:\n${exe}\n\nPlease reinstall the application.`);
      app.quit();
      return;
    }

    backendProc = spawn(exe, [], { cwd, stdio: "pipe", windowsHide: true });
  } else {
    // Dev python fallback
    const backendDir = path.join(__dirname, "..", "backend");
    console.log("[backend] Dev mode: python app.py in", backendDir);
    backendProc = spawn("python", ["app.py"], {
      cwd: backendDir, stdio: "pipe", windowsHide: true,
    });
  }

  backendProc.stdout.on("data", (d) => {
    const line = d.toString().trim();
    console.log("[PY]", line);
    // Forward key log lines to the splash
    if (line.includes("Loading MTCNN"))          sendSplashStatus("Loading face detector…", null);
    if (line.includes("Loading ViT"))             sendSplashStatus("Loading gender classifier…", null);
    if (line.includes("Loading ResNet"))          sendSplashStatus("Loading animal classifier…", null);
    if (line.includes("All models ready"))        sendSplashStatus("Models ready — launching…", "#22c55e");
    if (line.includes("Application startup"))     sendSplashStatus("Starting server…", null);
  });

  backendProc.stderr.on("data", (d) => {
    const line = d.toString().trim();
    if (line) console.error("[PY-ERR]", line);
  });

  backendProc.on("exit", (code, signal) => {
    console.log(`[backend] Process exited: code=${code} signal=${signal}`);
    if (code !== 0 && code !== null && !app.isQuitting) {
      // Unexpected crash — show error if no window is open yet
      if (!mainWin) {
        dialog.showErrorBox("VisionIQ — Backend Crashed",
          `The AI backend stopped unexpectedly (exit code ${code}).\n\nPlease restart the application.`);
        app.quit();
      }
    }
  });

  backendProc.on("error", (err) => {
    console.error("[backend] Spawn error:", err);
    dialog.showErrorBox("VisionIQ — Launch Error",
      `Failed to start backend:\n${err.message}\n\nPlease reinstall the application.`);
    app.quit();
  });
}

// ── health polling ────────────────────────────────────────────────────────────
function pollHealth(onReady, onTimeout) {
  const deadline = Date.now() + STARTUP_TIMEOUT;
  let attempt = 0;

  function check() {
    attempt++;
    const req = http.get(HEALTH_URL, (res) => {
      let body = "";
      res.on("data", (c) => { body += c; });
      res.on("end", () => {
        try {
          const data = JSON.parse(body);
          if (splashWin && !splashWin.isDestroyed()) {
            splashWin.webContents.send("backend-status", data);
          }
          if (data.models_loaded) {
            clearTimeout(pollTimer);
            onReady();
          } else {
            scheduleNext();
          }
        } catch (_) {
          scheduleNext();
        }
      });
    });
    req.on("error", () => scheduleNext());
    req.setTimeout(3000, () => { req.destroy(); scheduleNext(); });
  }

  function scheduleNext() {
    if (Date.now() > deadline) { onTimeout(); return; }
    pollTimer = setTimeout(check, POLL_INTERVAL);
  }

  // First check after 2 s (give the process time to start)
  pollTimer = setTimeout(check, 2000);
}

// ── kill backend ──────────────────────────────────────────────────────────────
function killBackend() {
  if (!backendProc) return;
  console.log("[backend] Killing process PID:", backendProc.pid);
  try {
    backendProc.kill("SIGTERM");
  } catch (_) {}
  // Windows: force-kill entire process tree
  if (process.platform === "win32" && backendProc.pid) {
    try { execSync(`taskkill /PID ${backendProc.pid} /F /T`, { stdio: "ignore" }); } catch (_) {}
  }
  backendProc = null;
}

// ── app lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createSplash();
  sendSplashStatus("Starting AI backend…", null);
  startBackend();

  pollHealth(
    () => {
      // Models ready → open main window
      createMainWindow();
    },
    () => {
      // Timed out after 5 min
      if (splashWin && !splashWin.isDestroyed()) splashWin.close();
      const choice = dialog.showMessageBoxSync({
        type: "warning",
        title: "VisionIQ — Slow Start",
        message: "Models are still loading (taking longer than 5 minutes).",
        detail: "This can happen on the very first run while model weights are read from disk.\nOpen the app anyway — it will become fully functional once loading completes.",
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

app.isQuitting = false;
app.on("before-quit", () => {
  app.isQuitting = true;
  clearTimeout(pollTimer);
  killBackend();
});

// ── IPC ───────────────────────────────────────────────────────────────────────
ipcMain.handle("get-app-version", () => app.getVersion());
ipcMain.handle("open-external",   (_, url) => shell.openExternal(url));
