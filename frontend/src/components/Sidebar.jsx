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
      { id: "model-status", label: "Model Status",   icon: CpuIcon },
    ],
  },
];

export default function Sidebar({ active, onNav, health }) {
  const loaded = health?.models_loaded;

  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-border-subtle bg-bg-secondary transition-colors duration-300">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-3 px-5 py-5 border-b border-border-subtle"
      >
        <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 shadow-glow">
          <img src="/icon.png" alt="VisionIQ" className="w-full h-full object-cover" />
        </div>
        <div className="leading-tight min-w-0">
          <p className="text-sm font-bold text-tx-primary tracking-wide truncate">VisionIQ</p>
          <p className="text-[10px] text-accent-purple font-mono font-semibold">AI Vision</p>
        </div>
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
                    <span className="w-4 h-4 shrink-0">
                      <Icon active={isActive} />
                    </span>
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

      {/* Bottom section */}
      <div className="px-3 pb-4 space-y-2">
        {/* Model status chip only — theme toggle is in the header */}
        <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${
          loaded
            ? "border-accent-green/30 bg-accent-green/5"
            : health === null
              ? "border-border-card bg-bg-card"
              : "border-red-500/30 bg-red-500/5"
        }`}>
          <span className={`w-2 h-2 rounded-full shrink-0 ${
            loaded ? "bg-accent-green animate-pulse" : health === null ? "bg-slate-500 skeleton" : "bg-red-400"
          }`} />
          <div className="leading-tight min-w-0">
            <p className="text-[11px] font-medium text-tx-primary truncate">
              {loaded ? "Models Ready" : health === null ? "Connecting…" : "Models Offline"}
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

/* ── Icons ─────────────────────────────────────────────────────────────────── */
function EyeLogoIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* scan corners */}
      <path d="M10 18v-8h8M46 10h8v8M54 46v8h-8M18 54h-8v-8" stroke="#00e5ff" strokeWidth="5" strokeLinecap="round"/>
      {/* eye */}
      <path d="M10 32 Q32 14 54 32 Q32 50 10 32z" fill="none" stroke="white" strokeWidth="3.5"/>
      {/* lens rings */}
      <circle cx="32" cy="32" r="9" stroke="#a78bfa" strokeWidth="3"/>
      <circle cx="32" cy="32" r="5" fill="#8b5cf6"/>
      <circle cx="32" cy="32" r="2" fill="#00e5ff"/>
      {/* pixel dots */}
      <rect x="15" y="14" width="4" height="4" rx="1" fill="#6366f1" opacity=".9"/>
      <rect x="12" y="20" width="3" height="3" rx="1" fill="#6366f1" opacity=".6"/>
      <rect x="20" y="11" width="3" height="3" rx="1" fill="#06b6d4" opacity=".8"/>
    </svg>
  );
}

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
