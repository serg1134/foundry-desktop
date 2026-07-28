import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { prepareCapabilityDatabase } from '../src/main/capability-database.ts';

test('capability database stores isolated JSON values',async()=>{const root=await mkdtemp(join(tmpdir(),'foundry-db-')),db=await prepareCapabilityDatabase(join(root,'app.sqlite'));await db.set('tasks','one',{title:'Ship Foundry',done:false});assert.deepEqual(await db.get('tasks','one'),{title:'Ship Foundry',done:false});assert.equal((await db.list('tasks'))[0].key,'one');assert.equal(await db.get('notes','one'),null);await db.delete('tasks','one');assert.equal(await db.get('tasks','one'),null);db.close()});
test('capability database rejects unsafe keys and oversized values',async()=>{const root=await mkdtemp(join(tmpdir(),'foundry-db-limits-')),db=await prepareCapabilityDatabase(join(root,'app.sqlite'));await assert.rejects(db.set('../escape','key','value'),/namespace/);await assert.rejects(db.set('app','key','x'.repeat(1_000_001)),/smaller than 1 MB/);db.close()});
