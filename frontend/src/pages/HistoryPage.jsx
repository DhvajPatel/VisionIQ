import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Works in both Electron (window.electronAPI.apiBase = "http://127.0.0.1:8000")
// and browser dev mode (empty string → relative URL via Vite proxy)
const API_BASE = window.electronAPI?.apiBase ?? "";

const CATEGORY_COLOR = {
  person:  { bg: "bg-blue-500/20",  text: "text-blue-500",  label: "Person"  },
  animal:  { bg: "bg-green-500/20", text: "text-green-600", label: "Animal"  },
  unknown: { bg: "bg-amber-500/20", text: "text-amber-600", label: "Unknown" },
};

export default function HistoryPage() {
  const [entries, setEntries]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [clearing, setClearing] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_BASE}/api/history?limit=100`);
      if (!r.ok) throw new Error(`Server returned ${r.status}`);
      const d = await r.json();
      setEntries(Array.isArray(d) ? d : []);
    } catch (e) {
      setError(e.message || "Could not load history. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const clearAll = async () => {
    if (!window.confirm("Clear all analysis history? This cannot be undone.")) return;
    setClearing(true);
    try {
      await fetch(`${API_BASE}/api/history`, { method: "DELETE" });
      setEntries([]);
      setSelected(null);
    } catch {
      alert("Failed to clear history. Check backend connection.");
    }
    setClearing(false);
  };

  const deleteOne = async (id) => {
    try {
      await fetch(`${API_BASE}/api/history/${id}`, { method: "DELETE" });
      setEntries((e) => e.filter((x) => x.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch {
      alert("Failed to delete entry.");
    }
  };

  const cats = entries.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-5 pb-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between flex-wrap gap-3"
      >
        <div>
          <h2 className="text-lg font-bold text-tx-primary">Recent Analyses</h2>
          <p className="text-xs text-tx-muted mt-0.5">
            {loading ? "Loading…" : error ? "Backend offline" : `${entries.length} saved · ${cats.person || 0} person · ${cats.animal || 0} animal`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={load}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-border-card bg-bg-card text-tx-secondary hover:text-tx-primary hover:bg-bg-hover transition"
          >
            <RefreshIco /> Refresh
          </motion.button>
          {entries.length > 0 && (
            <motion.button
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              onClick={clearAll}
              disabled={clearing}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-red-500/30 text-red-500 hover:bg-red-500/10 transition disabled:opacity-50"
            >
              <TrashIco /> {clearing ? "Clearing…" : "Clear History"}
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* Error banner */}
      {error && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 bg-red-500/10 border border-red-500/25 rounded-2xl px-4 py-3"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div>
            <p className="text-sm font-semibold text-red-500">Backend not reachable</p>
            <p className="text-xs text-tx-muted mt-0.5">{error}</p>
            <p className="text-xs text-tx-muted mt-1">
              The backend is starting up — please wait a moment and click Refresh.
            </p>
          </div>
        </motion.div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden border border-border-card bg-bg-card">
              <div className="aspect-square skeleton" />
              <div className="p-3 space-y-1.5">
                <div className="h-3 rounded-lg skeleton w-3/4" />
                <div className="h-2.5 rounded-lg skeleton w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && entries.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="py-20 flex flex-col items-center gap-4 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-bg-card border border-border-card flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
            </svg>
          </div>
          <p className="text-tx-secondary font-semibold">No analyses yet</p>
          <p className="text-sm text-tx-muted">Upload an image on the Dashboard to get started.</p>
        </motion.div>
      )}

      {/* Entries grid + detail panel */}
      {!loading && !error && entries.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Card grid */}
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4 content-start">
            <AnimatePresence>
              {entries.map((entry, i) => {
                const cc = CATEGORY_COLOR[entry.category] || CATEGORY_COLOR.unknown;
                const isSelected = selected?.id === entry.id;
                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.88 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3) }}
                    whileHover={{ y: -3 }}
                    onClick={() => setSelected(isSelected ? null : entry)}
                    className={`rounded-2xl overflow-hidden border cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? "border-accent-purple ring-1 ring-accent-purple/30 shadow-glow"
                        : "border-border-card hover:border-accent-purple/50 bg-bg-card"
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-square bg-bg-secondary overflow-hidden relative">
                      {entry.image_b64 ? (
                        <img
                          src={`data:image/jpeg;base64,${entry.image_b64}`}
                          alt={entry.label}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-tx-muted">
                          <ImagePlaceholderIco />
                        </div>
                      )}
                      {/* Category badge */}
                      <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm ${cc.bg} ${cc.text}`}>
                        {cc.label}
                      </span>
                      {/* Number badge */}
                      <span className="absolute top-2 right-2 text-[9px] font-mono bg-black/50 text-white px-1.5 py-0.5 rounded-full">
                        #{entry.id}
                      </span>
                    </div>

                    {/* Footer */}
                    <div className="p-2.5 bg-bg-card">
                      <p className="text-xs font-semibold text-tx-primary truncate">{entry.label}</p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[10px] text-tx-muted">{timeAgo(entry.ts)}</p>
                        {entry.proc_ms != null && (
                          <p className="text-[10px] font-mono text-accent-purple">{(entry.proc_ms / 1000).toFixed(2)}s</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Detail panel */}
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-bg-card rounded-2xl border border-border-card p-4 space-y-4 h-fit sticky top-4"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-tx-primary text-sm">Analysis Detail</h3>
                  <div className="flex gap-1">
                    <motion.button
                      whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                      onClick={() => deleteOne(selected.id)}
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition"
                      title="Delete this entry"
                    >
                      <TrashIco />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                      onClick={() => setSelected(null)}
                      className="p-1.5 rounded-lg text-tx-muted hover:bg-bg-hover transition"
                    >
                      <CloseIco />
                    </motion.button>
                  </div>
                </div>

                {/* Image */}
                {selected.image_b64 && (
                  <img
                    src={`data:image/jpeg;base64,${selected.image_b64}`}
                    alt={selected.label}
                    className="w-full rounded-xl object-contain max-h-48 bg-bg-secondary"
                  />
                )}

                {/* Meta rows */}
                <div className="space-y-2 bg-bg-secondary rounded-xl p-3">
                  <Row label="Category"   value={<CategoryChip cat={selected.category} />} />
                  <Row label="Label"      value={selected.label} />
                  <Row label="Date"       value={new Date(selected.ts * 1000).toLocaleString()} />
                  {selected.proc_ms != null && (
                    <Row label="Processing" value={`${(selected.proc_ms / 1000).toFixed(2)}s`} mono />
                  )}
                </div>

                {/* Person face list */}
                {selected.result?.category === "person" && (selected.result.faces || []).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-tx-muted uppercase tracking-widest">Detected Faces</p>
                    {(selected.result.faces || []).map((f, i) => (
                      <div key={i} className="flex items-center justify-between bg-bg-secondary rounded-xl px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold text-white ${f.gender === "Female" ? "bg-pink-500" : "bg-blue-500"}`}>
                            {i + 1}
                          </span>
                          <span className="text-xs text-tx-primary font-medium">{f.gender || "Unknown"}</span>
                        </div>
                        <span className={`text-xs font-mono font-bold ${f.gender === "Female" ? "text-pink-500" : "text-blue-500"}`}>
                          {f.gender_confidence != null ? `${(f.gender_confidence * 100).toFixed(1)}%` : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Animal detail */}
                {selected.result?.category === "animal" && (
                  <div className="flex items-center justify-between bg-bg-secondary rounded-xl px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🐾</span>
                      <span className="text-xs text-tx-primary font-medium">{selected.result.label || "Animal"}</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-accent-green">
                      {selected.result.confidence != null ? `${(selected.result.confidence * 100).toFixed(1)}%` : "—"}
                    </span>
                  </div>
                )}

                {/* Unknown detail */}
                {selected.result?.category === "unknown" && (
                  <div className="flex items-center justify-between bg-bg-secondary rounded-xl px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">❓</span>
                      <span className="text-xs text-tx-primary font-medium">{selected.result.best_guess_label || "Unknown"}</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-amber-500">
                      {selected.result.best_guess_confidence != null ? `${(selected.result.best_guess_confidence * 100).toFixed(1)}%` : "—"}
                    </span>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="empty-panel"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="bg-bg-card rounded-2xl border border-dashed border-border-card p-10 flex flex-col items-center justify-center gap-3 text-center"
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-tx-muted opacity-50">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
                <p className="text-sm text-tx-muted">Click a card to see details</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

function CategoryChip({ cat }) {
  const cc = CATEGORY_COLOR[cat] || CATEGORY_COLOR.unknown;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${cc.bg} ${cc.text}`}>
      {cc.label}
    </span>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="text-tx-muted shrink-0">{label}</span>
      <span className={`text-tx-primary font-medium text-right break-all ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function timeAgo(ts) {
  const d = Date.now() / 1000 - ts;
  if (d < 60)    return "just now";
  if (d < 3600)  return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

/* ── icons ───────────────────────────────────────────────────────────────── */
function RefreshIco() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>;
}
function TrashIco() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;
}
function CloseIco() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}
function ImagePlaceholderIco() {
  return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
}
