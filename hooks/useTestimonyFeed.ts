"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { hasAmened, loadPage, sendAmen } from "@/lib/api/testimonies";
import { API_CONFIG } from "@/lib/api/config";
import type { DataSource, Testimony } from "@/lib/types";

const PAGE_SIZE = 60;

/** Appends, skipping anything already shown. */
function append(prev: Testimony[], next: Testimony[]): Testimony[] {
  const seen = new Set(prev.map((t) => t.id));
  return [...prev, ...next.filter((t) => !seen.has(t.id))];
}

/**
 * The full list of testimonies, loaded a page at a time as you scroll, newest first, so
 * the page costs the same with ten testimonies or ten million. A light poll slips brand-new
 * ones in at the top.
 */
export function useTestimonyFeed() {
  const [items, setItems] = useState<Testimony[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [source, setSource] = useState<DataSource | null>(null);
  const [now, setNow] = useState<number | null>(null);

  const cursor = useRef<string | null>(null);
  const busy = useRef(false);
  const more = useRef(true);

  const loadMore = useCallback(async () => {
    if (busy.current || !more.current) return;
    busy.current = true;
    setLoading(true);
    setFailed(false);
    try {
      const { page, source } = await loadPage(cursor.current, PAGE_SIZE);
      cursor.current = page.nextCursor;
      more.current = page.nextCursor !== null;
      setHasMore(more.current);
      setItems((prev) => append(prev, page.items));
      setTotal(page.total);
      setSource((prev) => prev ?? source);
      setNow(Date.now());
    } catch {
      setFailed(true); // keep what we have; scrolling again retries
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMore();
  }, [loadMore]);

  // slip new testimonies in at the top, without disturbing the scroll position
  useEffect(() => {
    if (source !== "remote") return;
    const id = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const { page } = await loadPage(null, PAGE_SIZE);
        setTotal(page.total);
        setNow(Date.now());
        setItems((prev) => {
          const seen = new Set(prev.map((t) => t.id));
          const fresh = page.items.filter((t) => !seen.has(t.id));
          return fresh.length > 0 ? [...fresh, ...prev] : prev;
        });
      } catch {
        /* the next tick tries again */
      }
    }, API_CONFIG.pollMs);
    return () => window.clearInterval(id);
  }, [source]);

  const amen = useCallback((id: string) => {
    if (hasAmened(id)) return;
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, amens: t.amens + 1 } : t)));
    void sendAmen(id);
  }, []);

  return { items, total, hasMore, loading, failed, source, now, loadMore, amen };
}
