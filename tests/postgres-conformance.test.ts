import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PostgresGatewayStore } from '../src/main/gateway/postgres-store.ts';

const connectionString=process.env.FOUNDRY_TEST_POSTGRES_URL;

test('PostgreSQL store conforms for accounts, reservations, credentials, and rate limits',{skip:!connectionString},async()=>{
 const store=await PostgresGatewayStore.connect(connectionString!,1000),suffix=randomUUID().replace(/-/g,'');
 try{
  const session=await store.register(`conformance-${suffix}@example.com`,'correct-horse-battery');assert.equal((await store.authenticate(session.token)).credits,1000);
  const first=await store.reserve(session.account.id,`request_${suffix}`,80),duplicate=await store.reserve(session.account.id,`request_${suffix}`,80);assert.equal(duplicate.id,first.id);assert.equal((await store.settle(session.account.id,first.id,30)).settled,30);assert.equal((await store.authenticate(session.token)).credits,970);
  const created=await store.createAppCredential(session.account.id,{name:'Conformance app',provider:'openai',model:'gpt-5.6-sol',monthlyBudget:100,requestsPerMinute:2});assert.equal((await store.authenticateApp(created.token)).id,created.credential.id);assert.equal(JSON.stringify(await store.listAppCredentials(session.account.id)).includes(created.token),false);await store.revokeAppCredential(session.account.id,created.credential.id);await assert.rejects(store.authenticateApp(created.token),/invalid or revoked/);
  const bucket=`test:${suffix}`;assert.equal((await store.consumeRateLimit(bucket,1,60,120)).allowed,true);assert.equal((await store.consumeRateLimit(bucket,1,60,121)).allowed,false);assert.equal((await store.consumeRateLimit(bucket,1,60,180)).allowed,true);
 }finally{await store.close()}
});
