import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('foundryDesktop',Object.freeze({
  openTextFile:():Promise<{name:string;content:string}|null>=>ipcRenderer.invoke('desktop-file:open-text'),
  saveTextFile:(content:string,suggestedName='document.txt'):Promise<boolean>=>ipcRenderer.invoke('desktop-file:save-text',{content,suggestedName}),
  chooseFolder:():Promise<{name:string;files:{path:string;size:number}[];truncated:boolean}|null>=>ipcRenderer.invoke('desktop-folder:choose'),
  database:Object.freeze({
    get:(namespace:string,key:string):Promise<unknown|null>=>ipcRenderer.invoke('desktop-database:get',{namespace,key}),
    set:(namespace:string,key:string,value:unknown):Promise<boolean>=>ipcRenderer.invoke('desktop-database:set',{namespace,key,value}),
    delete:(namespace:string,key:string):Promise<boolean>=>ipcRenderer.invoke('desktop-database:delete',{namespace,key}),
    list:(namespace:string):Promise<{key:string;value:unknown;updatedAt:string}[]>=>ipcRenderer.invoke('desktop-database:list',{namespace})
  }),
  writeClipboardText:(text:string):Promise<boolean>=>ipcRenderer.invoke('desktop:clipboard-write',text),
  showNotification:(title:string,body=''):Promise<boolean>=>ipcRenderer.invoke('desktop:notification-show',{title,body})
}));
