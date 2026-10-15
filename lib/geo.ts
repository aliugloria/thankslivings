import {
  geoArea,
  geoBounds,
  geoContains,
  geoNaturalEarth1,
  geoPath,
} from "d3-geo";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import world from "world-atlas/countries-110m.json";
import { getCountry } from "./countries";
import { hashString, mulberry32 } from "./utils";

type CountryFeature = Feature<Polygon | MultiPolygon, { name: string }>;

const topology = world as unknown as Topology;
const all = feature(
  topology,
  topology.objects.countries as GeometryCollection<{ name: string }>,
) as FeatureCollection<Polygon | MultiPolygon, { name: string }>;

/** Antarctica only wastes vertical space on this map. */
const land: CountryFeature[] = all.features.filter(
  (f) => f.properties.name !== "Antarctica",
);

export const MAP_WIDTH = 1000;

const projection = geoNaturalEarth1().fitWidth(MAP_WIDTH, {
  type: "FeatureCollection",
  features: land,
});
const pathGen = geoPath(projection);

export const MAP_HEIGHT = Math.ceil(pathGen.bounds({ type: "FeatureCollection", features: land })[1][1]);

/** One SVG path string per country, computed once. */
export const LAND_PATHS: { name: string; d: string }[] = land.flatMap((f) => {
  const d = pathGen(f);
  return d ? [{ name: f.properties.name, d }] : [];
});

const byName = new Map(land.map((f) => [f.properties.name, f]));

/** Whole planet, Antarctica included, for the globe (the flat map crops it). */
export const GLOBE_LAND = all;
export const GLOBE_BORDERS = mesh(
  topology,
  topology.objects.countries as GeometryCollection<{ name: string }>,
  (a, b) => a !== b,
);

/** Largest single polygon of a country: keeps dots out of far-away territories. */
function mainPolygon(f: CountryFeature): Polygon {
  const g = f.geometry;
  if (g.type === "Polygon") return g;
  let best = g.coordinates[0];
  let bestArea = -1;
  for (const coords of g.coordinates) {
    const area = geoArea({ type: "Polygon", coordinates: coords });
    if (area > bestArea) {
      bestArea = area;
      best = coords;
    }
  }
  return { type: "Polygon", coordinates: best };
}

export type Point = { x: number; y: number };
export type LonLat = [number, number];

/** A country's biggest polygon and its bounds, worked out once (geoArea is not cheap). */
type Shape = { poly: Polygon; w: number; s: number; e: number; n: number };
const shapes = new Map<string, Shape | null>();

function shapeOf(code: string): Shape | null {
  const key = code.toUpperCase();
  const hit = shapes.get(key);
  if (hit !== undefined) return hit;

  const country = getCountry(key);
  const f = country && !country.at ? byName.get(country.atlas ?? country.name) : undefined;
  let shape: Shape | null = null;
  if (f) {
    const poly = mainPolygon(f);
    const [[w, s], [eRaw, n]] = geoBounds(poly);
    shape = { poly, w, s, e: w > eRaw ? eRaw + 360 : eRaw, n };
  }
  shapes.set(key, shape);
  return shape;
}

const wrapLng = (lng: number) => (lng > 180 ? lng - 360 : lng);

const sampled = new Map<string, LonLat | null>();

/**
 * A deterministic pseudo-random point *inside the country*, seeded by `key`, as
 * [longitude, latitude]. We never store or reveal a real location: a testimony's
 * dot is just this point for its id, so it is stable across reloads and devices.
 * Places too small for the world map get a point jittered around their fallback.
 */
export function sampleCountry(key: string, countryCode: string): LonLat | null {
  const cacheKey = `${key}:${countryCode}`;
  const hit = sampled.get(cacheKey);
  if (hit !== undefined) return hit;

  let result: LonLat | null = null;
  const country = getCountry(countryCode);

  if (country?.at) {
    const rand = mulberry32(hashString(cacheKey));
    result = [wrapLng(country.at[0] + (rand() - 0.5) * 1.4), country.at[1] + (rand() - 0.5) * 1.4];
  } else {
    const shape = shapeOf(countryCode);
    if (shape) {
      const { poly, w, s, e, n } = shape;
      const rand = mulberry32(hashString(cacheKey));
      for (let i = 0; i < 200 && !result; i++) {
        const lng = wrapLng(w + rand() * (e - w));
        const lat = s + rand() * (n - s);
        if (geoContains(poly, [lng, lat])) result = [lng, lat];
      }
      // Extremely thin shapes can defeat rejection sampling; use the bounds centre.
      if (!result) result = [wrapLng((w + e) / 2), (s + n) / 2];
    }
  }

  sampled.set(cacheKey, result);
  return result;
}

/** Longitude/latitude to flat-map coordinates (the MAP_WIDTH x MAP_HEIGHT space). */
export function projectLonLat(ll: LonLat): Point | null {
  const p = projection(ll);
  return p ? { x: p[0], y: p[1] } : null;
}

/** Where a testimony's dot sits on the flat map. */
export function dotPosition(id: string, countryCode: string): Point | null {
  const ll = sampleCountry(id, countryCode);
  return ll ? projectLonLat(ll) : null;
}

/** The same dot as [longitude, latitude], so the globe and the flat map always agree. */
export function dotLonLat(id: string, countryCode: string): LonLat | null {
  return sampleCountry(id, countryCode);
}

export type Arc = { id: string; fromId: string; toId: string; d: string };

type Located = { id: string; x: number; y: number };

/**
 * Connects each dot to the nearest earlier dot, plus (for later dots) one more
 * earlier dot picked deterministically. Curves bow sideways in proportion to
 * their length so long hops look like arcs and short hops stay subtle.
 */
export function buildArcs(dots: Located[]): Arc[] {
  const arcs: Arc[] = [];
  const seen = new Set<string>();

  const add = (a: Located, b: Located) => {
    const key = [a.id, b.id].sort().join("|");
    if (seen.has(key)) return;
    seen.add(key);

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) return;

    const bow = (hashString(key) % 2 === 0 ? 1 : -1) * dist * 0.22;
    const cx = (a.x + b.x) / 2 + (-dy / dist) * bow;
    const cy = (a.y + b.y) / 2 + (dx / dist) * bow;
    arcs.push({
      id: key,
      fromId: a.id,
      toId: b.id,
      d: `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`,
    });
  };

  for (let i = 1; i < dots.length; i++) {
    const cur = dots[i];
    let nearest = dots[0];
    let nearestDist = Infinity;
    for (let j = 0; j < i; j++) {
      const d = Math.hypot(dots[j].x - cur.x, dots[j].y - cur.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = dots[j];
      }
    }
    add(cur, nearest);

    if (i >= 3) {
      const other = dots[hashString(cur.id) % i];
      if (other.id !== nearest.id) add(cur, other);
    }
  }
  return arcs;
}
