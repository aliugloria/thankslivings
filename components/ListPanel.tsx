"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";
import { countryName } from "@/lib/countries";
import { dotColor } from "@/lib/colors";
import { relativeTime } from "@/lib/utils";
import type { Testimony } from "@/lib/types";
import { FlagBadge } from "./FlagBadge";
import Link from "next/link";

type Props = {
  open: boolean;
  items: Testimony[];
  count: number | null;
  now: number | null;
  onSelect: (id: string) => void;
  onClose: () => void;
};

const MAX_ROWS = 100;

export function ListPanel({
  open,
  items,
  count,
  now,
  onSelect,
  onClose,
}: Props) {
  const rows = useMemo(
    () =>
      [...items]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, MAX_ROWS),
    [items],
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          id="testimony-list"
          aria-label="People thanking God today"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-x-0 bottom-0 z-40 flex max-h-[60dvh] flex-col rounded-t-3xl border border-hairline bg-surface shadow-card md:inset-x-auto md:bottom-24 md:right-6 md:top-[4.5rem] md:max-h-none md:w-[380px] md:rounded-2xl"
        >
          <div className="relative h-full w-full">
            <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
              <h2 className="text-[15px] font-semibold">
                {count === null
                  ? "Gathering thanks…"
                  : `${count.toLocaleString()} ${count === 1 ? "person is" : "people are"} thanking God today`}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close list"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted hover:bg-hairline"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 10 10"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M1 1l8 8M9 1L1 9"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <ul className="flex-1 divide-y divide-hairline overflow-y-auto px-2 pb-3">
              {rows.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(t.id)}
                    className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-hairline"
                  >
                    <span className="relative mt-0.5">
                      <FlagBadge code={t.countryCode} size={32} />
                      <span
                        aria-hidden
                        className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface"
                        style={{ background: dotColor(t.id) }}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate">
                          <span className="font-semibold">
                            {t.name ?? "Someone"}
                          </span>
                          <span className="text-muted">
                            {" "}
                            is thanking God from {countryName(t.countryCode)}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-muted">
                          {now !== null ? relativeTime(t.createdAt, now) : ""}
                        </span>
                      </span>
                      <span className="mt-1 line-clamp-3 block text-[13px] leading-snug text-muted">
                        {t.text}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <Link href={'/testimonies'} className="bottom-5 absolute w-full flex items-center justify-center px-5">
              <button className="border border-live hover:bg-live/50 transition-all duration-180 rounded-full w-full py-2 cursor-pointer">View All Testimonies</button>
            </Link>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
