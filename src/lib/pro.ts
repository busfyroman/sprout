import { expandSeed, type ExpandInput } from './expand'
import { MARKETPLACES } from './marketplaces'
import type { HistoryEntry, RunSnapshot } from './types'

export type ProCapability = 'multiMarketplace' | 'history'

export interface ProEntitlements {
  multiMarketplace: boolean
  history: boolean
}

/** Free build. A later license check replaces this object; callers already branch on it. */
export const CURRENT_ENTITLEMENTS: ProEntitlements = {
  multiMarketplace: false,
  history: false,
}

export class ProRequiredError extends Error {
  readonly capability: ProCapability

  constructor(capability: ProCapability) {
    super(capability === 'multiMarketplace'
      ? 'Multi-marketplace batch is a Pro feature.'
      : 'Saved history is a Pro feature.')
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
): HistoryEntry[] {
  if (!hasPro('history', entitlements)) return []
  return [entry, ...history.filter((item) => item.id !== entry.id)].slice(0, 50)
}

export async function expandAllMarketplaces(
  input: Omit<ExpandInput, 'marketplace' | 'onProgress'> & {
    onMarketplace: (marketplaceId: string, run: RunSnapshot) => void
    entitlements?: ProEntitlements
  },
): Promise<void> {
  const entitlements = input.entitlements ?? CURRENT_ENTITLEMENTS
  if (!hasPro('multiMarketplace', entitlements)) throw new ProRequiredError('multiMarketplace')
  for (const marketplace of MARKETPLACES) {
    if (input.signal.aborted) return
    await expandSeed({
      seed: input.seed,
      marketplace,
      mode: input.mode,
      includeSpace: input.includeSpace,
      signal: input.signal,
      client: input.client,
      onProgress: (run) => input.onMarketplace(marketplace.id, run),
    })
  }
}
