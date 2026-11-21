import type { Marketplace } from './marketplaces'

export type EndpointKind = 'completion' | 'storefront'

/**
 * Public Amazon autocomplete.
 * Verified 2026-11-21 from this project’s `npm run verify:live` script.
 *
 * Primary (works without cookies for US, UK, DE, FR, IT, ES, and the other
 * marketplaces in `marketplaces.ts`, except India):
 *   https://completion.{domain}/api/2017/suggestions?mid=…&alias=aps&prefix=…
 *
 * Fallback when the completion host 4xx/5xxs or returns a non-JSON body.
 * This is the route that still answers for India (`www.amazon.in/suggestions`).
 * Storefront pages sometimes answer 503 to datacenter IPs; a shopper’s browser
 * usually gets JSON. Sprout tries completion first and falls back per request.
 *
 * `alias` defaults to `aps` (all departments). Pass `stripbooks`, `digital-text`,
 * or `fashion` later without changing the client.
 */
export function suggestionUrl(
  marketplace: Marketplace,
  prefix: string,
  endpoint: EndpointKind,
  alias = 'aps',
): string {
  if (endpoint === 'completion') {
    const params = new URLSearchParams({
      mid: marketplace.mid,
      alias,
      'search-alias': alias,
      prefix,
      'suggestion-type': 'KEYWORD',
      limit: '11',
      'site-variant': 'desktop',
      'client-info': 'amazon-search-ui',
      lop: marketplace.locale,
      event: 'onKeyPress',
      fb: '1',
      b2b: '0',
      fresh: '0',
      'page-type': 'Search',
    })
    return `https://${marketplace.completionHost}/api/2017/suggestions?${params}`
  }

  const params = new URLSearchParams({
    alias,
    'search-alias': alias,
    prefix,
    mid: marketplace.mid,
    lop: marketplace.locale,
    'page-type': 'Search',
  })
  return `https://${marketplace.storefrontHost}/suggestions?${params}`
}

export function endpointHost(marketplace: Marketplace, endpoint: EndpointKind): string {
  return endpoint === 'completion' ? marketplace.completionHost : marketplace.storefrontHost
}

export function acceptLanguage(locale: string): string {
  const tag = locale.replaceAll('_', '-')
  const language = tag.split('-')[0] || tag
  return `${tag},${language};q=0.9,en;q=0.3`
}
