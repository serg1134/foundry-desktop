export const PRODUCTION_GATEWAY_URL='https://foundry-desktop.replit.app';

export type CloudAccount={id:string;email:string;credits:number;monthlySpendLimit:number;createdAt:string};
export type CloudPackage={id:string;name:string;credits:number};
export type CloudAppCredential={id:string;accountId:string;name:string;provider:'openai'|'anthropic'|'google'|'xai';model:string;monthlyBudget:number;requestsPerMinute:number;revoked:boolean;createdAt:string;lastUsedAt:string|null};
type FetchLike=(input:string,init?:RequestInit)=>Promise<Response>;

export function resolveGatewayUrl(configured:string|undefined,packaged:boolean):string{
  const value=(configured?.trim()||(packaged?PRODUCTION_GATEWAY_URL:'http://127.0.0.1:8787')).replace(/\/$/,'');
  if(!/^https:\/\//.test(value)&&!/^http:\/\/127\.0\.0\.1(?::\d+)?$/.test(value))throw new Error('Foundry Cloud requires HTTPS.');
  return value;
}

export class CloudClient{
  constructor(readonly baseUrl:string,private readonly fetcher:FetchLike=fetch){}

  async authenticate(email:string,password:string,create:boolean):Promise<{token:string;account:CloudAccount}>{
    const body=await this.request<{token?:unknown;account?:unknown}>(`/v1/auth/${create?'register':'login'}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    if(typeof body.token!=='string'||!body.token||!this.isAccount(body.account))throw new Error('Foundry Cloud returned an invalid sign-in response.');
    return{token:body.token,account:body.account};
  }

  async account(token:string):Promise<CloudAccount>{const body=await this.request<{account?:unknown}>('/v1/me',{headers:this.auth(token)});if(!this.isAccount(body.account))throw new Error('Foundry Cloud returned an invalid account.');return body.account}
  async packages(token:string):Promise<CloudPackage[]>{const body=await this.request<{packages?:unknown}>('/v1/billing/packages',{headers:this.auth(token)});if(!Array.isArray(body.packages)||!body.packages.every(item=>this.isPackage(item)))throw new Error('Foundry Cloud returned an invalid package catalog.');return body.packages}
  async checkout(token:string,packageId:string):Promise<string>{const body=await this.request<{url?:unknown}>('/v1/billing/checkout',{method:'POST',headers:{...this.auth(token),'Content-Type':'application/json'},body:JSON.stringify({packageId})});if(typeof body.url!=='string')throw new Error('Foundry Cloud returned an invalid checkout.');const url=new URL(body.url);if(url.protocol!=='https:'||!(url.hostname==='stripe.com'||url.hostname.endsWith('.stripe.com')))throw new Error('Checkout returned an untrusted payment URL.');return url.toString()}
  async createAppCredential(token:string,input:{name:string;provider:CloudAppCredential['provider'];model:string;monthlyBudget:number;requestsPerMinute:number}):Promise<{credential:CloudAppCredential;token:string}>{const body=await this.request<{credential?:CloudAppCredential;token?:unknown}>('/v1/apps/credentials',{method:'POST',headers:{...this.auth(token),'Content-Type':'application/json'},body:JSON.stringify(input)});if(typeof body.token!=='string'||!body.credential?.id)throw new Error('Foundry Cloud returned an invalid app credential.');return{credential:body.credential,token:body.token}}
  async appCredentials(token:string):Promise<CloudAppCredential[]>{const body=await this.request<{credentials?:CloudAppCredential[]}>('/v1/apps/credentials',{headers:this.auth(token)});if(!Array.isArray(body.credentials))throw new Error('Foundry Cloud returned an invalid app credential list.');return body.credentials}
  async revokeAppCredential(token:string,id:string):Promise<void>{await this.request(`/v1/apps/credentials/${encodeURIComponent(id)}`,{method:'DELETE',headers:this.auth(token)})}
  async generateIcon(token:string,input:{prompt:string;appName:string;description:string;requestId:string}):Promise<{imageBase64:string;model:string}>{const body=await this.request<{imageBase64?:unknown;model?:unknown}>('/v1/icons/generate',{method:'POST',headers:{...this.auth(token),'Content-Type':'application/json'},body:JSON.stringify(input)});if(typeof body.imageBase64!=='string'||typeof body.model!=='string')throw new Error('Foundry Cloud returned an invalid icon image.');return{imageBase64:body.imageBase64,model:body.model}}

  private auth(token:string):Record<string,string>{return{Authorization:`Bearer ${token}`}}
  private async request<T>(path:string,init?:RequestInit):Promise<T>{let response:Response;try{response=await this.fetcher(`${this.baseUrl}${path}`,init)}catch{throw new Error('Foundry Cloud could not be reached. Check your internet connection and try again.')}let body:unknown;try{body=await response.json()}catch{throw new Error('Foundry Cloud returned an unreadable response.')}if(!response.ok){const message=body&&typeof body==='object'&&typeof (body as {error?:unknown}).error==='string'?(body as {error:string}).error:'Foundry Cloud request failed.';throw new Error(message)}return body as T}
  private isAccount(value:unknown):value is CloudAccount{return Boolean(value&&typeof value==='object'&&typeof (value as CloudAccount).id==='string'&&typeof (value as CloudAccount).email==='string'&&Number.isInteger((value as CloudAccount).credits)&&(value as CloudAccount).credits>=0)}
  private isPackage(value:unknown):value is CloudPackage{return Boolean(value&&typeof value==='object'&&typeof (value as CloudPackage).id==='string'&&typeof (value as CloudPackage).name==='string'&&Number.isInteger((value as CloudPackage).credits)&&(value as CloudPackage).credits>0)}
}
