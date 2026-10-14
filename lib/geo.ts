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

const cache = new Map<string, Point | null>();

/**
 * Where a testimony's dot sits. We never store or reveal a real location: the dot
 * is a deterministic pseudo-random point *inside the person's country*, seeded
 * by the testimony id so it is stable across reloads and devices.
 */
export function dotPosition(id: string, countryCode: string): Point | null {
  const key = `${id}:${countryCode}`;
  if (cache.has(key)) return cache.get(key) ?? null;

  const country = getCountry(countryCode);
  const f = country ? byName.get(country.atlas ?? country.name) : undefined;
  let result: Point | null = null;

  if (f) {
    const poly = mainPolygon(f);
    const [[w, s], [eRaw, n]] = geoBounds(poly);
    const e = w > eRaw ? eRaw + 360 : eRaw;
    const rand = mulberry32(hashString(key));

    for (let i = 0; i < 200 && !result; i++) {
      let lng = w + rand() * (e - w);
      if (lng > 180) lng -= 360;
      const lat = s + rand() * (n - s);
      if (geoContains(poly, [lng, lat])) {
        const p = projection([lng, lat]);
        if (p) result = { x: p[0], y: p[1] };
      }
    }
    if (!result) {
      // Extremely thin shapes can defeat rejection sampling; use the bounds centre.
      const p = projection([(w + e) / 2 > 180 ? (w + e) / 2 - 360 : (w + e) / 2, (s + n) / 2]);
      if (p) result = { x: p[0], y: p[1] };
    }
  }

  cache.set(key, result);
  return result;
}

/**
 * The same dot as `dotPosition`, as [longitude, latitude], so the globe and the
 * flat map always agree on where a testimony lives.
 */
export function dotLonLat(id: string, countryCode: string): [number, number] | null {
  const p = dotPosition(id, countryCode);
  if (!p || !projection.invert) return null;
  const ll = projection.invert([p.x, p.y]);
  return ll ? [ll[0], ll[1]] : null;
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
