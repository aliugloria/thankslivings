import {
  geoDistance,
  geoGraticule10,
  geoInterpolate,
  geoOrthographic,
  geoPath,
} from "d3-geo";
import { GLOBE_BORDERS, GLOBE_LAND } from "./geo";
import { clamp } from "./utils";

/**
 * Pure canvas drawing for the globe. No React, no timers, no DOM beyond a 2D
 * context, so it can be rendered headlessly and tested. The component owns
 * rotation, input and animation timing; this module only paints one frame.
 */

export type LonLat = [number, number];
/** The point on the planet facing the viewer, in degrees. */
export type View = { lng: number; lat: number };

/** Fraction of the canvas the globe fills; the rest is breathing room for the glow. */
export const RADIUS_FRACTION = 0.94;
export const ARC_DRAW_MS = 1100;

const ARC_STEPS = 40;
const HALF_PI = Math.PI / 2;
const SPHERE = { type: "Sphere" } as const;

export type GlobeColors = {
  ocean: string;
  rim: string;
  land: string;
  landEdge: string;
  line: string;
  hairline: string;
  shadeHi: string;
  shadeLo: string;
};

export function readGlobeColors(root: HTMLElement): GlobeColors {
  const styles = getComputedStyle(root);
  const get = (name: string) => styles.getPropertyValue(name).trim();
  const dark = root.getAttribute("data-theme") === "dark";
  return {
    ocean: get("--ocean"),
    rim: get("--ocean-edge"),
    land: get("--land"),
    landEdge: get("--land-edge"),
    line: get("--line"),
    hairline: get("--hairline"),
    shadeHi: dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.45)",
    shadeLo: dark ? "rgba(0,0,0,0.22)" : "rgba(120,90,50,0.16)",
  };
}

export type ArcRef = { id: string; fromId: string; toId: string };

export type DrawInput = {
  view: View;
  colors: GlobeColors;
  arcs: ArcRef[];
  lonLat: Map<string, LonLat>;
  selectedId: string | null;
  /** 0..1 draw-in progress for an arc; the component decides timing. */
  arcProgress: (arcId: string) => number;
};

type ArcGeometry = { pts: LonLat[]; lift: number[] };

export function createGlobeRenderer(ctx: CanvasRenderingContext2D, size: number) {
  const c = size / 2;
  const radius = c * RADIUS_FRACTION;
  const projection = geoOrthographic()
    .scale(radius)
    .translate([c, c])
    .clipAngle(90)
    .precision(0.5);
  const path = geoPath(projection, ctx);
  const graticule = geoGraticule10();
  const geometry = new Map<string, ArcGeometry>();

  /**
   * Great-circle points between two places, plus how far each is lifted off the
   * surface. In an orthographic view a point lifted by h simply sits (1 + h)
   * times further from the centre, which makes long hops arc over the horizon.
   */
  function arcGeometry(id: string, a: LonLat, b: LonLat): ArcGeometry {
    const cached = geometry.get(id);
    if (cached) return cached;
    const interpolate = geoInterpolate(a, b);
    const height = 0.03 + 0.15 * (geoDistance(a, b) / Math.PI);
    const pts: LonLat[] = [];
    const lift: number[] = [];
    for (let i = 0; i <= ARC_STEPS; i++) {
      const t = i / ARC_STEPS;
      pts.push(interpolate(t) as LonLat);
      lift.push(height * Math.sin(Math.PI * t));
    }
    const built = { pts, lift };
    geometry.set(id, built);
    return built;
  }

  function draw({ view, colors, arcs, lonLat, selectedId, arcProgress }: DrawInput) {
    projection.rotate([-view.lng, -view.lat, 0]);
    const center: LonLat = [view.lng, view.lat];

    ctx.clearRect(0, 0, size, size);

    // ocean, then a faint graticule so rotation reads as a sphere
    ctx.beginPath();
    path(SPHERE);
    ctx.fillStyle = colors.ocean;
    ctx.fill();

    ctx.beginPath();
    path(graticule);
    ctx.strokeStyle = colors.hairline;
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // land and borders (one path each: far cheaper than 176 separate fills)
    ctx.beginPath();
    path(GLOBE_LAND);
    ctx.fillStyle = colors.land;
    ctx.fill();

    ctx.beginPath();
    path(GLOBE_BORDERS);
    ctx.strokeStyle = colors.landEdge;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // soft light from the top-left, shade toward the rim
    ctx.save();
    ctx.beginPath();
    path(SPHERE);
    ctx.clip();
    const shade = ctx.createRadialGradient(c - radius * 0.35, c - radius * 0.35, radius * 0.1, c, c, radius * 1.05);
    shade.addColorStop(0, colors.shadeHi);
    shade.addColorStop(1, colors.shadeLo);
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();

    // arcs, clipped to the disc: near the edge a lifted arc would otherwise float
    // outside the planet and curl into stray hooks; clipped, it dives into the horizon
    ctx.save();
    ctx.beginPath();
    path(SPHERE);
    ctx.clip();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = colors.line;
    for (const arc of arcs) {
      const a = lonLat.get(arc.fromId);
      const b = lonLat.get(arc.toId);
      if (!a || !b) continue;

      const progress = arcProgress(arc.id);
      if (progress <= 0) continue;
      const eased = 1 - (1 - progress) * (1 - progress);
      const { pts, lift } = arcGeometry(arc.id, a, b);
      const last = Math.min(pts.length - 1, Math.floor(eased * ARC_STEPS) + 1);

      const connected = selectedId !== null && (arc.fromId === selectedId || arc.toId === selectedId);
      // ctx.globalAlpha = connected ? 1 : selectedId !== null ? 0.16 : 0.45;
      ctx.globalAlpha = connected ? 1 : selectedId !== null ? 0.1 : 0.28;
      ctx.lineWidth = connected ? 1.6 : 1;

      ctx.beginPath();
      let penDown = false;
      for (let i = 0; i <= last; i++) {
        if (geoDistance(pts[i], center) >= HALF_PI) {
          penDown = false; // behind the horizon
          continue;
        }
        const p = projection(pts[i]);
        if (!p) {
          penDown = false;
          continue;
        }
        const k = 1 + lift[i];
        const x = c + (p[0] - c) * k;
        const y = c + (p[1] - c) * k;
        if (penDown) ctx.lineTo(x, y);
        else {
          ctx.moveTo(x, y);
          penDown = true;
        }
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // rim
    ctx.beginPath();
    path(SPHERE);
    ctx.strokeStyle = colors.rim;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /** Screen position of a place, and how visible it is (fades to 0 at the horizon). */
  function locate(ll: LonLat, view: View): { x: number; y: number; opacity: number } | null {
    const dist = geoDistance(ll, [view.lng, view.lat]);
    if (dist >= HALF_PI) return null;
    projection.rotate([-view.lng, -view.lat, 0]);
    const p = projection(ll);
    if (!p) return null;
    return { x: p[0], y: p[1], opacity: clamp((HALF_PI - dist) / 0.3, 0, 1) };
  }

  return { draw, locate, radius };
}
