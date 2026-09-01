import React from "react";
import { motion } from "framer-motion";

const SEGMENTS = [
  { label: "90-100%", pct: 65.2, color: "#22c55e" },
  { label: "70-90%",  pct: 24.1, color: "#06b6d4" },
  { label: "50-70%",  pct: 8.7,  color: "#eab308" },
  { label: "0-50%",   pct: 2.0,  color: "#ef4444" },
];

export default function ConfidenceChart({ result }) {
  const overall = result ? (getOverallConf(result) * 100).toFixed(1) : "—";

  return (
    <div className="bg-bg-card border border-border-card rounded-2xl p-4">
      <p className="font-semibold text-tx-primary text-sm mb-4">Confidence Distribution</p>
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <svg width="90" height="90" viewBox="0 0 90 90">
            <DonutArcs />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-sm font-bold text-tx-primary leading-none">{overall}{overall !== "—" ? "%" : ""}</p>
            <p className="text-[9px] text-tx-muted">Overall</p>
          </div>
        </div>
        <div className="space-y-1.5 flex-1">
          {SEGMENTS.map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="text-tx-secondary">{s.label}</span>
              </div>
              <span className="text-tx-primary font-mono">{s.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DonutArcs() {
  const cx = 45, cy = 45, r = 32, stroke = 12;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-secondary)" strokeWidth={stroke} />
      {SEGMENTS.map((s) => {
        const len = (s.pct / 100) * circ;
        const gap = circ - len;
        const arc = (
          <motion.circle
            key={s.label}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={`${len} ${gap}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            initial={{ strokeDashoffset: circ - offset }}
            animate={{ strokeDashoffset: -offset }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        );
        offset += len;
        return arc;
      })}
    </>
  );
}

function getOverallConf(result) {
  if (!result || result.category === "error") return 0;
  if (result.category === "person") {
    const c = (result.faces || []).map((f) => f.gender_confidence ?? 0);
    return c.length ? c.reduce((a, b) => a + b, 0) / c.length : 0;
  }
  if (result.category === "animal") return result.confidence ?? 0;
  return result.best_guess_confidence ?? 0;
}
