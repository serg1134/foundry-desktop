import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const [, , outputArgument = 'release'] = process.argv
const outputDirectory = path.resolve(outputArgument)
const root = path.resolve(import.meta.dirname, '..')
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'))
const packages = Object.entries(lock.packages ?? {})
  .filter(([location]) => location.startsWith('node_modules/'))
  .map(([location, value]) => ({
    name: value.name ?? location.slice('node_modules/'.length),
    version: value.version ?? 'unknown',
    license: value.license ?? 'UNKNOWN',
    resolved: value.resolved ?? null,
    integrity: value.integrity ?? null,
    development: Boolean(value.dev),
    optional: Boolean(value.optional),
  }))
  .sort((left, right) => `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`))

const forbidden = /^(?:AGPL|GPL)(?:-|$)/i
const unknown = packages.filter(item => item.license === 'UNKNOWN')
const blocked = packages.filter(item => forbidden.test(item.license))
if (blocked.length) throw new Error(`Release blocked by dependency license: ${blocked.map(item => `${item.name}@${item.version} (${item.license})`).join(', ')}`)

const lockBytes = await readFile(path.join(root, 'package-lock.json'))
const report = {
  schemaVersion: 1,
  product: { name: packageJson.productName ?? packageJson.name, version: packageJson.version },
  generatedAt: new Date().toISOString(),
  packageLockSha256: createHash('sha256').update(lockBytes).digest('hex').toUpperCase(),
  policy: { forbiddenLicensePattern: forbidden.source, unknownLicensesRequireReview: true },
  summary: { total: packages.length, production: packages.filter(item => !item.development).length, unknownLicenses: unknown.length },
  packages,
}
await writeFile(path.join(outputDirectory, 'dependency-audit.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(`Dependency audit written for ${packages.length} packages (${unknown.length} require manual license review).`)
