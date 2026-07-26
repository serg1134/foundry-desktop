import { app, BrowserWindow, dialog, ipcMain, net, session, shell, type IpcMainInvokeEvent } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { userInfo } from 'node:os';
import { electronApp, is, optimizer } from '@electron-toolkit/utils';
import { WorkspaceService, type ProjectRecord } from './workspace';
import type { TemplateId } from '../templates.ts';
import { CheckpointService } from './checkpoints';
import { SettingsService } from './settings';
import { AgentService, type AgentEvent } from './agent';
import { PreviewService } from './preview';
import { InstallerService } from './installer';
import { ProjectConfigService, type ProjectConfig } from './project-config';
import { UpdateService } from './updates';

let workspace:WorkspaceService;
const checkpoints=new CheckpointService();
let settings:SettingsService;
let agent:AgentService;
let preview:PreviewService;
let installer:InstallerService;
let updates:UpdateService;
const projectConfigs=new ProjectConfigService();
const runtimeWindows=new Map<string,BrowserWindow>();
let foundryWindow:BrowserWindow|null=null;
const currentDirectory=dirname(fileURLToPath(import.meta.url));

function appIconPath():string{
  return is.dev?join(app.getAppPath(),'build','icon.png'):join(process.resourcesPath,'app-icon.png');
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
  ipcMain.handle('workspace:reveal',async(event,id)=>{assertTrusted(event);shell.showItemInFolder(join((await projectById(id)).root,'package.json'));return true});
  ipcMain.handle('checkpoint:list',async(event,id)=>{assertTrusted(event);return checkpoints.list(await projectById(id))});
  ipcMain.handle('checkpoint:create',async(event,id,message)=>{assertTrusted(event);if(typeof message!=='string')throw new Error('A checkpoint name is required.');return checkpoints.create(await projectById(id),message)});
  ipcMain.handle('checkpoint:diff',async(event,id,oid)=>{assertTrusted(event);if(typeof oid!=='string')throw new Error('A checkpoint id is required.');return checkpoints.diff(await projectById(id),oid)});
  ipcMain.handle('checkpoint:restore',async(event,id,oid)=>{assertTrusted(event);if(typeof oid!=='string')throw new Error('A checkpoint id is required.');await checkpoints.restore(await projectById(id),oid);return true});
  ipcMain.handle('settings:get',event=>{assertTrusted(event);return settings.publicSettings()});
  ipcMain.handle('settings:save-key',async(event,key)=>{assertTrusted(event);if(typeof key!=='string')throw new Error('An API key is required.');await validateOpenAIKey(key);return settings.saveApiKey(key)});
  ipcMain.handle('settings:clear-key',event=>{assertTrusted(event);return settings.clearApiKey()});
  ipcMain.handle('agent:run',async(event,id,prompt)=>{assertTrusted(event);if(typeof prompt!=='string')throw new Error('A prompt is required.');const project=await projectById(id),key=await settings.apiKey(),publicSettings=await settings.publicSettings(),send=(update:AgentEvent)=>event.sender.send('agent:event',update),safety=await checkpoints.create(project,`Before request: ${prompt.slice(0,72)}`);try{let result=await agent.run(project,prompt,key,publicSettings.model,send);try{await preview.build(project)}catch(error){const diagnostic=error instanceof Error?error.message:String(error);send({type:'status',message:'The compile check found an error. Starting one repair pass…'});const repair=await agent.run(project,`Repair this compile failure caused by the preceding requested change. Make only the changes needed, then validate the project.\n\n${diagnostic.slice(0,5000)}`,key,publicSettings.model,send);result={message:`${result.message}\n\nFoundry detected and repaired a compile error. ${repair.message}`,filesChanged:[...new Set([...result.filesChanged,...repair.filesChanged])],iterations:result.iterations+repair.iterations};await preview.build(project)}await refreshRuntime(project);return result}catch(error){send({type:'status',message:'The request failed. Restoring the safe checkpoint…'});await checkpoints.restore(project,safety.oid);await refreshRuntime(project);throw new Error(`${error instanceof Error?error.message:String(error)} Foundry rolled back this request, so the project remains in its previous working state.`)}});
  ipcMain.handle('preview:build',async(event,id)=>{assertTrusted(event);return preview.build(await projectById(id))});
  ipcMain.handle('runtime:open',async(event,id)=>{assertTrusted(event);await openRuntime(await projectById(id));return true});
  ipcMain.handle('installer:build',async(event,id)=>{assertTrusted(event);return installer.build(await projectById(id),message=>event.sender.send('installer:event',message))});
  ipcMain.handle('installer:reveal',(event,path)=>{assertTrusted(event);if(typeof path!=='string')throw new Error('An installer path is required.');shell.showItemInFolder(path);return true});
  ipcMain.handle('project-config:get',async(event,id)=>{assertTrusted(event);return projectConfigs.get(await projectById(id))});
  ipcMain.handle('project-config:save',async(event,id,value)=>{assertTrusted(event);if(!value||typeof value!=='object')throw new Error('Project configuration is required.');const project=await projectById(id),saved=await projectConfigs.save(project,value as ProjectConfig);await applyRuntimeConfig(project);return saved});
  ipcMain.handle('project-config:choose-icon',async(event,id)=>{assertTrusted(event);const project=await projectById(id),result=await dialog.showOpenDialog({title:'Choose an application icon',properties:['openFile'],filters:[{name:'Application icons',extensions:['png','ico']}]});if(result.canceled||!result.filePaths[0])return null;const saved=await projectConfigs.setIcon(project,result.filePaths[0]);await applyRuntimeConfig(project);return saved});
  ipcMain.handle('updates:get',event=>{assertTrusted(event);return updates.current()});
  ipcMain.handle('updates:check',event=>{assertTrusted(event);return updates.check()});
  ipcMain.handle('updates:download',event=>{assertTrusted(event);return updates.download()});
  ipcMain.handle('updates:install',event=>{assertTrusted(event);updates.install();return true});
}

async function validateOpenAIKey(key:string):Promise<void>{
  const value=key.trim();if(value.length<20)throw new Error('Enter a valid OpenAI API key.');
  let response:Response;try{response=await net.fetch('https://api.openai.com/v1/models/gpt-5.6-sol',{headers:{Authorization:`Bearer ${value}`}})}catch{throw new Error('Foundry could not reach OpenAI. Check your internet connection and try again.')}
  if(response.ok)return;
  let detail='';try{const body=await response.json() as {error?:{message?:string}};detail=body.error?.message?.trim()||''}catch{}
  if(response.status===401)throw new Error('OpenAI rejected this API key. Check that it is active and paste it again.');
  if(response.status===403)throw new Error(detail||'This OpenAI key does not have access to the configured model.');
  throw new Error(detail||`OpenAI could not verify the API key (HTTP ${response.status}).`);
}

async function loadRuntime(window:BrowserWindow,project:ProjectRecord):Promise<void>{
  const result=await preview.build(project);
  await window.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(result.html)}`);
}

async function openRuntime(project:ProjectRecord):Promise<void>{
  const config=await projectConfigs.get(project);
  const existing=runtimeWindows.get(project.id);
  if(existing&&!existing.isDestroyed()){configureWindow(existing,config);await loadRuntime(existing,project);existing.show();existing.focus();return}
  const window=new BrowserWindow({title:config.displayName,width:config.window.width,height:config.window.height,minWidth:config.window.minWidth,minHeight:config.window.minHeight,resizable:config.window.resizable,maximizable:config.window.maximizable,...(config.icon?{icon:join(project.root,config.icon)}:{}),show:false,backgroundColor:'#0b0d12',autoHideMenuBar:true,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
  runtimeWindows.set(project.id,window);window.on('closed',()=>runtimeWindows.delete(project.id));
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',event=>event.preventDefault());
  window.webContents.on('console-message',(_event,details)=>{if(details.level==='error'&&details.message.includes('[Foundry Runtime]'))sendDiagnostic(project.id,details.message.replace(/^\[Foundry Runtime\]\s*/,''))});
  window.webContents.on('render-process-gone',(_event,details)=>sendDiagnostic(project.id,`Desktop runtime stopped unexpectedly: ${details.reason}.`));
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
  win.once('ready-to-show',()=>{if(!splash.isDestroyed())splash.close();win.show();win.focus()});
  win.webContents.on('did-fail-load',()=>{if(!splash.isDestroyed())splash.close();win.show()});
  console.log('Foundry window created',{id:win.id,visible:win.isVisible()});
  win.webContents.setWindowOpenHandler(({url})=>{if(url.startsWith('https://'))void shell.openExternal(url);return{action:'deny'}});
  if(is.dev&&process.env.ELECTRON_RENDERER_URL)void win.loadURL(process.env.ELECTRON_RENDERER_URL);else void win.loadFile(join(currentDirectory,'../renderer/index.html'));
}

function sendDiagnostic(projectId:string,message:string):void{if(foundryWindow&&!foundryWindow.isDestroyed())foundryWindow.webContents.send('runtime:diagnostic',{projectId,message})}

app.whenReady().then(()=>{
  electronApp.setAppUserModelId('com.foundry.desktop');
  session.defaultSession.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
  session.defaultSession.setPermissionCheckHandler(()=>false);
  workspace=new WorkspaceService(join(app.getPath('userData'),'projects.json'));
  settings=new SettingsService(join(app.getPath('userData'),'settings.json'));
  preview=new PreviewService(app.getAppPath());
  agent=new AgentService(workspace,checkpoints,(input,init)=>net.fetch(input,init),async project=>{await preview.build(project)});
  installer=new InstallerService(preview,projectConfigs);
  updates=new UpdateService(status=>{if(foundryWindow&&!foundryWindow.isDestroyed())foundryWindow.webContents.send('updates:status',status)});
  registerWorkspaceHandlers();
  app.on('browser-window-created',(_,window)=>optimizer.watchWindowShortcuts(window));
  ipcMain.handle('app:get-version',()=>app.getVersion());
  ipcMain.handle('app:get-user-name',()=>{const value=userInfo().username.replace(/[._-]+/g,' ').trim();return value?value.charAt(0).toUpperCase()+value.slice(1).replace(/s$/,''):''});
  createWindow();
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow()});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
