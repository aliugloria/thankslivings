"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AmbientCloud } from "@/lib/ambient";
import { dotColor } from "@/lib/colors";
import { countryName } from "@/lib/countries";
import { LAND_PATHS, MAP_HEIGHT, MAP_WIDTH, buildArcs, dotPosition } from "@/lib/geo";
import type { Testimony } from "@/lib/types";
import { Popover } from "./Popover";

type Props = {
  items: Testimony[];
  /** every other testimony, drawn as small dots */
  ambient: AmbientCloud;
  /** all-time number of testimonies, for the caption under the map */
  total: number;
  selectedId: string | null;
  now: number | null;
  onSelect: (id: string) => void;
  onDismiss: () => void;
  onAmen: (id: string) => void;
};

const MAX_ARC_DOTS = 200;

export function WorldMap({ items, ambient, total, selectedId, now, onSelect, onDismiss, onAmen }: Props) {
  const reduceMotion = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const ambientRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // the ambient dots live on a canvas over the map: thousands of SVG nodes would crawl
  useEffect(() => {
    const canvas = ambientRef.current;
    if (!canvas || size.w < 50) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    const sx = size.w / MAP_WIDTH;
    const sy = size.h / MAP_HEIGHT;
    const r = Math.max(1.4, size.w * 0.0026);
    ctx.globalAlpha = selectedId !== null ? 0.3 : 0.7;
    for (const g of ambient) {
      ctx.fillStyle = g.color;
      ctx.beginPath();
      for (let i = 0; i < g.x.length; i++) {
        ctx.moveTo(g.x[i] * sx + r, g.y[i] * sy);
        ctx.arc(g.x[i] * sx, g.y[i] * sy, r, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }, [ambient, size, selectedId]);

  // oldest first, so arcs always point back to dots that already existed
  const located = useMemo(() => {
    return [...items]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .flatMap((t) => {
        const p = dotPosition(t.id, t.countryCode);
        return p ? [{ t, x: p.x, y: p.y, color: dotColor(t.id) }] : [];
      });
  }, [items]);

  const arcs = useMemo(
    () => buildArcs(located.slice(-MAX_ARC_DOTS).map((d) => ({ id: d.t.id, x: d.x, y: d.y }))),
    [located],
  );

  // SVG user units per screen pixel, so strokes stay ~1px at any map size.
  // (Not using vector-effect="non-scaling-stroke": it measures dashes in screen pixels,
  // which breaks the pathLength draw-in and leaves arcs stopping short of their dots.)
  const unit = size.w > 0 ? MAP_WIDTH / size.w : 1;

  const newestId = located.length > 0 ? located[located.length - 1].t.id : null;
  const selected = located.find((d) => d.t.id === selectedId) ?? null;

  return (
    <div
      ref={wrapRef}
      className="relative"
      style={{
        aspectRatio: `${MAP_WIDTH} / ${MAP_HEIGHT}`,
        width: `min(100%, calc((100dvh - 9rem) * ${MAP_WIDTH / MAP_HEIGHT}))`,
      }}
    >
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label="World map showing where people are giving thanks"
        onClick={onDismiss}
      >
        <g fill="var(--land)" stroke="var(--land-edge)" strokeWidth={0.6}>
          {LAND_PATHS.map((c) => (
            <path key={c.name} d={c.d} />
          ))}
        </g>

        <g fill="none" stroke="var(--line)" strokeLinecap="round" pointerEvents="none">
          {arcs.map((arc, i) => {
            const connected = selectedId !== null && (arc.fromId === selectedId || arc.toId === selectedId);
            const dim = selectedId !== null && !connected;
            return (
              <motion.path
                key={arc.id}
                d={arc.d}
                initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
                animate={{
                  pathLength: 1,
                  opacity: connected ? 1 : dim ? 0.1 : 0.32,
                  strokeWidth: (connected ? 1.6 : 1) * unit,
                }}
                transition={{
                  pathLength: { duration: 1.1, delay: reduceMotion ? 0 : Math.min(i * 0.025, 1.4), ease: "easeOut" },
                  opacity: { duration: 0.3 },
                  strokeWidth: { duration: 0.2 },
                }}
              />
            );
          })}
        </g>
      </svg>

      <canvas ref={ambientRef} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />

      {located.map((d, i) => (
        <button
          key={d.t.id}
          type="button"
          className="dot"
          aria-label={`${d.t.name ?? "Someone"} is thanking God from ${countryName(d.t.countryCode)}`}
          aria-pressed={selectedId === d.t.id}
          data-newest={d.t.id === newestId}
          onClick={() => onSelect(d.t.id)}
          style={
            {
              left: `${(d.x / MAP_WIDTH) * 100}%`,
              top: `${(d.y / MAP_HEIGHT) * 100}%`,
              "--dot": d.color,
              // existing dots pop in with a stagger; a brand-new testimony lands immediately
              "--delay": `${
                now !== null && now - new Date(d.t.createdAt).getTime() < 8000
                  ? 0
                  : Math.min(i * 16, 700)
              }ms`,
              zIndex: selectedId === d.t.id ? 20 : 10,
            } as React.CSSProperties
          }
        >
          <span />
        </button>
      ))}

      <AnimatePresence>
        {selected && size.w > 0 && (
          <Popover
            key={selected.t.id}
            testimony={selected.t}
            color={selected.color}
            anchor={{
              x: (selected.x / MAP_WIDTH) * size.w,
              y: (selected.y / MAP_HEIGHT) * size.h,
            }}
            container={{ w: size.w, h: size.h }}
            now={now}
            onClose={onDismiss}
            onAmen={onAmen}
          />
        )}
      </AnimatePresence>
      {size.w > 0 && total > items.length && (
        <p className="pointer-events-none absolute -bottom-7 left-1/2 w-max max-w-[92vw] -translate-x-1/2 text-center text-xs text-muted">
          {`${total.toLocaleString()} people have thanked God · the newest ${items.length.toLocaleString()} are tappable`}
        </p>
      )}
    </div>
  );
}
