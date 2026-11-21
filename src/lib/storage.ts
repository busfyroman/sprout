import { DEFAULT_SEARCH_TERM_BYTES, LOCK_STALE_MS } from './limits'
import { getMarketplace } from './marketplaces'
import { sanitizeRestoredSeed } from './queries'
import { parseWordList } from './search-terms'
import type { ExpandMode, RunSnapshot, SortKey, SproutState } from './types'

export const SETTINGS_KEY = 'sprout.settings'

export interface SproutSettings {
  seed: string
  marketplaceId: string
  selectedMarketplaceIds: string[]
  mode: ExpandMode
  includeSpace: boolean
  sort: SortKey
  excludedWords: string[]
  listingText: string
  searchTermByteLimit: number
  droppedSearchWords: string[]
}

export const STORAGE_KEY = 'sprout.v1'

const MODES = new Set<ExpandMode>(['suffix', 'prefix', 'both'])
const SORTS = new Set<SortKey>(['alpha', 'alpha-desc', 'shortest', 'longest', 'source'])

export function defaultState(): SproutState {
  return {
    version: 1,
    seed: '',
    marketplaceId: 'us',
    selectedMarketplaceIds: ['us'],
    mode: 'suffix',
    includeSpace: true,
    sort: 'alpha',
    run: null,
    runLock: null,
    history: [],
    savedKeywords: [],
    excludedWords: [],
    listingText: '',
    searchTermByteLimit: DEFAULT_SEARCH_TERM_BYTES,
    droppedSearchWords: [],
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
  const stored: SproutState = { ...state, history: [], savedKeywords: [] }
  await chrome.storage.local.set({ [STORAGE_KEY]: stored })
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
  const selectedMarketplaceIds = normalizeIds(value.selectedMarketplaceIds, marketplaceId)
  const byteLimit = typeof value.searchTermByteLimit === 'number' && Number.isFinite(value.searchTermByteLimit)
    ? Math.min(1000, Math.max(20, Math.round(value.searchTermByteLimit)))
    : DEFAULT_SEARCH_TERM_BYTES
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
    seed: typeof value.seed === 'string' ? sanitizeRestoredSeed(value.seed) : '',
    marketplaceId,
    selectedMarketplaceIds,
    mode,
    includeSpace: typeof value.includeSpace === 'boolean' ? value.includeSpace : true,
    sort,
    run,
    runLock,
    history: Array.isArray(value.history) ? value.history : [],
    savedKeywords: Array.isArray(value.savedKeywords) ? value.savedKeywords : [],
    excludedWords: Array.isArray(value.excludedWords) ? parseWordList(value.excludedWords.join('\n')) : [],
    listingText: typeof value.listingText === 'string' ? value.listingText : '',
    searchTermByteLimit: byteLimit,
    droppedSearchWords: Array.isArray(value.droppedSearchWords) ? parseWordList(value.droppedSearchWords.join('\n')) : [],
    writerId: typeof value.writerId === 'string' ? value.writerId : undefined,
  }
}

export function settingsFromState(state: SproutState): SproutSettings {
  return {
    seed: state.seed,
    marketplaceId: state.marketplaceId,
    selectedMarketplaceIds: state.selectedMarketplaceIds,
    mode: state.mode,
    includeSpace: state.includeSpace,
    sort: state.sort,
    excludedWords: state.excludedWords,
    listingText: state.listingText,
    searchTermByteLimit: state.searchTermByteLimit,
    droppedSearchWords: state.droppedSearchWords,
  }
}

export function normalizeSettings(raw: unknown, fallback?: SproutSettings): SproutSettings {
  const base = fallback ?? settingsFromState(defaultState())
  const value = raw && typeof raw === 'object' ? raw as Partial<SproutSettings> : {}
  const marketplaceId = typeof value.marketplaceId === 'string' ? getMarketplace(value.marketplaceId).id : base.marketplaceId
  return {
    seed: typeof value.seed === 'string' ? sanitizeRestoredSeed(value.seed) : base.seed,
    marketplaceId,
    selectedMarketplaceIds: normalizeIds(value.selectedMarketplaceIds, marketplaceId),
    mode: MODES.has(value.mode as ExpandMode) ? value.mode as ExpandMode : base.mode,
    includeSpace: typeof value.includeSpace === 'boolean' ? value.includeSpace : base.includeSpace,
    sort: SORTS.has(value.sort as SortKey) ? value.sort as SortKey : base.sort,
    excludedWords: Array.isArray(value.excludedWords) ? parseWordList(value.excludedWords.join('\n')) : base.excludedWords,
    listingText: typeof value.listingText === 'string' ? value.listingText : base.listingText,
    searchTermByteLimit: typeof value.searchTermByteLimit === 'number'
      ? Math.min(1000, Math.max(20, Math.round(value.searchTermByteLimit)))
      : base.searchTermByteLimit,
    droppedSearchWords: Array.isArray(value.droppedSearchWords) ? parseWordList(value.droppedSearchWords.join('\n')) : base.droppedSearchWords,
  }
}

export async function loadSettings(): Promise<SproutSettings> {
  if (!hasChromeStorage()) return settingsFromState(defaultState())
  const bag = await chrome.storage.local.get([STORAGE_KEY, SETTINGS_KEY])
  const fromRun = settingsFromState(normalizeState(bag[STORAGE_KEY]))
  if (bag[SETTINGS_KEY] == null) return fromRun
  return normalizeSettings(bag[SETTINGS_KEY], fromRun)
}

export async function saveSettings(partial: Partial<SproutSettings>): Promise<SproutSettings> {
  const next = normalizeSettings({ ...(await loadSettings()), ...partial })
  if (hasChromeStorage()) await chrome.storage.local.set({ [SETTINGS_KEY]: next })
  return next
}

export function watchSettings(onChange: (settings: SproutSettings) => void): () => void {
  if (!hasChromeStorage()) return () => {}
  const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, area) => {
    if (area !== 'local' || !changes[SETTINGS_KEY]) return
    onChange(normalizeSettings(changes[SETTINGS_KEY].newValue))
  }
  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}

function normalizeIds(value: unknown, fallback: string): string[] {
  const ids = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map((item) => getMarketplace(item).id)
    : []
  const unique = [...new Set(ids)]
  return unique.length > 0 ? unique : [fallback]
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
