"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_CONFIG } from "@/lib/api/config";
import {
  flushQueue,
  hasAmened,
  loadSnapshot,
  sendAmen,
  submitTestimony,
  type SubmitResult,
} from "@/lib/api/testimonies";
import type { DataSource, NewTestimony, Testimony } from "@/lib/types";

const DAY = 24 * 60 * 60 * 1000;
const MIN_GAP_MS = 10_000;

export function useTestimonies() {
  const [items, setItems] = useState<Testimony[]>([]);
  const [serverCount, setServerCount] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [source, setSource] = useState<DataSource | null>(null);
  const [now, setNow] = useState<number | null>(null);

  /** ids this visitor created in this session, kept visible even if the server hides them */
  const mine = useRef(new Map<string, Testimony>());
  const lastRefresh = useRef(0);

  const refresh = useCallback(async () => {
    const { data, source } = await loadSnapshot();
    const serverIds = new Set(data.recent.map((t) => t.id));
    const keep = [...mine.current.values()].filter((t) => !serverIds.has(t.id));
    setItems([...data.recent, ...keep]);
    setServerCount(data.todayCount);
    setCounts(data.counts);
    setTotal(data.total);
    lastRefresh.current = Date.now();
    setSource(source);
    setNow(Date.now());
  }, []);

  // first load + flush anything queued while offline
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await flushQueue();
      if (!cancelled) await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // live updates: poll while visible, catch up when the tab returns, retry queue when back online
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      // flicking between tabs shouldn't hammer the server
      if (Date.now() - lastRefresh.current < MIN_GAP_MS) return;
      void refresh();
    };
    const id = window.setInterval(tick, API_CONFIG.pollMs);
    const onOnline = async () => {
      await flushQueue();
      await refresh();
    };
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("online", onOnline);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("online", onOnline);
    };
  }, [refresh]);

  // keep relative times ("2m ago") fresh
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const todayCount = useMemo(() => {
    if (now === null) return null;
    const local = items.filter((t) => now - new Date(t.createdAt).getTime() < DAY).length;
    return Math.max(serverCount, local);
  }, [items, now, serverCount]);

  const submit = useCallback(async (input: NewTestimony): Promise<SubmitResult> => {
    const result = await submitTestimony(input);
    mine.current.set(result.testimony.id, result.testimony);
    setNow(Date.now());
    setItems((prev) => [...prev.filter((t) => t.id !== result.testimony.id), result.testimony]);
    return result;
  }, []);

  const amen = useCallback((id: string) => {
    if (hasAmened(id)) return;
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, amens: t.amens + 1 } : t)));
    void sendAmen(id);
  }, []);

  return { items, counts, total, todayCount, source, now, submit, amen };
}
