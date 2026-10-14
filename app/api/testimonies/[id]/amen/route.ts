import { connection } from "next/server";
import type { NextRequest } from "next/server";
import { clientKey, rateLimit } from "@/lib/server/rate-limit";
import { store } from "@/lib/server/store";

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/testimonies/[id]/amen">,
) {
  await connection();

  const limited = rateLimit(`amen:${clientKey(request)}`, {
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.ok) {
    return Response.json({ error: "Slow down a little." }, { status: 429 });
  }

  const { id } = await ctx.params;
  const amens = await store.amen(id);
  if (amens === null) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  return Response.json({ amens }, { headers: { "Cache-Control": "no-store" } });
}
