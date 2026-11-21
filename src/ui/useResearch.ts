import { useCallback, useEffect, useRef, useState } from 'react'
import { expandSeed } from '../lib/expand'
import { LOCK_STALE_MS, MAX_SEED_LENGTH } from '../lib/limits'
import { getMarketplace } from '../lib/marketplaces'
import { appendHistory } from '../lib/pro'
import { cleanSeed } from '../lib/queries'
import { defaultState, loadState, normalizeState, saveState, watchState } from '../lib/storage'
import type { ExpandMode, SortKey, SproutState } from '../lib/types'

export function useResearch(options?: { pageSeed?: string; pageMarketplaceId?: string }) {
  const ownerId = useRef(crypto.randomUUID())
  const [state, setState] = useState<SproutState>(defaultState)
  const [ready, setReady] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [filter, setFilter] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const stateRef = useRef(state)
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
        } catch {
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

  useEffect(() => {
    let cancelled = false
    let unwatch = () => {}
    void (async () => {
      const stored = normalizeState(await loadState())
      if (cancelled) return
      let next = stored
      const lockFresh = stored.runLock != null && Date.now() - stored.runLock.heartbeat < LOCK_STALE_MS
      if (!lockFresh) {
        if (options?.pageMarketplaceId) next = { ...next, marketplaceId: getMarketplace(options.pageMarketplaceId).id }
        if (options?.pageSeed) next = { ...next, seed: cleanSeed(options.pageSeed) }
      }
      stateRef.current = next
      setState(next)
      setReady(true)
      if (next.seed !== stored.seed || next.marketplaceId !== stored.marketplaceId) {
        persist(next, true)
      }
      unwatch = watchState((incoming) => {
        if (cancelled || incoming.writerId === ownerId.current) return
        stateRef.current = incoming
        setState(incoming)
      })
    })()
    return () => {
      cancelled = true
      unwatch()
    }
  }, [options?.pageMarketplaceId, options?.pageSeed, persist])

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
    const marketplace = getMarketplace(current.marketplaceId)
    persist(
      {
        ...current,
        seed,
        runLock: { ownerId: ownerId.current, heartbeat: Date.now() },
        run: {
          seed,
          marketplaceId: marketplace.id,
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
      await expandSeed({
        seed,
        marketplace,
        mode: current.mode,
        includeSpace: current.includeSpace,
        signal: controller.signal,
        onProgress: (run) => {
          const latest = stateRef.current
          const history = run.status === 'done'
            ? appendHistory(latest.history, { id: String(run.startedAt), savedAt: Date.now(), run })
            : latest.history
          const settled = run.status !== 'running'
          persist(
            {
              ...latest,
              history,
              run,
              runLock: settled ? null : { ownerId: ownerId.current, heartbeat: Date.now() },
            },
            settled,
          )
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
    runningHere,
    lockedByOther,
    patch,
    start,
    stop,
    setSeed: (seed: string) => patch({ seed: seed.slice(0, MAX_SEED_LENGTH) }),
    setMarketplaceId: (marketplaceId: string) => patch({ marketplaceId: getMarketplace(marketplaceId).id }),
    setMode: (mode: ExpandMode) => patch({ mode }),
    setIncludeSpace: (includeSpace: boolean) => patch({ includeSpace }),
    setSort: (sort: SortKey) => patch({ sort }),
  }
}
