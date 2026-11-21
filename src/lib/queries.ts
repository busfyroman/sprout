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

export function cleanSeed(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_SEED_LENGTH)
}

/**
 * 0.2.0 showed "yoga mat, low content book, funny nurse…" as a placeholder.
 * Some profiles saved that string as the seed. Treat every variant as empty.
 */
export function isLegacyPlaceholderSeed(value: string): boolean {
  const folded = cleanSeed(value)
    .toLowerCase()
    .replace(/\u2026/g, '...')
    .replace(/\.+$/g, '')
    .trim()
  if (!folded) return false
  if (folded.startsWith('yoga mat, low content book')) return true
  return folded.includes('low content book') && folded.includes('funny nurse')
}

export function sanitizeRestoredSeed(value: string): string {
  const cleaned = cleanSeed(value)
  if (isLegacyPlaceholderSeed(cleaned)) return ''
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
