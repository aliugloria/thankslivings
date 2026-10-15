import type { NewTestimony, GlobeSnapshot } from "@/lib/types";

/**
 * Browser-side persistence used as the fallback layer:
 *  - cache:  the last successful list response, shown if the API is unreachable
 *  - queue:  testimonies posted while offline, retried later
 *  - amened: which testimonies this browser already said "Amen" to
 * Every access is wrapped because storage can be blocked (private windows, etc.).
 */
const KEYS = {
  cache: "tl:cache:v2",
  queue: "tl:queue:v1",
  amened: "tl:amened:v1",
} as const;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable or full: safe to ignore */
  }
}

export type QueuedTestimony = {
  clientId: string;
  input: NewTestimony;
  createdAt: string;
};

export const localProvider = {
  getCache: () => read<GlobeSnapshot | null>(KEYS.cache, null),
  setCache: (data: GlobeSnapshot) => write(KEYS.cache, data),

  getQueue: () => read<QueuedTestimony[]>(KEYS.queue, []),
  setQueue: (queue: QueuedTestimony[]) => write(KEYS.queue, queue),

  getAmened: () => new Set(read<string[]>(KEYS.amened, [])),
  addAmened: (id: string) => {
    const set = localProvider.getAmened();
    set.add(id);
    write(KEYS.amened, [...set]);
  },
};
