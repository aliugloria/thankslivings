import "server-only";
import { createClient } from "@supabase/supabase-js";
import { currentWindow, DAILY_WORDS, pickCurrentWord, type DailyWord } from "@/lib/dailyWord";
import { buildSeed } from "@/lib/seed";
import { COUNTRIES } from "@/lib/countries";
import { BadCursorError, decodeCursor, encodeCursor } from "./cursor";
import type { NewTestimony, Testimony } from "@/lib/types";

/**
 * Storage boundary for the backend.
 *
 * With SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set (see .env.local) the app uses
 * Supabase. Without them it falls back to an in-memory store seeded with sample
 * testimonies, so the whole app still runs with zero setup (it resets on restart).
 */
export interface TestimonyStore {
  /** The newest approved testimonies, newest first. */
  recent(limit: number): Promise<Testimony[]>;
  /** Keyset-paginated, newest first. Throws BadCursorError on a malformed cursor. */
  page(opts: { limit: number; cursor: string | null }): Promise<{ items: Testimony[]; nextCursor: string | null }>;
  /** Approved testimonies per country, for the whole table. */
  countsByCountry(): Promise<Record<string, number>>;
  /** Approved testimonies created at or after `iso`. */
  countSince(iso: string): Promise<number>;
  create(input: NewTestimony, status: "approved" | "pending"): Promise<Testimony>;
  amen(id: string): Promise<number | null>;
  currentWord(): Promise<DailyWord | null>;
}

type Row = Testimony & { status: "approved" | "pending" };

const COUNTRIES_ALL = COUNTRIES.map((c) => c.code);

const g = globalThis as unknown as { __tlRows?: Row[]; __tlSeedSig?: string; __tlStoreLogged?: boolean };

/** Dev-only: TL_STRESS_ROWS=1000000 fills the in-memory store with that many fake testimonies. */
const STRESS_ROWS = process.env.NODE_ENV === "production" ? 0 : Number(process.env.TL_STRESS_ROWS ?? 0) || 0;

/** Changes whenever seed.ts is edited, so dev hot-reload re-seeds instead of serving stale rows. */
function seedSignature(): string {
  return (
    buildSeed(0)
      .map((t) => `${t.id}:${t.countryCode}`)
      .join("|") + `#${STRESS_ROWS}`
  );
}

const STRESS_COUNTRIES = ["NG", "NG", "NG", "NG", "US", "US", "US", "GB", "GB", "GH", "GH", "KE", "KE", "ZA", "ZA", "IN", "IN", "BR", "CA", "DE", "AU", "PH", "UG", "TZ", "CM", "JM", "FR", "ID", "MX", "SG", "MT", "MU", "SC"];

function stressRows(n: number, nowMs: number): Row[] {
  const texts = buildSeed(0).map((t) => t.text);
  const spacing = (60 * 24 * 60 * 60 * 1000) / n; // spread over the last 60 days
  const out: Row[] = new Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = {
      id: `stress-${i}`,
      name: i % 3 === 0 ? null : "Tester",
      countryCode: i % 40 === 0 ? COUNTRIES_ALL[(i / 40) % COUNTRIES_ALL.length] : STRESS_COUNTRIES[(i * 7919) % STRESS_COUNTRIES.length],
      text: texts[i % texts.length],
      createdAt: new Date(nowMs - (n - i) * spacing).toISOString(),
      amens: i % 17,
      status: "approved",
    };
  }
  return out;
}

/** Oldest first. New testimonies are always pushed on the end, so it stays sorted. */
function rows(): Row[] {
  const sig = process.env.NODE_ENV === "production" ? "" : seedSignature();
  if (!g.__tlRows || g.__tlSeedSig !== sig) {
    const seed = buildSeed(Date.now()).map((t) => ({ ...t, status: "approved" as const }));
    const all = STRESS_ROWS > 0 ? [...stressRows(STRESS_ROWS, Date.now()), ...seed] : seed;
    all.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
    g.__tlRows = all;
    g.__tlSeedSig = sig;
  }
  return g.__tlRows;
}

function toPublic(row: Row): Testimony {
  return {
    id: row.id,
    name: row.name,
    countryCode: row.countryCode,
    text: row.text,
    createdAt: row.createdAt,
    amens: row.amens,
  };
}

const memoryStore: TestimonyStore = {
  async recent(limit) {
    const all = rows();
    const out: Testimony[] = [];
    for (let i = all.length - 1; i >= 0 && out.length < limit; i--) {
      if (all[i].status === "approved") out.push(toPublic(all[i]));
    }
    return out;
  },

  async page({ limit, cursor }) {
    const all = rows();
    // start just before the cursor: the first index whose (createdAt, id) is not older than it
    let i = all.length - 1;
    if (cursor) {
      const c = decodeCursor(cursor);
      let lo = 0;
      let hi = all.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        const r = all[mid];
        const older = r.createdAt < c.createdAt || (r.createdAt === c.createdAt && r.id < c.id);
        if (older) lo = mid + 1;
        else hi = mid;
      }
      i = lo - 1;
    }
    const items: Testimony[] = [];
    let last: Row | null = null;
    for (; i >= 0 && items.length < limit; i--) {
      if (all[i].status !== "approved") continue;
      items.push(toPublic(all[i]));
      last = all[i];
    }
    let more = false;
    for (; i >= 0; i--) {
      if (all[i].status === "approved") {
        more = true;
        break;
      }
    }
    return { items, nextCursor: more && last ? encodeCursor(last.createdAt, last.id) : null };
  },

  async countsByCountry() {
    const counts: Record<string, number> = {};
    for (const r of rows()) {
      if (r.status === "approved") counts[r.countryCode] = (counts[r.countryCode] ?? 0) + 1;
    }
    return counts;
  },

  async countSince(iso) {
    const all = rows();
    let n = 0;
    for (let i = all.length - 1; i >= 0 && all[i].createdAt >= iso; i--) {
      if (all[i].status === "approved") n++;
    }
    return n;
  },

  async create(input, status) {
    const row: Row = {
      id: crypto.randomUUID(),
      name: input.name,
      countryCode: input.countryCode,
      text: input.text,
      createdAt: new Date().toISOString(),
      amens: 0,
      status,
    };
    rows().push(row);
    return toPublic(row);
  },

  async amen(id) {
    const row = rows().find((r) => r.id === id && r.status === "approved");
    if (!row) return null;
    row.amens += 1;
    return row.amens;
  },

  async currentWord() {
    return pickCurrentWord(DAILY_WORDS, Date.now());
  },
};

// ---- Supabase ---------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DbRow = {
  id: string;
  name: string | null;
  country_code: string;
  text: string;
  amens: number;
  created_at: string;
};

const COLUMNS = "id, name, country_code, text, amens, created_at";

function fromDb(r: DbRow): Testimony {
  return {
    id: r.id,
    name: r.name,
    countryCode: r.country_code.trim().toUpperCase(),
    text: r.text,
    createdAt: r.created_at,
    amens: r.amens,
  };
}

function createSupabaseStore(url: string, key: string): TestimonyStore {
  // The service-role key bypasses RLS. It lives only on the server and is never sent to the browser.
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  return {
    async recent(limit) {
      const { data, error } = await db
        .from("testimonies")
        .select(COLUMNS)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit);
      if (error) throw new Error(`Supabase recent failed: ${error.message}`);
      return (data as DbRow[]).map(fromDb);
    },

    async page({ limit, cursor }) {
      let q = db
        .from("testimonies")
        .select(COLUMNS)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit + 1); // one extra row tells us whether another page exists
      if (cursor) {
        const c = decodeCursor(cursor);
        if (!UUID.test(c.id)) throw new BadCursorError();
        // strictly older than the last row the client has, ties broken by id
        q = q.or(`created_at.lt."${c.createdAt}",and(created_at.eq."${c.createdAt}",id.lt.${c.id})`);
      }
      const { data, error } = await q;
      if (error) throw new Error(`Supabase page failed: ${error.message}`);
      const rows = data as DbRow[];
      const slice = rows.slice(0, limit);
      const last = slice[slice.length - 1];
      return {
        items: slice.map(fromDb),
        nextCursor: rows.length > limit && last ? encodeCursor(last.created_at, last.id) : null,
      };
    },

    async countsByCountry() {
      const { data, error } = await db.rpc("country_counts");
      if (error) throw new Error(`Supabase counts failed: ${error.message}`);
      const counts: Record<string, number> = {};
      for (const r of (data ?? []) as { country_code: string; n: number | string }[]) {
        counts[r.country_code.trim().toUpperCase()] = Number(r.n);
      }
      return counts;
    },

    async countSince(iso) {
      const { count, error } = await db
        .from("testimonies")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved")
        .gte("created_at", iso);
      if (error) throw new Error(`Supabase count failed: ${error.message}`);
      return count ?? 0;
    },

    async create(input, status) {
      const { data, error } = await db
        .from("testimonies")
        .insert({
          name: input.name,
          country_code: input.countryCode,
          text: input.text,
          status,
        })
        .select(COLUMNS)
        .single();
      if (error) throw new Error(`Supabase insert failed: ${error.message}`);
      return fromDb(data as DbRow);
    },

    async amen(id) {
      if (!UUID.test(id)) return null; // sample or queued ids are not database rows
      const { data, error } = await db.rpc("increment_amen", { t_id: id });
      if (error) throw new Error(`Supabase amen failed: ${error.message}`);
      return typeof data === "number" ? data : null;
    },

    async currentWord() {
      const { from, to } = currentWindow(Date.now());
      const { data, error } = await db
        .from("daily_words")
        .select("date, word, points")
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`Supabase daily word failed: ${error.message}`);
      if (!data) return null;
      return { date: data.date as string, word: data.word as string, points: (data.points as string[] | null) ?? [] };
    },
  };
}

const useSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);
if (!g.__tlStoreLogged) {
  g.__tlStoreLogged = true;
  console.info(`[thanksliving] storage: ${useSupabase ? "Supabase" : "in-memory (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to persist)"}`);
}

export const store: TestimonyStore =
  SUPABASE_URL && SUPABASE_KEY ? createSupabaseStore(SUPABASE_URL, SUPABASE_KEY) : memoryStore;
