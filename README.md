# Thanksliving

A map of gratitude. People drop a testimony, a glowing dot lands inside their country, and a thin line connects it to the rest of the world.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

No database or keys needed yet: the backend runs on an in-memory store seeded with 33 sample testimonies.

## How the data layer fails gracefully (`lib/api/`)

Reading (`loadTestimonies`) never throws. It falls back in order:

1. **Remote API** — `GET /api/testimonies`, with a 6s timeout and 2 retries (exponential backoff).
2. **Browser cache** — the last good response, kept in `localStorage`.
3. **Seed data** — `lib/seed.ts`, so the map is never empty.

The footer tells the visitor honestly when they are not seeing live data.

Writing (`submitTestimony`) never loses a testimony:

- Network error, timeout, 5xx or 429 → saved to an **offline queue** on the device, shown on the map immediately, and sent automatically when the connection returns (`online` event, next load).
- Real rejections (validation, rate limit message) → thrown, so the form can show the reason.

```
lib/api/
  config.ts            base URL, timeouts, polling interval
  http.ts              fetchJson: timeout + retry/backoff, ApiError, isRetriable
  providers/remote.ts  talks to the backend (may throw)
  providers/local.ts   localStorage cache, offline queue, "amened" set
  testimonies.ts       the fallback chains the UI actually calls
```

Point the frontend at a separate backend with `NEXT_PUBLIC_API_BASE=https://your-api.example.com`.

## Backend (`app/api/`, `lib/server/`)

- `GET /api/testimonies` — approved testimonies + the last-24h count
- `POST /api/testimonies` — validates, rate-limits (5/hour/IP), runs basic moderation; flagged ones are stored as `pending` and never listed
- `POST /api/testimonies/:id/amen`

`lib/server/store.ts` defines a `TestimonyStore` interface. To go real, implement it against Supabase (`supabase/schema.sql` is ready) and export that instead. Nothing else changes.

## Privacy by design

Only the **country** is stored. The dot position is derived in the browser from the testimony id and the country's shape (`lib/geo.ts`), so a precise location never exists, and anonymous testimonies carry no name.

## Theming

All colours are CSS variables in `app/globals.css`. Dark mode is already defined on `[data-theme="dark"]`; add a toggle that sets that attribute on `<html>` when you want it.

## Before you launch

- [ ] Replace the seed testimonies with real, permissioned ones
- [ ] Swap the in-memory store for Supabase
- [ ] Replace the starter profanity/link filter with a real moderation step
- [ ] Add Cloudflare Turnstile to the submit form
- [ ] Drop the circle-of-hands artwork into `components/Loader.tsx`
- [ ] Move rate limiting out of memory (Upstash/Redis) if you run more than one instance
