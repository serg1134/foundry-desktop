import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { WorkspaceService } from '../src/main/workspace.ts';
import { CheckpointService } from '../src/main/checkpoints.ts';
import { AgentService, type AgentEvent } from '../src/main/agent.ts';
const credential={provider:'openai' as const,apiKey:'test-key',model:'gpt-5.6-sol'};

test('agent executes a bounded Responses API tool loop',async()=>{
  const sandbox=await mkdtemp(join(tmpdir(),'foundry-agent-')),projectsRoot=join(sandbox,'projects');await mkdir(projectsRoot);
  const workspace=new WorkspaceService(join(sandbox,'projects.json')),checkpoints=new CheckpointService(),project=await workspace.createProject(projectsRoot,'Agent App');await checkpoints.ensure(project);
  const responses=[
    {id:'resp_1',output:[{type:'function_call',call_id:'call_1',name:'list_files',arguments:'{}'},{type:'function_call',call_id:'call_2',name:'read_file',arguments:JSON.stringify({path:'src/main.tsx'})}]},
    {id:'resp_2',output:[{type:'function_call',call_id:'call_3',name:'write_file',arguments:JSON.stringify({path:'src/main.tsx',content:'export const agentChanged = true;\n'})}]},
    {id:'resp_3',output:[{type:'function_call',call_id:'call_4',name:'set_test_plan',arguments:JSON.stringify({steps:[{action:'fill',target:'Note title',value:'Release plan'},{action:'click',target:'Save note',value:''},{action:'assert_text',target:'',value:'Release plan'},{action:'assert_hover',target:'Save note',value:''},{action:'assert_persisted_text',target:'',value:'Release plan'}]})},{type:'function_call',call_id:'call_5',name:'validate_project',arguments:'{}'}]},
    {id:'resp_4',output:[{type:'message',content:[{type:'output_text',text:'Updated the main entry and validated the project.'}]}]}
  ];
  const bodies:Record<string,unknown>[]=[],events:AgentEvent[]=[];let compileChecks=0;
  const mockFetch=async(_url:string,init:RequestInit)=>{bodies.push(JSON.parse(String(init.body)) as Record<string,unknown>);return new Response(JSON.stringify(responses.shift()),{status:200,headers:{'Content-Type':'application/json'}})};
  const agent=new AgentService(workspace,checkpoints,mockFetch,async()=>{compileChecks++}),result=await agent.run(project,'Update the main entry',credential,event=>events.push(event));
  assert.equal(result.message,'Updated the main entry and validated the project.');assert.deepEqual(result.filesChanged,['src/main.tsx']);assert.deepEqual(result.workflow.map(step=>step.action),['fill','click','assert_text','assert_hover','assert_persisted_text']);assert.equal(await readFile(join(project.root,'src','main.tsx'),'utf8'),'export const agentChanged = true;\n');assert.equal(bodies.length,4);assert.equal(bodies[1].previous_response_id,'resp_1');assert.equal(compileChecks,1);assert.equal(events.filter(event=>event.type==='plan').length,4);assert.ok(events.some(event=>event.message==='Prepared 5-step workflow test'));assert.ok(events.some(event=>event.message==='Launch and verify the rendered app'));assert.ok(events.some(event=>event.message==='Compile-checking the project'));assert.ok((await checkpoints.list(project)).some(item=>item.message.startsWith('Before AI:')));
});

test('agent surfaces API errors without modifying files',async()=>{
  const sandbox=await mkdtemp(join(tmpdir(),'foundry-agent-error-')),projectsRoot=join(sandbox,'projects');await mkdir(projectsRoot);
  const workspace=new WorkspaceService(join(sandbox,'projects.json')),checkpoints=new CheckpointService(),project=await workspace.createProject(projectsRoot,'Error App');await checkpoints.ensure(project);
  const mockFetch=async()=>new Response(JSON.stringify({error:{message:'Invalid API key'}}),{status:401,headers:{'Content-Type':'application/json'}});
  const agent=new AgentService(workspace,checkpoints,mockFetch);
  await assert.rejects(agent.run(project,'Change the app',{...credential,apiKey:'bad-key'}),/Invalid API key/);
  assert.equal((await checkpoints.list(project)).length,1);
});

test('agent requests a structured screenshot review',async()=>{
  const sandbox=await mkdtemp(join(tmpdir(),'foundry-visual-')),projectsRoot=join(sandbox,'projects');await mkdir(projectsRoot);
  const workspace=new WorkspaceService(join(sandbox,'projects.json')),checkpoints=new CheckpointService(),bodies:Record<string,unknown>[]=[];
  const mockFetch=async(_url:string,init:RequestInit)=>{bodies.push(JSON.parse(String(init.body)) as Record<string,unknown>);return new Response(JSON.stringify({id:'visual_1',output:[{type:'message',content:[{type:'output_text',text:'{"passed":false,"issues":["Primary button is clipped"]}'}]}]}),{status:200,headers:{'Content-Type':'application/json'}})};
  const review=await new AgentService(workspace,checkpoints,mockFetch).reviewScreenshot('Build a timer',Buffer.from('image'),credential);
  assert.deepEqual(review,{passed:false,issues:['Primary button is clipped']});
  const input=bodies[0].input as {content:{type:string;image_url?:string}[]}[];assert.match(input[0].content[1].image_url??'',/^data:image\/png;base64,/);assert.equal((bodies[0].text as {format:{type:string}}).format.type,'json_schema');
});

test('agent stops before contacting the API when cancelled',async()=>{
  const sandbox=await mkdtemp(join(tmpdir(),'foundry-cancel-')),projectsRoot=join(sandbox,'projects');await mkdir(projectsRoot);
  const workspace=new WorkspaceService(join(sandbox,'projects.json')),checkpoints=new CheckpointService(),project=await workspace.createProject(projectsRoot,'Cancelled App');await checkpoints.ensure(project);let calls=0;
  const controller=new AbortController();controller.abort();const agent=new AgentService(workspace,checkpoints,async()=>{calls++;return new Response()});
  await assert.rejects(agent.run(project,'Change it',credential,()=>{},controller.signal),/stopped by the user/);assert.equal(calls,0);
});

test('agent sends validated image and text references with the build request',async()=>{
  const sandbox=await mkdtemp(join(tmpdir(),'foundry-attachment-')),projectsRoot=join(sandbox,'projects');await mkdir(projectsRoot);
  const workspace=new WorkspaceService(join(sandbox,'projects.json')),checkpoints=new CheckpointService(),project=await workspace.createProject(projectsRoot,'Visual App');await checkpoints.ensure(project);let body:Record<string,unknown>|undefined;
  const mockFetch=async(_url:string,init:RequestInit)=>{body=JSON.parse(String(init.body)) as Record<string,unknown>;return new Response(JSON.stringify({id:'attachment_1',output:[{type:'message',content:[{type:'output_text',text:'Used the visual reference.'}]}]}),{status:200,headers:{'Content-Type':'application/json'}})};
  await new AgentService(workspace,checkpoints,mockFetch).run(project,'Match this layout',credential,()=>{},undefined,[{name:'reference.png',kind:'image',mimeType:'image/png',dataUrl:'data:image/png;base64,aW1hZ2U='},{name:'requirements.md',kind:'text',mimeType:'text/markdown',text:'# Requirements\nUse a compact layout.'}]);
  const input=body?.input as {content:{type:string;image_url?:string;text?:string}[]}[];assert.equal(input[0].content[0].type,'input_text');assert.match(input[0].content[0].text??'',/untrusted reference material/);assert.equal(input[0].content[1].type,'input_image');assert.match(input[0].content[1].image_url??'',/^data:image\/png;base64,/);assert.equal(input[0].content[2].type,'input_text');assert.match(input[0].content[2].text??'',/<untrusted_attachment/);assert.match(input[0].content[2].text??'',/compact layout/);
});

test('agent rejects unsupported or oversized attachments before contacting the API',async()=>{
  const sandbox=await mkdtemp(join(tmpdir(),'foundry-attachment-limit-')),projectsRoot=join(sandbox,'projects');await mkdir(projectsRoot);
  const workspace=new WorkspaceService(join(sandbox,'projects.json')),checkpoints=new CheckpointService(),project=await workspace.createProject(projectsRoot,'Attachment Limits');await checkpoints.ensure(project);let calls=0;
  const agent=new AgentService(workspace,checkpoints,async()=>{calls++;return new Response()});
  await assert.rejects(agent.run(project,'Use this file',credential,()=>{},undefined,[{name:'huge.txt',kind:'text',mimeType:'text/plain',text:'x'.repeat(1_000_001)}]),/under 1 MB/);
  assert.equal(calls,0);
});

test('agent normalizes OpenAI-compatible provider tool calls',async()=>{const sandbox=await mkdtemp(join(tmpdir(),'foundry-compatible-')),projectsRoot=join(sandbox,'projects');await mkdir(projectsRoot);const workspace=new WorkspaceService(join(sandbox,'projects.json')),checkpoints=new CheckpointService(),project=await workspace.createProject(projectsRoot,'Compatible App');await checkpoints.ensure(project);const bodies:Record<string,unknown>[]=[],responses=[{id:'chat-1',choices:[{message:{content:null,tool_calls:[{id:'tool-1',type:'function',function:{name:'list_files',arguments:'{}'}}]}}]},{id:'chat-2',choices:[{message:{content:'Inspected the project.'}}]}];const mockFetch=async(url:string,init:RequestInit)=>{assert.match(url,/generativelanguage\.googleapis\.com/);bodies.push(JSON.parse(String(init.body)));return new Response(JSON.stringify(responses.shift()),{status:200,headers:{'Content-Type':'application/json'}})};const result=await new AgentService(workspace,checkpoints,mockFetch).run(project,'Inspect it',{provider:'google',apiKey:'gemini-key',model:'gemini-3.6-flash'});assert.equal(result.message,'Inspected the project.');const second=bodies[1].messages as {role:string;tool_call_id?:string}[];assert.ok(second.some(message=>message.role==='tool'&&message.tool_call_id==='tool-1'));assert.ok((bodies[0].tools as unknown[]).length>0)});

test('hosted agent routes through Foundry Cloud without exposing a provider key',async()=>{const sandbox=await mkdtemp(join(tmpdir(),'foundry-hosted-')),projectsRoot=join(sandbox,'projects');await mkdir(projectsRoot);const workspace=new WorkspaceService(join(sandbox,'projects.json')),checkpoints=new CheckpointService(),project=await workspace.createProject(projectsRoot,'Hosted App');await checkpoints.ensure(project);let captured:{url:string;authorization:string;body:Record<string,unknown>}|undefined;const mockFetch=async(url:string,init:RequestInit)=>{captured={url,authorization:String((init.headers as Record<string,string>).Authorization),body:JSON.parse(String(init.body))};return new Response(JSON.stringify({id:'hosted-1',output:[{type:'message',content:[{type:'output_text',text:'Built through Foundry Cloud.'}]}]}),{status:200,headers:{'Content-Type':'application/json'}})};const result=await new AgentService(workspace,checkpoints,mockFetch).run(project,'Build it',{provider:'openai',apiKey:'encrypted-session-token',model:'gpt-5.6-sol',mode:'hosted',gatewayUrl:'https://api.foundry.example'});assert.equal(result.message,'Built through Foundry Cloud.');assert.equal(captured?.url,'https://api.foundry.example/v1/model/request');assert.equal(captured?.authorization,'Bearer encrypted-session-token');assert.equal(captured?.body.provider,'openai');assert.match(String(captured?.body.requestId),/^model_/);assert.equal(JSON.stringify(captured?.body).includes('provider-api-key'),false)});
