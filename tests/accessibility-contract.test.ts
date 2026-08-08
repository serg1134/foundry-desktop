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

test('the design token layer is loaded first and defines the shared visual contract',async()=>{
  const entry=await readFile(new URL('../src/main.tsx',import.meta.url),'utf8');
  const tokens=await readFile(new URL('../src/tokens.css',import.meta.url),'utf8');
  assert.ok(entry.indexOf("'./tokens.css'")<entry.indexOf("'../styles.css'"));
  for(const token of ['--color-bg','--color-surface','--color-text','--color-brand','--color-accent','--radius-md','--shadow-md','--duration-normal','--focus-ring'])assert.match(tokens,new RegExp(token));
  assert.match(tokens,/\.light-shell/);
});

test('project dialogs keep a stable, responsive, motion-safe layout',async()=>{
  const theme=await readFile(new URL('../src/forge-theme.css',import.meta.url),'utf8');
  assert.match(theme,/\.project-modal\{/);
  assert.match(theme,/scrollbar-gutter:stable/);
  assert.match(theme,/@media\(max-width:760px\)/);
  assert.match(theme,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(theme,/\.light-shell \.project-modal/);
});

test('the first-run tour covers the complete desktop build journey and can be replayed',async()=>{
  const source=await readFile(new URL('../src/App.tsx',import.meta.url),'utf8');
  const theme=await readFile(new URL('../src/forge-theme.css',import.meta.url),'utf8');
  for(const step of ['prompt','preview','verify','configure','export'])assert.match(source,new RegExp(`id:'${step}'`));
  assert.match(source,/foundry\.guided-tour\.v1/);
  assert.match(source,/label:'Guided Tour'/);
  assert.match(source,/role="dialog" aria-modal="false" aria-labelledby="guided-tour-title"/);
  assert.match(source,/aria-label="Skip guided tour"/);
  assert.match(theme,/\.guided-tour\{/);
  assert.match(theme,/@media\(max-width:760px\)/);
  assert.match(theme,/@media\(prefers-reduced-motion:reduce\)/);
});

test('the empty preview becomes a branded, motion-safe app-forging scene',async()=>{
  const preview=await readFile(new URL('../src/preview.css',import.meta.url),'utf8');
  assert.match(preview,/App Forging/);
  assert.match(preview,/Forging your desktop app/);
  assert.match(preview,/BLUEPRINT\s+·\s+INTERFACE\s+·\s+BEHAVIOR\s+·\s+TESTING\s+·\s+READY/);
  assert.match(preview,/@keyframes forge-blueprint/);
  assert.match(preview,/\.light-shell \.preview-state:has\(\.preview-spinner\)/);
  assert.match(preview,/@media\(prefers-reduced-motion:reduce\)/);
});

test('landing and studio share one appearance-toggle visual contract',async()=>{
  const theme=await readFile(new URL('../src/forge-theme.css',import.meta.url),'utf8');
  assert.match(theme,/\.appearance-toggle,\.home-topbar \.icon-button/);
  assert.match(theme,/\.app-shell\.light-shell \.appearance-toggle:before,\.home-shell\.light-shell \.home-topbar \.icon-button:before/);
  assert.match(theme,/\.app-shell:not\(\.light-shell\) \.appearance-toggle:before,\.home-shell:not\(\.light-shell\) \.home-topbar \.icon-button:before/);
  assert.match(theme,/\.appearance-toggle:focus-visible,\.home-topbar \.icon-button:focus-visible/);
});

test('the primary studio action runs the guarded Test & Ship pipeline',async()=>{
  const source=await readFile(new URL('../src/App.tsx',import.meta.url),'utf8');
  const theme=await readFile(new URL('../src/forge-theme.css',import.meta.url),'utf8');
  assert.match(source,/Test & Ship: verifying the real app workflow/);
  assert.match(source,/verificationFailed/);
  assert.match(source,/attempting one safe repair/);
  assert.match(source,/rerunning every release check after repair/);
  assert.match(source,/automatic release repair timed out after 150 seconds/);
  assert.match(source,/agent\.cancel\(\)/);
  assert.match(source,/result\.passed&&result\.installerPath/);
  assert.match(theme,/content:"Test & Ship"/);
});

test('each project opens into a complete Project Command Center',async()=>{
  const source=await readFile(new URL('../src/App.tsx',import.meta.url),'utf8');
  const theme=await readFile(new URL('../src/forge-theme.css',import.meta.url),'utf8');
  for(const section of ['PROJECT COMMAND CENTER','LIVE APP','APP HEALTH','IDENTITY','CAPABILITIES','HISTORY','RELEASE TARGETS'])assert.match(source,new RegExp(section));
  assert.match(source,/title="Project dashboard preview"/);
  assert.match(source,/Run Test & Ship/);
  assert.match(source,/view==='overview'/);
  assert.match(theme,/\.command-center\{/);
  assert.match(theme,/\.command-center-shell\.light-shell/);
  assert.match(theme,/@media\(max-width:620px\)/);
});
