import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "./ThemeContext.jsx";
import Sidebar from "./components/Sidebar.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";
import ModelStatusPage from "./pages/ModelStatusPage.jsx";

const API_BASE = "";

const PAGE_TITLES = {
  dashboard:    { title: "Image Recognition Dashboard", sub: "Detects: Male · Female · Animal" },
  upload:       { title: "Upload Image",                sub: "Drag & drop or click to select" },
  history:      { title: "Recent Analyses",             sub: "All your saved predictions" },
  "model-status": { title: "Model Status",              sub: "Performance metrics & architecture" },
};

export default function App() {
  const { theme, toggle } = useTheme();
  const [health, setHealth]         = useState(null);
  const [page, setPage]             = useState("dashboard");

  // prediction
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState(null);
  const [processingMs, setProcessingMs] = useState(null);
  const [highlightIndex, setHighlightIndex] = useState(null);

  // history (in-memory for current session + DB-backed)
  const [sessionHistory, setSessionHistory] = useState([]);

  // time series
  const [timeSeries, setTimeSeries] = useState([0,0,0,0,0,0,0,0,0,0]);

  // session stats
  const [stats, setStats] = useState({ totalAnalyses: 0, imagesProcessed: 0 });

  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ status: "unreachable", models_loaded: false }));
  }, []);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setResult(null);
    setLoading(true);
    setHighlightIndex(null);
    setPage("dashboard");

    const fd = new FormData();
    fd.append("file", file);
    const t0 = performance.now();

    try {
      const res  = await fetch(`${API_BASE}/api/predict`, { method: "POST", body: fd });
      const data = await res.json();
      const ms   = performance.now() - t0;
      setProcessingMs(ms);
      setResult(data);
      setTimeSeries((p) => [...p.slice(-9), +(ms / 1000).toFixed(2)]);
      setStats((s) => ({ totalAnalyses: s.totalAnalyses + 1, imagesProcessed: s.imagesProcessed + 1 }));

      const label = buildLabel(data);
      setSessionHistory((h) =>
        [{ id: Date.now(), url, label, category: data.category, secs: +(ms/1000).toFixed(2) }]
          .concat(h).slice(0, 50)
      );
    } catch {
      setResult({ category: "error", message: "Could not reach the backend." });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleClear = () => {
    setPreviewUrl(null);
    setResult(null);
    setProcessingMs(null);
    setHighlightIndex(null);
  };

  const handleNav = (id) => {
    setPage(id);
    if (id === "upload") {
      setPage("dashboard");
      handleClear();
    }
  };

  const pageInfo = PAGE_TITLES[page] || PAGE_TITLES.dashboard;

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary text-tx-primary transition-colors duration-300">
      <Sidebar active={page} onNav={handleNav} health={health} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ── Header ── */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-border-subtle bg-bg-secondary/70 backdrop-blur-md shrink-0 transition-colors duration-300">
          <motion.div
            key={page}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-tx-primary leading-tight">
                Welcome back, AI Explorer! 👋
              </h2>
            </div>
            <p className="text-xs text-tx-muted">{pageInfo.sub}</p>
          </motion.div>

          <div className="flex items-center gap-3">
            {/* Theme toggle button */}
            <motion.button
              whileHover={{ scale: 1.07 }}
              whileTap={{ scale: 0.93 }}
              onClick={toggle}
              className="p-2 rounded-xl border border-border-card text-tx-secondary hover:text-tx-primary hover:bg-bg-hover transition-all duration-200"
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </motion.button>

            {/* Model status pill */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
              health?.models_loaded
                ? "border-accent-green/40 text-accent-green bg-accent-green/10"
                : health === null
                  ? "border-border-card text-tx-muted bg-bg-card"
                  : "border-red-500/40 text-red-400 bg-red-500/10"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                health?.models_loaded ? "bg-accent-green animate-pulse" : health === null ? "bg-slate-500" : "bg-red-400"
              }`} />
              {health?.models_loaded ? "Models Active" : health === null ? "Connecting…" : "Models Offline"}
            </div>
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
            >
              {(page === "dashboard" || page === "upload") && (
                <DashboardPage
                  stats={stats}
                  result={result}
                  loading={loading}
                  previewUrl={previewUrl}
                  processingMs={processingMs}
                  highlightIndex={highlightIndex}
                  timeSeries={timeSeries}
                  health={health}
                  onFile={handleFile}
                  onClear={handleClear}
                  onHoverFace={setHighlightIndex}
                />
              )}

              {page === "history" && (
                <HistoryPage />
              )}

              {page === "model-status" && (
                <ModelStatusPage
                  health={health}
                  timeSeries={timeSeries}
                  processingMs={processingMs}
                  result={result}
                  history={sessionHistory}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function buildLabel(data) {
  if (!data) return "Unknown";
  if (data.category === "person") {
    const genders = (data.faces || []).map((f) => f.gender).filter(Boolean);
    if (!genders.length) return "Person";
    const counts = genders.reduce((acc, g) => { acc[g] = (acc[g] || 0) + 1; return acc; }, {});
    return Object.entries(counts).map(([g, n]) => `${n} ${g}`).join(", ");
  }
  if (data.category === "animal") return data.label || "Animal";
  return data.best_guess_label || "Unknown";
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}
