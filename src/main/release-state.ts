import {mkdir,readFile,rename,rm,stat,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {ProjectRecord} from './workspace.ts';
import type {QualificationCheck,QualificationResult,QualificationStage} from './release-qualification.ts';

export type ReleaseState={schemaVersion:1;recordedAt:string;result:QualificationResult;installerAvailable:boolean};

const stages=new Set<QualificationStage>(['verify','package','checksum','install','launch','cleanup']);

export class ReleaseStateService{
  async get(project:ProjectRecord):Promise<ReleaseState|null>{
    try{
      const raw=await readFile(this.path(project),'utf8');
      if(Buffer.byteLength(raw,'utf8')>128_000)return null;
      const parsed=normalize(JSON.parse(raw));
      if(!parsed)return null;
      return{...parsed,installerAvailable:await fileExists(parsed.result.installerPath)};
    }catch{return null}
  }

  async save(project:ProjectRecord,result:QualificationResult):Promise<ReleaseState>{
    const normalized=normalize({schemaVersion:1,recordedAt:new Date().toISOString(),result,installerAvailable:false});
    if(!normalized)throw new Error('Release qualification produced an invalid result.');
    const directory=join(project.root,'.foundry'),target=this.path(project),temporary=`${target}.tmp`;
    await mkdir(directory,{recursive:true});
    await writeFile(temporary,JSON.stringify(normalized,null,2),'utf8');
    try{await rename(temporary,target)}catch(reason){
      const code=(reason as NodeJS.ErrnoException).code;
      if(code!=='EEXIST'&&code!=='EPERM')throw reason;
      await rm(target,{force:true});
      await rename(temporary,target);
    }
    return{...normalized,installerAvailable:await fileExists(normalized.result.installerPath)};
  }

  private path(project:ProjectRecord):string{return join(project.root,'.foundry','release-state.json')}
}

function normalize(value:unknown):ReleaseState|null{
  if(!value||typeof value!=='object')return null;
  const state=value as Partial<ReleaseState>,result=state.result as Partial<QualificationResult>|undefined;
  if(state.schemaVersion!==1||!validDate(state.recordedAt)||!result||typeof result.id!=='string'||result.id.length>100||typeof result.passed!=='boolean'||!validDate(result.startedAt)||!validDate(result.completedAt)||!Array.isArray(result.checks)||result.checks.length>12)return null;
  const checks:QualificationCheck[]=[];
  for(const item of result.checks){if(!item||typeof item!=='object')return null;const check=item as Partial<QualificationCheck>;if(!stages.has(check.stage as QualificationStage)||typeof check.passed!=='boolean'||typeof check.detail!=='string'||check.detail.length>4_000)return null;checks.push({stage:check.stage as QualificationStage,passed:check.passed,detail:check.detail})}
  if(result.installerPath!==undefined&&(typeof result.installerPath!=='string'||result.installerPath.length>2_000))return null;
  const normalizedResult:QualificationResult={id:result.id,passed:result.passed,startedAt:result.startedAt!,completedAt:result.completedAt!,checks,...(result.installerPath?{installerPath:result.installerPath}:{})};
  return{schemaVersion:1,recordedAt:state.recordedAt!,result:normalizedResult,installerAvailable:Boolean(state.installerAvailable)};
}

function validDate(value:unknown):value is string{return typeof value==='string'&&value.length<=40&&!Number.isNaN(Date.parse(value))}
async function fileExists(path?:string):Promise<boolean>{if(!path)return false;try{return(await stat(path)).isFile()}catch{return false}}
