import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  // IMPORTANT for Electron: assets must use relative paths so they resolve
  // under file:// protocol. The browser/Vercel deploy is unaffected because
  // Vercel serves from the root anyway.
  base: "./",

  build: {
    outDir: "dist",
    emptyOutDir: true,
  },

  server: {
    port: 5173,
    // Dev-only proxy — not used in production / Electron
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
