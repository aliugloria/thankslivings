import { connection } from "next/server";
import { clientKey, rateLimit } from "@/lib/server/rate-limit";
import { store } from "@/lib/server/store";
import { moderate, validateNewTestimony } from "@/lib/validation";
import type { TestimonyListResponse } from "@/lib/types";

const DAY = 24 * 60 * 60 * 1000;
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  await connection(); // always request-time: the list changes constantly

  const items = await store.listApproved();
  const now = Date.now();
  const body: TestimonyListResponse = {
    items,
    todayCount: items.filter((t) => now - new Date(t.createdAt).getTime() < DAY).length,
  };
  return Response.json(body, { headers: NO_STORE });
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
