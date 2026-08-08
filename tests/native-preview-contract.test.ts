import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

test('preview runtime verifies native menu and deep-link registration',async()=>{
  const main=await readFile(new URL('../src/main/index.ts',import.meta.url),'utf8');
  const preload=await readFile(new URL('../src/preload/runtime.ts',import.meta.url),'utf8');
  assert.match(main,/desktop:menu-configure/);
  assert.match(main,/requireRuntimeCapability\(event,'menus'\)/);
  assert.match(main,/runtimeMenus\.has\(project\.id\)/);
  assert.match(main,/desktop:deep-link-ready/);
  assert.match(main,/requireRuntimeCapability\(event,'deepLinks'\)/);
  assert.match(main,/runtimeDeepLinks\.has\(project\.id\)/);
  assert.match(main,/foundryDesktop\.database\.list\('__foundry_verification__'\)/);
  assert.match(main,/verificationDatabases\.has\(verificationWindow\.webContents\.id\)/);
  assert.match(main,/runtimeNotifications\.has\(project\.id\)/);
  assert.match(main,/runtimeTrays\.has\(project\.id\)/);
  assert.match(main,/runtimeShortcuts\.get\(project\.id\)/);
  assert.match(preload,/desktop:deep-link-ready/);
});

test('isolated database verification closes its renderer before retrying cleanup',async()=>{
  const source=await readFile(new URL('../src/main/index.ts',import.meta.url),'utf8');
  assert.match(source,/verificationWindow\.destroy\(\);await clearVerificationDatabase/);
  assert.match(source,/maxRetries:6,retryDelay:100/);
});

test('Electron main uses CommonJS output so generated template strings are never rewritten by ESM shims',async()=>{
  const root=resolve(import.meta.dirname,'..'),config=await readFile(resolve(root,'electron.vite.config.ts'),'utf8'),pkg=JSON.parse(await readFile(resolve(root,'package.json'),'utf8')) as {main:string};
  assert.match(config,/main:\{[^\n]+output:\{format:'cjs',entryFileNames:'\[name\]\.cjs'/);assert.equal(pkg.main,'out/main/index.cjs');
});
