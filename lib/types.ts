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

export type TestimonyListResponse = {
  items: Testimony[];
  /** how many people gave thanks in the last 24 hours */
  todayCount: number;
};

/** Where the data on screen actually came from. */
export type DataSource = "remote" | "cache" | "seed";
