import type { CreditReservation, GatewayAccount } from './store.ts';

export type PurchaseRecord={sessionId:string;packageId:string;amountPaid:number;currency:string;credits:number;createdAt:string};
export type RateLimitResult={allowed:boolean;remaining:number;resetAt:number};
export type MaybePromise<T>=T|Promise<T>;

export interface GatewayDataStore{
 register(email:string,password:string):Promise<{account:GatewayAccount;token:string}>;
 login(email:string,password:string):Promise<{account:GatewayAccount;token:string}>;
 authenticate(token:string):MaybePromise<GatewayAccount>;
 reserve(accountId:string,requestId:string,amount:number):MaybePromise<CreditReservation>;
 settle(accountId:string,reservationId:string,actual:number):MaybePromise<CreditReservation>;
 release(accountId:string,reservationId:string):MaybePromise<CreditReservation>;
 grantPurchase(value:{eventId:string;accountId:string;sessionId:string;packageId:string;amountPaid:number;currency:string;credits:number}):MaybePromise<GatewayAccount>;
 purchases(accountId:string):MaybePromise<PurchaseRecord[]>;
 consumeRateLimit(bucket:string,limit:number,windowSeconds:number,nowSeconds?:number):MaybePromise<RateLimitResult>;
 close():MaybePromise<void>;
}
