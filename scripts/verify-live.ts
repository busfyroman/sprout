import { acceptLanguage, suggestionUrl } from '../src/lib/endpoints'
import { getMarketplace } from '../src/lib/marketplaces'
import { parseSuggestionPayload } from '../src/lib/parse'

const cases = [
  { marketplaceId: 'us', prefix: 'yoga mat', min: 3 },
  { marketplaceId: 'de', prefix: 'yoga mat', min: 3 },
  { marketplaceId: 'us', prefix: 'yoga mat a', min: 3 },
  { marketplaceId: 'de', prefix: 'yogamatte', min: 3 },
]

let failed = false
for (const item of cases) {
  const marketplace = getMarketplace(item.marketplaceId)
  const url = suggestionUrl(marketplace, item.prefix, 'completion')
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': acceptLanguage(marketplace.locale),
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    },
  })
  const body = await response.text()
  let values: string[] = []
  let parseError = ''
  try {
    values = parseSuggestionPayload(JSON.parse(body))
  } catch (error) {
    parseError = error instanceof Error ? error.message : 'parse failed'
  }
  const ok = response.ok && values.length >= item.min
  if (!ok) failed = true
  console.log(
    `${ok ? 'ok' : 'FAIL'} ${marketplace.domain} “${item.prefix}” HTTP ${response.status} n=${values.length} ${values.slice(0, 6).join(' | ')}${parseError ? ` (${parseError})` : ''}`,
  )
}

if (failed) throw new Error('Live suggestion check failed.')
console.log('Live suggestion check passed.')
