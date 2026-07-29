import { app, BrowserWindow, clipboard, dialog, globalShortcut, ipcMain, Menu, net, Notification, session, shell, Tray, type IpcMainInvokeEvent } from 'electron';
import { basename, dirname, join, relative, sep } from 'node:path';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { userInfo } from 'node:os';
import { electronApp, is, optimizer } from '@electron-toolkit/utils';
import { WorkspaceService, type ProjectRecord } from './workspace';
import type { TemplateId } from '../templates.ts';
import { CheckpointService } from './checkpoints';
import { SettingsService } from './settings';
import { AgentService, type AgentAttachment, type AgentEvent, type VerificationResult, type WorkflowStep } from './agent';
import { PreviewService } from './preview';
import { InstallerService } from './installer';
import { ProjectConfigService, type ProjectConfig } from './project-config';
import { UpdateService } from './updates';
import { destructiveControlPattern } from './verification';
import { BenchmarkService, benchmarkCases, type BenchmarkCampaign, type BenchmarkResult } from './benchmarks';
import { failedVerificationChecks, MAX_BEHAVIOR_REPAIRS, MAX_VISUAL_REPAIRS, runBehaviorRepairLoop, runVisualRepairLoop } from './reliability';
import { prepareCapabilityDatabase, type CapabilityDatabase } from './capability-database';
import { isProviderId, providerDefinition, validateProviderModel, type ProviderCredential, type ProviderId } from './providers';
import { CloudClient, resolveGatewayUrl } from './cloud-client';
import { CrashReportService, type CrashSource } from './crash-reports';
import { ReleaseQualificationService } from './release-qualification';

let workspace:WorkspaceService;
const checkpoints=new CheckpointService();
let settings:SettingsService;
let agent:AgentService;
let preview:PreviewService;
let installer:InstallerService;
let updates:UpdateService;
let benchmarks:BenchmarkService;
let benchmarkWorkspace:WorkspaceService;
let benchmarkRoot='';
let benchmarkCampaignAbort:AbortController|null=null;
const projectConfigs=new ProjectConfigService();
const runtimeWindows=new Map<string,BrowserWindow>();
const runtimeDatabases=new Map<string,CapabilityDatabase>();
const runtimeTrays=new Map<string,Tray>();
const runtimeShortcuts=new Map<string,Set<string>>();
const activeBuilds=new Map<number,AbortController>();
const reversibleBuilds=new Map<string,string>();
let foundryWindow:BrowserWindow|null=null;
let cloud:CloudClient;
let crashReports:CrashReportService;
const currentDirectory=dirname(fileURLToPath(import.meta.url));

function appIconPath():string{
  return is.dev?join(app.getAppPath(),'build','icon.png'):join(process.resourcesPath,'app-icon.png');
}

function textMime(extension:string):string{
  const types:Record<string,string>={txt:'text/plain',md:'text/markdown',csv:'text/csv',tsv:'text/tab-separated-values',json:'application/json',js:'text/javascript',jsx:'text/javascript',ts:'text/typescript',tsx:'text/typescript',css:'text/css',html:'text/html',xml:'application/xml',yaml:'application/yaml',yml:'application/yaml',toml:'application/toml',sql:'application/sql',py:'text/x-python',rs:'text/x-rust',java:'text/x-java-source',cs:'text/x-csharp',cpp:'text/x-c++src',h:'text/x-c++hdr'};
  return types[extension]||'text/plain';
}

function assertTrusted(event:IpcMainInvokeEvent):void{
  const url=event.senderFrame.url;
  const trusted=is.dev?url.startsWith('http://localhost:'):url.startsWith('file://');
  if(!trusted)throw new Error('Untrusted workspace request.');
}

async function projectById(id:unknown):Promise<ProjectRecord>{
  if(typeof id!=='string')throw new Error('A project id is required.');
  const project=(await workspace.listProjects()).find(item=>item.id===id);
  if(!project)throw new Error('Project is not registered.');
  return project;
}

async function requireRuntimeCapability(event:IpcMainInvokeEvent,capability:keyof ProjectConfig['capabilities']):Promise<ProjectRecord>{
  const entry=[...runtimeWindows.entries()].find(([,window])=>!window.isDestroyed()&&window.webContents.id===event.sender.id);if(!entry)throw new Error('Native capability requests are allowed only from a running project.');
  const project=await projectById(entry[0]),config=await projectConfigs.get(project);if(!config.capabilities[capability])throw new Error(`This app is not allowed to use ${capability}. Enable it in App settings.`);return project;
}

async function runtimeDatabase(project:ProjectRecord):Promise<CapabilityDatabase>{let database=runtimeDatabases.get(project.id);if(database)return database;database=await prepareCapabilityDatabase(join(project.root,'.foundry','runtime-data','app.sqlite'));runtimeDatabases.set(project.id,database);return database}
function clearRuntimeShortcuts(projectId:string):void{for(const accelerator of runtimeShortcuts.get(projectId)??[])globalShortcut.unregister(accelerator);runtimeShortcuts.delete(projectId)}
function clearRuntimeCapabilities(projectId:string):void{clearRuntimeShortcuts(projectId);runtimeTrays.get(projectId)?.destroy();runtimeTrays.delete(projectId);runtimeDatabases.get(projectId)?.close();runtimeDatabases.delete(projectId)}
async function folderManifest(root:string):Promise<{name:string;files:{path:string;size:number}[];truncated:boolean}>{const files:{path:string;size:number}[]=[],limit=500;let truncated=false;const walk=async(directory:string,depth:number):Promise<void>=>{if(depth>12){truncated=true;return}for(const entry of await readdir(directory,{withFileTypes:true})){if(files.length>=limit){truncated=true;return}if(entry.isSymbolicLink())continue;const absolute=join(directory,entry.name);if(entry.isDirectory())await walk(absolute,depth+1);else if(entry.isFile()){const info=await stat(absolute);files.push({path:relative(root,absolute).split(sep).join('/'),size:info.size})}}};await walk(root,0);return{name:basename(root),files,truncated}}

function registerWorkspaceHandlers():void{
  ipcMain.handle('workspace:list-projects',event=>{assertTrusted(event);return workspace.listProjects()});
  ipcMain.handle('workspace:create',async(event,name:unknown,template:unknown)=>{
    assertTrusted(event);if(typeof name!=='string')throw new Error('A project name is required.');if(typeof template!=='string')throw new Error('A project template is required.');
    const result=await dialog.showOpenDialog({title:'Choose where to create the Foundry project',properties:['openDirectory','createDirectory']});
    if(result.canceled||!result.filePaths[0])return null;
    const project=await workspace.createProject(result.filePaths[0],name,template as TemplateId);await checkpoints.ensure(project);return project;
  });
  ipcMain.handle('workspace:open',async event=>{
    assertTrusted(event);const result=await dialog.showOpenDialog({title:'Open a project',properties:['openDirectory']});
    if(result.canceled||!result.filePaths[0])return null;
    const project=await workspace.registerProject(result.filePaths[0]);await checkpoints.ensure(project);return project;
  });
  ipcMain.handle('workspace:list-files',async(event,id)=>{assertTrusted(event);return workspace.listFiles(await projectById(id))});
  ipcMain.handle('workspace:read-text',async(event,id,path)=>{assertTrusted(event);if(typeof path!=='string')throw new Error('A file path is required.');return workspace.readText(await projectById(id),path)});
  ipcMain.handle('workspace:write-text',async(event,id,path,content)=>{assertTrusted(event);if(typeof path!=='string'||typeof content!=='string')throw new Error('A text file update is required.');const project=await projectById(id);await checkpoints.create(project,`Before editing ${path}`);await workspace.writeText(project,path,content);await refreshRuntime(project);return true});
  ipcMain.handle('workspace:activity',async(event,id)=>{assertTrusted(event);return workspace.activity(await projectById(id))});
  ipcMain.handle('diagnostics:list',async(event,id)=>{assertTrusted(event);if(id!==undefined&&typeof id!=='string')throw new Error('A project id must be a string.');return crashReports.list(id)});
  ipcMain.handle('diagnostics:copy',async(event,id)=>{assertTrusted(event);if(typeof id!=='string')throw new Error('A crash report id is required.');const report=(await crashReports.list()).find(item=>item.id===id);if(!report)throw new Error('Crash report was not found.');clipboard.writeText(JSON.stringify(report,null,2));return true});
  ipcMain.handle('workspace:reveal',async(event,id)=>{assertTrusted(event);shell.showItemInFolder(join((await projectById(id)).root,'package.json'));return true});
  ipcMain.handle('checkpoint:list',async(event,id)=>{assertTrusted(event);return checkpoints.list(await projectById(id))});
  ipcMain.handle('checkpoint:create',async(event,id,message)=>{assertTrusted(event);if(typeof message!=='string')throw new Error('A checkpoint name is required.');return checkpoints.create(await projectById(id),message)});
  ipcMain.handle('checkpoint:diff',async(event,id,oid)=>{assertTrusted(event);if(typeof oid!=='string')throw new Error('A checkpoint id is required.');return checkpoints.diff(await projectById(id),oid)});
  ipcMain.handle('checkpoint:restore',async(event,id,oid)=>{assertTrusted(event);if(typeof oid!=='string')throw new Error('A checkpoint id is required.');await checkpoints.restore(await projectById(id),oid);return true});
  ipcMain.handle('settings:get',event=>{assertTrusted(event);return settings.publicSettings()});
  ipcMain.handle('settings:save-provider',async(event,provider,key,model)=>{assertTrusted(event);if(!isProviderId(provider)||typeof key!=='string')throw new Error('A valid provider and API key are required.');const selected=validateProviderModel(provider,model);await validateProviderKey({provider,apiKey:key.trim(),model:selected});return settings.saveProvider(provider,key,selected)});
  ipcMain.handle('settings:select-provider',(event,provider,model)=>{assertTrusted(event);if(!isProviderId(provider))throw new Error('Choose a valid AI provider.');return settings.selectProvider(provider,validateProviderModel(provider,model))});
  ipcMain.handle('settings:clear-provider',(event,provider)=>{assertTrusted(event);if(!isProviderId(provider))throw new Error('Choose a valid AI provider.');return settings.clearProvider(provider)});
  ipcMain.handle('settings:cloud-auth',async(event,email,password,create)=>{assertTrusted(event);if(typeof email!=='string'||typeof password!=='string')throw new Error('Email and password are required.');const result=await cloud.authenticate(email,password,Boolean(create));return settings.saveHostedSession({token:result.token,gatewayUrl:cloud.baseUrl,email:result.account.email,credits:result.account.credits})});
  ipcMain.handle('settings:use-mode',(event,mode)=>{assertTrusted(event);if(mode!=='hosted'&&mode!=='byok')throw new Error('Choose a valid builder mode.');return settings.useMode(mode)});
  ipcMain.handle('settings:cloud-logout',event=>{assertTrusted(event);return settings.clearHosted()});
  ipcMain.handle('settings:cloud-refresh',async event=>{assertTrusted(event);const access=await settings.hostedAccess(),account=await new CloudClient(access.gatewayUrl,(input,init)=>net.fetch(input,init)).account(access.token);return settings.updateHostedCredits(account.credits)});
  ipcMain.handle('settings:cloud-packages',async event=>{assertTrusted(event);const access=await settings.hostedAccess();return new CloudClient(access.gatewayUrl,(input,init)=>net.fetch(input,init)).packages(access.token)});
  ipcMain.handle('settings:cloud-checkout',async(event,packageId)=>{assertTrusted(event);if(typeof packageId!=='string')throw new Error('Choose a credit package.');const access=await settings.hostedAccess(),url=await new CloudClient(access.gatewayUrl,(input,init)=>net.fetch(input,init)).checkout(access.token,packageId);await shell.openExternal(url);return true});
  ipcMain.handle('agent:run',(event,id,prompt,attachments)=>runAgentRequest(event,id,prompt,attachments));
  ipcMain.handle('attachments:choose',async event=>{assertTrusted(event);const result=await dialog.showOpenDialog({title:'Add reference files',properties:['openFile','multiSelections'],filters:[{name:'Supported references',extensions:['png','jpg','jpeg','webp','txt','md','csv','tsv','json','js','jsx','ts','tsx','css','html','xml','yaml','yml','toml','sql','py','rs','java','cs','cpp','h']},{name:'Images',extensions:['png','jpg','jpeg','webp']},{name:'Text, code, and data',extensions:['txt','md','csv','tsv','json','js','jsx','ts','tsx','css','html','xml','yaml','yml','toml','sql','py','rs','java','cs','cpp','h']}]});if(result.canceled)return[];const items:AgentAttachment[]=[];for(const path of result.filePaths.slice(0,8)){const info=await stat(path),name=path.split(/[\\/]/).pop()||'Reference file',extension=path.split('.').pop()?.toLowerCase()||'',imageMime=extension==='png'?'image/png':extension==='webp'?'image/webp':['jpg','jpeg'].includes(extension)?'image/jpeg':'';if(imageMime){if(info.size>5_000_000)throw new Error('Each reference image must be under 5 MB.');items.push({name,kind:'image',mimeType:imageMime,dataUrl:`data:${imageMime};base64,${(await readFile(path)).toString('base64')}`})}else{if(info.size>1_000_000)throw new Error('Each text, code, or data reference must be under 1 MB.');items.push({name,kind:'text',mimeType:textMime(extension),text:await readFile(path,'utf8')})}}return items});
  ipcMain.handle('desktop-file:open-text',async event=>{assertTrusted(event);await requireRuntimeCapability(event,'openTextFile');const result=await dialog.showOpenDialog({title:'Open a text file',properties:['openFile'],filters:[{name:'Text files',extensions:['txt','md','json','csv','tsv','log']}]});if(result.canceled||!result.filePaths[0])return null;const path=result.filePaths[0],info=await stat(path);if(info.size>5_000_000)throw new Error('Choose a text file smaller than 5 MB.');return{name:path.split(/[\\/]/).pop()||'document.txt',content:await readFile(path,'utf8')}});
  ipcMain.handle('desktop-file:save-text',async(event,value)=>{assertTrusted(event);await requireRuntimeCapability(event,'saveTextFile');if(!value||typeof value.content!=='string'||value.content.length>5_000_000)throw new Error('Text content must be smaller than 5 MB.');const suggestedName=String(value.suggestedName||'document.txt').replace(/[\\/:*?"<>|]/g,'-').slice(0,120),result=await dialog.showSaveDialog({title:'Save text file',defaultPath:suggestedName,filters:[{name:'Text files',extensions:['txt','md','json','csv']}]});if(result.canceled||!result.filePath)return false;await writeFile(result.filePath,value.content,'utf8');return true});
  ipcMain.handle('desktop-folder:choose',async event=>{assertTrusted(event);await requireRuntimeCapability(event,'folderRead');const result=await dialog.showOpenDialog({title:'Choose a folder',properties:['openDirectory']});if(result.canceled||!result.filePaths[0])return null;return folderManifest(result.filePaths[0])});
  ipcMain.handle('desktop-database:get',async(event,value)=>{assertTrusted(event);const project=await requireRuntimeCapability(event,'database');return(await runtimeDatabase(project)).get(value?.namespace,value?.key)});
  ipcMain.handle('desktop-database:set',async(event,value)=>{assertTrusted(event);const project=await requireRuntimeCapability(event,'database');return(await runtimeDatabase(project)).set(value?.namespace,value?.key,value?.value)});
  ipcMain.handle('desktop-database:delete',async(event,value)=>{assertTrusted(event);const project=await requireRuntimeCapability(event,'database');return(await runtimeDatabase(project)).delete(value?.namespace,value?.key)});
  ipcMain.handle('desktop-database:list',async(event,value)=>{assertTrusted(event);const project=await requireRuntimeCapability(event,'database');return(await runtimeDatabase(project)).list(value?.namespace)});
  ipcMain.handle('desktop:clipboard-write',async(event,value)=>{assertTrusted(event);await requireRuntimeCapability(event,'clipboardWrite');if(typeof value!=='string'||value.length>100_000)throw new Error('Clipboard text must be under 100,000 characters.');clipboard.writeText(value);return true});
  ipcMain.handle('desktop:notification-show',async(event,value)=>{assertTrusted(event);const project=await requireRuntimeCapability(event,'notifications');if(!value||typeof value.title!=='string'||typeof value.body!=='string'||!value.title.trim()||value.title.length>100||value.body.length>500)throw new Error('Notification title or body is invalid.');if(!Notification.isSupported())throw new Error('Desktop notifications are not supported on this system.');new Notification({title:value.title.trim(),body:value.body,icon:appIconPath(),silent:true}).show();await workspace.record(project,'capability.notification',value.title.trim());return true});
  ipcMain.handle('desktop:tray-configure',async(event,value)=>{assertTrusted(event);const project=await requireRuntimeCapability(event,'tray'),window=runtimeWindows.get(project.id);if(!window||window.isDestroyed())throw new Error('The project window is not available.');const tooltip=String(value?.tooltip??'').trim(),items=Array.isArray(value?.items)?value.items:[];if(!tooltip||tooltip.length>100||items.length>20)throw new Error('Tray configuration is invalid.');const normalized=items.map(item=>{const id=String(item?.id??''),label=String(item?.label??'').trim();if(!/^[A-Za-z0-9._:-]{1,80}$/.test(id)||!label||label.length>80)throw new Error('Tray item identifiers or labels are invalid.');return{id,label}});let tray=runtimeTrays.get(project.id);if(!tray){tray=new Tray(appIconPath());tray.on('click',()=>{window.show();window.focus()});runtimeTrays.set(project.id,tray)}tray.setToolTip(tooltip);tray.setContextMenu(Menu.buildFromTemplate(normalized.map(item=>({label:item.label,click:()=>window.webContents.send('foundry-desktop:tray-action',item.id)}))));return true});
  ipcMain.handle('desktop:shortcut-register',async(event,value)=>{assertTrusted(event);const project=await requireRuntimeCapability(event,'globalShortcuts'),window=runtimeWindows.get(project.id),accelerator=String(value?.accelerator??'').trim(),id=String(value?.id??'').trim();if(!window||window.isDestroyed())throw new Error('The project window is not available.');if(!/^[A-Za-z0-9+_-]{1,60}$/.test(accelerator)||!/^[A-Za-z0-9._:-]{1,80}$/.test(id))throw new Error('Shortcut accelerator or identifier is invalid.');const registered=runtimeShortcuts.get(project.id)??new Set<string>();if(registered.size>=10&&!registered.has(accelerator))throw new Error('A project can register at most 10 global shortcuts.');if(registered.has(accelerator))globalShortcut.unregister(accelerator);if(!globalShortcut.register(accelerator,()=>window.webContents.send('foundry-desktop:shortcut-action',id)))throw new Error('The shortcut is unavailable or already used by another application.');registered.add(accelerator);runtimeShortcuts.set(project.id,registered);return true});
  ipcMain.handle('desktop:shortcuts-clear',async event=>{assertTrusted(event);const project=await requireRuntimeCapability(event,'globalShortcuts');clearRuntimeShortcuts(project.id);return true});
  ipcMain.handle('desktop:ai-request',async(event,payload)=>{assertTrusted(event);const project=await runtimeProject(event),config=await projectConfigs.get(project),token=await projectConfigs.getManagedToken(project);if(config.ai.mode!=='managed'||!config.ai.gatewayUrl||!token)throw new Error('Managed AI is not configured for this project.');const encoded=JSON.stringify(payload);if(!payload||typeof payload!=='object'||encoded.length>250_000)throw new Error('AI request must be an object under 250 KB.');const response=await net.fetch(`${config.ai.gatewayUrl}/v1/apps/model/request`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({requestId:`request_${randomUUID().replace(/-/g,'')}`,payload})}),body=await response.json() as {error?:string};if(!response.ok)throw new Error(typeof body.error==='string'?body.error:'Managed AI request failed.');return body});
  ipcMain.handle('agent:cancel',event=>{assertTrusted(event);activeBuilds.get(event.sender.id)?.abort();return true});
  ipcMain.handle('agent:undo',async(event,id)=>{assertTrusted(event);const project=await projectById(id),oid=reversibleBuilds.get(project.id);if(!oid)throw new Error('There is no completed AI build to undo.');await checkpoints.restore(project,oid);reversibleBuilds.delete(project.id);await refreshRuntime(project);return true});
  ipcMain.handle('agent:accept',async(event,id)=>{assertTrusted(event);const project=await projectById(id);await checkpoints.create(project,'Accepted AI build');reversibleBuilds.delete(project.id);return true});
  ipcMain.handle('preview:build',async(event,id)=>{assertTrusted(event);return preview.build(await projectById(id))});
  ipcMain.handle('runtime:open',async(event,id)=>{assertTrusted(event);await openRuntime(await projectById(id));return true});
  ipcMain.handle('installer:build',async(event,id)=>{assertTrusted(event);const project=await projectById(id);try{return await installer.build(project,message=>event.sender.send('installer:event',message))}catch(error){const message=error instanceof Error?error.message:String(error);await workspace.record(project,'installer.failure',message);throw error}});
  ipcMain.handle('installer:reveal',(event,path)=>{assertTrusted(event);if(typeof path!=='string')throw new Error('An installer path is required.');shell.showItemInFolder(path);return true});
  ipcMain.handle('qualification:run',async(event,id)=>{assertTrusted(event);const project=await projectById(id),service=new ReleaseQualificationService({root:join(app.getPath('userData'),'qualification'),verify:()=>verifyProject(project),build:onProgress=>installer.build(project,onProgress,{qualification:true}),onProgress:message=>event.sender.send('qualification:event',message)});return service.run()});
  ipcMain.handle('project-config:get',async(event,id)=>{assertTrusted(event);return projectConfigs.get(await projectById(id))});
  ipcMain.handle('project-config:save',async(event,id,value)=>{assertTrusted(event);if(!value||typeof value!=='object')throw new Error('Project configuration is required.');const project=await projectById(id),previous=await projectConfigs.get(project);let saved=await projectConfigs.save(project,value as ProjectConfig),changed=previous.ai.provider!==saved.ai.provider||previous.ai.model!==saved.ai.model||previous.ai.monthlyBudget!==saved.ai.monthlyBudget||previous.ai.requestsPerMinute!==saved.ai.requestsPerMinute;if(saved.ai.mode==='managed'&&(!saved.ai.credentialId||changed)){const access=await settings.hostedAccess(),client=new CloudClient(access.gatewayUrl,(input,init)=>net.fetch(input,init)),created=await client.createAppCredential(access.token,{name:`${saved.displayName} (${saved.appId})`,provider:saved.ai.provider,model:saved.ai.model,monthlyBudget:saved.ai.monthlyBudget,requestsPerMinute:saved.ai.requestsPerMinute});await projectConfigs.saveManagedToken(project,created.token);if(previous.ai.credentialId)await client.revokeAppCredential(access.token,previous.ai.credentialId);saved=await projectConfigs.save(project,{...saved,ai:{...saved.ai,credentialId:created.credential.id,gatewayUrl:access.gatewayUrl}})}else if(saved.ai.mode==='none'&&previous.ai.credentialId){const access=await settings.hostedAccess(),client=new CloudClient(access.gatewayUrl,(input,init)=>net.fetch(input,init));await client.revokeAppCredential(access.token,previous.ai.credentialId);await projectConfigs.clearManagedToken(project);saved=await projectConfigs.save(project,{...saved,ai:{...saved.ai,credentialId:undefined,gatewayUrl:undefined}})}await applyRuntimeConfig(project);return saved});
  ipcMain.handle('project-config:provision-ai',async(event,id,value)=>{assertTrusted(event);if(!value||typeof value!=='object')throw new Error('Project configuration is required.');const project=await projectById(id),config=await projectConfigs.save(project,value as ProjectConfig);if(config.ai.mode!=='managed')throw new Error('Select Foundry Managed AI first.');const access=await settings.hostedAccess(),client=new CloudClient(access.gatewayUrl,(input,init)=>net.fetch(input,init)),created=await client.createAppCredential(access.token,{name:`${config.displayName} (${config.appId})`,provider:config.ai.provider,model:config.ai.model,monthlyBudget:config.ai.monthlyBudget,requestsPerMinute:config.ai.requestsPerMinute});await projectConfigs.saveManagedToken(project,created.token);return projectConfigs.save(project,{...config,ai:{...config.ai,credentialId:created.credential.id,gatewayUrl:access.gatewayUrl}})});
  ipcMain.handle('project-config:choose-icon',async(event,id)=>{assertTrusted(event);const project=await projectById(id),result=await dialog.showOpenDialog({title:'Choose an application icon',properties:['openFile'],filters:[{name:'Application icons',extensions:['png','ico']}]});if(result.canceled||!result.filePaths[0])return null;const saved=await projectConfigs.setIcon(project,result.filePaths[0]);await applyRuntimeConfig(project);return saved});
  ipcMain.handle('updates:get',event=>{assertTrusted(event);return updates.current()});
  ipcMain.handle('updates:check',event=>{assertTrusted(event);return updates.check()});
  ipcMain.handle('updates:download',event=>{assertTrusted(event);return updates.download()});
  ipcMain.handle('updates:install',event=>{assertTrusted(event);updates.install();return true});
  ipcMain.handle('benchmarks:get',event=>{assertTrusted(event);return benchmarks.snapshot()});
  ipcMain.handle('benchmarks:run',async(event,id)=>{assertTrusted(event);if(typeof id!=='string')throw new Error('A benchmark id is required.');await executeBenchmark(event,id,await settings.credential());return benchmarks.snapshot()});
  ipcMain.handle('benchmarks:recheck',async(event,id)=>{assertTrusted(event);if(typeof id!=='string')throw new Error('A benchmark id is required.');const benchmark=benchmarks.case(id),started=Date.now(),projects=await benchmarkWorkspace.listProjects(),project=projects.find(item=>item.name.startsWith(`Benchmark ${id} `));if(!project)throw new Error('No generated build is available to recheck. Run this benchmark once first.');try{const verification=await verifyProject(project,benchmark.workflow??[]),checksPassed=verification.checks.filter(check=>check.passed).length;return benchmarks.record({id:randomUUID(),benchmarkId:id,projectId:project.id,recheck:true,passed:verification.passed,durationMs:Date.now()-started,checksPassed,checksTotal:verification.checks.length,filesChanged:0,completedAt:new Date().toISOString(),...(!verification.passed?{failure:verification.checks.filter(check=>!check.passed).map(check=>check.detail).join(' ')}:{})})}catch(error){return benchmarks.record({id:randomUUID(),benchmarkId:id,projectId:project.id,recheck:true,passed:false,durationMs:Date.now()-started,checksPassed:0,checksTotal:0,filesChanged:0,completedAt:new Date().toISOString(),failure:error instanceof Error?error.message:String(error)})}});
  ipcMain.handle('benchmarks:campaign-run',event=>runBenchmarkCampaign(event));
  ipcMain.handle('benchmarks:campaign-cancel',event=>{assertTrusted(event);benchmarkCampaignAbort?.abort();return true});
}

async function runtimeProject(event:IpcMainInvokeEvent):Promise<ProjectRecord>{const entry=[...runtimeWindows.entries()].find(([,window])=>!window.isDestroyed()&&window.webContents.id===event.sender.id);if(!entry)throw new Error('Managed AI requests are allowed only from a running project.');return projectById(entry[0])}

async function executeBenchmark(event:IpcMainInvokeEvent,id:string,credential:ProviderCredential,campaign:Pick<BenchmarkResult,'campaignId'|'campaignCycle'>={},signal?:AbortSignal):Promise<BenchmarkResult>{
  const benchmark=benchmarks.case(id),started=Date.now();await mkdir(benchmarkRoot,{recursive:true});const project=await benchmarkWorkspace.createProject(benchmarkRoot,`Benchmark ${benchmark.id} ${Date.now()}`);await checkpoints.ensure(project);let filesChanged=0,result:BenchmarkResult;
  try{const initial=await agent.run(project,benchmark.prompt,credential,update=>event.sender.send('agent:event',update),signal),workflow=benchmark.workflow??initial.workflow,firstVerification=await verifyProject(project,workflow),loop=await runBehaviorRepairLoop({request:benchmark.prompt,result:initial,workflow,verification:firstVerification,verify:()=>verifyProject(project,workflow),repair:(repairPrompt,attempt)=>{event.sender.send('agent:event',{type:'status',message:`Benchmark verification failed. Running targeted repair ${attempt} of ${MAX_BEHAVIOR_REPAIRS}…`});return agent.run(project,repairPrompt,credential,update=>event.sender.send('agent:event',update),signal)},onAttempt:attempt=>event.sender.send('agent:event',{type:'verify',message:attempt.progress?`Repair ${attempt.attempt} improved the ${attempt.stage} checks.`:`Repair ${attempt.attempt} did not improve the ${attempt.stage} checks.`})});filesChanged=loop.result.filesChanged.length;const checksPassed=loop.verification.checks.filter(check=>check.passed).length;result={id:randomUUID(),benchmarkId:id,projectId:project.id,passed:loop.verification.passed,durationMs:Date.now()-started,checksPassed,checksTotal:loop.verification.checks.length,filesChanged,completedAt:new Date().toISOString(),repairAttempts:loop.attempts.length,repaired:!firstVerification.passed&&loop.verification.passed,repairStages:loop.attempts.map(attempt=>attempt.stage),...campaign,...(!loop.verification.passed?{failure:failedVerificationChecks(loop.verification).map(check=>check.detail).join(' ')}:{})}}catch(error){result={id:randomUUID(),benchmarkId:id,passed:false,durationMs:Date.now()-started,checksPassed:0,checksTotal:0,filesChanged,completedAt:new Date().toISOString(),failure:error instanceof Error?error.message:String(error),...campaign}}
  await benchmarks.record(result);return result;
}

async function runBenchmarkCampaign(event:IpcMainInvokeEvent){
  assertTrusted(event);if(benchmarkCampaignAbort)throw new Error('A reliability campaign is already running.');const controller=new AbortController(),credential=await settings.credential(),id=randomUUID();benchmarkCampaignAbort=controller;let campaign:BenchmarkCampaign=await benchmarks.startCampaign(id);
  try{for(let cycle=1;cycle<=campaign.totalCycles;cycle++){const cycleStartedAt=new Date().toISOString(),cycleResults:BenchmarkResult[]=[];for(let index=0;index<benchmarkCases.length;index++){if(controller.signal.aborted)throw new Error('Reliability campaign cancelled.');campaign=await benchmarks.updateCampaign({...campaign,currentCycle:cycle,currentCase:index+1});event.sender.send('benchmarks:event',{message:`Cycle ${cycle} of ${campaign.totalCycles}: building ${index+1} of ${benchmarkCases.length} (${benchmarkCases[index].name})`,snapshot:await benchmarks.snapshot()});cycleResults.push(await executeBenchmark(event,benchmarkCases[index].id,credential,{campaignId:id,campaignCycle:cycle},controller.signal))}campaign=await benchmarks.finishCampaignCycle(campaign,cycle,cycleStartedAt,cycleResults);event.sender.send('benchmarks:event',{message:`Cycle ${cycle} complete: ${campaign.cycles.at(-1)?.passed??0}/${benchmarkCases.length} passed.`,snapshot:await benchmarks.snapshot()})}return benchmarks.snapshot()}catch(error){campaign=controller.signal.aborted?await benchmarks.cancelCampaign(campaign):await benchmarks.updateCampaign({...campaign,status:'failed',completedAt:new Date().toISOString()});event.sender.send('benchmarks:event',{message:error instanceof Error?error.message:String(error),snapshot:await benchmarks.snapshot()});if(!controller.signal.aborted)throw error;return benchmarks.snapshot()}finally{benchmarkCampaignAbort=null}
}

async function runAgentRequest(event:IpcMainInvokeEvent,id:unknown,prompt:unknown,attachments:unknown){
 assertTrusted(event);if(typeof prompt!=='string')throw new Error('A prompt is required.');
 if(!Array.isArray(attachments))attachments=[];
 const project=await projectById(id),credential=await settings.credential(),send=(update:AgentEvent)=>event.sender.send('agent:event',update),safety=await checkpoints.create(project,`Before request: ${prompt.slice(0,72)}`),controller=new AbortController();
 activeBuilds.set(event.sender.id,controller);reversibleBuilds.set(project.id,safety.oid);
 try{
  const initial=await agent.run(project,prompt,credential,send,controller.signal,attachments as AgentAttachment[]),workflow=initial.workflow;
  send({type:'verify',message:'Launching an isolated verification window…'});const firstVerification=await verifyProject(project,workflow),loop=await runBehaviorRepairLoop({request:prompt,result:initial,workflow,verification:firstVerification,verify:()=>verifyProject(project,workflow),repair:(repairPrompt,attempt)=>{send({type:'status',message:`Verification diagnosed a problem. Running targeted repair ${attempt} of ${MAX_BEHAVIOR_REPAIRS}…`});return agent.run(project,repairPrompt,credential,send,controller.signal)},onAttempt:attempt=>send({type:'verify',message:attempt.progress?`Repair ${attempt.attempt} improved the ${attempt.stage} checks.`:`Repair ${attempt.attempt} did not improve the ${attempt.stage} checks.`})});let{result,verification}=loop;
  if(!verification.passed)throw new Error(`Verification failed after ${MAX_BEHAVIOR_REPAIRS} targeted repairs. ${failedVerificationChecks(verification).map(check=>check.detail).join(' ')}`);
  send({type:'verify',message:'Reviewing the rendered interface…'});const firstVisual=await agent.reviewScreenshot(prompt,await captureProject(project),credential,controller.signal),visualLoop=await runVisualRepairLoop({request:prompt,result,workflow,verification,visual:firstVisual,verify:()=>verifyProject(project,workflow),review:async()=>agent.reviewScreenshot(prompt,await captureProject(project),credential,controller.signal),repairVisual:(repairPrompt,attempt)=>{send({type:'status',message:`Visual review found a problem. Running focused repair ${attempt} of ${MAX_VISUAL_REPAIRS}…`});return agent.run(project,repairPrompt,credential,send,controller.signal)},repairBehavior:(repairPrompt,attempt)=>{send({type:'status',message:`The visual repair disturbed required behavior. Restoring it (${attempt} of ${MAX_BEHAVIOR_REPAIRS})…`});return agent.run(project,repairPrompt,credential,send,controller.signal)},onVisualAttempt:attempt=>send({type:'verify',message:`Rechecking behavior and appearance after visual repair ${attempt}…`}),onBehaviorAttempt:attempt=>send({type:'verify',message:attempt.progress?`Behavior recovery ${attempt.attempt} improved the ${attempt.stage} checks.`:`Behavior recovery ${attempt.attempt} did not improve the ${attempt.stage} checks.`})});result=visualLoop.result;verification=visualLoop.verification;const visual=visualLoop.visual;if(!verification.passed)throw new Error(`Visual repair changed required behavior and automatic recovery did not restore it. ${failedVerificationChecks(verification).map(check=>check.detail).join(' ')}`);verification.checks.push({name:'Visual quality',passed:visual.passed,detail:visual.passed?'Screenshot review found no blocking layout problems.':visual.issues.join(' | ')});if(!visual.passed)throw new Error(`Visual verification failed after ${MAX_VISUAL_REPAIRS} focused repairs. ${visual.issues.join(' ')}`)
  send({type:'verify',message:'Compile, workflow, and visual verification passed'});await refreshRuntime(project);return{...result,verification};
 }catch(error){const message=error instanceof Error?error.message:String(error);send({type:'status',message:'The request stopped. Restoring the safe checkpoint…'});await workspace.record(project,'agent.failure',message);await checkpoints.restore(project,safety.oid);reversibleBuilds.delete(project.id);await refreshRuntime(project);throw new Error(`${message} Foundry rolled back this request, so the project remains in its previous working state.`)}finally{activeBuilds.delete(event.sender.id)}
}

async function captureProject(project:ProjectRecord):Promise<Buffer>{
 const result=await preview.build(project),window=new BrowserWindow({show:false,width:1024,height:720,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,offscreen:true,backgroundThrottling:false}});
 try{await window.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(result.html)}`);await new Promise(resolve=>setTimeout(resolve,500));return(await window.webContents.capturePage()).toPNG()}finally{if(!window.isDestroyed())window.destroy()}
}

async function validateProviderKey(credential:ProviderCredential):Promise<void>{
  const {provider,apiKey,model}=credential,definition=providerDefinition(provider);if(apiKey.length<16)throw new Error(`Enter a valid ${definition.name} API key.`);const url=provider==='openai'?`https://api.openai.com/v1/models/${model}`:provider==='anthropic'?`https://api.anthropic.com/v1/models/${model}`:provider==='google'?`https://generativelanguage.googleapis.com/v1beta/openai/models/${model}`:`https://api.x.ai/v1/models/${model}`,headers=provider==='anthropic'?{'x-api-key':apiKey,'anthropic-version':'2023-06-01'}:{Authorization:`Bearer ${apiKey}`};
  let response:Response;try{response=await net.fetch(url,{headers})}catch{throw new Error(`Foundry could not reach ${definition.name}. Check your internet connection and try again.`)}
  if(response.ok)return;
  let detail='';try{const body=await response.json() as {error?:{message?:string}};detail=body.error?.message?.trim()||''}catch{}
  if(response.status===401)throw new Error(`${definition.name} rejected this API key. Check that it is active and paste it again.`);
  if(response.status===403||response.status===404)throw new Error(detail||`This ${definition.name} key does not have access to ${model}.`);
  throw new Error(detail||`${definition.name} could not verify the API key (HTTP ${response.status}).`);
}

async function loadRuntime(window:BrowserWindow,project:ProjectRecord):Promise<void>{
  const result=await preview.build(project,true),runtimeDirectory=join(project.root,'.foundry','runtime'),runtimeFile=join(runtimeDirectory,'app.html');
  await mkdir(runtimeDirectory,{recursive:true});await writeFile(runtimeFile,result.html,'utf8');await window.loadFile(runtimeFile);
}

async function verifyProject(project:ProjectRecord,workflow:WorkflowStep[]=[]):Promise<VerificationResult>{
  const checks:VerificationResult['checks']=[];let html='';
  try{const result=await preview.build(project);html=result.html;checks.push({name:'Compile',passed:true,detail:result.warnings.length?`Compiled with ${result.warnings.length} warning(s).`:'Project compiled without warnings.'})}
  catch(error){checks.push({name:'Compile',passed:false,detail:error instanceof Error?error.message:String(error)});return{passed:false,checks,verifiedAt:new Date().toISOString()}}
  const errors:string[]=[],verificationWindow=new BrowserWindow({show:false,width:1024,height:720,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,offscreen:true,backgroundThrottling:false}});
  try{
    verificationWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    verificationWindow.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message.replace(/^\[Foundry Runtime\]\s*/,''))});
    verificationWindow.webContents.on('render-process-gone',(_event,details)=>errors.push(`Renderer stopped: ${details.reason}`));
    await loadRuntime(verificationWindow,project);await new Promise(resolve=>setTimeout(resolve,350));
    const rendered=await verificationWindow.webContents.executeJavaScript(`(async()=>{for(let attempt=0;attempt<20;attempt++){const root=document.querySelector('#root'),value={elements:root?.children.length??0,text:(root?.textContent??'').trim().length,controls:document.querySelectorAll('button,input,textarea,select,a,[role="button"]').length};if(value.elements||value.text)return value;await new Promise(resolve=>setTimeout(resolve,100))}const root=document.querySelector('#root');return{elements:root?.children.length??0,text:(root?.textContent??'').trim().length,controls:document.querySelectorAll('button,input,textarea,select,a,[role="button"]').length}})()`) as {elements:number;text:number;controls:number};
    const hasContent=rendered.elements>0||rendered.text>0;checks.push({name:'Render',passed:hasContent,detail:hasContent?`Rendered ${rendered.elements} root element(s) and found ${rendered.controls} interactive control(s).`:'The application rendered no visible root content.'});
    if(!workflow.length){const interactions=await verificationWindow.webContents.executeJavaScript(`(async()=>{const visible=element=>{const style=getComputedStyle(element),rect=element.getBoundingClientRect();return style.visibility!=='hidden'&&style.display!=='none'&&rect.width>0&&rect.height>0};const describe=element=>(element.getAttribute('aria-label')||element.getAttribute('placeholder')||element.textContent||element.tagName).trim().slice(0,80);const fields=[...document.querySelectorAll('input,textarea')].filter(element=>visible(element)&&!element.disabled&&!element.readOnly&&!['password','hidden','file','checkbox','radio','submit'].includes((element.type||'').toLowerCase()));let input=null;if(fields[0]){const element=fields[0],sample='Foundry verification';const prototype=element.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,setter=Object.getOwnPropertyDescriptor(prototype,'value')?.set;setter?.call(element,sample);element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,100));input={label:describe(element),accepted:element.value===sample}}const blocked=new RegExp(${JSON.stringify(destructiveControlPattern.source)},'i');const buttons=[...document.querySelectorAll('button,[role="button"]')].filter(element=>visible(element)&&!element.disabled&&!blocked.test(describe(element)));let button=null;if(buttons[0]){const element=buttons[0],label=describe(element),root=document.querySelector('#root'),before=root?.innerHTML||'';element.click();await new Promise(resolve=>setTimeout(resolve,150));button={label,changed:(root?.innerHTML||'')!==before}}return{fields:fields.length,buttons:buttons.length,input,button}})()`) as {fields:number;buttons:number;input:{label:string;accepted:boolean}|null;button:{label:string;changed:boolean}|null};
    checks.push({name:'Input interaction',passed:!interactions.input||interactions.input.accepted,detail:interactions.input?(interactions.input.accepted?`Entered sample text in “${interactions.input.label}”.`:`“${interactions.input.label}” did not accept test input.`):`No eligible text field was found (${interactions.fields} discovered).`});
    checks.push({name:'Button interaction',passed:true,detail:interactions.button?`Clicked “${interactions.button.label}” without a crash${interactions.button.changed?' and observed a visible state change':'; no visible state change was required'}.`:`No safe button was found (${interactions.buttons} eligible).`});}
    if(workflow.length){
      await loadRuntime(verificationWindow,project);await new Promise(resolve=>setTimeout(resolve,350));
      const workflowEvidence=await verificationWindow.webContents.executeJavaScript(`(async()=>{const steps=${JSON.stringify(workflow)},normalize=value=>String(value||'').trim().toLowerCase().replace(/\\s+/g,' '),visible=element=>{const style=getComputedStyle(element),rect=element.getBoundingClientRect();return style.visibility!=='hidden'&&style.display!=='none'&&rect.width>0&&rect.height>0},label=element=>normalize(element.getAttribute('aria-label')||element.labels?.[0]?.textContent||element.getAttribute('placeholder')||element.getAttribute('name')||element.textContent||''),blocked=new RegExp(${JSON.stringify(destructiveControlPattern.source)},'i'),results=[];for(const step of steps){try{if(step.action==='fill'){const target=normalize(step.target),element=[...document.querySelectorAll('input,textarea')].find(item=>visible(item)&&!item.disabled&&!item.readOnly&&!['password','hidden','file'].includes((item.type||'').toLowerCase())&&(label(item)===target||label(item).includes(target)));if(!element)throw new Error('Could not find a visible text field labeled '+step.target);const prototype=element.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,setter=Object.getOwnPropertyDescriptor(prototype,'value')?.set;setter?.call(element,step.value);element.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:step.value}));element.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,180));if(element.value!==step.value)throw new Error('The field did not retain the requested value');results.push({passed:true,detail:'Filled “'+step.target+'” with test data.'})}else if(step.action==='click'){const target=normalize(step.target),element=[...document.querySelectorAll('button,[role="button"]')].find(item=>visible(item)&&!item.disabled&&(label(item)===target||label(item).includes(target)));if(!element)throw new Error('Could not find a visible button labeled '+step.target);if(blocked.test(label(element)))throw new Error('Refused a destructive or transactional control');const form=element.closest('form');if(element.tagName==='BUTTON'&&(element.type||'submit')==='submit'&&form)form.requestSubmit(element);else element.click();await new Promise(resolve=>setTimeout(resolve,350));results.push({passed:true,detail:'Clicked “'+step.target+'”.'})}else{const expected=normalize(step.value);let found=false;for(let attempt=0;attempt<20;attempt++){if(normalize(document.body.innerText).includes(expected)){found=true;break}await new Promise(resolve=>setTimeout(resolve,100))}if(!found)throw new Error('Expected visible text was not found: '+step.value);results.push({passed:true,detail:'Confirmed visible text “'+step.value+'”.'})}}catch(error){results.push({passed:false,detail:error instanceof Error?error.message:String(error)});break}}return results})()`) as {passed:boolean;detail:string}[];
      for(const[index,step]of workflow.entries())if(step.action==='assert_hover'){
        const target=JSON.stringify(step.target),probe=`(()=>{const normalize=value=>String(value||'').trim().toLowerCase().replace(/\\s+/g,' '),target=normalize(${target}),visible=element=>{const style=getComputedStyle(element),rect=element.getBoundingClientRect();return style.visibility!=='hidden'&&style.display!=='none'&&rect.width>0&&rect.height>0},label=element=>normalize(element.getAttribute('aria-label')||element.textContent||''),element=[...document.querySelectorAll('button,[role="button"],a,input')].find(item=>visible(item)&&(label(item)===target||label(item).includes(target)));if(!element)return null;const rect=element.getBoundingClientRect(),style=getComputedStyle(element),snapshot={backgroundColor:style.backgroundColor,color:style.color,transform:style.transform,boxShadow:style.boxShadow,opacity:style.opacity,filter:style.filter,outline:style.outline};return{x:Math.round(rect.x+rect.width/2),y:Math.round(rect.y+rect.height/2),snapshot,transitionDuration:style.transitionDuration}})()`;
        verificationWindow.webContents.sendInputEvent({type:'mouseMove',x:1,y:1});await new Promise(resolve=>setTimeout(resolve,80));
        const before=await verificationWindow.webContents.executeJavaScript(probe) as {x:number;y:number;snapshot:Record<string,string>;transitionDuration:string}|null;
        if(!before){workflowEvidence[index]={passed:false,detail:`Could not find a visible control labeled “${step.target}”.`};continue}
        verificationWindow.webContents.sendInputEvent({type:'mouseMove',x:before.x,y:before.y});await new Promise(resolve=>setTimeout(resolve,260));
        const after=await verificationWindow.webContents.executeJavaScript(probe) as typeof before;verificationWindow.webContents.sendInputEvent({type:'mouseMove',x:1,y:1});
        const changed=after?Object.keys(before.snapshot).filter(key=>before.snapshot[key]!==after.snapshot[key]):[],duration=before.transitionDuration.split(',').some(value=>Number.parseFloat(value)>0),passed=changed.length>0&&duration;
        workflowEvidence[index]={passed,detail:passed?`Confirmed animated hover change on “${step.target}” (${changed.join(', ')}; ${before.transitionDuration}).`:`“${step.target}” needs both a visible hover-state change and a non-zero CSS transition.`};
      }
      if(workflow.some(step=>step.action==='assert_persisted_text')){await loadRuntime(verificationWindow,project);await new Promise(resolve=>setTimeout(resolve,450))}
      for(const[index,step]of workflow.entries())if(step.action==='assert_persisted_text'){
        const found=await verificationWindow.webContents.executeJavaScript(`String(document.body.innerText||'').trim().toLowerCase().replace(/\\s+/g,' ').includes(${JSON.stringify(step.value.trim().toLowerCase().replace(/\s+/g,' '))})`) as boolean;
        workflowEvidence[index]={passed:found,detail:found?`Confirmed “${step.value}” survived an app reload.`:`Expected persisted text was missing after an app reload: ${step.value}`};
      }
      workflowEvidence.forEach((evidence,index)=>checks.push({name:`Workflow ${index+1}: ${workflow[index]?.action.replace('_',' ')??'step'}`,passed:evidence.passed,detail:evidence.detail}));
    }
    await new Promise(resolve=>setTimeout(resolve,200));
    checks.push({name:'Runtime',passed:errors.length===0,detail:errors.length?errors.slice(0,3).join(' | '):'No startup or interaction runtime errors were detected.'});
  }catch(error){checks.push({name:'Runtime',passed:false,detail:error instanceof Error?error.message:String(error)})}finally{if(!verificationWindow.isDestroyed())verificationWindow.destroy()}
  return{passed:checks.every(check=>check.passed),checks,verifiedAt:new Date().toISOString()};
}

async function openRuntime(project:ProjectRecord):Promise<void>{
  const config=await projectConfigs.get(project);
  const existing=runtimeWindows.get(project.id);
  if(existing&&!existing.isDestroyed()){configureWindow(existing,config);await loadRuntime(existing,project);existing.show();existing.focus();return}
  const window=new BrowserWindow({title:config.displayName,width:config.window.width,height:config.window.height,minWidth:config.window.minWidth,minHeight:config.window.minHeight,resizable:config.window.resizable,maximizable:config.window.maximizable,...(config.icon?{icon:join(project.root,config.icon)}:{}),show:false,backgroundColor:'#0b0d12',autoHideMenuBar:true,webPreferences:{preload:join(currentDirectory,'../preload/runtime.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}});
  runtimeWindows.set(project.id,window);window.on('closed',()=>{runtimeWindows.delete(project.id);clearRuntimeCapabilities(project.id)});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',event=>event.preventDefault());
  window.webContents.on('console-message',event=>{if(event.level==='error'&&event.message.includes('[Foundry Runtime]'))void sendDiagnostic(project,event.message.replace(/^\[Foundry Runtime\]\s*/,''))});
  window.webContents.on('render-process-gone',(_event,details)=>void sendDiagnostic(project,`Desktop runtime stopped unexpectedly: ${details.reason}.`));
  await loadRuntime(window,project);window.show();window.focus();
}

async function refreshRuntime(project:ProjectRecord):Promise<void>{
  const window=runtimeWindows.get(project.id);if(!window||window.isDestroyed())return;
  configureWindow(window,await projectConfigs.get(project));await loadRuntime(window,project);
}

async function applyRuntimeConfig(project:ProjectRecord):Promise<void>{const window=runtimeWindows.get(project.id);if(window&&!window.isDestroyed())configureWindow(window,await projectConfigs.get(project))}
function configureWindow(window:BrowserWindow,config:ProjectConfig):void{window.setTitle(config.displayName);window.setMinimumSize(config.window.minWidth,config.window.minHeight);window.setResizable(config.window.resizable);window.setMaximizable(config.window.maximizable);window.setSize(config.window.width,config.window.height)}

function createSplash():BrowserWindow{
  const splash=new BrowserWindow({width:420,height:280,frame:false,resizable:false,show:false,alwaysOnTop:true,skipTaskbar:true,center:true,backgroundColor:'#111318',icon:appIconPath(),webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
  splash.once('ready-to-show',()=>splash.show());
  if(is.dev&&process.env.ELECTRON_RENDERER_URL)void splash.loadURL(`${process.env.ELECTRON_RENDERER_URL}/splash.html`);else void splash.loadFile(join(currentDirectory,'../renderer/splash.html'));
  return splash;
}

function createWindow():void{
  const splash=createSplash();
  const win=new BrowserWindow({title:'Foundry Desktop',width:1440,height:900,minWidth:960,minHeight:640,show:false,icon:appIconPath(),backgroundColor:'#090a0e',titleBarStyle:'hidden',titleBarOverlay:{color:'#0b0d12',symbolColor:'#9da3ae',height:40},webPreferences:{preload:join(currentDirectory,'../preload/index.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}});
  foundryWindow=win;win.on('closed',()=>{if(foundryWindow===win)foundryWindow=null});
  win.webContents.on('render-process-gone',(_event,details)=>void recordCrash('foundry-renderer',`Foundry renderer stopped: ${details.reason}. Exit code: ${details.exitCode}.`));
  win.once('ready-to-show',()=>{if(!splash.isDestroyed())splash.close();win.show();win.focus()});
  win.webContents.on('did-fail-load',()=>{if(!splash.isDestroyed())splash.close();win.show()});
  console.log('Foundry window created',{id:win.id,visible:win.isVisible()});
  win.webContents.setWindowOpenHandler(({url})=>{if(url.startsWith('https://'))void shell.openExternal(url);return{action:'deny'}});
  if(is.dev&&process.env.ELECTRON_RENDERER_URL)void win.loadURL(process.env.ELECTRON_RENDERER_URL);else void win.loadFile(join(currentDirectory,'../renderer/index.html'));
}

async function recordCrash(source:CrashSource,message:unknown,projectId?:string):Promise<void>{try{await crashReports.record({source,message,projectId})}catch(error){console.error('Could not store local crash report',error)}}
async function sendDiagnostic(project:ProjectRecord,message:string):Promise<void>{await Promise.all([workspace.record(project,'runtime.error',message),recordCrash('desktop-runtime',message,project.id)]);if(foundryWindow&&!foundryWindow.isDestroyed())foundryWindow.webContents.send('runtime:diagnostic',{projectId:project.id,message})}

app.whenReady().then(()=>{
  electronApp.setAppUserModelId('com.foundry.desktop');
  session.defaultSession.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
  session.defaultSession.setPermissionCheckHandler(()=>false);
  workspace=new WorkspaceService(join(app.getPath('userData'),'projects.json'));
  crashReports=new CrashReportService(join(app.getPath('userData'),'diagnostics','crash-reports.json'),app.getVersion());
  benchmarkRoot=join(app.getPath('userData'),'benchmarks','projects');benchmarkWorkspace=new WorkspaceService(join(app.getPath('userData'),'benchmarks','projects.json'));benchmarks=new BenchmarkService(join(app.getPath('userData'),'benchmarks','results.json'));
  settings=new SettingsService(join(app.getPath('userData'),'settings.json'));
  cloud=new CloudClient(resolveGatewayUrl(process.env.FOUNDRY_GATEWAY_URL,app.isPackaged),(input,init)=>net.fetch(input,init));
  preview=new PreviewService(app.getAppPath());
  agent=new AgentService(workspace,checkpoints,(input,init)=>net.fetch(input,init),async project=>{await preview.build(project)});
  installer=new InstallerService(preview,projectConfigs);
  updates=new UpdateService(status=>{if(foundryWindow&&!foundryWindow.isDestroyed())foundryWindow.webContents.send('updates:status',status)});
  registerWorkspaceHandlers();
  process.on('unhandledRejection',reason=>void recordCrash('main-process',reason));
  process.on('uncaughtExceptionMonitor',error=>void recordCrash('main-process',error));
  app.on('browser-window-created',(_,window)=>optimizer.watchWindowShortcuts(window));
  ipcMain.handle('app:get-version',()=>app.getVersion());
  ipcMain.handle('app:get-user-name',()=>{const value=userInfo().username.replace(/[._-]+/g,' ').trim();return value?value.charAt(0).toUpperCase()+value.slice(1).replace(/s$/,''):''});
  createWindow();
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow()});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
