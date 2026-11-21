import { Copy, PanelRight, Sprout, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { buildCsv, buildWorkbook, copyText, downloadBytes, downloadText, exportBasename, keywordsToCopy } from '../lib/export'
import { getMarketplace, MARKETPLACES } from '../lib/marketplaces'
import { describePlan } from '../lib/queries'
import { filterSuggestions, sortSuggestions } from '../lib/results'
import type { ExpandMode } from '../lib/types'
import { ResultsList } from './ResultsList'
import { Button } from './components/button'
import { Input } from './components/input'
import { Switch } from './components/switch'
import { useResearch } from './useResearch'

export type Surface = 'popup' | 'sidepanel' | 'overlay'

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
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'error'>('idle')
  const { state, ready } = research
  const plan = describePlan(state.seed, state.mode, state.includeSpace)
  const run = state.run
  const suggestions = useMemo(
    () => (run?.suggestions ?? []).filter((item) => item && typeof item.value === 'string'),
    [run],
  )
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
  const frame = surface === 'overlay'
    ? 'flex h-[min(640px,calc(100vh-32px))] w-[min(400px,calc(100vw-28px))] flex-col overflow-hidden rounded-2xl border border-line shadow-[0_22px_60px_rgba(28,25,21,0.28)]'
    : surface === 'sidepanel'
      ? 'mx-auto flex h-full w-full max-w-[560px] flex-col'
      : 'flex h-full w-full flex-col'

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
    const meta = {
      seed: run.seed,
      marketplace: getMarketplace(run.marketplaceId).label,
      domain: getMarketplace(run.marketplaceId).domain,
    }
    const base = exportBasename(run.seed, meta.domain)
    if (kind === 'csv') {
      downloadText(`${base}.csv`, buildCsv(exportItems, meta), 'text/csv;charset=utf-8')
      return
    }
    downloadBytes(
      `${base}.xlsx`,
      buildWorkbook(exportItems, meta),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
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
          <label className="sr-only" htmlFor="sprout-market">Marketplace</label>
          <select
            id="sprout-market"
            value={state.marketplaceId}
            disabled={running}
            onChange={(event) => research.setMarketplaceId(event.target.value)}
            className="h-8 max-w-[168px] rounded-lg border border-line bg-cream px-2 text-xs text-ink disabled:opacity-50"
          >
            {MARKETPLACES.map((item) => (
              <option key={item.id} value={item.id}>{item.code} · {item.domain}</option>
            ))}
          </select>
          {onCollapse && (
            <button
              type="button"
              aria-label="Collapse Sprout"
              onClick={onCollapse}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-sand hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

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
            placeholder="yoga mat, low content book, funny nurse…"
            aria-label="Seed keyword"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            name="sprout-seed"
            className="h-10 border-0 bg-transparent px-2 shadow-none focus-visible:ring-0"
          />
          {research.runningHere ? (
            <Button type="button" variant="secondary" size="lg" onClick={research.stop}>Stop</Button>
          ) : (
            <Button type="submit" size="lg" disabled={!state.seed.trim() || research.lockedByOther}>Expand</Button>
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
        <span className="tabular-nums">{plan.count} prefixes</span>
        <span> · {plan.example}</span>
      </p>

      {research.notice && <Banner tone="warn">{research.notice}</Banner>}
      {run?.status === 'error' && run.error && <Banner tone="error">{run.error}</Banner>}
      {run?.status !== 'error' && run?.warnings[0] && <Banner tone="warn">{run.warnings[0]}</Banner>}
      {research.lockedByOther && (
        <Banner tone="warn">Sprout is already expanding a keyword in another panel.</Banner>
      )}

      {run?.status === 'running' && (
        <div className="px-3 pt-2">
          <div className="h-1 overflow-hidden rounded-full bg-sand">
            <div className="h-full bg-clay transition-[width] duration-200" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-muted" aria-live="polite">
            <span className="tabular-nums">{run.finishedQueries}/{run.totalQueries || '…'}</span>
            {' · '}
            {run.recentLabel}
            {' · '}
            <span className="tabular-nums">{suggestions.length}</span> keywords
            {' · '}
            {run.endpointLabel}
          </p>
        </div>
      )}

      {run && run.status !== 'running' && (
        <p className="px-3 pt-2 text-[11px] text-muted">
          {run.seed !== state.seed.trim() ? `Showing “${run.seed}”. ` : ''}
          {formatWhen(run.finishedAt ?? run.startedAt)}
          {' · '}
          <span className="tabular-nums">{run.finishedQueries}/{run.totalQueries}</span> prefixes
          {' · '}
          {run.endpointLabel}
        </p>
      )}

      <div className="mt-2 flex min-h-0 flex-1 flex-col">
        <ResultsList
          items={filtered}
          total={suggestions.length}
          selected={research.selected}
          filter={research.filter}
          sort={state.sort}
          emptyLabel={emptyLabel(run?.status ?? null, state.seed, research.filter, suggestions.length)}
          onFilter={research.setFilter}
          onSort={research.setSort}
          onToggle={(key) => {
            research.setSelected((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])
          }}
          onToggleVisible={(checked) => {
            const visible = new Set(filtered.map((item) => item.key))
            research.setSelected((current) => {
              if (checked) return [...new Set([...current, ...visible])]
              return current.filter((key) => !visible.has(key))
            })
          }}
        />
      </div>

      <footer className="border-t border-line bg-cream/70 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <Button type="button" size="sm" onClick={() => void onCopy()} disabled={exportCount === 0} className={copyState === 'done' ? 'bg-moss hover:bg-moss' : ''}>
            <Copy className="h-3.5 w-3.5" aria-hidden />
            {copyLabel}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => download('csv')} disabled={exportCount === 0 || !run}>CSV</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => download('xlsx')} disabled={exportCount === 0 || !run}>XLSX</Button>
          {surface !== 'sidepanel' && (
            <Button type="button" size="sm" variant="ghost" className="ml-auto px-2" onClick={() => void openSidePanel()}>
              <PanelRight className="h-3.5 w-3.5" aria-hidden />
              Panel
            </Button>
          )}
        </div>
        <p className="mt-1.5 text-[10px] leading-snug text-muted">
          {selectedItems.length > 0 ? 'Copy and export use the checked rows.' : 'Copy and export use the visible list.'}
          {' '}Pro later: every marketplace, and run history.
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

function formatWhen(ms: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(ms)
}
