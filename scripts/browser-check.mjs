import { copyFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
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
  await worker.evaluate(async () => {
    await chrome.storage.local.set({
      'sprout.v1': {
        version: 1,
        seed: 'yoga mat, low content book, funny nurse…',
        marketplaceId: 'us',
        mode: 'suffix',
        includeSpace: true,
        sort: 'alpha',
        run: null,
        runLock: null,
        history: [],
        savedKeywords: [],
        excludedWords: [],
        listingText: '',
        searchTermByteLimit: 249,
        droppedSearchWords: [],
      },
    })
  })
  const page = context.pages()[0] ?? await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`)
  const seed = page.locator('input[name="sprout-seed"]')
  await seed.waitFor()
  const initial = await seed.inputValue()
  if (initial !== '') throw new Error(`Seed field was not empty: ${JSON.stringify(initial)}`)
  const placeholder = await seed.getAttribute('placeholder')
  if (placeholder !== 'e.g. yoga mat') throw new Error(`Unexpected placeholder: ${placeholder}`)
  const storedSeed = await worker.evaluate(async () => {
    const bag = await chrome.storage.local.get(['sprout.v1', 'sprout.settings'])
    return {
      run: bag['sprout.v1']?.seed ?? null,
      settings: bag['sprout.settings']?.seed ?? null,
    }
  })
  if (storedSeed.run !== '' || (storedSeed.settings != null && storedSeed.settings !== '')) {
    throw new Error(`Legacy seed was not cleared: ${JSON.stringify(storedSeed)}`)
  }
  console.log('legacy seed cleared')

  const tableOpen = context.waitForEvent('page')
  await page.getByRole('button', { name: 'Table' }).click()
  const tableFromPanel = await tableOpen
  await tableFromPanel.waitForURL(/\/src\/viewer\/index\.html/)
  console.log('table from side panel', tableFromPanel.url())
  await tableFromPanel.close()

  await seed.fill('yoga mat')
  await page.getByRole('button', { name: 'Expand', exact: true }).click()
  await waitForResults(page, 'amazon.com')
  await page.screenshot({ path: '/opt/cursor/artifacts/sprout-results.png' })
  console.log('us expand ok')

  await page.getByRole('tab', { name: 'Words' }).click()
  await page.getByRole('heading', { name: 'Word analysis' }).waitFor()
  await shot(page, 'sprout-word-analysis.png')
  await page.getByRole('tab', { name: 'Results' }).click()
  await page.getByLabel('Department').selectOption('stripbooks')
  await shot(page, 'sprout-department.png')
  await page.getByLabel('Department').selectOption('aps')
  await page.getByRole('tab', { name: 'KDP' }).click()
  await page.getByRole('heading', { name: 'KDP keyword boxes' }).waitFor()
  await shot(page, 'sprout-kdp.png')
  await page.getByRole('tab', { name: 'Results' }).click()
  await page.getByRole('checkbox', { name: /^Select / }).first().click()
  await page.getByRole('button', { name: 'Results', exact: true }).click()
  await page.waitForFunction(() => {
    const text = document.body.innerText
    return /Finished reading Amazon result counts|robot check|did not show a result count|Couldn’t read the result count/i.test(text)
  }, { timeout: 25000 })
  await shot(page, 'sprout-result-counts.png')
  const countText = await page.locator('body').innerText()
  if (/search volume/i.test(countText) && !/not search volume/i.test(countText)) {
    throw new Error('Result count was labeled as search volume')
  }
  console.log('views ok', /robot check/i.test(countText) ? 'captcha' : 'count')

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
  if (!xlsxBytes.toString('latin1').includes('Word analysis')) throw new Error('XLSX is missing the Word analysis sheet')
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
  await page.locator('form').getByRole('button', { name: /^Expand/ }).click()
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
  const overlap = await amazonPage.evaluate(() => {
    const root = document.getElementById('sprout-amazon-suggestion-expander')?.shadowRoot
    const footer = root?.querySelector('footer')?.getBoundingClientRect()
    const rows = [...(root?.querySelectorAll('li') ?? [])]
    const covered = rows.filter((row) => {
      const rect = row.getBoundingClientRect()
      if (!footer || rect.height < 4) return false
      const overlapHeight = Math.min(rect.bottom, footer.bottom) - Math.max(rect.top, footer.top)
      return overlapHeight > 4
    }).length
    return covered
  })
  if (overlap > 0) throw new Error(`On-page footer covers ${overlap} result rows`)
  console.log('on-page footer does not cover rows')
  const pillTable = context.waitForEvent('page')
  await amazonPage.getByRole('button', { name: 'Table' }).click()
  const tableFromPill = await pillTable
  await tableFromPill.waitForURL(/\/src\/viewer\/index\.html/)
  console.log('table from on-page panel', tableFromPill.url())
  await tableFromPill.close()
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

  await page.bringToFront()
  await page.getByRole('tab', { name: 'Results' }).click()
  await openMarkets(page)
  await page.locator('label', { hasText: 'IN · amazon.in' }).locator('input').check()
  await page.locator('label', { hasText: 'US · amazon.com' }).locator('input').uncheck()
  await page.locator('label', { hasText: 'DE · amazon.de' }).locator('input').uncheck()
  await page.getByRole('button', { name: /IN · amazon\.in/ }).waitFor()
  const space = page.getByRole('switch', { name: 'Insert a space before the extra letter' })
  if (await space.getAttribute('aria-checked') === 'true') await space.click()
  await page.getByLabel('Department').selectOption('aps')
  await seed.fill('yoga mat')
  await page.getByRole('button', { name: 'Expand', exact: true }).click()
  await page.getByRole('button', { name: 'Stop' }).waitFor({ timeout: 10000 })
  await waitForResults(page, 'amazon.in')

  await openMarkets(page)
  await page.locator('label', { hasText: 'US · amazon.com' }).locator('input').check()
  await page.locator('label', { hasText: 'IN · amazon.in' }).locator('input').uncheck()
  await page.getByLabel('Department').selectOption('stripbooks')
  await page.getByRole('switch', { name: 'KDP books mode' }).click()
  await seed.fill('yoga')
  await page.getByRole('button', { name: 'Expand', exact: true }).click()
  await page.getByRole('button', { name: 'Stop' }).waitFor({ timeout: 10000 })
  await waitForResults(page, 'books')
  await page.getByRole('tab', { name: 'KDP' }).click()
  await page.getByText('/50').first().waitFor()
  await shot(page, 'sprout-kdp-books.png')
  console.log('browser check passed')
} finally {
  await context.close()
}

async function openMarkets(page) {
  const button = page.locator('button[aria-expanded]')
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click()
}

async function shot(page, name) {
  const target = `/opt/cursor/artifacts/${name}`
  await page.screenshot({ path: target })
  copyFileSync(target, path.join(root, 'docs', name))
}

async function waitForResults(page, label) {
  await page.waitForFunction(() => {
    const text = document.body.innerText
    const stop = [...document.querySelectorAll('button')].some((button) => button.textContent?.trim() === 'Stop')
    const count = text.match(/(\d+) keywords/)
    const failed = /Couldn’t load suggestions|internal error|unexpected error/i.test(text)
    return failed || (!stop && count != null && Number(count[1]) > 0)
  }, undefined, { timeout: 180000 })
  const text = await page.locator('body').innerText()
  if (/Couldn’t load suggestions|internal error|unexpected error/i.test(text)) {
    throw new Error(`${label} expand failed:\n${text.slice(0, 900)}`)
  }
  console.log(label, 'keywords', text.match(/(\d+) keywords/)?.[1])
}
