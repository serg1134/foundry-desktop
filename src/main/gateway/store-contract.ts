import type { CreditReservation, GatewayAccount } from './store.ts';

export type PurchaseRecord={sessionId:string;packageId:string;amountPaid:number;currency:string;credits:number;createdAt:string};
export type RateLimitResult={allowed:boolean;remaining:number;resetAt:number};
export type AppCredential={id:string;accountId:string;name:string;provider:'openai'|'anthropic'|'google'|'xai';model:string;monthlyBudget:number;requestsPerMinute:number;revoked:boolean;createdAt:string;lastUsedAt:string|null};
export type MaybePromise<T>=T|Promise<T>;

export interface GatewayDataStore{
 register(email:string,password:string):Promise<{account:GatewayAccount;token:string}>;
 login(email:string,password:string):Promise<{account:GatewayAccount;token:string}>;
 authenticate(token:string):MaybePromise<GatewayAccount>;
 createAppCredential(accountId:string,input:{name:string;provider:AppCredential['provider'];model:string;monthlyBudget:number;requestsPerMinute:number}):MaybePromise<{credential:AppCredential;token:string}>;
 listAppCredentials(accountId:string):MaybePromise<AppCredential[]>;
 revokeAppCredential(accountId:string,id:string):MaybePromise<void>;
 authenticateApp(token:string):MaybePromise<AppCredential>;
 appUsageThisMonth(id:string):MaybePromise<number>;
 recordAppUsage(id:string,credits:number):MaybePromise<void>;
 reserve(accountId:string,requestId:string,amount:number):MaybePromise<CreditReservation>;
 settle(accountId:string,reservationId:string,actual:number):MaybePromise<CreditReservation>;
 release(accountId:string,reservationId:string):MaybePromise<CreditReservation>;
 grantPurchase(value:{eventId:string;accountId:string;sessionId:string;packageId:string;amountPaid:number;currency:string;credits:number}):MaybePromise<GatewayAccount>;
 purchases(accountId:string):MaybePromise<PurchaseRecord[]>;
 consumeRateLimit(bucket:string,limit:number,windowSeconds:number,nowSeconds?:number):MaybePromise<RateLimitResult>;
 close():MaybePromise<void>;
}
