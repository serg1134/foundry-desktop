param(
  [string]$ReleaseDirectory = "release",
  [Parameter(Mandatory = $true)][string]$ExpectedPublisher
)

$ErrorActionPreference = "Stop"
$release = (Resolve-Path -LiteralPath $ReleaseDirectory).Path
$installer = Get-ChildItem -LiteralPath $release -Filter "Foundry-Setup-*.exe" -File | Select-Object -First 1
if (-not $installer) { throw "Foundry installer was not found in $release." }

$installRoot = Join-Path $env:RUNNER_TEMP "foundry-installed-signature-$env:GITHUB_RUN_ID"
if (Test-Path -LiteralPath $installRoot) { Remove-Item -LiteralPath $installRoot -Recurse -Force }

try {
  $process = Start-Process -FilePath $installer.FullName -ArgumentList @("/S", "/D=$installRoot") -PassThru
  if (-not $process.WaitForExit(120000)) {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    throw "Foundry installer did not finish within 120 seconds."
  }
  if ($process.ExitCode -ne 0) { throw "Foundry installer exited with code $($process.ExitCode)." }

  $application = Join-Path $installRoot "Foundry.exe"
  $uninstaller = Join-Path $installRoot "Uninstall Foundry.exe"
  foreach ($file in @($application, $uninstaller)) {
    if (-not (Test-Path -LiteralPath $file)) { throw "Installed release file is missing: $file" }
    $signature = Get-AuthenticodeSignature -LiteralPath $file
    if ($signature.Status -ne "Valid") { throw "Installed release file is not validly signed: $file ($($signature.Status))" }
    if (-not $signature.SignerCertificate -or $signature.SignerCertificate.Subject -ne $ExpectedPublisher) {
      throw "Installed release publisher mismatch for $file. Expected '$ExpectedPublisher', received '$($signature.SignerCertificate.Subject)'."
    }
    if (-not $signature.TimeStamperCertificate) { throw "Installed release file is missing a trusted timestamp: $file" }
  }

  Write-Host "Installed application and uninstaller signatures verified."
}
finally {
  $uninstaller = Join-Path $installRoot "Uninstall Foundry.exe"
  if (Test-Path -LiteralPath $uninstaller) {
    $uninstall = Start-Process -FilePath $uninstaller -ArgumentList "/S" -PassThru
    $null = $uninstall.WaitForExit(60000)
  }
  if (Test-Path -LiteralPath $installRoot) { Remove-Item -LiteralPath $installRoot -Recurse -Force -ErrorAction SilentlyContinue }
}
