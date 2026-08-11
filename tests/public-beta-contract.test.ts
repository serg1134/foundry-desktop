import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path:string)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('public beta documentation identifies signed releases and safe installation steps',async()=>{
  const[readme,policy,guide]=await Promise.all([read('README.md'),read('CODE_SIGNING.md'),read('docs/PUBLIC_BETA.md')]);
  assert.match(readme,/v0\.7\.13 and later Windows releases are Authenticode-signed/i);
  assert.match(policy,/existing unsigned beta releases remain clearly labeled/i);
  assert.match(policy,/certificate profile is active/i);
  assert.match(guide,/Get-FileHash/);
  assert.match(guide,/SHA256/);
  assert.match(guide,/Digital Signatures/i);
  assert.match(guide,/Sean Avalos/i);
  assert.match(guide,/Never publish API keys/i);
  assert.doesNotMatch(readme,/Free code signing provided by/i);
});

test('closed beta mission and feedback form cover the complete desktop journey',async()=>{
  const[mission,feedback]=await Promise.all([
    read('docs/CLOSED_BETA_TEST.md'),
    read('.github/ISSUE_TEMPLATE/beta-feedback.yml'),
  ]);
  assert.match(mission,/Test & Ship/i);
  assert.match(mission,/Start Menu/i);
  assert.match(mission,/persistence/i);
  assert.match(mission,/uninstall/i);
  for(const id of ['install','generated_app','persistence','uninstall','friction','recommend']){
    assert.match(feedback,new RegExp(`id: ${id}`));
  }
  assert.match(feedback,/Never include passwords, API keys/i);
});

test('tagged releases publish verification evidence and support gated Azure signing',async()=>{
  const[workflow,installedVerification]=await Promise.all([read('.github/workflows/release.yml'),read('scripts/verify-installed-release.ps1')]);
  assert.match(workflow,/Foundry-Setup-\*\.exe\.sha256/);
  assert.match(workflow,/dependency-audit\.json/);
  assert.match(workflow,/currently \*\*unsigned\*\*/i);
  assert.match(workflow,/azure\/artifact-signing-action@v2/i);
  assert.match(workflow,/azure\/login@v3/i);
  assert.match(workflow,/id-token:\s*write/i);
  assert.match(workflow,/environment:\s*release-signing/i);
  assert.match(workflow,/AZURE_ARTIFACT_SIGNING_ENABLED/);
  assert.match(workflow,/finalize-signed-release\.mjs/);
  assert.match(workflow,/files-folder:\s*\$\{\{ github\.workspace \}\}\\release\\win-unpacked/i);
  assert.match(workflow,/files-folder-recurse:\s*true/i);
  assert.match(workflow,/--prepackaged \$signedApp/i);
  assert.match(workflow,/azureSignOptions\.publisherName/i);
  assert.match(workflow,/azureSignOptions\.codeSigningAccountName/i);
  assert.match(workflow,/verify-installed-release\.ps1/i);
  assert.match(workflow,/verify-release\.ps1[^\n]+-RequireSigned[^\n]+-RequireSignedApplication/);
  assert.match(installedVerification,/Uninstall Foundry\.exe/i);
  assert.match(installedVerification,/Get-AuthenticodeSignature/i);
  assert.match(installedVerification,/TimeStamperCertificate/i);
  assert.doesNotMatch(workflow,/SIGNPATH_API_TOKEN/);
});

test('beta feedback paths protect private data and route vulnerabilities privately',async()=>{
  const[contributing,bugTemplate,config]=await Promise.all([read('CONTRIBUTING.md'),read('.github/ISSUE_TEMPLATE/bug_report.yml'),read('.github/ISSUE_TEMPLATE/config.yml')]);
  assert.match(contributing,/private vulnerability reporting/i);
  assert.match(bugTemplate,/I removed secrets, credentials, personal paths/i);
  assert.match(config,/security\/advisories\/new/);
});
