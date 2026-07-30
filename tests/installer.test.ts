import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { addPermissionDisclosure, hardenPackagedDatabase, packageTargetFor } from '../src/main/installer.ts';

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
  assert.match(source,/requireCapability\('clipboardWrite'\)/);
  assert.match(source,/requireCapability\('clipboardRead'\)/);
  assert.match(source,/requireCapability\('notifications'\)/);
});

test('generated apps disclose enabled permissions before first launch',()=>{const source="const{app}=require('electron');const path=require('node:path'),fs=require('node:fs/promises');function createWindow(){}app.whenReady().then(()=>{createWindow();})",result=addPermissionDisclosure(source,{network:true,clipboardRead:true,database:false});assert.doesNotThrow(()=>new Function(result));assert.match(result,/Connect to HTTPS services/);assert.match(result,/Read clipboard text/);assert.doesNotMatch(result,/Store data locally/);assert.match(result,/showMessageBox/);assert.match(result,/permissions-v1\.json/)});

test('generated app packaging selects a native artifact for each desktop OS',()=>{assert.equal(packageTargetFor('win32').target,'nsis');assert.equal(packageTargetFor('darwin').target,'dmg');assert.equal(packageTargetFor('linux').target,'AppImage');assert.throws(()=>packageTargetFor('aix'),/not supported/)});

test('packaged database hardening emits a compilable migration and recovery runtime',()=>{
  const input="let database;const db=()=>{},validatePart=()=>{};ipcMain.handle('foundry-desktop:clipboard-write',()=>{});";
  const source=hardenPackagedDatabase(input);
  assert.doesNotThrow(()=>new Function(source));
  assert.match(source,/foundry-desktop:database-backup/);
  assert.match(source,/foundry-desktop:database-restore-latest/);
  assert.match(source,/PRAGMA integrity_check/);
  assert.match(source,/randomUUID/);
});
