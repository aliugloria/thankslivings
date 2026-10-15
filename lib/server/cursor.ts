/**
 * Keyset pagination cursor: the (created_at, id) of the last row a client received.
 * Unlike OFFSET, the database jumps straight to that spot, so page 20,000 costs the same as page 1.
 */
export class BadCursorError extends Error {
  constructor() {
    super("Invalid cursor");
    this.name = "BadCursorError";
  }
}

export type Cursor = { createdAt: string; id: string };

const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;
const ID = /^[A-Za-z0-9-]{1,64}$/;

export function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(JSON.stringify([createdAt, id])).toString("base64url");
}

/** Strict on purpose: the parts end up inside a database filter. */
export function decodeCursor(raw: string): Cursor {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (Array.isArray(parsed) && parsed.length === 2) {
      const [createdAt, id] = parsed;
      if (typeof createdAt === "string" && typeof id === "string" && TIMESTAMP.test(createdAt) && ID.test(id)) {
        return { createdAt, id };
      }
    }
  } catch {
    /* fall through */
  }
  throw new BadCursorError();
}
