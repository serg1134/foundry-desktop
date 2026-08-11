$ErrorActionPreference='Stop'
$required=@(
  'AZURE_CLIENT_ID',
  'AZURE_TENANT_ID',
  'AZURE_SUBSCRIPTION_ID',
  'AZURE_ARTIFACT_SIGNING_ENDPOINT',
  'AZURE_ARTIFACT_SIGNING_ACCOUNT',
  'AZURE_ARTIFACT_SIGNING_PROFILE',
  'AZURE_EXPECTED_PUBLISHER'
)
foreach($name in $required){
  $value=[Environment]::GetEnvironmentVariable($name)
  if([string]::IsNullOrWhiteSpace($value)){throw "Artifact Signing is enabled but $name is missing."}
}
if($env:AZURE_ARTIFACT_SIGNING_ENDPOINT -notmatch '^https://[a-z0-9.-]+\.codesigning\.azure\.net/$'){
  throw 'AZURE_ARTIFACT_SIGNING_ENDPOINT must be an HTTPS Azure Artifact Signing endpoint ending in codesigning.azure.net/.'
}
if($env:AZURE_EXPECTED_PUBLISHER -notmatch '^CN='){
  throw 'AZURE_EXPECTED_PUBLISHER must be the complete certificate subject beginning with CN=.'
}
Write-Host 'Azure Artifact Signing release configuration is complete.'
