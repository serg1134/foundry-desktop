import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('primary builder surfaces expose keyboard and dialog semantics',async()=>{
  const source=await readFile(new URL('../src/App.tsx',import.meta.url),'utf8');
  assert.match(source,/<textarea autoFocus/);
  assert.match(source,/aria-label="Start building"/);
  assert.match(source,/aria-label="Attach reference files"/);
  assert.match(source,/role="dialog" aria-modal="true" aria-labelledby="app-settings-title"/);
  assert.match(source,/id="app-settings-title"/);
  assert.match(source,/aria-label="Close app settings"/);
});

test('the visual system respects keyboard, motion, and high-contrast preferences',async()=>{
  const design=await readFile(new URL('../src/design-system.css',import.meta.url),'utf8');
  const splash=await readFile(new URL('../src/splash.css',import.meta.url),'utf8');
  assert.match(design,/:focus-visible/);
  assert.match(design,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(design,/@media\(forced-colors:active\)/);
  assert.match(splash,/@media\(prefers-reduced-motion:reduce\)/);
});
