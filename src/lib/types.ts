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
}

export interface RunSnapshot {
  seed: string
  marketplaceId: string
  mode: ExpandMode
  includeSpace: boolean
  suggestions: Suggestion[]
  totalQueries: number
  finishedQueries: number
  failedQueries: number
  endpointLabel: string
  usedFallback: boolean
  warnings: string[]
  error: string | null
  status: RunStatus
  startedAt: number
  finishedAt: number | null
  recentLabel: string
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
  mode: ExpandMode
  includeSpace: boolean
  sort: SortKey
  run: RunSnapshot | null
  runLock: RunLock | null
  history: HistoryEntry[]
  writerId?: string
}
