import { useCallback, useEffect, useRef, useState } from 'react'
import { LOCK_STALE_MS, MAX_SEED_LENGTH } from '../lib/limits'
import { deleteHistoryEntry, listHistory, listSaved, removeSaved, saveHistoryEntry, shouldRecordHistory, toggleSaved, LIBRARY_TICK } from '../lib/library'
import { getMarketplace } from '../lib/marketplaces'
import { expandSelectedMarketplaces, hasPro } from '../lib/pro'
import { cleanSeed, sanitizeRestoredSeed } from '../lib/queries'
import { parseWordList } from '../lib/search-terms'
import { hasChromeStorage, defaultState, isContextInvalidated, loadSettings, loadState, migrateLegacySeed, normalizeState, REOPEN_PANEL_MESSAGE, saveSettings, saveState, watchSettings, watchState, type SproutSettings } from '../lib/storage'
import type { ExpandMode, SortKey, SproutState, Suggestion } from '../lib/types'

export function useResearch(options?: { pageSeed?: string; pageMarketplaceId?: string }) {
  const ownerId = useRef(crypto.randomUUID())
  const [state, setState] = useState<SproutState>(defaultState)
  const [ready, setReady] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [filter, setFilter] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [contextLost, setContextLost] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const stateRef = useRef(state)
  const readyRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const saveTimer = useRef<number | null>(null)
  const rev = useRef(0)
  const savedRev = useRef(0)
  const saving = useRef(false)
  stateRef.current = state

  const flush = useCallback(() => {
    if (saving.current) return
    saving.current = true
    const write = async () => {
      while (savedRev.current !== rev.current) {
        const target = rev.current
        try {
          await saveState(stateRef.current)
        } catch (error) {
          if (isContextInvalidated(error)) {
            setContextLost(true)
            setNotice(REOPEN_PANEL_MESSAGE)
            break
          }
          setNotice('Couldn’t save this run on this device. The list is still here until you close the panel.')
        }
        savedRev.current = target
      }
      saving.current = false
    }
    void write()
  }, [])

  const persist = useCallback((next: SproutState, immediate = false) => {
    const stamped = { ...next, writerId: ownerId.current }
    stateRef.current = stamped
    setState(stamped)
    const commit = () => {
      rev.current += 1
      flush()
    }
    if (immediate) {
      if (saveTimer.current != null) {
        window.clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
      commit()
      return
    }
    if (saveTimer.current != null) return
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null
      commit()
    }, 400)
  }, [flush])

  const applySettings = useCallback((partial: Partial<SproutSettings>) => {
    const next = { ...stateRef.current, ...partial }
    stateRef.current = next
    setState(next)
    void saveSettings(partial).catch((error: unknown) => {
      if (isContextInvalidated(error)) {
        setContextLost(true)
        setNotice(REOPEN_PANEL_MESSAGE)
      }
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    let pendingSettings: SproutSettings | null = null
    const unwatchSettings = watchSettings((settings) => {
      if (cancelled) return
      if (!readyRef.current) {
        pendingSettings = settings
        return
      }
      setState((current) => {
        const next = { ...current, ...settings }
        stateRef.current = next
        return next
      })
    })
    const unwatchRun = watchState((incoming) => {
      if (cancelled || incoming.writerId === ownerId.current) return
      setState((current) => {
        const next = { ...current, run: incoming.run, runLock: incoming.runLock }
        stateRef.current = next
        return next
      })
    })
    void (async () => {
      try {
        await migrateLegacySeed()
      } catch (error) {
        if (isContextInvalidated(error)) {
          setContextLost(true)
          setNotice(REOPEN_PANEL_MESSAGE)
          return
        }
      }
      const stored = normalizeState(await loadState())
      const settings = pendingSettings ?? await loadSettings()
      let history = stored.history
      let saved = stored.savedKeywords
      try {
        const [storedHistory, storedSaved] = await Promise.all([listHistory(), listSaved()])
        if (storedHistory.length > 0) history = storedHistory
        if (storedSaved.length > 0) saved = storedSaved
      } catch {
        // Library storage is best-effort. The current run still works.
      }
      if (cancelled) return
      let next = { ...stored, ...settings, history, savedKeywords: saved }
      const lockFresh = stored.runLock != null && Date.now() - stored.runLock.heartbeat < LOCK_STALE_MS
      const pageSeed = options?.pageSeed ? sanitizeRestoredSeed(options.pageSeed) : ''
      if (!lockFresh && pageSeed) next = { ...next, seed: pageSeed }
      if (!lockFresh && options?.pageMarketplaceId) {
        const marketplaceId = getMarketplace(options.pageMarketplaceId).id
        next = { ...next, marketplaceId, selectedMarketplaceIds: [marketplaceId] }
      }
      stateRef.current = next
      setState(next)
      readyRef.current = true
      setReady(true)
      if (pageSeed || options?.pageMarketplaceId) {
        void saveSettings({
          seed: next.seed,
          marketplaceId: next.marketplaceId,
          selectedMarketplaceIds: next.selectedMarketplaceIds,
        })
      }
    })()
    return () => {
      cancelled = true
      readyRef.current = false
      unwatchSettings()
      unwatchRun()
    }
  }, [options?.pageMarketplaceId, options?.pageSeed])

  const runningHere = state.run?.status === 'running' && state.runLock?.ownerId === ownerId.current
  const lockedByOther = Boolean(
    state.runLock &&
      state.runLock.ownerId !== ownerId.current &&
      now - state.runLock.heartbeat < LOCK_STALE_MS,
  )

  useEffect(() => {
    if (!state.runLock && state.run?.status !== 'running') return
    const id = window.setInterval(() => setNow(Date.now()), 2000)
    return () => window.clearInterval(id)
  }, [state.run?.status, state.runLock])

  useEffect(() => {
    if (!runningHere) return
    const id = window.setInterval(() => {
      const current = stateRef.current
      if (current.run?.status !== 'running' || current.runLock?.ownerId !== ownerId.current) return
      persist({ ...current, runLock: { ownerId: ownerId.current, heartbeat: Date.now() } })
    }, 2000)
    return () => window.clearInterval(id)
  }, [persist, runningHere])

  useEffect(() => {
    setSelected([])
  }, [state.run?.startedAt])

  useEffect(() => {
    if (!hasChromeStorage()) return
    const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, area) => {
      if (area !== 'local' || !changes[LIBRARY_TICK]) return
      void Promise.all([listHistory(), listSaved()]).then(([history, savedKeywords]) => {
        setState((current) => {
          const next = { ...current, history, savedKeywords }
          stateRef.current = next
          return next
        })
      })
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  const patch = useCallback((partial: Partial<SproutState>) => {
    persist({ ...stateRef.current, ...partial }, true)
  }, [persist])

  const start = useCallback(async () => {
    const current = stateRef.current
    if (current.run?.status === 'running' && current.runLock?.ownerId === ownerId.current) return
    const seed = cleanSeed(current.seed)
    if (!seed) return
    const fresh = await loadState()
    if (
      fresh.runLock &&
      fresh.runLock.ownerId !== ownerId.current &&
      Date.now() - fresh.runLock.heartbeat < LOCK_STALE_MS
    ) {
      setNotice('Sprout is already expanding a keyword in another panel.')
      return
    }
    const controller = new AbortController()
    abortRef.current = controller
    setNotice(null)
    setFilter('')
    const marketplaceIds = (current.selectedMarketplaceIds.length > 0 ? current.selectedMarketplaceIds : [current.marketplaceId])
      .map((id) => getMarketplace(id).id)
    const uniqueIds = [...new Set(marketplaceIds)]
    const marketplace = getMarketplace(uniqueIds[0] ?? current.marketplaceId)
    persist(
      {
        ...current,
        seed,
        marketplaceId: marketplace.id,
        selectedMarketplaceIds: uniqueIds,
        droppedSearchWords: [],
        runLock: { ownerId: ownerId.current, heartbeat: Date.now() },
        run: {
          seed,
          marketplaceId: marketplace.id,
          marketplaceIds: uniqueIds,
          mode: current.mode,
          includeSpace: current.includeSpace,
          suggestions: [],
          totalQueries: 0,
          finishedQueries: 0,
          failedQueries: 0,
          endpointLabel: marketplace.completionHost,
          usedFallback: false,
          warnings: [],
          error: null,
          status: 'running',
          startedAt: Date.now(),
          finishedAt: null,
          recentLabel: 'seed',
        },
      },
      true,
    )

    try {
      await expandSelectedMarketplaces({
        seed,
        marketplaceIds: uniqueIds,
        mode: current.mode,
        includeSpace: current.includeSpace,
        signal: controller.signal,
        onProgress: (run) => {
          const latest = stateRef.current
          const settled = run.status !== 'running'
          persist(
            {
              ...latest,
              run,
              runLock: settled ? null : { ownerId: ownerId.current, heartbeat: Date.now() },
            },
            settled,
          )
          if (settled && hasPro('history') && shouldRecordHistory(run.status)) {
            void saveHistoryEntry({ id: String(run.startedAt), savedAt: Date.now(), run }).then((history) => {
              setState((current) => {
                const next = { ...current, history }
                stateRef.current = next
                return next
              })
            })
          }
        },
      })
    } finally {
      abortRef.current = null
      const latest = stateRef.current
      if (latest.runLock?.ownerId === ownerId.current) {
        persist({ ...latest, runLock: null }, true)
      }
    }
  }, [persist])

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return {
    state,
    ready,
    selected,
    setSelected,
    filter,
    setFilter,
    notice,
    setNotice,
    contextLost,
    runningHere,
    lockedByOther,
    patch,
    start,
    stop,
    setSeed: (seed: string) => applySettings({ seed: sanitizeRestoredSeed(seed.slice(0, MAX_SEED_LENGTH)) }),
    setSelectedMarketplaceIds: (ids: string[]) => {
      const unique = [...new Set(ids.map((id) => getMarketplace(id).id))]
      const selected = unique.length > 0 ? unique : [stateRef.current.marketplaceId]
      applySettings({ selectedMarketplaceIds: selected, marketplaceId: selected[0] })
    },
    setMode: (mode: ExpandMode) => applySettings({ mode }),
    setIncludeSpace: (includeSpace: boolean) => applySettings({ includeSpace }),
    setSort: (sort: SortKey) => applySettings({ sort }),
    setExcludedWords: (words: string[]) => applySettings({ excludedWords: parseWordList(words.join('\n')) }),
    setListingText: (listingText: string) => applySettings({ listingText }),
    setSearchTermByteLimit: (searchTermByteLimit: number) => applySettings({ searchTermByteLimit }),
    dropSearchWord: (word: string) => {
      const dropped = parseWordList([...stateRef.current.droppedSearchWords, word].join('\n'))
      applySettings({ droppedSearchWords: dropped })
    },
    clearDroppedSearchWords: () => applySettings({ droppedSearchWords: [] }),
    toggleStar: async (item: Suggestion) => {
      if (!hasPro('savedKeywords')) return
      const saved = await toggleSaved({
        id: item.key,
        value: item.value,
        marketplaceIds: item.marketplaces && item.marketplaces.length > 0 ? item.marketplaces : [stateRef.current.marketplaceId],
        seed: stateRef.current.run?.seed || stateRef.current.seed,
        savedAt: Date.now(),
      })
      setState((current) => {
        const next = { ...current, savedKeywords: saved }
        stateRef.current = next
        return next
      })
    },
    removeSaved: async (id: string) => {
      const saved = await removeSaved(id)
      setState((current) => {
        const next = { ...current, savedKeywords: saved }
        stateRef.current = next
        return next
      })
    },
    openHistory: (id: string) => {
      const entry = stateRef.current.history.find((item) => item.id === id)
      if (!entry) return
      const selectedMarketplaceIds = entry.run.marketplaceIds?.length ? entry.run.marketplaceIds : [entry.run.marketplaceId]
      applySettings({
        seed: entry.run.seed,
        marketplaceId: entry.run.marketplaceId,
        selectedMarketplaceIds,
        mode: entry.run.mode,
        includeSpace: entry.run.includeSpace,
      })
      persist({ ...stateRef.current, run: entry.run }, true)
    },
    deleteHistory: async (id: string) => {
      const history = await deleteHistoryEntry(id)
      setState((current) => {
        const next = { ...current, history }
        stateRef.current = next
        return next
      })
    },
  }
}

export type Research = ReturnType<typeof useResearch>
