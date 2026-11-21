import { useCallback, useEffect, useRef, useState } from 'react'
import { normalizeDepartment } from '../lib/departments'
import { LOCK_STALE_MS, MAX_SEED_LENGTH } from '../lib/limits'
import { deleteHistoryEntry, listHistory, listSaved, removeSaved, saveHistoryEntry, shouldRecordHistory, toggleSaved, LIBRARY_TICK } from '../lib/library'
import { getMarketplace } from '../lib/marketplaces'
import { expandSelectedMarketplaces, hasPro } from '../lib/pro'
import { cleanSeed, sanitizeRestoredSeed } from '../lib/queries'
import { createExpansionGate, publishStop, subscribeStop } from '../lib/run-control'
import { parseWordList } from '../lib/search-terms'
import { hasChromeStorage, defaultState, isContextInvalidated, loadSettings, loadState, migrateLegacySeed, normalizeState, REOPEN_PANEL_MESSAGE, saveSettings, saveState, watchSettings, watchState, type SproutSettings } from '../lib/storage'
import type { ExpandMode, RunSnapshot, SortKey, SproutState, Suggestion } from '../lib/types'

export function useResearch(options?: { pageSeed?: string; pageMarketplaceId?: string; pageDepartment?: string | null }) {
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
  const gateRef = useRef(createExpansionGate())
  const savedStopFor = useRef<number | null>(null)
  const keptTranslation = useRef('')
  const bestRun = useRef<RunSnapshot | null>(null)
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
      if (!lockFresh && options?.pageDepartment && next.departmentAlias === 'aps') {
        next = { ...next, departmentAlias: normalizeDepartment(options.pageDepartment) }
      }
      stateRef.current = next
      setState(next)
      readyRef.current = true
      setReady(true)
      if (pageSeed || options?.pageMarketplaceId || options?.pageDepartment) {
        void saveSettings({
          seed: next.seed,
          marketplaceId: next.marketplaceId,
          selectedMarketplaceIds: next.selectedMarketplaceIds,
          departmentAlias: next.departmentAlias,
        })
      }
    })()
    return () => {
      cancelled = true
      readyRef.current = false
      unwatchSettings()
      unwatchRun()
    }
  }, [options?.pageDepartment, options?.pageMarketplaceId, options?.pageSeed])

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

  const halt = useCallback((startedAt: number) => {
    const owned = gateRef.current.stop(startedAt)
    if (!owned) return
    const current = stateRef.current
    const visible = current.run?.startedAt === startedAt ? current.run : null
    const remembered = bestRun.current?.startedAt === startedAt ? bestRun.current : null
    const run = (remembered?.suggestions.length ?? 0) >= (visible?.suggestions.length ?? 0) ? remembered ?? visible : visible
    if (!run || run.status !== 'running') return
    const stoppedRun = {
      ...run,
      status: 'cancelled' as const,
      finishedAt: Date.now(),
      error: null,
      suggestions: run.suggestions,
      warnings: [
        `Stopped early at ${run.finishedQueries} of ${run.totalQueries} prefixes. Kept ${run.suggestions.length} suggestions.`,
      ],
    }
    persist({
      ...current,
      translatedSeed: current.useTranslatedSeed ? (current.translatedSeed || keptTranslation.current) : current.translatedSeed,
      runLock: null,
      run: stoppedRun,
    }, true)
    if (savedStopFor.current === startedAt) return
    savedStopFor.current = startedAt
    if (!hasPro('history')) return
    void saveHistoryEntry({ id: String(startedAt), savedAt: Date.now(), run: stoppedRun }).then((history) => {
      setState((existing) => {
        const next = { ...existing, history }
        stateRef.current = next
        return next
      })
    })
  }, [persist])

  useEffect(() => subscribeStop((startedAt) => halt(startedAt)), [halt])

  const start = useCallback(async (override?: { seed?: string; depth?: number }) => {
    const current = stateRef.current
    if (current.run?.status === 'running' && current.runLock?.ownerId === ownerId.current) return
    const depth = override?.depth ?? 0
    if (depth > 2) {
      setNotice('Expand this stops at depth 2 so one phrase cannot crawl forever.')
      return
    }
    const typed = cleanSeed(override?.seed ?? current.seed)
    const seed = !override?.seed && current.useTranslatedSeed && current.translatedSeed.trim()
      ? cleanSeed(current.translatedSeed)
      : typed
    if (!seed) return
    keptTranslation.current = current.useTranslatedSeed ? current.translatedSeed : ''
    const fresh = await loadState()
    if (
      fresh.runLock &&
      fresh.runLock.ownerId !== ownerId.current &&
      Date.now() - fresh.runLock.heartbeat < LOCK_STALE_MS
    ) {
      setNotice('Sprout is already expanding a keyword in another panel.')
      return
    }
    const begun = gateRef.current.begin()
    if (!begun.ok) return
    setNotice(null)
    setFilter('')
    const marketplaceIds = (current.selectedMarketplaceIds.length > 0 ? current.selectedMarketplaceIds : [current.marketplaceId])
      .map((id) => getMarketplace(id).id)
    const uniqueIds = [...new Set(marketplaceIds)]
    const marketplace = getMarketplace(uniqueIds[0] ?? current.marketplaceId)
    persist(
      {
        ...current,
        seed: override?.seed ? seed : current.seed,
        translatedSeed: current.useTranslatedSeed ? (current.translatedSeed || keptTranslation.current) : current.translatedSeed,
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
          alias: current.kdpMode ? (current.departmentAlias === 'digital-text' ? 'digital-text' : 'stripbooks') : current.departmentAlias,
          deep: current.deepExpand,
          depth,
          suggestions: [],
          totalQueries: 0,
          finishedQueries: 0,
          failedQueries: 0,
          endpointLabel: marketplace.completionHost,
          usedFallback: false,
          warnings: [],
          error: null,
          status: 'running',
          startedAt: begun.startedAt,
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
        alias: current.kdpMode ? (current.departmentAlias === 'digital-text' ? 'digital-text' : 'stripbooks') : current.departmentAlias,
        deep: current.deepExpand,
        depth,
        signal: begun.signal,
        onProgress: (run) => {
          const ownedId = gateRef.current.startedAt
          const stamped = ownedId ? { ...run, startedAt: ownedId } : run
          if (!gateRef.current.acceptProgress(stamped.status)) return
          const latest = stateRef.current
          if (
            latest.run?.startedAt === stamped.startedAt &&
            latest.run.suggestions.length > stamped.suggestions.length &&
            stamped.status === 'running'
          ) {
            return
          }
          if ((stamped.suggestions?.length ?? 0) >= (bestRun.current?.suggestions.length ?? 0) || bestRun.current?.startedAt !== stamped.startedAt) {
            bestRun.current = stamped
          }
          const settled = stamped.status !== 'running'
          const translatedSeed = latest.useTranslatedSeed ? (latest.translatedSeed || keptTranslation.current) : latest.translatedSeed
          persist(
            {
              ...latest,
              translatedSeed,
              run: stamped,
              runLock: settled ? null : { ownerId: ownerId.current, heartbeat: Date.now() },
            },
            settled || stamped.suggestions.length > (latest.run?.suggestions.length ?? 0),
          )
          if (settled && hasPro('history') && shouldRecordHistory(stamped.status) && savedStopFor.current !== stamped.startedAt) {
            void saveHistoryEntry({ id: String(stamped.startedAt), savedAt: Date.now(), run: stamped }).then((history) => {
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
      const latest = stateRef.current
      if (latest.runLock?.ownerId === ownerId.current) {
        persist({ ...latest, runLock: null }, true)
      }
    }
  }, [persist])

  const stop = useCallback(() => {
    const startedAt = stateRef.current.run?.startedAt
    if (!startedAt || stateRef.current.run?.status !== 'running') return
    void publishStop(startedAt)
    halt(startedAt)
  }, [halt])

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
    setDepartmentAlias: (departmentAlias: string) => applySettings({ departmentAlias, kdpMode: departmentAlias === 'stripbooks' || departmentAlias === 'digital-text' ? stateRef.current.kdpMode : false }),
    setDeepExpand: (deepExpand: boolean) => applySettings({ deepExpand }),
    setKdpMode: (kdpMode: boolean) => applySettings({
      kdpMode,
      departmentAlias: kdpMode
        ? (stateRef.current.departmentAlias === 'digital-text' ? 'digital-text' : 'stripbooks')
        : stateRef.current.departmentAlias,
    }),
    setSubtitleText: (subtitleText: string) => applySettings({ subtitleText }),
    setTranslatedSeed: (translatedSeed: string) => applySettings({ translatedSeed }),
    setUseTranslatedSeed: (useTranslatedSeed: boolean) => applySettings({ useTranslatedSeed }),
    setWordCountFilter: (wordCountFilter: SproutState['wordCountFilter']) => applySettings({ wordCountFilter }),
    setPositionFilter: (positionFilter: SproutState['positionFilter']) => applySettings({ positionFilter }),
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
