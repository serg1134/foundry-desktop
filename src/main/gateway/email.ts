export interface PasswordResetMailer{sendPasswordReset(email:string,token:string):Promise<void>}

export class ResendPasswordResetMailer implements PasswordResetMailer{
 constructor(private readonly apiKey:string,private readonly from:string,private readonly websiteUrl:string,private readonly fetcher:typeof fetch=fetch){}
 configured():boolean{return Boolean(this.apiKey&&this.from&&this.websiteUrl)}
 async sendPasswordReset(email:string,token:string):Promise<void>{
  if(!this.configured())throw new Error('Password reset email is temporarily unavailable.');
  const link=new URL('/reset-password',this.websiteUrl);link.searchParams.set('token',token);
  const response=await this.fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${this.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({from:this.from,to:[email],subject:'Reset your Foundry password',html:`<div style="font-family:system-ui,sans-serif;color:#111;max-width:560px;margin:auto"><h1>Reset your Foundry password</h1><p>This link expires in 30 minutes and can only be used once.</p><p><a href="${this.escape(link.toString())}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#111;color:#fff;text-decoration:none">Choose a new password</a></p><p>If you did not request this, you can ignore this email.</p></div>`})});
  if(!response.ok)throw new Error('Password reset email is temporarily unavailable.');
 }
 private escape(value:string):string{return value.replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]??character))}
}
