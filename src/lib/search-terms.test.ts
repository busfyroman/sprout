import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { amazonSearchUrl, googleTrendsUrl } from './links'
import { isExcluded } from './results'
import { buildSearchTerms, utf8Bytes } from './search-terms'
import { expandSelectedMarketplaces } from './pro'
import { createClientContext } from './suggest'

describe('search terms', () => {
  const phrases = [
    'yoga mat thick',
    'yoga mat towel',
    'yoga mat thick extra',
    'cork yoga mat',
    'best yoga mat for women',
  ]

  it('fills the byte budget with the most common words and skips stop words', () => {
    const plan = buildSearchTerms({ phrases, limit: 249 })
    assert.ok(plan.bytes <= 249)
    assert.deepEqual(plan.words.slice(0, 2).sort(), ['mat', 'yoga'])
    assert.ok(plan.words.includes('thick'))
    assert.equal(plan.words.includes('for'), false)
    assert.equal(plan.text, plan.words.join(' '))
  })

  it('leaves out title words, exclusions, and a dropped word so the next one fits', () => {
    const open = buildSearchTerms({ phrases, listingText: 'Premium yoga mat', excluded: ['towel'], limit: 40 })
    assert.equal(open.words.includes('yoga'), false)
    assert.equal(open.words.includes('mat'), false)
    assert.equal(open.words.includes('towel'), false)
    assert.ok(open.words.includes('thick'))
    const dropped = buildSearchTerms({
      phrases,
      listingText: 'Premium yoga mat',
      excluded: ['towel'],
      dropped: ['thick'],
      limit: 40,
    })
    assert.equal(dropped.words.includes('thick'), false)
    assert.ok(dropped.words.includes('cork') || dropped.words.includes('extra') || dropped.words.includes('best'))
    assert.ok(dropped.bytes <= 40)
  })

  it('counts utf-8 bytes rather than characters', () => {
    assert.equal(utf8Bytes('mädchen'), 8)
    const plan = buildSearchTerms({ phrases: ['mädchen mädchen', 'mädchen'], limit: 8 })
    assert.equal(plan.text, 'mädchen')
    assert.equal(plan.bytes, 8)
  })
})

describe('exclusions', () => {
  it('hides a keyword when an excluded word appears in it', () => {
    assert.equal(isExcluded('manduka yoga mat', ['manduka']), true)
    assert.equal(isExcluded('yoga mat thick', ['manduka']), false)
    assert.equal(isExcluded('extra thick yoga mat', ['yoga mat']), true)
  })
})

describe('links', () => {
  it('points at the marketplace search and trends geo', () => {
    assert.equal(amazonSearchUrl('de', 'yoga matte'), 'https://www.amazon.de/s?k=yoga+matte')
    assert.match(googleTrendsUrl('yoga mat', 'uk'), /geo=GB/)
    assert.match(googleTrendsUrl('yoga mat', 'uk'), /q=yoga\+mat/)
  })
})

describe('batch', () => {
  it('tags the same phrase with every marketplace that returned it', async () => {
    const hosts: string[] = []
    const client = createClientContext({
      gapMs: 0,
      maxGapMs: 0,
      retries: 1,
      backoffBaseMs: 0,
      timeoutMs: 5000,
      sleepFn: async () => {},
      fetchImpl: async (input) => {
        const url = new URL(String(input))
        hosts.push(url.host)
        return new Response(JSON.stringify({ suggestions: [{ value: 'shared mat' }, { value: `${url.host} only` }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      },
    })
    const run = await expandSelectedMarketplaces({
      seed: 'mat',
      marketplaceIds: ['us', 'de'],
      mode: 'suffix',
      includeSpace: false,
      signal: new AbortController().signal,
      client,
      onProgress: () => {},
    })
    assert.equal(run.status, 'done')
    assert.deepEqual(run.marketplaceIds, ['us', 'de'])
    const shared = run.suggestions.find((item) => item.key === 'shared mat')
    assert.deepEqual(shared?.marketplaces, ['us', 'de'])
    assert.ok(hosts.includes('completion.amazon.com'))
    assert.ok(hosts.includes('completion.amazon.de'))
  })
})
