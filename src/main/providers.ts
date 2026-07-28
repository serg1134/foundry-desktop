export type ProviderId='openai'|'anthropic'|'google'|'xai';
export type ProviderDefinition={id:ProviderId;name:string;defaultModel:string;models:string[];chatUrl:string};
export type ProviderCredential={provider:ProviderId;apiKey:string;model:string;mode?:'byok'|'hosted';gatewayUrl?:string};

export const providerDefinitions:ProviderDefinition[]=[
  {id:'openai',name:'OpenAI',defaultModel:'gpt-5.6-sol',models:['gpt-5.6-sol','gpt-5.6-terra','gpt-5.6-luna'],chatUrl:'https://api.openai.com/v1/chat/completions'},
  {id:'anthropic',name:'Claude',defaultModel:'claude-sonnet-4-6',models:['claude-sonnet-4-6','claude-opus-5'],chatUrl:'https://api.anthropic.com/v1/chat/completions'},
  {id:'google',name:'Gemini',defaultModel:'gemini-3.6-flash',models:['gemini-3.6-flash','gemini-3.1-pro-preview','gemini-3.5-flash-lite'],chatUrl:'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'},
  {id:'xai',name:'Grok',defaultModel:'grok-4.5',models:['grok-4.5','grok-build-0.1','grok-4.3'],chatUrl:'https://api.x.ai/v1/chat/completions'}
];
export function providerDefinition(id:ProviderId):ProviderDefinition{const value=providerDefinitions.find(item=>item.id===id);if(!value)throw new Error('Unknown AI provider.');return value}
export function isProviderId(value:unknown):value is ProviderId{return typeof value==='string'&&providerDefinitions.some(item=>item.id===value)}
export function validateProviderModel(provider:ProviderId,model:unknown):string{if(typeof model!=='string'||!providerDefinition(provider).models.includes(model))throw new Error('Choose a supported model for this provider.');return model}
