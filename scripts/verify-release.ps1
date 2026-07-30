param(
  [Parameter(Mandatory=$true)][string]$ReleaseDirectory,
  [switch]$RequireSigned,
  [string]$ExpectedPublisher
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
$sha512Line=($metadata -split "`n" | Where-Object {$_ -match '^sha512:\s+'} | Select-Object -Last 1)
if(-not $sha512Line){throw 'latest.yml does not contain an installer SHA-512 digest.'}
$expectedSha512=($sha512Line -replace '^sha512:\s+','').Trim()
$actualSha512=[Convert]::ToBase64String([System.Security.Cryptography.SHA512]::Create().ComputeHash([IO.File]::ReadAllBytes($installer.FullName)))
if($expectedSha512 -ne $actualSha512){throw 'latest.yml SHA-512 digest does not match the installer.'}
$signature=Get-AuthenticodeSignature -LiteralPath $installer.FullName
if($RequireSigned){
  if($signature.Status -ne 'Valid'){throw "A valid Authenticode signature is required; status is $($signature.Status)."}
  if(-not $signature.SignerCertificate){throw 'The installer signature has no signer certificate.'}
  if(-not $signature.TimeStamperCertificate){throw 'The installer signature is missing a trusted timestamp.'}
  if([string]::IsNullOrWhiteSpace($ExpectedPublisher)){throw 'ExpectedPublisher is required when RequireSigned is enabled.'}
  if($signature.SignerCertificate.Subject -ne $ExpectedPublisher){throw "Unexpected signer. Expected '$ExpectedPublisher' but received '$($signature.SignerCertificate.Subject)'."}
}
[pscustomobject]@{Installer=$installer.Name;Bytes=$installer.Length;SHA256=$actual;SHA512=$actualSha512;Signature=$signature.Status.ToString();Signer=$signature.SignerCertificate.Subject;Timestamped=[bool]$signature.TimeStamperCertificate} | Format-List
