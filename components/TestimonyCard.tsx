"use client";

import { dotColor } from "@/lib/colors";
import { countryName, flagEmoji } from "@/lib/countries";
import { cx } from "@/lib/utils";
import type { Testimony } from "@/lib/types";

type Props = {
  testimony: Testimony;
  now: number | null;
  amened: boolean;
  onAmen: (id: string) => void;
};

function dayLabel(date: Date, now: number): string {
  const today = new Date(now);
  const same =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  if (same) return "Today";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** One testimony as a card: tinted date tile, story, and an Amen action that fills in on hover. */
export function TestimonyCard({ testimony: t, now, amened, onAmen }: Props) {
  const date = new Date(t.createdAt);
  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      role="listitem"
      className="group grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 rounded-2xl bg-surface p-3.5 shadow-[0_0_0_1px_var(--hairline)] transition-shadow duration-200 hover:shadow-card sm:grid-cols-[auto_1fr_auto] sm:p-4"
      style={{ "--dot": dotColor(t.id) } as React.CSSProperties}
    >
      <div
        className="grid h-[88px] w-[88px] place-content-center justify-items-center gap-1 rounded-xl text-center sm:h-[100px] sm:w-[100px]"
        style={{ background: "color-mix(in srgb, var(--dot) 16%, var(--surface))" }}
      >
        <span className="text-[11px] font-medium uppercase tracking-wide">
          {now !== null ? dayLabel(date, now) : " "}
        </span>
        <span className="font-serif text-2xl font-bold leading-none tabular-nums">{time}</span>
      </div>

      <div className="min-w-0">
        <h3 className="font-serif text-lg font-bold leading-snug sm:text-xl">
          {t.name ?? "Anonymous"}
        </h3>
        <p className="mt-0.5 text-xs text-muted">
          <span aria-hidden>{flagEmoji(t.countryCode)}</span> {countryName(t.countryCode)}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink/80">{t.text}</p>
      </div>

      <button
        type="button"
        onClick={() => onAmen(t.id)}
        disabled={amened}
        aria-label={amened ? `You said Amen. ${t.amens} total` : `Say Amen. ${t.amens} so far`}
        className={cx(
          "col-start-2 flex h-11 min-w-[7.5rem] items-center justify-center gap-2 justify-self-start rounded-xl px-4 text-sm transition-colors sm:col-start-3 sm:justify-self-end",
          amened
            ? "bg-ink text-bg"
            : "text-ink hover:bg-ink hover:text-bg group-hover:bg-ink group-hover:text-bg",
        )}
      >
        <svg width="14" height="14" viewBox="0 0 22 22" fill="none" aria-hidden>
          <path d="M11 4v14M4 11h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span>{amened ? "Amened" : "Amen"}</span>
        <span className="tabular-nums opacity-70">{t.amens}</span>
      </button>
    </div>
  );
}
