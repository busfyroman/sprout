import type { ExpandMode } from './types'
import { MAX_SEED_LENGTH } from './limits'

export interface QuerySpec {
  id: string
  label: string
  exportLabel: string
  text: string
  index: number
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'
const DIGITS = '0123456789'
export const EXPAND_CHARS = [...LETTERS, ...DIGITS]

const LEGACY_PLACEHOLDER = /^yoga mat,\s*low content book\b/i

export function cleanSeed(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_SEED_LENGTH)
}

/** The old placeholder looked like a saved multi-keyword seed. Never restore it. */
export function sanitizeRestoredSeed(value: string): string {
  const cleaned = cleanSeed(value)
  if (LEGACY_PLACEHOLDER.test(cleaned)) return ''
  return cleaned
}

export function countQueries(mode: ExpandMode, includeSpace: boolean): number {
  const families = mode === 'both' ? 2 : 1
  const forms = includeSpace ? 2 : 1
  return 1 + EXPAND_CHARS.length * families * forms
}

export function buildQueries(seed: string, mode: ExpandMode, includeSpace: boolean): QuerySpec[] {
  const cleaned = cleanSeed(seed)
  if (!cleaned) return []

  const queries: QuerySpec[] = [
    { id: 'seed', label: 'seed', exportLabel: 'seed', text: cleaned, index: 0 },
  ]

  for (const char of EXPAND_CHARS) {
    if (mode === 'suffix' || mode === 'both') {
      queries.push({
        id: `suffix:${char}`,
        label: `+${char}`,
        exportLabel: `suffix ${char}`,
        text: `${cleaned}${char}`,
        index: queries.length,
      })
      if (includeSpace) {
        queries.push({
          id: `suffix-space:${char}`,
          label: `+ ${char}`,
          exportLabel: `suffix space ${char}`,
          text: `${cleaned} ${char}`,
          index: queries.length,
        })
      }
    }
    if (mode === 'prefix' || mode === 'both') {
      queries.push({
        id: `prefix:${char}`,
        label: `${char}+`,
        exportLabel: `prefix ${char}`,
        text: `${char}${cleaned}`,
        index: queries.length,
      })
      if (includeSpace) {
        queries.push({
          id: `prefix-space:${char}`,
          label: `${char} +`,
          exportLabel: `prefix space ${char}`,
          text: `${char} ${cleaned}`,
          index: queries.length,
        })
      }
    }
  }

  return queries
}

export function describePlan(seed: string, mode: ExpandMode, includeSpace: boolean): { count: number; example: string } {
  const shown = cleanSeed(seed) || 'yoga mat'
  const parts: string[] = []
  if (mode !== 'prefix') parts.push(`${shown}a`)
  if (mode !== 'prefix' && includeSpace) parts.push(`${shown} a`)
  if (mode !== 'suffix') parts.push(`a${shown}`)
  if (mode !== 'suffix' && includeSpace) parts.push(`a ${shown}`)
  return { count: countQueries(mode, includeSpace), example: parts.join(' · ') }
}
