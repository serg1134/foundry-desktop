import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { WorkspaceService } from '../src/main/workspace.ts';
import { ProjectConfigService } from '../src/main/project-config.ts';

test('project configuration persists validated identity and window settings',async()=>{
  const sandbox=await mkdtemp(join(tmpdir(),'foundry-config-')),parent=join(sandbox,'projects');await mkdir(parent);const workspace=new WorkspaceService(join(sandbox,'registry.json')),project=await workspace.createProject(parent,'Config App'),service=new ProjectConfigService(),defaults=await service.get(project);
  assert.equal(defaults.displayName,'Config App');const saved=await service.save(project,{...defaults,displayName:'Configured App',version:'1.2.3',window:{...defaults.window,width:1440,height:900}});assert.equal(saved.version,'1.2.3');assert.equal((await service.get(project)).window.width,1440);
});

test('project configuration rejects unsafe metadata and copies icons locally',async()=>{
  const sandbox=await mkdtemp(join(tmpdir(),'foundry-config-icon-')),parent=join(sandbox,'projects');await mkdir(parent);const workspace=new WorkspaceService(join(sandbox,'registry.json')),project=await workspace.createProject(parent,'Icon App'),service=new ProjectConfigService(),defaults=await service.get(project);
  await assert.rejects(service.save(project,{...defaults,version:'version one'}),/semantic versioning/);await assert.rejects(service.save(project,{...defaults,appId:'not valid'}),/reverse-domain/);
  const icon=join(sandbox,'icon.png');await writeFile(icon,Buffer.from([137,80,78,71]));const configured=await service.setIcon(project,icon);assert.equal(configured.icon,'.foundry/app-icon.png');
});
