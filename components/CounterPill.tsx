"use client";

type Props = {
  count: number | null;
  open: boolean;
  onToggle: () => void;
};

export function CounterPill({ count, open, onToggle }: Props) {
  const label =
    count === null
      ? "Gathering thanks…"
      : `${count.toLocaleString()} ${count === 1 ? "person is" : "people are"} thanking God today`;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="testimony-list"
      className="flex items-center gap-2 rounded-full border border-hairline bg-surface/90 px-3.5 py-2 text-[13px] font-medium shadow-card backdrop-blur transition-transform active:scale-[0.98]"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-60 motion-reduce:animate-none" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-live" />
      </span>
      <span className="tabular-nums">{label}</span>
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden
        className={`transition-transform ${open ? "rotate-180" : ""}`}
      >
        <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
