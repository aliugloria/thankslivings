import { connection } from "next/server";
import { getSnapshot } from "@/lib/server/snapshot";

export async function GET() {
  await connection();
  const snapshot = await getSnapshot();
  return Response.json(snapshot, {
    // shared by every visitor for 15s; a stale copy is fine while a fresh one loads
    headers: { "Cache-Control": "public, max-age=0, s-maxage=15, stale-while-revalidate=30" },
  });
}
