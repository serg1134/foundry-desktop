param(
  [Parameter(Mandatory=$true)][string]$SignedArtifactDirectory,
  [Parameter(Mandatory=$true)][string]$ReleaseDirectory
)
$ErrorActionPreference='Stop'
$version=(Get-Content (Join-Path $PSScriptRoot '..\package.json') -Raw | ConvertFrom-Json).version
$expectedName="Foundry-Setup-$version.exe"
$matches=@(Get-ChildItem -LiteralPath $SignedArtifactDirectory -Recurse -File | Where-Object Name -eq $expectedName)
if($matches.Count -ne 1){throw "Expected exactly one signed $expectedName; found $($matches.Count)."}
$releaseRoot=(Resolve-Path -LiteralPath $ReleaseDirectory).Path
$destination=Join-Path $releaseRoot $expectedName
Copy-Item -LiteralPath $matches[0].FullName -Destination $destination -Force
node (Join-Path $PSScriptRoot 'finalize-signed-release.mjs') $destination $releaseRoot
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'verify-release.ps1') -ReleaseDirectory $releaseRoot -RequireSigned
exit $LASTEXITCODE
