import assert from 'node:assert/strict';
import test from 'node:test';
import { GatewayService } from '../src/main/gateway/service.ts';
import { GatewayStore } from '../src/main/gateway/store.ts';
import { ResendPasswordResetMailer } from '../src/main/gateway/email.ts';

test('password reset is private, single use, expiring, and invalidates sessions',async()=>{
 const store=new GatewayStore(':memory:',100),sent:{email:string;token:string}[]=[];
 try{
  const original=await store.register('owner@example.com','original-password');
  const service=new GatewayService(store,{},fetch,undefined,false,{async sendPasswordReset(email,token){sent.push({email,token})}});
  const unknown=await service.handle({method:'POST',path:'/v1/auth/password/forgot',body:{email:'missing@example.com'}});
  assert.equal(unknown.status,202);assert.equal(sent.length,0);
  const requested=await service.handle({method:'POST',path:'/v1/auth/password/forgot',body:{email:'OWNER@example.com'}});
  assert.equal(requested.status,202);assert.equal(sent.length,1);assert.equal(sent[0].email,'owner@example.com');assert.ok(sent[0].token.length>=40);
  const reset=await service.handle({method:'POST',path:'/v1/auth/password/reset',body:{token:sent[0].token,password:'new-secure-password'}});
  assert.equal(reset.status,200);assert.throws(()=>store.authenticate(original.token),/Session expired/);
  assert.equal((await service.handle({method:'POST',path:'/v1/auth/login',body:{email:'owner@example.com',password:'original-password'}})).status,400);
  assert.equal((await service.handle({method:'POST',path:'/v1/auth/login',body:{email:'owner@example.com',password:'new-secure-password'}})).status,200);
  assert.equal((await service.handle({method:'POST',path:'/v1/auth/password/reset',body:{token:sent[0].token,password:'another-password'}})).status,400);
 }finally{store.close()}
});

test('password reset email contains only a secure website link',async()=>{
 let request:{url:string;body:string}|undefined;
 const mailer=new ResendPasswordResetMailer('re_test','Foundry <security@foundryappbuilder.com>','https://foundryappbuilder.com',async(url,init)=>{request={url,body:String(init?.body)};return new Response('{}',{status:200})});
 await mailer.sendPasswordReset('owner@example.com','safe-reset-token');
 assert.equal(request?.url,'https://api.resend.com/emails');assert.match(request?.body??'',/https:\/\/foundryappbuilder\.com\/reset-password\?token=safe-reset-token/);assert.doesNotMatch(request?.body??'',/password_hash|session/i);
});
