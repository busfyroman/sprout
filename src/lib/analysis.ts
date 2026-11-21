import { foldToken, tokenize } from './search-terms'

export type SeedPosition = 'before' | 'after' | 'between' | 'other'
export type WordCountFilter = 'any' | '1' | '2' | '3+'

const STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'for', 'with', 'of', 'to', 'in', 'on', 'at', 'by', 'from',
  'de', 'la', 'le', 'les', 'el', 'y', 'un', 'una', 'und', 'der', 'die', 'das', 'et', 'pour',
  'con', 'per', 'di', 'da', 'en', 'du', 'des', 'von', 'mit', 'fur', 'für', 'ein', 'eine',
])

export function wordCount(phrase: string): number {
  return tokenize(phrase).length
}

export function matchesWordCount(phrase: string, filter: WordCountFilter): boolean {
  const count = wordCount(phrase)
  if (filter === 'any') return true
  if (filter === '3+') return count >= 3
  return count === Number(filter)
}

export function classifyPosition(phrase: string, seed: string): SeedPosition {
  const text = phrase.trim().replace(/\s+/g, ' ').toLowerCase()
  const root = seed.trim().replace(/\s+/g, ' ').toLowerCase()
  if (!root) return 'other'
  const at = text.indexOf(root)
  if (at < 0) {
    const parts = root.split(' ')
    if (parts.length < 2) return 'other'
    let cursor = 0
    for (const part of parts) {
      const found = text.indexOf(part, cursor)
      if (found < 0) return 'other'
      cursor = found + part.length
    }
    return 'between'
  }
  const before = text.slice(0, at).trim()
  const after = text.slice(at + root.length).trim()
  if (before && after) return 'between'
  if (before) return 'before'
  return 'after'
}

export interface WordStat {
  text: string
  count: number
  kind: 'word' | 'pair'
}

export function analyzeWords(phrases: readonly string[]): { words: WordStat[]; pairs: WordStat[] } {
  const words = new Map<string, number>()
  const pairs = new Map<string, number>()
  for (const phrase of phrases) {
    const tokens = tokenize(phrase).map((token) => token.toLowerCase()).filter((token) => !STOP.has(foldToken(token)) && foldToken(token).length > 1)
    const seenWords = new Set<string>()
    const seenPairs = new Set<string>()
    for (const token of tokens) {
      if (seenWords.has(token)) continue
      seenWords.add(token)
      words.set(token, (words.get(token) ?? 0) + 1)
    }
    for (let index = 0; index < tokens.length - 1; index += 1) {
      const pair = `${tokens[index]} ${tokens[index + 1]}`
      if (seenPairs.has(pair)) continue
      seenPairs.add(pair)
      pairs.set(pair, (pairs.get(pair) ?? 0) + 1)
    }
  }
  const rank = (kind: WordStat['kind'], source: Map<string, number>) => [...source.entries()]
    .map(([text, count]) => ({ text, count, kind }))
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
  return { words: rank('word', words), pairs: rank('pair', pairs) }
}

export function analysisRows(phrases: readonly string[]): string[][] {
  const { words, pairs } = analyzeWords(phrases)
  return [
    ['kind', 'text', 'count'],
    ...words.map((item) => [item.kind, item.text, String(item.count)]),
    ...pairs.map((item) => [item.kind, item.text, String(item.count)]),
  ]
}

export function buildKdpBoxes(phrases: readonly string[], skipText: string, boxCount = 7, maxChars = 50): string[] {
  const blocked = new Set(tokenize(skipText).map((token) => foldToken(token)))
  const boxes = Array.from({ length: boxCount }, () => '')
  const used = new Set<string>()
  const ranked = analyzeWords(phrases).words.map((item) => item.text)
  let box = 0
  for (const word of ranked) {
    const folded = foldToken(word)
    if (blocked.has(folded) || used.has(folded) || folded.length < 2) continue
    while (box < boxCount) {
      const next = boxes[box] ? `${boxes[box]} ${word}` : word
      if (next.length <= maxChars) {
        boxes[box] = next
        used.add(folded)
        break
      }
      box += 1
    }
    if (box >= boxCount) break
  }
  return boxes
}

export function nearDuplicateKeys(phrases: readonly string[]): Set<string> {
  const flagged = new Set<string>()
  const folded = phrases.map((phrase) => ({
    raw: phrase.trim().replace(/\s+/g, ' ').toLowerCase(),
    squash: phrase.toLowerCase().replace(/(.)\1+/g, '$1').replace(/\s+/g, ' ').trim(),
  }))
  const groups = new Map<string, string[]>()
  for (const item of folded) {
    const list = groups.get(item.squash) ?? []
    list.push(item.raw)
    groups.set(item.squash, list)
  }
  for (const list of groups.values()) {
    if (new Set(list).size > 1) list.forEach((item) => flagged.add(item))
  }
  const pairLimit = Math.min(folded.length, 250)
  for (let i = 0; i < pairLimit; i += 1) {
    for (let j = i + 1; j < pairLimit; j += 1) {
      if (folded[i].raw === folded[j].raw) continue
      if (folded[i].raw.length < 5 || folded[j].raw.length < 5) continue
      if (Math.abs(folded[i].raw.length - folded[j].raw.length) > 1) continue
      if (editDistance(folded[i].raw, folded[j].raw) <= 1) {
        flagged.add(folded[i].raw)
        flagged.add(folded[j].raw)
      }
    }
  }
  return flagged
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j]
      row[j] = a[i - 1] === b[j - 1] ? previous : 1 + Math.min(previous, row[j], row[j - 1])
      previous = current
    }
  }
  return row[b.length]
}

export function connectorWords(locale: string): string[] {
  const language = locale.toLowerCase().slice(0, 2)
  const localized: Record<string, string[]> = {
    de: ['für', 'mit', 'und', 'ohne', 'gegen', 'unter'],
    fr: ['pour', 'avec', 'et', 'sans', 'contre', 'sous'],
    es: ['para', 'con', 'y', 'sin', 'contra', 'bajo'],
    it: ['per', 'con', 'e', 'senza', 'contro', 'sotto'],
    pt: ['para', 'com', 'e', 'sem', 'contra', 'sob'],
    nl: ['voor', 'met', 'en', 'zonder', 'tegen', 'onder'],
    sv: ['för', 'med', 'och', 'utan', 'mot', 'under'],
    pl: ['dla', 'z', 'i', 'bez', 'kontra', 'pod'],
    tr: ['için', 'ile', 've', 'olmadan', 'karşı', 'altında'],
    ar: ['مع', 'و', 'بدون', 'ضد', 'تحت', 'لـ'],
    ja: ['用', '付き', 'なし', '対', '下', 'と'],
  }
  return localized[language] ?? ['for', 'with', 'and', 'without', 'vs', 'under']
}

export function adsCsv(keywords: readonly string[], campaign: string, adGroup: string, matchType: string): string {
  const rows = [
    ['Campaign', 'Ad Group', 'Keyword', 'Match Type'],
    ...keywords.map((keyword) => [campaign || 'Sprout', adGroup || 'Sprout', keyword, matchType || 'Exact']),
  ]
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`
  return value
}
