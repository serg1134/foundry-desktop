import { contextBridge, ipcRenderer } from 'electron';
import type { ActivityEntry, ProjectFile, ProjectRecord } from '../main/workspace';
import type { TemplateId } from '../templates.ts';
import type { Checkpoint, CheckpointDiff } from '../main/checkpoints';
import type { AgentAttachment, AgentEvent, AgentResult } from '../main/agent';
import type { PublicSettings } from '../main/settings';
import type { ProjectConfig } from '../main/project-config';
import type { UpdateStatus } from '../main/updates';
import type { BenchmarkSnapshot } from '../main/benchmarks';
import type { ProviderId } from '../main/providers';

const api={
  getVersion:():Promise<string>=>ipcRenderer.invoke('app:get-version'),
  getUserName:():Promise<string>=>ipcRenderer.invoke('app:get-user-name'),
  workspace:{
    listProjects:():Promise<ProjectRecord[]>=>ipcRenderer.invoke('workspace:list-projects'),
    createProject:(name:string,template:TemplateId):Promise<ProjectRecord|null>=>ipcRenderer.invoke('workspace:create',name,template),
    openProject:():Promise<ProjectRecord|null>=>ipcRenderer.invoke('workspace:open'),
    listFiles:(projectId:string):Promise<ProjectFile[]>=>ipcRenderer.invoke('workspace:list-files',projectId),
    readText:(projectId:string,path:string):Promise<string>=>ipcRenderer.invoke('workspace:read-text',projectId,path),
    writeText:(projectId:string,path:string,content:string):Promise<boolean>=>ipcRenderer.invoke('workspace:write-text',projectId,path,content),
    activity:(projectId:string):Promise<ActivityEntry[]>=>ipcRenderer.invoke('workspace:activity',projectId),
    reveal:(projectId:string):Promise<boolean>=>ipcRenderer.invoke('workspace:reveal',projectId),
    checkpoints:(projectId:string):Promise<Checkpoint[]>=>ipcRenderer.invoke('checkpoint:list',projectId),
    createCheckpoint:(projectId:string,message:string):Promise<Checkpoint>=>ipcRenderer.invoke('checkpoint:create',projectId,message),
    checkpointDiff:(projectId:string,oid:string):Promise<CheckpointDiff>=>ipcRenderer.invoke('checkpoint:diff',projectId,oid),
    restoreCheckpoint:(projectId:string,oid:string):Promise<boolean>=>ipcRenderer.invoke('checkpoint:restore',projectId,oid)
  },
  settings:{
    get:():Promise<PublicSettings>=>ipcRenderer.invoke('settings:get'),
    saveProvider:(provider:ProviderId,key:string,model:string):Promise<PublicSettings>=>ipcRenderer.invoke('settings:save-provider',provider,key,model),
    selectProvider:(provider:ProviderId,model:string):Promise<PublicSettings>=>ipcRenderer.invoke('settings:select-provider',provider,model),
    clearProvider:(provider:ProviderId):Promise<PublicSettings>=>ipcRenderer.invoke('settings:clear-provider',provider),
    cloudAuth:(email:string,password:string,create:boolean):Promise<PublicSettings>=>ipcRenderer.invoke('settings:cloud-auth',email,password,create),
    useMode:(mode:'hosted'|'byok'):Promise<PublicSettings>=>ipcRenderer.invoke('settings:use-mode',mode),
    cloudLogout:():Promise<PublicSettings>=>ipcRenderer.invoke('settings:cloud-logout'),
    cloudRefresh:():Promise<PublicSettings>=>ipcRenderer.invoke('settings:cloud-refresh'),
    cloudPackages:():Promise<{id:string;name:string;credits:number}[]>=>ipcRenderer.invoke('settings:cloud-packages'),
    cloudCheckout:(packageId:string):Promise<boolean>=>ipcRenderer.invoke('settings:cloud-checkout',packageId)
  },
  agent:{
    run:(projectId:string,prompt:string,attachments:AgentAttachment[]=[]):Promise<AgentResult>=>ipcRenderer.invoke('agent:run',projectId,prompt,attachments),
    cancel:():Promise<boolean>=>ipcRenderer.invoke('agent:cancel'),
    undo:(projectId:string):Promise<boolean>=>ipcRenderer.invoke('agent:undo',projectId),
    accept:(projectId:string):Promise<boolean>=>ipcRenderer.invoke('agent:accept',projectId),
    onEvent:(listener:(event:AgentEvent)=>void):(()=>void)=>{const handler=(_:unknown,event:AgentEvent)=>listener(event);ipcRenderer.on('agent:event',handler);return()=>ipcRenderer.removeListener('agent:event',handler)}
  },
  attachments:{choose:():Promise<AgentAttachment[]>=>ipcRenderer.invoke('attachments:choose')},
  benchmarks:{
    get:():Promise<BenchmarkSnapshot>=>ipcRenderer.invoke('benchmarks:get'),
    run:(id:string):Promise<BenchmarkSnapshot>=>ipcRenderer.invoke('benchmarks:run',id),
    recheck:(id:string):Promise<BenchmarkSnapshot>=>ipcRenderer.invoke('benchmarks:recheck',id)
  },
  preview:{build:(projectId:string):Promise<{html:string;warnings:string[]}>=>ipcRenderer.invoke('preview:build',projectId)},
  runtime:{
    open:(projectId:string):Promise<boolean>=>ipcRenderer.invoke('runtime:open',projectId),
    onDiagnostic:(listener:(diagnostic:{projectId:string;message:string})=>void):(()=>void)=>{const handler=(_:unknown,diagnostic:{projectId:string;message:string})=>listener(diagnostic);ipcRenderer.on('runtime:diagnostic',handler);return()=>ipcRenderer.removeListener('runtime:diagnostic',handler)}
  },
  installer:{
    build:(projectId:string):Promise<{installerPath:string;checksumPath:string;outputDirectory:string;signed:boolean}>=>ipcRenderer.invoke('installer:build',projectId),
    reveal:(path:string):Promise<boolean>=>ipcRenderer.invoke('installer:reveal',path),
    onProgress:(listener:(message:string)=>void):(()=>void)=>{const handler=(_:unknown,message:string)=>listener(message);ipcRenderer.on('installer:event',handler);return()=>ipcRenderer.removeListener('installer:event',handler)}
  },
  projectConfig:{
    get:(projectId:string):Promise<ProjectConfig>=>ipcRenderer.invoke('project-config:get',projectId),
    save:(projectId:string,value:ProjectConfig):Promise<ProjectConfig>=>ipcRenderer.invoke('project-config:save',projectId,value),
    chooseIcon:(projectId:string):Promise<ProjectConfig|null>=>ipcRenderer.invoke('project-config:choose-icon',projectId)
  },
  updates:{
    get:():Promise<UpdateStatus>=>ipcRenderer.invoke('updates:get'),
    check:():Promise<UpdateStatus>=>ipcRenderer.invoke('updates:check'),
    download:():Promise<UpdateStatus>=>ipcRenderer.invoke('updates:download'),
    install:():Promise<boolean>=>ipcRenderer.invoke('updates:install'),
    onStatus:(listener:(status:UpdateStatus)=>void):(()=>void)=>{const handler=(_:unknown,status:UpdateStatus)=>listener(status);ipcRenderer.on('updates:status',handler);return()=>ipcRenderer.removeListener('updates:status',handler)}
  }
};
contextBridge.exposeInMainWorld('foundry',api);
export type FoundryApi=typeof api;
