import fs from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import git from 'isomorphic-git';
import type { ProjectRecord } from './workspace';

export type Checkpoint={oid:string;message:string;createdAt:string;author:string};
export type FileDiff={path:string;status:'added'|'modified'|'deleted';additions:number;deletions:number;patch:string};
export type CheckpointDiff={files:FileDiff[];additions:number;deletions:number};

const author={name:'Foundry Desktop',email:'checkpoints@foundry.local'};
const decoder=new TextDecoder();

export class CheckpointService{
  async ensure(project:ProjectRecord):Promise<void>{
    try{await git.resolveRef({fs,dir:project.root,ref:'HEAD'})}catch{
      await git.init({fs,dir:project.root,defaultBranch:'main'});
      const exclude=join(project.root,'.git','info','exclude');
      let existing='';try{existing=await readFile(exclude,'utf8')}catch{}
      const rules=['.foundry/','node_modules/','out/','dist/','target/'].filter(rule=>!existing.includes(rule));
      if(rules.length)await writeFile(exclude,`${existing}${existing&&!existing.endsWith('\n')?'\n':''}${rules.join('\n')}\n`,'utf8');
      await this.create(project,'Initial project');
    }
  }
  async create(project:ProjectRecord,messageInput:string):Promise<Checkpoint>{
    const message=messageInput.trim().slice(0,120)||'Foundry checkpoint';
    const matrix=await git.statusMatrix({fs,dir:project.root});
    await Promise.all(matrix.map(async([filepath,,worktreeStatus])=>{if(worktreeStatus===0)await git.remove({fs,dir:project.root,filepath});else await git.add({fs,dir:project.root,filepath})}));
    const oid=await git.commit({fs,dir:project.root,message,author});
    const checkpoint={oid,message,createdAt:new Date().toISOString(),author:author.name};
    const history=await this.readIndex(project);await this.writeIndex(project,[checkpoint,...history.filter(item=>item.oid!==oid)]);return checkpoint;
  }
  async list(project:ProjectRecord):Promise<Checkpoint[]>{await this.ensure(project);const indexed=await this.readIndex(project);if(indexed.length)return indexed;const commits=await git.log({fs,dir:project.root,depth:50});return commits.map(item=>({oid:item.oid,message:item.commit.message.trim(),createdAt:new Date(item.commit.author.timestamp*1000).toISOString(),author:item.commit.author.name}))}
  async diff(project:ProjectRecord,oid:string):Promise<CheckpointDiff>{
    this.assertOid(oid);await this.ensure(project);const matrix=await git.statusMatrix({fs,dir:project.root,ref:oid});const files:FileDiff[]=[];
    for(const[filepath,headStatus,worktreeStatus]of matrix){if(headStatus===worktreeStatus)continue;const before=await this.readAt(project,oid,filepath),after=await this.readWorktree(project,filepath);const status=headStatus===0?'added':worktreeStatus===0?'deleted':'modified';const rendered=this.renderDiff(filepath,before,after);files.push({path:filepath,status,...rendered})}
    return{files,additions:files.reduce((sum,file)=>sum+file.additions,0),deletions:files.reduce((sum,file)=>sum+file.deletions,0)};
  }
  async restore(project:ProjectRecord,oid:string):Promise<void>{this.assertOid(oid);await this.ensure(project);const known=(await this.list(project)).some(item=>item.oid===oid);if(!known)throw new Error('Checkpoint is not registered for this project.');await this.create(project,'Automatic backup before restore');await git.checkout({fs,dir:project.root,ref:oid,force:true})}
  private renderDiff(path:string,before:string,after:string):Pick<FileDiff,'additions'|'deletions'|'patch'>{
    if(before.includes('\0')||after.includes('\0'))return{additions:0,deletions:0,patch:'Binary file changed'};
    const oldLines=before.split('\n'),newLines=after.split('\n');let prefix=0;while(prefix<oldLines.length&&prefix<newLines.length&&oldLines[prefix]===newLines[prefix])prefix++;let oldEnd=oldLines.length-1,newEnd=newLines.length-1;while(oldEnd>=prefix&&newEnd>=prefix&&oldLines[oldEnd]===newLines[newEnd]){oldEnd--;newEnd--}const removed=oldLines.slice(prefix,oldEnd+1),added=newLines.slice(prefix,newEnd+1),lines=[`--- a/${path}`,`+++ b/${path}`,`@@ -${prefix+1},${removed.length} +${prefix+1},${added.length} @@`,...removed.map(line=>`-${line}`),...added.map(line=>`+${line}`)].slice(0,204);return{additions:added.length,deletions:removed.length,patch:lines.join('\n')}
  }
  private async readAt(project:ProjectRecord,oid:string,path:string):Promise<string>{try{const result=await git.readBlob({fs,dir:project.root,oid,filepath:path});return decoder.decode(result.blob)}catch{return''}}
  private async readWorktree(project:ProjectRecord,path:string):Promise<string>{try{return await readFile(join(project.root,...path.split('/')),'utf8')}catch{return''}}
  private indexFile(project:ProjectRecord):string{return join(project.root,'.git','foundry-checkpoints.json')}
  private async readIndex(project:ProjectRecord):Promise<Checkpoint[]>{try{return JSON.parse(await readFile(this.indexFile(project),'utf8')) as Checkpoint[]}catch{return[]}}
  private async writeIndex(project:ProjectRecord,value:Checkpoint[]):Promise<void>{await writeFile(this.indexFile(project),JSON.stringify(value.slice(0,100),null,2),'utf8')}
  private assertOid(oid:string):void{if(!/^[a-f0-9]{40}$/i.test(oid))throw new Error('Invalid checkpoint id.')}
}
