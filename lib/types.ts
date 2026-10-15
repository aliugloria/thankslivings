export type Testimony = {
  id: string;
  /** null means the person chose to stay anonymous */
  name: string | null;
  /** ISO 3166-1 alpha-2, e.g. "NG". Only the country is stored, never coordinates. */
  countryCode: string;
  text: string;
  /** ISO timestamp */
  createdAt: string;
  amens: number;
};

export type NewTestimony = {
  name: string | null;
  countryCode: string;
  text: string;
};

/**
 * What the globe, the map and the "today" list need, in one small response that never grows
 * with the number of testimonies: the newest few hundred in full, plus counts for the rest.
 */
export type GlobeSnapshot = {
  /** the newest testimonies (newest first): clickable dots, arcs and the 24-hour list */
  recent: Testimony[];
  /** every approved testimony, per country (ISO code -> count) */
  counts: Record<string, number>;
  /** all-time total */
  total: number;
  /** how many people gave thanks in the last 24 hours */
  todayCount: number;
};

/** One page of the full testimony list, newest first. */
export type TestimonyPage = {
  items: Testimony[];
  /** pass back as `cursor` for the next page; null on the last page */
  nextCursor: string | null;
  /** all-time total */
  total: number;
};

/** Where the data on screen actually came from. */
export type DataSource = "remote" | "cache" | "seed";
