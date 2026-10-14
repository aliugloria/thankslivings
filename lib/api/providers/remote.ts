import { ENDPOINTS } from "../config";
import { fetchJson } from "../http";
import type {
  NewTestimony,
  Testimony,
  TestimonyListResponse,
} from "@/lib/types";

/** Talks to the real backend. Everything here may throw; callers own the fallbacks. */
export const remoteProvider = {
  list(): Promise<TestimonyListResponse> {
    return fetchJson<TestimonyListResponse>(ENDPOINTS.testimonies(), {
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
