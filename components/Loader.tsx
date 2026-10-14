"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const SEEN_KEY = "tl:loader-seen";

/**
 * First-visit intro. "Thanksliving" is revealed with a left-to-right wipe,
 * which suits connected script far better than per-letter fades.
 * Shown once per browser session and shortened for reduced-motion users.
 */
export function Loader({ onDone }: { onDone?: () => void }) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      /* storage blocked: just show it */
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // returning visitors skip straight past it (0ms), first-timers watch the reveal
    const t = window.setTimeout(
      () => {
        try {
          sessionStorage.setItem(SEEN_KEY, "1");
        } catch {
          /* ignore */
        }
        setShow(false);
        onDone?.();
      },
      seen ? 0 : reduce ? 900 : 3000,
    );
    return () => window.clearTimeout(t);
  }, [onDone]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="loader"
          aria-hidden
          className="fixed inset-0 z-[60] grid place-items-center bg-bg"
          style={{
            backgroundImage:
              "radial-gradient(60% 50% at 50% 48%, color-mix(in srgb, #f5b83d 16%, transparent), transparent 70%)",
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7 }}
        >
          {/* To use the circle-of-hands artwork: export it to /public/hands.png and render it here as a faint backdrop. */}
          <div className="text-center">
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-lg tracking-wide"
            >
              The act of
            </motion.p>
            <motion.h1
              initial={{ clipPath: "inset(-15% 100% -15% -5%)" }}
              animate={{ clipPath: "inset(-15% -5% -15% -5%)" }}
              transition={{ duration: 1.7, delay: 0.5, ease: [0.4, 0, 0.2, 1] }}
              className="px-4 font-script text-7xl leading-tight sm:text-8xl"
            >
              Thanksliving
            </motion.h1>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
