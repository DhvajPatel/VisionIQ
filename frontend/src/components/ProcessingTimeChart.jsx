import React from "react";
import { motion } from "framer-motion";

export default function ProcessingTimeChart({ timeSeries, latestMs, expanded }) {
  const latest = latestMs ? (latestMs / 1000).toFixed(2) : "—";
  const series = timeSeries.filter((v) => v > 0);
  const max    = Math.max(...timeSeries, 2);
  const avg    = series.length ? (series.reduce((a, b) => a + b, 0) / series.length).toFixed(2) : null;

  const W = 260, H = expanded ? 90 : 60, PAD = 4;
  const pts = timeSeries.map((v, i) => {
    const x = PAD + (i / (timeSeries.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((v / max) * (H - PAD * 2));
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const polyline  = pts.join(" ");
  const fillPts   = `${pts[0].split(",")[0]},${H} ${polyline} ${pts[pts.length - 1].split(",")[0]},${H}`;

  return (
    <div className="bg-bg-card border border-border-card rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold text-tx-primary text-sm">Processing Time</p>
        <div className="flex items-center gap-2">
          {avg && <span className="text-[11px] text-tx-muted font-mono">avg {avg}s</span>}
          <span className="text-sm text-tx-primary font-bold font-mono">{latest}s</span>
        </div>
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="overflow-visible">
        <defs>
          <linearGradient id="tgrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={fillPts} fill="url(#tgrad)" />
        <polyline points={polyline} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {timeSeries.map((v, i) => {
          const x = PAD + (i / (timeSeries.length - 1)) * (W - PAD * 2);
          const y = H - PAD - ((v / max) * (H - PAD * 2));
          return (
            <motion.circle
              key={i}
              cx={x} cy={y}
              r={i === timeSeries.length - 1 ? 3.5 : 2}
              fill={i === timeSeries.length - 1 ? "#8b5cf6" : "#8b5cf680"}
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ delay: i * 0.05 }}
            />
          );
        })}
      </svg>

      <div className="flex justify-between text-[9px] text-tx-muted font-mono mt-1">
        {["0s", "0.5s", "1s", "1.5s", "2s+"].map((l) => <span key={l}>{l}</span>)}
      </div>
    </div>
  );
}
