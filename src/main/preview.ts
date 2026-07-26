import { build } from 'esbuild';
import { join } from 'node:path';
import type { ProjectRecord } from './workspace';

export type PreviewResult={html:string;warnings:string[]};

export class PreviewService{
  constructor(private readonly dependencyRoot:string){}

  async build(project:ProjectRecord,persistentStorage=false):Promise<PreviewResult>{
    const result=await build({
      absWorkingDir:project.root,
      entryPoints:['src/main.tsx'],
      bundle:true,
      write:false,
      outfile:'foundry-preview.js',
      platform:'browser',
      format:'iife',
      target:'es2022',
      jsx:'automatic',
      nodePaths:[join(this.dependencyRoot,'node_modules')],
      loader:{'.png':'dataurl','.jpg':'dataurl','.jpeg':'dataurl','.gif':'dataurl','.svg':'dataurl'},
      logLevel:'silent'
    });
    const js=result.outputFiles.find(file=>file.path.endsWith('.js'))?.text;
    if(!js)throw new Error('The preview compiler did not produce an application bundle.');
    const css=result.outputFiles.find(file=>file.path.endsWith('.css'))?.text??'';
    const safeJs=js.replace(/<\/script/gi,'<\\/script');
    const bootstrap=persistentStorage?'':`<script>${storageShim}</script>`;
    return{html:`<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:"><style>html,body,#root{min-height:100%;margin:0}${css}</style></head><body><div id="root"></div>${bootstrap}<script>${diagnosticBridge}</script><script>${safeJs}</script></body></html>`,warnings:result.warnings.map(item=>item.text)};
  }
}

const storageShim=`(()=>{const values=new Map();const storage={getItem:key=>values.has(String(key))?values.get(String(key)):null,setItem:(key,value)=>values.set(String(key),String(value)),removeItem:key=>values.delete(String(key)),clear:()=>values.clear(),key:index=>[...values.keys()][index]??null,get length(){return values.size}};try{Object.defineProperty(window,'localStorage',{value:storage})}catch{}})();`;
const diagnosticBridge=`(()=>{const report=value=>{const message=value instanceof Error?(value.stack||value.message):String(value);try{parent.postMessage({source:'foundry-preview-error',message},'*')}catch{}console.error('[Foundry Runtime]',message)};addEventListener('error',event=>report(event.error||event.message));addEventListener('unhandledrejection',event=>report(event.reason))})();`;
