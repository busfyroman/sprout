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
