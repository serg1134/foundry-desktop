import type { AgentEvent } from './main/agent';

export type BuildProgressState='running'|'complete'|'failed';

const phaseNames={plan:'Understanding request',inspect:'Exploring project',build:'Editing files',test:'Testing app',repair:'Repairing issues'} as const;
type Phase=keyof typeof phaseNames;

function phaseFor(event:AgentEvent):Phase{
 if(event.type==='capability'||event.type==='plan')return'plan';
 if(/repair|problem|restor/i.test(event.message))return'repair';
 if(event.type==='verify'||event.tool==='validate_project'||event.tool==='set_test_plan')return'test';
 if(event.tool==='write_file')return'build';
 return'inspect';
}

export function buildProgress(events:AgentEvent[],state:BuildProgressState){
 const phases=(Object.keys(phaseNames)as Phase[]).map(id=>({id,label:phaseNames[id],events:events.filter(event=>phaseFor(event)===id)}));
 const reached=phases.reduce((last,phase,index)=>phase.events.length?index:last,0);
 return phases.map((phase,index)=>({...phase,status:state==='failed'&&index===reached?'failed':index<reached||state==='complete'?'complete':index===reached?'active':'pending'}as const));
}

export function BuildProgress({events,state,onStop}: {events:AgentEvent[];state:BuildProgressState;onStop?:()=>void}){
 const phases=buildProgress(events,state),files=[...new Set(events.filter(event=>event.tool==='write_file'&&event.path).map(event=>event.path!))],assessment=events.find(event=>event.type==='capability');
 const title=state==='running'?'Working on your app':state==='complete'?'Build completed':'Build needs attention';
 return <section className={`build-progress ${state}`} aria-label="Build progress" aria-live="polite">
  <header className="build-progress-heading"><span className="build-state-icon">{state==='complete'?'✓':state==='failed'?'!':<i/>}</span><span><strong>{title}</strong><small>{state==='running'?'Live activity':state==='complete'?'Ready to continue':'Review the failed step'}</small></span>{state==='running'&&onStop&&<button type="button" className="build-stop" onClick={onStop}>Stop</button>}</header>
  {assessment&&<div className={`capability-assessment ${assessment.tier??'supported'}`}><div><span>{assessment.tier==='unsupported'?'!':assessment.tier==='experimental'?'△':'✓'}</span><strong>{assessment.tier==='unsupported'?'Unsupported request':assessment.tier==='experimental'?'Experimental capability':'Supported build'}</strong></div><p>{assessment.message}</p>{Boolean(assessment.capabilities?.length)&&<small>Permissions: {assessment.capabilities!.join(', ')}</small>}{assessment.limitations?.map(item=><small key={item}>• {item}</small>)}</div>}
  <div className="build-timeline">{phases.map(phase=><details className={`build-phase ${phase.status}`} key={phase.id} open={phase.status==='active'||phase.status==='failed'}>
   <summary><span className="phase-marker">{phase.status==='complete'?'✓':phase.status==='failed'?'!':phase.status==='active'?<i/>:'·'}</span><span><strong>{phase.label}</strong><small>{phase.events.at(-1)?.message??'Waiting'}</small></span><span className="phase-chevron">›</span></summary>
   {phase.events.length>1&&<div className="phase-events">{phase.events.slice(0,-1).map((event,index)=><span key={`${event.message}-${index}`}>{event.message}</span>)}</div>}
  </details>)}</div>
  {files.length>0&&<details className="build-files"><summary><span>Files changed</span><b>{files.length}</b></summary>{files.map(path=><div key={path}><span>↳</span>{path}</div>)}</details>}
 </section>;
}
