import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { suggestionUrl } from './endpoints'
import { expandSeed } from './expand'
import { buildCsv, buildExportRows, keywordsToCopy, safeSpreadsheetText } from './export'
import { getMarketplace } from './marketplaces'
import { readPageSeed } from './page-context'
import { parseSuggestionPayload, UnexpectedSuggestionError } from './parse'
import { appendHistory, expandAllMarketplaces, hasPro, ProRequiredError } from './pro'
import { buildQueries, countQueries, describePlan } from './queries'
import { addSuggestion, filterSuggestions, sortSuggestions } from './results'
import { createClientContext } from './suggest'
import { normalizeState } from './storage'
import type { HistoryEntry, RunSnapshot, Suggestion } from './types'
import { buildXlsx } from './xlsx'

describe('queries', () => {
  it('counts seed plus every letter and digit', () => {
    assert.equal(countQueries('suffix', false), 37)
    assert.equal(countQueries('suffix', true), 73)
    assert.equal(countQueries('both', true), 145)
    assert.equal(buildQueries('yoga mat', 'suffix', true).length, 73)
    const both = buildQueries('yoga mat', 'both', true)
    assert.deepEqual(
      both.filter((query) => query.text.includes('a') && (query.text.startsWith('a') || query.text.endsWith('a') || query.text.includes(' a'))).map((query) => query.text),
      ['yoga mata', 'yoga mat a', 'ayoga mat', 'a yoga mat'],
    )
  })

  it('describes the plan with the typed seed', () => {
    assert.equal(describePlan('yoga mat', 'suffix', true).example, 'yoga mata · yoga mat a')
  })
})

describe('results', () => {
  it('dedupes case-insensitively and keeps every source', () => {
    const map = new Map<string, Suggestion>()
    addSuggestion(map, 'Yoga Mat', { label: 'seed', exportLabel: 'seed', index: 0 })
    addSuggestion(map, 'yoga  mat', { label: '+ a', exportLabel: 'suffix space a', index: 2 })
    addSuggestion(map, 'yoga mat', { label: '+ a', exportLabel: 'suffix space a', index: 2 })
    const [only] = [...map.values()]
    assert.equal(only.value, 'Yoga Mat')
    assert.equal(only.sources.length, 2)
    const sorted = sortSuggestions([
      { key: 'b', value: 'bb', sources: [{ label: '+b', exportLabel: 'suffix b', index: 2 }] },
      { key: 'a', value: 'a', sources: [{ label: 'seed', exportLabel: 'seed', index: 0 }] },
    ], 'source')
    assert.deepEqual(sorted.map((item) => item.value), ['a', 'bb'])
    assert.equal(filterSuggestions(sorted, '+b').length, 1)
  })
})

describe('parse', () => {
  it('reads the 2017 suggestions object and the legacy array', () => {
    assert.deepEqual(
      parseSuggestionPayload({
        suggestions: [{ value: 'yoga mat thick' }, { value: 'yoga mat' }, { value: '  ' }],
      }),
      ['yoga mat thick', 'yoga mat'],
    )
    assert.deepEqual(parseSuggestionPayload(['yoga', ['yoga mat', 'yoga block']]), ['yoga mat', 'yoga block'])
    assert.throws(() => parseSuggestionPayload('<html></html>'), UnexpectedSuggestionError)
    assert.throws(() => parseSuggestionPayload({ alias: 'aps' }), UnexpectedSuggestionError)
  })
})

describe('endpoints', () => {
  it('builds the completion and storefront urls', () => {
    const germany = getMarketplace('de')
    const completion = new URL(suggestionUrl(germany, 'yoga mat', 'completion'))
    assert.equal(completion.host, 'completion.amazon.de')
    assert.equal(completion.searchParams.get('mid'), 'A1PA6795UKMFR9')
    assert.equal(completion.searchParams.get('prefix'), 'yoga mat')
    assert.equal(completion.searchParams.get('alias'), 'aps')
    const storefront = new URL(suggestionUrl(getMarketplace('in'), 'yoga mat', 'storefront', 'stripbooks'))
    assert.equal(storefront.host, 'www.amazon.in')
    assert.equal(storefront.pathname, '/suggestions')
    assert.equal(storefront.searchParams.get('alias'), 'stripbooks')
  })
})

describe('page context', () => {
  it('reads the Amazon search keyword from the url', () => {
    assert.equal(readPageSeed('https://www.amazon.com/s?k=yoga+mat&ref=nb_sb_noss'), 'yoga mat')
    assert.equal(readPageSeed('https://www.amazon.de/s?field-keywords=yogamatte'), 'yogamatte')
    assert.equal(readPageSeed('https://www.amazon.fr/gp/bestsellers', 'tapis'), 'tapis')
    assert.equal(getMarketplace('uk').domain, 'amazon.co.uk')
  })
})

describe('expand', () => {
  it('dedupes a mocked completion run and does not touch the storefront', async () => {
    const calls: string[] = []
    const client = createClientContext({
      gapMs: 0,
      maxGapMs: 0,
      retries: 1,
      backoffBaseMs: 0,
      timeoutMs: 5000,
      sleepFn: async () => {},
      fetchImpl: async (input) => {
        const url = new URL(String(input))
        calls.push(url.host)
        assert.equal(url.host, 'completion.amazon.com')
        const prefix = url.searchParams.get('prefix') ?? ''
        return json([`${prefix} extra`, 'Shared Hit'])
      },
    })
    const run = await expandSeed({
      seed: 'mat',
      marketplace: getMarketplace('us'),
      mode: 'suffix',
      includeSpace: false,
      signal: new AbortController().signal,
      client,
      onProgress: () => {},
    })
    assert.equal(run.status, 'done')
    assert.equal(run.failedQueries, 0)
    assert.equal(calls.length, 37)
    const shared = run.suggestions.find((item) => item.key === 'shared hit')
    assert.ok(shared)
    assert.ok(shared.sources.length > 1)
    assert.equal(run.usedFallback, false)
  })

  it('falls back to the storefront when the completion host fails', async () => {
    const hosts = new Set<string>()
    const client = createClientContext({
      gapMs: 0,
      maxGapMs: 0,
      retries: 1,
      backoffBaseMs: 0,
      timeoutMs: 5000,
      sleepFn: async () => {},
      fetchImpl: async (input) => {
        const url = new URL(String(input))
        hosts.add(url.host)
        if (url.host.startsWith('completion.')) return new Response('upstream', { status: 502 })
        return json(['yoga matte'])
      },
    })
    const run = await expandSeed({
      seed: 'yoga',
      marketplace: getMarketplace('de'),
      mode: 'suffix',
      includeSpace: false,
      signal: new AbortController().signal,
      client,
      onProgress: () => {},
    })
    assert.equal(run.status, 'done')
    assert.equal(run.usedFallback, true)
    assert.equal(run.endpointLabel, 'www.amazon.de')
    assert.ok(run.suggestions.some((item) => item.value === 'yoga matte'))
    assert.ok(hosts.has('completion.amazon.de'))
    assert.ok(hosts.has('www.amazon.de'))
    assert.match(run.warnings[0] ?? '', /didn’t return the seed/)
  })

  it('explains it when both endpoints fail', async () => {
    const client = createClientContext({
      gapMs: 0,
      maxGapMs: 0,
      retries: 1,
      backoffBaseMs: 0,
      timeoutMs: 5000,
      sleepFn: async () => {},
      fetchImpl: async () => new Response('missing', { status: 404, headers: { 'content-type': 'text/html' } }),
    })
    const run = await expandSeed({
      seed: 'yoga mat',
      marketplace: getMarketplace('us'),
      mode: 'suffix',
      includeSpace: false,
      signal: new AbortController().signal,
      client,
      onProgress: () => {},
    })
    assert.equal(run.status, 'error')
    assert.match(run.error ?? '', /completion\.amazon\.com/)
    assert.match(run.error ?? '', /www\.amazon\.com/)
    assert.match(run.error ?? '', /may have changed/)
    assert.equal(run.suggestions.length, 0)
  })
})

describe('export', () => {
  it('copies newline separated keywords and guards spreadsheet formulas', () => {
    const items: Suggestion[] = [
      {
        key: '=cmd',
        value: '=cmd',
        sources: [{ label: '+a', exportLabel: 'suffix a', index: 1 }],
      },
    ]
    assert.equal(keywordsToCopy(items), '=cmd')
    assert.equal(safeSpreadsheetText('=cmd'), "'=cmd")
    const rows = buildExportRows(items, { seed: 'yoga mat', marketplace: 'Germany', domain: 'amazon.de' })
    assert.equal(rows[1]?.[0], "'=cmd")
    const csv = buildCsv(items, { seed: 'yoga, mat', marketplace: 'United States', domain: 'amazon.com' })
    assert.match(csv, /'=cmd/)
    assert.match(csv, /"yoga, mat"/)
  })

  it('writes a stored xlsx with the keyword inside', () => {
    const bytes = buildXlsx([['keyword'], ['yoga mat']])
    assert.equal(bytes[0], 0x50)
    assert.equal(bytes[1], 0x4b)
    const text = Buffer.from(bytes).toString('latin1')
    assert.match(text, /xl\/worksheets\/sheet1\.xml/)
    assert.match(text, /yoga mat/)
  })
})

describe('pro', () => {
  it('keeps multi-marketplace and history behind the free flag', async () => {
    assert.equal(hasPro('history'), false)
    assert.deepEqual(appendHistory([], fakeHistory().entry), [])
    const kept = appendHistory([], fakeHistory().entry, { history: true, multiMarketplace: false })
    assert.equal(kept.length, 1)
    await assert.rejects(
      expandAllMarketplaces({
        seed: 'yoga',
        mode: 'suffix',
        includeSpace: false,
        signal: new AbortController().signal,
        onMarketplace: () => {},
      }),
      ProRequiredError,
    )
  })
})

describe('storage', () => {
  it('drops an abandoned run and ignores unknown marketplaces', () => {
    const state = normalizeState({
      seed: 'yoga',
      marketplaceId: 'mars',
      mode: 'nope',
      includeSpace: false,
      sort: 'longest',
      run: {
        seed: 'yoga',
        marketplaceId: 'us',
        mode: 'suffix',
        includeSpace: true,
        suggestions: [],
        totalQueries: 10,
        finishedQueries: 4,
        failedQueries: 0,
        endpointLabel: 'completion.amazon.com',
        usedFallback: false,
        warnings: [],
        error: null,
        status: 'running',
        startedAt: 1,
        finishedAt: null,
        recentLabel: 'seed',
      },
      runLock: { ownerId: 'other', heartbeat: Date.now() - 60_000 },
      history: [],
    })
    assert.equal(state.marketplaceId, 'us')
    assert.equal(state.mode, 'suffix')
    assert.equal(state.sort, 'longest')
    assert.equal(state.includeSpace, false)
    assert.equal(state.run?.status, 'cancelled')
    assert.equal(state.runLock, null)
  })
})

function json(values: string[]): Response {
  return new Response(JSON.stringify({ suggestions: values.map((value) => ({ value, type: 'KEYWORD' })) }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function fakeHistory(): { entry: HistoryEntry; run: RunSnapshot } {
  const run: RunSnapshot = {
    seed: 'yoga',
    marketplaceId: 'us',
    mode: 'suffix',
    includeSpace: true,
    suggestions: [],
    totalQueries: 1,
    finishedQueries: 1,
    failedQueries: 0,
    endpointLabel: 'completion.amazon.com',
    usedFallback: false,
    warnings: [],
    error: null,
    status: 'done',
    startedAt: 1,
    finishedAt: 2,
    recentLabel: 'seed',
  }
  return { run, entry: { id: '1', savedAt: 2, run } }
}
