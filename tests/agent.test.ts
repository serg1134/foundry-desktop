import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { WorkspaceService } from '../src/main/workspace.ts';
import { CheckpointService } from '../src/main/checkpoints.ts';
import { AgentService, type AgentEvent } from '../src/main/agent.ts';

test('agent executes a bounded Responses API tool loop',async()=>{
  const sandbox=await mkdtemp(join(tmpdir(),'foundry-agent-')),projectsRoot=join(sandbox,'projects');await mkdir(projectsRoot);
  const workspace=new WorkspaceService(join(sandbox,'projects.json')),checkpoints=new CheckpointService(),project=await workspace.createProject(projectsRoot,'Agent App');await checkpoints.ensure(project);
  const responses=[
    {id:'resp_1',output:[{type:'function_call',call_id:'call_1',name:'list_files',arguments:'{}'},{type:'function_call',call_id:'call_2',name:'read_file',arguments:JSON.stringify({path:'src/main.tsx'})}]},
    {id:'resp_2',output:[{type:'function_call',call_id:'call_3',name:'write_file',arguments:JSON.stringify({path:'src/main.tsx',content:'export const agentChanged = true;\n'})}]},
    {id:'resp_3',output:[{type:'function_call',call_id:'call_4',name:'validate_project',arguments:'{}'}]},
    {id:'resp_4',output:[{type:'message',content:[{type:'output_text',text:'Updated the main entry and validated the project.'}]}]}
  ];
  const bodies:Record<string,unknown>[]=[],events:AgentEvent[]=[];let compileChecks=0;
  const mockFetch=async(_url:string,init:RequestInit)=>{bodies.push(JSON.parse(String(init.body)) as Record<string,unknown>);return new Response(JSON.stringify(responses.shift()),{status:200,headers:{'Content-Type':'application/json'}})};
  const agent=new AgentService(workspace,checkpoints,mockFetch,async()=>{compileChecks++}),result=await agent.run(project,'Update the main entry','test-key','gpt-5.6-sol',event=>events.push(event));
  assert.equal(result.message,'Updated the main entry and validated the project.');assert.deepEqual(result.filesChanged,['src/main.tsx']);assert.equal(await readFile(join(project.root,'src','main.tsx'),'utf8'),'export const agentChanged = true;\n');assert.equal(bodies.length,4);assert.equal(bodies[1].previous_response_id,'resp_1');assert.equal(compileChecks,1);assert.ok(events.some(event=>event.message==='Compile-checking the project'));assert.ok((await checkpoints.list(project)).some(item=>item.message.startsWith('Before AI:')));
});

test('agent surfaces API errors without modifying files',async()=>{
  const sandbox=await mkdtemp(join(tmpdir(),'foundry-agent-error-')),projectsRoot=join(sandbox,'projects');await mkdir(projectsRoot);
  const workspace=new WorkspaceService(join(sandbox,'projects.json')),checkpoints=new CheckpointService(),project=await workspace.createProject(projectsRoot,'Error App');await checkpoints.ensure(project);
  const mockFetch=async()=>new Response(JSON.stringify({error:{message:'Invalid API key'}}),{status:401,headers:{'Content-Type':'application/json'}});
  const agent=new AgentService(workspace,checkpoints,mockFetch);
  await assert.rejects(agent.run(project,'Change the app','bad-key','gpt-5.6-sol'),/Invalid API key/);
  assert.equal((await checkpoints.list(project)).length,1);
});
