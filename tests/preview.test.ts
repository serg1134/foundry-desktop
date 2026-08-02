import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp } from 'node:fs/promises';
import { configurePackagedEsbuild, previewCsp, previewDependencyRoot, storageShim } from '../src/main/preview.ts';

test('preview supplies safe form storage and UUID compatibility shims',()=>{
 assert.match(storageShim,/localStorage/);assert.match(storageShim,/let usable=false/);assert.match(storageShim,/crypto\.randomUUID\(\)/);assert.match(storageShim,/configurable:true/);
});

test('preview network access is denied by default and enabled per project',()=>{
 assert.doesNotMatch(previewCsp(),/connect-src https:/);assert.match(previewCsp(true),/connect-src https: wss:/);
});

test('packaged previews use the executable outside app.asar',async()=>{
 const resources=await mkdtemp(join(tmpdir(),'foundry-esbuild-')),binary=join(resources,'app.asar.unpacked','node_modules','@esbuild','win32-x64','esbuild.exe');
 await mkdir(join(binary,'..'),{recursive:true});await writeFile(binary,'test');
 const previous=process.env.ESBUILD_BINARY_PATH;
 try{assert.equal(configurePackagedEsbuild(resources,'win32','x64'),binary);assert.equal(process.env.ESBUILD_BINARY_PATH,binary)}finally{if(previous===undefined)delete process.env.ESBUILD_BINARY_PATH;else process.env.ESBUILD_BINARY_PATH=previous}
});
test('packaged previews resolve browser dependencies outside app.asar',()=>{assert.equal(previewDependencyRoot('C:\\app\\resources\\app.asar','C:\\app\\resources',true),join('C:\\app\\resources','app.asar.unpacked'));assert.equal(previewDependencyRoot('C:\\repo','C:\\repo',false),'C:\\repo')});
