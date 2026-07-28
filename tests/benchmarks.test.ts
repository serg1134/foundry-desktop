import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { BenchmarkService, benchmarkCases, classifyBenchmarkFailure } from '../src/main/benchmarks.ts';

test('benchmark catalog covers ten distinct desktop scenarios',()=>{assert.equal(benchmarkCases.length,10);assert.equal(new Set(benchmarkCases.map(item=>item.id)).size,10);assert.ok(new Set(benchmarkCases.map(item=>item.category)).size>=5)});
test('benchmark results persist and calculate latest-case success rate',async()=>{const root=await mkdtemp(join(tmpdir(),'foundry-bench-')),service=new BenchmarkService(join(root,'results.json')),now=new Date().toISOString();await service.record({id:'1',benchmarkId:'notes',passed:false,durationMs:10,checksPassed:1,checksTotal:2,filesChanged:1,completedAt:now});const snapshot=await service.record({id:'2',benchmarkId:'notes',passed:true,durationMs:9,checksPassed:2,checksTotal:2,filesChanged:2,completedAt:now});assert.equal(snapshot.results.length,2);assert.equal(snapshot.successRate,100)});
test('benchmark failures are classified into actionable stages',()=>{assert.equal(classifyBenchmarkFailure('Compile error: TypeScript failed'),'compile');assert.equal(classifyBenchmarkFailure('Expected persisted text was missing after an app reload'),'persistence');assert.equal(classifyBenchmarkFailure('Could not find a visible button labeled Save'),'workflow');assert.equal(classifyBenchmarkFailure('OpenAI request failed after safety limit'),'generation');assert.equal(classifyBenchmarkFailure('Screenshot review found unreadable contrast'),'visual')});
