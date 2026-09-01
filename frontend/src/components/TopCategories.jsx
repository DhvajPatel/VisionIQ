import React from "react";
import { motion } from "framer-motion";

const DEFAULT = [
  { label: "People",   value: 0, color: "#06b6d4", icon: "👤" },
  { label: "Animals",  value: 0, color: "#8b5cf6", icon: "🐾" },
  { label: "Unknown",  value: 0, color: "#64748b", icon: "❓" },
];

function buildCats(history) {
  const counts = {};
  history.forEach((h) => { counts[h.category] = (counts[h.category] || 0) + 1; });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, val]) => ({
      label: cat.charAt(0).toUpperCase() + cat.slice(1),
      value: val,
      color: cat === "person" ? "#06b6d4" : cat === "animal" ? "#8b5cf6" : "#64748b",
      icon:  cat === "person" ? "👤" : cat === "animal" ? "🐾" : "❓",
    }));
}

export default function TopCategories({ history }) {
  const cats   = history?.length > 0 ? buildCats(history) : DEFAULT;
  const maxVal = Math.max(...cats.map((c) => c.value), 1);

  return (
    <div className="bg-bg-card border border-border-card rounded-2xl p-4">
      <p className="font-semibold text-tx-primary text-sm mb-4">Top Categories</p>
      <div className="space-y-3">
        {cats.slice(0, 5).map((cat, i) => (
          <motion.div
            key={cat.label}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.07 }}
            className="flex items-center gap-3"
          >
            <span className="text-base shrink-0">{cat.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between mb-1">
                <span className="text-xs text-tx-secondary">{cat.label}</span>
                <span className="text-xs font-mono text-tx-muted">{cat.value}</span>
              </div>
              <div className="h-1.5 rounded-full bg-bg-secondary overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(cat.value / maxVal) * 100}%` }}
                  transition={{ duration: 0.7, delay: i * 0.07 }}
                  className="h-full rounded-full"
                  style={{ background: cat.color }}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
