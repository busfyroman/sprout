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

const RELATED_HEADING = /related searches|verwandte suchbegriffe|recherches associées|búsquedas relacionadas|ricerche correlate|customers also searched|kunden suchten auch/i

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
      if (isBrandName(brand)) brands.push(brand)
    }
  }
  const filter = html.match(/id=["']brandsRefinements["'][\s\S]{0,25000}/i)?.[0]
    ?? html.match(/>\s*Brand\s*<[\s\S]{0,15000}/i)?.[0]
    ?? ''
  for (const match of filter.matchAll(/<span[^>]*class=["'][^"']*a-size-base[^"']*["'][^>]*>\s*([^<]{2,40})\s*<\/span>/gi)) {
    const brand = clean(match[1] ?? '')
    if (isBrandName(brand)) brands.push(brand)
  }
  return brands
}

function readRelated(html: string): string[] {
  const found: string[] = []
  const blocks = html.matchAll(new RegExp(`(?:${RELATED_HEADING.source})([\\s\\S]{0,20000})`, 'gi'))
  for (const block of blocks) {
    const slice = (block[1] ?? '').split(/<h[12]\b/i)[0] ?? ''
    for (const link of slice.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
      const term = relatedTerm(link[1] ?? '', link[2] ?? '')
      if (term) found.push(term)
    }
  }
  return found
}

function relatedTerm(attrs: string, inner: string): string | null {
  const href = attrs.match(/href=["']([^"']+)["']/i)?.[1] ?? ''
  if (!href || /\/sspa\/|\/dp\/|\/gp\//i.test(href)) return null
  let query = ''
  try {
    query = new URL(href, 'https://www.amazon.com').searchParams.get('k') ?? ''
  } catch {
    query = ''
  }
  if (!query) return null
  const text = clean(inner.replace(/<img\b[^>]*>/gi, ' '))
  const fromQuery = query.replace(/\+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!fromQuery || fromQuery.length > 80) return null
  if (!text) return fromQuery
  if (text.length > fromQuery.length + 12) return fromQuery
  return text
}

function isBrandName(value: string): boolean {
  if (!value || value.length < 2 || value.length > 40) return false
  return !/^(brand|marke|marque|marca|see more|featured|top brands|brands)$/i.test(value)
}

export function readLivePageIntel(root: ParentNode): PageIntel {
  return {
    related: unique(readLiveRelated(root)),
    brands: unique(readLiveBrands(root)),
    productTitle: liveText(root, '#productTitle'),
    departmentAlias: liveDepartment(root),
  }
}

function readLiveRelated(root: ParentNode): string[] {
  const found: string[] = []
  const scopes = new Set<ParentNode>()
  if ('querySelectorAll' in root) {
    for (const node of root.querySelectorAll('[class*="related-search"], [id*="relatedSearches"], [id*="related-search"], [data-cel-widget*="related-search"], [cel_widget_id*="RELATED_SEARCH"]')) {
      scopes.add(node)
    }
    for (const node of root.querySelectorAll('h1, h2, h3, span, div')) {
      const label = (node.textContent ?? '').replace(/\s+/g, ' ').trim()
      if (label.length > 40 || !RELATED_HEADING.test(label)) continue
      scopes.add(node.closest('div, section') ?? node.parentElement ?? node)
    }
  }
  for (const scope of scopes) {
    for (const link of scope.querySelectorAll('a[href*="k="]')) {
      const href = link.getAttribute('href') ?? ''
      if (/\/sspa\/|\/dp\/|\/gp\//i.test(href)) continue
      let query = ''
      try {
        query = new URL(href, 'https://www.amazon.com').searchParams.get('k') ?? ''
      } catch {
        query = ''
      }
      if (!query) continue
      const text = (link instanceof HTMLElement ? link.innerText : link.textContent ?? '').replace(/\s+/g, ' ').trim()
      const fromQuery = query.replace(/\+/g, ' ').trim()
      found.push(!text || text.length > fromQuery.length + 12 ? fromQuery : text)
    }
  }
  return found
}

function readLiveBrands(root: ParentNode): string[] {
  const found: string[] = []
  const boxes = root.querySelectorAll('#brandsRefinements, #brandsRefinementsContainer, [data-csa-c-content-id="p_89"]')
  const scopes = boxes.length > 0 ? [...boxes] : []
  for (const scope of scopes) {
    for (const node of scope.querySelectorAll('.a-size-base, .a-size-base-plus, li span')) {
      const brand = (node.textContent ?? '').replace(/\s+/g, ' ').trim()
      if (isBrandName(brand)) found.push(brand)
    }
  }
  if (found.length === 0) {
    const html = root instanceof Document
      ? root.documentElement?.innerHTML ?? ''
      : root instanceof Element
        ? root.innerHTML
        : ''
    if (html) found.push(...readBrands(html))
  }
  return found
}

function liveText(root: ParentNode, selector: string): string {
  return (root.querySelector(selector)?.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function liveDepartment(root: ParentNode): string | null {
  const box = root.querySelector('#searchDropdownBox')
  const value = box instanceof HTMLSelectElement ? box.value : box?.getAttribute('value') ?? ''
  const alias = value.replace(/^search-alias=/, '').trim()
  if (!alias) return readDepartment(root instanceof Element ? root.innerHTML : '')
  const normalized = normalizeDepartment(alias)
  return normalized === 'aps' && alias !== 'aps' ? null : normalized
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
