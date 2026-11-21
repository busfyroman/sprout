import { normalizeDepartment } from './departments'

export interface PageIntel {
  related: string[]
  brands: string[]
  productTitle: string
  departmentAlias: string | null
}

const EMPTY: PageIntel = { related: [], brands: [], productTitle: '', departmentAlias: null }

export function readPageIntel(html: string): PageIntel {
  if (!html.trim()) return EMPTY
  return {
    related: unique(readRelated(html)),
    brands: unique(readBrands(html)),
    productTitle: readProductTitle(html),
    departmentAlias: readDepartment(html),
  }
}

function readDepartment(html: string): string | null {
  const selected = html.match(/<option[^>]*selected[^>]*value=["']search-alias=([^"']+)["']/i)
    ?? html.match(/<option[^>]*value=["']search-alias=([^"']+)["'][^>]*selected/i)
    ?? html.match(/id=["']searchDropdownBox["'][\s\S]{0,400}?value=["']search-alias=([^"']+)["']/i)
  if (!selected?.[1]) return null
  const alias = normalizeDepartment(selected[1])
  return alias === 'aps' && selected[1] !== 'aps' ? null : alias
}

function readProductTitle(html: string): string {
  const match = html.match(/id=["']productTitle["'][^>]*>([\s\S]*?)<\//i)
  return clean(match?.[1] ?? '')
}

function readBrands(html: string): string[] {
  const brands: string[] = []
  const patterns = [
    /Visit the ([^<]{2,60}?) Store/gi,
    /Besuchen Sie den ([^<]{2,60}?)-Store/gi,
    /Visiter la boutique ([^<]{2,60})/gi,
    /Visita la tienda de ([^<]{2,60})/gi,
    /Visita lo Store di ([^<]{2,60})/gi,
    /id=["']bylineInfo["'][^>]*>[\s\S]*?(?:Visit the |Brand:\s*|Marke:\s*)([^<]{2,60})</gi,
  ]
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const brand = clean(match[1] ?? '').replace(/ Store$/i, '').replace(/-Store$/i, '')
      if (brand) brands.push(brand)
    }
  }
  return brands
}

function readRelated(html: string): string[] {
  const found: string[] = []
  const blocks = html.matchAll(/(related searches|verwandte suchbegriffe|recherches associées|búsquedas relacionadas|ricerche correlate|customers also searched|kunden suchten auch)([\s\S]{0,2500})/gi)
  for (const block of blocks) {
    const slice = block[2] ?? ''
    for (const link of slice.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)) {
      const text = clean(link[1] ?? '')
      if (text && text.length < 80 && !/^(next|previous|back)$/i.test(text)) found.push(text)
    }
  }
  return found
}

function clean(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()
}

function unique(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(value)
  }
  return result.slice(0, 24)
}
