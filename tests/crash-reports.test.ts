import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {CrashReportService,redactDiagnostic} from '../src/main/crash-reports.ts';

test('diagnostics redact secrets, emails, and personal Windows paths',()=>{const value=redactDiagnostic('Bearer abcdef123456 sk-proj-secret123456 sean@example.com C:\\Users\\seans\\project\\app.ts');assert.equal(value.includes('abcdef123456'),false);assert.equal(value.includes('sk-proj'),false);assert.equal(value.includes('sean@example.com'),false);assert.equal(value.includes('C:\\Users\\seans'),false);assert.match(value,/<redacted-secret>/);assert.match(value,/<user-home>/)});
test('crash reports remain local, bounded, and filterable by project',async()=>{const root=await mkdtemp(join(tmpdir(),'foundry-crash-')),service=new CrashReportService(join(root,'reports.json'),'0.6.0','win32');const report=await service.record({source:'desktop-runtime',message:new Error('Renderer stopped'),projectId:'project-1'});await service.record({source:'main-process',message:'Unhandled rejection'});assert.equal(report.appVersion,'0.6.0');assert.equal(report.platform,'win32');assert.equal((await service.list()).length,2);assert.deepEqual((await service.list('project-1')).map(item=>item.id),[report.id])});
test('truncated diagnostics recover on the next recorded report',async()=>{const root=await mkdtemp(join(tmpdir(),'foundry-crash-corrupt-')),file=join(root,'reports.json'),service=new CrashReportService(file,'0.7.0','win32');await writeFile(file,'[{"id":');assert.deepEqual(await service.list(),[]);await service.record({source:'main-process',message:'Recovered'});assert.equal((await service.list()).length,1)});
