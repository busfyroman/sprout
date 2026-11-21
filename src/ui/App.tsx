import { Copy, PanelRight, Sprout, Table2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { adsCsv, classifyPosition, connectorWords, matchesWordCount, nearDuplicateKeys } from '../lib/analysis'
import { DEPARTMENTS } from '../lib/departments'
import { buildCsv, buildWorkbook, copyText, downloadBytes, downloadText, exportBasename, keywordsToCopy } from '../lib/export'
import { getMarketplace, MARKETPLACES } from '../lib/marketplaces'
import { readPageIntel, type PageIntel } from '../lib/page-intel'
import { fetchResultCount, formatResultCount, type ResultCount } from '../lib/result-count'
import { languageFromLocale, translateOnDevice } from '../lib/translate'
import { hasPro } from '../lib/pro'
import { openExternal, PROJECT, storeReviewUrl } from '../project'
import { shouldShowRatePrompt } from '../lib/rate'
import { dismissRatePrompt, loadRateDismissed, RATE_DISMISSED_KEY } from '../lib/storage'
import { cleanSeed, describePlan } from '../lib/queries'
import { applyExclusions, filterSuggestions, sortSuggestions } from '../lib/results'
import { parseWordList } from '../lib/search-terms'
import type { ExpandMode } from '../lib/types'
import { HistoryPanel, SavedPanel } from './LibraryPanels'
import { KdpPanel, WordsPanel } from './ResearchPanels'
import { KeywordTable } from './KeywordTable'
import { ResultsList } from './ResultsList'
import { SearchTermsPanel } from './SearchTermsPanel'
import { Button } from './components/button'
import { Input } from './components/input'
import { Switch } from './components/switch'
import { formatWhen } from './format'
import { departmentName, t } from './i18n'
import { useResearch } from './useResearch'

export type Surface = 'popup' | 'sidepanel' | 'overlay' | 'page'
type PanelTab = 'results' | 'terms' | 'words' | 'kdp' | 'saved' | 'history'

const MODES: Array<{ id: ExpandMode; label: string }> = [
  { id: 'suffix', label: 'Suffix' },
  { id: 'prefix', label: 'Prefix' },
  { id: 'both', label: 'Both' },
]

export function App({
  surface,
  pageSeed,
  pageMarketplaceId,
  pageIntel,
  onCollapse,
}: {
  surface: Surface
  pageSeed?: string
  pageMarketplaceId?: string
  pageIntel?: PageIntel
  onCollapse?: () => void
}) {
  const research = useResearch({ pageSeed, pageMarketplaceId, pageDepartment: pageIntel?.departmentAlias })
  useEffect(() => {
    let gone = false
    void loadRateDismissed().then((dismissed) => {
      if (!gone) setRateDismissed(dismissed)
    })
    if (!chrome.storage?.onChanged) return () => { gone = true }
    const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, area) => {
      if (area !== 'local' || !changes[RATE_DISMISSED_KEY]) return
      setRateDismissed(changes[RATE_DISMISSED_KEY].newValue === true)
    }
    chrome.storage.onChanged.addListener(listener)
    return () => {
      gone = true
      chrome.storage.onChanged.removeListener(listener)
    }
  }, [])
  const [tab, setTab] = useState<PanelTab>('results')
  const [marketsOpen, setMarketsOpen] = useState(false)
  const [excludeDraft, setExcludeDraft] = useState('')
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'error'>('idle')
  const [counts, setCounts] = useState<Record<string, ResultCount>>({})
  const [counting, setCounting] = useState(false)
  const [exactCount, setExactCount] = useState(false)
  const [extraRelated, setExtraRelated] = useState<string[]>([])
  const [rateDismissed, setRateDismissed] = useState(true)
  const countRun = useRef(0)
  const { state, ready } = research
  const plan = describePlan(
    state.seed,
    state.mode,
    state.includeSpace,
    state.deepExpand,
    connectorWords(getMarketplace(state.selectedMarketplaceIds[0] ?? state.marketplaceId).locale).length,
  )
  const run = state.run
  const suggestions = useMemo(
    () => applyExclusions(
      (run?.suggestions ?? []).filter((item) => item && typeof item.value === 'string'),
      hasPro('exclusions') ? state.excludedWords : [],
    ),
    [run, state.excludedWords],
  )
  const hiddenCount = (run?.suggestions.length ?? 0) - suggestions.length
  const positionSeed = run?.seed || state.seed
  const filtered = useMemo(
    () => sortSuggestions(filterSuggestions(suggestions.filter((item) => (
      matchesWordCount(item.value, state.wordCountFilter)
      && (state.positionFilter === 'any' || classifyPosition(item.value, positionSeed) === state.positionFilter)
    )), research.filter), state.sort),
    [suggestions, research.filter, state.sort, state.wordCountFilter, state.positionFilter, positionSeed],
  )
  const similarKeys = useMemo(() => nearDuplicateKeys(filtered.map((item) => item.value)), [filtered])
  const selectedItems = sortSuggestions(
    suggestions.filter((item) => research.selected.includes(item.key)),
    state.sort,
  )
  const exportItems = selectedItems.length > 0 ? selectedItems : filtered
  const exportCount = exportItems.length
  const running = research.runningHere || research.lockedByOther
  const selectedMarkets = state.selectedMarketplaceIds.length > 0 ? state.selectedMarketplaceIds : [state.marketplaceId]
  const marketLabel = selectedMarkets.length === 1
    ? `${getMarketplace(selectedMarkets[0]).code} · ${getMarketplace(selectedMarkets[0]).domain}`
    : `${getMarketplace(selectedMarkets[0]).code} + ${selectedMarkets.length - 1}`
  const starred = state.savedKeywords.map((item) => item.id)
  const frame = surface === 'overlay'
      ? 'flex h-full max-h-full min-h-0 w-[min(400px,calc(100vw-28px))] flex-col overflow-hidden rounded-2xl border border-line shadow-[0_22px_60px_rgba(28,25,21,0.28)]'
    : surface === 'page'
      ? 'mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col'
      : surface === 'sidepanel'
        ? 'mx-auto flex h-full min-h-0 w-full max-w-[560px] flex-col'
        : 'flex h-full min-h-0 w-full flex-col'

  if (!ready) {
    return (
      <div className={`sprout-app ${frame}`}>
        <header className="px-4 pt-4">
          <div className="wordmark text-[22px] leading-none">Sprout</div>
          <p className="mt-3 text-sm text-muted">Loading saved research…</p>
        </header>
      </div>
    )
  }

  const progress = run && run.totalQueries > 0 ? Math.min(100, Math.round((run.finishedQueries / run.totalQueries) * 100)) : 0
  const copyLabel = copyState === 'done'
    ? t('uiCopied', 'Copied')
    : (selectedItems.length > 0 || exportCount > 0)
      ? t('uiCopyCount', 'Copy $1', String(selectedItems.length > 0 ? selectedItems.length : exportCount))
      : t('uiCopy', 'Copy')

  async function onCopy() {
    if (exportItems.length === 0) return
    try {
      await copyText(keywordsToCopy(exportItems))
      setCopyState('done')
      window.setTimeout(() => setCopyState('idle'), 1600)
    } catch (error) {
      setCopyState('error')
      research.setNotice(error instanceof Error ? error.message : 'Couldn’t copy those keywords.')
    }
  }

  function download(kind: 'csv' | 'xlsx') {
    if (exportItems.length === 0 || !run) return
    const ids = run.marketplaceIds?.length ? run.marketplaceIds : [run.marketplaceId]
    const meta = {
      seed: run.seed,
      marketplace: ids.map((id) => getMarketplace(id).label).join('; '),
      domain: ids.map((id) => getMarketplace(id).domain).join('; '),
    }
    const base = exportBasename(run.seed, getMarketplace(ids[0]).domain)
    if (kind === 'csv') {
      downloadText(`${base}.csv`, buildCsv(exportItems, meta), 'text/csv;charset=utf-8')
      return
    }
    downloadBytes(`${base}.xlsx`, buildWorkbook(exportItems, meta), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  }

  async function openSidePanel() {
    try {
      if (surface === 'popup') {
        const current = await chrome.windows.getCurrent()
        if (current.id == null) throw new Error('No browser window')
        await chrome.sidePanel.open({ windowId: current.id })
        window.close()
        return
      }
      const response = await chrome.runtime.sendMessage({ type: 'sprout:open-side-panel' }) as { ok?: boolean } | undefined
      if (!response?.ok) throw new Error('Side panel did not open')
    } catch {
      research.setNotice('Couldn’t open the side panel. In Brave, open the side panel menu and choose Sprout.')
    }
  }

  function openTable() {
    if (research.contextLost) return
    try {
      chrome.runtime.sendMessage({ type: 'sprout:open-table' }, () => {
        void chrome.runtime.lastError
      })
      if (surface === 'popup') window.close()
    } catch {
      research.setNotice('This panel is still open from before Sprout reloaded. Close it and open Sprout again.')
    }
  }

  function addExclusion() {
    const words = parseWordList(excludeDraft)
    if (words.length === 0) return
    research.setExcludedWords([...state.excludedWords, ...words])
    setExcludeDraft('')
  }

  function toggleMarket(id: string) {
    const has = selectedMarkets.includes(id)
    const next = has ? selectedMarkets.filter((item) => item !== id) : [...selectedMarkets, id]
    if (next.length === 0) return
    research.setSelectedMarketplaceIds(next)
  }

  const tabs: Array<{ id: PanelTab; label: string; show: boolean }> = [
    { id: 'results', label: t('uiTabResults', 'Results'), show: true },
    { id: 'terms', label: t('uiTabTerms', 'Terms'), show: hasPro('searchTerms') },
    { id: 'words', label: t('uiTabWords', 'Words'), show: true },
    { id: 'kdp', label: t('uiTabKdp', 'KDP'), show: true },
    { id: 'saved', label: t('uiTabSaved', 'Saved'), show: hasPro('savedKeywords') },
    { id: 'history', label: t('uiTabHistory', 'History'), show: hasPro('history') },
  ]

  function rowPosition(item: { value: string }): string {
    return classifyPosition(item.value, positionSeed)
  }

  function rowCount(item: { key: string }): string {
    const hit = counts[item.key]
    if (!hit) return ''
    if (hit.blocked) return 'check'
    if (hit.count == null) return '—'
    return formatResultCount(hit.count, hit.capped)
  }

  function rowCountTitle(item: { key: string }): string {
    return counts[item.key]?.message || 'Amazon result count, not search volume.'
  }

  function isSimilar(item: { value: string }): boolean {
    return similarKeys.has(item.value.trim().replace(/\s+/g, ' ').toLowerCase())
  }

  async function countSelected() {
    if (counting) {
      countRun.current += 1
      setCounting(false)
      return
    }
    const starredRows = filtered.filter((item) => starred.includes(item.key))
    const pool = (selectedItems.length > 0 ? selectedItems : starredRows).slice(0, 20)
    if (pool.length === 0) {
      research.setNotice('Select rows, or star some, then count Amazon results. The whole list stays uncounted on purpose.')
      return
    }
    const token = countRun.current
    const market = getMarketplace(run?.marketplaceIds?.[0] ?? state.marketplaceId)
    setCounting(true)
    let blocked = false
    for (const item of pool) {
      if (countRun.current !== token) break
      const result = await fetchResultCount(market, item.value, exactCount, AbortSignal.timeout(12000))
      if (countRun.current !== token) break
      setCounts((current) => ({ ...current, [item.key]: result }))
      if (result.blocked) {
        research.setNotice(result.message)
        blocked = true
        break
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1100))
    }
    if (countRun.current === token) {
      setCounting(false)
      if (!blocked) research.setNotice('Finished reading Amazon result counts. This is a result count, not search volume.')
    }
  }

  async function deepenRelated() {
    const terms = pageIntel?.related ?? []
    if (terms.length === 0) return
    const host = location.hostname
    const found = [...terms]
    for (const term of terms.slice(0, 3)) {
      try {
        const response = await fetch(`https://${host}/s?k=${encodeURIComponent(term)}`, { credentials: 'include', cache: 'no-store' })
        const html = await response.text()
        if (/robot check|validatecaptcha|opfcaptcha/i.test(html)) {
          research.setNotice('Amazon asked for a robot check. Related-search reading stopped.')
          break
        }
        found.push(...readPageIntel(html).related)
      } catch {
        research.setNotice('Couldn’t read the next related-search page from this browser.')
        break
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1100))
    }
    setExtraRelated([...new Set(found)])
  }

  async function translateSeed() {
    const market = getMarketplace(selectedMarkets[0] ?? state.marketplaceId)
    const translated = await translateOnDevice(state.seed, 'en', languageFromLocale(market.locale))
    if (!translated) {
      research.setNotice('On-device translation isn’t in this browser. Type the local seed in the translated field, then expand it.')
      return
    }
    research.setTranslatedSeed(translated)
    research.setUseTranslatedSeed(true)
  }

  return (
    <div className={`sprout-app ${frame}`}>
      <header className="flex items-start justify-between gap-2 px-3 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink text-[#f4e4ce]">
            <Sprout className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="wordmark text-[22px] leading-none">Sprout</div>
            <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted">{t('uiForSellers', 'For Amazon sellers')}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={running}
            onClick={() => setMarketsOpen((open) => !open)}
            className="h-8 max-w-[168px] truncate rounded-lg border border-line bg-cream px-2 text-xs text-ink disabled:opacity-50"
            aria-expanded={marketsOpen}
          >
            {marketLabel}
          </button>
          {onCollapse && (
            <button type="button" aria-label="Collapse Sprout" onClick={onCollapse} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-sand hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {marketsOpen && (
        <div className={`grid gap-1 px-3 pt-2 ${surface === 'page' ? 'grid-cols-4' : 'grid-cols-2'}`}>
          {MARKETPLACES.map((item) => (
            <label key={item.id} className="flex items-center gap-1.5 text-[11px] text-ink">
              <input
                type="checkbox"
                checked={selectedMarkets.includes(item.id)}
                disabled={running}
                onChange={() => toggleMarket(item.id)}
              />
              {item.code} · {item.domain}
            </label>
          ))}
        </div>
      )}

      <form
        className="px-3 pt-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (!research.runningHere) void research.start()
        }}
      >
        <div className="flex items-center gap-1.5 rounded-xl border border-line bg-cream p-1.5">
          <Input
            value={state.seed}
            disabled={running}
            onChange={(event) => research.setSeed(event.target.value)}
            placeholder={t('uiSeedPlaceholder', 'e.g. yoga mat')}
            aria-label={t('uiSeedLabel', 'Seed keyword')}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            name="sprout-seed"
            className="h-10 border-0 bg-transparent px-2 shadow-none placeholder:text-ink/35 focus-visible:ring-0"
          />
          {state.run?.status === 'running' ? (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                research.stop()
              }}
            >
              {t('uiStop', 'Stop')}
            </Button>
          ) : (
            <Button type="submit" size="lg" disabled={!state.seed.trim() || research.lockedByOther}>
              {selectedMarkets.length > 1 ? t('uiExpandCount', 'Expand $1', String(selectedMarkets.length)) : t('uiExpand', 'Expand')}
            </Button>
          )}
        </div>
      </form>

      <div className="mt-2 flex items-center justify-between gap-2 px-3">
        <div className="inline-flex rounded-lg bg-sand p-0.5" role="group" aria-label="Expansion mode">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              aria-pressed={state.mode === mode.id}
              disabled={running}
              onClick={() => research.setMode(mode.id)}
              className={`h-7 rounded-md px-2.5 text-xs font-medium disabled:opacity-50 ${state.mode === mode.id ? 'bg-cream text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
            >
              {t(mode.id === 'suffix' ? 'uiSuffix' : mode.id === 'prefix' ? 'uiPrefix' : 'uiBoth', mode.label)}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-ink">
          <Switch
            checked={state.includeSpace}
            disabled={running}
            onCheckedChange={(checked) => research.setIncludeSpace(checked === true)}
            aria-label={t('uiSpaceLabel', 'Insert a space before the extra letter')}
          />
          {t('uiSpace', 'Space')}
        </label>
        <label className="flex items-center gap-2 text-xs text-ink">
          <Switch
            checked={state.deepExpand}
            disabled={running}
            onCheckedChange={(checked) => research.setDeepExpand(checked === true)}
            aria-label={t('uiDeepLabel', 'Deep expand with connector words')}
          />
          {t('uiDeep', 'Deep')}
        </label>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 px-3">
        <select
          aria-label={t('uiDepartment', 'Department')}
          value={state.kdpMode && state.departmentAlias !== 'digital-text' ? 'stripbooks' : state.departmentAlias}
          disabled={running}
          onChange={(event) => research.setDepartmentAlias(event.target.value)}
          className="h-8 rounded-lg border border-line bg-cream px-2 text-xs"
        >
          {DEPARTMENTS.map((item) => (
            <option key={item.id} value={item.id}>{departmentName(item.id, item.label)}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-ink">
          <Switch
            checked={state.kdpMode}
            disabled={running}
            onCheckedChange={(checked) => research.setKdpMode(checked === true)}
            aria-label={t('uiKdpLabel', 'KDP books mode')}
          />
          {t('uiKdp', 'KDP')}
        </label>
        <select
          aria-label={t('uiWordCount', 'Word count')}
          value={state.wordCountFilter}
          onChange={(event) => research.setWordCountFilter(event.target.value as typeof state.wordCountFilter)}
          className="h-8 rounded-lg border border-line bg-cream px-2 text-xs"
        >
          <option value="any">{t('uiAnyLength', 'Any length')}</option>
          <option value="1">{t('uiOneWord', '1 word')}</option>
          <option value="2">{t('uiTwoWords', '2 words')}</option>
          <option value="3+">{t('uiThreePlus', '3+ words')}</option>
        </select>
        <select
          aria-label={t('uiSeedPosition', 'Seed position')}
          value={state.positionFilter}
          onChange={(event) => research.setPositionFilter(event.target.value as typeof state.positionFilter)}
          className="h-8 rounded-lg border border-line bg-cream px-2 text-xs"
        >
          <option value="any">{t('uiAnyPosition', 'Any position')}</option>
          <option value="before">{t('uiBefore', 'Before seed')}</option>
          <option value="after">{t('uiAfter', 'After seed')}</option>
          <option value="between">{t('uiBetween', 'Between')}</option>
          <option value="other">{t('uiOther', 'Other')}</option>
        </select>
      </div>
      <div className="mt-2 flex items-center gap-1.5 px-3">
        <Input
          value={state.translatedSeed}
          disabled={running}
          onChange={(event) => research.setTranslatedSeed(event.target.value)}
          placeholder={t('uiTranslatedPlaceholder', 'Translated seed')}
          aria-label={t('uiTranslatedPlaceholder', 'Translated seed')}
          className="h-8 text-xs"
        />
        <Button type="button" size="sm" variant="outline" disabled={running || !state.seed.trim()} onClick={() => void translateSeed()}>{t('uiTranslate', 'Translate')}</Button>
        <label className="flex shrink-0 items-center gap-1 text-[11px] text-ink">
          <input
            type="checkbox"
            checked={state.useTranslatedSeed}
            disabled={running}
            onChange={(event) => research.setUseTranslatedSeed(event.target.checked)}
            aria-label={t('uiUseLabel', 'Expand the translated seed')}
          />
          {t('uiUse', 'Use')}
        </label>
      </div>
      <p className="truncate px-3 pt-1.5 text-[11px] text-muted" title={plan.example}>
        <span className="tabular-nums">{selectedMarkets.length > 1 ? `${selectedMarkets.length} × ${plan.count}` : t('uiPrefixes', '$1 prefixes', String(plan.count))}</span>
        <span> · {plan.example}</span>
      </p>

      <div className="mt-2 flex gap-1 px-3" role="tablist">
        {tabs.filter((item) => item.show).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`h-7 rounded-md px-2 text-[11px] font-medium ${tab === item.id ? 'bg-ink text-cream' : 'text-muted hover:bg-sand'}`}
          >
            {item.label}
            {item.id === 'saved' && state.savedKeywords.length > 0 ? ` ${state.savedKeywords.length}` : ''}
          </button>
        ))}
      </div>

      {research.contextLost && <Banner tone="error">{research.notice ?? 'This panel is still open from before Sprout reloaded. Close it and open Sprout again.'}</Banner>}
      {research.notice && !research.contextLost && <Banner tone="warn">{research.notice}</Banner>}
      {run?.status === 'error' && run.error && <Banner tone="error">{run.error}</Banner>}
      {run?.status !== 'error' && run?.warnings[0] && <Banner tone="warn">{run.warnings[0]}</Banner>}
      {research.lockedByOther && <Banner tone="warn">Sprout is already expanding a keyword in another panel.</Banner>}

      {run?.status === 'running' && (
        <div className="px-3 pt-2">
          <div className="h-1 overflow-hidden rounded-full bg-sand">
            <div className="h-full bg-clay transition-[width] duration-200" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-muted" aria-live="polite">
            <span className="tabular-nums">{run.finishedQueries}/{run.totalQueries || '…'}</span>
            {' · '}{run.recentLabel}{' · '}
            <span className="tabular-nums">{suggestions.length}</span> keywords
            {' · '}{run.endpointLabel}
          </p>
        </div>
      )}

      {run && run.status !== 'running' && tab === 'results' && (
        <p className="px-3 pt-2 text-[11px] text-muted">
          {run.status === 'cancelled' ? `${t('uiStopped', 'Stopped.')} ` : ''}
          {run.seed !== state.seed.trim() ? `Showing “${run.seed}”. ` : ''}
          {formatWhen(run.finishedAt ?? run.startedAt)}
          {' · '}
          <span className="tabular-nums">{run.finishedQueries}/{run.totalQueries}</span> prefixes
          {hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ''}
        </p>
      )}

      <div className="mt-2 flex min-h-0 flex-1 flex-col">
        {tab === 'results' && hasPro('exclusions') && (
          <form
            className="mb-2 px-3"
            onSubmit={(event) => {
              event.preventDefault()
              addExclusion()
            }}
          >
            <div className="flex items-center gap-1.5">
              <Input
                value={excludeDraft}
                onChange={(event) => setExcludeDraft(event.target.value)}
                placeholder={t('uiExcludePlaceholder', 'Exclude a brand or word')}
                aria-label={t('uiExcludeLabel', 'Exclude words')}
                className="h-8 text-xs"
              />
              <Button type="submit" size="sm" variant="outline" disabled={!excludeDraft.trim()}>{t('uiHide', 'Hide')}</Button>
            </div>
            {state.excludedWords.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {state.excludedWords.map((word) => (
                  <button
                    key={word}
                    type="button"
                    onClick={() => research.setExcludedWords(state.excludedWords.filter((item) => item !== word))}
                    className="rounded-full bg-sand px-2 py-0.5 text-[10px] text-ink"
                    title={`Stop hiding “${word}”`}
                  >
                    {word} ×
                  </button>
                ))}
              </div>
            )}
            {pageIntel && (pageIntel.brands.length > 0 || pageIntel.related.length > 0 || pageIntel.productTitle) && (
              <div className="mt-2 space-y-1">
                {pageIntel.productTitle && (
                    <button type="button" className="text-[11px] text-moss" onClick={() => research.setSeed(pageIntel.productTitle)}>
                    {t('uiUseTitle', 'Use title as seed')}
                  </button>
                )}
                {pageIntel.brands.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="w-full text-[10px] text-muted">{t('uiBrands', 'Brands on this page')}</span>
                    {pageIntel.brands.filter((brand) => {
                      const draft = excludeDraft.trim().toLowerCase()
                      return !draft || brand.toLowerCase().includes(draft)
                    }).map((brand) => (
                      <button
                        key={brand}
                        type="button"
                        className="rounded-full border border-line px-2 py-0.5 text-[10px]"
                        onClick={() => research.setExcludedWords([...state.excludedWords, brand])}
                      >
                        Exclude {brand}
                      </button>
                    ))}
                    {excludeDraft.trim() && pageIntel.brands.every((brand) => !brand.toLowerCase().includes(excludeDraft.trim().toLowerCase())) && (
                      <span className="text-[10px] text-muted">{t('uiNoBrand', 'No brand on this page matches “$1”.', excludeDraft.trim())}</span>
                    )}
                  </div>
                )}
                {pageIntel.related.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <button type="button" className="text-[10px] text-moss" onClick={() => void deepenRelated()}>{t('uiOneMore', 'One more level')}</button>
                    {[...new Set([...pageIntel.related, ...extraRelated])].slice(0, 12).map((term) => (
                      <button
                        key={term}
                        type="button"
                        className="rounded-full bg-sand px-2 py-0.5 text-[10px]"
                        onClick={() => research.setSeed(term)}
                        title="Related search from this page, not a reverse ASIN lookup"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-muted">{t('uiPageTerms', 'Page terms and related searches from this Amazon page. They are not search volume.')}</p>
              </div>
            )}
          </form>
        )}
        {tab === 'results' && surface === 'page' && (
          <KeywordTable
            items={filtered}
            total={suggestions.length}
            selected={research.selected}
            filter={research.filter}
            sort={state.sort}
            starred={starred}
            fallbackMarketplaceId={run?.marketplaceId ?? state.marketplaceId}
            emptyLabel={emptyLabel(run?.status ?? null, state.seed, research.filter, suggestions.length)}
            onFilter={research.setFilter}
            onSort={research.setSort}
            onToggle={(key) => research.setSelected((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])}
            onToggleVisible={(checked) => {
              const visible = new Set(filtered.map((item) => item.key))
              research.setSelected((current) => checked ? [...new Set([...current, ...visible])] : current.filter((key) => !visible.has(key)))
            }}
            onStar={(item) => void research.toggleStar(item)}
            onExpand={(item) => void research.start({ seed: item.value, depth: (run?.depth ?? 0) + 1 })}
            positionLabel={rowPosition}
            resultLabel={rowCount}
            resultTitle={rowCountTitle}
            similar={isSimilar}
          />
        )}
        {tab === 'results' && surface !== 'page' && (
          <ResultsList
            items={filtered}
            total={suggestions.length}
            selected={research.selected}
            filter={research.filter}
            sort={state.sort}
            emptyLabel={emptyLabel(run?.status ?? null, state.seed, research.filter, suggestions.length)}
            starred={starred}
            showMarkets={(run?.marketplaceIds?.length ?? 0) > 1}
            fallbackMarketplaceId={run?.marketplaceId ?? state.marketplaceId}
            onFilter={research.setFilter}
            onSort={research.setSort}
            onToggle={(key) => research.setSelected((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])}
            onToggleVisible={(checked) => {
              const visible = new Set(filtered.map((item) => item.key))
              research.setSelected((current) => checked ? [...new Set([...current, ...visible])] : current.filter((key) => !visible.has(key)))
            }}
            onStar={(item) => void research.toggleStar(item)}
            onExpand={(item) => void research.start({ seed: item.value, depth: (run?.depth ?? 0) + 1 })}
            positionLabel={rowPosition}
            resultLabel={rowCount}
            resultTitle={rowCountTitle}
            similar={isSimilar}
          />
        )}
        {tab === 'terms' && (
          <SearchTermsPanel
            phrases={suggestions.map((item) => item.value)}
            listingText={state.listingText}
            excluded={state.excludedWords}
            dropped={state.droppedSearchWords}
            byteLimit={state.searchTermByteLimit}
            onListingText={research.setListingText}
            onByteLimit={research.setSearchTermByteLimit}
            onDrop={research.dropSearchWord}
            onClearDropped={research.clearDroppedSearchWords}
          />
        )}
        {tab === 'words' && (
          <WordsPanel phrases={filtered.map((item) => item.value)} onFilter={(text) => { research.setFilter(text); setTab('results') }} />
        )}
        {tab === 'kdp' && (
          <KdpPanel
            phrases={suggestions.map((item) => item.value)}
            titleText={state.listingText}
            subtitleText={state.subtitleText}
            onSubtitle={research.setSubtitleText}
            kind={state.departmentAlias === 'digital-text' ? 'digital-text' : 'stripbooks'}
            onKind={(kind) => {
              research.setKdpMode(true)
              research.setDepartmentAlias(kind)
            }}
          />
        )}
        {tab === 'saved' && <SavedPanel items={state.savedKeywords} onRemove={(id) => void research.removeSaved(id)} />}
        {tab === 'history' && (
          <HistoryPanel
            items={state.history}
            onOpen={(id) => {
              research.openHistory(id)
              setTab('results')
            }}
            onDelete={(id) => void research.deleteHistory(id)}
          />
        )}
      </div>

      {shouldShowRatePrompt(state.history.filter((item) => item.run?.status === 'done').length, rateDismissed) && !running && (
        <div className="mx-3 mb-2 rounded-lg border border-line bg-sand px-2.5 py-2 text-[11px] leading-snug text-ink">
          <p>{t('uiRateBody', 'Three finished runs are saved on this device. A store rating helps other sellers find Sprout. This note stays dismissed.')}</p>
          <div className="mt-1.5 flex gap-1.5">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setRateDismissed(true)
                void dismissRatePrompt()
                openExternal(storeReviewUrl())
              }}
            >
              {t('uiRate', 'Rate Sprout')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setRateDismissed(true)
                void dismissRatePrompt()
              }}
            >
              {t('uiNotNow', 'Not now')}
            </Button>
          </div>
        </div>
      )}
      <footer className="relative z-10 shrink-0 border-t border-line bg-cream px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button type="button" size="sm" onClick={() => void onCopy()} disabled={exportCount === 0} className={copyState === 'done' ? 'bg-moss hover:bg-moss' : ''}>
            <Copy className="h-3.5 w-3.5" aria-hidden />
            {copyLabel}
          </Button>
          <Button type="button" size="sm" variant="outline" aria-label="CSV" onClick={() => download('csv')} disabled={exportCount === 0 || !run}>
            {selectedItems.length > 0 ? t('uiExportChecked', 'Export $1 checked', String(selectedItems.length)) : 'CSV'}
          </Button>
          <Button type="button" size="sm" variant="outline" aria-label="XLSX" onClick={() => download('xlsx')} disabled={exportCount === 0 || !run}>
            {selectedItems.length > 0 ? `XLSX · ${selectedItems.length}` : 'XLSX'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={exportCount === 0}
            aria-label="Ads"
            onClick={() => {
              const campaign = cleanSeed(run?.seed || state.seed) || 'Sprout'
              const text = adsCsv(exportItems.map((item) => item.value), campaign, campaign, 'Exact')
              downloadText(`${exportBasename(campaign, 'ads')}.csv`, text, 'text/csv;charset=utf-8')
            }}
          >
            {selectedItems.length > 0 ? `Ads · ${selectedItems.length}` : 'Ads'}
          </Button>
          <label className="flex items-center gap-1 text-[10px] text-muted">
            <input type="checkbox" checked={exactCount} onChange={(event) => setExactCount(event.target.checked)}             aria-label={t('uiQuotesLabel', 'Count exact quoted matches')} />
            {t('uiQuotes', 'Quotes')}
          </label>
          <Button type="button" size="sm" variant="ghost" className="px-2" onClick={() => void countSelected()}>
            {counting ? t('uiStopCount', 'Stop count') : t('uiCount', 'Results')}
          </Button>
          {surface !== 'page' && (
            <Button type="button" size="sm" variant="ghost" className="ml-auto px-2" onClick={() => void openTable()}>
              <Table2 className="h-3.5 w-3.5" aria-hidden />
            {t('uiTable', 'Table')}
          </Button>
          )}
          {surface === 'popup' && (
            <Button type="button" size="sm" variant="ghost" className="px-2" onClick={() => void openSidePanel()}>
              <PanelRight className="h-3.5 w-3.5" aria-hidden />
              {t('uiPanel', 'Panel')}
            </Button>
          )}
        </div>
        <p className="mt-1.5 text-[10px] leading-snug text-muted">
          {selectedItems.length > 0
            ? t('uiFooterChecked', 'Copy and export use the checked rows. Amazon results is a page count, not search volume. Not affiliated with Amazon.')
            : t('uiFooterVisible', 'Copy and export use the visible list. Amazon results is a page count, not search volume. Not affiliated with Amazon.')}
          {' '}
          <button type="button" className="underline decoration-line underline-offset-2 hover:text-ink" onClick={() => openExternal(PROJECT.issuesUrl)}>{t('uiFeedback', 'Feedback')}</button>
          {' · '}
          <button type="button" className="underline decoration-line underline-offset-2 hover:text-ink" onClick={() => openExternal(PROJECT.privacyUrl)}>{t('uiPrivacy', 'Privacy')}</button>
        </p>
      </footer>
    </div>
  )
}

function Banner({ tone, children }: { tone: 'warn' | 'error'; children: string }) {
  const color = tone === 'error' ? 'border-[#f0c2b2] bg-[#fde8df] text-[#8a3418]' : 'border-[#ead9a8] bg-[#f8f1d8] text-[#6d5420]'
  return <p className={`mx-3 mt-2 rounded-lg border px-2.5 py-1.5 text-[11px] leading-snug ${color}`}>{children}</p>
}

function emptyLabel(status: string | null, seed: string, filter: string, count: number): string {
  if (filter.trim() && count > 0) return `Nothing matches “${filter.trim()}”.`
  if (status === 'running') return `Asking Amazon about “${seed.trim() || 'your seed'}”…`
  if (status === 'done' || status === 'cancelled' || status === 'error') return 'No suggestions in this list.'
  return t('uiEmptyStart', 'Enter a seed keyword. Sprout asks Amazon for that prefix, then for every letter and digit — the same autocomplete shoppers see.')
}
