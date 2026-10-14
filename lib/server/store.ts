import "server-only";
import { createClient } from "@supabase/supabase-js";
import { currentWindow, DAILY_WORDS, pickCurrentWord, type DailyWord } from "@/lib/dailyWord";
import { buildSeed } from "@/lib/seed";
import type { NewTestimony, Testimony } from "@/lib/types";

/**
 * Storage boundary for the backend.
 *
 * With SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set (see .env.local) the app uses
 * Supabase. Without them it falls back to an in-memory store seeded with sample
 * testimonies, so the whole app still runs with zero setup (it resets on restart).
 */
export interface TestimonyStore {
  listApproved(): Promise<Testimony[]>;
  create(input: NewTestimony, status: "approved" | "pending"): Promise<Testimony>;
  amen(id: string): Promise<number | null>;
  currentWord(): Promise<DailyWord | null>;
}

type Row = Testimony & { status: "approved" | "pending" };

const g = globalThis as unknown as { __tlRows?: Row[]; __tlSeedSig?: string; __tlStoreLogged?: boolean };

/** Changes whenever seed.ts is edited, so dev hot-reload re-seeds instead of serving stale rows. */
function seedSignature(): string {
  return buildSeed(0)
    .map((t) => `${t.id}:${t.countryCode}`)
    .join("|");
}

function rows(): Row[] {
  const sig = process.env.NODE_ENV === "production" ? "" : seedSignature();
  if (!g.__tlRows || g.__tlSeedSig !== sig) {
    g.__tlRows = buildSeed(Date.now()).map((t) => ({ ...t, status: "approved" as const }));
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
  async listApproved() {
    return rows()
      .filter((r) => r.status === "approved")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(toPublic);
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

/** PostgREST returns at most 1000 rows per request, so we page. */
const PAGE = 1000;
/** Newest testimonies the API will send in one go. Chunked loading replaces this later. */
const MAX_LIST = 5000;

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
    async listApproved() {
      const out: Testimony[] = [];
      for (let from = 0; from < MAX_LIST; from += PAGE) {
        const { data, error } = await db
          .from("testimonies")
          .select(COLUMNS)
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) throw new Error(`Supabase list failed: ${error.message}`);
        out.push(...(data as DbRow[]).map(fromDb));
        if (!data || data.length < PAGE) break;
      }
      return out.reverse(); // oldest first, like the in-memory store
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
