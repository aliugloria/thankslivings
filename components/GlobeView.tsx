"use client";

import { AnimatePresence, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AmbientCloud } from "@/lib/ambient";
import { dotColor } from "@/lib/colors";
import { countryName } from "@/lib/countries";
import { buildArcs, dotLonLat, dotPosition } from "@/lib/geo";
import {
  ARC_DRAW_MS,
  RADIUS_FRACTION,
  createGlobeRenderer,
  readGlobeColors,
  type LonLat,
  type View,
} from "@/lib/globeRender";
import type { Testimony } from "@/lib/types";
import { clamp } from "@/lib/utils";
import { Popover } from "./Popover";

type Props = {
  items: Testimony[];
  total: number;
  /** every other testimony, drawn as small dots */
  ambient: AmbientCloud;
  selectedId: string | null;
  now: number | null;
  onSelect: (id: string) => void;
  /** tap on empty globe: closes the popover and the list */
  onDismiss: () => void;
  /** start of a drag: only closes the popover */
  onClearSelection: () => void;
  onAmen: (id: string) => void;
};

type Located = { t: Testimony; ll: LonLat; color: string };

const MAX_ARC_DOTS = 200;
const AUTO_ROTATE_DEG_PER_SEC = 5;
const IDLE_BEFORE_ROTATE_MS = 2500;
const FLY_MS = 900;
const TAP_SLOP_PX = 4;

type Fly = { id: string; from: View; to: View; t0: number; dur: number };

export function GlobeView({
  items,
  ambient,
  total,
  selectedId,
  now,
  onSelect,
  onDismiss,
  onClearSelection,
  onAmen,
}: Props) {
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotEls = useRef(new Map<string, HTMLButtonElement>());

  const [size, setSize] = useState(0);
  const [readyId, setReadyId] = useState<string | null>(null);
  const [hint, setHint] = useState(true);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // oldest first, so each arc points back to a dot that already existed
  const located = useMemo<Located[]>(
    () =>
      [...items]
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .flatMap((t) => {
          const ll = dotLonLat(t.id, t.countryCode);
          return ll ? [{ t, ll, color: dotColor(t.id) }] : [];
        }),
    [items],
  );

  const lonLat = useMemo(() => new Map(located.map((d) => [d.t.id, d.ll] as const)), [located]);

  const arcs = useMemo(() => {
    const flat = located.slice(-MAX_ARC_DOTS).flatMap((d) => {
      const p = dotPosition(d.t.id, d.t.countryCode);
      return p ? [{ id: d.t.id, x: p.x, y: p.y }] : [];
    });
    return buildArcs(flat);
  }, [located]);

  // ---- state the animation loop reads without re-rendering React ----------
  const view = useRef<View>({ lng: 15, lat: 12 }); // starts over Africa and the Atlantic
  const locatedRef = useRef(located);
  const lonLatRef = useRef(lonLat);
  const arcsRef = useRef(arcs);
  const ambientRef = useRef(ambient);
  const selectedRef = useRef(selectedId);
  const reduceRef = useRef(false);
  const dirty = useRef(true);
  const hovering = useRef(false);
  const lastInteract = useRef(-Infinity);
  const fly = useRef<Fly | null>(null);
  const drag = useRef({ active: false, moved: false, startX: 0, startY: 0, x: 0, y: 0, t: 0, vLng: 0, vLat: 0 });
  const arcBirth = useRef(new Map<string, number>());
  const arcsSeeded = useRef(false);
  const animUntil = useRef(0);

  useEffect(() => {
    locatedRef.current = located;
    lonLatRef.current = lonLat;
    arcsRef.current = arcs;
    dirty.current = true;
  }, [located, lonLat, arcs]);

  useEffect(() => {
    ambientRef.current = ambient;
    dirty.current = true;
  }, [ambient]);

  useEffect(() => {
    selectedRef.current = selectedId;
    dirty.current = true;
  }, [selectedId]);

  useEffect(() => {
    reduceRef.current = reduceMotion ?? false;
  }, [reduceMotion]);

  // ---- fly to the selected dot --------------------------------------------
  // keyed on a primitive so the 30s data refresh never re-centres the globe
  const targetId = useMemo(
    () => (selectedId && lonLat.has(selectedId) ? selectedId : null),
    [selectedId, lonLat],
  );

  useEffect(() => {
    if (!targetId) return;
    const ll = lonLatRef.current.get(targetId);
    if (!ll) return;
    const from = { ...view.current };
    const delta = ((ll[0] - from.lng + 540) % 360) - 180; // shortest way round
    const t0 = performance.now();
    fly.current = {
      id: targetId,
      from,
      to: { lng: from.lng + delta, lat: clamp(ll[1], -75, 75) },
      t0,
      dur: reduceRef.current ? 0 : FLY_MS,
    };
    lastInteract.current = t0;
    dirty.current = true;
    return () => {
      fly.current = null;
      lastInteract.current = performance.now();
      setReadyId(null); // hide the popover until the next fly lands
    };
  }, [targetId]);

  // ---- render loop ---------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size < 50) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const renderer = createGlobeRenderer(ctx, size);
    const root = document.documentElement;
    let colors = readGlobeColors(root);
    const observer = new MutationObserver(() => {
      colors = readGlobeColors(root);
      dirty.current = true;
    });
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });

    let raf = 0;
    let last = performance.now();

    const arcProgress = (arcId: string, t: number, index: number) => {
      let birth = arcBirth.current.get(arcId);
      if (birth === undefined) {
        // first batch fans out; arcs from later testimonies just draw in
        birth = t + (arcsSeeded.current ? 150 : Math.min(index * 20, 1200));
        arcBirth.current.set(arcId, birth);
        animUntil.current = Math.max(animUntil.current, birth + ARC_DRAW_MS);
      }
      if (reduceRef.current) return 1;
      return clamp((t - birth) / ARC_DRAW_MS, 0, 1);
    };

    const paint = (t: number) => {
      const indexOf = new Map(arcsRef.current.map((a, i) => [a.id, i] as const));
      renderer.draw({
        view: view.current,
        colors,
        arcs: arcsRef.current,
        lonLat: lonLatRef.current,
        selectedId: selectedRef.current,
        ambient: ambientRef.current,
        arcProgress: (id) => arcProgress(id, t, indexOf.get(id) ?? 0),
      });
      arcsSeeded.current = arcsRef.current.length > 0;

      // dots are real buttons (focusable, clickable); move them with the globe
      for (const d of locatedRef.current) {
        const el = dotEls.current.get(d.t.id);
        if (!el) continue;
        const p = renderer.locate(d.ll, view.current);
        if (!p) {
          if (el.dataset.v !== "0") {
            el.style.visibility = "hidden";
            el.dataset.v = "0";
          }
          continue;
        }
        if (el.dataset.v !== "1") {
          el.style.visibility = "visible";
          el.dataset.v = "1";
        }
        el.style.translate = `${p.x}px ${p.y}px`;
        el.style.opacity = String(p.opacity);
      }
    };

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const v = view.current;
      let moving = false;

      const f = fly.current;
      if (f) {
        const p = f.dur <= 0 ? 1 : Math.min((t - f.t0) / f.dur, 1);
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; // ease in-out
        v.lng = f.from.lng + (f.to.lng - f.from.lng) * e;
        v.lat = f.from.lat + (f.to.lat - f.from.lat) * e;
        moving = true;
        if (p >= 1) {
          fly.current = null;
          setReadyId(f.id); // dot is centred: show its popover
        }
      } else if (!drag.current.active) {
        const d = drag.current;
        if (Math.abs(d.vLng) > 0.5 || Math.abs(d.vLat) > 0.5) {
          // momentum after a flick
          v.lng += d.vLng * dt;
          v.lat = clamp(v.lat + d.vLat * dt, -85, 85);
          const decay = Math.pow(0.002, dt);
          d.vLng *= decay;
          d.vLat *= decay;
          moving = true;
        } else if (
          !reduceRef.current &&
          !selectedRef.current &&
          !hovering.current &&
          t - lastInteract.current > IDLE_BEFORE_ROTATE_MS
        ) {
          v.lng += AUTO_ROTATE_DEG_PER_SEC * dt;
          moving = true;
        }
      }

      if (v.lng > 180) v.lng -= 360;
      if (v.lng < -180) v.lng += 360;

      if (moving || t < animUntil.current || dirty.current) {
        dirty.current = false;
        paint(t);
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [size]);

  // ---- drag to rotate ------------------------------------------------------
  const degPerPx = size > 0 ? 180 / Math.PI / ((size / 2) * RADIUS_FRACTION) : 0.2;

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    fly.current = null;
    hovering.current = false;
    setHint(false);
    drag.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      t: e.timeStamp,
      vLng: 0,
      vLat: 0,
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const d = drag.current;
    if (!d.active) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > TAP_SLOP_PX) {
      d.moved = true;
      if (selectedRef.current) onClearSelection();
    }
    if (!d.moved) return;

    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    const dtMs = Math.max(e.timeStamp - d.t, 1);
    view.current.lng -= dx * degPerPx; // the surface follows the finger
    view.current.lat = clamp(view.current.lat + dy * degPerPx, -85, 85);
    d.vLng = 0.6 * d.vLng + 0.4 * ((-dx * degPerPx * 1000) / dtMs);
    d.vLat = 0.6 * d.vLat + 0.4 * ((dy * degPerPx * 1000) / dtMs);
    d.x = e.clientX;
    d.y = e.clientY;
    d.t = e.timeStamp;
    dirty.current = true;
  }

  function endDrag(e: React.PointerEvent<HTMLCanvasElement>, cancelled: boolean) {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    lastInteract.current = performance.now();
    if (e.timeStamp - d.t > 80) {
      d.vLng = 0; // held still before letting go: no momentum
      d.vLat = 0;
    }
    if (!d.moved && !cancelled) onDismiss(); // a tap on empty globe
  }

  // ---- render --------------------------------------------------------------
  const newestId = located.length > 0 ? located[located.length - 1].t.id : null;
  const popoverDot =
    readyId !== null && readyId === selectedId ? located.find((d) => d.t.id === readyId) : undefined;

  return (
    <div
      ref={rootRef}
      className="relative"
      style={{ aspectRatio: "1 / 1", width: "min(100%, calc(100dvh - 13rem))" }}
    >
      <div
        aria-hidden
        className="absolute rounded-full shadow-card"
        style={{ inset: `${((1 - RADIUS_FRACTION) / 2) * 100}%` }}
      />

      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Globe showing where people are giving thanks. Drag to rotate."
        className="absolute inset-0 h-full w-full cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endDrag(e, false)}
        onPointerCancel={(e) => endDrag(e, true)}
      />

      {located.map((d, i) => (
        <button
          key={d.t.id}
          ref={(el) => {
            if (el) dotEls.current.set(d.t.id, el);
            else dotEls.current.delete(d.t.id);
          }}
          type="button"
          className="dot"
          aria-label={`${d.t.name ?? "Someone"} is thanking God from ${countryName(d.t.countryCode)}`}
          aria-pressed={selectedId === d.t.id}
          data-newest={d.t.id === newestId}
          onClick={() => onSelect(d.t.id)}
          onPointerEnter={() => {
            hovering.current = true;
          }}
          onPointerLeave={() => {
            hovering.current = false;
          }}
          style={
            {
              // positioned every frame via `translate`; hidden until the first frame places it
              left: 0,
              top: 0,
              visibility: "hidden",
              "--dot": d.color,
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
        {popoverDot && size > 0 && (
          <Popover
            key={popoverDot.t.id}
            testimony={popoverDot.t}
            color={popoverDot.color}
            // the globe has just turned this dot to the centre
            anchor={{ x: size / 2, y: size / 2 }}
            container={{ w: size, h: size }}
            now={now}
            onClose={onClearSelection}
            onAmen={onAmen}
          />
        )}
      </AnimatePresence>

      {/* {hint && size > 0 && (
        <p className="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-muted">
          Drag to rotate
        </p>
      )} */}
            {size > 0 && (hint || total > items.length) && (
        <p className="pointer-events-none absolute -bottom-7 left-1/2 w-max max-w-[92vw] -translate-x-1/2 text-center text-xs text-muted">
          {hint
            ? "Drag to rotate"
            : `${total.toLocaleString()} people have thanked God · Only The newest ${items.length.toLocaleString()} are tappable`}
        </p>
      )}
    </div>
  );
}
