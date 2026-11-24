"use client";
/**
 * กราฟเส้นขนาดเล็ก 1 ชุดข้อมูล (ใช้แสดง convergence)
 * - ค่าต่างสเกลแยกเป็นคนละกราฟ (ไม่ใช้แกนคู่)
 * - เส้น 2px, เส้นกริดจาง, มี crosshair + tooltip เมื่อชี้
 */
import { useId, useMemo, useState } from "react";

export interface Point {
  x: number;
  y: number;
}

export function MiniLineChart({
  title,
  points,
  xLabel = "วินาที",
  formatY = (v) => v.toLocaleString("th-TH", { maximumFractionDigits: 1 }),
  formatX = (v) => (v / 1000).toFixed(1),
  height = 140,
}: {
  title: string;
  points: Point[];
  xLabel?: string;
  formatY?: (v: number) => string;
  formatX?: (v: number) => string;
  height?: number;
}) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const W = 480;
  const H = height;
  const pad = { l: 44, r: 12, t: 10, b: 24 };

  const geo = useMemo(() => {
    if (points.length === 0) return null;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs, x0 + 1);
    const y1 = Math.max(...ys, 1);
    const sx = (x: number) => pad.l + ((x - x0) / (x1 - x0)) * (W - pad.l - pad.r);
    const sy = (y: number) => pad.t + (1 - y / y1) * (H - pad.t - pad.b);
    const d = points.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join("");
    const ticks = [0, y1 / 2, y1];
    return { sx, sy, d, ticks, x0, x1 };
  }, [points, H, pad.l, pad.r, pad.t, pad.b]);

  if (!geo) {
    return (
      <figure className="rounded-md border border-line p-3">
        <figcaption className="text-sm font-medium">{title}</figcaption>
        <p className="py-6 text-center text-sm text-muted">ยังไม่มีข้อมูล</p>
      </figure>
    );
  }

  const hp = hover !== null ? points[hover] : null;

  return (
    <figure className="rounded-md border border-line p-3">
      <figcaption id={id} className="mb-1 text-sm font-medium">
        {title}
      </figcaption>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-labelledby={id}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * W;
            let best = 0;
            let bd = Infinity;
            points.forEach((p, i) => {
              const dd = Math.abs(geo.sx(p.x) - x);
              if (dd < bd) {
                bd = dd;
                best = i;
              }
            });
            setHover(best);
          }}
        >
          {geo.ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={geo.sy(t)} y2={geo.sy(t)} stroke="var(--color-line)" strokeWidth="1" />
              <text x={pad.l - 6} y={geo.sy(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-muted)">
                {formatY(t)}
              </text>
            </g>
          ))}
          <text x={pad.l} y={H - 6} fontSize="11" fill="var(--color-muted)">
            {formatX(geo.x0)}
          </text>
          <text x={W - pad.r} y={H - 6} textAnchor="end" fontSize="11" fill="var(--color-muted)">
            {formatX(geo.x1)} {xLabel}
          </text>
          <path d={geo.d} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {hp && (
            <g>
              <line x1={geo.sx(hp.x)} x2={geo.sx(hp.x)} y1={pad.t} y2={H - pad.b} stroke="var(--color-line-strong)" strokeWidth="1" />
              <circle cx={geo.sx(hp.x)} cy={geo.sy(hp.y)} r="4" fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth="2" />
            </g>
          )}
        </svg>
        {hp && (
          <div
            className="pointer-events-none absolute top-0 rounded border border-line bg-surface px-2 py-1 text-xs shadow-sm"
            style={{ left: `${(geo.sx(hp.x) / W) * 100}%`, transform: "translateX(-50%)" }}
          >
            <span className="text-muted">
              {formatX(hp.x)} {xLabel}:
            </span>{" "}
            <span className="font-semibold tabular-nums">{formatY(hp.y)}</span>
          </div>
        )}
      </div>
    </figure>
  );
}
