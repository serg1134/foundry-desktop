import { app } from 'electron';
import updaterPackage from 'electron-updater';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export type UpdatePhase='disabled'|'idle'|'checking'|'available'|'current'|'downloading'|'ready'|'error';
export type UpdateStatus={phase:UpdatePhase;message:string;version?:string;progress?:number};
const { autoUpdater }=updaterPackage;

export class UpdateService{
  private status:UpdateStatus;
  constructor(private readonly send:(status:UpdateStatus)=>void){
    const url=process.env.FOUNDRY_UPDATE_URL?.trim(),embedded=app.isPackaged&&existsSync(join(process.resourcesPath,'app-update.yml'));
    this.status=!app.isPackaged?{phase:'disabled',message:'Updates are available in installed builds.'}:!url&&!embedded?{phase:'disabled',message:'Release channel is not configured yet.'}:{phase:'idle',message:'Ready to check for updates.'};
    if((!url&&!embedded)||!app.isPackaged)return;
    autoUpdater.autoDownload=false;autoUpdater.autoInstallOnAppQuit=true;if(url)autoUpdater.setFeedURL({provider:'generic',url});
    autoUpdater.on('checking-for-update',()=>this.set({phase:'checking',message:'Checking for updates…'}));
    autoUpdater.on('update-available',info=>this.set({phase:'available',message:`Foundry ${info.version} is available.`,version:info.version}));
    autoUpdater.on('update-not-available',info=>this.set({phase:'current',message:'You have the latest version.',version:info.version}));
    autoUpdater.on('download-progress',value=>this.set({phase:'downloading',message:`Downloading update… ${Math.round(value.percent)}%`,progress:Math.round(value.percent)}));
    autoUpdater.on('update-downloaded',info=>this.set({phase:'ready',message:`Foundry ${info.version} is ready to install.`,version:info.version,progress:100}));
    autoUpdater.on('error',error=>this.set({phase:'error',message:`Update check failed: ${error.message}`}));
  }
  current():UpdateStatus{return this.status}
  async check():Promise<UpdateStatus>{this.requireEnabled();await autoUpdater.checkForUpdates();return this.status}
  async download():Promise<UpdateStatus>{if(this.status.phase!=='available')throw new Error('No update is ready to download.');await autoUpdater.downloadUpdate();return this.status}
  install():void{if(this.status.phase!=='ready')throw new Error('Finish downloading the update before installing it.');autoUpdater.quitAndInstall(false,true)}
  private requireEnabled():void{if(this.status.phase==='disabled')throw new Error(this.status.message)}
  private set(status:UpdateStatus):void{this.status=status;this.send(status)}
}
