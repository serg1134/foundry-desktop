import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { WorkspaceService, resolveProjectPath } from '../src/main/workspace.ts';
import { CheckpointService } from '../src/main/checkpoints.ts';
import { AgentService } from '../src/main/agent.ts';

async function fixture(name:string){
  const sandbox=await mkdtemp(join(tmpdir(),`foundry-security-${name}-`));
  const projectsRoot=join(sandbox,'projects');
  await mkdir(projectsRoot);
  const workspace=new WorkspaceService(join(sandbox,'registry.json'));
  const project=await workspace.createProject(projectsRoot,'Security App');
  return{sandbox,workspace,project};
}

test('project path containment rejects traversal and absolute-path variants',()=>{
  const root=join(tmpdir(),'foundry-containment-root');
  const attacks=[
    '../secret.txt',
    '..\\secret.txt',
    'src/../../secret.txt',
    'src\\..\\..\\secret.txt',
    join(tmpdir(),'absolute-secret.txt'),
    '\\server\\share\\secret.txt',
    'C:\\Windows\\win.ini',
    'src/evil.txt\0ignored'
  ];
  for(const attack of attacks)assert.throws(()=>resolveProjectPath(root,attack),undefined,attack);
});

test('workspace refuses read and write through a directory link that escapes the project',async t=>{
  const{sandbox,workspace,project}=await fixture('symlink');
  const outside=join(sandbox,'outside');
  await mkdir(outside);
  await writeFile(join(outside,'secret.txt'),'do not expose','utf8');
  const linked=join(project.root,'linked');
  try{await symlink(outside,linked,process.platform==='win32'?'junction':'dir')}
  catch(error){t.skip(`Directory links are unavailable in this environment: ${String(error)}`);return}
  await assert.rejects(workspace.readText(project,'linked/secret.txt'),/Symlink escapes/);
  await assert.rejects(workspace.writeText(project,'linked/overwrite.txt','blocked'),/Symlink escapes/);
  await assert.rejects(readFile(join(outside,'overwrite.txt'),'utf8'));
});

test('workspace file discovery never follows linked directories',async t=>{
  const{sandbox,workspace,project}=await fixture('list-link');
  const outside=join(sandbox,'outside-list');
  await mkdir(outside);
  await writeFile(join(outside,'credential.txt'),'private','utf8');
  try{await symlink(outside,join(project.root,'external'),process.platform==='win32'?'junction':'dir')}
  catch(error){t.skip(`Directory links are unavailable in this environment: ${String(error)}`);return}
  const files=await workspace.listFiles(project);
  assert.equal(files.some(file=>file.path.startsWith('external/')),false);
});

test('workspace enforces the write byte limit at the exact boundary',async()=>{
  const{workspace,project}=await fixture('write-limit');
  const allowed='x'.repeat(1_000_000);
  await workspace.writeText(project,'boundary.txt',allowed);
  assert.equal((await workspace.readText(project,'boundary.txt')).length,allowed.length);
  await assert.rejects(workspace.writeText(project,'too-large.txt',`${allowed}x`),/1 MB/);
});

test('workspace rejects binary content even when it has an editable extension',async()=>{
  const{workspace,project}=await fixture('binary');
  const target=join(project.root,'src','payload.txt');
  await writeFile(target,Buffer.from([0x66,0x6f,0x00,0x6f]));
  await assert.rejects(workspace.readText(project,relative(project.root,target)),/Binary files/);
});

test('agent cannot bypass its aggregate write budget with several valid files',async()=>{
  const{workspace,project}=await fixture('agent-budget');
  const checkpoints=new CheckpointService();
  await checkpoints.ensure(project);
  const chunk='x'.repeat(700_000);
  const responses=[
    {id:'budget-1',output:[1,2,3].map(index=>({type:'function_call',call_id:`write-${index}`,name:'write_file',arguments:JSON.stringify({path:`budget-${index}.txt`,content:chunk})}))},
    {id:'budget-2',output:[{type:'message',content:[{type:'output_text',text:'Stopped at the enforced write budget.'}]}]}
  ];
  const requests:Record<string,unknown>[]=[];
  const fetcher=async(_url:string,init:RequestInit)=>{
    requests.push(JSON.parse(String(init.body)) as Record<string,unknown>);
    return new Response(JSON.stringify(responses.shift()),{status:200,headers:{'Content-Type':'application/json'}});
  };
  const result=await new AgentService(workspace,checkpoints,fetcher).run(project,'Create several large text fixtures',{provider:'openai',apiKey:'test',model:'test'});
  assert.deepEqual(result.filesChanged,['budget-1.txt','budget-2.txt']);
  await assert.rejects(readFile(join(project.root,'budget-3.txt'),'utf8'));
  assert.match(JSON.stringify(requests[1]),/Agent total write limit reached/);
});

test('agent counts parallel write calls against the per-run file limit',async()=>{
  const{workspace,project}=await fixture('agent-count');
  const checkpoints=new CheckpointService();
  await checkpoints.ensure(project);
  const responses=[
    {id:'count-1',output:Array.from({length:21},(_,index)=>({type:'function_call',call_id:`count-${index}`,name:'write_file',arguments:JSON.stringify({path:`count-${index}.txt`,content:String(index)})}))},
    {id:'count-2',output:[{type:'message',content:[{type:'output_text',text:'Stopped at the enforced file count.'}]}]}
  ];
  const requests:Record<string,unknown>[]=[];
  const fetcher=async(_url:string,init:RequestInit)=>{
    requests.push(JSON.parse(String(init.body)) as Record<string,unknown>);
    return new Response(JSON.stringify(responses.shift()),{status:200,headers:{'Content-Type':'application/json'}});
  };
  const result=await new AgentService(workspace,checkpoints,fetcher).run(project,'Create many small text fixtures',{provider:'openai',apiKey:'test',model:'test'});
  assert.equal(result.filesChanged.length,20);
  await assert.rejects(readFile(join(project.root,'count-20.txt'),'utf8'));
  assert.match(JSON.stringify(requests[1]),/Agent write limit reached/);
});
