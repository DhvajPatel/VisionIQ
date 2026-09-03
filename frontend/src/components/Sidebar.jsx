import React from "react";
import { motion } from "framer-motion";

const NAV = [
  {
    section: "ANALYSIS",
    items: [
      { id: "dashboard",    label: "Dashboard",       icon: GridIcon },
      { id: "upload",       label: "Upload Image",    icon: UploadIcon },
    ],
  },
  {
    section: "HISTORY",
    items: [
      { id: "history",      label: "Recent Analyses", icon: ClockIcon },
    ],
  },
  {
    section: "AI MODELS",
    items: [
      { id: "model-status", label: "Model Status",    icon: CpuIcon },
    ],
  },
];

export default function Sidebar({ active, onNav, health, onClose }) {
  const loaded = health?.models_loaded;

  return (
    <aside className="w-64 md:w-56 h-full flex flex-col border-r border-border-subtle bg-bg-secondary transition-colors duration-300">

      {/* Logo + mobile close button */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-3 px-5 py-4 border-b border-border-subtle"
      >
        <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 shadow-glow">
          <img src="/icon.png" alt="VisionIQ" className="w-full h-full object-cover" />
        </div>
        <div className="leading-tight min-w-0 flex-1">
          <p className="text-sm font-bold text-tx-primary tracking-wide truncate">VisionIQ</p>
          <p className="text-[10px] text-accent-purple font-mono font-semibold">AI Vision</p>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-lg text-tx-muted hover:text-tx-primary hover:bg-bg-hover transition shrink-0"
          aria-label="Close menu"
        >
          <CloseIcon />
        </button>
      </motion.div>

      {/* Nav groups */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {NAV.map((group, gi) => (
          <motion.div
            key={group.section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: gi * 0.06 }}
          >
            <p className="text-[10px] font-semibold tracking-widest text-tx-muted px-2 mb-1.5">
              {group.section}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = active === item.id;
                return (
                  <motion.button
                    key={item.id}
                    whileHover={{ x: 3 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => onNav(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-accent-purple text-white shadow-glow-sm"
                        : "text-tx-secondary hover:text-tx-primary hover:bg-bg-hover"
                    }`}
                  >
                    <span className="w-4 h-4 shrink-0"><Icon /></span>
                    {item.label}
                    {isActive && (
                      <motion.span
                        layoutId="activeIndicator"
                        className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60"
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        ))}
      </nav>

      {/* Model status chip */}
      <div className="px-3 pb-4">
        <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${
          loaded
            ? "border-accent-green/30 bg-accent-green/5"
            : health === null
              ? "border-border-card bg-bg-card"
              : "border-red-500/30 bg-red-500/5"
        }`}>
          <span className={`w-2 h-2 rounded-full shrink-0 ${
            loaded ? "bg-accent-green animate-pulse"
              : health === null ? "bg-slate-500"
              : "bg-red-400"
          }`} />
          <div className="leading-tight min-w-0">
            <p className="text-[11px] font-medium text-tx-primary truncate">
              {loaded ? "Models Ready" : health === null ? "Waking up backend…" : "Models Offline"}
            </p>
            {health?.device && (
              <p className="text-[10px] text-tx-muted font-mono">{health.device}</p>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ── Icons ────────────────────────────────────────────────────────────────── */
function NavIco({ d }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
function GridIcon()   { return <NavIco d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />; }
function UploadIcon() { return <NavIco d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />; }
function ClockIcon()  { return <NavIco d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM12 6v6l4 2" />; }
function CpuIcon()    { return <NavIco d="M18 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM9 9h6v6H9z" />; }
function CloseIcon()  {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6"  y1="6" x2="18" y2="18"/>
    </svg>
  );
}
