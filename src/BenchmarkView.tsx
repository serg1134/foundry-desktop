import type { BenchmarkSnapshot } from './main/benchmarks';

type Props={snapshot:BenchmarkSnapshot|null;running:string;onRun:(id:string)=>void;onRecheck:(id:string)=>void;onRunAll:()=>void;onRecheckAll:()=>void};

export function BenchmarkView({snapshot,running,onRun,onRecheck,onRunAll,onRecheckAll}:Props){
  const latest=new Map(snapshot?[...snapshot.results].reverse().map(result=>[result.benchmarkId,result]):[]);
  const completed=[...latest.values()],passed=completed.filter(result=>result.passed).length;
  return <div className="stage-content benchmark-view">
    <header className="benchmark-heading"><div><p className="eyebrow">RELIABILITY LAB</p><h2>Desktop benchmark</h2><p>Ten isolated app builds measure whether Foundry can generate and verify real workflows.</p><div className="benchmark-actions"><button className="secondary-button" disabled={Boolean(running)||completed.length===0} onClick={onRecheckAll}>{running.startsWith('recheck-all:')?`Rechecking ${running.split(':')[1]}/10…`:'Recheck all locally'}</button><button className="primary-button" disabled={Boolean(running)} onClick={onRunAll}>{running.startsWith('run-all:')?`Generating ${running.split(':')[1]}/10…`:'Regenerate all with AI'}</button></div></div><div className="score-ring"><strong>{snapshot?.successRate??0}%</strong><span>success rate</span></div></header>
    <section className="benchmark-summary"><div><strong>{passed}</strong><span>Passed</span></div><div><strong>{completed.length-passed}</strong><span>Failed</span></div><div><strong>{completed.length}/10</strong><span>Cases run</span></div></section>
    <div className="benchmark-grid">{snapshot?.cases.map(item=>{
      const result=latest.get(item.id),active=running===item.id;
      return <article className="benchmark-card" key={item.id}><div><span>{item.category}</span><strong>{item.name}</strong></div><p>{item.prompt}</p>
        {result?<><small className={result.passed?'pass':'fail'}>{result.passed?'✓ Passed':`! ${result.failureStage??'unknown'} failure`} · {(result.durationMs/1000).toFixed(1)}s · {result.checksPassed}/{result.checksTotal} checks{result.repaired?` · self-repaired in ${result.repairAttempts} ${result.repairAttempts===1?'attempt':'attempts'}`:result.repairAttempts?` · ${result.repairAttempts} repair ${result.repairAttempts===1?'attempt':'attempts'}`:''}{result.recheck?' · local recheck':''}</small>{result.failure&&<p className="benchmark-failure">{result.failure.slice(0,320)}{result.failure.length>320?'…':''}</p>}</>:<small>Not run yet</small>}
        {result&&!result.passed&&<button className="secondary-button" disabled={Boolean(running)} onClick={()=>onRecheck(item.id)}>{active?'Rechecking locally…':'Recheck last build'}</button>}
        <button className="secondary-button" disabled={Boolean(running)} onClick={()=>onRun(item.id)}>{active?'Running and verifying…':result?'Regenerate with AI':'Run benchmark'}</button>
      </article>})}</div>
  </div>;
}
