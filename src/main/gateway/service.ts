import { isProviderId, providerDefinition, validateProviderModel, type ProviderId } from '../providers.ts';
import type { GatewayAccount } from './store.ts';
import type { GatewayDataStore } from './store-contract.ts';
import { BillingService } from './billing.ts';

type FetchLike=(input:string,init:RequestInit)=>Promise<Response>;
type ProviderKeys=Partial<Record<ProviderId,string>>;
export type GatewayRequest={method:string;path:string;headers?:Record<string,string|undefined>;body?:unknown;rawBody?:string};
export type GatewayResponse={status:number;body:unknown};

const CREDIT_RATES:Record<ProviderId,{input:number;output:number}>={openai:{input:3,output:12},anthropic:{input:4,output:18},google:{input:2,output:8},xai:{input:3,output:14}};

export class GatewayService{
 constructor(private readonly store:GatewayDataStore,private readonly providerKeys:ProviderKeys,private readonly fetcher:FetchLike=fetch,private readonly billing?:BillingService,private readonly productionReadiness=false){}
 async handle(request:GatewayRequest):Promise<GatewayResponse>{try{
  if(request.method==='GET'&&request.path==='/health/live')return{status:200,body:{status:'ok'}};
  if(request.method==='GET'&&request.path==='/health/ready'){const ready=!this.productionReadiness||(Object.values(this.providerKeys).some(Boolean)&&Boolean(this.billing?.configured()));return{status:ready?200:503,body:{status:ready?'ready':'not_ready'}}};
  if(request.method==='POST'&&request.path==='/v1/auth/register'){const body=this.record(request.body),result=await this.store.register(this.text(body.email),this.text(body.password));return{status:201,body:result}}
  if(request.method==='POST'&&request.path==='/v1/auth/login'){const body=this.record(request.body),result=await this.store.login(this.text(body.email),this.text(body.password));return{status:200,body:result}}
  if(request.method==='POST'&&request.path==='/v1/billing/webhook')return await this.billingWebhook(request);
  const account=await this.authorize(request.headers);
  if(request.method==='GET'&&request.path==='/v1/me')return{status:200,body:{account}};
  if(request.method==='GET'&&request.path==='/v1/billing/packages')return{status:200,body:{packages:this.requireBilling().catalog()}};
  if(request.method==='GET'&&request.path==='/v1/billing/history')return{status:200,body:{purchases:await this.store.purchases(account.id)}};
  if(request.method==='POST'&&request.path==='/v1/billing/checkout'){const body=this.record(request.body),session=await this.requireBilling().checkout(account,this.text(body.packageId));return{status:201,body:session}}
  if(request.method==='POST'&&request.path==='/v1/model/request')return await this.modelRequest(account,this.record(request.body));
  return{status:404,body:{error:'Endpoint not found.'}};
 }catch(error){const message=error instanceof Error?error.message:'Gateway request failed.';return{status:this.status(message),body:{error:message}}}}
 private async billingWebhook(request:GatewayRequest):Promise<GatewayResponse>{const billing=this.requireBilling(),event=billing.verifyWebhook(request.rawBody??'',request.headers?.['stripe-signature']??request.headers?.['Stripe-Signature']??'');if(event.type!=='checkout.session.completed')return{status:200,body:{received:true}};const object=event.data.object,metadata=this.record(object.metadata??{}),accountId=this.text(metadata.account_id),packageId=this.text(metadata.package_id),item=billing.package(packageId),sessionId=this.text(object.id);if(!item||String(metadata.credits)!==String(item.credits)||object.payment_status!=='paid'||object.client_reference_id!==accountId)throw new Error('Completed checkout did not match the credit order.');const account=await this.store.grantPurchase({eventId:event.id,accountId,sessionId,packageId:item.id,amountPaid:Number(object.amount_total??0),currency:this.text(object.currency),credits:item.credits});return{status:200,body:{received:true,credits:account.credits}}}
 private async modelRequest(account:GatewayAccount,body:Record<string,unknown>):Promise<GatewayResponse>{const provider=body.provider;if(!isProviderId(provider))throw new Error('Choose a supported AI provider.');const model=validateProviderModel(provider,body.model),payload=this.record(body.payload),requestId=this.text(body.requestId),key=this.providerKeys[provider];if(!key)throw new Error(`${providerDefinition(provider).name} is temporarily unavailable.`);if(String(payload.model??'')!==model)throw new Error('Payload model does not match the selected model.');const estimatedInput=Math.max(1,Math.ceil(JSON.stringify(payload).length/4)),maxOutput=Math.min(Math.max(Number(payload.max_output_tokens??payload.max_tokens??12_000),1),32_000),reservation=await this.store.reserve(account.id,requestId,this.cost(provider,estimatedInput,maxOutput));try{const definition=providerDefinition(provider),url=provider==='openai'?'https://api.openai.com/v1/responses':definition.chatUrl,response=await this.fetcher(url,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(payload)}),result=await response.json() as Record<string,unknown>;if(!response.ok)throw new Error(this.providerError(result,definition.name,response.status));const usage=this.usage(result),actual=this.cost(provider,usage.input||estimatedInput,usage.output||maxOutput);await this.store.settle(account.id,reservation.id,actual);return{status:200,body:result}}catch(error){await this.store.release(account.id,reservation.id);throw error}}
 private usage(result:Record<string,unknown>):{input:number;output:number}{const usage=this.record(result.usage??{});return{input:Number(usage.input_tokens??usage.prompt_tokens??0),output:Number(usage.output_tokens??usage.completion_tokens??0)}}
 private cost(provider:ProviderId,inputTokens:number,outputTokens:number):number{const rate=CREDIT_RATES[provider];return Math.max(1,Math.ceil(inputTokens*rate.input/1000+outputTokens*rate.output/1000))}
 private async authorize(headers:Record<string,string|undefined>|undefined):Promise<GatewayAccount>{const value=headers?.authorization??headers?.Authorization;if(!value?.startsWith('Bearer '))throw new Error('Authentication required.');return await this.store.authenticate(value.slice(7))}
 private providerError(result:Record<string,unknown>,name:string,status:number):string{const nested=this.record(result.error??{}),message=typeof nested.message==='string'?nested.message:'';return message?`${name} rejected the request: ${message.slice(0,300)}`:`${name} request failed (${status}).`}
 private record(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Request body must be an object.');return value as Record<string,unknown>}
 private text(value:unknown):string{if(typeof value!=='string')throw new Error('A required text field is missing.');return value}
 private status(message:string):number{if(/Authentication|Session expired/.test(message))return 401;if(/already exists/.test(message))return 409;if(/credits|spend limit/.test(message))return 402;if(/temporarily unavailable/.test(message))return 503;if(/rejected|request failed/.test(message))return 502;return 400}
 private requireBilling():BillingService{if(!this.billing)throw new Error('Billing is temporarily unavailable.');return this.billing}
}
