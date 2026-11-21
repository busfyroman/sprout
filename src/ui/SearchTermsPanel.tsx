import { useMemo, useState } from 'react'
import { copyText } from '../lib/export'
import { buildSearchTerms, clampLimit } from '../lib/search-terms'
import { Button } from './components/button'
import { Input } from './components/input'
import { t } from './i18n'

export function SearchTermsPanel({
  phrases,
  listingText,
  excluded,
  dropped,
  byteLimit,
  onListingText,
  onByteLimit,
  onDrop,
  onClearDropped,
}: {
  phrases: string[]
  listingText: string
  excluded: string[]
  dropped: string[]
  byteLimit: number
  onListingText: (value: string) => void
  onByteLimit: (value: number) => void
  onDrop: (word: string) => void
  onClearDropped: () => void
}) {
  const [copied, setCopied] = useState(false)
  const plan = useMemo(
    () => buildSearchTerms({ phrases, listingText, excluded, dropped, limit: byteLimit }),
    [phrases, listingText, excluded, dropped, byteLimit],
  )
  const full = plan.bytes >= plan.limit

  async function onCopy() {
    if (!plan.text) return
    await copyText(plan.text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <section className="sprout-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-ink">{t('uiTermsTitle', 'Backend search terms')}</h2>
          <p className="mt-0.5 text-[11px] leading-snug text-muted">
            {t('uiTermsHelp', 'Most common words in this list. Click one to drop it. Not search volume.')}
          </p>
        </div>
        <label className="shrink-0 text-[11px] text-muted">
          Bytes
          <Input
            type="number"
            min={20}
            max={1000}
            value={byteLimit}
            onChange={(event) => onByteLimit(clampLimit(Number(event.target.value)))}
            className="mt-0.5 h-8 w-20 text-xs"
            aria-label="Search terms byte limit"
          />
        </label>
      </div>
      <label className="block text-[11px] text-muted">
        {t('uiTitleLabel', 'Already in the title or bullets')}
        <textarea
          value={listingText}
          onChange={(event) => onListingText(event.target.value)}
          rows={2}
          placeholder="Paste title and bullets so those words are not repeated"
          className="mt-1 w-full resize-y rounded-lg border border-line bg-cream px-2.5 py-1.5 text-xs text-ink outline-none focus-visible:border-clay focus-visible:ring-2 focus-visible:ring-clay/30"
        />
      </label>
      <div className="rounded-xl border border-line bg-cream p-2.5">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className={`text-[11px] tabular-nums ${full ? 'text-clay' : 'text-muted'}`}>{plan.bytes} / {plan.limit} bytes</span>
          <div className="flex gap-1">
            {dropped.length > 0 && (
              <Button type="button" size="sm" variant="ghost" onClick={onClearDropped}>Restore</Button>
            )}
            <Button type="button" size="sm" onClick={() => void onCopy()} disabled={!plan.text}>{copied ? 'Copied' : 'Copy terms'}</Button>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-ink">{plan.text || 'Expand a seed to build the field.'}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {plan.words.map((word) => (
            <button
              key={word}
              type="button"
              onClick={() => onDrop(word)}
              className="rounded-full bg-sand px-2 py-0.5 text-[11px] text-ink hover:bg-clay/15"
              title={`Drop “${word}” and fill with the next word`}
            >
              {word}
            </button>
          ))}
        </div>
      </div>
      {plan.waiting.length > 0 && (
        <p className="text-[11px] leading-snug text-muted">
          Next in: {plan.waiting.slice(0, 8).join(', ')}
        </p>
      )}
    </section>
  )
}
