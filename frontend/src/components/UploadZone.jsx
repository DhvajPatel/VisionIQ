import React, { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Color palette for face boxes — alternates per person index
const BOX_COLORS = [
  "#3b82f6", // blue   — male default
  "#ec4899", // pink   — female default
  "#3b82f6",
  "#ec4899",
  "#3b82f6",
  "#ec4899",
  "#3b82f6",
  "#ec4899",
];

function genderColor(gender) {
  return gender === "Female" ? "#ec4899" : "#3b82f6";
}

export default function UploadZone({ previewUrl, loading, result, onFile, highlightIndex }) {
  const inputRef  = useRef(null);
  const canvasRef = useRef(null);
  const imgRef    = useRef(null);     // holds the loaded HTMLImageElement
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith("image/")) onFile(file);
    },
    [onFile]
  );

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = "";
  };

  // ── draw onto canvas whenever image or result changes ──────────────────────
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");

    // fit image into canvas maintaining aspect ratio (object-contain behaviour)
    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    const scale  = Math.min(cw / iw, ch / ih);
    const dw     = iw * scale;
    const dh     = ih * scale;
    const dx     = (cw - dw) / 2;
    const dy     = (ch - dh) / 2;

    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, dx, dy, dw, dh);

    // draw face boxes if we have person results
    if (result?.category === "person" && Array.isArray(result.faces)) {
      result.faces.forEach((face, i) => {
        const [fx0, fy0, fx1, fy1] = face.box;

        // map from original image coords → canvas coords
        const bx = dx + fx0 * scale;
        const by = dy + fy0 * scale;
        const bw = (fx1 - fx0) * scale;
        const bh = (fy1 - fy0) * scale;

        const color     = genderColor(face.gender);
        const isHovered = highlightIndex === i;
        const lineW     = isHovered ? 3 : 2;

        // outer glow when hovered
        if (isHovered) {
          ctx.shadowColor = color;
          ctx.shadowBlur  = 12;
        }

        // box
        ctx.strokeStyle = color;
        ctx.lineWidth   = lineW;
        ctx.strokeRect(bx, by, bw, bh);
        ctx.shadowBlur  = 0;

        // label badge background
        const num     = `${i + 1}`;
        const gender  = face.gender || "?";
        const conf    = face.gender_confidence != null
          ? `${(face.gender_confidence * 100).toFixed(0)}%`
          : "";
        const text    = `${num} · ${gender} ${conf}`;
        const fsize   = Math.max(10, Math.min(14, bw / 7));
        ctx.font      = `bold ${fsize}px Inter, sans-serif`;

        const pad    = 4;
        const tw     = ctx.measureText(text).width;
        const bадgeH = fsize + pad * 2;
        const badgeY = by > bадgeH + 2 ? by - bадgeH - 2 : by + 2;

        // badge fill
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(bx, badgeY, tw + pad * 2, bадgeH, 4);
        ctx.fill();

        // badge text
        ctx.fillStyle = "#fff";
        ctx.fillText(text, bx + pad, badgeY + bадgeH - pad - 1);
      });
    }
  }, [result, highlightIndex]);

  // Load image into an offscreen element so drawCanvas always has it
  useEffect(() => {
    if (!previewUrl) {
      imgRef.current = null;
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      return;
    }
    const img   = new Image();
    img.onload  = () => { imgRef.current = img; drawCanvas(); };
    img.src     = previewUrl;
  }, [previewUrl, drawCanvas]);

  // Redraw when result or highlight changes
  useEffect(() => {
    if (imgRef.current) drawCanvas();
  }, [result, highlightIndex, drawCanvas]);

  // Resize canvas to match container
  const containerRef = useRef(null);
  useEffect(() => {
    const obs = new ResizeObserver(() => {
      const el = containerRef.current;
      if (!el || !canvasRef.current) return;
      canvasRef.current.width  = el.clientWidth;
      canvasRef.current.height = el.clientHeight;
      if (imgRef.current) drawCanvas();
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [drawCanvas]);

  return (
    <div
      ref={containerRef}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !previewUrl && inputRef.current?.click()}
      className={`relative rounded-xl overflow-hidden border-2 aspect-[16/9] transition-all
        ${dragging
          ? "border-accent-purple bg-accent-purple/5"
          : "border-border-card hover:border-accent-purple/40"}
        ${!previewUrl ? "flex flex-col items-center justify-center bg-bg-secondary cursor-pointer" : ""}`}
    >
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />

      {previewUrl ? (
        <>
          {/* Canvas — image + face boxes */}
          <canvas ref={canvasRef} className="w-full h-full" />

          {/* bottom toolbar */}
          <div className="absolute bottom-3 left-3 flex gap-2">
            <button
              title="Upload new image"
              onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
              className="w-8 h-8 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white hover:bg-black/70 transition"
            >
              <RefreshIcon />
            </button>
          </div>

          <button
            className="absolute bottom-3 right-3 text-xs px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 text-slate-300 hover:text-white hover:bg-black/70 transition"
            onClick={(e) => { e.stopPropagation(); window.open(previewUrl, "_blank"); }}
          >
            View Full Size
          </button>

          {/* Loading overlay */}
          <AnimatePresence>
            {loading && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/65 flex flex-col items-center justify-center gap-3"
              >
                <div className="w-10 h-10 rounded-full border-2 border-accent-purple border-t-transparent animate-spin" />
                <p className="text-sm text-slate-300 font-medium">Analyzing image…</p>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        /* Empty state */
        <div className="text-center px-6 select-none">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-accent-purple/10 border border-accent-purple/30 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-200 mb-1">Drop an image here</p>
          <p className="text-xs text-slate-500 mb-4">or click to browse · PNG, JPG, WEBP, GIF</p>
          <p className="text-[11px] text-slate-600">Detects: Male · Female · Animal</p>
        </div>
      )}
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  );
}
