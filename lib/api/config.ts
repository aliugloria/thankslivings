export const API_CONFIG = {
  /** Leave empty to use this app's own route handlers. Set to point at a separate backend. */
  baseUrl: process.env.NEXT_PUBLIC_API_BASE ?? "",
  timeoutMs: 6000,
  retries: 2,
  backoffMs: 400,
  /** How often the map checks for new testimonies while the tab is visible */
  pollMs: 30_000,
} as const;

export const ENDPOINTS = {
  testimonies: () => `${API_CONFIG.baseUrl}/api/testimonies`,
  amen: (id: string) =>
    `${API_CONFIG.baseUrl}/api/testimonies/${encodeURIComponent(id)}/amen`,
} as const;
