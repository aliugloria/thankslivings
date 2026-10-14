import { API_CONFIG } from "./config";

export class ApiError extends Error {
  status?: number;
  /** true when trying again later could work (network, timeout, 5xx, 429) */
  retriable: boolean;

  constructor(message: string, opts: { status?: number; retriable: boolean }) {
    super(message);
    this.name = "ApiError";
    this.status = opts.status;
    this.retriable = opts.retriable;
  }
}

/** true when the failure is worth retrying or queueing (network, timeout, 5xx, 429) */
export function isRetriable(err: unknown): boolean {
  return err instanceof ApiError ? err.retriable : true;
}

type Options = { timeoutMs?: number; retries?: number; backoffMs?: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch + JSON with a timeout and bounded retries (exponential backoff).
 * 4xx errors (other than 429) are the caller's fault, so they are never retried.
 */
export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  {
    timeoutMs = API_CONFIG.timeoutMs,
    retries = API_CONFIG.retries,
    backoffMs = API_CONFIG.backoffMs,
  }: Options = {},
): Promise<T> {
  let lastError: ApiError | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: { "Content-Type": "application/json", ...init.headers },
      });

      if (res.ok) return (await res.json()) as T;

      let message = `Request failed (${res.status})`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) message = body.error;
      } catch {
        /* non-JSON error body */
      }
      const retriable = res.status >= 500 || res.status === 429;
      lastError = new ApiError(message, { status: res.status, retriable });
      if (!retriable) throw lastError;
    } catch (err) {
      if (err instanceof ApiError) {
        lastError = err;
        if (!err.retriable) throw err;
      } else {
        const aborted = err instanceof DOMException && err.name === "AbortError";
        lastError = new ApiError(
          aborted ? "The request timed out" : "Network error",
          { retriable: true },
        );
      }
    } finally {
      clearTimeout(timer);
    }

    if (attempt < retries) await sleep(backoffMs * 2 ** attempt);
  }

  throw lastError ?? new ApiError("Request failed", { retriable: true });
}
