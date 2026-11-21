export type ExpandMode = 'suffix' | 'prefix' | 'both'

export type SortKey = 'alpha' | 'alpha-desc' | 'shortest' | 'longest' | 'source'

export type RunStatus = 'running' | 'done' | 'error' | 'cancelled'

export interface SuggestionSource {
  label: string
  exportLabel: string
  index: number
}

export interface Suggestion {
  key: string
  value: string
  sources: SuggestionSource[]
  /** Marketplace ids that returned this phrase. Older saved runs may omit it. */
  marketplaces?: string[]
}

export interface RunSnapshot {
  seed: string
  marketplaceId: string
  mode: ExpandMode
  includeSpace: boolean
  alias?: string
  deep?: boolean
  depth?: number
  suggestions: Suggestion[]
  totalQueries: number
  finishedQueries: number
  failedQueries: number
  /** Prefix strings that did not return a usable response. */
  failedPrefixes?: string[]
  endpointLabel: string
  usedFallback: boolean
  warnings: string[]
  error: string | null
  status: RunStatus
  startedAt: number
  finishedAt: number | null
  recentLabel: string
  /** Every marketplace included in this run. Falls back to marketplaceId. */
  marketplaceIds?: string[]
}

export interface SavedKeyword {
  id: string
  value: string
  marketplaceIds: string[]
  seed: string
  savedAt: number
}

export interface HistoryEntry {
  id: string
  savedAt: number
  run: RunSnapshot
}

export interface RunLock {
  ownerId: string
  heartbeat: number
}

export interface SproutState {
  version: 1
  seed: string
  marketplaceId: string
  /** Marketplaces included the next time Expand is pressed. */
  selectedMarketplaceIds: string[]
  mode: ExpandMode
  includeSpace: boolean
  sort: SortKey
  run: RunSnapshot | null
  runLock: RunLock | null
  /** Kept in memory. Full runs live in IndexedDB, not in this blob. */
  history: HistoryEntry[]
  savedKeywords: SavedKeyword[]
  excludedWords: string[]
  listingText: string
  searchTermByteLimit: number
  droppedSearchWords: string[]
  departmentAlias: string
  deepExpand: boolean
  kdpMode: boolean
  subtitleText: string
  translatedSeed: string
  useTranslatedSeed: boolean
  wordCountFilter: 'any' | '1' | '2' | '3+'
  positionFilter: 'any' | 'before' | 'after' | 'between' | 'other'
  writerId?: string
}
