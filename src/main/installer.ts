import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Arch, build, Platform } from 'electron-builder';
import type { ProjectRecord } from './workspace';
import type { PreviewService } from './preview';
import type { ProjectConfigService } from './project-config';

export type InstallerResult={installerPath:string;outputDirectory:string;signed:boolean};

export class InstallerService{
  constructor(private readonly preview:PreviewService,private readonly configs:ProjectConfigService){}

  async build(project:ProjectRecord,onProgress:(message:string)=>void=()=>{}):Promise<InstallerResult>{
    const config=await this.configs.get(project),staging=join(project.root,'.foundry','installer'),outputDirectory=join(project.root,'.foundry','releases');
    await mkdir(staging,{recursive:true});await mkdir(outputDirectory,{recursive:true});
    onProgress('Compiling the application…');
    const rendered=await this.preview.build(project,true);
    await writeFile(join(staging,'app.html'),rendered.html,'utf8');
    await writeFile(join(staging,'main.cjs'),runtimeMain,'utf8');
    await writeFile(join(staging,'package.json'),JSON.stringify({name:safeId(config.displayName),productName:config.displayName,description:config.description,author:config.publisher||'Foundry user',version:config.version,private:true,main:'main.cjs'},null,2),'utf8');
    onProgress('Packaging the Windows application…');
    await build({projectDir:staging,targets:Platform.WINDOWS.createTarget('nsis',[Arch.x64]),config:{appId:config.appId,productName:config.displayName,electronVersion:process.versions.electron,asar:false,files:['app.html','main.cjs','package.json'],directories:{output:outputDirectory},artifactName:'${productName}-Setup-${version}.${ext}',win:{target:'nsis',...(config.icon?{icon:join(project.root,config.icon)}:{})},nsis:{oneClick:config.installer.oneClick,allowToChangeInstallationDirectory:config.installer.allowDirectorySelection,createDesktopShortcut:config.installer.desktopShortcut,createStartMenuShortcut:config.installer.startMenuShortcut}}});
    const files=await readdir(outputDirectory),installer=files.find(name=>/\.exe$/i.test(name)&&!/unpacked/i.test(name));
    if(!installer)throw new Error('Packaging completed, but no Windows installer was produced.');
    const signed=Boolean(process.env.CSC_LINK||process.env.WIN_CSC_LINK);onProgress(signed?'Signed installer ready.':'Unsigned installer ready.');return{installerPath:join(outputDirectory,installer),outputDirectory,signed};
  }
}

function safeId(name:string):string{return name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'foundry-app'}

const runtimeMain=`const{app,BrowserWindow}=require('electron');const path=require('node:path');function createWindow(){const win=new BrowserWindow({title:app.getName(),width:1200,height:800,minWidth:720,minHeight:480,backgroundColor:'#0b0d12',autoHideMenuBar:true,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',event=>event.preventDefault());win.loadFile(path.join(__dirname,'app.html'));}app.whenReady().then(()=>{createWindow();app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow()})});app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});`;
