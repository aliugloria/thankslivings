"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { DailyWord } from "@/lib/dailyWord";

type Props = {
  open: boolean;
  word: DailyWord | null;
  onClose: () => void;
  /** Closes this and opens the share modal. */
  onShare: () => void;
};

export function DailyWordModal({ open, word, onClose, onShare }: Props) {
  return (
    <AnimatePresence>
      {open && word && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/30 p-4 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="word-title"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.25 }}
            className="relative max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-hairline bg-surface px-6 pb-6 pt-5 shadow-card"
            style={{
              backgroundImage:
                "radial-gradient(70% 40% at 50% 22%, color-mix(in srgb, #f5b83d 18%, transparent), transparent 75%)",
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <p id="word-title" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                Rhema Word for the Day
              </p>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-2 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-hairline"
              >
                <svg width="12" height="12" viewBox="0 0 10 10" fill="none" aria-hidden>
                  <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <h2 className="mt-6 text-center font-script text-6xl leading-tight sm:text-7xl">{word.word}</h2>
            <p className="mt-3 text-center text-sm text-muted">
              Today&rsquo;s word from the Hallelujah Challenge.
            </p>

            {word.points && word.points.length > 0 && (
              <div className="mt-6 border-t border-hairline pt-5">
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  Points from the service
                </h3>
                <ol className="mt-3 space-y-3">
                  {word.points.map((p, i) => (
                    <li key={i} className="flex gap-3 text-[15px] leading-snug">
                      <span
                        aria-hidden
                        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink/10 text-[11px] font-semibold tabular-nums"
                      >
                        {i + 1}
                      </span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <button
              type="button"
              autoFocus
              onClick={onShare}
              className="mt-7 w-full rounded-xl bg-ink px-4 py-3.5 text-[15px] font-semibold text-bg transition-opacity hover:opacity-90"
            >
              Thank God for it
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 w-full rounded-xl px-4 py-3 text-sm text-muted transition-colors hover:bg-hairline"
            >
              Close
            </button>

            <p className="mt-3 text-center text-[11px] text-muted/80">
              Shared by the Thanksliving community, not an official page.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
