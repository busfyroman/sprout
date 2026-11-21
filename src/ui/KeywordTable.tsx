import { Star } from 'lucide-react'
import { amazonSearchUrl, googleSearchUrl, googleTrendsUrl } from '../lib/links'
import { getMarketplace } from '../lib/marketplaces'
import { suggestionMarkets } from '../lib/results'
import type { SortKey, Suggestion } from '../lib/types'
import { Checkbox } from './components/checkbox'
import { Input } from './components/input'
import { t } from './i18n'

const SORTS: Array<{ id: SortKey; label: string }> = [
  { id: 'alpha', label: 'A → Z' },
  { id: 'alpha-desc', label: 'Z → A' },
  { id: 'shortest', label: 'Shortest' },
  { id: 'longest', label: 'Longest' },
  { id: 'source', label: 'By expansion' },
]

export function KeywordTable({
  items,
  total,
  selected,
  filter,
  sort,
  starred,
  fallbackMarketplaceId,
  emptyLabel,
  onFilter,
  onSort,
  onToggle,
  onToggleVisible,
  onStar,
  onExpand,
  positionLabel,
  resultLabel,
  resultTitle,
  similar,
}: {
  items: Suggestion[]
  total: number
  selected: string[]
  filter: string
  sort: SortKey
  starred: string[]
  fallbackMarketplaceId: string
  emptyLabel: string
  onFilter: (value: string) => void
  onSort: (sort: SortKey) => void
  onToggle: (key: string) => void
  onToggleVisible: (checked: boolean) => void
  onStar: (item: Suggestion) => void
  onExpand?: (item: Suggestion) => void
  positionLabel?: (item: Suggestion) => string
  resultLabel?: (item: Suggestion) => string
  resultTitle?: (item: Suggestion) => string
  similar?: (item: Suggestion) => boolean
}) {
  const selectedVisible = items.filter((item) => selected.includes(item.key)).length
  const allChecked = items.length > 0 && selectedVisible === items.length
  const someChecked = selectedVisible > 0 && !allChecked

  return (
    <section className="flex min-h-0 flex-1 flex-col px-4 pb-3">
      <div className="mb-2 flex items-center gap-2">
        <Input
          value={filter}
          onChange={(event) => onFilter(event.target.value)}
          placeholder={t('uiFilterPlaceholder', 'Filter keywords or +a')}
          aria-label={t('uiFilterLabel', 'Filter suggestions')}
          className="h-8 max-w-sm text-xs"
        />
        <select
          aria-label={t('uiSortLabel', 'Sort suggestions')}
          value={sort}
          onChange={(event) => onSort(event.target.value as SortKey)}
          className="h-8 rounded-lg border border-line bg-cream px-2 text-xs text-ink"
        >
          {SORTS.map((option) => (
            <option key={option.id} value={option.id}>{t(option.id === 'alpha' ? 'uiSortAlpha' : option.id === 'alpha-desc' ? 'uiSortAlphaDesc' : option.id === 'shortest' ? 'uiSortShortest' : option.id === 'longest' ? 'uiSortLongest' : 'uiSortSource', option.label)}</option>
          ))}
        </select>
        <span className="ml-auto text-[11px] tabular-nums text-muted">{items.length === total ? `${total} keywords` : `${items.length} of ${total}`}</span>
      </div>
      <div className="sprout-scroll min-h-0 flex-1 overflow-auto rounded-xl border border-line bg-cream">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead className="sticky top-0 bg-sand text-[11px] text-muted">
            <tr>
              <th className="w-8 px-2 py-2">
                <Checkbox
                  checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                  onCheckedChange={(checked) => onToggleVisible(checked === true)}
                  disabled={items.length === 0}
                  aria-label="Select visible suggestions"
                />
              </th>
              <th className="w-8 px-1 py-2">{t('uiColStar', 'Star')}</th>
              <th className="px-2 py-2 font-medium">{t('uiColKeyword', 'Keyword')}</th>
              <th className="px-2 py-2 font-medium">{t('uiColPosition', 'Position')}</th>
              <th className="px-2 py-2 font-medium">{t('uiColResults', 'Amazon results')}</th>
              <th className="px-2 py-2 font-medium">{t('uiColMarkets', 'Markets')}</th>
              <th className="px-2 py-2 font-medium">{t('uiColFrom', 'From')}</th>
              <th className="px-2 py-2 font-medium">{t('uiColOpen', 'Open')}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted">{emptyLabel}</td>
              </tr>
            ) : items.map((item) => {
              const markets = suggestionMarkets(item, fallbackMarketplaceId)
              const primary = markets[0] ?? fallbackMarketplaceId
              return (
                <tr key={item.key} className="border-t border-line/80 hover:bg-sand/40">
                  <td className="px-2 py-1.5">
                    <Checkbox checked={selected.includes(item.key)} onCheckedChange={() => onToggle(item.key)} aria-label={`Select ${item.value}`} />
                  </td>
                  <td className="px-1 py-1.5">
                    <button type="button" aria-label={starred.includes(item.key) ? `Unsave ${item.value}` : `Save ${item.value}`} onClick={() => onStar(item)} className="text-muted hover:text-clay">
                      <Star className={`h-3.5 w-3.5 ${starred.includes(item.key) ? 'fill-clay text-clay' : ''}`} />
                    </button>
                  </td>
                  <td className="max-w-md px-2 py-1.5 font-medium">
                    {item.value}
                    {similar?.(item) ? <span className="ml-1 text-[10px] text-clay">similar</span> : null}
                    {onExpand ? (
                      <button type="button" className="ml-2 text-[10px] text-moss" onClick={() => onExpand(item)}>{t('uiExpandThis', 'Expand this')}</button>
                    ) : null}
                  </td>
                  <td className="px-2 py-1.5 text-[11px] uppercase text-muted">{positionLabel?.(item) ?? ''}</td>
                  <td className="px-2 py-1.5 text-[11px] text-muted" title={resultTitle?.(item) || 'Amazon result count, not search volume.'}>{resultLabel?.(item) ?? ''}</td>
                  <td className="px-2 py-1.5 text-[11px] text-muted">{markets.map((id) => getMarketplace(id).code).join(' ')}</td>
                  <td className="px-2 py-1.5 font-mono text-[10px] text-muted">{item.sources.slice(0, 4).map((source) => source.label).join(' ')}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-[11px]">
                    <a className="text-moss underline-offset-2 hover:underline" href={amazonSearchUrl(primary, item.value)} target="_blank" rel="noreferrer">{t('uiLinkAmazon', 'Amazon')}</a>
                    {' · '}
                    <a className="text-moss underline-offset-2 hover:underline" href={googleSearchUrl(item.value)} target="_blank" rel="noreferrer">{t('uiLinkGoogle', 'Google')}</a>
                    {' · '}
                    <a className="text-moss underline-offset-2 hover:underline" href={googleTrendsUrl(item.value, primary)} target="_blank" rel="noreferrer">{t('uiLinkTrends', 'Trends')}</a>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
