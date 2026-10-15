"use client";

import { useEffect, useMemo, useState } from "react";
import { AMBIENT_MAX, ambientPoint, buildCloud, planAmbient, type AmbientCloud, type AmbientPoint } from "@/lib/ambient";
import type { Testimony } from "@/lib/types";

const EMPTY: AmbientCloud = [];
/** Work per slice, so placing thousands of dots never freezes a frame. */
const SLICE_MS = 8;
const PUBLISH_EVERY = 500;

/**
 * Turns per-country counts into the cloud of ambient dots (see lib/ambient.ts). Dots are placed
 * a few milliseconds at a time, so on a big first load they bloom in over a second or two
 * instead of blocking the page. Positions are fixed per dot, so a refresh only adds dots.
 */
export function useAmbientCloud(counts: Record<string, number>, items: readonly Testimony[]): AmbientCloud {
  const [cloud, setCloud] = useState<AmbientCloud>(EMPTY);

  // A string key keeps the effect from restarting when a poll brings back identical numbers.
  const planKey = useMemo(() => {
    const real = new Map<string, number>();
    for (const t of items) real.set(t.countryCode, (real.get(t.countryCode) ?? 0) + 1);
    return planAmbient(counts, real)
      .map(([code, n]) => `${code}:${n}`)
      .join(",");
  }, [counts, items]);

  useEffect(() => {
    const plan = planKey === "" ? [] : planKey.split(",").map((s) => [s.slice(0, 2), Number(s.slice(3))] as const);
    let cancelled = false;
    let timer = 0;
    const points: AmbientPoint[] = [];
    let country = 0;
    let index = 0;
    let published = 0;

    const step = () => {
      if (cancelled) return;
      const t0 = performance.now();
      while (country < plan.length && points.length < AMBIENT_MAX * 2 && performance.now() - t0 < SLICE_MS) {
        const [code, n] = plan[country];
        if (index >= n) {
          country++;
          index = 0;
          continue;
        }
        const p = ambientPoint(code, index++);
        if (p) points.push(p);
      }
      const done = country >= plan.length;
      if (done || points.length - published >= PUBLISH_EVERY) {
        published = points.length;
        setCloud(points.length === 0 ? EMPTY : buildCloud(points));
      }
      if (!done) timer = window.setTimeout(step, 0);
    };

    timer = window.setTimeout(step, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [planKey]);

  return cloud;
}
