"use client";

import { BookOpen, Clock, Globe, Map, Plus, UserGroup } from "lucide-react";
import { cx } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import type { ViewMode } from "./ViewToggle";
import Link from "next/link";

type Props = {
  view: ViewMode;
  onToggleView: () => void;
  todayCount: number | null;
  listOpen: boolean;
  onToggleList: () => void;
  onOpenWord?: () => void;
  onAdd: () => void;
};

function NavButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cx(
        "relative grid h-12 w-12 place-items-center rounded-full transition-all active:scale-90",
        active ? "bg-ink text-bg" : "text-ink hover:bg-hairline",
      )}
    >
      {children}
    </button>
  );
}

export function MobileNav({
  view,
  onToggleView,
  todayCount,
  listOpen,
  onToggleList,
  onOpenWord,
  onAdd,
}: Props) {
  const icon = { size: 22, strokeWidth: 1.7, "aria-hidden": true } as const;

  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-[45]">
      <div className="relative flex items-center justify-center gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden">
        <div className="w-[80%] flex items-center justify-between gap-1 rounded-full border border-hairline bg-surface/90 p-1.5 shadow-card backdrop-blur">
          {onOpenWord && (
            <NavButton label="Rhema Word for the day" onClick={onOpenWord}>
              <BookOpen {...icon} />
            </NavButton>
          )}

          <NavButton
            label={view === "globe" ? "Switch to flat map" : "Switch to globe"}
            onClick={onToggleView}
          >
            {view === "globe" ? <Globe {...icon} /> : <Map {...icon} />}
          </NavButton>

          <NavButton label="Share what God has done for you" onClick={onAdd}>
            <Plus {...icon} />
          </NavButton>

          <NavButton
            label="Testimonies from the last 24 hours"
            onClick={onToggleList}
            active={listOpen}
          >
            <Clock {...icon} />
            {todayCount !== null && todayCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-[#e8604c] px-1 text-[10px] font-semibold leading-[18px] text-white">
                {todayCount > 99 ? "99+" : todayCount}
              </span>
            )}
          </NavButton>

          <Link
            href={"/testimonies"}
            className="relative grid h-12 w-12 place-items-center rounded-full transition-all active:scale-90 text-ink hover:bg-hairline"
          >
            <UserGroup />
          </Link>
        </div>
      </div>
    </nav>
  );
}
