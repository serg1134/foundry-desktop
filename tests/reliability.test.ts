import test from 'node:test';
import assert from 'node:assert/strict';
import { behaviorRepairPrompt, failedVerificationChecks, mergeRepairResult, verificationStage, visualRepairPrompt } from '../src/main/reliability.ts';

const result={passed:false,verifiedAt:new Date(0).toISOString(),checks:[{name:'Compile',passed:true,detail:'Compiled.'},{name:'Workflow: click',passed:false,detail:'Could not find a visible button labeled Save note'}]};
const workflow=[{action:'click' as const,target:'Save note',value:''},{action:'assert_text' as const,target:'',value:'Saved'}];

test('reliability diagnostics identify failed checks and stage',()=>{assert.equal(failedVerificationChecks(result).length,1);assert.equal(verificationStage(result),'workflow')});
test('behavior repair prompt preserves the original request and required workflow',()=>{const prompt=behaviorRepairPrompt('Build a notes app',result,2,workflow);assert.match(prompt,/Repair attempt 2/);assert.match(prompt,/Build a notes app/);assert.match(prompt,/Save note/);assert.match(prompt,/Do not redesign/)});
test('repair result preserves the authoritative workflow',()=>{const merged=mergeRepairResult({message:'Built',filesChanged:['src/main.tsx'],iterations:2,workflow},{message:'Fixed',filesChanged:['src/styles.css'],iterations:3,workflow:[]},workflow);assert.deepEqual(merged.workflow,workflow);assert.deepEqual(merged.filesChanged,['src/main.tsx','src/styles.css']);assert.equal(merged.iterations,5)});
test('visual repair prompt protects working behavior',()=>{const prompt=visualRepairPrompt('Build a timer',['Button is clipped'],1);assert.match(prompt,/Button is clipped/);assert.match(prompt,/Preserve all working controls/)});
