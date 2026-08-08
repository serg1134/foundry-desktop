import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import test from 'node:test';

async function sourceFiles(root:string):Promise<string[]>{
  const files:string[]=[];
  for(const entry of await readdir(root,{withFileTypes:true})){
    const path=join(root,entry.name);
    if(entry.isDirectory())files.push(...await sourceFiles(path));
    else if(entry.isFile()&&/\.(?:ts|tsx)$/.test(entry.name))files.push(path);
  }
  return files;
}

test('production runtime never invokes PowerShell or enables a child shell',async()=>{
  const root=join(process.cwd(),'src'),files=await sourceFiles(root);
  for(const file of files){
    const source=await readFile(file,'utf8');
    assert.doesNotMatch(source,/\b(?:powershell|pwsh)(?:\.exe)?\b|ExecutionPolicy|Start-Process/i,`${file} must not invoke PowerShell`);
    assert.doesNotMatch(source,/shell\s*:\s*true/,`${file} must not enable shell command parsing`);
  }
});

test('Windows qualification terminates apps through the trusted system utility',async()=>{
  const source=await readFile(join(process.cwd(),'src/main/release-qualification.ts'),'utf8');
  assert.match(source,/join\(process\.env\.SystemRoot\|\|'C:\\\\Windows','System32','taskkill\.exe'\)/);
  assert.match(source,/spawn\(taskkill,\['\/pid',String\(pid\),'\/T','\/F'\],\{shell:false/);
});

test('generated application runtime does not expose process execution',async()=>{
  const source=await readFile(join(process.cwd(),'src/main/installer.ts'),'utf8');
  const runtimeStart=source.indexOf('function runtimeMain('),runtimeEnd=source.indexOf('export function hardenPackagedDatabase',runtimeStart);
  assert.ok(runtimeStart>=0&&runtimeEnd>runtimeStart,'generated runtime source markers must exist');
  const generatedRuntime=source.slice(runtimeStart,runtimeEnd);
  assert.doesNotMatch(generatedRuntime,/child_process|execFile|spawn\(|shell\s*:/);
});

test('direct release packager wrapper stays shell-free',async()=>{
  const source=await readFile(join(process.cwd(),'scripts/electron-builder-shim.cjs'),'utf8');
  assert.doesNotMatch(source,/powershell|pwsh|child_process|execFile|spawn\(|shell\s*:/i);
  assert.match(source,/if\(process\.versions\.electron\)/);
  assert.match(source,/process\.noAsar=true/);
  assert.match(source,/require\('electron-builder\/out\/cli\/cli\.js'\)/);
});
