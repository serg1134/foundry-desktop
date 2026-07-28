import test from 'node:test';
import assert from 'node:assert/strict';
import { isProviderId, providerDefinition, providerDefinitions, validateProviderModel } from '../src/main/providers.ts';

test('provider catalog exposes four distinct builder providers',()=>{assert.deepEqual(providerDefinitions.map(item=>item.id),['openai','anthropic','google','xai']);assert.equal(new Set(providerDefinitions.flatMap(item=>item.models)).size,providerDefinitions.reduce((sum,item)=>sum+item.models.length,0));assert.ok(providerDefinitions.every(item=>item.models.includes(item.defaultModel)))});
test('provider and model validation reject unknown selections',()=>{assert.equal(isProviderId('google'),true);assert.equal(isProviderId('unknown'),false);assert.equal(validateProviderModel('xai','grok-4.5'),'grok-4.5');assert.throws(()=>validateProviderModel('openai','grok-4.5'),/supported model/);assert.throws(()=>providerDefinition('unknown' as 'openai'),/Unknown AI provider/)});
