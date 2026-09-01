import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function ResultsPanel({ result, loading, processingMs, onHoverFace }) {
  const rows = buildRows(result);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-tx-primary">Recognition Results</h3>
        <div className="flex items-center gap-2 text-xs text-tx-muted">
          <span>Confidence</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Hover hint for person results */}
      {result?.category === "person" && rows.length > 0 && !loading && (
        <p className="text-[11px] text-tx-muted mb-3 flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Hover a row to highlight that person in the image
        </p>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <div className="py-10 flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-bg-secondary border border-border-card flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <p className="text-sm text-tx-secondary">Upload an image to see recognition results</p>
          <p className="text-[11px] text-tx-muted">Supports Male · Female · Animal detection</p>
        </div>
      )}

      {loading && (
        <div className="py-10 flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-accent-purple border-t-transparent animate-spin" />
          <p className="text-sm text-tx-secondary">Processing image…</p>
        </div>
      )}

      {/* Error */}
      {result?.category === "error" && !loading && (
        <div className="py-6 flex items-center gap-3 text-red-400 bg-red-500/10 rounded-xl px-4 border border-red-500/20">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm">{result.message || "Prediction failed."}</p>
        </div>
      )}

      {/* Result rows */}
      <AnimatePresence>
        {rows.length > 0 && !loading && (
          <div className="space-y-2">
            {rows.map((row, i) => (
              <motion.div
                key={row.label + i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07 }}
                onMouseEnter={() => onHoverFace?.(row.faceIndex ?? null)}
                onMouseLeave={() => onHoverFace?.(null)}
                className="group rounded-xl px-3 py-2 hover:bg-bg-secondary/60 transition-colors cursor-default"
              >
                <div className="flex items-center gap-3 mb-1.5">
                  {/* Numbered badge — matches box color on image */}
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white font-bold text-xs select-none"
                    style={{ background: row.badgeColor }}
                  >
                    {row.faceIndex != null ? row.faceIndex + 1 : row.icon}
                  </div>

                  {/* Gender icon */}
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${row.iconBg}`}>
                    {row.icon}
                  </div>

                  <span className="flex-1 text-sm text-tx-primary font-medium">{row.label}</span>

                  <span className={`text-sm font-bold font-mono ${row.pctColor}`}>
                    {(row.confidence * 100).toFixed(1)}%
                  </span>
                </div>

                {/* Confidence bar */}
                <div className="ml-16 h-1.5 rounded-full bg-bg-secondary overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${row.confidence * 100}%` }}
                    transition={{ duration: 0.6, delay: i * 0.07, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ background: row.barGradient }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

function buildRows(result) {
  if (!result || result.category === "error") return [];

  if (result.category === "person") {
    return (result.faces || []).map((f, i) => {
      const isFemale = f.gender === "Female";
      return {
        faceIndex:    i,
        label:        `Person ${i + 1} — ${f.gender || "Unknown"}`,
        confidence:   f.gender_confidence ?? f.face_confidence ?? 0.9,
        icon:         isFemale ? <FemaleIcon /> : <MaleIcon />,
        iconBg:       isFemale ? "bg-pink-500/20 text-pink-400" : "bg-blue-500/20 text-blue-400",
        pctColor:     isFemale ? "text-pink-400" : "text-blue-400",
        barGradient:  isFemale
          ? "linear-gradient(to right, #ec4899, #f472b6)"
          : "linear-gradient(to right, #3b82f6, #22d3ee)",
        badgeColor:   isFemale ? "#ec4899" : "#3b82f6",
      };
    });
  }

  if (result.category === "animal") {
    return [{
      faceIndex:   null,
      label:       result.label || "Animal",
      confidence:  result.confidence ?? 0.9,
      icon:        <PawIcon />,
      iconBg:      "bg-accent-green/20 text-accent-green",
      pctColor:    "text-accent-green",
      barGradient: "linear-gradient(to right, #22c55e, #34d399)",
      badgeColor:  "#22c55e",
    }];
  }

  if (result.category === "unknown") {
    return [{
      faceIndex:   null,
      label:       result.best_guess_label || "Unknown",
      confidence:  result.best_guess_confidence ?? 0.5,
      icon:        <QuestionIcon />,
      iconBg:      "bg-slate-500/20 text-slate-400",
      pctColor:    "text-slate-400",
      barGradient: "linear-gradient(to right, #64748b, #94a3b8)",
      badgeColor:  "#64748b",
    }];
  }
  return [];
}

// ── icons ─────────────────────────────────────────────────────────────────────

function MaleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="14" r="5"/><line x1="19" y1="5" x2="14.14" y2="9.86"/><polyline points="15 5 19 5 19 9"/>
    </svg>
  );
}
function FemaleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="9" r="5"/><line x1="12" y1="14" x2="12" y2="21"/><line x1="9" y1="18" x2="15" y2="18"/>
    </svg>
  );
}
function PawIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="7" cy="4" r="2" opacity=".5"/><circle cx="17" cy="4" r="2" opacity=".5"/>
      <circle cx="4" cy="10" r="2" opacity=".5"/><circle cx="20" cy="10" r="2" opacity=".5"/>
      <path d="M12 14c-5 0-8 3-8 5 0 1.5 1.5 2 3 2 2 0 4-1 5-1s3 1 5 1c1.5 0 3-.5 3-2 0-2-3-5-8-5z"/>
    </svg>
  );
}
function QuestionIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}
