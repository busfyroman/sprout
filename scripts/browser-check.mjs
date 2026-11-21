import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const dist = path.join(root, 'dist')
const profile = '/tmp/sprout-playwright-profile'
rmSync(profile, { recursive: true, force: true })
mkdirSync('/opt/cursor/artifacts', { recursive: true })

const context = await chromium.launchPersistentContext(profile, {
  headless: false,
  viewport: { width: 420, height: 760 },
  acceptDownloads: true,
  args: [
    `--disable-extensions-except=${dist}`,
    `--load-extension=${dist}`,
    '--no-sandbox',
    '--disable-dev-shm-usage',
  ],
})

try {
  let worker = context.serviceWorkers()[0]
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15000 })
  const extensionId = new URL(worker.url()).host
  console.log('extension', extensionId)
  const page = context.pages()[0] ?? await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`)
  const seed = page.locator('input[name="sprout-seed"]')
  await seed.waitFor()
  const initial = await seed.inputValue()
  if (initial !== '') throw new Error(`Seed field was not empty: ${JSON.stringify(initial)}`)
  const placeholder = await seed.getAttribute('placeholder')
  if (placeholder !== 'e.g. yoga mat') throw new Error(`Unexpected placeholder: ${placeholder}`)

  await seed.fill('yoga mat')
  await page.getByRole('button', { name: 'Expand', exact: true }).click()
  await waitForResults(page, 'amazon.com')
  await page.screenshot({ path: '/opt/cursor/artifacts/sprout-results.png' })
  console.log('us expand ok')

  await page.getByLabel('Filter suggestions').fill('thick')
  await page.waitForTimeout(200)
  const filtered = await page.locator('body').innerText()
  if (!/thick/i.test(filtered)) throw new Error('Filter did not keep thick keywords')
  await page.getByLabel('Sort suggestions').selectOption('shortest')
  await page.getByLabel('Filter suggestions').fill('')

  const star = page.getByRole('button', { name: /^Save / }).first()
  const starredName = (await star.getAttribute('aria-label'))?.replace(/^Save /, '') ?? ''
  await star.click()
  await page.getByRole('tab', { name: /Saved/ }).click()
  await page.getByText(starredName, { exact: true }).waitFor()
  console.log('saved', starredName)

  await page.getByRole('tab', { name: 'Results' }).click()
  await page.getByLabel('Exclude words').fill('crz')
  await page.getByRole('button', { name: 'Hide' }).click()
  await page.getByText(/hidden/).waitFor()
  const afterExclude = await page.locator('li').allInnerTexts()
  if (afterExclude.some((row) => /crz/i.test(row))) throw new Error('Excluded word crz is still in the list')
  console.log('exclude ok')

  await page.getByRole('tab', { name: 'Terms' }).click()
  const chip = page.locator('button[title^="Drop "]').first()
  await chip.waitFor()
  const dropped = (await chip.innerText()).trim()
  const before = await page.locator('text=/\\d+ \\/ \\d+ bytes/').innerText()
  await chip.click()
  await page.waitForFunction((word) => {
    const chipGone = ![...document.querySelectorAll('button')].some((button) => button.textContent?.trim() === word && button.title.startsWith('Drop '))
    return chipGone
  }, dropped)
  const after = await page.locator('text=/\\d+ \\/ \\d+ bytes/').innerText()
  if (before === after) throw new Error(`Dropping “${dropped}” did not change the byte count (${before})`)
  console.log('terms drop', dropped, before, '->', after)

  await page.getByRole('tab', { name: 'Results' }).click()
  const csvDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'CSV', exact: true }).click()
  const csv = await csvDownload
  const csvPath = '/tmp/sprout-check.csv'
  await csv.saveAs(csvPath)
  const csvText = readFileSync(csvPath, 'utf8')
  if (!/keyword,sources,marketplaces/.test(csvText) || !/yoga/i.test(csvText)) throw new Error('CSV export did not contain keywords')
  if (/crz/i.test(csvText)) throw new Error('CSV still contains the excluded word')
  const xlsxDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'XLSX', exact: true }).click()
  const xlsx = await xlsxDownload
  const xlsxPath = '/tmp/sprout-check.xlsx'
  await xlsx.saveAs(xlsxPath)
  const xlsxBytes = readFileSync(xlsxPath)
  if (xlsxBytes[0] !== 0x50 || xlsxBytes[1] !== 0x4b) throw new Error('XLSX is not a zip')
  console.log('exports ok')

  await page.getByRole('tab', { name: 'History' }).click()
  await page.getByText(/· Saved ·/).waitFor()
  await page.getByRole('button', { name: /yoga mat/ }).waitFor()
  console.log('history ok')

  const table = await context.newPage()
  await table.goto(`chrome-extension://${extensionId}/src/viewer/index.html`)
  const amazon = await table.getByRole('link', { name: 'Amazon' }).first().getAttribute('href')
  const google = await table.getByRole('link', { name: 'Google' }).first().getAttribute('href')
  const trends = await table.getByRole('link', { name: 'Trends' }).first().getAttribute('href')
  if (!amazon?.includes('amazon.com/s?k=')) throw new Error(`Bad Amazon link ${amazon}`)
  if (!google?.startsWith('https://www.google.com/search?')) throw new Error(`Bad Google link ${google}`)
  if (!trends?.includes('trends.google.com') || !trends.includes('geo=US')) throw new Error(`Bad Trends link ${trends}`)
  console.log('table links ok')

  await page.bringToFront()
  await page.getByRole('tab', { name: 'Results' }).click()
  await page.getByRole('button', { name: /amazon\.com/ }).click()
  await page.locator('label', { hasText: 'DE · amazon.de' }).locator('input').check()
  await page.getByRole('button', { name: 'US + 1' }).waitFor()
  await page.getByRole('switch', { name: 'Insert a space before the extra letter' }).click()
  await page.getByRole('button', { name: /Expand/ }).click()
  await page.getByRole('button', { name: 'Stop' }).waitFor({ timeout: 10000 })
  await waitForResults(page, 'multi')
  const tagged = await page.locator('li').allInnerTexts()
  if (!tagged.some((row) => /\bDE\b/.test(row))) {
    throw new Error(`No row tagged DE. Sample: ${tagged.slice(0, 8).join(' || ')}`)
  }
  if (!tagged.some((row) => /\bUS\b/.test(row) && /\bDE\b/.test(row))) {
    throw new Error(`No row tagged with both markets. Sample: ${tagged.slice(0, 8).join(' || ')}`)
  }
  console.log('multi-market tags ok')

  const amazonPage = await context.newPage()
  await amazonPage.goto('https://www.amazon.com/s?k=yoga+mat', { waitUntil: 'domcontentloaded', timeout: 45000 })
  const pill = amazonPage.getByRole('button', { name: /Expand suggestions/ })
  await pill.waitFor({ timeout: 20000 })
  await pill.click()
  const pillSwitch = amazonPage.getByRole('switch', { name: 'Insert a space before the extra letter' })
  await pillSwitch.waitFor()
  const beforeSync = await pillSwitch.getAttribute('aria-checked')
  await page.bringToFront()
  const panelSwitch = page.getByRole('switch', { name: 'Insert a space before the extra letter' })
  const panelBefore = await panelSwitch.getAttribute('aria-checked')
  if (panelBefore !== beforeSync) throw new Error(`Space toggle out of sync before click: panel ${panelBefore}, pill ${beforeSync}`)
  await panelSwitch.click()
  const expected = beforeSync === 'true' ? 'false' : 'true'
  await amazonPage.waitForFunction((next) => {
    const host = document.getElementById('sprout-amazon-suggestion-expander')
    const control = host?.shadowRoot?.querySelector('[role="switch"]')
    return control?.getAttribute('aria-checked') === next
  }, expected, { timeout: 10000 })
  console.log('pill space sync ok', beforeSync, '->', beforeSync === 'true' ? 'false' : 'true')
  console.log('browser check passed')
} finally {
  await context.close()
}

async function waitForResults(page, label) {
  await page.waitForFunction(() => {
    const text = document.body.innerText
    const stop = [...document.querySelectorAll('button')].some((button) => button.textContent?.trim() === 'Stop')
    const count = text.match(/(\d+) keywords/)
    return !stop && count != null && Number(count[1]) > 0
  }, { timeout: 180000 })
  const text = await page.locator('body').innerText()
  if (/Couldn’t load suggestions|internal error|unexpected error/i.test(text)) {
    throw new Error(`${label} expand failed:\n${text.slice(0, 700)}`)
  }
  console.log(label, 'keywords', text.match(/(\d+) keywords/)?.[1])
}
