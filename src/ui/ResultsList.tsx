import { Star } from 'lucide-react'
import { getMarketplace } from '../lib/marketplaces'
import { suggestionMarkets } from '../lib/results'
import type { SortKey, Suggestion } from '../lib/types'
import { Checkbox } from './components/checkbox'
import { Input } from './components/input'

const SORTS: Array<{ id: SortKey; label: string }> = [
  { id: 'alpha', label: 'A → Z' },
  { id: 'alpha-desc', label: 'Z → A' },
  { id: 'shortest', label: 'Shortest' },
  { id: 'longest', label: 'Longest' },
  { id: 'source', label: 'By expansion' },
]

export function ResultsList({
  items,
  total,
  selected,
  filter,
  sort,
  emptyLabel,
  starred,
  fallbackMarketplaceId,
  showMarkets = false,
  onFilter,
  onSort,
  onToggle,
  onToggleVisible,
  onStar,
}: {
  items: Suggestion[]
  total: number
  selected: string[]
  filter: string
  sort: SortKey
  emptyLabel: string
  starred: string[]
  fallbackMarketplaceId: string
  showMarkets?: boolean
  onFilter: (value: string) => void
  onSort: (sort: SortKey) => void
  onToggle: (key: string) => void
  onToggleVisible: (checked: boolean) => void
  onStar: (item: Suggestion) => void
}) {
  const selectedVisible = items.filter((item) => selected.includes(item.key)).length
  const allChecked = items.length > 0 && selectedVisible === items.length
  const someChecked = selectedVisible > 0 && !allChecked

  return (
    <section className="flex min-h-0 flex-1 flex-col px-3 pb-2">
      <div className="mb-2 flex items-center gap-2">
        <Input
          value={filter}
          onChange={(event) => onFilter(event.target.value)}
          placeholder="Filter keywords or +a"
          aria-label="Filter suggestions"
          className="h-8 text-xs"
        />
        <select
          aria-label="Sort suggestions"
          value={sort}
          onChange={(event) => onSort(event.target.value as SortKey)}
          className="h-8 shrink-0 rounded-lg border border-line bg-cream px-2 text-xs text-ink"
        >
          {SORTS.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </div>
      <div className="mb-1 flex items-center justify-between px-1 text-[11px] text-muted">
        <label className="flex items-center gap-2">
          <Checkbox
            checked={allChecked ? true : someChecked ? 'indeterminate' : false}
            onCheckedChange={(checked) => onToggleVisible(checked === true)}
            disabled={items.length === 0}
            aria-label="Select visible suggestions"
          />
          Select visible
        </label>
        <span className="tabular-nums">{items.length === total ? `${total} keywords` : `${items.length} of ${total}`}</span>
      </div>
      <div className="sprout-scroll min-h-0 flex-1 overflow-y-auto rounded-xl border border-line bg-cream">
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm leading-relaxed text-muted">{emptyLabel}</p>
        ) : (
          <ul>
            {items.map((item) => {
              const checked = selected.includes(item.key)
              const extra = item.sources.length > 2 ? item.sources.length - 2 : 0
              const markets = suggestionMarkets(item, fallbackMarketplaceId)
              const saved = starred.includes(item.key)
              return (
                <li key={item.key} className="border-b border-line/80 last:border-b-0">
                  <div
                    role="checkbox"
                    aria-checked={checked}
                    tabIndex={0}
                    onClick={() => onToggle(item.key)}
                    onKeyDown={(event) => {
                      if (event.key === ' ' || event.key === 'Enter') {
                        event.preventDefault()
                        onToggle(item.key)
                      }
                    }}
                    className={`flex cursor-pointer items-center gap-2 px-2.5 py-1.5 outline-none focus-visible:bg-sand/70 ${checked ? 'bg-clay/5' : 'hover:bg-sand/50'}`}
                  >
                    <Checkbox checked={checked} tabIndex={-1} aria-hidden className="pointer-events-none" />
                    <button
                      type="button"
                      aria-label={saved ? `Unsave ${item.value}` : `Save ${item.value}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        onStar(item)
                      }}
                      className="text-muted hover:text-clay"
                    >
                      <Star className={`h-3.5 w-3.5 ${saved ? 'fill-clay text-clay' : ''}`} />
                    </button>
                    <span className="min-w-0 flex-1 truncate text-[13px]" title={item.value}>{item.value}</span>
                    {(showMarkets || markets.length > 1) && (
                      <span className="shrink-0 font-mono text-[10px] text-muted">
                        {markets.map((id) => getMarketplace(id).code).join(' ')}
                      </span>
                    )}
                    <span className="flex shrink-0 items-center gap-1" title={item.sources.map((source) => source.label).join(', ')}>
                      {item.sources.slice(0, 2).map((source) => (
                        <span
                          key={source.label}
                          className={`rounded px-1 py-0.5 font-mono text-[10px] leading-none ${source.label === 'seed' ? 'bg-moss/10 text-moss' : 'bg-sand text-ink/75'}`}
                        >
                          {source.label}
                        </span>
                      ))}
                      {extra > 0 && <span className="font-mono text-[10px] text-muted">+{extra}</span>}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
