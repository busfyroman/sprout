import { LOCK_STALE_MS } from './limits'
import { getMarketplace } from './marketplaces'
import type { ExpandMode, RunSnapshot, SortKey, SproutState } from './types'

export const STORAGE_KEY = 'sprout.v1'

const MODES = new Set<ExpandMode>(['suffix', 'prefix', 'both'])
const SORTS = new Set<SortKey>(['alpha', 'alpha-desc', 'shortest', 'longest', 'source'])

export function defaultState(): SproutState {
  return {
    version: 1,
    seed: '',
    marketplaceId: 'us',
    mode: 'suffix',
    includeSpace: true,
    sort: 'alpha',
    run: null,
    runLock: null,
    history: [],
  }
}

export function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local)
}

export async function loadState(): Promise<SproutState> {
  if (!hasChromeStorage()) return defaultState()
  const bag = await chrome.storage.local.get(STORAGE_KEY)
  return normalizeState(bag[STORAGE_KEY])
}

export async function saveState(state: SproutState): Promise<void> {
  if (!hasChromeStorage()) return
  await chrome.storage.local.set({ [STORAGE_KEY]: state })
}

export function watchState(onChange: (state: SproutState) => void): () => void {
  if (!hasChromeStorage()) return () => {}
  const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, area) => {
    if (area !== 'local' || !changes[STORAGE_KEY]) return
    onChange(normalizeState(changes[STORAGE_KEY].newValue))
  }
  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}

export function normalizeState(raw: unknown): SproutState {
  const base = defaultState()
  if (!raw || typeof raw !== 'object') return base
  const value = raw as Partial<SproutState>
  const mode = MODES.has(value.mode as ExpandMode) ? (value.mode as ExpandMode) : base.mode
  const sort = SORTS.has(value.sort as SortKey) ? (value.sort as SortKey) : base.sort
  const marketplaceId = typeof value.marketplaceId === 'string' ? getMarketplace(value.marketplaceId).id : base.marketplaceId
  let run = isRun(value.run) ? value.run : null
  let runLock = isLock(value.runLock) ? value.runLock : null
  if (run?.status === 'running' && (!runLock || Date.now() - runLock.heartbeat >= LOCK_STALE_MS)) {
    run = {
      ...run,
      status: 'cancelled',
      finishedAt: run.finishedAt ?? Date.now(),
      warnings: [
        ...run.warnings,
        `Stopped early at ${run.finishedQueries} of ${run.totalQueries} prefixes. Kept ${run.suggestions.length} suggestions.`,
      ],
    }
    runLock = null
  }
  return {
    version: 1,
    seed: typeof value.seed === 'string' ? value.seed : '',
    marketplaceId,
    mode,
    includeSpace: typeof value.includeSpace === 'boolean' ? value.includeSpace : true,
    sort,
    run,
    runLock,
    history: Array.isArray(value.history) ? value.history : [],
    writerId: typeof value.writerId === 'string' ? value.writerId : undefined,
  }
}

function isLock(value: unknown): value is NonNullable<SproutState['runLock']> {
  if (!value || typeof value !== 'object') return false
  const lock = value as { ownerId?: unknown; heartbeat?: unknown }
  return typeof lock.ownerId === 'string' && typeof lock.heartbeat === 'number'
}

function isRun(value: unknown): value is RunSnapshot {
  if (!value || typeof value !== 'object') return false
  const run = value as Partial<RunSnapshot>
  return typeof run.seed === 'string' && Array.isArray(run.suggestions) && typeof run.status === 'string'
}
