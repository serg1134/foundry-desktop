import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('foundryDesktop',Object.freeze({
  ai:Object.freeze({request:(payload:Record<string,unknown>):Promise<Record<string,unknown>>=>ipcRenderer.invoke('desktop:ai-request',payload)}),
  openTextFile:():Promise<{name:string;content:string}|null>=>ipcRenderer.invoke('desktop-file:open-text'),
  saveTextFile:(content:string,suggestedName='document.txt'):Promise<boolean>=>ipcRenderer.invoke('desktop-file:save-text',{content,suggestedName}),
  chooseFolder:():Promise<{name:string;files:{path:string;size:number}[];truncated:boolean}|null>=>ipcRenderer.invoke('desktop-folder:choose'),
  database:Object.freeze({
    get:(namespace:string,key:string):Promise<unknown|null>=>ipcRenderer.invoke('desktop-database:get',{namespace,key}),
    set:(namespace:string,key:string,value:unknown):Promise<boolean>=>ipcRenderer.invoke('desktop-database:set',{namespace,key,value}),
    delete:(namespace:string,key:string):Promise<boolean>=>ipcRenderer.invoke('desktop-database:delete',{namespace,key}),
    list:(namespace:string):Promise<{key:string;value:unknown;updatedAt:string}[]>=>ipcRenderer.invoke('desktop-database:list',{namespace}),
    backup:():Promise<boolean>=>ipcRenderer.invoke('desktop-database:backup'),
    restoreLatest:():Promise<boolean>=>ipcRenderer.invoke('desktop-database:restore-latest')
  }),
  readClipboardText:():Promise<string>=>ipcRenderer.invoke('desktop:clipboard-read'),
  writeClipboardText:(text:string):Promise<boolean>=>ipcRenderer.invoke('desktop:clipboard-write',text),
  showNotification:(title:string,body=''):Promise<boolean>=>ipcRenderer.invoke('desktop:notification-show',{title,body}),
  tray:Object.freeze({
    configure:(tooltip:string,items:{id:string;label:string}[]):Promise<boolean>=>ipcRenderer.invoke('desktop:tray-configure',{tooltip,items}),
    onAction:(listener:(id:string)=>void):(()=>void)=>{const handler=(_:unknown,id:string)=>listener(id);ipcRenderer.on('foundry-desktop:tray-action',handler);return()=>ipcRenderer.removeListener('foundry-desktop:tray-action',handler)}
  }),
  shortcuts:Object.freeze({
    register:(accelerator:string,id:string):Promise<boolean>=>ipcRenderer.invoke('desktop:shortcut-register',{accelerator,id}),
    clear:():Promise<boolean>=>ipcRenderer.invoke('desktop:shortcuts-clear'),
    onAction:(listener:(id:string)=>void):(()=>void)=>{const handler=(_:unknown,id:string)=>listener(id);ipcRenderer.on('foundry-desktop:shortcut-action',handler);return()=>ipcRenderer.removeListener('foundry-desktop:shortcut-action',handler)}
  }),
  menus:Object.freeze({
    configure:(items:{id:string;label:string;accelerator?:string}[]):Promise<boolean>=>ipcRenderer.invoke('desktop:menu-configure',{items}),
    onAction:(listener:(id:string)=>void):(()=>void)=>{const handler=(_:unknown,id:string)=>listener(id);ipcRenderer.on('foundry-desktop:menu-action',handler);return()=>ipcRenderer.removeListener('foundry-desktop:menu-action',handler)}
  }),
  deepLinks:Object.freeze({
    getInitial:():Promise<string|null>=>ipcRenderer.invoke('desktop:deep-link-initial'),
    onOpen:(listener:(url:string)=>void):(()=>void)=>{const handler=(_:unknown,url:string)=>listener(url);ipcRenderer.on('foundry-desktop:deep-link-open',handler);return()=>ipcRenderer.removeListener('foundry-desktop:deep-link-open',handler)}
  })
}));
