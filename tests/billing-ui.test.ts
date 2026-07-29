import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('successful cloud billing actions clear stale errors',async()=>{
  const source=await readFile(new URL('../src/App.tsx',import.meta.url),'utf8');
  const refresh=source.match(/async function refreshCloud\(\).*?async function buyCredits/s)?.[0]??'';
  const checkout=source.match(/async function buyCredits\(.*?async function runBenchmark/s)?.[0]??'';

  assert.match(refresh,/setCloudPackages\(packages\);setError\(''\)/);
  assert.match(checkout,/startingCredits=settings\.hosted\.credits;setError\(''\);try/);
  assert.match(checkout,/if\(next\.hosted\.credits>startingCredits\).*?setError\(''\);setNotice/s);
});
