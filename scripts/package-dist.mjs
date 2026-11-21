import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const release = path.join(root, 'release')
const folder = path.join(release, 'amazon-suggestion-expander')
rmSync(release, { recursive: true, force: true })
mkdirSync(folder, { recursive: true })
cpSync(path.join(root, 'dist'), folder, { recursive: true })
execFileSync('zip', ['-r', 'amazon-suggestion-expander-dist.zip', 'amazon-suggestion-expander'], {
  cwd: release,
  stdio: 'inherit',
})
console.log(path.join(release, 'amazon-suggestion-expander-dist.zip'))
