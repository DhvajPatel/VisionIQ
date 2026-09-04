/**
 * main.js — VisionIQ Electron Main Process  v2.1.0
 */

const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path   = require("path");
const fs     = require("fs");
const http   = require("http");
const { spawn, execSync } = require("child_process");

const BACKEND_PORT    = 8000;
const BACKEND_HOST    = "127.0.0.1";
const HEALTH_URL      = `http://${BACKEND_HOST}:${BACKEND_PORT}/api/health`;
const POLL_INTERVAL   = 2000;
const STARTUP_TIMEOUT = 300000;

const isDev = !app.isPackaged;

// ── Path resolution ───────────────────────────────────────────────────────────
//
// Confirmed installed layout (dist-electron/win-unpacked/resources/):
//   app.asar          ← contains: main.js, preload.js, splash.html, dist/**
//   backend/          ← visioniq_server.exe  (extraResources)
//   frontend/dist/    ← duplicate copy of dist (extraResources)
//
// app.getAppPath() returns the path to app.asar (or the app folder in dev).
// Files INSIDE asar are accessed via app.getAppPath() + relative path.

function getAppDir() {
  return isDev ? __dirname : app.getAppPath();
}

function getFrontendIndex() {
  // dist/index.html is inside the asar at the root level
  const insideAsar = path.join(getAppDir(), "dist", "index.html");
  if (fs.existsSync(insideAsar)) return insideAsar;
  // Fallback: extraResources copy
  const extra = path.join(process.resourcesPath, "frontend", "dist", "index.html");
  if (fs.existsSync(extra)) return extra;
  return insideAsar; // return even if missing — will show error dialog
}

function getPreloadPath() {
  return path.join(getAppDir(), "preload.js");
}

function getSplashPath() {
  return path.join(getAppDir(), "splash.html");
}

function getIconPath() {
  const p = path.join(getAppDir(), "dist", "icon.ico");
  return fs.existsSync(p) ? p : undefined;
}

function getBackendExe() {
  if (isDev) {
    const devExe = path.join(__dirname, "..", "backend", "dist", "visioniq_server", "visioniq_server.exe");
    if (fs.existsSync(devExe)) return { exe: devExe, cwd: path.dirname(devExe) };
    return null;
  }
  const exe = path.join(process.resourcesPath, "backend", "visioniq_server.exe");
  return { exe, cwd: path.dirname(exe) };
}

// ── Globals ───────────────────────────────────────────────────────────────────
let splashWin   = null;
let mainWin     = null;
let backendProc = null;
let pollTimer   = null;

// ── Splash ────────────────────────────────────────────────────────────────────
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

// ── Main window ───────────────────────────────────────────────────────────────
function createMainWindow() {
  const indexPath = getFrontendIndex();
  console.log("[main] index.html path:", indexPath);
  console.log("[main] exists:", fs.existsSync(indexPath));
  console.log("[main] app.getAppPath():", app.getAppPath());
  console.log("[main] process.resourcesPath:", process.resourcesPath);

  if (!fs.existsSync(indexPath)) {
    dialog.showErrorBox("VisionIQ — Missing UI",
      `Cannot find index.html at:\n${indexPath}\n\nPlease reinstall.`);
    app.quit();
    return;
  }

  mainWin = new BrowserWindow({
    width: 1280, height: 800, minWidth: 800, minHeight: 600,
    show: false,
    title: "VisionIQ — AI Vision",
    icon: getIconPath(),
    webPreferences: {
      preload: getPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

  mainWin.loadFile(indexPath)
    .then(() => console.log("[main] loadFile succeeded"))
    .catch((err) => {
      console.error("[main] loadFile error:", err.message);
      // Fallback to URL
      const url = `file:///${indexPath.replace(/\\/g, "/")}`;
      console.log("[main] Trying loadURL:", url);
      mainWin.loadURL(url);
    });

  mainWin.webContents.on("did-fail-load", (e, code, desc, url) => {
    console.error("[main] did-fail-load:", code, desc, url);
  });

  mainWin.once("ready-to-show", () => {
    if (splashWin && !splashWin.isDestroyed()) splashWin.close();
    mainWin.show();
    mainWin.focus();
  });

  mainWin.on("closed", () => { mainWin = null; });
  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

// ── Backend ───────────────────────────────────────────────────────────────────
function startBackend() {
  const result = getBackendExe();
  if (!result) {
    // Dev fallback
    const cwd = path.join(__dirname, "..", "backend");
    backendProc = spawn("python", ["app.py"], { cwd, stdio: "pipe", windowsHide: true });
  } else {
    const { exe, cwd } = result;
    console.log("[backend] exe:", exe);
    if (!fs.existsSync(exe)) {
      dialog.showErrorBox("VisionIQ — Backend Missing", `Not found:\n${exe}\n\nPlease reinstall.`);
      app.quit(); return;
    }
    backendProc = spawn(exe, [], { cwd, stdio: "pipe", windowsHide: true });
  }

  backendProc.stdout.on("data", (d) => {
    const line = d.toString().trim();
    console.log("[PY]", line);
    if (line.includes("Loading MTCNN"))       sendSplashStatus("Loading face detector…", null);
    if (line.includes("Loading ViT"))         sendSplashStatus("Loading gender classifier…", null);
    if (line.includes("Loading ResNet"))      sendSplashStatus("Loading animal classifier…", null);
    if (line.includes("All models ready"))    sendSplashStatus("Models ready — launching…", "#22c55e");
  });
  backendProc.stderr.on("data", (d) => console.error("[PY-ERR]", d.toString().trim()));
  backendProc.on("exit", (code) => {
    console.log("[backend] exit:", code);
    if (code !== 0 && code !== null && !app.isQuitting && !mainWin) {
      dialog.showErrorBox("VisionIQ — Backend Crashed",
        `Exit code ${code}.\n\nPlease restart the application.`);
      app.quit();
    }
  });
  backendProc.on("error", (err) => {
    console.error("[backend] spawn error:", err.message);
    dialog.showErrorBox("VisionIQ — Launch Error", err.message);
    app.quit();
  });
}

// ── Health polling ────────────────────────────────────────────────────────────
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
          else next();
        } catch (_) { next(); }
      });
    });
    req.on("error", () => next());
    req.setTimeout(3000, () => { req.destroy(); next(); });
  }
  function next() {
    if (Date.now() > deadline) { onTimeout(); return; }
    pollTimer = setTimeout(check, POLL_INTERVAL);
  }
  pollTimer = setTimeout(check, 2000);
}

function killBackend() {
  if (!backendProc) return;
  try { backendProc.kill("SIGTERM"); } catch (_) {}
  if (process.platform === "win32" && backendProc.pid) {
    try { execSync(`taskkill /PID ${backendProc.pid} /F /T`, { stdio: "ignore" }); } catch (_) {}
  }
  backendProc = null;
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createSplash();
  sendSplashStatus("Starting AI backend…", null);
  startBackend();

  pollHealth(
    () => createMainWindow(),
    () => {
      if (splashWin && !splashWin.isDestroyed()) splashWin.close();
      const choice = dialog.showMessageBoxSync({
        type: "warning", title: "VisionIQ — Slow Start",
        message: "Models still loading (5+ minutes).",
        detail: "Open the app anyway?",
        buttons: ["Open Anyway", "Quit"], defaultId: 0,
      });
      if (choice === 0) createMainWindow(); else app.quit();
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
ipcMain.handle("open-external", (_, url) => shell.openExternal(url));
