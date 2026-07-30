import test from 'node:test';
import assert from 'node:assert/strict';
import { previewCsp, storageShim } from '../src/main/preview.ts';

test('preview supplies safe form storage and UUID compatibility shims',()=>{
 assert.match(storageShim,/localStorage/);assert.match(storageShim,/let usable=false/);assert.match(storageShim,/crypto\.randomUUID\(\)/);assert.match(storageShim,/configurable:true/);
});

test('preview network access is denied by default and enabled per project',()=>{
 assert.doesNotMatch(previewCsp(),/connect-src https:/);assert.match(previewCsp(true),/connect-src https: wss:/);
});
