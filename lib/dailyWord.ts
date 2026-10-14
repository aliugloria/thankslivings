/**
 * Rhema Word for the Day, taken from the Hallelujah Challenge.
 *
 * The words live in the Supabase `daily_words` table: add one row a night
 * (date, word, points). This file holds the type, the "which word is current"
 * rule, and an optional offline fallback list used when Supabase isn't configured.
 */
export type DailyWord = {
  date: string;
  word: string;
  points?: string[];
};

/** Offline fallback only. Leave empty in production: the database is the source of truth. */
export const DAILY_WORDS: DailyWord[] = [];

/** Calendar date in Lagos as YYYY-MM-DD, whatever time zone the visitor is in. */
export function lagosDateKey(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ms);
}

const DAY = 24 * 60 * 60 * 1000;

/** The oldest and newest entry dates that count as "current" right now (Lagos time). */
export function currentWindow(nowMs: number): { from: string; to: string } {
  return { from: lagosDateKey(nowMs - DAY), to: lagosDateKey(nowMs) };
}

/**
 * The current word: the newest entry dated today or yesterday. Services run late at night,
 * so last night's word stays up until tonight's replaces it, but anything older is hidden
 * rather than passed off as current.
 */
export function pickCurrentWord(words: DailyWord[], nowMs: number): DailyWord | null {
  const { from, to } = currentWindow(nowMs);
  let best: DailyWord | null = null;
  for (const w of words) {
    if (w.date < from || w.date > to) continue;
    if (!best || w.date > best.date) best = w;
  }
  return best;
}
