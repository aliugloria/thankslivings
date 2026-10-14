import { isKnownCountry } from "./countries";
import type { NewTestimony } from "./types";

export const MIN_TEXT = 10;
export const MAX_TEXT = 280;
export const MAX_NAME = 40;

export type ValidationResult =
  | { ok: true; value: NewTestimony }
  | { ok: false; error: string };

/** Shared by the form (instant feedback) and the route handler (the real gate). */
export function validateNewTestimony(input: unknown): ValidationResult {
  if (typeof input !== "object" || input === null) {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  const raw = input as Record<string, unknown>;

  const text = typeof raw.text === "string" ? raw.text.trim() : "";
  if (text.length < MIN_TEXT) {
    return { ok: false, error: `Share a little more (at least ${MIN_TEXT} characters).` };
  }
  if (text.length > MAX_TEXT) {
    return { ok: false, error: `Please keep it under ${MAX_TEXT} characters.` };
  }

  const countryCode =
    typeof raw.countryCode === "string" ? raw.countryCode.trim().toUpperCase() : "";
  if (!isKnownCountry(countryCode)) {
    return { ok: false, error: "Please choose your country." };
  }

  let name: string | null = null;
  if (typeof raw.name === "string" && raw.name.trim()) {
    name = raw.name.trim().replace(/\s+/g, " ");
    if (name.length > MAX_NAME) {
      return { ok: false, error: `Names can be up to ${MAX_NAME} characters.` };
    }
  }

  return { ok: true, value: { name, countryCode, text } };
}

const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|ng|xyz|ru|info)\b)/i;
// Deliberately tiny starter list. Swap for a real moderation service before launch.
const BLOCKED = ["viagra", "casino", "crypto giveaway", "porn", "xxx"];

/** "flagged" testimonies are stored as pending and never shown until reviewed. */
export function moderate(text: string, name: string | null): "clean" | "flagged" {
  const haystack = `${text} ${name ?? ""}`.toLowerCase();
  if (LINK.test(haystack)) return "flagged";
  if (BLOCKED.some((w) => haystack.includes(w))) return "flagged";
  return "clean";
}
