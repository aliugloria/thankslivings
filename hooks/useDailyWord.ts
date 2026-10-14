"use client";

import { useSyncExternalStore } from "react";
import { wordFor, type DailyWord } from "@/lib/dailyWord";

// Re-check once a minute so the word rolls over at midnight in Lagos without a reload.
function subscribe(onChange: () => void) {
  const id = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(id);
}

/**
 * Today's word, or null. The server render (and the static prerender) always sees null,
 * so a page built yesterday can never show a stale word; the browser fills it in.
 */
export function useDailyWord(): DailyWord | null {
  return useSyncExternalStore(
    subscribe,
    () => wordFor(Date.now()),
    () => null,
  );
}
