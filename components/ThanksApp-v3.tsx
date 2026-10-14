"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { useStoredState } from "@/hooks/useStoredState";
import { useTestimonies } from "@/hooks/useTestimonies";
import type { NewTestimony } from "@/lib/types";
import { AddModal } from "./AddModal";
import { CounterPill } from "./CounterPill";
import { ListPanel } from "./ListPanel";
import { Loader } from "./Loader";
import { GlobeView } from "./GlobeView";
import { ThemeToggle } from "./ThemeToggle";
import { ViewToggle, type ViewMode } from "./ViewToggle";
import { WorldMap } from "./WorldMap";

export function ThanksApp() {
  const { items, todayCount, source, now, submit, amen } = useTestimonies();
  const [view, setView] = useStoredState<ViewMode>("tl:view", "globe", [
    "globe",
    "map",
  ]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const changeView = useCallback(
    (v: ViewMode) => {
      setSelectedId(null);
      setView(v);
    },
    [setView],
  );
  const [listOpen, setListOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Escape closes the top-most layer first: modal, then popover, then list
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (modalOpen) setModalOpen(false);
      else if (selectedId) setSelectedId(null);
      else if (listOpen) setListOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modalOpen, selectedId, listOpen]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const dismissMapLayers = useCallback(() => {
    setSelectedId(null);
    setListOpen(false);
  }, []);

  const handleSelectFromList = useCallback((id: string) => {
    setSelectedId(id);
    // on phones the sheet would cover the popover, so tuck it away
    if (window.matchMedia("(max-width: 767px)").matches) setListOpen(false);
  }, []);

  const handleSubmit = useCallback(
    async (input: NewTestimony) => {
      const result = await submit(input);
      setModalOpen(false);
      setListOpen(false);
      setSelectedId(result.testimony.id);
      if (result.status === "queued") {
        setToast(
          "Saved on this device. We'll share it as soon as you're back online.",
        );
      } else if (result.pendingReview) {
        setToast("Thank you! Your testimony will appear after a quick review.");
      } else {
        setToast("Your dot is on the map. Thank you for sharing.");
      }
    },
    [submit],
  );

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg">
      <Loader />

      <header className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-4 md:p-6">
        <div className="border ">
          <>
            <img
              src="/logo-dark.svg"
              alt="Thanksliving"
              className="h-10 w-10 md:h-20 md:w-20  dark:hidden"
            />
            <img
              src="/logo-light.svg"
              alt=""
              aria-hidden
              className="hidden h-10 w-10 md:h-20 md:w-20 dark:block"
            />
          </>
          {/* <p>The act <span>of</span></p>
          <h1 className="font-script text-4xl md:text-5xl">Thanksliving</h1>
          <p className="mt-1 hidden text-xs tracking-wide text-muted sm:block">Thank God with the world.</p> */}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <ViewToggle value={view} onChange={changeView} />
          <ThemeToggle />
          <CounterPill
            count={todayCount}
            open={listOpen}
            onToggle={() => setListOpen((v) => !v)}
          />
        </div>
      </header>

      <div className="absolute inset-0 grid place-items-center px-2 pb-24 pt-28 sm:pt-20 md:px-8">
        {view === "globe" ? (
          <GlobeView
            items={items}
            selectedId={selectedId}
            now={now}
            onSelect={setSelectedId}
            onDismiss={dismissMapLayers}
            onClearSelection={() => setSelectedId(null)}
            onAmen={amen}
          />
        ) : (
          <WorldMap
            items={items}
            selectedId={selectedId}
            now={now}
            onSelect={setSelectedId}
            onDismiss={dismissMapLayers}
            onAmen={amen}
          />
        )}
      </div>

      <footer className="pointer-events-none absolute bottom-0 left-0 z-10 p-4 md:p-6">
        <p className="text-[11px] font-medium uppercase leading-snug tracking-[0.14em] text-muted">
          Real people. Real stories.
          <br />
          One God.
        </p>
        {source !== null && source !== "remote" && (
          <p className="mt-2 text-[11px] normal-case tracking-normal text-muted/80">
            {source === "seed"
              ? "Offline preview: showing sample testimonies."
              : "Offline: showing the last testimonies we saved."}
          </p>
        )}
      </footer>

      <button
        type="button"
        onClick={() => setModalOpen(true)}
        aria-label="Share what God has done for you"
        className="absolute bottom-4 right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-ink text-bg shadow-card transition-transform hover:scale-105 active:scale-95 md:bottom-6 md:right-6"
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
          <path
            d="M11 4v14M4 11h14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <ListPanel
        open={listOpen}
        items={items}
        count={todayCount}
        now={now}
        onSelect={handleSelectFromList}
        onClose={() => setListOpen(false)}
      />

      <AddModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-24 left-1/2 z-[55] w-[min(92vw,26rem)] -translate-x-1/2 rounded-xl bg-ink px-4 py-3 text-center text-sm text-bg shadow-card md:bottom-8"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
