import { connectorWords } from './analysis'
import { expandSeed, type ExpandInput } from './expand'
import { countQueries } from './queries'
import { getMarketplace, MARKETPLACES } from './marketplaces'
import { mergeSuggestion } from './results'
import { errorText } from './suggest'
import type { HistoryEntry, RunSnapshot, Suggestion } from './types'

export type ProCapability = 'multiMarketplace' | 'history' | 'searchTerms' | 'savedKeywords' | 'exclusions'

export interface ProEntitlements {
  multiMarketplace: boolean
  history: boolean
  searchTerms: boolean
  savedKeywords: boolean
  exclusions: boolean
}

/**
 * Every flag is on. This build has no license check and no account.
 * A later build can replace this object; callers already branch on hasPro.
 */
export const CURRENT_ENTITLEMENTS: ProEntitlements = {
  multiMarketplace: true,
  history: true,
  searchTerms: true,
  savedKeywords: true,
  exclusions: true,
}

export class ProRequiredError extends Error {
  readonly capability: ProCapability

  constructor(capability: ProCapability) {
    super(`${capability} is turned off in this build.`)
    this.name = 'ProRequiredError'
    this.capability = capability
  }
}

export function hasPro(capability: ProCapability, entitlements: ProEntitlements = CURRENT_ENTITLEMENTS): boolean {
  return entitlements[capability]
}

export function appendHistory(
  history: readonly HistoryEntry[],
  entry: HistoryEntry,
  entitlements: ProEntitlements = CURRENT_ENTITLEMENTS,
  limit = 20,
): HistoryEntry[] {
  if (!hasPro('history', entitlements)) return []
  return [entry, ...history.filter((item) => item.id !== entry.id)].slice(0, limit)
}

export async function expandSelectedMarketplaces(
  input: Omit<ExpandInput, 'marketplace' | 'onProgress'> & {
    marketplaceIds: string[]
    onProgress: (run: RunSnapshot) => void
    entitlements?: ProEntitlements
  },
): Promise<RunSnapshot> {
  const entitlements = input.entitlements ?? CURRENT_ENTITLEMENTS
  const ids = [...new Set(input.marketplaceIds.map((id) => getMarketplace(id).id))]
  if (ids.length > 1 && !hasPro('multiMarketplace', entitlements)) {
    throw new ProRequiredError('multiMarketplace')
  }
  const selected = ids.length > 0 ? ids : [getMarketplace('us').id]
  const connectorCount = input.deep ? connectorWords(getMarketplace(selected[0] ?? 'us').locale).length : 0
  const perMarket = countQueries(input.mode, input.includeSpace, Boolean(input.deep), connectorCount || 6)
  const combined = new Map<string, Suggestion>()
  const warnings: string[] = []
  let failedQueries = 0
  let failedPrefixes: string[] = []
  let finishedQueries = 0
  let endpointLabel = getMarketplace(selected[0]).completionHost
  let usedFallback = false
  const startedAt = Date.now()
  let status: RunSnapshot['status'] = 'running'

  const emit = (patch: Partial<RunSnapshot> & { suggestions: Suggestion[] }, runStatus: RunSnapshot['status']) => {
    const snapshot: RunSnapshot = {
      seed: input.seed,
      marketplaceId: selected[0],
      marketplaceIds: selected,
      mode: input.mode,
      includeSpace: input.includeSpace,
      alias: input.alias,
      deep: input.deep,
      depth: input.depth,
      suggestions: patch.suggestions,
      totalQueries: selected.length * perMarket,
      finishedQueries: patch.finishedQueries ?? 0,
      failedQueries: patch.failedQueries ?? failedQueries,
      failedPrefixes: patch.failedPrefixes ?? failedPrefixes,
      endpointLabel: patch.endpointLabel ?? endpointLabel,
      usedFallback: patch.usedFallback ?? usedFallback,
      warnings: patch.warnings ?? warnings,
      error: patch.error ?? null,
      status: runStatus,
      startedAt,
      finishedAt: runStatus === 'running' ? null : Date.now(),
      recentLabel: patch.recentLabel ?? 'seed',
    }
    input.onProgress(snapshot)
    return snapshot
  }

  try {
    for (let index = 0; index < selected.length; index += 1) {
      if (input.signal.aborted) {
        status = 'cancelled'
        break
      }
      const marketplace = getMarketplace(selected[index])
      const result = await expandSeed({
        seed: input.seed,
        marketplace,
        mode: input.mode,
        includeSpace: input.includeSpace,
        alias: input.alias,
        deep: input.deep,
        depth: input.depth,
        signal: input.signal,
        client: input.client,
        onProgress: (run) => {
          const view = cloneSuggestions(combined)
          for (const suggestion of run.suggestions) mergeSuggestion(view, suggestion)
          endpointLabel = run.endpointLabel
          usedFallback = usedFallback || run.usedFallback
          finishedQueries = index * perMarket + run.finishedQueries
          if (input.signal.aborted && run.status === 'running') return
          emit({
            suggestions: [...view.values()],
            finishedQueries,
            failedQueries: failedQueries + run.failedQueries,
            failedPrefixes: [...failedPrefixes, ...(run.failedPrefixes ?? [])],
            endpointLabel: run.endpointLabel,
            usedFallback,
            recentLabel: selected.length > 1 ? `${marketplace.code} · ${run.recentLabel}` : run.recentLabel,
            warnings: run.status === 'cancelled' ? run.warnings : warnings,
          }, input.signal.aborted || run.status === 'cancelled' ? 'cancelled' : 'running')
        },
      })
      for (const suggestion of result.suggestions) mergeSuggestion(combined, suggestion)
      failedQueries += result.failedQueries
      failedPrefixes = [...failedPrefixes, ...(result.failedPrefixes ?? [])]
      endpointLabel = result.endpointLabel || endpointLabel
      usedFallback = usedFallback || result.usedFallback
      if (result.status === 'cancelled') {
        status = 'cancelled'
        break
      }
      if (result.status === 'error' && result.error) {
        warnings.push(selected.length > 1 ? `${marketplace.code}: ${result.error}` : result.error)
      } else {
        for (const warning of result.warnings) {
          warnings.push(selected.length > 1 ? `${marketplace.code}: ${warning}` : warning)
        }
      }
    }
  } catch (error) {
    if (input.signal.aborted) status = 'cancelled'
    else {
      status = 'error'
      return emit({
        suggestions: [...combined.values()],
        finishedQueries: selected.length * perMarket,
        failedQueries,
        warnings,
        error: errorText(error),
        recentLabel: 'seed',
      }, 'error')
    }
  }

  if (status === 'running') status = combined.size === 0 && warnings.length > 0 && failedQueries > 0 ? 'error' : 'done'
  if (status !== 'cancelled') finishedQueries = selected.length * perMarket
  return emit({
    suggestions: [...combined.values()],
    finishedQueries,
    failedQueries,
    warnings,
    error: status === 'error' ? warnings[0] ?? 'Amazon returned no suggestions.' : null,
    recentLabel: 'seed',
    endpointLabel,
    usedFallback,
  }, status)
}

function cloneSuggestions(source: Map<string, Suggestion>): Map<string, Suggestion> {
  const copy = new Map<string, Suggestion>()
  for (const [key, value] of source) {
    copy.set(key, {
      ...value,
      sources: value.sources.map((sourceItem) => ({ ...sourceItem })),
      marketplaces: [...(value.marketplaces ?? [])],
    })
  }
  return copy
}

export async function expandAllMarketplaces(
  input: Omit<ExpandInput, 'marketplace' | 'onProgress'> & {
    onMarketplace: (marketplaceId: string, run: RunSnapshot) => void
    entitlements?: ProEntitlements
  },
): Promise<void> {
  await expandSelectedMarketplaces({
    ...input,
    marketplaceIds: MARKETPLACES.map((marketplace) => marketplace.id),
    entitlements: input.entitlements,
    onProgress: (run) => {
      const current = run.marketplaceIds?.[run.marketplaceIds.length - 1] ?? run.marketplaceId
      input.onMarketplace(current, run)
    },
  })
}
