import { flagEmoji } from "@/lib/countries";

/** Round badge with a flag emoji. Swap for SVG flags later if you need Windows support. */
export function FlagBadge({ code, size = 28 }: { code: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full bg-hairline leading-none"
      style={{ width: size, height: size, fontSize: size * 0.58 }}
    >
      {flagEmoji(code)}
    </span>
  );
}
