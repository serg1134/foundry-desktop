import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { addPermissionDisclosure, electronBuilderPackagePath, hardenPackagedDatabase, hardenPackagedRuntime, packageTargetFor } from '../src/main/installer.ts';

test('generated desktop runtime applies configured identity and window behavior',async()=>{
  const source=await readFile(new URL('../src/main/installer.ts',import.meta.url),'utf8');
  assert.match(source,/title:config\.displayName/);
  assert.match(source,/width:config\.window\.width/);
  assert.match(source,/height:config\.window\.height/);
  assert.match(source,/resizable:config\.window\.resizable/);
  assert.match(source,/maximizable:config\.window\.maximizable/);
  assert.match(source,/createHash\('sha256'\)/);
  assert.match(source,/preload\.cjs/);
  assert.match(source,/foundry-desktop:open-text/);
  assert.match(source,/foundry-desktop:save-text/);
  assert.match(source,/foundry-desktop:clipboard-write/);
  assert.match(source,/foundry-desktop:clipboard-read/);
  assert.match(source,/foundry-desktop:notification-show/);
  assert.match(source,/foundry-desktop:folder-choose/);
  assert.match(source,/foundry-desktop:database-set/);
  assert.match(source,/foundry-desktop:database-backup/);
  assert.match(source,/foundry-desktop:database-restore-latest/);
  assert.match(source,/PRAGMA user_version=1/);
  assert.match(source,/PRAGMA integrity_check/);
  assert.match(source,/\.foundry-backups/);
  assert.match(source,/DatabaseSync/);
  assert.match(source,/asar:true/);
  assert.match(source,/electronLanguages:\['en-US'\]/);
  assert.match(source,/hardenPackagedRuntime\(hardenPackagedDatabase\(addPermissionDisclosure\(runtimeMain\(config\)/);
});

test('generated apps disclose enabled permissions before first launch',()=>{const source="const{app}=require('electron');const path=require('node:path'),fs=require('node:fs/promises');function createWindow(){}app.whenReady().then(()=>{createWindow();})",result=addPermissionDisclosure(source,{network:true,clipboardRead:true,database:false});assert.doesNotThrow(()=>new Function(result));assert.match(result,/Connect to HTTPS services/);assert.match(result,/Read clipboard text/);assert.doesNotMatch(result,/Store data locally/);assert.match(result,/showMessageBox/);assert.match(result,/permissions-v1\.json/)});

test('generated app packaging selects a native artifact for each desktop OS',()=>{assert.equal(packageTargetFor('win32').target,'nsis');assert.equal(packageTargetFor('darwin').target,'dmg');assert.equal(packageTargetFor('linux').target,'AppImage');assert.throws(()=>packageTargetFor('aix'),/not supported/)});

test('generated runtime enforces sender identity and network permission at runtime',()=>{
  const handlers=[
    "ipcMain.handle('foundry-desktop:open-text',async()=>{requireCapability('openTextFile')})",
    "ipcMain.handle('foundry-desktop:save-text',async(_event,value)=>{requireCapability('saveTextFile')})",
    "ipcMain.handle('foundry-desktop:folder-choose',async()=>{requireCapability('folderRead')})",
    "ipcMain.handle('foundry-desktop:database-get',(_event,value)=>{requireCapability('database')})",
    "ipcMain.handle('foundry-desktop:database-set',(_event,value)=>{requireCapability('database')})",
    "ipcMain.handle('foundry-desktop:database-delete',(_event,value)=>{requireCapability('database')})",
    "ipcMain.handle('foundry-desktop:database-list',(_event,value)=>{requireCapability('database')})",
    "ipcMain.handle('foundry-desktop:clipboard-write',(_event,value)=>{requireCapability('clipboardWrite')})",
    "ipcMain.handle('foundry-desktop:notification-show',(_event,value)=>{requireCapability('notifications')})"
  ].join(';');
  const input=`const capabilities={network:false},requireCapability=name=>{if(!capabilities[name])throw new Error('This app is not allowed to use '+name+'. Enable it before packaging.')};let database;${handlers};function createWindow(){const win=new BrowserWindow({});win.webContents.setWindowOpenHandler(()=>({action:'deny'}));}`;
  const result=hardenPackagedRuntime(input);
  assert.match(result,/event\.sender!==mainWindow\.webContents/);
  assert.match(result,/requireCapability\('openTextFile',event\)/);
  assert.match(result,/requireCapability\('database',event\)/);
  assert.match(result,/onBeforeRequest/);
  assert.match(result,/!capabilities\.network\|\|!secure/);
  assert.match(result,/protocol==='https:'\|\|protocol==='wss:'/);
  assert.doesNotMatch(result,/async\(_event,value\)/);
});

test('packaged Foundry loads electron-builder from the unpacked dependency tree',()=>{
  const resourcesPath=join('app','resources'),appPath=join(resourcesPath,'app.asar'),repoPath=join('repo');
  assert.equal(electronBuilderPackagePath(appPath,resourcesPath,true),join(resourcesPath,'app.asar.unpacked','node_modules','electron-builder'));
  assert.equal(electronBuilderPackagePath(repoPath,repoPath,false),join(repoPath,'node_modules','electron-builder'));
});

test('packaged database hardening emits a compilable migration and recovery runtime',()=>{
  const input="let database;const db=()=>{},validatePart=()=>{};ipcMain.handle('foundry-desktop:clipboard-write',()=>{});";
  const source=hardenPackagedDatabase(input);
  assert.doesNotThrow(()=>new Function(source));
  assert.match(source,/foundry-desktop:database-backup/);
  assert.match(source,/foundry-desktop:database-restore-latest/);
  assert.match(source,/PRAGMA integrity_check/);
  assert.match(source,/randomUUID/);
});

test('database and sender hardening compose in the production installer order',()=>{
  const handlers=[
    "ipcMain.handle('foundry-desktop:open-text',async()=>{requireCapability('openTextFile')})",
    "ipcMain.handle('foundry-desktop:save-text',async(_event,value)=>{requireCapability('saveTextFile')})",
    "ipcMain.handle('foundry-desktop:folder-choose',async()=>{requireCapability('folderRead')})",
    "ipcMain.handle('foundry-desktop:database-get',(_event,value)=>{requireCapability('database')})",
    "ipcMain.handle('foundry-desktop:database-set',(_event,value)=>{requireCapability('database')})",
    "ipcMain.handle('foundry-desktop:database-delete',(_event,value)=>{requireCapability('database')})",
    "ipcMain.handle('foundry-desktop:database-list',(_event,value)=>{requireCapability('database')})",
    "ipcMain.handle('foundry-desktop:clipboard-write',(_event,value)=>{requireCapability('clipboardWrite')})",
    "ipcMain.handle('foundry-desktop:notification-show',(_event,value)=>{requireCapability('notifications')})"
  ].join(';');
  const input=`const capabilities={database:true,network:false},requireCapability=name=>{if(!capabilities[name])throw new Error('This app is not allowed to use '+name+'. Enable it before packaging.')};let database;const db=()=>{},validatePart=()=>{};${handlers};function createWindow(){const win=new BrowserWindow({});win.webContents.setWindowOpenHandler(()=>({action:'deny'}));}`;
  const source=hardenPackagedRuntime(hardenPackagedDatabase(input));
  assert.doesNotThrow(()=>new Function(source));
  assert.match(source,/foundry-desktop:database-backup/);
  assert.match(source,/requireCapability\('database',event\)/);
  assert.match(source,/event\.sender!==mainWindow\.webContents/);
});
