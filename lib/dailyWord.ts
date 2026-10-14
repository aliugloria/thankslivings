/**
 * Rhema Word for the Day, taken from the Hallelujah Challenge.
 *
 * Add one entry a day. `date` is the day it should appear (Lagos time, YYYY-MM-DD),
 * `word` is the word of the day, and `points` are short takeaways from the service.
 * If there is no entry for today, the popup and the header chip simply don't show,
 * so the site never presents yesterday's word as today's.
 *
 * Later this can move to a Supabase table with the same three fields.
 */
export type DailyWord = {
  date: string;
  word: string;
  points?: string[];
};

export const DAILY_WORDS: DailyWord[] = [
  {
    date: "2026-10-14",
    word: "Breakforth",
    // Add the points from the service here, one short line each, for example:
    // points: ["First point from the service.", "Second point from the service."],
    points: [],
  },
];

const BY_DATE = new Map(DAILY_WORDS.map((w) => [w.date, w]));

/** Calendar date in Lagos as YYYY-MM-DD, whatever time zone the visitor is in. */
export function lagosDateKey(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ms);
}

export function wordFor(ms: number): DailyWord | null {
  return BY_DATE.get(lagosDateKey(ms)) ?? null;
}
