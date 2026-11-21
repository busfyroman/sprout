import { rmSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const dist = path.join(root, 'dist')
const profile = '/tmp/sprout-stop-check'
rmSync(profile, { recursive: true, force: true })

let hits = 0
const context = await chromium.launchPersistentContext(profile, {
  headless: false,
  viewport: { width: 1100, height: 800 },
  args: [
    `--disable-extensions-except=${dist}`,
    `--load-extension=${dist}`,
    '--no-sandbox',
    '--disable-dev-shm-usage',
  ],
})

await context.route(/https:\/\/(completion|www)\.amazon\.com\/.*suggestion.*/i, async (route) => {
  hits += 1
  await new Promise((resolve) => setTimeout(resolve, 280))
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      suggestions: [
        { value: 'yoga mat thick' },
        { value: 'yoga mat towel' },
      ],
    }),
  })
})

try {
  let worker = context.serviceWorkers()[0]
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15000 })
  const extensionId = new URL(worker.url()).host
  const viewer = context.pages()[0] ?? await context.newPage()
  await viewer.goto(`chrome-extension://${extensionId}/src/viewer/index.html`)
  await stopMidRun(viewer, 'viewer', 'yoga mat')

  const popup = await context.newPage()
  await popup.goto(`chrome-extension://${extensionId}/src/popup/index.html`)
  await stopMidRun(popup, 'popup', 'desk lamp')

  const viewerCross = await context.newPage()
  await viewerCross.goto(`chrome-extension://${extensionId}/src/viewer/index.html`)
  await viewerCross.locator('input[name="sprout-seed"]').fill('wall clock')
  await viewerCross.getByRole('button', { name: 'Expand', exact: true }).click()
  await viewerCross.waitForFunction(() => {
    const text = document.body.innerText
    const progress = text.match(/(\d+)\/37/)
    return Boolean(progress && Number(progress[1]) > 0 && text.includes('yoga mat thick'))
  }, undefined, { timeout: 20000 })
  const popupCross = await context.newPage()
  await popupCross.goto(`chrome-extension://${extensionId}/src/popup/index.html`)
  await popupCross.getByRole('button', { name: 'Stop' }).waitFor({ timeout: 10000 })
  const beforeCross = hits
  await popupCross.getByRole('button', { name: 'Stop' }).click()
  await viewerCross.getByText(/^Stopped\./).waitFor({ timeout: 5000 })
  const thick = await viewerCross.locator('text=yoga mat thick').count()
  if (!thick) {
    const sample = (await viewerCross.locator('body').innerText()).slice(0, 700)
    throw new Error(`cross-surface cleared the list:\n${sample}`)
  }
  await viewerCross.waitForTimeout(700)
  const settledCross = hits
  await viewerCross.waitForTimeout(1200)
  if (hits !== settledCross) throw new Error(`cross-surface requests continued ${settledCross} -> ${hits} (from ${beforeCross})`)
  console.log('popup stopped the viewer run')
  console.log('stop check passed')
} finally {
  await context.close()
}

async function stopMidRun(page, label, seed) {
  const before = hits
  await page.locator('input[name="sprout-seed"]').fill(seed)
  await page.getByRole('button', { name: 'Expand', exact: true }).click()
  await page.getByRole('button', { name: 'Stop' }).waitFor({ timeout: 10000 })
  await page.getByText('yoga mat thick').first().waitFor({ timeout: 20000 })
  await page.getByRole('button', { name: 'Stop' }).click()
  await page.getByText(/^Stopped\./).waitFor({ timeout: 5000 })
  await page.getByText('yoga mat thick').first().waitFor()
  await page.waitForTimeout(700)
  const settled = hits
  await page.waitForTimeout(1200)
  if (hits !== settled) {
    throw new Error(`${label} kept requesting after Stop (${settled} -> ${hits}, started at ${before})`)
  }
  if (await page.getByRole('button', { name: 'Stop' }).count()) {
    throw new Error(`${label} left the Stop button up`)
  }
  await page.getByRole('tab', { name: 'History' }).click()
  const rows = await page.locator('li').allInnerTexts()
  const stopped = rows.filter((row) => /· Stopped ·/.test(row) && row.includes(seed))
  const saved = rows.filter((row) => /· Saved ·/.test(row) && row.includes(seed))
  if (stopped.length !== 1) throw new Error(`${label} history Stopped rows: ${stopped.length} (${rows.join(' || ')})`)
  if (saved.length !== 0) throw new Error(`${label} wrote a Saved entry after Stop`)
  await page.getByRole('tab', { name: 'Results' }).click()
  console.log(label, 'stopped cleanly, requests', settled - before)
}
