import { hashString } from "./utils";

/**
 * Curated "random" colours: one palette, similar saturation, so the map feels
 * joyful instead of muddy. Derived from the id so a dot keeps its colour forever.
 */
export const DOT_COLORS = [
  "#F5B83D", // sunrise gold
  "#F2705C", // coral
  "#F27BA5", // rose
  "#9B7BEA", // violet
  "#4FB3F0", // sky
  "#2DC9A0", // teal
  "#A6D84A", // lime
  "#FF8C42", // tangerine
] as const;

export function dotColor(id: string): string {
  return DOT_COLORS[hashString(id) % DOT_COLORS.length];
}
