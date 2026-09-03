import React from "react";
import { motion } from "framer-motion";
import ProcessingTimeChart from "../components/ProcessingTimeChart.jsx";
import ConfidenceChart from "../components/ConfidenceChart.jsx";
import TopCategories from "../components/TopCategories.jsx";

const MODELS = [
  { name: "MTCNN Face Detector",                   role: "Detects face bounding boxes",            metric: "Precision",  value: 0.94,  color: "#8b5cf6", weight: null },
  { name: "ViT-B/16 Gender (Primary)",             role: "rizvandwiki/gender-classification",      metric: "Accuracy",   value: 0.91,  color: "#06b6d4", weight: "45%" },
  { name: "ViT-L/16 Gender (Secondary)",           role: "rizvandwiki/gender-classification-2",    metric: "Accuracy",   value: 0.94,  color: "#f59e0b", weight: "40%" },
  { name: "SigLIP2-Mini Gender (Tertiary)",        role: "prithivMLmods/Gender-Classifier-Mini",   metric: "Accuracy",   value: 0.93,  color: "#ec4899", weight: "15%" },
  { name: "ResNet50 ImageNet",                     role: "Animal & object recognition fallback",   metric: "Top-1 Acc",  value: 0.803, color: "#22c55e", weight: null },
];

export default function ModelStatusPage({ health, timeSeries, processingMs, result, history }) {
  const loaded = health?.models_loaded;

  return (
    <div className="space-y-5">
      {/* Page header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-lg font-bold text-tx-primary">Model Status</h2>
        <p className="text-xs text-tx-muted mt-0.5">Performance metrics and architecture overview</p>
      </motion.div>

      {/* Status banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
        className={`rounded-2xl border p-4 flex items-center gap-4 ${
          loaded
            ? "border-accent-green/30 bg-accent-green/5"
            : "border-red-500/30 bg-red-500/5"
        }`}
      >
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${loaded ? "bg-accent-green/20" : "bg-red-500/20"}`}>
          <span className={`w-3 h-3 rounded-full ${loaded ? "bg-accent-green animate-pulse" : "bg-red-400"}`} />
        </div>
        <div>
          <p className={`font-semibold ${loaded ? "text-accent-green" : "text-red-400"}`}>
            {loaded ? "All Systems Operational" : "Models Offline"}
          </p>
          <p className="text-xs text-tx-muted">
            {loaded ? `Running on ${health?.device ?? "CPU"} · 4 models active` : health?.error ?? "Backend unreachable"}
          </p>
        </div>
      </motion.div>

      {/* Model cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {MODELS.map((m, i) => (
          <motion.div
            key={m.name}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            whileHover={{ y: -2 }}
            className="bg-bg-card border border-border-card rounded-2xl p-4 space-y-3 hover:border-accent-purple/40 transition-all duration-300"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-tx-primary leading-tight">{m.name}</p>
                <p className="text-[11px] text-tx-muted mt-0.5">{m.role}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  loaded ? "bg-accent-green/15 text-accent-green" : "bg-slate-500/20 text-slate-400"
                }`}>
                  {loaded ? "Ready" : "Offline"}
                </span>
                {m.weight && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-accent-purple/15 text-accent-purple border border-accent-purple/20">
                    w={m.weight}
                  </span>
                )}
              </div>
            </div>

            {/* Metric bar */}
            <div>
              <div className="flex justify-between text-[11px] mb-1.5">
                <span className="text-tx-muted">{m.metric}</span>
                <span className="font-mono font-bold" style={{ color: m.color }}>{(m.value * 100).toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full bg-bg-secondary overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${m.value * 100}%` }}
                  transition={{ duration: 0.9, delay: i * 0.08 + 0.2, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(to right, ${m.color}99, ${m.color})` }}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="lg:col-span-2">
          <ProcessingTimeChart timeSeries={timeSeries} latestMs={processingMs} expanded />
        </motion.div>
        <div className="flex flex-col gap-5">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            <ConfidenceChart result={result} />
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
            <TopCategories history={history} />
          </motion.div>
        </div>
      </div>

      {/* Architecture diagram */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
        className="bg-bg-card border border-border-card rounded-2xl p-5"
      >
        <p className="font-semibold text-tx-primary mb-4">Inference Pipeline</p>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { label: "Input Image", color: "#475569" },
            { label: "MTCNN", color: "#8b5cf6" },
            { label: "Face Crops (tight + context)", color: "#475569" },
            { label: "ViT-B + ViT-L + SigLIP2 Ensemble", color: "#06b6d4" },
            { label: "Weighted Vote + Sharpen", color: "#f59e0b" },
            { label: "Gender Result", color: "#22c55e" },
          ].map((step, i, arr) => (
            <React.Fragment key={step.label}>
              <div
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                style={{ background: step.color + "33", border: `1px solid ${step.color}66`, color: step.color }}
              >
                {step.label}
              </div>
              {i < arr.length - 1 && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              )}
            </React.Fragment>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {[
            { label: "No Face Found", color: "#475569" },
            { label: "ResNet50", color: "#22c55e" },
            { label: "Animal / Unknown", color: "#eab308" },
          ].map((step, i, arr) => (
            <React.Fragment key={step.label}>
              <div
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: step.color + "22", border: `1px solid ${step.color}55`, color: step.color }}
              >
                {step.label}
              </div>
              {i < arr.length - 1 && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              )}
            </React.Fragment>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
