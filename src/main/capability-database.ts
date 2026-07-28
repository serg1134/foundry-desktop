import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type DatabaseEntry={key:string;value:unknown;updatedAt:string};

export class CapabilityDatabase{
  private database?:DatabaseSync;
  constructor(private readonly file:string){}
  async get(namespace:string,key:string):Promise<unknown|null>{this.validate(namespace,key);const row=this.db().prepare('SELECT value FROM foundry_data WHERE namespace=? AND key=?').get(namespace,key) as {value:string}|undefined;return row?JSON.parse(row.value):null}
  async set(namespace:string,key:string,value:unknown):Promise<boolean>{this.validate(namespace,key);const encoded=encodeValue(value);this.db().prepare('INSERT INTO foundry_data(namespace,key,value,updated_at) VALUES(?,?,?,?) ON CONFLICT(namespace,key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').run(namespace,key,encoded,new Date().toISOString());return true}
  async delete(namespace:string,key:string):Promise<boolean>{this.validate(namespace,key);this.db().prepare('DELETE FROM foundry_data WHERE namespace=? AND key=?').run(namespace,key);return true}
  async list(namespace:string):Promise<DatabaseEntry[]>{validatePart(namespace,'namespace');const rows=this.db().prepare('SELECT key,value,updated_at FROM foundry_data WHERE namespace=? ORDER BY updated_at DESC LIMIT 500').all(namespace) as {key:string;value:string;updated_at:string}[];return rows.map(row=>({key:row.key,value:JSON.parse(row.value),updatedAt:row.updated_at}))}
  close():void{this.database?.close();this.database=undefined}
  private validate(namespace:string,key:string):void{validatePart(namespace,'namespace');validatePart(key,'key')}
  private db():DatabaseSync{if(this.database)return this.database;this.database=new DatabaseSync(this.file);this.database.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS foundry_data(namespace TEXT NOT NULL,key TEXT NOT NULL,value TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(namespace,key));');return this.database}
}

export async function prepareCapabilityDatabase(file:string):Promise<CapabilityDatabase>{await mkdir(dirname(file),{recursive:true});return new CapabilityDatabase(file)}
function validatePart(value:string,label:string):void{if(typeof value!=='string'||!value.trim()||value.length>100||!/^[A-Za-z0-9._:-]+$/.test(value))throw new Error(`Database ${label} must use 1–100 letters, numbers, dots, colons, underscores, or dashes.`)}
function encodeValue(value:unknown):string{const encoded=JSON.stringify(value);if(encoded===undefined)throw new Error('Database value must be JSON-compatible.');if(Buffer.byteLength(encoded,'utf8')>1_000_000)throw new Error('Database value must be smaller than 1 MB.');return encoded}
