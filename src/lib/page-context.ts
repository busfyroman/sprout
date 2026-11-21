import { marketplaceFromHostname, type Marketplace } from './marketplaces'
import { cleanSeed } from './queries'

export function readPageSeed(href: string, fieldValue = ''): string {
  try {
    const url = new URL(href)
    const fromQuery = url.searchParams.get('k') ?? url.searchParams.get('field-keywords')
    if (fromQuery?.trim()) return cleanSeed(fromQuery)
  } catch {
    // Ignore a malformed href and fall back to the search box.
  }
  return cleanSeed(fieldValue)
}

export function readMarketplace(hostname: string): Marketplace | null {
  return marketplaceFromHostname(hostname)
}
