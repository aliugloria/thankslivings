import { connection } from "next/server";
import { store } from "@/lib/server/store";

export async function GET() {
  await connection(); // depends on today's date, so never prerendered

  const word = await store.currentWord();
  return Response.json(
    { word },
    // one word a day: a short shared cache keeps this off the database under load
    { headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } },
  );
}
