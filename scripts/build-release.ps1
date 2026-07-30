param(
  [string]$OutputDirectory=(Join-Path $env:TEMP 'Foundry Release'),
  [string]$UpdateUrl=$env:FOUNDRY_UPDATE_URL
)
$ErrorActionPreference='Stop'
if(-not $UpdateUrl){throw 'Set FOUNDRY_UPDATE_URL or pass -UpdateUrl with the HTTPS release asset folder.'}
$bundledNode=Join-Path $PSScriptRoot '..\.tools\node-v24.18.0-win-x64'
if(Test-Path (Join-Path $bundledNode 'npm.cmd')){$env:Path="$bundledNode;$env:Path"}
if(-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)){throw 'Node.js and npm 10 or newer are required to build a release.'}
$env:NODE_OPTIONS='--use-system-ca'
npm.cmd run build
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
npx.cmd electron-builder --win nsis --x64 --publish never "--config.directories.output=$OutputDirectory" '--config.publish.provider=generic' "--config.publish.url=$UpdateUrl"
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
$installer=Get-ChildItem -LiteralPath $OutputDirectory -Filter 'Foundry-Setup-*.exe' -File | Select-Object -First 1
if(-not $installer){throw 'The Windows installer was not produced.'}
$hash=(Get-FileHash -Algorithm SHA256 -LiteralPath $installer.FullName).Hash
Set-Content -LiteralPath "$($installer.FullName).sha256" -Value "$hash  $($installer.Name)" -Encoding ascii
node (Join-Path $PSScriptRoot 'generate-release-audit.mjs') $OutputDirectory
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'verify-release.ps1') -ReleaseDirectory $OutputDirectory
exit $LASTEXITCODE
