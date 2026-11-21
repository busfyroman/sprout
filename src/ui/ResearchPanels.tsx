import { useState } from 'react'
import { analyzeWords, buildKdpBoxes } from '../lib/analysis'
import { copyText } from '../lib/export'
import { Button } from './components/button'
import { Input } from './components/input'
import { t } from './i18n'

export function WordsPanel({
  phrases,
  onFilter,
}: {
  phrases: string[]
  onFilter: (text: string) => void
}) {
  const { words, pairs } = analyzeWords(phrases)
  return (
    <section className="sprout-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-3">
      <div>
        <h2 className="text-sm font-medium">{t('uiWordsTitle', 'Word analysis')}</h2>
        <p className="mt-1 text-[11px] leading-snug text-muted">
          {t('uiWordsHelp', 'How often each word and pair shows up in these suggestions, after stop words. Click one to filter the list. Counts are not search volume.')}
        </p>
      </div>
      <WordCloud title={t('uiTabWords', 'Words')} items={words.slice(0, 40)} onFilter={onFilter} />
      <WordCloud title={t('uiPairs', 'Pairs')} items={pairs.slice(0, 24)} onFilter={onFilter} />
    </section>
  )
}

function WordCloud({
  title,
  items,
  onFilter,
}: {
  title: string
  items: Array<{ text: string; count: number }>
  onFilter: (text: string) => void
}) {
  return (
    <div>
      <h3 className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{title}</h3>
      <div className="flex flex-wrap gap-1">
        {items.length === 0 ? <p className="text-xs text-muted">{t('uiWordsEmpty', 'Expand a seed first.')}</p> : items.map((item) => (
          <button
            key={item.text}
            type="button"
            onClick={() => onFilter(item.text)}
            className="rounded-full bg-sand px-2 py-0.5 text-[11px] text-ink hover:bg-clay/15"
          >
            {item.text} <span className="tabular-nums text-muted">{item.count}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function KdpPanel({
  phrases,
  titleText,
  subtitleText,
  onSubtitle,
  kind,
  onKind,
}: {
  phrases: string[]
  titleText: string
  subtitleText: string
  onSubtitle: (value: string) => void
  kind: 'stripbooks' | 'digital-text'
  onKind: (kind: 'stripbooks' | 'digital-text') => void
}) {
  const boxes = buildKdpBoxes(phrases, `${titleText}\n${subtitleText}`)
  const [copied, setCopied] = useState(false)
  return (
    <section className="sprout-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">{t('uiKdpTitle', 'KDP keyword boxes')}</h2>
        <select
          aria-label="KDP department"
          value={kind}
          onChange={(event) => onKind(event.target.value as 'stripbooks' | 'digital-text')}
          className="h-8 rounded-lg border border-line bg-cream px-2 text-xs"
        >
          <option value="stripbooks">{t('deptBooks', 'Books')}</option>
          <option value="digital-text">{t('deptKindle', 'Kindle')}</option>
        </select>
      </div>
      <p className="text-[11px] leading-snug text-muted">
        {t('uiKdpHelp', 'Seven boxes, 50 characters each. Words already in the title or subtitle are skipped, and a word is used only once. This is not search volume.')}
      </p>
      <label className="block text-[11px] text-muted">
        {t('uiSubtitle', 'Subtitle')}
        <Input value={subtitleText} onChange={(event) => onSubtitle(event.target.value)} className="mt-1 h-8 text-xs" aria-label={t('uiSubtitle', 'Subtitle')} />
      </label>
      <ol className="space-y-1">
        {boxes.map((box, index) => (
          <li key={index} className="flex items-center gap-2">
            <span className="w-4 text-[11px] tabular-nums text-muted">{index + 1}</span>
            <code className="min-w-0 flex-1 truncate rounded-md border border-line bg-cream px-2 py-1 text-[12px]">{box || '—'}</code>
            <span className="w-10 text-right text-[10px] tabular-nums text-muted">{box.length}/50</span>
          </li>
        ))}
      </ol>
      <Button
        type="button"
        size="sm"
        onClick={() => {
          void copyText(boxes.filter(Boolean).join('\n')).then(() => {
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1200)
          })
        }}
      >
        {copied ? t('uiCopied', 'Copied') : t('uiCopyBoxes', 'Copy 7 boxes')}
      </Button>
    </section>
  )
}
