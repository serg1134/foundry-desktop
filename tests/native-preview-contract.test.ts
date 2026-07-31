import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('preview runtime verifies native menu and deep-link registration',async()=>{
  const main=await readFile(new URL('../src/main/index.ts',import.meta.url),'utf8');
  const preload=await readFile(new URL('../src/preload/runtime.ts',import.meta.url),'utf8');
  assert.match(main,/desktop:menu-configure/);
  assert.match(main,/requireRuntimeCapability\(event,'menus'\)/);
  assert.match(main,/runtimeMenus\.has\(project\.id\)/);
  assert.match(main,/desktop:deep-link-ready/);
  assert.match(main,/requireRuntimeCapability\(event,'deepLinks'\)/);
  assert.match(main,/runtimeDeepLinks\.has\(project\.id\)/);
  assert.match(main,/runtimeDatabases\.has\(project\.id\)/);
  assert.match(main,/runtimeNotifications\.has\(project\.id\)/);
  assert.match(main,/runtimeTrays\.has\(project\.id\)/);
  assert.match(main,/runtimeShortcuts\.get\(project\.id\)/);
  assert.match(preload,/desktop:deep-link-ready/);
});
