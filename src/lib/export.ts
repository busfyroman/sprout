import type { Suggestion } from './types'
import { buildXlsx } from './xlsx'

export interface ExportMeta {
  seed: string
  marketplace: string
  domain: string
}

export function keywordsToCopy(items: readonly Suggestion[]): string {
  return items.map((item) => item.value).join('\n')
}

export function buildExportRows(items: readonly Suggestion[], meta: ExportMeta): string[][] {
  const header = ['keyword', 'sources', 'marketplaces', 'seed']
  const body = items.map((item) => [
    safeSpreadsheetText(item.value),
    safeSpreadsheetText(item.sources.map((source) => source.exportLabel).join('; ')),
    safeSpreadsheetText((item.marketplaces ?? []).join('; ')),
    safeSpreadsheetText(meta.seed),
  ])
  return [header, ...body]
}

export function toCsv(rows: readonly (readonly string[])[]): string {
  const lines = rows.map((row) => row.map(csvCell).join(','))
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

export function exportBasename(seed: string, domain: string): string {
  const slug = seed
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'keywords'
  const host = domain.replace(/[^a-z0-9.]+/gi, '')
  return `sprout-${slug}-${host}`
}

export function buildCsv(items: readonly Suggestion[], meta: ExportMeta): string {
  return toCsv(buildExportRows(items, meta))
}

export function buildWorkbook(items: readonly Suggestion[], meta: ExportMeta): Uint8Array {
  return buildXlsx(buildExportRows(items, meta))
}

export function safeSpreadsheetText(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value
}

function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`
  return value
}

export function downloadText(filename: string, content: string, mime: string): void {
  downloadBlob(filename, new Blob([content], { type: mime }))
}

export function downloadBytes(filename: string, bytes: Uint8Array, mime: string): void {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  downloadBlob(filename, new Blob([copy], { type: mime }))
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export async function copyText(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }
  } catch {
    // The content-script panel often fails the async clipboard API. Fall through.
  }
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.top = '0'
  area.style.left = '-9999px'
  document.body.appendChild(area)
  area.select()
  const ok = document.execCommand('copy')
  area.remove()
  if (!ok) throw new Error('Clipboard isn’t available in this panel.')
}
