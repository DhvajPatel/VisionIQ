import React from "react";
import { motion } from "framer-motion";

const MODELS = [
  { name: "MTCNN Face Detector",        role: "Face detection",      icon: "🔍" },
  { name: "ViT-B/16 Gender Classifier", role: "Male / Female",       icon: "🧠" },
  { name: "ResNet50 ImageNet",          role: "Animal recognition",  icon: "🐾" },
];

export default function ModelStatusCard({ health }) {
  const loaded  = health?.models_loaded;
  const loading = health?.loading;
  const unknown = health === null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-bg-card to-accent-purple/5 border border-border-card rounded-2xl p-5 flex flex-col gap-4 h-full"
    >
      {/* Animated chip */}
      <div className="flex justify-center">
        <div className="relative w-20 h-20">
          <div className={`absolute inset-2 rounded-2xl blur-xl opacity-30 transition-colors ${loaded ? "bg-accent-purple" : "bg-slate-600"}`} />
          <div className="relative z-10 h-full flex flex-col items-center justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={loaded ? { opacity: [0.6, 1, 0.6] } : {}}
                transition={{ repeat: Infinity, duration: 2, delay: i * 0.4 }}
                className={`w-14 h-2.5 rounded-md border ${
                  loaded
                    ? i === 1 ? "bg-accent-purple/70 border-accent-purple" : "bg-accent-violet/30 border-accent-violet/40"
                    : "bg-slate-700/60 border-slate-600/40"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="text-center">
        <p className="font-semibold text-tx-primary text-sm">AI Model Status</p>
        <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full mt-1 ${
          unknown
            ? "bg-slate-700/50 text-slate-400"
            : loading
              ? "bg-amber-500/15 text-amber-400"
              : loaded
                ? "bg-accent-green/15 text-accent-green"
                : "bg-red-500/15 text-red-400"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            unknown ? "bg-slate-400" : loading ? "bg-amber-400 animate-pulse" : loaded ? "bg-accent-green animate-pulse" : "bg-red-400"
          }`} />
          {unknown ? "Checking…" : loading ? "Loading…" : loaded ? "Active & Ready" : "Offline"}
        </div>
        <p className="text-[11px] text-tx-muted mt-1.5 leading-snug">
          {unknown
            ? "Connecting to backend…"
            : loading
              ? "Downloading model weights (~400 MB)…"
              : loaded
                ? "All 3 models running"
                : health?.error || "Models failed to load"}
        </p>
      </div>

      <div className="space-y-1.5">
        {MODELS.map((m) => (
          <div key={m.name} className="flex items-center gap-2 text-xs">
            <span className="text-sm leading-none shrink-0">{m.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-tx-secondary font-medium truncate">{m.name}</p>
              <p className="text-tx-muted text-[10px] truncate">{m.role}</p>
            </div>
            <motion.span
              initial={{ scale: 0.8 }} animate={{ scale: 1 }}
              className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full ${
                unknown  ? "bg-slate-700 text-slate-400"
                : loading ? "bg-amber-500/15 text-amber-400"
                : loaded  ? "bg-accent-green/15 text-accent-green"
                : "bg-red-500/15 text-red-400"
              }`}
            >
              {unknown ? "…" : loading ? "Loading" : loaded ? "Ready" : "Err"}
            </motion.span>
          </div>
        ))}
      </div>

      {health?.device && (
        <p className="text-[10px] text-center text-tx-muted font-mono">device: {health.device}</p>
      )}
    </motion.div>
  );
}
