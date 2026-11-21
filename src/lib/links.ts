import { getMarketplace } from './marketplaces'

const TRENDS_GEO: Record<string, string> = {
  us: 'US',
  uk: 'GB',
  de: 'DE',
  fr: 'FR',
  it: 'IT',
  es: 'ES',
  ca: 'CA',
  au: 'AU',
  jp: 'JP',
  mx: 'MX',
  in: 'IN',
  br: 'BR',
  nl: 'NL',
  se: 'SE',
  pl: 'PL',
  be: 'BE',
  ie: 'IE',
  sg: 'SG',
  ae: 'AE',
  sa: 'SA',
  tr: 'TR',
  eg: 'EG',
}

export function amazonSearchUrl(marketplaceId: string, keyword: string): string {
  const marketplace = getMarketplace(marketplaceId)
  const params = new URLSearchParams({ k: keyword })
  return `https://${marketplace.storefrontHost}/s?${params}`
}

export function googleSearchUrl(keyword: string): string {
  const params = new URLSearchParams({ q: keyword })
  return `https://www.google.com/search?${params}`
}

export function googleTrendsUrl(keyword: string, marketplaceId: string): string {
  const params = new URLSearchParams({ q: keyword })
  const geo = TRENDS_GEO[marketplaceId]
  if (geo) params.set('geo', geo)
  return `https://trends.google.com/trends/explore?${params}`
}
