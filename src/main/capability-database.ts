import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export type DatabaseEntry={key:string;value:unknown;updatedAt:string};
const SCHEMA_VERSION=1,BACKUP_LIMIT=5;

export class CapabilityDatabase{
  private database?:DatabaseSync;
  constructor(private readonly file:string){}
  async get(namespace:string,key:string):Promise<unknown|null>{this.validate(namespace,key);const row=this.db().prepare('SELECT value FROM foundry_data WHERE namespace=? AND key=?').get(namespace,key) as {value:string}|undefined;return row?JSON.parse(row.value):null}
  async set(namespace:string,key:string,value:unknown):Promise<boolean>{this.validate(namespace,key);const encoded=encodeValue(value);this.db().prepare('INSERT INTO foundry_data(namespace,key,value,updated_at) VALUES(?,?,?,?) ON CONFLICT(namespace,key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').run(namespace,key,encoded,new Date().toISOString());return true}
  async delete(namespace:string,key:string):Promise<boolean>{this.validate(namespace,key);this.db().prepare('DELETE FROM foundry_data WHERE namespace=? AND key=?').run(namespace,key);return true}
  async list(namespace:string):Promise<DatabaseEntry[]>{validatePart(namespace,'namespace');const rows=this.db().prepare('SELECT key,value,updated_at FROM foundry_data WHERE namespace=? ORDER BY updated_at DESC LIMIT 500').all(namespace) as {key:string;value:string;updated_at:string}[];return rows.map(row=>({key:row.key,value:JSON.parse(row.value),updatedAt:row.updated_at}))}
  backup():string{const database=this.db();database.exec('PRAGMA wal_checkpoint(TRUNCATE)');return this.createBackup()}
  restoreLatest():boolean{this.close();const latest=this.backups()[0];if(!latest)return false;this.quarantine();copyFileSync(latest,this.file);this.database=this.open(false);return true}
  close():void{this.database?.close();this.database=undefined}
  private validate(namespace:string,key:string):void{validatePart(namespace,'namespace');validatePart(key,'key')}
  private db():DatabaseSync{if(this.database)return this.database;try{this.database=this.open(true)}catch(error){this.database?.close();this.database=undefined;const latest=this.backups()[0];if(!latest)throw new Error(`Local database could not be opened and no backup is available: ${message(error)}`);this.quarantine();copyFileSync(latest,this.file);try{this.database=this.open(false)}catch(recoveryError){throw new Error(`Local database recovery failed: ${message(recoveryError)}`)}}return this.database}
  private open(allowMigration:boolean):DatabaseSync{const database=new DatabaseSync(this.file);try{database.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');const integrity=database.prepare('PRAGMA integrity_check').get() as {integrity_check:string};if(integrity.integrity_check!=='ok')throw new Error(`Integrity check failed: ${integrity.integrity_check}`);const row=database.prepare('PRAGMA user_version').get() as {user_version:number};if(row.user_version>SCHEMA_VERSION)throw new Error(`Database schema ${row.user_version} is newer than this app supports.`);if(row.user_version<SCHEMA_VERSION){if(!allowMigration&&row.user_version!==SCHEMA_VERSION)throw new Error('The latest backup uses an unsupported schema.');if(existsSync(this.file)&&statSync(this.file).size>0){database.exec('PRAGMA wal_checkpoint(TRUNCATE)');this.createBackup()}this.migrate(database,row.user_version)}return database}catch(error){database.close();throw error}}
  private migrate(database:DatabaseSync,from:number):void{database.exec('BEGIN IMMEDIATE');try{if(from<1)database.exec('CREATE TABLE IF NOT EXISTS foundry_data(namespace TEXT NOT NULL,key TEXT NOT NULL,value TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(namespace,key)); PRAGMA user_version=1;');database.exec('COMMIT')}catch(error){database.exec('ROLLBACK');throw error}}
  private backupDirectory():string{return join(dirname(this.file),'.foundry-backups')}
  private backups():string[]{const directory=this.backupDirectory();if(!existsSync(directory))return[];return readdirSync(directory).filter(name=>name.endsWith('.sqlite')).map(name=>join(directory,name)).sort((a,b)=>statSync(b).mtimeMs-statSync(a).mtimeMs)}
  private createBackup():string{const directory=this.backupDirectory();mkdirSync(directory,{recursive:true});const stamp=new Date().toISOString().replace(/[:.]/g,'-'),target=join(directory,`${basename(this.file)}.${stamp}.${randomUUID()}.sqlite`);copyFileSync(this.file,target);for(const stale of this.backups().slice(BACKUP_LIMIT))rmSync(stale,{force:true});return target}
  private quarantine():void{if(!existsSync(this.file))return;const target=`${this.file}.corrupt-${Date.now()}`;renameSync(this.file,target);for(const suffix of ['-wal','-shm'])rmSync(`${this.file}${suffix}`,{force:true})}
}

export async function prepareCapabilityDatabase(file:string):Promise<CapabilityDatabase>{await mkdir(dirname(file),{recursive:true});return new CapabilityDatabase(file)}
function validatePart(value:string,label:string):void{if(typeof value!=='string'||!value.trim()||value.length>100||!/^[A-Za-z0-9._:-]+$/.test(value))throw new Error(`Database ${label} must use 1–100 letters, numbers, dots, colons, underscores, or dashes.`)}
function encodeValue(value:unknown):string{const encoded=JSON.stringify(value);if(encoded===undefined)throw new Error('Database value must be JSON-compatible.');if(Buffer.byteLength(encoded,'utf8')>1_000_000)throw new Error('Database value must be smaller than 1 MB.');return encoded}
function message(error:unknown):string{return error instanceof Error?error.message:String(error)}
