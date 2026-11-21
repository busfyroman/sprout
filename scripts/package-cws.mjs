import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const manifest = JSON.parse(readFileSync(path.join(dist, 'manifest.json'), 'utf8'))
const version = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version

if (manifest.version !== version) {
  throw new Error(`Manifest version ${manifest.version} does not match package.json ${version}`)
}
if (manifest.manifest_version !== 3) throw new Error('Package is not Manifest V3')
const permissions = new Set(manifest.permissions ?? [])
for (const extra of permissions) {
  if (!['storage', 'sidePanel'].includes(extra)) throw new Error(`Unexpected permission: ${extra}`)
}
const hosts = [...(manifest.host_permissions ?? []), ...(manifest.content_scripts ?? []).flatMap((script) => script.matches ?? [])]
for (const host of hosts) {
  if (!/^https:\/\/(www|completion)\.amazon\.[a-z0-9.]+\/\*$/.test(host)) {
    throw new Error(`Host permission is not a single Amazon store or completion host: ${host}`)
  }
}
const policy = manifest.content_security_policy?.extension_pages ?? ''
if (!policy.includes("script-src 'self'") || policy.includes('unsafe-eval') || policy.includes('http:')) {
  throw new Error(`CSP is not store-safe: ${policy}`)
}

const release = path.join(root, 'release')
mkdirSync(release, { recursive: true })
const zipPath = path.join(release, `sprout-${version}-cws.zip`)
rmSync(zipPath, { force: true })
execFileSync('zip', ['-r', zipPath, '.', '-x', '*.map', '-x', '*.DS_Store'], { cwd: dist, stdio: 'inherit' })

const listing = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' })
if (!listing.split('\n').includes('manifest.json')) throw new Error('CWS zip must contain manifest.json at the root')
if (listing.split('\n').some((line) => line.startsWith('dist/') || line.includes('..'))) {
  throw new Error('CWS zip contains a nested folder')
}
const packed = readFileSync(zipPath)
if (packed.includes(Buffer.from('sourceMappingURL'))) throw new Error('CWS zip contains a source map reference')
writeFileSync(path.join(release, 'cws-zip-path.txt'), `${zipPath}\n`)
console.log(zipPath)
