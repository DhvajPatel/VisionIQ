import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "./ThemeContext.jsx";
import Sidebar from "./components/Sidebar.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";
import ModelStatusPage from "./pages/ModelStatusPage.jsx";

const API_BASE = "";

const PAGE_TITLES = {
  dashboard:      { sub: "Detects: Male · Female · Animal" },
  upload:         { sub: "Drag & drop or click to select" },
  history:        { sub: "All your saved predictions" },
  "model-status": { sub: "Performance metrics & architecture" },
};

export default function App() {
  const { theme, toggle } = useTheme();
  const [health, setHealth]             = useState(null);
  const [page, setPage]                 = useState("dashboard");
  const [sidebarOpen, setSidebarOpen]   = useState(false);

  // prediction state
  const [previewUrl, setPreviewUrl]         = useState(null);
  const [loading, setLoading]               = useState(false);
  const [result, setResult]                 = useState(null);
  const [processingMs, setProcessingMs]     = useState(null);
  const [highlightIndex, setHighlightIndex] = useState(null);

  const [sessionHistory, setSessionHistory] = useState([]);
  const [timeSeries, setTimeSeries]         = useState([0,0,0,0,0,0,0,0,0,0]);
  const [stats, setStats]                   = useState({ totalAnalyses: 0, imagesProcessed: 0 });

  // ── health polling ────────────────────────────────────────────────────────
  useEffect(() => {
    let timer;
    const checkHealth = () => {
      const controller = new AbortController();
      const tId = setTimeout(() => controller.abort(), 60000);
      fetch(`${API_BASE}/api/health`, { signal: controller.signal })
        .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then((data) => {
          clearTimeout(tId);
          setHealth(data);
          timer = setTimeout(checkHealth, data.models_loaded ? 30000 : 5000);
        })
        .catch(() => {
          clearTimeout(tId);
          setHealth((prev) => prev ?? { status: "unreachable", models_loaded: false });
          timer = setTimeout(checkHealth, 8000);
        });
    };
    checkHealth();
    return () => clearTimeout(timer);
  }, []);

  // ── predict ───────────────────────────────────────────────────────────────
  const handleFile = useCallback(async (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setResult(null);
    setLoading(true);
    setHighlightIndex(null);
    setPage("dashboard");
    setSidebarOpen(false);

    const fd = new FormData();
    fd.append("file", file);
    const t0 = performance.now();
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 180_000);

    try {
      const res  = await fetch(`${API_BASE}/api/predict`, { method: "POST", body: fd, signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (!res.ok) {
        setResult({ category: "error", message: data?.detail || `Server error ${res.status}` });
      } else {
        const ms = performance.now() - t0;
        setProcessingMs(ms);
        setResult(data);
        setTimeSeries((p) => [...p.slice(-9), +(ms / 1000).toFixed(2)]);
        setStats((s) => ({ totalAnalyses: s.totalAnalyses + 1, imagesProcessed: s.imagesProcessed + 1 }));
        const label = buildLabel(data);
        setSessionHistory((h) =>
          [{ id: Date.now(), url, label, category: data.category, secs: +(ms/1000).toFixed(2) }]
            .concat(h).slice(0, 50)
        );
      }
    } catch (err) {
      clearTimeout(timeoutId);
      setResult({
        category: "error",
        message: err.name === "AbortError"
          ? "Request timed out — too many faces for CPU processing."
          : "Could not reach the backend.",
      });
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
    setPage(id === "upload" ? "dashboard" : id);
    if (id === "upload") handleClear();
    setSidebarOpen(false);
  };

  const pageInfo = PAGE_TITLES[page] || PAGE_TITLES.dashboard;

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary text-tx-primary transition-colors duration-300">

      {/* ── Mobile sidebar backdrop ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/60 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar — hidden on mobile unless open ── */}
      <div className={`
        fixed inset-y-0 left-0 z-40 md:static md:z-auto md:flex md:flex-col
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        <Sidebar active={page} onNav={handleNav} health={health} onClose={() => setSidebarOpen(false)} />
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* ── Header ── */}
        <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border-subtle bg-bg-secondary/70 backdrop-blur-md shrink-0 transition-colors duration-300">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger — mobile only */}
            <button
              className="md:hidden p-2 rounded-xl border border-border-card text-tx-secondary hover:bg-bg-hover transition"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <HamburgerIcon />
            </button>

            <motion.div
              key={page}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="min-w-0"
            >
              <h2 className="text-sm md:text-base font-bold text-tx-primary leading-tight truncate">
                Welcome back, AI Explorer! 👋
              </h2>
              <p className="text-xs text-tx-muted truncate">{pageInfo.sub}</p>
            </motion.div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Theme toggle */}
            <motion.button
              whileHover={{ scale: 1.07 }} whileTap={{ scale: 0.93 }}
              onClick={toggle}
              className="p-2 rounded-xl border border-border-card text-tx-secondary hover:text-tx-primary hover:bg-bg-hover transition-all duration-200"
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </motion.button>

            {/* Model status pill */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all ${
              health?.models_loaded
                ? "border-accent-green/40 text-accent-green bg-accent-green/10"
                : health === null
                  ? "border-border-card text-tx-muted bg-bg-card"
                  : "border-red-500/40 text-red-400 bg-red-500/10"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                health?.models_loaded ? "bg-accent-green animate-pulse"
                  : health === null   ? "bg-slate-500"
                  : "bg-red-400"
              }`} />
              <span className="hidden sm:inline">
                {health?.models_loaded ? "Models Active"
                  : health === null   ? "Connecting…"
                  : "Offline"}
              </span>
            </div>
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 overflow-y-auto px-3 md:px-6 py-4 md:py-5">
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
              {page === "history" && <HistoryPage />}
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

function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6"  x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );
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
