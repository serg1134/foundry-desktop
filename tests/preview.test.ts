import test from 'node:test';
import assert from 'node:assert/strict';
import { storageShim } from '../src/main/preview.ts';

test('preview supplies safe form storage and UUID compatibility shims',()=>{
 assert.match(storageShim,/localStorage/);assert.match(storageShim,/let usable=false/);assert.match(storageShim,/crypto\.randomUUID\(\)/);assert.match(storageShim,/configurable:true/);
});
