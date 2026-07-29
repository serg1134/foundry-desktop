import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,readdir,rm,stat} from 'node:fs/promises';
import {join,relative,resolve,sep} from 'node:path';
import type {InstallerResult} from './installer.ts';
import type {VerificationResult} from './agent.ts';

export type QualificationStage='verify'|'package'|'checksum'|'install'|'launch'|'cleanup';
export type QualificationCheck={stage:QualificationStage;passed:boolean;detail:string};
export type QualificationResult={id:string;passed:boolean;startedAt:string;completedAt:string;checks:QualificationCheck[];installerPath?:string};
type CommandResult={code:number|null;survived?:boolean};
type CommandRunner=(file:string,args:string[],options:{timeoutMs:number;survivalMs?:number;env?:NodeJS.ProcessEnv})=>Promise<CommandResult>;
type Options={root:string;verify:()=>Promise<VerificationResult>;build:(progress:(message:string)=>void)=>Promise<InstallerResult>;onProgress?:(message:string)=>void;runner?:CommandRunner};

export class ReleaseQualificationService{
  constructor(private readonly options:Options){}
  async run():Promise<QualificationResult>{
    const id=randomUUID(),startedAt=new Date().toISOString(),checks:QualificationCheck[]=[],testRoot=join(resolve(this.options.root),id),installRoot=join(testRoot,'installed'),dataRoot=join(testRoot,'data'),runner=this.options.runner??runCommand;let installerPath:string|undefined,stopped=false,installedToDisk=false;
    await mkdir(testRoot,{recursive:true});
    try{
      this.progress('Verifying the generated application workflow…');const verification=await this.options.verify();checks.push({stage:'verify',passed:verification.passed,detail:verification.passed?`${verification.checks.length} workflow checks passed.`:verification.checks.filter(check=>!check.passed).map(check=>check.detail).join(' ')});stopped=!verification.passed;
      let installer:InstallerResult|undefined;if(!stopped){this.progress('Building an isolated qualification installer…');installer=await this.options.build(message=>this.progress(message));installerPath=installer.installerPath;checks.push({stage:'package',passed:true,detail:'Windows installer was produced.'});const expected=(await readFile(installer.checksumPath,'utf8')).trim().split(/\s+/)[0]?.toLowerCase(),actual=createHash('sha256').update(await readFile(installer.installerPath)).digest('hex'),checksumPassed=expected===actual;checks.push({stage:'checksum',passed:checksumPassed,detail:checksumPassed?'Installer checksum matched.':'Installer checksum did not match.'});stopped=!checksumPassed}
      if(!stopped&&installer){this.progress('Installing into an isolated temporary directory…');await mkdir(installRoot,{recursive:true});const installed=await runner(installer.installerPath,['/S',`/D=${installRoot}`],{timeoutMs:180_000});installedToDisk=installed.code===0;checks.push({stage:'install',passed:installedToDisk,detail:installedToDisk?'Silent isolated installation completed.':`Installer exited with code ${installed.code}.`});stopped=!installedToDisk}
      if(!stopped){const executable=await findApplicationExecutable(installRoot);if(!executable){checks.push({stage:'launch',passed:false,detail:'Installed application executable was not found.'});stopped=true}else{this.progress('Launching the installed application smoke test…');const launched=await runner(executable,[`--user-data-dir=${dataRoot}`],{timeoutMs:20_000,survivalMs:4_000,env:{...process.env,FOUNDRY_QUALIFICATION:'1'}});checks.push({stage:'launch',passed:Boolean(launched.survived),detail:launched.survived?'Installed application launched and remained healthy.':`Installed application exited early with code ${launched.code}.`})}}
    }catch(error){checks.push({stage:checks.length?'launch':'verify',passed:false,detail:error instanceof Error?error.message:String(error)})}finally{this.progress('Cleaning the isolated installation…');try{if(installedToDisk){const uninstaller=await findUninstaller(installRoot);if(uninstaller){const removed=await runner(uninstaller,['/S'],{timeoutMs:60_000});if(removed.code!==0)throw new Error(`Qualification uninstaller exited with code ${removed.code}.`)}}await safeRemove(testRoot,this.options.root);checks.push({stage:'cleanup',passed:true,detail:'Temporary installation data and registration were removed.'})}catch(error){await safeRemove(testRoot,this.options.root).catch(()=>{});checks.push({stage:'cleanup',passed:false,detail:error instanceof Error?error.message:String(error)})}}
    return this.finish(id,startedAt,checks,installerPath);
  }
  private progress(message:string):void{this.options.onProgress?.(message)}
  private finish(id:string,startedAt:string,checks:QualificationCheck[],installerPath?:string):QualificationResult{return{id,passed:checks.every(check=>check.passed),startedAt,completedAt:new Date().toISOString(),checks:[...checks],...(installerPath?{installerPath}:{})}}
}

async function findApplicationExecutable(root:string):Promise<string|undefined>{const entries=await readdir(root,{withFileTypes:true});for(const entry of entries){const path=join(root,entry.name);if(entry.isDirectory()){const nested=await findApplicationExecutable(path);if(nested)return nested}else if(entry.isFile()&&/\.exe$/i.test(entry.name)&&!/^uninstall/i.test(entry.name)&&(await stat(path)).size>1_000_000)return path}}
async function findUninstaller(root:string):Promise<string|undefined>{const entries=await readdir(root,{withFileTypes:true});for(const entry of entries){const path=join(root,entry.name);if(entry.isDirectory()){const nested=await findUninstaller(path);if(nested)return nested}else if(entry.isFile()&&/^uninstall.*\.exe$/i.test(entry.name))return path}}
async function safeRemove(target:string,root:string):Promise<void>{const resolvedTarget=resolve(target),resolvedRoot=resolve(root),rel=relative(resolvedRoot,resolvedTarget);if(!rel||rel.startsWith('..')||rel.includes(`..${sep}`))throw new Error('Refused to clean a path outside the qualification root.');await rm(resolvedTarget,{recursive:true,force:true})}
function runCommand(file:string,args:string[],options:{timeoutMs:number;survivalMs?:number;env?:NodeJS.ProcessEnv}):Promise<CommandResult>{return new Promise((resolvePromise,reject)=>{const child=spawn(file,args,{windowsHide:true,env:options.env,stdio:'ignore'});let settled=false;const finish=(value:CommandResult)=>{if(settled)return;settled=true;clearTimeout(timeout);resolvePromise(value)},timeout=setTimeout(()=>{child.kill();reject(new Error('Qualification process timed out.'))},options.timeoutMs);child.once('error',reject);child.once('exit',code=>finish({code,survived:false}));if(options.survivalMs)setTimeout(()=>{if(child.exitCode===null&&!child.killed){child.kill();finish({code:null,survived:true})}},options.survivalMs)})}
