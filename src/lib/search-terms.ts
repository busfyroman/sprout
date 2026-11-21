import { DEFAULT_SEARCH_TERM_BYTES } from './limits'
import { normalizeKey } from './results'

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'for', 'with', 'of', 'to', 'in', 'on', 'at', 'by', 'from',
  'into', 'over', 'under', 'your', 'you', 'my', 'our', 'their', 'this', 'that', 'these',
  'those', 'is', 'are', 'was', 'be', 'as', 'it', 'its', 'de', 'la', 'le', 'les', 'el', 'los',
  'las', 'un', 'una', 'und', 'der', 'die', 'das', 'et', 'pour', 'con', 'per', 'di', 'da',
  'del', 'y', 'en', 'au', 'aux', 'des', 'du', 'von', 'mit', 'fur', 'zu', 'zum', 'zur', 'ein',
  'eine', 'il', 'lo', 'gli', 'che', 'non',
])

export interface SearchTermPlan {
  words: string[]
  text: string
  bytes: number
  limit: number
  waiting: string[]
}

export function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).length
}

export function foldToken(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
}

export function tokenize(text: string): string[] {
  const tokens = text.match(/[\p{L}\p{N}]+/gu) ?? []
  const seen = new Set<string>()
  const result: string[] = []
  for (const token of tokens) {
    const folded = foldToken(token)
    if (folded.length < 2 || seen.has(folded)) continue
    seen.add(folded)
    result.push(token.toLowerCase())
  }
  return result
}

export function buildSearchTerms(input: {
  phrases: readonly string[]
  listingText?: string
  excluded?: readonly string[]
  dropped?: readonly string[]
  limit?: number
}): SearchTermPlan {
  const limit = clampLimit(input.limit ?? DEFAULT_SEARCH_TERM_BYTES)
  const blocked = new Set<string>()
  for (const word of tokenize(input.listingText ?? '')) blocked.add(foldToken(word))
  for (const word of input.excluded ?? []) blocked.add(foldToken(word))
  for (const word of input.dropped ?? []) blocked.add(foldToken(word))

  const counts = new Map<string, { word: string; count: number }>()
  for (const phrase of input.phrases) {
    const seenInPhrase = new Set<string>()
    for (const token of tokenize(phrase)) {
      const folded = foldToken(token)
      if (folded.length < 2 || seenInPhrase.has(folded)) continue
      seenInPhrase.add(folded)
      const current = counts.get(folded)
      if (current) current.count += 1
      else counts.set(folded, { word: token.toLowerCase(), count: 1 })
    }
  }

  const ranked = [...counts.values()]
    .filter((entry) => !STOP_WORDS.has(foldToken(entry.word)) && !blocked.has(foldToken(entry.word)))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))

  const words: string[] = []
  const waiting: string[] = []
  let text = ''
  for (const entry of ranked) {
    const next = text ? `${text} ${entry.word}` : entry.word
    if (utf8Bytes(next) > limit) {
      waiting.push(entry.word)
      continue
    }
    text = next
    words.push(entry.word)
  }
  return { words, text, bytes: utf8Bytes(text), limit, waiting }
}

export function clampLimit(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SEARCH_TERM_BYTES
  return Math.min(1000, Math.max(20, Math.round(value)))
}

export function parseWordList(value: string): string[] {
  const seen = new Set<string>()
  const words: string[] = []
  for (const part of value.split(/[\n,]+/)) {
    const cleaned = normalizeKey(part)
    if (!cleaned || seen.has(cleaned)) continue
    seen.add(cleaned)
    words.push(cleaned)
  }
  return words
}
