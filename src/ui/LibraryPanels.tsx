import { copyText, downloadBytes, downloadText, safeSpreadsheetText, toCsv } from '../lib/export'
import { buildXlsx } from '../lib/xlsx'
import { historyStatusLabel } from '../lib/library'
import { t } from './i18n'
import { getMarketplace } from '../lib/marketplaces'
import type { HistoryEntry, SavedKeyword } from '../lib/types'
import { formatWhen } from './format'
import { Button } from './components/button'

export function SavedPanel({
  items,
  onRemove,
}: {
  items: SavedKeyword[]
  onRemove: (id: string) => void
}) {
  const rows = savedRows(items)
  return (
    <section className="flex min-h-0 flex-1 flex-col px-3 pb-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Button type="button" size="sm" disabled={items.length === 0} onClick={() => void copyText(items.map((item) => item.value).join('\n'))}>Copy</Button>
        <Button type="button" size="sm" variant="outline" disabled={items.length === 0} onClick={() => downloadText('sprout-saved.csv', toCsv(rows), 'text/csv;charset=utf-8')}>CSV</Button>
        <Button type="button" size="sm" variant="outline" disabled={items.length === 0} onClick={() => downloadBytes('sprout-saved.xlsx', buildXlsx(rows), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}>XLSX</Button>
      </div>
      <div className="sprout-scroll min-h-0 flex-1 overflow-y-auto rounded-xl border border-line bg-cream">
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">Star a keyword and it stays here, with its marketplace and the date you saved it.</p>
        ) : (
          <ul>
            {items.map((item) => (
              <li key={item.id} className="flex items-start gap-2 border-b border-line/80 px-2.5 py-2 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px]">{item.value}</p>
                  <p className="text-[10px] text-muted">
                    {item.marketplaceIds.map((id) => getMarketplace(id).code).join(' ')}
                    {' · '}
                    {formatWhen(item.savedAt)}
                    {item.seed ? ` · ${item.seed}` : ''}
                  </p>
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => onRemove(item.id)}>Remove</Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export function HistoryPanel({
  items,
  onOpen,
  onDelete,
}: {
  items: HistoryEntry[]
  onOpen: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <section className="sprout-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-3">
      {items.length === 0 ? (
        <p className="rounded-xl border border-line bg-cream px-4 py-8 text-center text-sm text-muted">Saved and failed runs stay on this device. A failed run is marked Failed so it isn’t an empty success. Open one to copy or export it again.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => {
            const ids = item.run.marketplaceIds?.length ? item.run.marketplaceIds : [item.run.marketplaceId]
            return (
              <li key={item.id} className="flex items-center gap-2 rounded-xl border border-line bg-cream px-2.5 py-2">
                <button type="button" onClick={() => onOpen(item.id)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[13px] font-medium">{item.run.seed}</span>
                  <span className="block text-[10px] text-muted">
                    {ids.map((id) => getMarketplace(id).code).join(', ')}
                    {' · '}
                    {formatWhen(item.savedAt)}
                    {' · '}
                    {t(item.run.status === 'error' ? 'uiStatusFailed' : item.run.status === 'cancelled' ? 'uiStatusStopped' : 'uiStatusSaved', historyStatusLabel(item.run.status))}
                    {' · '}
                    {item.run.suggestions.length} keywords
                  </span>
                </button>
                <Button type="button" size="sm" variant="ghost" onClick={() => onDelete(item.id)}>Remove</Button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function savedRows(items: readonly SavedKeyword[]): string[][] {
  return [
    ['keyword', 'marketplaces', 'seed', 'saved'],
    ...items.map((item) => [
      safeSpreadsheetText(item.value),
      item.marketplaceIds.map((id) => getMarketplace(id).code).join('; '),
      safeSpreadsheetText(item.seed),
      new Date(item.savedAt).toISOString(),
    ]),
  ]
}

