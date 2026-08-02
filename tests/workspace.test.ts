import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { WorkspaceService, resolveProjectPath } from '../src/main/workspace.ts';
import { transform } from 'esbuild';
import { projectTemplates } from '../src/templates.ts';

test('resolveProjectPath rejects paths outside the project',()=>{
  const root=join(tmpdir(),'foundry-root');
  assert.throws(()=>resolveProjectPath(root,'../secret.txt'),/escapes/);
  assert.throws(()=>resolveProjectPath(root,join(tmpdir(),'absolute.txt')),/relative/);
  assert.equal(resolveProjectPath(root,'src/App.tsx'),join(root,'src','App.tsx'));
});

test('workspace creates, reads, writes, lists, and audits a project',async()=>{
  const sandbox=await mkdtemp(join(tmpdir(),'foundry-workspace-'));
  const projectsRoot=join(sandbox,'projects');
  await mkdir(projectsRoot);
  const service=new WorkspaceService(join(sandbox,'state','projects.json'));
  const project=await service.createProject(projectsRoot,'Test Desktop App');
  const projects=await service.listProjects();
  assert.equal(projects[0].id,project.id);
  const files=await service.listFiles(project);
  assert.ok(files.some(file=>file.path==='src/main.tsx'));
  assert.ok(files.some(file=>file.path==='src/foundry-desktop.d.ts'));
  const desktopTypes=await service.readText(project,'src/foundry-desktop.d.ts');assert.match(desktopTypes,/ai:\{request/);assert.match(desktopTypes,/readClipboardText/);assert.match(desktopTypes,/writeClipboardText/);assert.match(desktopTypes,/showNotification/);assert.match(desktopTypes,/chooseFolder/);assert.match(desktopTypes,/database:/);assert.match(desktopTypes,/backup\(\)/);assert.match(desktopTypes,/restoreLatest\(\)/);assert.match(desktopTypes,/tray:/);assert.match(desktopTypes,/shortcuts:/);assert.match(desktopTypes,/menus:/);assert.match(desktopTypes,/deepLinks:/);
  assert.ok(files.every(file=>!file.path.startsWith('.foundry/')));
  const original=await service.readText(project,'src/main.tsx');
  assert.match(original,/Test Desktop App/);
  await service.writeText(project,'src/main.tsx','export const ready = true;\n');
  assert.equal(await readFile(join(project.root,'src','main.tsx'),'utf8'),'export const ready = true;\n');
  const activity=await service.activity(project);
  assert.equal(activity[0].type,'file.written');
  assert.equal(activity[1].type,'project.created');
  await service.record(project,'runtime.error','Renderer exited unexpectedly.');
  const diagnostics=await service.activity(project);
  assert.equal(diagnostics[0].type,'runtime.error');
  assert.equal(diagnostics[0].detail,'Renderer exited unexpectedly.');
});

test('workspace refuses unsupported and oversized writes',async()=>{
  const sandbox=await mkdtemp(join(tmpdir(),'foundry-limits-'));
  const projectsRoot=join(sandbox,'projects');
  await mkdir(projectsRoot);
  const service=new WorkspaceService(join(sandbox,'projects.json'));
  const project=await service.createProject(projectsRoot,'Limits');
  await assert.rejects(service.writeText(project,'payload.exe','nope'),/not editable/);
  await assert.rejects(service.writeText(project,'large.txt','x'.repeat(1_000_001)),/1 MB/);
  await assert.rejects(service.readText(project,'../outside.txt'),/escapes/);
});

test('workspace reads and writes supported dotfiles',async()=>{
  const sandbox=await mkdtemp(join(tmpdir(),'foundry-dotfile-')),registry=join(sandbox,'registry.json'),parent=join(sandbox,'projects');await mkdir(parent);
  const service=new WorkspaceService(registry),project=await service.createProject(parent,'Dotfiles');
  assert.equal(await service.readText(project,'.gitignore'),'.foundry/\nnode_modules/\nout/\ndist/\ndist-installer/\ntarget/\n');
  await service.writeText(project,'.gitignore','node_modules/\n');
  assert.equal(await service.readText(project,'.gitignore'),'node_modules/\n');
});

test('workflow templates include labeled controls and local persistence',async()=>{
  const sandbox=await mkdtemp(join(tmpdir(),'foundry-templates-')),parent=join(sandbox,'projects');await mkdir(parent);const service=new WorkspaceService(join(sandbox,'registry.json'));
  const tasks=await service.createProject(parent,'Task Starter','tasks'),taskSource=await service.readText(tasks,'src/main.tsx');assert.match(taskSource,/aria-label="Task name"/);assert.match(taskSource,/localStorage/);assert.match(taskSource,/Add task/);assert.match(taskSource,/filter==='All'\?true:/);
  const expenses=await service.createProject(parent,'Expense Starter','expenses'),expenseSource=await service.readText(expenses,'src/main.tsx');assert.match(expenseSource,/aria-label="Description"/);assert.match(expenseSource,/aria-label="Amount"/);assert.match(expenseSource,/Add expense/);
});

test('every starter app compiles as a desktop-ready React entry point',async()=>{const sandbox=await mkdtemp(join(tmpdir(),'foundry-template-corpus-')),parent=join(sandbox,'projects');await mkdir(parent);const service=new WorkspaceService(join(sandbox,'registry.json'));for(const template of projectTemplates){const project=await service.createProject(parent,`${template.name} Corpus`,template.id),source=await service.readText(project,'src/main.tsx'),result=await transform(source,{loader:'tsx',jsx:'automatic',format:'esm',target:'es2022'});assert.ok(result.code.length>0,`${template.name} did not compile`);assert.match(source,/ReactDOM\.createRoot/);assert.match(source,/localStorage|foundryDesktop|custom app|dashboard/i)}});
