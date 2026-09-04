/**
 * main.js — VisionIQ Electron Main Process  v2.1.0
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
const POLL_INTERVAL   = 2000;
const STARTUP_TIMEOUT = 300000;  // 5 min

const isDev = !app.isPackaged;

// ── path helpers ──────────────────────────────────────────────────────────────
//
// IMPORTANT: In a packaged Electron app:
//   - main.js lives inside app.asar  → __dirname = "/path/to/app.asar" (virtual)
//   - app.getAppPath() returns the real path to app.asar
//   - process.resourcesPath = ".../resources"  (real filesystem)
//
// Files packed via electron-builder "files" are inside app.asar.
// Files packed via "extraResources" are at process.resourcesPath (real FS).
//
// Our layout:
//   resources/
//     app.asar          ← main.js, preload.js, splash.html, dist/**  (in asar)
//     backend/          ← visioniq_server.exe + models_cache  (extraResources)
//     frontend/dist/    ← index.html + assets  (extraResources copy)
//     elevate.exe

function appFile(...parts) {
  // Files inside app.asar  (main.js, preload.js, splash.html)
  // Use app.getAppPath() which returns the correct asar path
  return path.join(app.getAppPath(), ...parts);
}

function resourceFile(...parts) {
  // Files in extraResources  (backend exe, frontend/dist)
  return path.join(process.resourcesPath, ...parts);
}

function getBackendExe() {
  if (isDev) {
    const devExe = path.join(__dirname, "..", "backend", "dist", "visioniq_server", "visioniq_server.exe");
    if (fs.existsSync(devExe)) return { exe: devExe, cwd: path.dirname(devExe) };
    return null;
  }
  const exe = resourceFile("backend", "visioniq_server.exe");
  return { exe, cwd: path.dirname(exe) };
}

function getFrontendIndex() {
  if (isDev) return path.join(__dirname, "dist", "index.html");
  // Try extraResources copy first
  const extPath = resourceFile("frontend", "dist", "index.html");
  if (fs.existsSync(extPath)) return extPath;
  // Fall back to inside asar
  return appFile("dist", "index.html");
}

function getPreloadPath() {
  if (isDev) return path.join(__dirname, "preload.js");
  // preload.js is inside app.asar
  return appFile("preload.js");
}

function getSplashPath() {
  if (isDev) return path.join(__dirname, "splash.html");
  return appFile("splash.html");
}

function getIconPath() {
  if (isDev) return path.join(__dirname, "public", "icon.ico");
  const extIco = resourceFile("frontend", "dist", "icon.ico");
  if (fs.existsSync(extIco)) return extIco;
  return appFile("public", "icon.ico");
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
  splashWin.loadFile(getSplashPath());
  splashWin.on("closed", () => { splashWin = null; });
}

function sendSplashStatus(msg, color) {
  if (splashWin && !splashWin.isDestroyed()) {
    splashWin.webContents.send("set-status", { msg, color });
  }
}

// ── main window ───────────────────────────────────────────────────────────────
function createMainWindow() {
  const indexPath   = getFrontendIndex();
  const preloadPath = getPreloadPath();
  const iconPath    = getIconPath();

  console.log("[main] index.html:", indexPath, "exists:", fs.existsSync(indexPath));
  console.log("[main] preload.js:", preloadPath);
  console.log("[main] icon.ico:  ", iconPath);

  mainWin = new BrowserWindow({
    width: 1280, height: 800, minWidth: 800, minHeight: 600,
    show: false,
    title: "VisionIQ — AI Vision",
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,   // allow file:// → http://127.0.0.1 fetch
    },
  });

  if (!fs.existsSync(indexPath)) {
    dialog.showErrorBox("VisionIQ — Missing Frontend",
      `Could not find index.html at:\n${indexPath}\n\nPlease reinstall the application.`);
    app.quit();
    return;
  }

  mainWin.loadFile(indexPath)
    .catch((err) => {
      console.error("[main] loadFile failed:", err);
      // Fallback: load as URL
      mainWin.loadURL(`file://${indexPath.replace(/\\/g, "/")}`);
    });

  // Also handle did-fail-load
  mainWin.webContents.on("did-fail-load", (event, code, desc, url) => {
    console.error("[main] Page failed to load:", code, desc, url);
  });

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
    console.log("[backend] Spawning:", exe);
    console.log("[backend] CWD:", cwd);

    if (!fs.existsSync(exe)) {
      dialog.showErrorBox("VisionIQ — Backend Missing",
        `Backend executable not found:\n${exe}\n\nPlease reinstall the application.`);
      app.quit();
      return;
    }

    backendProc = spawn(exe, [], { cwd, stdio: "pipe", windowsHide: true });
  } else {
    const backendDir = path.join(__dirname, "..", "backend");
    console.log("[backend] Dev fallback: python app.py in", backendDir);
    backendProc = spawn("python", ["app.py"], {
      cwd: backendDir, stdio: "pipe", windowsHide: true,
    });
  }

  backendProc.stdout.on("data", (d) => {
    const line = d.toString().trim();
    console.log("[PY]", line);
    if (line.includes("Loading MTCNN"))       sendSplashStatus("Loading face detector…", null);
    if (line.includes("Loading ViT"))         sendSplashStatus("Loading gender classifier…", null);
    if (line.includes("Loading ResNet"))      sendSplashStatus("Loading animal classifier…", null);
    if (line.includes("All models ready"))    sendSplashStatus("Models ready — launching…", "#22c55e");
    if (line.includes("Application startup")) sendSplashStatus("Starting server…", null);
  });

  backendProc.stderr.on("data", (d) => {
    const line = d.toString().trim();
    if (line) console.error("[PY-ERR]", line);
  });

  backendProc.on("exit", (code, signal) => {
    console.log(`[backend] Exited: code=${code} signal=${signal}`);
    if (code !== 0 && code !== null && !app.isQuitting && !mainWin) {
      dialog.showErrorBox("VisionIQ — Backend Crashed",
        `The AI backend stopped unexpectedly (exit code ${code}).\n\nPlease restart the application.`);
      app.quit();
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

  function check() {
    const req = http.get(HEALTH_URL, (res) => {
      let body = "";
      res.on("data", (c) => { body += c; });
      res.on("end", () => {
        try {
          const data = JSON.parse(body);
          if (splashWin && !splashWin.isDestroyed())
            splashWin.webContents.send("backend-status", data);
          if (data.models_loaded) { clearTimeout(pollTimer); onReady(); }
          else scheduleNext();
        } catch (_) { scheduleNext(); }
      });
    });
    req.on("error", () => scheduleNext());
    req.setTimeout(3000, () => { req.destroy(); scheduleNext(); });
  }

  function scheduleNext() {
    if (Date.now() > deadline) { onTimeout(); return; }
    pollTimer = setTimeout(check, POLL_INTERVAL);
  }

  pollTimer = setTimeout(check, 2000);
}

// ── kill backend ──────────────────────────────────────────────────────────────
function killBackend() {
  if (!backendProc) return;
  try { backendProc.kill("SIGTERM"); } catch (_) {}
  if (process.platform === "win32" && backendProc.pid) {
    try { execSync(`taskkill /PID ${backendProc.pid} /F /T`, { stdio: "ignore" }); } catch (_) {}
  }
  backendProc = null;
}

// ── lifecycle ─────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createSplash();
  sendSplashStatus("Starting AI backend…", null);
  startBackend();

  pollHealth(
    () => createMainWindow(),
    () => {
      if (splashWin && !splashWin.isDestroyed()) splashWin.close();
      const choice = dialog.showMessageBoxSync({
        type: "warning",
        title: "VisionIQ — Slow Start",
        message: "Models are still loading (taking longer than 5 minutes).",
        detail: "This can happen on the very first run.\nOpen the app anyway?",
        buttons: ["Open Anyway", "Quit"],
        defaultId: 0,
      });
      if (choice === 0) createMainWindow();
      else app.quit();
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

ipcMain.handle("get-app-version", () => app.getVersion());
ipcMain.handle("open-external",   (_, url) => shell.openExternal(url));
