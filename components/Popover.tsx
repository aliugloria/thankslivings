"use client";

import { motion } from "framer-motion";
import { countryName } from "@/lib/countries";
import { hasAmened } from "@/lib/api/testimonies";
import { relativeTime } from "@/lib/utils";
import type { Testimony } from "@/lib/types";
import { FlagBadge } from "./FlagBadge";

type Props = {
  testimony: Testimony;
  color: string;
  /** dot position in px, relative to the map container */
  anchor: { x: number; y: number };
  container: { w: number; h: number };
  now: number | null;
  onClose: () => void;
  onAmen: (id: string) => void;
};

const GAP = 18;
const EST_HEIGHT = 190;

export function Popover({ testimony, color, anchor, container, now, onClose, onAmen }: Props) {
  const width = Math.min(300, Math.max(220, container.w - 24));
  const half = width / 2;
  const left = Math.min(Math.max(anchor.x, half + 12), container.w - half - 12);
  const below = anchor.y < EST_HEIGHT + GAP;
  const pointerX = Math.min(Math.max(anchor.x - (left - half), 18), width - 18);
  const amened = hasAmened(testimony.id);
  const who = testimony.name ?? "Someone";

  return (
    <motion.div
      role="dialog"
      aria-label={`${who} is thanking God from ${countryName(testimony.countryCode)}`}
      initial={{ opacity: 0, y: below ? -6 : 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18 }}
      className="absolute z-30"
      style={{
        left,
        top: anchor.y,
        width,
        translate: `-50% ${below ? `${GAP}px` : `calc(-100% - ${GAP}px)`}`,
      }}
    >
      <div className="relative rounded-2xl border border-hairline bg-surface p-4 shadow-card">
        <span
          aria-hidden
          className="absolute h-3 w-3 rotate-45 border-hairline bg-surface"
          style={{
            left: pointerX - 6,
            ...(below
              ? { top: -6, borderLeftWidth: 1, borderTopWidth: 1 }
              : { bottom: -6, borderRightWidth: 1, borderBottomWidth: 1 }),
          }}
        />

        <div className="flex items-center gap-2">
          <span
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full"
            style={{ background: `color-mix(in srgb, ${color} 22%, transparent)` }}
          >
            <FlagBadge code={testimony.countryCode} size={22} />
          </span>
          <p className="min-w-0 flex-1 truncate text-sm">
            <span className="font-semibold">{who}</span>
            <span className="text-muted"> · {countryName(testimony.countryCode)}</span>
          </p>
          <span className="shrink-0 text-xs text-muted">
            {now !== null ? relativeTime(testimony.createdAt, now) : ""}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted hover:bg-hairline"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <p className="mt-3 text-[15px] leading-snug">“{testimony.text}”</p>

        <button
          type="button"
          onClick={() => onAmen(testimony.id)}
          aria-pressed={amened}
          disabled={amened}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-bg transition-opacity disabled:opacity-80"
        >
          <span aria-hidden>🙏</span>
          Amen
          <span className="tabular-nums opacity-70">{testimony.amens}</span>
        </button>
      </div>
    </motion.div>
  );
}
