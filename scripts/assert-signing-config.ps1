param(
  [Parameter(Mandatory=$true)][string]$ApiToken,
  [Parameter(Mandatory=$true)][string]$OrganizationId,
  [Parameter(Mandatory=$true)][string]$ProjectSlug,
  [Parameter(Mandatory=$true)][string]$SigningPolicySlug,
  [Parameter(Mandatory=$true)][string]$ArtifactConfigurationSlug,
  [Parameter(Mandatory=$true)][string]$ExpectedPublisher
)
$ErrorActionPreference='Stop'
$values=[ordered]@{SIGNPATH_API_TOKEN=$ApiToken;SIGNPATH_ORGANIZATION_ID=$OrganizationId;SIGNPATH_PROJECT_SLUG=$ProjectSlug;SIGNPATH_SIGNING_POLICY_SLUG=$SigningPolicySlug;SIGNPATH_ARTIFACT_CONFIGURATION_SLUG=$ArtifactConfigurationSlug;SIGNPATH_EXPECTED_PUBLISHER=$ExpectedPublisher}
foreach($entry in $values.GetEnumerator()){if([string]::IsNullOrWhiteSpace([string]$entry.Value)){throw "Release signing is not configured: $($entry.Key) is missing."}}
if($ExpectedPublisher -notmatch '^CN='){throw 'SIGNPATH_EXPECTED_PUBLISHER must be the complete certificate subject beginning with CN=.'}
Write-Host 'SignPath release configuration is complete.'
