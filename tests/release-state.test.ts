import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {ReleaseStateService} from '../src/main/release-state.ts';
import type {ProjectRecord} from '../src/main/workspace.ts';
import type {QualificationResult} from '../src/main/release-qualification.ts';

const project=(root:string,id='project-a'):ProjectRecord=>({id,name:id,root,createdAt:new Date(0).toISOString(),updatedAt:new Date(0).toISOString()});
const result=(installerPath?:string):QualificationResult=>({id:'qualification-1',passed:true,startedAt:'2026-08-03T10:00:00.000Z',completedAt:'2026-08-03T10:01:00.000Z',checks:[{stage:'verify',passed:true,detail:'Workflow passed.'},{stage:'launch',passed:true,detail:'Installed app stayed healthy.'}],...(installerPath?{installerPath}:{})});

test('release state survives a new service instance and reports artifact availability',async()=>{
  const root=await mkdtemp(join(tmpdir(),'foundry-release-state-')),artifact=join(root,'App Setup.exe'),record=project(root);
  await writeFile(artifact,'installer');
  const saved=await new ReleaseStateService().save(record,result(artifact));
  assert.equal(saved.installerAvailable,true);
  const loaded=await new ReleaseStateService().get(record);
  assert.equal(loaded?.result.id,'qualification-1');
  assert.equal(loaded?.installerAvailable,true);
  assert.equal(JSON.parse(await readFile(join(root,'.foundry','release-state.json'),'utf8')).schemaVersion,1);
  await new ReleaseStateService().save(record,{...result(artifact),id:'qualification-2'});
  assert.equal((await new ReleaseStateService().get(record))?.result.id,'qualification-2');
});

test('release state is isolated per project and missing artifacts are recalculated',async()=>{
  const root=await mkdtemp(join(tmpdir(),'foundry-release-isolation-')),first=project(join(root,'first'),'first'),second=project(join(root,'second'),'second');
  await mkdir(first.root);await mkdir(second.root);
  await new ReleaseStateService().save(first,result(join(root,'missing.exe')));
  assert.equal((await new ReleaseStateService().get(first))?.installerAvailable,false);
  assert.equal(await new ReleaseStateService().get(second),null);
});

test('corrupt, oversized, and structurally invalid release records fail closed',async()=>{
  const root=await mkdtemp(join(tmpdir(),'foundry-release-invalid-')),record=project(root),directory=join(root,'.foundry'),target=join(directory,'release-state.json');
  await mkdir(directory);
  await writeFile(target,'not json');assert.equal(await new ReleaseStateService().get(record),null);
  await writeFile(target,'x'.repeat(128_001));assert.equal(await new ReleaseStateService().get(record),null);
  await writeFile(target,JSON.stringify({schemaVersion:1,recordedAt:'today',result:{}}));assert.equal(await new ReleaseStateService().get(record),null);
});
