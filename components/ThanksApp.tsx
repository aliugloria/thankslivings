// "use client";

// import { AnimatePresence, motion } from "framer-motion";
// import { useCallback, useEffect, useState } from "react";
// import { useDailyWord } from "@/hooks/useDailyWord";
// import { useAmbientCloud } from "@/hooks/useAmbientCloud";
// import { useStoredState } from "@/hooks/useStoredState";
// import { useTestimonies } from "@/hooks/useTestimonies";
// import type { NewTestimony } from "@/lib/types";
// import { AddModal } from "./AddModal";
// import { CounterPill } from "./CounterPill";
// import { DailyWordModal } from "./DailyWordModal";
// import { ListPanel } from "./ListPanel";
// import { Loader } from "./Loader";
// import { GlobeView } from "./GlobeView";
// import { ThemeToggle } from "./ThemeToggle";
// import { ViewToggle, type ViewMode } from "./ViewToggle";
// import { WorldMap } from "./WorldMap";
// import Link from "next/link";

// const WORD_SEEN_KEY = "tl:word-seen";

// export function ThanksApp() {
//   const { items, counts, total, todayCount, source, now, submit, amen } =
//     useTestimonies();
//   const ambient = useAmbientCloud(counts, items);
//   const [view, setView] = useStoredState<ViewMode>("tl:view", "globe", [
//     "globe",
//     "map",
//   ]);
//   const [selectedId, setSelectedId] = useState<string | null>(null);
//   const changeView = useCallback(
//     (v: ViewMode) => {
//       setSelectedId(null);
//       setView(v);
//     },
//     [setView],
//   );
//   const [listOpen, setListOpen] = useState(false);
//   const [modalOpen, setModalOpen] = useState(false);
//   const [toast, setToast] = useState<string | null>(null);

//   // Rhema Word for the Day: pops up once per day after the intro, and stays reachable from the header
//   const word = useDailyWord();
//   const [wordOpen, setWordOpen] = useState(false);
//   const [loaderDone, setLoaderDone] = useState(false);
//   const markLoaderDone = useCallback(() => setLoaderDone(true), []);

//   useEffect(() => {
//     if (!loaderDone || !word) return;
//     let seen: string | null = null;
//     try {
//       seen = localStorage.getItem(WORD_SEEN_KEY);
//     } catch {
//       /* storage blocked: show it, but only once per page load */
//     }
//     if (seen === word.date) return;
//     const id = window.setTimeout(() => {
//       try {
//         localStorage.setItem(WORD_SEEN_KEY, word.date);
//       } catch {
//         /* ignore */
//       }
//       setWordOpen(true);
//     }, 500);
//     return () => window.clearTimeout(id);
//   }, [loaderDone, word]);

//   // Escape closes the top-most layer first: modal, then popover, then list
//   useEffect(() => {
//     const onKey = (e: KeyboardEvent) => {
//       if (e.key !== "Escape") return;
//       if (modalOpen) setModalOpen(false);
//       else if (wordOpen) setWordOpen(false);
//       else if (selectedId) setSelectedId(null);
//       else if (listOpen) setListOpen(false);
//     };
//     document.addEventListener("keydown", onKey);
//     return () => document.removeEventListener("keydown", onKey);
//   }, [modalOpen, wordOpen, selectedId, listOpen]);

//   useEffect(() => {
//     if (!toast) return;
//     const id = window.setTimeout(() => setToast(null), 4500);
//     return () => window.clearTimeout(id);
//   }, [toast]);

//   const dismissMapLayers = useCallback(() => {
//     setSelectedId(null);
//     setListOpen(false);
//   }, []);

//   const handleSelectFromList = useCallback((id: string) => {
//     setSelectedId(id);
//     // on phones the sheet would cover the popover, so tuck it away
//     if (window.matchMedia("(max-width: 767px)").matches) setListOpen(false);
//   }, []);

//   const handleSubmit = useCallback(
//     async (input: NewTestimony) => {
//       const result = await submit(input);
//       setModalOpen(false);
//       setListOpen(false);
//       setSelectedId(result.testimony.id);
//       if (result.status === "queued") {
//         setToast(
//           "Saved on this device. We'll share it as soon as you're back online.",
//         );
//       } else if (result.pendingReview) {
//         setToast("Thank you! Your testimony will appear after a quick review.");
//       } else {
//         setToast("Your dot is on the map. Thank you for sharing.");
//       }
//     },
//     [submit],
//   );

//   console.log(todayCount);
//   // console.log(todayCount)
//   // useEffect(() => { console.log("todayCount:", todayCount); }, [todayCount]);

//   return (
//     <main className="relative h-dvh w-full overflow-hidden bg-bg">
//       <Loader onDone={markLoaderDone} />

//       <header className="absolute inset-x-0 top-0 z-20  p-4 md:p-6">
//         <div className="flex items-start justify-between gap-3">
//           <div className="leading-none ">
//             <h1 className="font-script text-4xl md:text-5xl">Thanksliving</h1>
//             {word ? (
//               <button
//                 type="button"
//                 onClick={() => setWordOpen(true)}
//                 className="mt-2 flex items-center gap-1.5 whitespace-nowrap rounded-full border border-hairline bg-surface px-3 py-1 text-xs font-medium leading-none shadow-card transition-colors hover:bg-hairline"
//               >
//                 <span
//                   aria-hidden
//                   className="h-1.5 w-1.5 rounded-full bg-[#f5b83d]"
//                 />
//                 <span className="text-muted">Rhema Word:</span> {word.word}
//               </button>
//             ) : (
//               <p className="mt-1 hidden text-xs tracking-wide text-muted sm:block">
//                 Thank God with the world.
//               </p>
//             )}
//           </div>

//           <div className="flex flex-wrap items-center justify-end gap-2">
//             <ViewToggle value={view} onChange={changeView} />
//             <ThemeToggle />
//             <div className="hidden md:block">
//               {todayCount === null ? null : todayCount >= 0 ? (
//                 <>
//                   <CounterPill
//                     count={todayCount}
//                     open={listOpen}
//                     onToggle={() => setListOpen((v) => !v)}
//                   />
//                 </>
//               ) : (
//                 <>
//                   <Link
//                     href="/testimonies"
//                     className="whitespace-nowrap rounded-full border border-hairline bg-surface px-3 py-2 text-xs font-medium leading-none shadow-card transition-colors hover:bg-hairline"
//                   >
//                     Witnesses
//                   </Link>
//                 </>
//               )}
//             </div>
//           </div>
//         </div>
//       </header>

//       <div className="absolute inset-0 grid place-items-center px-2 pb-24 pt-28 sm:pt-20 md:px-8">
//         {view === "globe" ? (
//           <GlobeView
//             items={items}
//             ambient={ambient}
//             total={total}
//             selectedId={selectedId}
//             now={now}
//             onSelect={setSelectedId}
//             onDismiss={dismissMapLayers}
//             onClearSelection={() => setSelectedId(null)}
//             onAmen={amen}
//           />
//         ) : (
//           <WorldMap
//             items={items}
//             ambient={ambient}
//             total={total}
//             selectedId={selectedId}
//             now={now}
//             onSelect={setSelectedId}
//             onDismiss={dismissMapLayers}
//             onAmen={amen}
//           />
//         )}
//       </div>

//       <footer className="pointer-events-none absolute bottom-0 left-0 z-1000 p-4 md:p-6">
//         <p className="text-[11px] font-medium uppercase leading-snug tracking-[0.14em] text-muted">
//           Real people. Real stories.
//           <br />
//           One God.
//         </p>
//         {source !== null && source !== "remote" && (
//           <p className="mt-2 text-[11px] normal-case tracking-normal text-muted/80">
//             {source === "seed"
//               ? "Offline preview: showing sample testimonies."
//               : "Offline: showing the last testimonies we saved."}
//           </p>
//         )}
//       </footer>

//       <button
//         type="button"
//         onClick={() => setModalOpen(true)}
//         aria-label="Share what God has done for you"
//         className="absolute bottom-4 right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-ink text-bg shadow-card transition-transform hover:scale-105 active:scale-95 md:bottom-6 md:right-6"
//       >
//         <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
//           <path
//             d="M11 4v14M4 11h14"
//             stroke="currentColor"
//             strokeWidth="2"
//             strokeLinecap="round"
//           />
//         </svg>
//       </button>

//       <ListPanel
//         open={listOpen}
//         items={items}
//         count={todayCount}
//         now={now}
//         onSelect={handleSelectFromList}
//         onClose={() => setListOpen(false)}
//       />

//       <DailyWordModal
//         open={wordOpen}
//         word={word}
//         onClose={() => setWordOpen(false)}
//         onShare={() => {
//           setWordOpen(false);
//           setModalOpen(true);
//         }}
//       />

//       <AddModal
//         open={modalOpen}
//         onClose={() => setModalOpen(false)}
//         onSubmit={handleSubmit}
//       />

//       <AnimatePresence>
//         {toast && (
//           <motion.div
//             role="status"
//             initial={{ opacity: 0, y: 12 }}
//             animate={{ opacity: 1, y: 0 }}
//             exit={{ opacity: 0, y: 12 }}
//             className="fixed bottom-24 left-1/2 z-[55] w-[min(92vw,26rem)] -translate-x-1/2 rounded-xl bg-ink px-4 py-3 text-center text-sm text-bg shadow-card md:bottom-8"
//           >
//             {toast}
//           </motion.div>
//         )}
//       </AnimatePresence>
//     </main>
//   );
// }

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDailyWord } from "@/hooks/useDailyWord";
import { useAmbientCloud } from "@/hooks/useAmbientCloud";
import { useStoredState } from "@/hooks/useStoredState";
import { useTestimonies } from "@/hooks/useTestimonies";
import type { NewTestimony } from "@/lib/types";
import { AddModal } from "./AddModal";
import { CounterPill } from "./CounterPill";
import { DailyWordModal } from "./DailyWordModal";
import { ListPanel } from "./ListPanel";
import { MobileNav } from "./MobileNav";
import { Loader } from "./Loader";
import { GlobeView } from "./GlobeView";
import { ThemeToggle } from "./ThemeToggle";
import { ViewToggle, type ViewMode } from "./ViewToggle";
import { WorldMap } from "./WorldMap";
import Link from "next/link";
import { UserGroup } from "lucide-react";

const WORD_SEEN_KEY = "tl:word-seen";

export function ThanksApp() {
  const { items, counts, total, todayCount, source, now, submit, amen } =
    useTestimonies();
  const ambient = useAmbientCloud(counts, items);
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

  // Rhema Word for the Day: pops up once per day after the intro, and stays reachable from the header
  const word = useDailyWord();
  const [wordOpen, setWordOpen] = useState(false);
  const [loaderDone, setLoaderDone] = useState(false);
  const markLoaderDone = useCallback(() => setLoaderDone(true), []);

  useEffect(() => {
    if (!loaderDone || !word) return;
    let seen: string | null = null;
    try {
      seen = localStorage.getItem(WORD_SEEN_KEY);
    } catch {
      /* storage blocked: show it, but only once per page load */
    }
    if (seen === word.date) return;
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(WORD_SEEN_KEY, word.date);
      } catch {
        /* ignore */
      }
      setWordOpen(true);
    }, 500);
    return () => window.clearTimeout(id);
  }, [loaderDone, word]);

  // Escape closes the top-most layer first: modal, then popover, then list
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (modalOpen) setModalOpen(false);
      else if (wordOpen) setWordOpen(false);
      else if (selectedId) setSelectedId(null);
      else if (listOpen) setListOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modalOpen, wordOpen, selectedId, listOpen]);

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

  const todayItems = useMemo(() => {
    if (now === null) return [];
    const DAY = 24 * 60 * 60 * 1000;
    return items
      .filter((t) => now - new Date(t.createdAt).getTime() < DAY)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)); // newest first
  }, [items, now]);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg">
      <Loader onDone={markLoaderDone} />

      <header className="absolute inset-x-0 top-0 z-20  p-4 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="leading-none flex flex-col items-center justify-center">
            <p className="font-script text-center text-xs shadow-2xl">
              The act of{" "}
            </p>

            <h1 className="font-script text-2xl md:text-3xl  shadow-2xl">
              Thanksliving
            </h1>

            <div className="hidden md:block">
              {word ? (
                <button
                  type="button"
                  onClick={() => setWordOpen(true)}
                  className="mt-2 flex items-center gap-1.5 whitespace-nowrap rounded-full border border-hairline bg-surface px-3 py-1 text-xs font-medium leading-none shadow-card transition-colors hover:bg-hairline"
                >
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-full bg-[#f5b83d]"
                  />
                  <span className="text-muted">Rhema Word:</span> {word.word}
                </button>
              ) : (
                <p className="mt-1 text-xs tracking-wide text-muted">
                  Thank God with the world.
                </p>
              )}
            </div>

          </div>
          <div className="flex-wrap items-center justify-end gap-2 flex">
            <ViewToggle value={view} onChange={changeView} />
            <ThemeToggle />
            <div className="hidden md:block">
              {todayCount === null ? null : todayCount >= 3 ? (
                <>
                  <CounterPill
                    count={todayCount}
                    open={listOpen}
                    onToggle={() => setListOpen((v) => !v)}
                  />
                </>
              ) : (
                <>
                  <Link
                    href="/testimonies"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-hairline bg-surface/90 text-ink shadow-card backdrop-blur transition-transform active:scale-95"
                  >
                    <UserGroup />
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="absolute inset-0 grid place-items-center px-2 pb-28 pt-20 md:px-8 md:pb-24 md:pt-20">
        {view === "globe" ? (
          <GlobeView
            items={items}
            ambient={ambient}
            total={total}
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
            ambient={ambient}
            total={total}
            selectedId={selectedId}
            now={now}
            onSelect={setSelectedId}
            onDismiss={dismissMapLayers}
            onAmen={amen}
          />
        )}
      </div>

      <div className="pointer-events-none absolute bottom-24 left-1/4 z-1000 p-4 md:hidden">
      <p className="mt-1 text-xs tracking-wide text-muted text-center font-bold ">
              Thank God with the world.
            </p>
      </div>

      <footer className="pointer-events-none absolute bottom-24 left-0 z-1000 p-4 md:bottom-0 md:p-6">




        <p className="hidden text-[11px] font-medium uppercase leading-snug tracking-[0.14em] text-muted md:block">
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
        className="absolute bottom-4 right-4 z-30 hidden h-14 w-14 place-items-center rounded-full bg-ink text-bg shadow-card transition-transform hover:scale-105 active:scale-95 md:bottom-6 md:right-6 md:grid"
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



      <MobileNav
        view={view}
        onToggleView={() => changeView(view === "globe" ? "map" : "globe")}
        todayCount={todayCount}
        listOpen={listOpen}
        onToggleList={() => setListOpen((v) => !v)}
        onOpenWord={word ? () => setWordOpen(true) : undefined}
        onAdd={() => setModalOpen(true)}
      />

      <ListPanel
        open={listOpen}
        // items={items}
        items={todayItems}
        count={todayCount}
        now={now}
        onSelect={handleSelectFromList}
        onClose={() => setListOpen(false)}
      />

      <DailyWordModal
        open={wordOpen}
        word={word}
        onClose={() => setWordOpen(false)}
        onShare={() => {
          setWordOpen(false);
          setModalOpen(true);
        }}
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
            className="fixed bottom-28 left-1/2 z-[55] w-[min(92vw,26rem)] -translate-x-1/2 rounded-xl bg-ink px-4 py-3 text-center text-sm text-bg shadow-card md:bottom-8"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
