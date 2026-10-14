"use client";

import { useEffect, useState } from "react";
import { DAILY_WORDS, pickCurrentWord, type DailyWord } from "@/lib/dailyWord";

const REFRESH_MS = 10 * 60 * 1000;

/**
 * Today's word from /api/daily-word (Supabase), or null. If the API is unreachable we fall
 * back to the bundled list, so a blip never hides the word or shows a stale one.
 */
export function useDailyWord(): DailyWord | null {
  const [word, setWord] = useState<DailyWord | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      let next: DailyWord | null;
      try {
        const res = await fetch("/api/daily-word", { signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        next = ((await res.json()) as { word: DailyWord | null }).word;
      } catch {
        next = pickCurrentWord(DAILY_WORDS, Date.now());
      }
      if (cancelled) return;
      // keep the same object when nothing changed so effects keyed on it don't re-run
      setWord((prev) => (prev && next && prev.date === next.date && prev.word === next.word ? prev : next));
    }

    void load();
    const id = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return word;
}
