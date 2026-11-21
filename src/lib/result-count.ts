import type { Marketplace } from './marketplaces'

export interface ResultCount {
  keyword: string
  count: number | null
  exact: boolean
  blocked: boolean
  message: string
}

const BLOCKED = /robot check|enter the characters you see|type the characters you see|validatecaptcha|opfcaptcha|api-services-support@amazon|sorry, we just need to make sure you.?re not a robot/i

export function parseResultCount(html: string): { count: number | null; blocked: boolean; message: string } {
  if (BLOCKED.test(html) && !/results for|ergebnissen|résultats|resultados|risultati/i.test(html.slice(0, 2500))) {
    return {
      count: null,
      blocked: true,
      message: 'Amazon asked for a robot check. Result counting stopped. Open Amazon in this browser, pass the check, then try the selected rows again.',
    }
  }
  const patterns = [
    /of\s+(?:over|more than)\s+([\d,]+)\s+results/i,
    /of\s+([\d,]+)\s+results/i,
    /von\s+(?:über|mehr als)\s+([\d.]+)\s+Ergebniss/i,
    /von\s+([\d.]+)\s+Ergebniss/i,
    /sur\s+([\d\s\u00a0]+)\s+résultats/i,
    /di\s+([\d.]+)\s+risultat/i,
    /de\s+(?:más de\s+)?([\d.]+)\s+resultados/i,
    /([\d,]+)\s*件(?:以上)?/,
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (!match?.[1]) continue
    const count = Number(match[1].replace(/[.\s\u00a0]/g, '').replace(/,/g, ''))
    if (Number.isFinite(count)) {
      return { count, blocked: false, message: `${count.toLocaleString()} Amazon results. This is a result count, not search volume.` }
    }
  }
  if (/no results|keine ergebnisse|aucun résultat|nessun risultato/i.test(html)) {
    return { count: 0, blocked: false, message: '0 Amazon results. This is a result count, not search volume.' }
  }
  return { count: null, blocked: false, message: 'Amazon did not show a result count on this page.' }
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
    return { keyword, exact, count: null, blocked: false, message: `Couldn’t read the result count. ${message}` }
  }
}
