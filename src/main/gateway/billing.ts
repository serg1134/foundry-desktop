import { createHmac, timingSafeEqual } from 'node:crypto';
import type { GatewayAccount } from './store.ts';

export type CreditPackage={id:'starter'|'builder'|'studio';name:string;credits:number;priceId:string};
export type CheckoutSession={id:string;url:string};
export type StripeMode='test'|'live';
type FetchLike=(input:string,init:RequestInit)=>Promise<Response>;

export function creditPackages(env:NodeJS.ProcessEnv=process.env):CreditPackage[]{return[
 {id:'starter',name:'Starter credits',credits:20_000,priceId:env.STRIPE_PRICE_STARTER||''},
 {id:'builder',name:'Builder credits',credits:75_000,priceId:env.STRIPE_PRICE_BUILDER||''},
 {id:'studio',name:'Studio credits',credits:250_000,priceId:env.STRIPE_PRICE_STUDIO||''}
]}

export class BillingService{
 constructor(private readonly secretKey:string,private readonly webhookSecret:string,private readonly successUrl:string,private readonly cancelUrl:string,private readonly packages=creditPackages(),private readonly fetcher:FetchLike=fetch,private readonly requiredMode?:StripeMode){}
 catalog():Omit<CreditPackage,'priceId'>[]{return this.packages.map(({priceId:_,...item})=>item)}
 mode():StripeMode|undefined{return this.secretKey.startsWith('sk_test_')?'test':this.secretKey.startsWith('sk_live_')?'live':undefined}
 configured():boolean{return Boolean(this.secretKey&&this.webhookSecret&&this.packages.every(item=>item.priceId)&&this.mode()&&(!this.requiredMode||this.mode()===this.requiredMode))}
 async checkout(account:GatewayAccount,packageId:string):Promise<CheckoutSession>{const item=this.packages.find(entry=>entry.id===packageId);if(!item||!item.priceId)throw new Error('That credit package is not available.');if(!this.configured())throw new Error(this.requiredMode&&this.mode()!==this.requiredMode?`Billing is configured with a ${this.mode()??'invalid'} Stripe key, but ${this.requiredMode} mode is required.`:'Billing is temporarily unavailable.');const form=new URLSearchParams({'mode':'payment','success_url':this.successUrl,'cancel_url':this.cancelUrl,'client_reference_id':account.id,'customer_email':account.email,'line_items[0][price]':item.priceId,'line_items[0][quantity]':'1','metadata[account_id]':account.id,'metadata[package_id]':item.id,'metadata[credits]':String(item.credits)}),response=await this.fetcher('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:`Bearer ${this.secretKey}`,'Content-Type':'application/x-www-form-urlencoded'},body:form.toString()}),body=await response.json() as {id?:string;url?:string;livemode?:boolean;error?:{message?:string}};if(!response.ok||!body.id||!body.url)throw new Error(body.error?.message||'Could not create a secure checkout session.');if(typeof body.livemode==='boolean'&&body.livemode!==(this.mode()==='live'))throw new Error('Stripe returned a checkout session from the wrong billing mode.');return{id:body.id,url:body.url}}
 verifyWebhook(rawBody:string,signatureHeader:string,nowSeconds=Math.floor(Date.now()/1000)):{id:string;type:string;data:{object:Record<string,unknown>}}{if(!this.webhookSecret)throw new Error('Billing webhook is not configured.');const parts=signatureHeader.split(',').map(part=>part.split('=',2)),timestamp=Number(parts.find(([key])=>key==='t')?.[1]),signatures=parts.filter(([key])=>key==='v1').map(([,value])=>value);if(!Number.isInteger(timestamp)||Math.abs(nowSeconds-timestamp)>300||!signatures.length)throw new Error('Invalid or expired billing signature.');const expected=createHmac('sha256',this.webhookSecret).update(`${timestamp}.${rawBody}`).digest('hex'),expectedBuffer=Buffer.from(expected,'hex'),valid=signatures.some(value=>{try{const actual=Buffer.from(value,'hex');return actual.length===expectedBuffer.length&&timingSafeEqual(actual,expectedBuffer)}catch{return false}});if(!valid)throw new Error('Invalid billing signature.');const event=JSON.parse(rawBody) as {id?:unknown;type?:unknown;data?:{object?:unknown}};if(typeof event.id!=='string'||typeof event.type!=='string'||!event.data?.object||typeof event.data.object!=='object')throw new Error('Invalid billing event.');return{id:event.id,type:event.type,data:{object:event.data.object as Record<string,unknown>}}}
 package(id:string):CreditPackage|undefined{return this.packages.find(item=>item.id===id)}
}
