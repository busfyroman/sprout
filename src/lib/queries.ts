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

/**
 * Keep a trailing space. Trimming on each keystroke turned "yoga " into "yoga"
 * before the next letter, so the field saved "yogamat".
 */
export function sanitizeRestoredSeed(value: string): string {
  const collapsed = value.replace(/\s+/g, ' ').slice(0, MAX_SEED_LENGTH)
  if (isLegacyPlaceholderSeed(collapsed)) return ''
  return collapsed
}

export function countQueries(mode: ExpandMode, includeSpace = true, deep = false, connectorCount = 6): number {
  void includeSpace
  const families = mode === 'both' ? 2 : 1
  const base = 1 + EXPAND_CHARS.length * families
  if (!deep) return base
  return base + connectorCount * (1 + 26)
}

export function buildQueries(
  seed: string,
  mode: ExpandMode,
  includeSpace: boolean,
  deep = false,
  connectors: readonly string[] = [],
): QuerySpec[] {
  const cleaned = cleanSeed(seed)
  if (!cleaned) return []

  const queries: QuerySpec[] = [
    { id: 'seed', label: 'seed', exportLabel: 'seed', text: cleaned, index: 0 },
  ]

  for (const char of EXPAND_CHARS) {
    if (mode === 'suffix' || mode === 'both') {
      queries.push({
        id: includeSpace ? `suffix-space:${char}` : `suffix:${char}`,
        label: includeSpace ? `+ ${char}` : `+${char}`,
        exportLabel: includeSpace ? `suffix space ${char}` : `suffix ${char}`,
        text: includeSpace ? `${cleaned} ${char}` : `${cleaned}${char}`,
        index: queries.length,
      })
    }
    if (mode === 'prefix' || mode === 'both') {
      queries.push({
        id: includeSpace ? `prefix-space:${char}` : `prefix:${char}`,
        label: includeSpace ? `${char} +` : `${char}+`,
        exportLabel: includeSpace ? `prefix space ${char}` : `prefix ${char}`,
        text: includeSpace ? `${char} ${cleaned}` : `${char}${cleaned}`,
        index: queries.length,
      })
    }
  }

  if (deep) {
    for (const connector of connectors) {
      const word = connector.trim()
      if (!word) continue
      queries.push({
        id: `connector:${word}`,
        label: word,
        exportLabel: `connector ${word}`,
        text: `${cleaned} ${word}`,
        index: queries.length,
      })
      for (const letter of LETTERS) {
        queries.push({
          id: `connector:${word}:${letter}`,
          label: `${word} ${letter}`,
          exportLabel: `connector ${word} ${letter}`,
          text: `${cleaned} ${word} ${letter}`,
          index: queries.length,
        })
      }
    }
  }

  return queries
}

export function describePlan(
  seed: string,
  mode: ExpandMode,
  includeSpace: boolean,
  deep = false,
  connectorCount = 6,
): { count: number; example: string } {
  const shown = cleanSeed(seed) || 'yoga mat'
  const parts: string[] = []
  if (mode !== 'prefix') parts.push(includeSpace ? `${shown} a` : `${shown}a`)
  if (mode !== 'suffix') parts.push(includeSpace ? `a ${shown}` : `a${shown}`)
  if (deep) parts.push(`${shown} for a`)
  return { count: countQueries(mode, includeSpace, deep, connectorCount), example: parts.join(' · ') }
}
