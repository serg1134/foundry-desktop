import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path:string)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('public beta documentation clearly distinguishes existing unsigned and future signed releases',async()=>{
  const[readme,policy,guide]=await Promise.all([read('README.md'),read('CODE_SIGNING.md'),read('docs/PUBLIC_BETA.md')]);
  assert.match(readme,/previously published installers remain unsigned/i);
  assert.match(policy,/existing unsigned beta releases remain clearly labeled/i);
  assert.match(policy,/certificate profile is active/i);
  assert.match(guide,/Get-FileHash/);
  assert.match(guide,/SHA256/);
  assert.match(guide,/Never publish API keys/i);
  assert.doesNotMatch(readme,/Free code signing provided by/i);
});

test('tagged releases publish verification evidence and support gated Azure signing',async()=>{
  const workflow=await read('.github/workflows/release.yml');
  assert.match(workflow,/Foundry-Setup-\*\.exe\.sha256/);
  assert.match(workflow,/dependency-audit\.json/);
  assert.match(workflow,/currently \*\*unsigned\*\*/i);
  assert.match(workflow,/azure\/artifact-signing-action@v2/i);
  assert.match(workflow,/azure\/login@v3/i);
  assert.match(workflow,/id-token:\s*write/i);
  assert.match(workflow,/environment:\s*release-signing/i);
  assert.match(workflow,/AZURE_ARTIFACT_SIGNING_ENABLED/);
  assert.match(workflow,/finalize-signed-release\.mjs/);
  assert.match(workflow,/verify-release\.ps1[^\n]+-RequireSigned/);
  assert.doesNotMatch(workflow,/SIGNPATH_API_TOKEN/);
});

test('beta feedback paths protect private data and route vulnerabilities privately',async()=>{
  const[contributing,bugTemplate,config]=await Promise.all([read('CONTRIBUTING.md'),read('.github/ISSUE_TEMPLATE/bug_report.yml'),read('.github/ISSUE_TEMPLATE/config.yml')]);
  assert.match(contributing,/private vulnerability reporting/i);
  assert.match(bugTemplate,/I removed secrets, credentials, personal paths/i);
  assert.match(config,/security\/advisories\/new/);
});
