import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';

export type CrashSource='foundry-renderer'|'desktop-runtime'|'main-process';
export type CrashReport={id:string;at:string;source:CrashSource;message:string;fingerprint:string;appVersion:string;platform:string;projectId?:string};

export class CrashReportService{
  constructor(private readonly file:string,private readonly appVersion:string,private readonly platform=process.platform){}
  async record(input:{source:CrashSource;message:unknown;projectId?:string}):Promise<CrashReport>{
    const message=redactDiagnostic(input.message),report:CrashReport={id:randomUUID(),at:new Date().toISOString(),source:input.source,message,fingerprint:createHash('sha256').update(`${input.source}:${message}`).digest('hex').slice(0,12),appVersion:this.appVersion,platform:this.platform,...(input.projectId?{projectId:input.projectId}:{})},reports=await this.list();
    await mkdir(dirname(this.file),{recursive:true});await writeFile(this.file,JSON.stringify([report,...reports].slice(0,100),null,2),'utf8');return report;
  }
  async list(projectId?:string):Promise<CrashReport[]>{try{const value=JSON.parse(await readFile(this.file,'utf8'));if(!Array.isArray(value))return[];const reports=value.filter(isCrashReport) as CrashReport[];return projectId?reports.filter(report=>report.projectId===projectId):reports}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return[];throw error}}
}

export function redactDiagnostic(value:unknown):string{
  const raw=value instanceof Error?(value.stack||value.message):String(value??'Unknown error');
  return raw.replace(/\b(?:sk|rk|pk|whsec|sess|token|secret)[-_][A-Za-z0-9_-]{8,}\b/gi,'<redacted-secret>').replace(/\bBearer\s+[^\s"']+/gi,'Bearer <redacted>').replace(/[A-Z]:\\Users\\[^\\\s]+/gi,'<user-home>').replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'<redacted-email>').split(/\r?\n/).slice(0,20).join('\n').slice(0,4000);
}

function isCrashReport(value:unknown):boolean{if(!value||typeof value!=='object')return false;const item=value as Partial<CrashReport>;return typeof item.id==='string'&&typeof item.at==='string'&&typeof item.source==='string'&&typeof item.message==='string'&&typeof item.fingerprint==='string'}
