export const REQUEST_LIMITS = {
  concurrency: 3,
  gapMs: 180,
  maxGapMs: 2400,
  retries: 3,
  backoffBaseMs: 420,
  timeoutMs: 12000,
} as const

export const LOCK_STALE_MS = 8000

export const MAX_SEED_LENGTH = 120

/** Amazon's backend Search Terms field is 249 bytes on most marketplaces. */
export const DEFAULT_SEARCH_TERM_BYTES = 249

export const HISTORY_LIMIT = 20
