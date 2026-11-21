/** Show the store-rating note once, after this many finished expansions. */
export const RATE_AFTER_SUCCESSES = 3

export function shouldShowRatePrompt(successfulRuns: number, dismissed: boolean): boolean {
  return !dismissed && successfulRuns >= RATE_AFTER_SUCCESSES
}
