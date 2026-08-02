import test from 'node:test';
import assert from 'node:assert/strict';
import { isSafeInteractionLabel, isSafeWorkflowInteractionLabel } from '../src/main/verification.ts';

test('interaction verifier excludes destructive and transactional controls',()=>{
  for(const label of ['Delete note','Clear everything','Reset app','Buy now','Proceed to checkout','Uninstall','Trash note','Discard changes','Empty cart','Confirm order','Yes, delete','Eliminar','Place order'])assert.equal(isSafeInteractionLabel(label),false,label);
  for(const label of ['New note','Open settings','Save draft','Toggle theme','Search','Add expense','Create task','Close dialog','Copy to clipboard','Read the clipboard','Write clipboard','Write to OS clipboard','↗ Read clipboard','✦ Show notification','Configure native menu','Register global shortcut','Choose folder','Load records','List records','Display deep link','Notify user','Trigger tray action'])assert.equal(isSafeInteractionLabel(label),true,label);
  for(const label of ['Write file','Copy account','Read private messages'])assert.equal(isSafeInteractionLabel(label),false,label);
});

test('workflow verifier permits clipboard-intent controls only with a clipboard assertion',()=>{
  assert.equal(isSafeWorkflowInteractionLabel('Write E2E phrase',true),true);
  assert.equal(isSafeWorkflowInteractionLabel('Copy exact phrase',true),true);
  assert.equal(isSafeWorkflowInteractionLabel('Write E2E phrase',false),false);
  assert.equal(isSafeWorkflowInteractionLabel('Copy account',false),false);
  for(const label of ['Delete note','Buy now','Proceed to checkout','Uninstall','Reset app'])assert.equal(isSafeWorkflowInteractionLabel(label,true),false,label);
});
