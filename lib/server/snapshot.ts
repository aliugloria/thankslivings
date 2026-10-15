import "server-only";
import { store } from "./store";
import type { GlobeSnapshot } from "@/lib/types";

/** Newest testimonies sent in full: clickable dots, arcs and the 24-hour list. */
export const RECENT_LIMIT = 300;
/** How long one database read is shared by every visitor on this server. */
const TTL_MS = 15_000;
const DAY = 24 * 60 * 60 * 1000;

type Cache = { at: number; value: GlobeSnapshot };
const g = globalThis as unknown as { __tlSnap?: Cache; __tlSnapInflight?: Promise<GlobeSnapshot> };

async function build(): Promise<GlobeSnapshot> {
  const since = new Date(Date.now() - DAY).toISOString();
  const [recent, counts, todayCount] = await Promise.all([
    store.recent(RECENT_LIMIT),
    store.countsByCountry(),
    store.countSince(since),
  ]);
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  return { recent, counts, total, todayCount };
}

/**
 * The globe's data, read at most once per TTL however many people are watching. Concurrent
 * callers share one in-flight read, and if the database hiccups we keep serving the last good copy.
 */
export async function getSnapshot(): Promise<GlobeSnapshot> {
  const hit = g.__tlSnap;
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  g.__tlSnapInflight ??= build()
    .then((value) => {
      g.__tlSnap = { at: Date.now(), value };
      return value;
    })
    .finally(() => {
      g.__tlSnapInflight = undefined;
    });

  try {
    return await g.__tlSnapInflight;
  } catch (err) {
    if (hit) return hit.value;
    throw err;
  }
}
