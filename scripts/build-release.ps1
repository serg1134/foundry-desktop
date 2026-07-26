param([string]$OutputDirectory=(Join-Path $env:USERPROFILE 'Downloads\Foundry Release'))
$ErrorActionPreference='Stop'
if(-not $env:FOUNDRY_UPDATE_URL){throw 'Set FOUNDRY_UPDATE_URL to the HTTPS folder that will host latest.yml and the installer.'}
$node=Join-Path $PSScriptRoot '..\.tools\node-v24.18.0-win-x64'
$env:Path="$node;$env:Path"
$env:NODE_OPTIONS='--use-system-ca'
npm.cmd run build
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
npx.cmd electron-builder --win nsis --x64 --publish never "--config.directories.output=$OutputDirectory" '--config.publish.provider=generic' "--config.publish.url=$env:FOUNDRY_UPDATE_URL"
exit $LASTEXITCODE
