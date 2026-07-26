import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { WorkspaceService } from '../src/main/workspace.ts';
import { CheckpointService } from '../src/main/checkpoints.ts';

test('Git checkpoints capture diffs and restore project files',async()=>{
  const sandbox=await mkdtemp(join(tmpdir(),'foundry-git-'));
  const projectsRoot=join(sandbox,'projects');await mkdir(projectsRoot);
  const workspace=new WorkspaceService(join(sandbox,'projects.json'));
  const checkpoints=new CheckpointService();
  const project=await workspace.createProject(projectsRoot,'Versioned App');
  await checkpoints.ensure(project);
  const initial=(await checkpoints.list(project))[0];
  assert.equal(initial.message,'Initial project');
  await workspace.writeText(project,'src/main.tsx','export const version = 2;\n');
  const diff=await checkpoints.diff(project,initial.oid);
  assert.equal(diff.files[0].path,'src/main.tsx');
  assert.equal(diff.files[0].status,'modified');
  assert.match(diff.files[0].patch,/version = 2/);
  const changed=await checkpoints.create(project,'Version two');
  assert.notEqual(changed.oid,initial.oid);
  await workspace.writeText(project,'src/main.tsx','export const version = 3;\n');
  await checkpoints.restore(project,initial.oid);
  const restored=await readFile(join(project.root,'src','main.tsx'),'utf8');
  assert.match(restored,/Versioned App/);
  const history=await checkpoints.list(project);
  assert.ok(history.some(item=>item.message==='Automatic backup before restore'));
  assert.ok(history.some(item=>item.oid===changed.oid));
});

test('checkpoint ids must belong to the registered history',async()=>{
  const sandbox=await mkdtemp(join(tmpdir(),'foundry-git-guard-'));
  const projectsRoot=join(sandbox,'projects');await mkdir(projectsRoot);
  const workspace=new WorkspaceService(join(sandbox,'projects.json'));
  const checkpoints=new CheckpointService();
  const project=await workspace.createProject(projectsRoot,'Guarded App');
  await checkpoints.ensure(project);
  await assert.rejects(checkpoints.restore(project,'not-an-oid'),/Invalid checkpoint/);
  await assert.rejects(checkpoints.restore(project,'a'.repeat(40)),/not registered/);
});
