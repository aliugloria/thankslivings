import { ENDPOINTS } from "../config";
import { fetchJson } from "../http";
import type { GlobeSnapshot, NewTestimony, Testimony, TestimonyPage } from "@/lib/types";

/** Talks to the real backend. Everything here may throw; callers own the fallbacks. */
export const remoteProvider = {
  snapshot(): Promise<GlobeSnapshot> {
    return fetchJson<GlobeSnapshot>(ENDPOINTS.globe(), { method: "GET", cache: "no-store" });
  },

  page(cursor: string | null, limit: number): Promise<TestimonyPage> {
    return fetchJson<TestimonyPage>(ENDPOINTS.testimoniesPage(cursor, limit), {
      method: "GET",
      cache: "no-store",
    });
  },

  create(input: NewTestimony): Promise<{ item: Testimony; pending: boolean }> {
    // One retry only: a duplicate post is worse than a slow one.
    return fetchJson(
      ENDPOINTS.testimonies(),
      { method: "POST", body: JSON.stringify(input) },
      { retries: 1 },
    );
  },

  amen(id: string): Promise<{ amens: number }> {
    return fetchJson(ENDPOINTS.amen(id), { method: "POST" }, { retries: 0 });
  },
};
