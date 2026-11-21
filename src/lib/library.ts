import { HISTORY_LIMIT } from './limits'
import { hasChromeStorage } from './storage'
import type { HistoryEntry, RunStatus, SavedKeyword } from './types'

export const LIBRARY_TICK = 'sprout.libraryTick'
const HISTORY_KEY = 'sprout.history'
const SAVED_KEY = 'sprout.saved'

const memory = {
  history: [] as HistoryEntry[],
  saved: [] as SavedKeyword[],
}

/**
 * History and stars live in chrome.storage so the popup, side panel, and the
 * on-page pill share them. IndexedDB in a content script would be the Amazon
 * page's database, not the extension's.
 */
export function shouldRecordHistory(status: RunStatus): boolean {
  return status === 'done' || status === 'error' || status === 'cancelled'
}

export function historyStatusLabel(status: RunStatus): string {
  if (status === 'error') return 'Failed'
  if (status === 'cancelled') return 'Stopped'
  return 'Saved'
}

export async function listHistory(): Promise<HistoryEntry[]> {
  const rows = await readList<HistoryEntry>(HISTORY_KEY, memory.history)
  return [...rows].sort(bySavedAt).slice(0, HISTORY_LIMIT)
}

export async function saveHistoryEntry(entry: HistoryEntry): Promise<HistoryEntry[]> {
  const next = [entry, ...(await listHistory()).filter((item) => item.id !== entry.id)].slice(0, HISTORY_LIMIT)
  memory.history = next
  await writeList(HISTORY_KEY, next)
  return next
}

export async function deleteHistoryEntry(id: string): Promise<HistoryEntry[]> {
  const next = (await listHistory()).filter((item) => item.id !== id)
  memory.history = next
  await writeList(HISTORY_KEY, next)
  return next
}

export async function listSaved(): Promise<SavedKeyword[]> {
  const rows = await readList<SavedKeyword>(SAVED_KEY, memory.saved)
  return [...rows].sort(bySavedAt)
}

export async function toggleSaved(entry: SavedKeyword): Promise<SavedKeyword[]> {
  const current = await listSaved()
  const next = current.some((item) => item.id === entry.id)
    ? current.filter((item) => item.id !== entry.id)
    : [entry, ...current]
  memory.saved = next
  await writeList(SAVED_KEY, next)
  return next
}

export async function removeSaved(id: string): Promise<SavedKeyword[]> {
  const next = (await listSaved()).filter((item) => item.id !== id)
  memory.saved = next
  await writeList(SAVED_KEY, next)
  return next
}

async function readList<T>(key: string, fallback: T[]): Promise<T[]> {
  if (!hasChromeStorage()) return [...fallback]
  const bag = await chrome.storage.local.get(key)
  return Array.isArray(bag[key]) ? bag[key] as T[] : [...fallback]
}

async function writeList(key: string, value: unknown[]): Promise<void> {
  if (!hasChromeStorage()) return
  await chrome.storage.local.set({ [key]: value, [LIBRARY_TICK]: Date.now() })
}

function bySavedAt(a: { savedAt: number }, b: { savedAt: number }): number {
  return b.savedAt - a.savedAt
}
