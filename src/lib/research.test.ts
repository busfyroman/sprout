import assert from 'node:assert/strict'
import test from 'node:test'
import { adsCsv, buildKdpBoxes, classifyPosition, connectorWords, matchesWordCount, nearDuplicateKeys } from './analysis'
import { suggestionUrl } from './endpoints'
import { getMarketplace } from './marketplaces'
import { readPageIntel } from './page-intel'
import { buildQueries, countQueries } from './queries'
import { parseResultCount } from './result-count'

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
})

test('position is relative to the seed', () => {
  assert.equal(classifyPosition('extra yoga mat', 'yoga mat'), 'before')
  assert.equal(classifyPosition('yoga mat thick', 'yoga mat'), 'after')
  assert.equal(classifyPosition('thick yoga mat bag', 'yoga mat'), 'between')
  assert.equal(classifyPosition('meditation cushion', 'yoga mat'), 'other')
  assert.equal(matchesWordCount('yoga mat thick', '3+'), true)
  assert.equal(matchesWordCount('yoga', '3+'), false)
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
    <h2>Related searches</h2><a>nurse notebook</a><a>funny gift</a>
  `
  const intel = readPageIntel(html)
  assert.equal(intel.departmentAlias, 'stripbooks')
  assert.equal(intel.productTitle, 'Funny Nurse Notebook')
  assert.ok(intel.brands.includes('Paperbird'))
  assert.ok(intel.related.includes('nurse notebook'))
  assert.equal(JSON.stringify(intel).toLowerCase().includes('reverse asin'), false)
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
