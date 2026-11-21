import type { Marketplace } from './marketplaces'

export interface ResultCount {
  keyword: string
  count: number | null
  /** Amazon said “over” or “more than”, so the number is a cap, not an exact total. */
  capped: boolean
  exact: boolean
  blocked: boolean
  message: string
}

const BLOCKED = /robot check|enter the characters you see|type the characters you see|validatecaptcha|opfcaptcha|api-services-support@amazon|sorry, we just need to make sure you.?re not a robot/i

export function parseResultCount(html: string): { count: number | null; capped: boolean; blocked: boolean; message: string } {
  if (BLOCKED.test(html) && !/results for|ergebnissen|résultats|resultados|risultati/i.test(html.slice(0, 2500))) {
    return {
      count: null,
      capped: false,
      blocked: true,
      message: 'Amazon asked for a robot check. Result counting stopped. Open Amazon in this browser, pass the check, then try the selected rows again.',
    }
  }
  const patterns: Array<{ pattern: RegExp; group: number; capped: boolean }> = [
    { pattern: /\d[\d,]*\s*[-–]\s*\d[\d,]*\s+of\s+(?:over|more than)\s+([\d,]+)\s+results/i, group: 1, capped: true },
    { pattern: /(?:over|more than)\s+([\d,]+)\s+results/i, group: 1, capped: true },
    { pattern: /of\s+(?:over|more than)\s+([\d,]+)\s+results/i, group: 1, capped: true },
    { pattern: /von\s+(?:über|mehr als)\s+([\d.]+)\s+Ergebniss/i, group: 1, capped: true },
    { pattern: /de\s+más de\s+([\d.]+)\s+resultados/i, group: 1, capped: true },
    { pattern: /([\d,]+)\s*件以上/, group: 1, capped: true },
    { pattern: /\d[\d,]*\s*[-–]\s*\d[\d,]*\s+of\s+([\d,]+)\s+results/i, group: 1, capped: false },
    { pattern: /([\d,]+)\s+results?\s+for\b/i, group: 1, capped: false },
    { pattern: /of\s+([\d,]+)\s+results/i, group: 1, capped: false },
    { pattern: /von\s+([\d.]+)\s+Ergebniss/i, group: 1, capped: false },
    { pattern: /sur\s+([\d\s\u00a0]+)\s+résultats/i, group: 1, capped: false },
    { pattern: /di\s+([\d.]+)\s+risultat/i, group: 1, capped: false },
    { pattern: /de\s+([\d.]+)\s+resultados/i, group: 1, capped: false },
    { pattern: /([\d,]+)\s*件/, group: 1, capped: false },
  ]
  for (const { pattern, group, capped } of patterns) {
    const match = html.match(pattern)
    const raw = match?.[group]
    if (!raw) continue
    const count = Number(raw.replace(/[.\s\u00a0]/g, '').replace(/,/g, ''))
    if (Number.isFinite(count)) {
      const shown = formatResultCount(count, capped)
      const exactness = capped ? ' Amazon did not give an exact count.' : ''
      return { count, capped, blocked: false, message: `${shown}. This is a result count, not search volume.${exactness}` }
    }
  }
  if (/no results|keine ergebnisse|aucun résultat|nessun risultato/i.test(html)) {
    return { count: 0, capped: false, blocked: false, message: '0 Amazon results. This is a result count, not search volume.' }
  }
  return { count: null, capped: false, blocked: false, message: 'Amazon did not show a result count on this page.' }
}

export function formatResultCount(count: number, capped: boolean): string {
  const shown = count.toLocaleString('en-US')
  return capped ? `${shown}+` : `${shown} results`
}

export function resultSearchUrl(marketplace: Marketplace, keyword: string, exact: boolean): string {
  const query = exact ? `"${keyword}"` : keyword
  const params = new URLSearchParams({ k: query })
  return `https://${marketplace.storefrontHost}/s?${params}`
}

export async function fetchResultCount(
  marketplace: Marketplace,
  keyword: string,
  exact: boolean,
  signal: AbortSignal,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<ResultCount> {
  const url = resultSearchUrl(marketplace, keyword, exact)
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      signal,
      headers: { Accept: 'text/html', 'Accept-Language': marketplace.locale.replace('_', '-') },
    })
    const html = await response.text()
    const parsed = parseResultCount(html)
    return { keyword, exact, ...parsed }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed'
    return { keyword, exact, count: null, capped: false, blocked: false, message: `Couldn’t read the result count. ${message}` }
  }
}
