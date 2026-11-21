import assert from 'node:assert/strict'
import test from 'node:test'
import { adsCsv, buildKdpBoxes, classifyPosition, connectorWords, matchesWordCount, nearDuplicateKeys } from './analysis'
import { suggestionUrl } from './endpoints'
import { exportBasename } from './export'
import { getMarketplace } from './marketplaces'
import { isProductCode, readPageIntel } from './page-intel'
import { buildQueries, countQueries } from './queries'
import { formatResultCount, parseResultCount } from './result-count'

test('deep expand adds localized connector prefixes', () => {
  const plain = countQueries('suffix', true)
  const deep = countQueries('suffix', true, true, connectorWords('de_DE').length)
  assert.ok(deep > plain)
  const queries = buildQueries('yogamatte', 'suffix', false, true, connectorWords('de_DE'))
  assert.ok(queries.some((query) => query.text === 'yogamatte für'))
  assert.ok(queries.some((query) => query.text === 'yogamatte für a'))
})

test('department alias is sent on the completion URL', () => {
  const url = suggestionUrl(getMarketplace('in'), 'yoga mat', 'completion', 'stripbooks')
  assert.match(url, /completion\.amazon\.in/)
  assert.match(url, /mid=A21TJRUUN4KGV/)
  assert.match(url, /alias=stripbooks/)
  assert.match(url, /search-alias=stripbooks/)
  const storefront = suggestionUrl(getMarketplace('us'), 'yoga book', 'storefront', 'stripbooks')
  assert.match(storefront, /www\.amazon\.com\/suggestions/)
  assert.match(storefront, /alias=stripbooks/)
  assert.match(storefront, /search-alias=stripbooks/)
})

test('position is relative to the seed', () => {
  assert.equal(classifyPosition('extra yoga mat', 'yoga mat'), 'before')
  assert.equal(classifyPosition('yoga mat thick', 'yoga mat'), 'after')
  assert.equal(classifyPosition('thick yoga mat bag', 'yoga mat'), 'between')
  assert.equal(classifyPosition('meditation cushion', 'yoga mat'), 'other')
  assert.equal(matchesWordCount('yoga mat thick', '3+'), true)
  assert.equal(matchesWordCount('yoga mat 0.5', '3+'), true)
  assert.equal(matchesWordCount('yoga', '3+'), false)
  assert.equal(isProductCode('UPC 841710155686'), true)
  assert.equal(isProductCode('B0ABCDEF12'), true)
  assert.equal(isProductCode('yoga mat 6mm'), false)
})

test('KDP boxes stay within 50 characters and skip title words', () => {
  const boxes = buildKdpBoxes(
    ['yoga mat thick extra long travel strap pocket nonslip', 'yoga mat thick'],
    'Yoga Mat',
  )
  assert.equal(boxes.length, 7)
  assert.ok(boxes.every((box) => box.length <= 50))
  const words = boxes.join(' ').split(/\s+/).filter(Boolean)
  assert.equal(new Set(words).size, words.length)
  assert.ok(!words.some((word) => word.toLowerCase() === 'yoga' || word.toLowerCase() === 'mat'))
})

test('result count parser never calls a count search volume', () => {
  const parsed = parseResultCount('<span>1-16 of over 2,000 results for yoga mat</span>')
  assert.equal(parsed.count, 2000)
  assert.equal(parseResultCount('<span>7 results for <span>zero sugar yogurt drink</span></span>').count, 7)
  const capped = parseResultCount('<span>over 5,000 results</span>')
  assert.equal(capped.count, 5000)
  assert.equal(capped.capped, true)
  assert.equal(formatResultCount(capped.count ?? 0, capped.capped), '5,000+')
  assert.equal(parseResultCount('<span>1-48 of 48 results</span>').count, 48)
  assert.match(parseResultCount('<html><body>no count here</body></html>').message, /did not show a result count/)
  assert.match(parsed.message, /not search volume/)
  const blocked = parseResultCount('<form action="/errors/validateCaptcha">Type the characters you see</form>')
  assert.equal(blocked.blocked, true)
  assert.equal(blocked.count, null)
})

test('page intel reads related searches and store names', () => {
  const html = `
    <select id="searchDropdownBox"><option selected value="search-alias=stripbooks">Books</option></select>
    <span id="productTitle">Funny Nurse Notebook</span>
    <a id="bylineInfo">Visit the Paperbird Store</a>
    <div id="brandsRefinements"><span class="a-size-base a-color-base a-text-bold">Brand</span><span class="a-size-base a-color-base">Gaiam</span><span class="a-size-base a-color-base">Manduka</span></div>
    <h2>Related searches</h2>
    <a href="/s?k=yoga"><img alt="yoga accessories">yoga</a>
    <a href="/s?k=exercise+mat">exercise mat</a>
    <a href="/s?k=yoga+block">yoga block</a>
    <a href="/s?k=workout+mat">workout mat</a>
    <a href="/s?k=yoga+mats+for+home+workout">yoga mats for home workout</a>
    <a href="/s?k=yoga+towel">yoga towel</a>
    <a href="/dp/B000000">yoga accessories</a>
  `
  const intel = readPageIntel(html)
  assert.equal(intel.departmentAlias, 'stripbooks')
  assert.equal(intel.productTitle, 'Funny Nurse Notebook')
  assert.ok(intel.brands.includes('Paperbird'))
  assert.ok(intel.brands.includes('Gaiam'))
  assert.ok(intel.brands.includes('Manduka'))
  assert.deepEqual(intel.related, ['yoga', 'exercise mat', 'yoga block', 'workout mat', 'yoga mats for home workout', 'yoga towel'])
  assert.equal(intel.related.includes('yoga accessories'), false)
  assert.equal(JSON.stringify(intel).toLowerCase().includes('reverse asin'), false)
})

test('ads export filename keeps the seed spaces and does not repeat ads', () => {
  assert.equal(exportBasename('yoga mat', 'ads'), 'sprout-yoga-mat-ads')
  assert.equal(`${exportBasename('yoga mat', 'ads')}.csv`.includes('ads-ads'), false)
})

test('ads export uses the bulk sheet columns', () => {
  const csv = adsCsv(['yoga mat'], 'Books', 'Mats', 'Exact')
  assert.match(csv.split('\r\n')[0], /^Campaign,Ad Group,Keyword,Match Type$/)
  assert.match(csv, /Books,Mats,yoga mat,Exact/)
})

test('near duplicates are flagged and not removed', () => {
  const flagged = nearDuplicateKeys(['yoga mat', 'yoga matt', 'desk'])
  assert.ok(flagged.has('yoga mat'))
  assert.ok(flagged.has('yoga matt'))
  assert.equal(flagged.has('desk'), false)
})
