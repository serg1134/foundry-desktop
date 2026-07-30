import test from 'node:test';
import assert from 'node:assert/strict';
import { isSafeInteractionLabel } from '../src/main/verification.ts';

test('interaction verifier excludes destructive and transactional controls',()=>{
  for(const label of ['Delete note','Clear everything','Reset app','Buy now','Proceed to checkout','Uninstall','Trash note','Discard changes','Empty cart','Confirm order','Yes, delete','Eliminar','Place order'])assert.equal(isSafeInteractionLabel(label),false,label);
  for(const label of ['New note','Open settings','Save draft','Toggle theme','Search','Add expense','Create task','Close dialog'])assert.equal(isSafeInteractionLabel(label),true,label);
});
