import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { WorkspaceService } from '../src/main/workspace.ts';
import { ProjectConfigService } from '../src/main/project-config.ts';

test('project configuration persists validated identity and window settings',async()=>{
  const sandbox=await mkdtemp(join(tmpdir(),'foundry-config-')),parent=join(sandbox,'projects');await mkdir(parent);const workspace=new WorkspaceService(join(sandbox,'registry.json')),project=await workspace.createProject(parent,'Config App'),service=new ProjectConfigService(testProtector),defaults=await service.get(project);
  assert.equal(defaults.displayName,'Config App');assert.deepEqual(defaults.capabilities,{openTextFile:true,saveTextFile:true,folderRead:false,database:false,network:false,clipboardRead:false,clipboardWrite:false,notifications:false,tray:false,globalShortcuts:false});const saved=await service.save(project,{...defaults,displayName:'Configured App',version:'1.2.3',window:{...defaults.window,width:1440,height:900},capabilities:{...defaults.capabilities,database:true,notifications:true,tray:true,globalShortcuts:true}});assert.equal(saved.version,'1.2.3');assert.equal(saved.capabilities.database,true);assert.equal(saved.capabilities.notifications,true);assert.equal(saved.capabilities.tray,true);assert.equal(saved.capabilities.globalShortcuts,true);assert.equal((await service.get(project)).window.width,1440);
  const token='fapp_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN';assert.equal(defaults.ai.mode,'none');await service.saveManagedToken(project,token);assert.equal((await readFile(join(project.root,'.foundry','managed-ai.token'),'utf8')).includes(token),false);assert.match(await service.getManagedToken(project)??'',/^fapp_/);await service.clearManagedToken(project);assert.equal(await service.getManagedToken(project),null);
});

test('project configuration rejects unsafe metadata and copies icons locally',async()=>{
  const sandbox=await mkdtemp(join(tmpdir(),'foundry-config-icon-')),parent=join(sandbox,'projects');await mkdir(parent);const workspace=new WorkspaceService(join(sandbox,'registry.json')),project=await workspace.createProject(parent,'Icon App'),service=new ProjectConfigService(),defaults=await service.get(project);
  await assert.rejects(service.save(project,{...defaults,version:'version one'}),/semantic versioning/);await assert.rejects(service.save(project,{...defaults,appId:'not valid'}),/reverse-domain/);
  const icon=join(sandbox,'icon.png');await writeFile(icon,Buffer.from([137,80,78,71]));const configured=await service.setIcon(project,icon);assert.equal(configured.icon,'.foundry/app-icon.png');
});

test('legacy plaintext managed tokens migrate to encrypted storage',async()=>{const sandbox=await mkdtemp(join(tmpdir(),'foundry-config-migrate-token-')),parent=join(sandbox,'projects');await mkdir(parent);const workspace=new WorkspaceService(join(sandbox,'registry.json')),project=await workspace.createProject(parent,'Legacy Token App'),service=new ProjectConfigService(testProtector),token='fapp_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN',file=join(project.root,'.foundry','managed-ai.token');await writeFile(file,token);assert.equal(await service.getManagedToken(project),token);assert.equal((await readFile(file,'utf8')).includes(token),false)});

const testProtector={encrypt:async(value:string)=>Buffer.from(value.split('').reverse().join('')).toString('base64'),decrypt:async(value:string)=>Buffer.from(value,'base64').toString().split('').reverse().join('')};

test('native capabilities used by generated source are enabled automatically',async()=>{
  const sandbox=await mkdtemp(join(tmpdir(),'foundry-config-native-')),parent=join(sandbox,'projects');await mkdir(parent);const workspace=new WorkspaceService(join(sandbox,'registry.json')),project=await workspace.createProject(parent,'Native App'),service=new ProjectConfigService();
  await writeFile(join(project.root,'src','main.tsx'),`fetch('https://example.com/data'); window.foundryDesktop.readClipboardText(); window.foundryDesktop.writeClipboardText('hello'); window.foundryDesktop?.tray.configure('App',[]); window.foundryDesktop.shortcuts.register('Ctrl+Shift+V','show')`);
  const config=await service.reconcileNativeCapabilities(project);assert.equal(config.capabilities.network,true);assert.equal(config.capabilities.clipboardRead,true);assert.equal(config.capabilities.clipboardWrite,true);assert.equal(config.capabilities.tray,true);assert.equal(config.capabilities.globalShortcuts,true);
});
