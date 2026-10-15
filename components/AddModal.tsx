"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { COUNTRIES, isKnownCountry } from "@/lib/countries";
import type { NewTestimony } from "@/lib/types";
import { MAX_NAME, MAX_TEXT, validateNewTestimony } from "@/lib/validation";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Throws with a user-readable message when the server rejects the testimony. */
  onSubmit: (input: NewTestimony) => Promise<void>;
};

export function AddModal({ open, onClose, onSubmit }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-end bg-ink/30 backdrop-blur-[2px] sm:place-items-center sm:p-4"
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
            aria-labelledby="add-title"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-md rounded-t-3xl border border-hairline bg-surface p-6 shadow-card sm:rounded-3xl"
          >
            <ModalBody onClose={onClose} onSubmit={onSubmit} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Only mounted while the modal is open, so its state resets every time. */
function ModalBody({ onClose, onSubmit }: Omit<Props, "open">) {
  const [text, setText] = useState("");
  const [countryCode, setCountryCode] = useState(guessCountry);
  const [shareName, setShareName] = useState(true);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const result = validateNewTestimony({
      text,
      countryCode,
      name: shareName ? name : null,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await onSubmit(result.value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  const remaining = MAX_TEXT - text.length;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="add-title" className="text-xl font-semibold tracking-tight">
            What has God done for you?
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            Share a short testimony of what God has done in your life. Your story can encourage
            someone around the world.
          </p>
        </div>
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

      <label className="mt-5 block">
        <span className="sr-only">Your testimony</span>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))}
          rows={4}
          placeholder="Write your testimony here…"
          className="w-full resize-none rounded-xl border border-hairline bg-bg/60 px-3.5 py-3 text-[15px] outline-none transition-shadow placeholder:text-muted/70 focus:ring-2 focus:ring-ink/20"
        />
        <span
          className={`mt-1 block text-right text-xs tabular-nums ${remaining < 20 ? "text-live" : "text-muted"}`}
        >
          {text.length}/{MAX_TEXT}
        </span>
      </label>

      <label className="mt-2 block">
        <span className="sr-only">Country</span>
        <select
          value={countryCode}
          onChange={(e) => setCountryCode(e.target.value)}
          className="w-full rounded-xl border border-hairline bg-bg/60 px-3.5 py-3 text-[15px] outline-none focus:ring-2 focus:ring-ink/20"
        >
          <option value="" disabled>
            Select your country
          </option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-2 w-full flex flex-col gap-3">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Your name</span>
          <input
            value={shareName ? name : ""}
            onChange={(e) => setName(e.target.value.slice(0, MAX_NAME))}
            disabled={!shareName}
            placeholder={shareName ? "Your name (optional)" : "Anonymous"}
            autoComplete="given-name"
            className="w-full rounded-xl border border-hairline bg-bg/60 px-3.5 py-3 text-[15px] outline-none placeholder:text-muted/70 focus:ring-2 focus:ring-ink/20 disabled:opacity-60"
          />
        </label>

        <button
          type="button"
          role="switch"
          aria-checked={shareName}
          onClick={() => setShareName((v) => !v)}
          className="flex shrink-0 items-center gap-2 text-sm"
        >
          <span
            className={`relative h-6 w-10 rounded-full transition-colors ${shareName ? "bg-ink" : "bg-ink/20"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-all ${shareName ? "left-[1.125rem]" : "left-0.5"}`}
            />
          </span>
          <span className="w-[5.2rem] text-left leading-tight whitespace-nowrap">
            {shareName ? "Share my name" : "Stay anonymous"}
          </span>
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-live">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-5 w-full rounded-xl bg-ink px-4 py-3.5 text-[15px] font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "Dropping…" : "Drop my thanks"}
      </button>

      <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <rect x="2.5" y="5.5" width="7" height="5" rx="1.2" stroke="currentColor" />
          <path d="M4 5.5V4a2 2 0 114 0v1.5" stroke="currentColor" />
        </svg>
        Your dot is placed randomly inside your country.
      </p>
    </form>
  );
}

/** Best guess from the browser language (e.g. en-NG -> NG). No network, no tracking. */
function guessCountry(): string {
  try {
    const region = new Intl.Locale(navigator.language).region;
    if (region && isKnownCountry(region)) return region.toUpperCase();
  } catch {
    /* older browsers */
  }
  return "";
}
