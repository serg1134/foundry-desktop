import test from 'node:test';
import assert from 'node:assert/strict';
import {packagedManagedAiPreload,packagedManagedAiRuntime,packagedNativePreload,packagedNativeRuntime} from '../src/main/installer.ts';

test('packaged runtime injects permissioned tray and shortcut handlers',()=>{
  const source="const{app,BrowserWindow,clipboard,dialog,ipcMain,Notification}=require('electron');const capabilities={tray:true};function createWindow(){const win=new BrowserWindow({})}app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});";
  const result=packagedNativeRuntime(source);
  assert.match(result,/foundry-desktop:tray-configure/);assert.match(result,/foundry-desktop:shortcut-register/);assert.match(result,/requireCapability\('tray'\)/);assert.match(result,/registeredShortcuts\.size>=10/);assert.match(result,/!capabilities\.tray/);
});

test('packaged managed AI bridge contains only a restricted app token',()=>{const main=packagedManagedAiRuntime("ipcMain.handle('foundry-desktop:open-text',()=>{})",{gatewayUrl:'https://cloud.example',token:'fapp_restricted'}),preload=packagedManagedAiPreload('Object.freeze({openTextFile:()=>true})');assert.match(main,/\/v1\/apps\/model\/request/);assert.match(main,/fapp_restricted/);assert.doesNotMatch(main,/sk-proj|OPENAI_API_KEY/);assert.match(preload,/ai:Object\.freeze/);assert.match(preload,/foundry-desktop:ai-request/)});

test('packaged preload exposes typed tray and shortcut event APIs',()=>{
  const source="showNotification:(title,body='')=>ipcRenderer.invoke('foundry-desktop:notification-show',{title,body})";
  const result=packagedNativePreload(source);
  assert.match(result,/tray:Object\.freeze/);assert.match(result,/shortcuts:Object\.freeze/);assert.match(result,/foundry-desktop:tray-action/);assert.match(result,/foundry-desktop:shortcut-action/);
});
