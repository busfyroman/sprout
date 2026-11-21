import type { SortKey, Suggestion, SuggestionSource } from './types'

export function normalizeKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function addSuggestion(
  map: Map<string, Suggestion>,
  value: string,
  source: SuggestionSource,
  marketplaceId?: string,
): void {
  const trimmed = value.trim().replace(/\s+/g, ' ')
  if (!trimmed) return
  const key = trimmed.toLowerCase()
  const existing = map.get(key)
  if (!existing) {
    map.set(key, {
      key,
      value: trimmed,
      sources: [source],
      marketplaces: marketplaceId ? [marketplaceId] : [],
    })
    return
  }
  if (!existing.sources.some((item) => item.label === source.label)) {
    existing.sources.push(source)
    existing.sources.sort((a, b) => a.index - b.index)
  }
  if (marketplaceId && !existing.marketplaces?.includes(marketplaceId)) {
    existing.marketplaces = [...(existing.marketplaces ?? []), marketplaceId]
  }
}

export function mergeSuggestion(map: Map<string, Suggestion>, suggestion: Suggestion): void {
  const existing = map.get(suggestion.key)
  if (!existing) {
    map.set(suggestion.key, {
      ...suggestion,
      sources: [...suggestion.sources],
      marketplaces: [...(suggestion.marketplaces ?? [])],
    })
    return
  }
  for (const source of suggestion.sources) {
    if (!existing.sources.some((item) => item.label === source.label)) existing.sources.push(source)
  }
  existing.sources.sort((a, b) => a.index - b.index)
  for (const marketplaceId of suggestion.marketplaces ?? []) {
    if (!existing.marketplaces?.includes(marketplaceId)) {
      existing.marketplaces = [...(existing.marketplaces ?? []), marketplaceId]
    }
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

export function suggestionMarkets(item: Suggestion, fallbackId: string): string[] {
  return item.marketplaces && item.marketplaces.length > 0 ? item.marketplaces : [fallbackId]
}

export function isExcluded(value: string, excluded: readonly string[]): boolean {
  const haystack = ` ${normalizeKey(value)} `
  return excluded.some((entry) => {
    const needle = normalizeKey(entry)
    if (!needle) return false
    return haystack.includes(` ${needle} `)
  })
}

export function applyExclusions(items: readonly Suggestion[], excluded: readonly string[]): Suggestion[] {
  if (excluded.length === 0) return [...items]
  return items.filter((item) => !isExcluded(item.value, excluded))
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
