import { copyFileSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const dist = path.join(root, 'dist')
const shots = path.join(root, 'store', 'screenshots')
const promo = path.join(root, 'store', 'promo')
mkdirSync(shots, { recursive: true })
mkdirSync(promo, { recursive: true })
mkdirSync(path.join(root, 'store', 'icons'), { recursive: true })

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
try {
  const tile = await browser.newPage({ viewport: { width: 440, height: 280 }, deviceScaleFactor: 1 })
  await tile.goto(`file://${path.join(root, 'scripts', 'promo.html')}`)
  await tile.screenshot({ path: path.join(promo, 'small-tile-440x280.png') })
  const marquee = await browser.newPage({ viewport: { width: 1400, height: 560 }, deviceScaleFactor: 1 })
  await marquee.goto(`file://${path.join(root, 'scripts', 'promo.html')}`)
  await marquee.evaluate(() => { document.body.className = 'marquee' })
  await marquee.screenshot({ path: path.join(promo, 'marquee-1400x560.png') })
  await tile.close()
  await marquee.close()
} finally {
  await browser.close()
}

const profile = '/tmp/sprout-store-shots'
rmSync(profile, { recursive: true, force: true })
const context = await chromium.launchPersistentContext(profile, {
  headless: false,
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
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
  const page = context.pages()[0] ?? await context.newPage()
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`)
  const seed = page.locator('input[name="sprout-seed"]')
  await seed.fill('yoga mat')
  await page.waitForTimeout(500)
  const kept = await seed.inputValue()
  if (kept !== 'yoga mat') throw new Error(`Seed dropped spaces: ${JSON.stringify(kept)}`)
  const plan = await page.locator('p', { hasText: 'prefixes' }).innerText()
  if (!plan.includes('yoga mat a') || plan.includes('yoga mata')) throw new Error(`Space plan is wrong: ${plan}`)
  await page.getByRole('button', { name: 'Expand', exact: true }).click()
  await page.waitForFunction(() => {
    const text = document.body.innerText
    const stop = [...document.querySelectorAll('button')].some((button) => button.textContent?.trim() === 'Stop')
    const count = text.match(/(\d+) keywords/)
    return !stop && count != null && Number(count[1]) > 20
  }, undefined, { timeout: 180000 })
  await page.screenshot({ path: path.join(shots, '01-expand.png') })

  await page.getByRole('tab', { name: 'Words' }).click()
  await page.getByRole('heading', { name: 'Word analysis' }).waitFor()
  await page.screenshot({ path: path.join(shots, '02-words.png') })

  await page.getByRole('tab', { name: 'KDP' }).click()
  await page.getByRole('heading', { name: 'KDP keyword boxes' }).waitFor()
  await page.screenshot({ path: path.join(shots, '03-kdp.png') })

  await page.getByRole('tab', { name: 'Terms' }).click()
  await page.locator('textarea').fill('Yoga Mat thick extra long')
  await page.getByRole('heading', { name: 'Backend search terms' }).waitFor()
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(shots, '04-terms.png') })

  const table = await context.newPage()
  await table.setViewportSize({ width: 1280, height: 800 })
  await table.goto(`chrome-extension://${extensionId}/src/viewer/index.html`)
  await table.getByRole('link', { name: 'Amazon' }).first().waitFor()
  await table.screenshot({ path: path.join(shots, '05-table.png') })
  console.log('screenshots', shots)
} finally {
  await context.close()
}

for (const size of [16, 32, 48, 128]) {
  copyFileSync(path.join(root, 'src', 'assets', 'icons', `icon${size}.png`), path.join(root, 'store', 'icons', `icon${size}.png`))
}
