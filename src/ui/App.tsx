import { Copy, PanelRight, Sprout, Table2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { buildCsv, buildWorkbook, copyText, downloadBytes, downloadText, exportBasename, keywordsToCopy } from '../lib/export'
import { getMarketplace, MARKETPLACES } from '../lib/marketplaces'
import { hasPro } from '../lib/pro'
import { describePlan } from '../lib/queries'
import { applyExclusions, filterSuggestions, sortSuggestions } from '../lib/results'
import { parseWordList } from '../lib/search-terms'
import type { ExpandMode } from '../lib/types'
import { HistoryPanel, SavedPanel } from './LibraryPanels'
import { KeywordTable } from './KeywordTable'
import { ResultsList } from './ResultsList'
import { SearchTermsPanel } from './SearchTermsPanel'
import { Button } from './components/button'
import { Input } from './components/input'
import { Switch } from './components/switch'
import { formatWhen } from './format'
import { useResearch } from './useResearch'

export type Surface = 'popup' | 'sidepanel' | 'overlay' | 'page'
type PanelTab = 'results' | 'terms' | 'saved' | 'history'

const MODES: Array<{ id: ExpandMode; label: string }> = [
  { id: 'suffix', label: 'Suffix' },
  { id: 'prefix', label: 'Prefix' },
  { id: 'both', label: 'Both' },
]

export function App({
  surface,
  pageSeed,
  pageMarketplaceId,
  onCollapse,
}: {
  surface: Surface
  pageSeed?: string
  pageMarketplaceId?: string
  onCollapse?: () => void
}) {
  const research = useResearch({ pageSeed, pageMarketplaceId })
  const [tab, setTab] = useState<PanelTab>('results')
  const [marketsOpen, setMarketsOpen] = useState(false)
  const [excludeDraft, setExcludeDraft] = useState('')
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'error'>('idle')
  const { state, ready } = research
  const plan = describePlan(state.seed, state.mode, state.includeSpace)
  const run = state.run
  const suggestions = useMemo(
    () => applyExclusions(
      (run?.suggestions ?? []).filter((item) => item && typeof item.value === 'string'),
      hasPro('exclusions') ? state.excludedWords : [],
    ),
    [run, state.excludedWords],
  )
  const hiddenCount = (run?.suggestions.length ?? 0) - suggestions.length
  const filtered = useMemo(
    () => sortSuggestions(filterSuggestions(suggestions, research.filter), state.sort),
    [suggestions, research.filter, state.sort],
  )
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
  const copyLabel = copyState === 'done' ? 'Copied' : selectedItems.length > 0 ? `Copy ${selectedItems.length}` : `Copy ${exportCount || ''}`.trim()

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
    { id: 'results', label: 'Results', show: true },
    { id: 'terms', label: 'Terms', show: hasPro('searchTerms') },
    { id: 'saved', label: 'Saved', show: hasPro('savedKeywords') },
    { id: 'history', label: 'History', show: hasPro('history') },
  ]

  return (
    <div className={`sprout-app ${frame}`}>
      <header className="flex items-start justify-between gap-2 px-3 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink text-[#f4e4ce]">
            <Sprout className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="wordmark text-[22px] leading-none">Sprout</div>
            <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted">Amazon suggestions</div>
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
            placeholder="e.g. yoga mat"
            aria-label="Seed keyword"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            name="sprout-seed"
            className="h-10 border-0 bg-transparent px-2 shadow-none placeholder:text-ink/35 focus-visible:ring-0"
          />
          {research.runningHere ? (
            <Button type="button" variant="secondary" size="lg" onClick={research.stop}>Stop</Button>
          ) : (
            <Button type="submit" size="lg" disabled={!state.seed.trim() || research.lockedByOther}>
              {selectedMarkets.length > 1 ? `Expand ${selectedMarkets.length}` : 'Expand'}
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
              {mode.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-ink">
          <Switch
            checked={state.includeSpace}
            disabled={running}
            onCheckedChange={(checked) => research.setIncludeSpace(checked === true)}
            aria-label="Insert a space before the extra letter"
          />
          Space
        </label>
      </div>
      <p className="truncate px-3 pt-1.5 text-[11px] text-muted" title={plan.example}>
        <span className="tabular-nums">{selectedMarkets.length > 1 ? `${selectedMarkets.length} × ${plan.count}` : plan.count} prefixes</span>
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
                placeholder="Exclude a brand or word"
                aria-label="Exclude words"
                className="h-8 text-xs"
              />
              <Button type="submit" size="sm" variant="outline" disabled={!excludeDraft.trim()}>Hide</Button>
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

      <footer className="relative z-10 shrink-0 border-t border-line bg-cream px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <Button type="button" size="sm" onClick={() => void onCopy()} disabled={exportCount === 0} className={copyState === 'done' ? 'bg-moss hover:bg-moss' : ''}>
            <Copy className="h-3.5 w-3.5" aria-hidden />
            {copyLabel}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => download('csv')} disabled={exportCount === 0 || !run}>CSV</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => download('xlsx')} disabled={exportCount === 0 || !run}>XLSX</Button>
          {surface !== 'page' && (
            <Button type="button" size="sm" variant="ghost" className="ml-auto px-2" onClick={() => void openTable()}>
              <Table2 className="h-3.5 w-3.5" aria-hidden />
              Table
            </Button>
          )}
          {surface === 'popup' && (
            <Button type="button" size="sm" variant="ghost" className="px-2" onClick={() => void openSidePanel()}>
              <PanelRight className="h-3.5 w-3.5" aria-hidden />
              Panel
            </Button>
          )}
        </div>
        <p className="mt-1.5 text-[10px] leading-snug text-muted">
          {selectedItems.length > 0 ? 'Copy and export use the checked rows.' : 'Copy and export use the visible list.'}
          {' '}Everything stays in this browser.
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
  return 'Enter a seed keyword. Sprout asks Amazon for that prefix, then for every letter and digit — the same autocomplete shoppers see.'
}
