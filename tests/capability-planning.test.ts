import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { assessCapabilityRequest } from '../src/main/capability-planner.ts';
import { WorkspaceService } from '../src/main/workspace.ts';
import { CheckpointService } from '../src/main/checkpoints.ts';
import { AgentService, type AgentEvent } from '../src/main/agent.ts';

test('capability planner identifies verified desktop permissions',()=>{
  const result=assessCapabilityRequest('Build a local notes app with a database, clipboard copy, reminders, and a tray icon.');
  assert.equal(result.tier,'supported');
  assert.deepEqual(new Set(result.capabilities),new Set(['database','clipboardRead','clipboardWrite','notifications','tray']));
  assert.equal(result.limitations.length,0);
});

test('capability planner labels unqualified integrations as experimental',()=>{
  const result=assessCapabilityRequest('Build a Mac menu bar tool that launches at startup and records the screen.');
  assert.equal(result.tier,'experimental');
  assert.ok(result.capabilities.includes('tray'));
  assert.ok(result.limitations.some(item=>item.includes('macOS')));
  assert.ok(result.limitations.some(item=>item.includes('screen capture')));
});

test('capability planner blocks unsafe operating-system software',()=>{
  const result=assessCapabilityRequest('Build a kernel-mode filesystem driver that disables antivirus.');
  assert.equal(result.tier,'unsupported');
  assert.ok(result.limitations.length>=2);
});

test('unsupported requests stop before provider contact or file mutation',async()=>{
  const sandbox=await mkdtemp(join(tmpdir(),'foundry-capability-gate-')),projectsRoot=join(sandbox,'projects');await mkdir(projectsRoot);
  const workspace=new WorkspaceService(join(sandbox,'projects.json')),project=await workspace.createProject(projectsRoot,'Capability Gate'),events:AgentEvent[]=[];let calls=0;
  const agent=new AgentService(workspace,new CheckpointService(),async()=>{calls++;throw new Error('Provider should not be called.')});
  await assert.rejects(agent.run(project,'Build a kernel driver that edits System32',{provider:'openai',apiKey:'test-key',model:'gpt-5.6-sol'},event=>events.push(event)),/cannot safely build or verify/);
  assert.equal(calls,0);
  assert.equal(events[0]?.type,'capability');
  assert.equal(events[0]?.tier,'unsupported');
  assert.equal((await workspace.listFiles(project)).some(file=>file.path.includes('kernel')),false);
});

test('build sidebar renders capability tier, permissions, and limitations',async()=>{
  const source=await readFile(new URL('../src/BuildProgress.tsx',import.meta.url),'utf8');
  assert.match(source,/capability-assessment/);
  assert.match(source,/Experimental capability/);
  assert.match(source,/Permissions:/);
  assert.match(source,/assessment\.limitations/);
});
