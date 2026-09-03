import React from "react";
import { motion } from "framer-motion";
import UploadZone from "../components/UploadZone.jsx";
import ResultsPanel from "../components/ResultsPanel.jsx";
import ConfidenceChart from "../components/ConfidenceChart.jsx";
import ProcessingTimeChart from "../components/ProcessingTimeChart.jsx";
import ModelStatusCard from "../components/ModelStatusCard.jsx";

const fade = (i = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: i * 0.07, duration: 0.35 },
});

export default function DashboardPage({
  stats, result, loading, previewUrl, processingMs,
  highlightIndex, timeSeries, health,
  onFile, onClear, onHoverFace,
}) {
  const bestConf = getBestConf(result);

  const cards = [
    { label: "Total Analyses",   value: stats.totalAnalyses,   icon: <AnalysisIco />,  color: "purple", sub: "this session" },
    { label: "Images Processed", value: stats.imagesProcessed, icon: <ImageIco />,     color: "cyan",   sub: "this session" },
    { label: "Accuracy Rate",    value: bestConf !== null ? `${(bestConf*100).toFixed(1)}%` : "—", icon: <AccIco />, color: "green", sub: result?.category ?? "no result yet" },
    { label: "AI Model Status",  value: health?.models_loaded ? "Active" : "Offline",  icon: <ModelIco />, color: health?.models_loaded ? "green" : "red", sub: health?.device ?? "—" },
  ];

  return (
    <div className="space-y-5">
      {/* Stat cards — 2 cols on mobile, 4 on xl */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        {cards.map((c, i) => (
          <motion.div key={c.label} {...fade(i)}
            className="bg-bg-card border border-border-card rounded-2xl p-3 md:p-4 flex items-center gap-3 md:gap-4 hover:border-accent-purple/40 hover:shadow-glow-sm transition-all duration-300 group"
          >
            <div className={`w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 ${colorBg(c.color)}`}>
              {c.icon}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] md:text-[11px] text-tx-muted truncate">{c.label}</p>
              <p className="text-lg md:text-xl font-bold text-tx-primary font-mono leading-tight">{c.value}</p>
              <p className="text-[10px] text-tx-muted truncate">{c.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Upload + model status — stacked on mobile, side-by-side on lg */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        <motion.div {...fade(4)} className="lg:col-span-2 bg-bg-card rounded-2xl border border-border-card p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-tx-primary">Image Analysis</h3>
            <motion.button
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              onClick={onClear}
              className="text-xs px-3 py-1.5 rounded-full bg-accent-purple/20 text-accent-purple border border-accent-purple/30 hover:bg-accent-purple/30 transition"
            >
              + New Analysis
            </motion.button>
          </div>
          <UploadZone
            previewUrl={previewUrl}
            loading={loading}
            result={result}
            highlightIndex={highlightIndex}
            onFile={onFile}
          />
        </motion.div>

        <motion.div {...fade(5)}>
          <ModelStatusCard health={health} />
        </motion.div>
      </div>

      {/* Results + charts — stacked on mobile, side-by-side on lg */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        <motion.div {...fade(6)} className="lg:col-span-2 bg-bg-card rounded-2xl border border-border-card p-4">
          {/* Category badge */}
          {result && result.category !== "error" && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-semibold text-tx-muted uppercase tracking-wide">Detected:</span>
              {result.category === "person" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-500 border border-blue-500/25">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  Person · {(result.faces||[]).length} face{(result.faces||[]).length !== 1 ? "s" : ""}
                </span>
              )}
              {result.category === "animal" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-500/15 text-green-600 border border-green-500/25">
                  🐾 Animal — {result.label || "—"}
                </span>
              )}
              {result.category === "unknown" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 border border-amber-500/25">
                  ❓ Unknown — {result.best_guess_label || "—"}
                </span>
              )}
            </div>
          )}
          <ResultsPanel result={result} loading={loading} processingMs={processingMs} onHoverFace={onHoverFace} />
        </motion.div>
        <div className="flex flex-col gap-5">
          <motion.div {...fade(7)}><ConfidenceChart result={result} /></motion.div>
          <motion.div {...fade(8)}><ProcessingTimeChart timeSeries={timeSeries} latestMs={processingMs} /></motion.div>
        </div>
      </div>
    </div>
  );
}

function colorBg(c) {
  return {
    purple: "bg-accent-purple/15 text-accent-purple",
    cyan:   "bg-accent-cyan/15 text-accent-cyan",
    green:  "bg-accent-green/15 text-accent-green",
    yellow: "bg-accent-yellow/15 text-accent-yellow",
    red:    "bg-red-500/15 text-red-400",
  }[c] ?? "bg-accent-purple/15 text-accent-purple";
}

function getBestConf(data) {
  if (!data || data.category === "error") return null;
  if (data.category === "person") {
    const c = (data.faces || []).map(f => f.gender_confidence ?? 0);
    return c.length ? Math.max(...c) : null;
  }
  if (data.category === "animal") return data.confidence ?? null;
  return data.best_guess_confidence ?? null;
}

function Ico({ d }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}
function AnalysisIco() { return <Ico d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />; }
function ImageIco()    { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>; }
function AccIco()      { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>; }
function ModelIco()    { return <Ico d="M18 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM9 9h6v6H9z" />; }
