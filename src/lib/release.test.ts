import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { EXTENSION_DESCRIPTION, EXTENSION_NAME, PROJECT } from '../project'
import { shouldShowRatePrompt } from './rate'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

test('store name and summary fit the Chrome Web Store limits', () => {
  assert.ok([...EXTENSION_NAME].length <= 75, EXTENSION_NAME)
  assert.ok([...EXTENSION_DESCRIPTION].length <= 132, String([...EXTENSION_DESCRIPTION].length))
  assert.match(EXTENSION_NAME, /Amazon keyword research/i)
  assert.match(EXTENSION_DESCRIPTION, /not affiliated with Amazon/i)
})

test('public pages use the busfyroman/sprout URL', () => {
  assert.equal(PROJECT.repoUrl, 'https://github.com/busfyroman/sprout')
  assert.equal(PROJECT.privacyUrl, 'https://busfyroman.github.io/sprout/privacy.html')
  for (const file of ['docs/privacy.html', 'README.md', 'SUBMIT.md', '.github/ISSUE_TEMPLATE/config.yml']) {
    const text = readFileSync(path.join(root, file), 'utf8')
    assert.ok(text.includes(PROJECT.repoUrl), file)
    assert.ok(text.includes(PROJECT.privacyUrl), file)
    assert.equal(text.includes('github.com/OWNER'), false, file)
  }
})

test('the rating note waits for three finished runs and stays dismissed', () => {
  assert.equal(shouldShowRatePrompt(2, false), false)
  assert.equal(shouldShowRatePrompt(3, false), true)
  assert.equal(shouldShowRatePrompt(8, true), false)
})
