"use client";

import { cx } from "@/lib/utils";

export type ViewMode = "globe" | "map";

const OPTIONS: { value: ViewMode; label: string }[] = [
  { value: "globe", label: "Globe" },
  { value: "map", label: "Map" },
];

export function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div
      role="group"
      aria-label="Choose view"
      className="hidden md:flex h-10 items-center rounded-full border border-hairline bg-surface p-1 shadow-card"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "h-full rounded-full px-3.5 text-sm font-medium transition-colors",
            value === o.value ? "bg-ink text-bg" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
