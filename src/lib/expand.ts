import type { EndpointKind } from './endpoints'
import { REQUEST_LIMITS } from './limits'
import type { Marketplace } from './marketplaces'
import { buildQueries, cleanSeed, type QuerySpec } from './queries'
import { addSuggestion } from './results'
import {
  createClientContext,
  errorText,
  fetchBatch,
  isAbortError,
  ProbeFailedError,
  type ClientContext,
  type SuggestionBatch,
} from './suggest'
import type { ExpandMode, RunSnapshot, Suggestion } from './types'

export interface ExpandInput {
  seed: string
  marketplace: Marketplace
  mode: ExpandMode
  includeSpace: boolean
  signal: AbortSignal
  onProgress: (run: RunSnapshot) => void
  client?: ClientContext
}

export async function expandSeed(input: ExpandInput): Promise<RunSnapshot> {
  const seed = cleanSeed(input.seed)
  const queries = buildQueries(seed, input.mode, input.includeSpace)
  const client = input.client ?? createClientContext()
  let snapshot = createRun(input, seed, queries.length)

  const emit = (next: RunSnapshot) => {
    snapshot = next
    input.onProgress(next)
  }

  if (!seed || queries.length === 0) {
    emit({
      ...snapshot,
      status: 'error',
      error: 'Enter a seed keyword.',
      finishedAt: Date.now(),
    })
    return snapshot
  }

  emit(snapshot)

  try {
    const probe = await probeSeed(input.marketplace, queries[0], input.signal, client)
    const suggestions = new Map<string, Suggestion>()
    addQuerySuggestions(suggestions, queries[0], probe.batch.values, input.marketplace.id)
    let endpoint: EndpointKind = probe.endpoint
    let laterFallback = false
    let failedQueries = 0
    let finishedQueries = 1
    let firstFailure = ''

    const publish = (status: RunSnapshot['status'], extra?: { recentLabel?: string; error?: string | null }) => {
      const copied = [...suggestions.values()].map((item) => ({
        ...item,
        sources: [...item.sources],
        marketplaces: [...(item.marketplaces ?? [])],
      }))
      emit({
        ...snapshot,
        suggestions: copied,
        finishedQueries,
        failedQueries,
        endpointLabel: probe.batch.host,
        usedFallback: probe.usedFallback || laterFallback,
        recentLabel: extra?.recentLabel ?? snapshot.recentLabel,
        warnings: collectWarnings({
          marketplace: input.marketplace,
          probeFallback: probe.usedFallback,
          laterFallback,
          host: probe.batch.host,
          failedQueries,
          totalQueries: queries.length,
          firstFailure,
          status,
          suggestionCount: copied.length,
          seed,
        }),
        status,
        error: extra?.error ?? null,
        finishedAt: status === 'running' ? null : Date.now(),
      })
    }

    publish('running', { recentLabel: queries[0].label })

    await runPool(queries.slice(1), REQUEST_LIMITS.concurrency, async (query) => {
      if (input.signal.aborted) throw new DOMException('The expansion was stopped.', 'AbortError')
      emit({ ...snapshot, recentLabel: query.label })
      try {
        const batch = await fetchPreferred(input.marketplace, query.text, endpoint, input.signal, client)
        if (batch.endpoint !== endpoint) laterFallback = true
        addQuerySuggestions(suggestions, query, batch.values, input.marketplace.id)
      } catch (error) {
        if (isAbortError(error) || input.signal.aborted) throw error
        failedQueries += 1
        if (!firstFailure) firstFailure = errorText(error)
      } finally {
        finishedQueries += 1
        if (!input.signal.aborted) publish('running', { recentLabel: query.label })
      }
    }, input.signal)

    if (failedQueries === queries.length || (suggestions.size === 0 && failedQueries > 0 && finishedQueries === queries.length)) {
      publish('error', {
        error: firstFailure || `Amazon returned no usable suggestions for “${seed}” on ${input.marketplace.domain}.`,
      })
      return snapshot
    }

    publish('done')
    return snapshot
  } catch (error) {
    if (isAbortError(error) || input.signal.aborted) {
      emit({
        ...snapshot,
        status: 'cancelled',
        finishedAt: Date.now(),
        error: null,
        warnings: [
          `Stopped early at ${snapshot.finishedQueries} of ${snapshot.totalQueries} prefixes. Kept ${snapshot.suggestions.length} suggestions.`,
        ],
      })
      return snapshot
    }
    emit({
      ...snapshot,
      status: 'error',
      finishedAt: Date.now(),
      error: errorText(error),
    })
    return snapshot
  }
}

function createRun(input: ExpandInput, seed: string, totalQueries: number): RunSnapshot {
  return {
    seed,
    marketplaceId: input.marketplace.id,
    marketplaceIds: [input.marketplace.id],
    mode: input.mode,
    includeSpace: input.includeSpace,
    suggestions: [],
    totalQueries,
    finishedQueries: 0,
    failedQueries: 0,
    endpointLabel: input.marketplace.completionHost,
    usedFallback: false,
    warnings: [],
    error: null,
    status: 'running',
    startedAt: Date.now(),
    finishedAt: null,
    recentLabel: 'seed',
  }
}

async function probeSeed(
  marketplace: Marketplace,
  query: QuerySpec,
  signal: AbortSignal,
  client: ClientContext,
): Promise<{ endpoint: EndpointKind; batch: SuggestionBatch; usedFallback: boolean }> {
  try {
    const primary = await fetchBatch(marketplace, query.text, 'completion', signal, client)
    if (primary.values.length > 0) {
      return { endpoint: 'completion', batch: primary, usedFallback: false }
    }
    try {
      const alternate = await fetchBatch(marketplace, query.text, 'storefront', signal, client)
      if (alternate.values.length > 0) {
        return { endpoint: 'storefront', batch: alternate, usedFallback: true }
      }
    } catch (error) {
      if (isAbortError(error)) throw error
    }
    return { endpoint: 'completion', batch: primary, usedFallback: false }
  } catch (primaryError) {
    if (isAbortError(primaryError)) throw primaryError
    try {
      const alternate = await fetchBatch(marketplace, query.text, 'storefront', signal, client)
      return { endpoint: 'storefront', batch: alternate, usedFallback: true }
    } catch (secondaryError) {
      if (isAbortError(secondaryError)) throw secondaryError
      throw new ProbeFailedError(marketplace, primaryError, secondaryError)
    }
  }
}

async function fetchPreferred(
  marketplace: Marketplace,
  prefix: string,
  endpoint: EndpointKind,
  signal: AbortSignal,
  client: ClientContext,
): Promise<SuggestionBatch> {
  try {
    return await fetchBatch(marketplace, prefix, endpoint, signal, client)
  } catch (error) {
    if (isAbortError(error)) throw error
    const other: EndpointKind = endpoint === 'completion' ? 'storefront' : 'completion'
    return fetchBatch(marketplace, prefix, other, signal, client)
  }
}

function addQuerySuggestions(
  map: Map<string, Suggestion>,
  query: QuerySpec,
  values: string[],
  marketplaceId: string,
): void {
  for (const value of values) {
    addSuggestion(map, value, {
      label: query.label,
      exportLabel: query.exportLabel,
      index: query.index,
    }, marketplaceId)
  }
}

function collectWarnings(input: {
  marketplace: Marketplace
  probeFallback: boolean
  laterFallback: boolean
  host: string
  failedQueries: number
  totalQueries: number
  firstFailure: string
  status: RunSnapshot['status']
  suggestionCount: number
  seed: string
}): string[] {
  const warnings: string[] = []
  if (input.probeFallback) {
    warnings.push(`${input.marketplace.completionHost} didn’t return the seed, so this run uses ${input.host}.`)
  } else if (input.laterFallback) {
    warnings.push(`Some prefixes failed on ${input.host} and were retried on the other Amazon endpoint.`)
  }
  if (input.failedQueries > 0 && input.status !== 'error') {
    const detail = input.firstFailure ? ` ${input.firstFailure}` : ''
    warnings.push(`${input.failedQueries} of ${input.totalQueries} prefixes failed.${detail} The rest of the list is still usable.`)
  }
  if (input.status === 'done' && input.suggestionCount === 0) {
    warnings.push(`Amazon returned no suggestions for “${input.seed}” on ${input.marketplace.domain}. Try a shorter seed or another marketplace.`)
  }
  return warnings
}

async function runPool<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
  signal: AbortSignal,
): Promise<void> {
  if (items.length === 0) return
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (!signal.aborted) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      await worker(items[index])
    }
  })
  await Promise.all(runners)
}
