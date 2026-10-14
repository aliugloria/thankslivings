"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTestimonies } from "@/hooks/useTestimonies";
import { hasAmened } from "@/lib/api/testimonies";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TestimonyCard } from "@/components/TestimonyCard";

const GAP = 12;
/** Narrowest a card may get before the grid drops a column. */
const MIN_CARD = 440;
const ESTIMATED_ROW = 150;

export default function TestimoniesPage() {
  const { items, now, source, amen } = useTestimonies();

  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ width: 0, top: 0 });

  // Track the list's width (for the column count) and where it starts in the scroller.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const measure = () => setLayout({ width: el.clientWidth, top: el.offsetTop });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const columns = Math.max(1, Math.floor((layout.width + GAP) / (MIN_CARD + GAP)));

  const rows = useMemo(
    () => [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [items],
  );
  const rowCount = Math.ceil(rows.length / columns);

  // Every testimony is in the list, but only the rows on screen are in the DOM,
  // so a million of them scrolls as smoothly as ten.
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual is used only in this component
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW,
    gap: GAP,
    overscan: 6,
    scrollMargin: layout.top,
  });

  const loading = now === null;

  return (
    // the root layout locks body scrolling for the globe, so this page scrolls itself
    <div ref={scrollRef} className="h-dvh overflow-y-auto bg-bg">
      <div className="mx-auto w-full max-w-7xl px-4 pb-24 pt-5 md:px-8 md:pt-8">
        <header className="flex items-start justify-between gap-3">
          <Link href="/" className="font-script text-4xl leading-none md:text-5xl">
            Thanksliving
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="flex h-10 items-center rounded-full border border-hairline bg-surface px-4 text-sm font-medium shadow-card transition-colors hover:bg-ink hover:text-bg"
            >
              <span className="sm:hidden">Globe</span>
              <span className="hidden sm:inline">Back to the globe</span>
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <div className="mb-6 mt-10 md:mt-14">
          <h1 className="font-serif text-3xl font-bold md:text-4xl">Testimonies</h1>
          <p className="mt-2 text-sm text-muted">
            {loading
              ? "Gathering thanks…"
              : `${rows.length.toLocaleString()} ${rows.length === 1 ? "person has" : "people have"} thanked God here.`}
          </p>
          {source !== null && source !== "remote" && (
            <p className="mt-1 text-xs text-muted/80">
              {source === "seed"
                ? "Offline preview: showing sample testimonies."
                : "Offline: showing the last testimonies we saved."}
            </p>
          )}
        </div>

        <div
          ref={listRef}
          role="list"
          aria-label="All testimonies"
          className="relative w-full"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((row) => (
            <div
              key={row.key}
              ref={virtualizer.measureElement}
              data-index={row.index}
              role="presentation"
              className="absolute left-0 top-0 grid w-full"
              style={{
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                gap: GAP,
                transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)`,
              }}
            >
              {rows.slice(row.index * columns, row.index * columns + columns).map((t) => (
                <TestimonyCard
                  key={t.id}
                  testimony={t}
                  now={now}
                  amened={hasAmened(t.id)}
                  onAmen={amen}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
