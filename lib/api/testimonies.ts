import { buildSeed } from "@/lib/seed";
import type {
  DataSource,
  GlobeSnapshot,
  NewTestimony,
  Testimony,
  TestimonyPage,
} from "@/lib/types";
import { isRetriable } from "./http";
import { localProvider, type QueuedTestimony } from "./providers/local";
import { remoteProvider } from "./providers/remote";

const DAY = 24 * 60 * 60 * 1000;

const RECENT_FALLBACK = 300;

function countLast24h(items: Testimony[], nowMs: number): number {
  return items.filter((t) => nowMs - new Date(t.createdAt).getTime() < DAY).length;
}

function countByCountry(items: Testimony[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of items) counts[t.countryCode] = (counts[t.countryCode] ?? 0) + 1;
  return counts;
}

/** The built-in sample testimonies, shaped like a server response. */
function seedSnapshot(nowMs: number): GlobeSnapshot {
  const all = buildSeed(nowMs).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    recent: all.slice(0, RECENT_FALLBACK),
    counts: countByCountry(all),
    total: all.length,
    todayCount: countLast24h(all, nowMs),
  };
}

function queuedToTestimony(q: QueuedTestimony): Testimony {
  return {
    id: `queued-${q.clientId}`,
    name: q.input.name,
    countryCode: q.input.countryCode,
    text: q.input.text,
    createdAt: q.createdAt,
    amens: 0,
  };
}

/**
 * Fallback chain for reading the globe:
 *   1. remote API (with timeout + retries)
 *   2. last good response cached in the browser
 *   3. built-in seed testimonies
 * It never throws, so the map always has something honest to show.
 * `source` tells the UI which layer answered.
 */
export async function loadSnapshot(): Promise<{ data: GlobeSnapshot; source: DataSource }> {
  const nowMs = Date.now();
  let data: GlobeSnapshot;
  let source: DataSource;

  try {
    data = await remoteProvider.snapshot();
    localProvider.setCache(data);
    source = "remote";
  } catch {
    const cached = localProvider.getCache();
    if (cached && cached.recent.length > 0) {
      data = cached;
      source = "cache";
    } else {
      data = seedSnapshot(nowMs);
      source = "seed";
    }
  }

  // Show anything still waiting to be sent, so a person's own dot never vanishes.
  const queued = localProvider.getQueue().map(queuedToTestimony);
  if (queued.length > 0) {
    const known = new Set(data.recent.map((t) => t.id));
    const extra = queued.filter((t) => !known.has(t.id));
    data = {
      ...data,
      recent: [...extra, ...data.recent],
      todayCount: data.todayCount + extra.length,
    };
  }

  return { data, source };
}

/** One page of the full list. Falls back to the cached or sample testimonies if the API is down. */
export async function loadPage(
  cursor: string | null,
  limit: number,
): Promise<{ page: TestimonyPage; source: DataSource }> {
  try {
    return { page: await remoteProvider.page(cursor, limit), source: "remote" };
  } catch (err) {
    // only the first page falls back; a failed later page just stops and can be retried
    if (cursor !== null) throw err;
    const cached = localProvider.getCache();
    if (cached && cached.recent.length > 0) {
      return { page: { items: cached.recent, nextCursor: null, total: cached.total }, source: "cache" };
    }
    const seed = seedSnapshot(Date.now());
    return { page: { items: seed.recent, nextCursor: null, total: seed.total }, source: "seed" };
  }
}

export type SubmitResult = {
  testimony: Testimony;
  /** "remote": saved. "queued": backend unreachable, saved on this device and retried later. */
  status: "remote" | "queued";
  /** true when the backend accepted it but is holding it for review */
  pendingReview: boolean;
};

/**
 * Fallback chain for writing: try the API; if it is unreachable (network or 5xx),
 * keep the testimony in a local queue and return an optimistic result.
 * Real validation errors (4xx) are thrown so the form can show them.
 */
export async function submitTestimony(input: NewTestimony): Promise<SubmitResult> {
  try {
    const { item, pending } = await remoteProvider.create(input);
    return { testimony: item, status: "remote", pendingReview: pending };
  } catch (err) {
    if (!isRetriable(err)) throw err;

    const queued: QueuedTestimony = {
      clientId: crypto.randomUUID(),
      input,
      createdAt: new Date().toISOString(),
    };
    localProvider.setQueue([...localProvider.getQueue(), queued]);
    return {
      testimony: queuedToTestimony(queued),
      status: "queued",
      pendingReview: false,
    };
  }
}

/**
 * Tries to send everything in the offline queue. Returns how many were delivered.
 * Items that still fail stay queued; items the server rejects outright are dropped.
 */
export async function flushQueue(): Promise<number> {
  const queue = localProvider.getQueue();
  if (queue.length === 0) return 0;

  const remaining: QueuedTestimony[] = [];
  let delivered = 0;

  for (const q of queue) {
    try {
      await remoteProvider.create(q.input);
      delivered++;
    } catch (err) {
      if (isRetriable(err)) remaining.push(q);
    }
  }

  localProvider.setQueue(remaining);
  return delivered;
}

/** Best-effort "Amen". Local state is the source of truth for this browser. */
export async function sendAmen(id: string): Promise<void> {
  if (localProvider.getAmened().has(id)) return;
  localProvider.addAmened(id);
  if (id.startsWith("queued-")) return;
  try {
    await remoteProvider.amen(id);
  } catch {
    /* the count is cosmetic; never block or nag the user over it */
  }
}

export function hasAmened(id: string): boolean {
  return localProvider.getAmened().has(id);
}
