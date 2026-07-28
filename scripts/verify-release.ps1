param(
  [Parameter(Mandatory=$true)][string]$ReleaseDirectory,
  [switch]$RequireSigned
)
$ErrorActionPreference='Stop'
$root=(Resolve-Path -LiteralPath $ReleaseDirectory).Path
$installer=@(Get-ChildItem -LiteralPath $root -Filter 'Foundry-Setup-*.exe' -File)
if($installer.Count -ne 1){throw "Expected exactly one Foundry installer in $root; found $($installer.Count)."}
$installer=$installer[0]
$blockmap="$($installer.FullName).blockmap"
$checksum="$($installer.FullName).sha256"
$latest=Join-Path $root 'latest.yml'
foreach($path in @($blockmap,$checksum,$latest)){if(-not(Test-Path -LiteralPath $path -PathType Leaf)){throw "Missing release artifact: $path"}}
$expected=((Get-Content -LiteralPath $checksum -Raw).Trim() -split '\s+')[0]
$actual=(Get-FileHash -LiteralPath $installer.FullName -Algorithm SHA256).Hash
if($expected -ne $actual){throw 'Installer SHA-256 checksum does not match.'}
$metadata=Get-Content -LiteralPath $latest -Raw
if($metadata -notmatch [regex]::Escape($installer.Name)){throw 'latest.yml does not reference the generated installer.'}
$signature=Get-AuthenticodeSignature -LiteralPath $installer.FullName
if($RequireSigned -and $signature.Status -ne 'Valid'){throw "A valid Authenticode signature is required; status is $($signature.Status)."}
[pscustomobject]@{Installer=$installer.Name;Bytes=$installer.Length;SHA256=$actual;Signature=$signature.Status.ToString()} | Format-List
