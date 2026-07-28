import test from 'node:test';
import assert from 'node:assert/strict';
import { isSafeInteractionLabel } from '../src/main/verification.ts';

test('interaction verifier excludes destructive and transactional controls',()=>{
  for(const label of ['Delete note','Clear everything','Reset app','Buy now','Proceed to checkout','Uninstall'])assert.equal(isSafeInteractionLabel(label),false,label);
  for(const label of ['New note','Open settings','Save draft','Toggle theme','Search'])assert.equal(isSafeInteractionLabel(label),true,label);
});
