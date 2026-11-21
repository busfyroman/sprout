export class UnexpectedSuggestionError extends Error {
  constructor(message = 'Amazon returned an unexpected suggestion payload.') {
    super(message)
    this.name = 'UnexpectedSuggestionError'
  }
}

export function parseSuggestionPayload(payload: unknown): string[] {
  if (Array.isArray(payload)) return parseLegacyList(payload)
  if (!payload || typeof payload !== 'object') {
    throw new UnexpectedSuggestionError()
  }
  const suggestions = (payload as { suggestions?: unknown }).suggestions
  if (!Array.isArray(suggestions)) throw new UnexpectedSuggestionError()
  return uniqueStrings(
    suggestions.map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object' && typeof (item as { value?: unknown }).value === 'string') {
        return (item as { value: string }).value
      }
      return ''
    }),
  )
}

function parseLegacyList(payload: unknown[]): string[] {
  const list = payload[1]
  if (!Array.isArray(list)) throw new UnexpectedSuggestionError('Legacy completion payload had no suggestion list.')
  return uniqueStrings(list.map((item) => (typeof item === 'string' ? item : '')))
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const trimmed = value.trim().replace(/\s+/g, ' ')
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(trimmed)
  }
  return result
}
