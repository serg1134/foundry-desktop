import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('generated desktop runtime applies configured identity and window behavior',async()=>{
  const source=await readFile(new URL('../src/main/installer.ts',import.meta.url),'utf8');
  assert.match(source,/title:config\.displayName/);
  assert.match(source,/width:config\.window\.width/);
  assert.match(source,/height:config\.window\.height/);
  assert.match(source,/resizable:config\.window\.resizable/);
  assert.match(source,/maximizable:config\.window\.maximizable/);
  assert.match(source,/createHash\('sha256'\)/);
  assert.match(source,/preload\.cjs/);
  assert.match(source,/foundry-desktop:open-text/);
  assert.match(source,/foundry-desktop:save-text/);
  assert.match(source,/foundry-desktop:clipboard-write/);
  assert.match(source,/foundry-desktop:notification-show/);
  assert.match(source,/foundry-desktop:folder-choose/);
  assert.match(source,/foundry-desktop:database-set/);
  assert.match(source,/DatabaseSync/);
  assert.match(source,/requireCapability\('clipboardWrite'\)/);
  assert.match(source,/requireCapability\('notifications'\)/);
});
