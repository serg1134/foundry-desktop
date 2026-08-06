import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path:string)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('public beta documentation clearly describes unsigned release trust',async()=>{
  const[readme,policy,guide]=await Promise.all([read('README.md'),read('CODE_SIGNING.md'),read('docs/PUBLIC_BETA.md')]);
  assert.match(readme,/current Windows installers are unsigned/i);
  assert.match(policy,/currently distributed as an \*\*unsigned public beta\*\*/i);
  assert.match(policy,/has not approved/i);
  assert.match(guide,/Get-FileHash/);
  assert.match(guide,/SHA256/);
  assert.match(guide,/Never publish API keys/i);
  assert.doesNotMatch(readme,/Free code signing provided by/i);
});

test('tagged beta releases publish verification evidence without a dead SignPath gate',async()=>{
  const workflow=await read('.github/workflows/release.yml');
  assert.match(workflow,/Foundry-Setup-\*\.exe\.sha256/);
  assert.match(workflow,/dependency-audit\.json/);
  assert.match(workflow,/currently \*\*unsigned\*\*/i);
  assert.doesNotMatch(workflow,/signpath\/github-action/i);
  assert.doesNotMatch(workflow,/SIGNPATH_API_TOKEN/);
});

test('beta feedback paths protect private data and route vulnerabilities privately',async()=>{
  const[contributing,bugTemplate,config]=await Promise.all([read('CONTRIBUTING.md'),read('.github/ISSUE_TEMPLATE/bug_report.yml'),read('.github/ISSUE_TEMPLATE/config.yml')]);
  assert.match(contributing,/private vulnerability reporting/i);
  assert.match(bugTemplate,/I removed secrets, credentials, personal paths/i);
  assert.match(config,/security\/advisories\/new/);
});
