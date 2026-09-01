/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  safelist: [
    // CSS-variable-backed classes — must not be purged
    "bg-bg-primary","bg-bg-secondary","bg-bg-card","bg-bg-hover",
    "border-border-subtle","border-border-card",
    "text-tx-primary","text-tx-secondary","text-tx-muted",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary:   "var(--bg-primary)",
          secondary: "var(--bg-secondary)",
          card:      "var(--bg-card)",
          hover:     "var(--bg-hover)",
        },
        border: {
          subtle: "var(--border-subtle)",
          card:   "var(--border-card)",
        },
        tx: {
          primary:   "var(--tx-primary)",
          secondary: "var(--tx-secondary)",
          muted:     "var(--tx-muted)",
        },
        accent: {
          purple: "#8b5cf6",
          violet: "#7c3aed",
          cyan:   "#06b6d4",
          green:  "#22c55e",
          pink:   "#ec4899",
          yellow: "#eab308",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      boxShadow: {
        card:        "0 4px 24px rgba(0,0,0,0.25)",
        glow:        "0 0 20px rgba(139,92,246,0.35)",
        "glow-sm":   "0 0 10px rgba(139,92,246,0.2)",
        "glow-cyan": "0 0 20px rgba(6,182,212,0.3)",
      },
      keyframes: {
        "fade-up":  { "0%": { opacity:0, transform:"translateY(12px)" }, "100%": { opacity:1, transform:"translateY(0)" } },
        "fade-in":  { "0%": { opacity:0 }, "100%": { opacity:1 } },
        "slide-in": { "0%": { transform:"translateX(-100%)" }, "100%": { transform:"translateX(0)" } },
      },
      animation: {
        "fade-up":   "fade-up 0.4s ease both",
        "fade-in":   "fade-in 0.3s ease both",
        "slide-in":  "slide-in 0.3s ease both",
        "spin-slow": "spin 3s linear infinite",
      },
    },
  },
  plugins: [],
};
