import { copyFile, mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { ProjectRecord } from './workspace';

export type ProjectConfig={
  displayName:string;description:string;version:string;publisher:string;appId:string;
  window:{width:number;height:number;minWidth:number;minHeight:number;resizable:boolean;maximizable:boolean};
  installer:{oneClick:boolean;allowDirectorySelection:boolean;desktopShortcut:boolean;startMenuShortcut:boolean};
  capabilities:{openTextFile:boolean;saveTextFile:boolean;folderRead:boolean;database:boolean;network:boolean;clipboardRead:boolean;clipboardWrite:boolean;notifications:boolean;tray:boolean;globalShortcuts:boolean};
  ai:{mode:'none'|'managed';provider:'openai'|'anthropic'|'google'|'xai';model:string;monthlyBudget:number;requestsPerMinute:number;credentialId?:string;gatewayUrl?:string};
  icon?:string;
};
type TokenProtector={encrypt(value:string):Promise<string>;decrypt(value:string):Promise<string>};
const TOKEN_PREFIX='foundry-secure-v1:';
const systemTokenProtector:TokenProtector={
  async encrypt(value){const{safeStorage}=await import('electron');if(!safeStorage.isEncryptionAvailable())throw new Error('Secure credential storage is unavailable on this device.');return safeStorage.encryptString(value).toString('base64')},
  async decrypt(value){const{safeStorage}=await import('electron');if(!safeStorage.isEncryptionAvailable())throw new Error('Secure credential storage is unavailable on this device.');return safeStorage.decryptString(Buffer.from(value,'base64'))}
};

export class ProjectConfigService{
  constructor(private readonly tokenProtector:TokenProtector=systemTokenProtector){}
  async get(project:ProjectRecord):Promise<ProjectConfig>{
    const defaults=this.defaults(project);try{return this.validate({...defaults,...JSON.parse(await readFile(this.path(project),'utf8'))} as ProjectConfig)}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return defaults;throw error}
  }

  async save(project:ProjectRecord,input:ProjectConfig):Promise<ProjectConfig>{
    const value=this.validate(input);await mkdir(join(project.root,'.foundry'),{recursive:true});await writeFile(this.path(project),JSON.stringify(value,null,2),'utf8');return value;
  }

  async reconcileNativeCapabilities(project:ProjectRecord):Promise<ProjectConfig>{
    const config=await this.get(project),required=await detectNativeCapabilities(project.root),capabilities={...config.capabilities};let changed=false;
    for(const key of Object.keys(required) as (keyof ProjectConfig['capabilities'])[])if(required[key]&&!capabilities[key]){capabilities[key]=true;changed=true}
    return changed?this.save(project,{...config,capabilities}):config;
  }

  async setIcon(project:ProjectRecord,source:string):Promise<ProjectConfig>{
    const extension=extname(source).toLowerCase();if(!['.ico','.png'].includes(extension))throw new Error('Choose a PNG or ICO image.');const target=join(project.root,'.foundry',`app-icon${extension}`);await mkdir(join(project.root,'.foundry'),{recursive:true});await copyFile(source,target);const config=await this.get(project);return this.save(project,{...config,icon:`.foundry/app-icon${extension}`});
  }
  async saveManagedToken(project:ProjectRecord,token:string):Promise<void>{if(!/^fapp_[A-Za-z0-9_-]{40,}$/.test(token))throw new Error('Managed AI token is invalid.');await mkdir(join(project.root,'.foundry'),{recursive:true});const encrypted=await this.tokenProtector.encrypt(token);await writeFile(join(project.root,'.foundry','managed-ai.token'),`${TOKEN_PREFIX}${encrypted}`,{encoding:'utf8',mode:0o600})}
  async getManagedToken(project:ProjectRecord):Promise<string|null>{try{const stored=(await readFile(join(project.root,'.foundry','managed-ai.token'),'utf8')).trim();let token:string;if(stored.startsWith(TOKEN_PREFIX))token=await this.tokenProtector.decrypt(stored.slice(TOKEN_PREFIX.length));else{token=stored;if(/^fapp_[A-Za-z0-9_-]{40,}$/.test(token))await this.saveManagedToken(project,token)}return /^fapp_[A-Za-z0-9_-]{40,}$/.test(token)?token:null}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error}}
  async clearManagedToken(project:ProjectRecord):Promise<void>{try{await unlink(join(project.root,'.foundry','managed-ai.token'))}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error}}

  private path(project:ProjectRecord):string{return join(project.root,'.foundry','app.json')}
  private defaults(project:ProjectRecord):ProjectConfig{const id=safeId(project.name);return{displayName:project.name,description:`Desktop app created with Foundry`,version:'0.1.0',publisher:'',appId:`com.foundry.${id}`,window:{width:1200,height:800,minWidth:720,minHeight:480,resizable:true,maximizable:true},installer:{oneClick:false,allowDirectorySelection:true,desktopShortcut:true,startMenuShortcut:true},capabilities:{openTextFile:true,saveTextFile:true,folderRead:false,database:false,network:false,clipboardRead:false,clipboardWrite:false,notifications:false,tray:false,globalShortcuts:false},ai:{mode:'none',provider:'openai',model:'gpt-5.6-sol',monthlyBudget:1000,requestsPerMinute:10}}}
  private validate(input:ProjectConfig):ProjectConfig{
    const displayName=input.displayName?.trim(),description=input.description?.trim()??'',publisher=input.publisher?.trim()??'',appId=input.appId?.trim(),version=input.version?.trim();
    if(!displayName||displayName.length>80)throw new Error('App name must be between 1 and 80 characters.');if(description.length>240)throw new Error('Description must be 240 characters or fewer.');if(publisher.length>100)throw new Error('Publisher must be 100 characters or fewer.');if(!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version))throw new Error('Version must use semantic versioning, such as 1.0.0.');if(!/^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z0-9-]+)+$/.test(appId))throw new Error('Application ID must use reverse-domain form, such as com.company.app.');
    const window={width:integer(input.window?.width,640,3840,'Window width'),height:integer(input.window?.height,480,2160,'Window height'),minWidth:integer(input.window?.minWidth,320,3840,'Minimum width'),minHeight:integer(input.window?.minHeight,240,2160,'Minimum height'),resizable:Boolean(input.window?.resizable),maximizable:Boolean(input.window?.maximizable)};if(window.minWidth>window.width||window.minHeight>window.height)throw new Error('Minimum window size cannot exceed the initial window size.');
    const ai={mode:input.ai?.mode==='managed'?'managed' as const:'none' as const,provider:['openai','anthropic','google','xai'].includes(input.ai?.provider)?input.ai.provider:'openai' as const,model:String(input.ai?.model||'gpt-5.6-sol'),monthlyBudget:integer(input.ai?.monthlyBudget??1000,1,1_000_000,'Monthly AI budget'),requestsPerMinute:integer(input.ai?.requestsPerMinute??10,1,120,'AI requests per minute'),...(input.ai?.credentialId?{credentialId:String(input.ai.credentialId)}:{}),...(input.ai?.gatewayUrl?{gatewayUrl:String(input.ai.gatewayUrl)}:{})};
    return{displayName,description,version,publisher,appId,window,installer:{oneClick:Boolean(input.installer?.oneClick),allowDirectorySelection:Boolean(input.installer?.allowDirectorySelection),desktopShortcut:Boolean(input.installer?.desktopShortcut),startMenuShortcut:Boolean(input.installer?.startMenuShortcut)},capabilities:{openTextFile:Boolean(input.capabilities?.openTextFile),saveTextFile:Boolean(input.capabilities?.saveTextFile),folderRead:Boolean(input.capabilities?.folderRead),database:Boolean(input.capabilities?.database),network:Boolean(input.capabilities?.network),clipboardRead:Boolean(input.capabilities?.clipboardRead),clipboardWrite:Boolean(input.capabilities?.clipboardWrite),notifications:Boolean(input.capabilities?.notifications),tray:Boolean(input.capabilities?.tray),globalShortcuts:Boolean(input.capabilities?.globalShortcuts)},ai,...(input.icon?{icon:input.icon}:{})};
  }
}

async function detectNativeCapabilities(root:string):Promise<Partial<ProjectConfig['capabilities']>>{
  const required:Partial<ProjectConfig['capabilities']>={},files=await readdir(join(root,'src'),{recursive:true,withFileTypes:true}).catch(()=>[]);
  for(const entry of files){
    if(!entry.isFile()||!/[.](?:[cm]?[jt]sx?)$/i.test(entry.name)||entry.name==='foundry-desktop.d.ts')continue;
    const parent='parentPath'in entry&&typeof entry.parentPath==='string'?entry.parentPath:join(root,'src'),source=await readFile(join(parent,entry.name),'utf8');
    if(/foundryDesktop(?:\?\.|\.)openTextFile\s*\(/.test(source))required.openTextFile=true;
    if(/foundryDesktop(?:\?\.|\.)saveTextFile\s*\(/.test(source))required.saveTextFile=true;
    if(/foundryDesktop(?:\?\.|\.)chooseFolder\s*\(/.test(source))required.folderRead=true;
    if(/foundryDesktop(?:\?\.|\.)database\./.test(source))required.database=true;
    if(/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*(?:\(|\.)/.test(source))required.network=true;
    if(/foundryDesktop(?:\?\.|\.)readClipboardText\s*\(/.test(source))required.clipboardRead=true;
    if(/foundryDesktop(?:\?\.|\.)writeClipboardText\s*\(/.test(source))required.clipboardWrite=true;
    if(/foundryDesktop(?:\?\.|\.)showNotification\s*\(/.test(source))required.notifications=true;
    if(/foundryDesktop(?:\?\.|\.)tray\./.test(source))required.tray=true;
    if(/foundryDesktop(?:\?\.|\.)shortcuts\./.test(source))required.globalShortcuts=true;
  }
  return required;
}

function integer(value:number,min:number,max:number,label:string):number{if(!Number.isInteger(value)||value<min||value>max)throw new Error(`${label} must be between ${min} and ${max}.`);return value}
function safeId(name:string):string{return name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'app'}
