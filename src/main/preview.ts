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
    return{html:`<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:"><style>html,body,#root{min-height:100%;margin:0}${css}</style></head><body><div id="root"></div>${bootstrap}<script>${diagnosticBridge}</script><script>${selectionBridge}</script><script>${safeJs}</script></body></html>`,warnings:result.warnings.map(item=>item.text)};
  }
}

export const storageShim=`(()=>{const values=new Map();const storage={getItem:key=>values.has(String(key))?values.get(String(key)):null,setItem:(key,value)=>{values.set(String(key),String(value))},removeItem:key=>{values.delete(String(key))},clear:()=>{values.clear()},key:index=>[...values.keys()][index]??null,get length(){return values.size}};try{Object.defineProperty(window,'localStorage',{value:storage})}catch{}try{let usable=false;try{usable=typeof crypto.randomUUID==='function'&&!!crypto.randomUUID()}catch{}if(!usable)Object.defineProperty(crypto,'randomUUID',{configurable:true,value:()=>{const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=bytes[6]&15|64;bytes[8]=bytes[8]&63|128;const hex=[...bytes].map(value=>value.toString(16).padStart(2,'0'));return hex.slice(0,4).join('')+'-'+hex.slice(4,6).join('')+'-'+hex.slice(6,8).join('')+'-'+hex.slice(8,10).join('')+'-'+hex.slice(10).join('')}})}catch{}})();`;
const diagnosticBridge=`(()=>{const report=value=>{const message=value instanceof Error?(value.stack||value.message):String(value);try{parent.postMessage({source:'foundry-preview-error',message},'*')}catch{}console.error('[Foundry Runtime]',message)};addEventListener('error',event=>report(event.error||event.message));addEventListener('unhandledrejection',event=>report(event.reason))})();`;
const selectionBridge=`(()=>{let enabled=false,current=null;const clear=()=>{if(current){current.style.outline=current.dataset.foundryOutline||'';current.style.outlineOffset='';delete current.dataset.foundryOutline}current=null},segment=element=>{const tag=element.tagName.toLowerCase();if(element.id)return tag+'#'+CSS.escape(element.id);const classes=[...element.classList].slice(0,3).map(value=>'.'+CSS.escape(value)).join('');const siblings=element.parentElement?[...element.parentElement.children].filter(item=>item.tagName===element.tagName):[];return tag+classes+(siblings.length>1?':nth-of-type('+(siblings.indexOf(element)+1)+')':'')},pathFor=element=>{const parts=[];let node=element;while(node&&node!==document.body&&parts.length<6){parts.unshift(segment(node));if(node.id)break;node=node.parentElement}return parts.join(' > ')};addEventListener('message',event=>{if(event.data?.source!=='foundry-selection-mode')return;enabled=!!event.data.enabled;if(!enabled)clear()});addEventListener('pointerover',event=>{if(!enabled)return;clear();current=event.target;current.dataset.foundryOutline=current.style.outline||'';current.style.outline='2px solid #ff6437';current.style.outlineOffset='2px'},true);addEventListener('click',event=>{if(!enabled)return;event.preventDefault();event.stopPropagation();const element=event.target,text=(element.getAttribute('aria-label')||element.textContent||element.getAttribute('placeholder')||'').trim().replace(/\\s+/g,' ').slice(0,100),rect=element.getBoundingClientRect();parent.postMessage({source:'foundry-preview-selection',selection:{tag:element.tagName.toLowerCase(),text,role:element.getAttribute('role')||'',id:element.id||'',className:typeof element.className==='string'?element.className.slice(0,240):'',path:pathFor(element).slice(0,500),html:element.outerHTML.replace(/\\s+/g,' ').slice(0,800),rect:{x:Math.round(rect.x),y:Math.round(rect.y),width:Math.round(rect.width),height:Math.round(rect.height)}}},'*');clear()},true)})();`;
