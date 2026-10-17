import { DOT_COLORS } from "./colors";
import { isKnownCountry } from "./countries";
import { countryArea, projectLonLat, sampleCountry } from "./geo";
import { hashString } from "./utils";

/**
 * "Ambient" dots: one dot for every testimony that is not one of the newest few hundred.
 * They are drawn on a canvas (cheap at any count), carry no text, and cannot be clicked;
 * the newest testimonies stay real, clickable dots with arcs between them. Together they
 * mean the globe fills up as people share, however many that turns out to be.
 */

/** Most ambient dots we ever draw. Past this, each country's share is scaled down evenly. */
export const AMBIENT_MAX = 2500;

/** Most backdrop dots per steradian of land, so a small country never becomes a solid blob. */
const MAX_DENSITY = 1500;
/** Cap for places drawn as a single fallback point (islands, microstates). */
const POINT_CAP = 6;

function capFor(code: string): number {
  const area = countryArea(code);
  return area > 0 ? Math.max(3, Math.round(area * MAX_DENSITY)) : POINT_CAP;
}

export type AmbientPlan = [code: string, dots: number][];

/**
 * How many ambient dots each country gets. `counts` is every approved testimony per country;
 * `real` is how many of them are already drawn as clickable dots, so nothing is drawn twice.
 */
export function planAmbient(counts: Record<string, number>, real: ReadonlyMap<string, number>): AmbientPlan {
  const rest: AmbientPlan = [];
  let total = 0;
  for (const [raw, count] of Object.entries(counts)) {
    const code = raw.toUpperCase();
    if (!isKnownCountry(code)) continue;
    const n = Math.floor(count) - (real.get(code) ?? 0);
    if (n > 0) {
      rest.push([code, n]);
      total += n;
    }
  }
  rest.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  if (total > AMBIENT_MAX) {
    // keep every country visible (at least one dot) and the rest in proportion
    const scale = AMBIENT_MAX / total;
    for (const r of rest) r[1] = Math.max(1, Math.round(r[1] * scale));
  }
  // then thin out crowded countries: the backdrop should hint at spread, not paint blobs
  for (const r of rest) r[1] = Math.min(r[1], capFor(r[0]));
  return rest;
}
/** One colour's worth of dots, as flat typed arrays so a frame is a tight loop. */
export type AmbientGroup = {
  color: string;
  /** sin and cos of longitude (radians), so a frame needs no trig per dot */
  sinLam: Float32Array;
  cosLam: Float32Array;
  sinPhi: Float32Array;
  cosPhi: Float32Array;
  /** flat-map coordinates (MAP_WIDTH x MAP_HEIGHT space) */
  x: Float32Array;
  y: Float32Array;
};
export type AmbientCloud = AmbientGroup[];

export type AmbientPoint = { lng: number; lat: number; x: number; y: number; ci: number };

const DEG = Math.PI / 180;

/** Ambient dots are a backdrop: the palette softened toward grey so they never compete with the real dots. */
function mute(hex: string, amount = 0.5): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const grey = 128;
  const mix = (c: number) => Math.round(c * (1 - amount) + grey * amount);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

/** The i-th ambient dot of a country: fixed forever, so growing the count only adds dots. */
export function ambientPoint(code: string, i: number): AmbientPoint | null {
  const key = `amb:${code}:${i}`;
  const ll = sampleCountry(key, code);
  if (!ll) return null;
  const p = projectLonLat(ll);
  if (!p) return null;
  return { lng: ll[0], lat: ll[1], x: p.x, y: p.y, ci: hashString(key) % DOT_COLORS.length };
}

export function buildCloud(points: readonly AmbientPoint[]): AmbientCloud {
  const buckets: AmbientPoint[][] = DOT_COLORS.map(() => []);
  for (const p of points) buckets[p.ci].push(p);

  return buckets.flatMap((list, ci) => {
    if (list.length === 0) return [];
    const group: AmbientGroup = {
      color: mute(DOT_COLORS[ci]),
      sinLam: new Float32Array(list.length),
      cosLam: new Float32Array(list.length),
      sinPhi: new Float32Array(list.length),
      cosPhi: new Float32Array(list.length),
      x: new Float32Array(list.length),
      y: new Float32Array(list.length),
    };
    list.forEach((p, i) => {
      group.sinLam[i] = Math.sin(p.lng * DEG);
      group.cosLam[i] = Math.cos(p.lng * DEG);
      group.sinPhi[i] = Math.sin(p.lat * DEG);
      group.cosPhi[i] = Math.cos(p.lat * DEG);
      group.x[i] = p.x;
      group.y[i] = p.y;
    });
    return [group];
  });
}
