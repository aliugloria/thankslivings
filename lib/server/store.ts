import "server-only";
import { buildSeed } from "@/lib/seed";
import type { NewTestimony, Testimony } from "@/lib/types";

/**
 * Storage boundary for the backend.
 *
 * Today this is an in-memory store seeded with sample testimonies, so the whole
 * app runs with zero setup. It resets whenever the server restarts.
 * To go real, implement the same `TestimonyStore` shape against Supabase
 * (see supabase/schema.sql) and export that instead. Nothing else has to change.
 */
export interface TestimonyStore {
  listApproved(): Promise<Testimony[]>;
  create(input: NewTestimony, status: "approved" | "pending"): Promise<Testimony>;
  amen(id: string): Promise<number | null>;
}

type Row = Testimony & { status: "approved" | "pending" };

const g = globalThis as unknown as { __tlRows?: Row[] };

function rows(): Row[] {
  if (!g.__tlRows) {
    g.__tlRows = buildSeed(Date.now()).map((t) => ({ ...t, status: "approved" as const }));
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
};

export const store: TestimonyStore = memoryStore;
