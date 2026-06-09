import React, { useEffect, useRef, useState } from "react";

export default function SignaturePad({ onChange, height = 180 }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const [empty, setEmpty] = useState(true);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    const cx = e.clientX ?? e.touches?.[0]?.clientX;
    const cy = e.clientY ?? e.touches?.[0]?.clientY;
    return { x: (cx - rect.left) * sx, y: (cy - rect.top) * sy };
  };

  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0F172A";
  }, []);

  const start = (e) => { e.preventDefault(); drawing.current = true; last.current = getPos(e); };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (empty) setEmpty(false);
  };
  const end = () => {
    drawing.current = false;
    if (onChange) onChange(canvasRef.current.toDataURL("image/png"));
  };

  const clear = () => {
    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    setEmpty(true);
    if (onChange) onChange("");
  };

  return (
    <div data-testid="signature-pad">
      <canvas
        ref={canvasRef}
        width={600}
        height={height}
        className="block w-full bg-white border-2 border-dashed border-slate-400 touch-none cursor-crosshair"
        style={{ aspectRatio: `${600}/${height}` }}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">
          {empty ? "Sign above with mouse or touch" : "Signature captured"}
        </span>
        <button
          type="button"
          onClick={clear}
          data-testid="signature-clear-btn"
          className="text-xs text-slate-600 hover:text-red-600 font-bold uppercase tracking-wider"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
