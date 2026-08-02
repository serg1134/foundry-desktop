import {createHash} from 'node:crypto';
import {mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {basename,join,resolve} from 'node:path';
import {InstallerService} from '../src/main/installer.ts';
import {PreviewService} from '../src/main/preview.ts';
import {ProjectConfigService} from '../src/main/project-config.ts';
import {WorkspaceService} from '../src/main/workspace.ts';

main().catch(error=>{console.error(error);process.exitCode=1});

async function main(){
const requested=process.argv[2]??join(process.cwd(),'qualification-campaign-current');
const campaignRoot=resolve(requested);
if(!basename(campaignRoot).startsWith('qualification-campaign-'))throw new Error('Qualification output directory must start with qualification-campaign-.');

await rm(campaignRoot,{recursive:true,force:true});
await mkdir(campaignRoot,{recursive:true});
const projectsRoot=join(campaignRoot,'projects');
await mkdir(projectsRoot);

const workspace=new WorkspaceService(join(campaignRoot,'projects.json'));
const protector={encrypt:async value=>Buffer.from(value).toString('base64'),decrypt:async value=>Buffer.from(value,'base64').toString()};
const configs=new ProjectConfigService(protector);
const installer=new InstallerService(new PreviewService(process.cwd()),configs);
const cases=[
  {id:'notes',name:'Qualification Notes',template:'notes'},
  {id:'tasks',name:'Qualification Tasks',template:'tasks'},
  {id:'expenses',name:'Qualification Expenses',template:'expenses'}
];
const startedAt=new Date().toISOString(),results=[];

for(const item of cases){
  const started=Date.now();
  process.stdout.write(`[${item.id}] creating project\n`);
  const project=await workspace.createProject(projectsRoot,item.name,item.template);
  const rendered=await new PreviewService(process.cwd()).build(project,true);
  if(!rendered.html.includes('<div id="root"></div>'))throw new Error(`${item.name} did not produce a renderer root.`);
  process.stdout.write(`[${item.id}] packaging desktop installer\n`);
  const artifact=await installer.build(project,message=>process.stdout.write(`[${item.id}] ${message}\n`),{qualification:true});
  const expected=(await readFile(artifact.checksumPath,'utf8')).trim().split(/\s+/)[0].toLowerCase();
  const actual=createHash('sha256').update(await readFile(artifact.installerPath)).digest('hex');
  if(expected!==actual)throw new Error(`${item.name} checksum mismatch.`);
  const unpackedExecutable=await findExecutable(artifact.outputDirectory,item.name);
  if(!unpackedExecutable)throw new Error(`${item.name} unpacked desktop executable was not produced.`);
  results.push({
    id:item.id,
    name:item.name,
    projectRoot:project.root,
    installerPath:artifact.installerPath,
    unpackedExecutable,
    checksum:actual,
    durationMs:Date.now()-started
  });
}

const report={startedAt,completedAt:new Date().toISOString(),passed:true,cases:results};
await writeFile(join(campaignRoot,'qualification-report.json'),JSON.stringify(report,null,2),'utf8');
process.stdout.write(`${JSON.stringify(report,null,2)}\n`);
}

async function findExecutable(root,name){
  for(const entry of await readdir(root,{recursive:true,withFileTypes:true})){
    if(!entry.isFile()||entry.name.toLowerCase()!==`${name}.exe`.toLowerCase())continue;
    const parent=typeof entry.parentPath==='string'?entry.parentPath:entry.path;
    return join(parent,entry.name);
  }
}
