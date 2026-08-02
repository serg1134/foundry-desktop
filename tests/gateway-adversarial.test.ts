import assert from 'node:assert/strict';
import test from 'node:test';
import { GatewayStore } from '../src/main/gateway/store.ts';
import { GatewayService } from '../src/main/gateway/service.ts';

test('one account cannot revoke another account app credential',async()=>{
  const store=new GatewayStore(':memory:',1000);
  try{
    const owner=await store.register('owner@example.com','a-secure-password'),attacker=await store.register('attacker@example.com','a-secure-password');
    const created=await store.createAppCredential(owner.account.id,{name:'Owner app',provider:'openai',model:'gpt-5.6-sol',monthlyBudget:100,requestsPerMinute:5});
    const gateway=new GatewayService(store,{openai:'server-key'});
    const response=await gateway.handle({method:'DELETE',path:`/v1/apps/credentials/${created.credential.id}`,headers:{authorization:`Bearer ${attacker.token}`}});
    assert.equal(response.status,400);
    assert.equal((await store.authenticateApp(created.token)).id,created.credential.id);
  }finally{store.close()}
});

test('malformed authentication never reaches protected account data',async()=>{
  const store=new GatewayStore(':memory:',100);
  try{
    const gateway=new GatewayService(store,{});
    for(const authorization of [undefined,'','Basic abc','Bearer','Bearer ','bearer forged']){
      const response=await gateway.handle({method:'GET',path:'/v1/me',headers:{authorization}});
      assert.equal(response.status,401,JSON.stringify({authorization,response}));
      assert.deepEqual(Object.keys(response.body as object),['error']);
    }
  }finally{store.close()}
});

test('app budget rejection happens before a provider request is sent',async()=>{
  const store=new GatewayStore(':memory:',1000);
  try{
    const session=await store.register('budget-owner@example.com','a-secure-password'),created=await store.createAppCredential(session.account.id,{name:'Tiny budget',provider:'openai',model:'gpt-5.6-sol',monthlyBudget:1,requestsPerMinute:5});let providerCalls=0;
    const gateway=new GatewayService(store,{openai:'server-key'},async()=>{providerCalls++;return new Response('{}',{status:200,headers:{'Content-Type':'application/json'}})});
    const response=await gateway.handle({method:'POST',path:'/v1/apps/model/request',headers:{authorization:`Bearer ${created.token}`},body:{requestId:'budget_12345678',payload:{input:'x'.repeat(1000),max_output_tokens:32000}}});
    assert.equal(response.status,402);assert.equal(providerCalls,0);assert.equal((await store.authenticate(session.token)).credits,1000);
  }finally{store.close()}
});

test('provider payload cannot override the credential model',async()=>{
  const store=new GatewayStore(':memory:',1000);
  try{
    const session=await store.register('model-owner@example.com','a-secure-password'),created=await store.createAppCredential(session.account.id,{name:'Scoped model',provider:'openai',model:'gpt-5.6-sol',monthlyBudget:100,requestsPerMinute:5});let providerCalls=0;
    const gateway=new GatewayService(store,{openai:'server-key'},async()=>{providerCalls++;return new Response('{}',{status:200,headers:{'Content-Type':'application/json'}})});
    const response=await gateway.handle({method:'POST',path:'/v1/apps/model/request',headers:{authorization:`Bearer ${created.token}`},body:{model:'unauthorized-model',requestId:'model_12345678',payload:{model:'unauthorized-model',input:'hello'}}});
    assert.equal(response.status,400);assert.equal(providerCalls,0);
  }finally{store.close()}
});
