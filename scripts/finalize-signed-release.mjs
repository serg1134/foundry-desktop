import { createHash } from 'node:crypto'
import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { buildBlockMap } from 'app-builder-lib/out/targets/blockmap/blockmap.js'

const [, , installerArgument, releaseDirectoryArgument] = process.argv
if (!installerArgument || !releaseDirectoryArgument) {
  throw new Error('Usage: node scripts/finalize-signed-release.mjs <signed-installer> <release-directory>')
}

const installer = path.resolve(installerArgument)
const releaseDirectory = path.resolve(releaseDirectoryArgument)
const installerName = path.basename(installer)
const versionMatch = /^Foundry-Setup-(.+)\.exe$/i.exec(installerName)
if (!versionMatch) {
  throw new Error(`Unexpected installer name: ${installerName}`)
}

const destination = path.join(releaseDirectory, installerName)
if (path.normalize(installer) !== path.normalize(destination)) {
  throw new Error('The signed installer must already be copied into the release directory.')
}

const blockmap = `${destination}.blockmap`
await rm(blockmap, { force: true })
const updateInfo = await buildBlockMap(destination, 'gzip', blockmap)
const installerBytes = await readFile(destination)
const sha256 = createHash('sha256').update(installerBytes).digest('hex').toUpperCase()
const checksum = `${sha256}  ${installerName}\n`
const metadata = [
  `version: ${versionMatch[1]}`,
  'files:',
  `  - url: ${installerName}`,
  `    sha512: ${updateInfo.sha512}`,
  `    size: ${updateInfo.size}`,
  `path: ${installerName}`,
  `sha512: ${updateInfo.sha512}`,
  `releaseDate: '${new Date().toISOString()}'`,
  '',
].join('\n')

await writeFile(`${destination}.sha256`, checksum, 'ascii')
await writeFile(path.join(releaseDirectory, 'latest.yml'), metadata, 'utf8')
console.log(`Finalized signed release metadata for ${installerName}`)
