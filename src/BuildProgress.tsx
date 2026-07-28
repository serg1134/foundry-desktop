import type { AgentEvent } from './main/agent';

export type BuildProgressState='running'|'complete'|'failed';

const phaseNames={plan:'Plan',inspect:'Explore',build:'Build',test:'Verify',repair:'Repair'} as const;
type Phase=keyof typeof phaseNames;

function phaseFor(event:AgentEvent):Phase{
 if(event.type==='plan')return'plan';
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
 const phases=buildProgress(events,state),files=[...new Set(events.filter(event=>event.tool==='write_file'&&event.path).map(event=>event.path!))];
 return <section className={`build-progress ${state}`} aria-label="Build progress" aria-live="polite">
  <header><span><i/>{state==='running'?'Building your app':state==='complete'?'Build complete':'Build stopped'}</span>{state==='running'&&onStop?<button type="button" className="build-stop" onClick={onStop}>Stop</button>:<small>{state==='running'?'Live':state==='complete'?'Verified':'Needs attention'}</small>}</header>
  <div className="build-timeline">{phases.map(phase=><div className={`build-phase ${phase.status}`} key={phase.id}>
   <span className="phase-marker">{phase.status==='complete'?'✓':phase.status==='failed'?'!':phase.status==='active'?<i/>:'·'}</span>
   <div><strong>{phase.label}</strong>{phase.events.length>0?<span>{phase.events.at(-1)!.message}</span>:<span>Waiting</span>}</div>
  </div>)}</div>
  {files.length>0&&<details className="build-files"><summary>{files.length} file{files.length===1?'':'s'} changed</summary>{files.map(path=><div key={path}><span>↳</span>{path}</div>)}</details>}
 </section>;
}
