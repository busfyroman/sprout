import { HISTORY_LIMIT } from './limits'
import { hasChromeStorage } from './storage'
import type { HistoryEntry, SavedKeyword } from './types'

export const LIBRARY_TICK = 'sprout.libraryTick'

const memory = {
  history: [] as HistoryEntry[],
  saved: [] as SavedKeyword[],
}

function databaseAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('sprout', 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('history')) db.createObjectStore('history', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('saved')) db.createObjectStore('saved', { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore<T>(
  name: 'history' | 'saved',
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(name, mode)
      const request = run(tx.objectStore(name))
      let result: T
      request.onsuccess = () => {
        result = request.result
      }
      tx.oncomplete = () => resolve(result)
      tx.onerror = () => reject(tx.error ?? request.error)
      tx.onabort = () => reject(tx.error ?? request.error)
    })
  } finally {
    db.close()
  }
}

export async function listHistory(): Promise<HistoryEntry[]> {
  if (!databaseAvailable()) return [...memory.history].sort(bySavedAt)
  try {
    const rows = await withStore<HistoryEntry[]>('history', 'readonly', (store) => store.getAll())
    return [...rows].sort(bySavedAt).slice(0, HISTORY_LIMIT)
  } catch {
    return [...memory.history].sort(bySavedAt)
  }
}

export async function saveHistoryEntry(entry: HistoryEntry): Promise<HistoryEntry[]> {
  const current = await listHistory()
  const next = [entry, ...current.filter((item) => item.id !== entry.id)].slice(0, HISTORY_LIMIT)
  if (!databaseAvailable()) {
    memory.history = next
    await touchLibrary()
    return next
  }
  try {
    const db = await openDatabase()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('history', 'readwrite')
      const store = tx.objectStore('history')
      store.clear()
      for (const item of next) store.put(item)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    memory.history = next
  }
  await touchLibrary()
  return next
}

export async function deleteHistoryEntry(id: string): Promise<HistoryEntry[]> {
  const next = (await listHistory()).filter((item) => item.id !== id)
  if (!databaseAvailable()) {
    memory.history = next
    await touchLibrary()
    return next
  }
  try {
    await withStore('history', 'readwrite', (store) => store.delete(id))
  } catch {
    memory.history = next
  }
  await touchLibrary()
  return next
}

export async function listSaved(): Promise<SavedKeyword[]> {
  if (!databaseAvailable()) return [...memory.saved].sort(bySavedAt)
  try {
    const rows = await withStore<SavedKeyword[]>('saved', 'readonly', (store) => store.getAll())
    return [...rows].sort(bySavedAt)
  } catch {
    return [...memory.saved].sort(bySavedAt)
  }
}

export async function toggleSaved(entry: SavedKeyword): Promise<SavedKeyword[]> {
  const current = await listSaved()
  const exists = current.some((item) => item.id === entry.id)
  if (!databaseAvailable()) {
    memory.saved = exists ? current.filter((item) => item.id !== entry.id) : [entry, ...current]
    await touchLibrary()
    return memory.saved
  }
  try {
    if (exists) await withStore('saved', 'readwrite', (store) => store.delete(entry.id))
    else await withStore('saved', 'readwrite', (store) => store.put(entry))
  } catch {
    memory.saved = exists ? current.filter((item) => item.id !== entry.id) : [entry, ...current]
    await touchLibrary()
    return memory.saved
  }
  await touchLibrary()
  return listSaved()
}

export async function removeSaved(id: string): Promise<SavedKeyword[]> {
  const current = await listSaved()
  const next = current.filter((item) => item.id !== id)
  if (!databaseAvailable()) {
    memory.saved = next
    await touchLibrary()
    return next
  }
  try {
    await withStore('saved', 'readwrite', (store) => store.delete(id))
  } catch {
    memory.saved = next
    await touchLibrary()
    return next
  }
  await touchLibrary()
  return listSaved()
}

async function touchLibrary(): Promise<void> {
  if (!hasChromeStorage()) return
  await chrome.storage.local.set({ [LIBRARY_TICK]: Date.now() })
}

function bySavedAt(a: { savedAt: number }, b: { savedAt: number }): number {
  return b.savedAt - a.savedAt
}
