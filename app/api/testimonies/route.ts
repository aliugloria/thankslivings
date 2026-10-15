import { connection } from "next/server";
import { clientKey, rateLimit } from "@/lib/server/rate-limit";
import { BadCursorError } from "@/lib/server/cursor";
import { getSnapshot } from "@/lib/server/snapshot";
import { store } from "@/lib/server/store";
import { moderate, validateNewTestimony } from "@/lib/validation";
import type { TestimonyPage } from "@/lib/types";

const NO_STORE = { "Cache-Control": "no-store" };
const PAGE_DEFAULT = 60;
const PAGE_MAX = 100;

/** One page of every testimony, newest first. Follow `nextCursor` for the next. */
export async function GET(request: Request) {
  await connection(); // always request-time: the list changes constantly

  const params = new URL(request.url).searchParams;
  const asked = Number.parseInt(params.get("limit") ?? "", 10);
  const limit = Number.isFinite(asked) ? Math.min(Math.max(asked, 1), PAGE_MAX) : PAGE_DEFAULT;

  try {
    const [page, snapshot] = await Promise.all([
      store.page({ limit, cursor: params.get("cursor") }),
      getSnapshot(),
    ]);
    const body: TestimonyPage = { items: page.items, nextCursor: page.nextCursor, total: snapshot.total };
    return Response.json(body, {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=10, stale-while-revalidate=30" },
    });
  } catch (err) {
    if (err instanceof BadCursorError) {
      return Response.json({ error: "Invalid cursor." }, { status: 400, headers: NO_STORE });
    }
    throw err;
  }
}

export async function POST(request: Request) {
  await connection();

  const limited = rateLimit(`post:${clientKey(request)}`, {
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.ok) {
    return Response.json(
      { error: "You've shared a lot today. Please try again a little later." },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400, headers: NO_STORE });
  }

  const result = validateNewTestimony(json);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 422, headers: NO_STORE });
  }

  const verdict = moderate(result.value.text, result.value.name);
  const status = verdict === "clean" ? "approved" : "pending";
  const item = await store.create(result.value, status);

  return Response.json(
    { item, pending: status === "pending" },
    { status: 201, headers: NO_STORE },
  );
}
