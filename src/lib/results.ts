import type { SortKey, Suggestion, SuggestionSource } from './types'

export function normalizeKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function addSuggestion(
  map: Map<string, Suggestion>,
  value: string,
  source: SuggestionSource,
): void {
  const trimmed = value.trim().replace(/\s+/g, ' ')
  if (!trimmed) return
  const key = trimmed.toLowerCase()
  const existing = map.get(key)
  if (!existing) {
    map.set(key, { key, value: trimmed, sources: [source] })
    return
  }
  if (!existing.sources.some((item) => item.label === source.label)) {
    existing.sources.push(source)
    existing.sources.sort((a, b) => a.index - b.index)
  }
}

export function sortSuggestions(items: readonly Suggestion[], sort: SortKey): Suggestion[] {
  const copy = [...items]
  copy.sort((a, b) => compareSuggestions(a, b, sort))
  return copy
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

function compareSuggestions(a: Suggestion, b: Suggestion, sort: SortKey): number {
  if (sort === 'alpha') return compareText(a.value, b.value)
  if (sort === 'alpha-desc') return compareText(b.value, a.value)
  if (sort === 'shortest') return a.value.length - b.value.length || compareText(a.value, b.value)
  if (sort === 'longest') return b.value.length - a.value.length || compareText(a.value, b.value)
  const ai = a.sources[0]?.index ?? 0
  const bi = b.sources[0]?.index ?? 0
  return ai - bi || compareText(a.value, b.value)
}

export function filterSuggestions(items: readonly Suggestion[], query: string): Suggestion[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return [...items]
  return items.filter(
    (item) =>
      item.value.toLowerCase().includes(needle) ||
      item.sources.some((source) => source.label.toLowerCase().includes(needle)),
  )
}
