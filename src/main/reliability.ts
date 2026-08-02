import type { AgentResult, VerificationCheck, VerificationResult, VisualReview, WorkflowStep } from './agent.ts';
import { classifyBenchmarkFailure, type BenchmarkFailureStage } from './benchmarks.ts';

export const MAX_BEHAVIOR_REPAIRS=2;
export const MAX_VISUAL_REPAIRS=2;

export type RepairAttempt={attempt:number;stage:BenchmarkFailureStage;failedChecks:number;checksPassed:number;checksTotal:number;progress:boolean};
export type BehaviorRepairLoopResult={result:AgentResult;verification:VerificationResult;attempts:RepairAttempt[]};
export type BehaviorRepairLoopOptions={request:string;result:AgentResult;workflow:WorkflowStep[];verification:VerificationResult;verify:()=>Promise<VerificationResult>;repair:(prompt:string,attempt:number)=>Promise<AgentResult>;onAttempt?:(attempt:RepairAttempt)=>void;maxAttempts?:number};
export type VisualRepairAttempt={attempt:number;issues:string[];behaviorRepairs:RepairAttempt[]};
export type VisualRepairLoopResult={result:AgentResult;verification:VerificationResult;visual:VisualReview;attempts:VisualRepairAttempt[]};
export type VisualRepairLoopOptions={request:string;result:AgentResult;workflow:WorkflowStep[];verification:VerificationResult;visual:VisualReview;verify:()=>Promise<VerificationResult>;review:()=>Promise<VisualReview>;repairVisual:(prompt:string,attempt:number)=>Promise<AgentResult>;repairBehavior:(prompt:string,attempt:number)=>Promise<AgentResult>;onVisualAttempt?:(attempt:number,issues:string[])=>void;onBehaviorAttempt?:(attempt:RepairAttempt)=>void;maxVisualAttempts?:number;maxBehaviorAttempts?:number};

export function failedVerificationChecks(result:VerificationResult):VerificationCheck[]{
  return result.checks.filter(check=>!check.passed);
}

export function verificationStage(result:VerificationResult):BenchmarkFailureStage{
  const failed=failedVerificationChecks(result);
  const detail=failed.map(check=>`${check.name}: ${check.detail}`).join('\n');
  return classifyBenchmarkFailure(detail);
}

export function behaviorRepairPrompt(request:string,result:VerificationResult,attempt:number,workflow:WorkflowStep[]):string{
  const stage=verificationStage(result),diagnostic=failedVerificationChecks(result).map(check=>`- ${check.name}: ${check.detail}`).join('\n');
  return `Repair attempt ${attempt} for a ${stage} verification failure caused by the preceding request.\n\nOriginal request:\n${request.slice(0,3000)}\n\nRequired workflow (preserve these exact visible labels and outcomes):\n${JSON.stringify(workflow)}\n\nFailed checks:\n${diagnostic.slice(0,5000)}\n\nInspect the current implementation and fix the root cause only. Every click workflow target must remain a real visible <button> (or role="button") with the exact required accessible label; never replace it with a checkbox, hidden control, or styled non-button. Do not redesign working areas, remove required labels, replace the workflow, or weaken persistence. Validate the project before finishing.`;
}

export function visualRepairPrompt(request:string,issues:string[],attempt:number):string{
  return `Visual repair attempt ${attempt} for the preceding request.\n\nOriginal request:\n${request.slice(0,3000)}\n\nVisible problems:\n${issues.map(issue=>`- ${issue}`).join('\n').slice(0,3000)}\n\nMake focused layout, spacing, sizing, or contrast changes only. Preserve all working controls, accessible labels, behavior, and persistence. Validate the project before finishing.`;
}

export function mergeRepairResult(base:AgentResult,repair:AgentResult,workflow:WorkflowStep[]):AgentResult{
  return{message:`${base.message}\n\nFoundry diagnosed and repaired a verification failure. ${repair.message}`,filesChanged:[...new Set([...base.filesChanged,...repair.filesChanged])],iterations:base.iterations+repair.iterations,workflow};
}

export async function runBehaviorRepairLoop(options:BehaviorRepairLoopOptions):Promise<BehaviorRepairLoopResult>{
  const attempts:RepairAttempt[]=[];let result=options.result,verification=options.verification,previousPassed=passedChecks(verification),previousFailure=failureFingerprint(verification),stalled=0;
  for(let attempt=1;!verification.passed&&attempt<=(options.maxAttempts??MAX_BEHAVIOR_REPAIRS);attempt++){
    const stage=verificationStage(verification),repair=await options.repair(behaviorRepairPrompt(options.request,verification,attempt,options.workflow),attempt);
    result=mergeRepairResult(result,repair,options.workflow);verification=await options.verify();
    const checksPassed=passedChecks(verification),fingerprint=failureFingerprint(verification),progress=verification.passed||checksPassed>previousPassed||fingerprint!==previousFailure;
    const record={attempt,stage,failedChecks:failedVerificationChecks(verification).length,checksPassed,checksTotal:verification.checks.length,progress};attempts.push(record);options.onAttempt?.(record);
    stalled=progress?0:stalled+1;previousPassed=checksPassed;previousFailure=fingerprint;
    if(stalled>=2)break;
  }
  return{result,verification,attempts};
}

export async function runVisualRepairLoop(options:VisualRepairLoopOptions):Promise<VisualRepairLoopResult>{
  const attempts:VisualRepairAttempt[]=[];let result=options.result,verification=options.verification,visual=options.visual;
  for(let attempt=1;!visual.passed&&attempt<=(options.maxVisualAttempts??MAX_VISUAL_REPAIRS);attempt++){
    const issues=[...visual.issues];options.onVisualAttempt?.(attempt,issues);
    result=mergeRepairResult(result,await options.repairVisual(visualRepairPrompt(options.request,issues,attempt),attempt),options.workflow);
    verification=await options.verify();let behaviorRepairs:RepairAttempt[]=[];
    if(!verification.passed){
      const recovery=await runBehaviorRepairLoop({request:options.request,result,workflow:options.workflow,verification,verify:options.verify,repair:options.repairBehavior,onAttempt:options.onBehaviorAttempt,maxAttempts:options.maxBehaviorAttempts});
      result=recovery.result;verification=recovery.verification;behaviorRepairs=recovery.attempts;
    }
    attempts.push({attempt,issues,behaviorRepairs});
    if(!verification.passed)break;
    visual=await options.review();
  }
  return{result,verification,visual,attempts};
}

function passedChecks(result:VerificationResult):number{return result.checks.filter(check=>check.passed).length}
function failureFingerprint(result:VerificationResult):string{return failedVerificationChecks(result).map(check=>`${check.name}:${check.detail}`.toLowerCase().replace(/\s+/g,' ').trim()).sort().join('|')}
