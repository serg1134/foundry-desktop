import type { AgentResult, VerificationCheck, VerificationResult, WorkflowStep } from './agent.ts';
import { classifyBenchmarkFailure, type BenchmarkFailureStage } from './benchmarks.ts';

export const MAX_BEHAVIOR_REPAIRS=2;
export const MAX_VISUAL_REPAIRS=2;

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
  return `Repair attempt ${attempt} for a ${stage} verification failure caused by the preceding request.\n\nOriginal request:\n${request.slice(0,3000)}\n\nRequired workflow (preserve these exact visible labels and outcomes):\n${JSON.stringify(workflow)}\n\nFailed checks:\n${diagnostic.slice(0,5000)}\n\nInspect the current implementation and fix the root cause only. Do not redesign working areas, remove required labels, replace the workflow, or weaken persistence. Validate the project before finishing.`;
}

export function visualRepairPrompt(request:string,issues:string[],attempt:number):string{
  return `Visual repair attempt ${attempt} for the preceding request.\n\nOriginal request:\n${request.slice(0,3000)}\n\nVisible problems:\n${issues.map(issue=>`- ${issue}`).join('\n').slice(0,3000)}\n\nMake focused layout, spacing, sizing, or contrast changes only. Preserve all working controls, accessible labels, behavior, and persistence. Validate the project before finishing.`;
}

export function mergeRepairResult(base:AgentResult,repair:AgentResult,workflow:WorkflowStep[]):AgentResult{
  return{message:`${base.message}\n\nFoundry diagnosed and repaired a verification failure. ${repair.message}`,filesChanged:[...new Set([...base.filesChanged,...repair.filesChanged])],iterations:base.iterations+repair.iterations,workflow};
}
