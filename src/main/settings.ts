import { safeStorage } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

type StoredSettings={encryptedApiKey?:string;model?:string};
export type PublicSettings={configured:boolean;model:string};
const DEFAULT_MODEL='gpt-5.6-sol';

export class SettingsService{
  constructor(private readonly file:string){}
  async publicSettings():Promise<PublicSettings>{const value=await this.read();return{configured:Boolean(value.encryptedApiKey),model:value.model||DEFAULT_MODEL}}
  async saveApiKey(apiKey:string):Promise<PublicSettings>{const value=apiKey.trim();if(value.length<20)throw new Error('Enter a valid OpenAI API key.');if(!safeStorage.isEncryptionAvailable())throw new Error('Secure credential storage is unavailable on this device.');const settings=await this.read();settings.encryptedApiKey=safeStorage.encryptString(value).toString('base64');settings.model=settings.model||DEFAULT_MODEL;await this.write(settings);return this.publicSettings()}
  async clearApiKey():Promise<PublicSettings>{const settings=await this.read();delete settings.encryptedApiKey;await this.write(settings);return this.publicSettings()}
  async apiKey():Promise<string>{const settings=await this.read();if(!settings.encryptedApiKey)throw new Error('Add an OpenAI API key in Settings before running the agent.');if(!safeStorage.isEncryptionAvailable())throw new Error('Secure credential storage is unavailable.');return safeStorage.decryptString(Buffer.from(settings.encryptedApiKey,'base64'))}
  private async read():Promise<StoredSettings>{try{return JSON.parse(await readFile(this.file,'utf8')) as StoredSettings}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return{};throw error}}
  private async write(value:StoredSettings):Promise<void>{await mkdir(dirname(this.file),{recursive:true});await writeFile(this.file,JSON.stringify(value,null,2),'utf8')}
}
