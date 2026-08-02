import {spawn} from 'node:child_process';
import {mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';

main().catch(error=>{console.error(error);process.exitCode=1});

async function main(){
  const campaignRoot=resolve(process.argv[2]??join(process.cwd(),'qualification-campaign-e2e'));
  const report=JSON.parse(await readFile(join(campaignRoot,'qualification-report.json'),'utf8'));
  const results=[];
  for(const [index,item] of report.cases.entries()){
    const port=9431+index,userData=join(campaignRoot,'desktop-data',item.id),installRoot=join(campaignRoot,'installed',item.id);
    await rm(userData,{recursive:true,force:true});
    await rm(installRoot,{recursive:true,force:true});await mkdir(installRoot,{recursive:true});
    process.stdout.write(`[${item.id}] installing generated desktop app\n`);
    await run(item.installerPath,['/S',`/D=${installRoot}`],180_000);
    const installedExecutable=await findFile(installRoot,name=>name.toLowerCase()===`${item.name}.exe`.toLowerCase());
    if(!installedExecutable)throw new Error(`${item.name} was not installed into the isolated directory.`);
    process.stdout.write(`[${item.id}] launching installed executable\n`);
    const child=spawn(installedExecutable,[`--remote-debugging-port=${port}`,`--user-data-dir=${userData}`],{windowsHide:false,stdio:'ignore'});
    try{
      const client=await connect(port,child);
      const exceptions=[];client.on('Runtime.exceptionThrown',params=>exceptions.push(params.exceptionDetails?.text??'Runtime exception'));
      await client.send('Runtime.enable');
      await waitFor(client,`document.readyState==='complete'&&document.body.innerText.trim().length>0`);
      const started=Date.now();
      if(item.id==='notes')await testNotes(client);
      else if(item.id==='tasks')await testTasks(client);
      else if(item.id==='expenses')await testExpenses(client);
      if(exceptions.length)throw new Error(`${item.name} emitted runtime exceptions: ${exceptions.join(' | ')}`);
      results.push({id:item.id,name:item.name,passed:true,durationMs:Date.now()-started,checks:['install','launch','visible root','primary workflow','reload persistence','no runtime exception','uninstall']});
      client.close();
    }finally{
      child.kill();
      await delay(500);
      const uninstaller=await findFile(installRoot,name=>/^uninstall.*\.exe$/i.test(name));
      if(!uninstaller)throw new Error(`${item.name} uninstaller was not created.`);
      process.stdout.write(`[${item.id}] uninstalling generated desktop app\n`);
      await run(uninstaller,['/S'],60_000);
    }
  }
  const desktopReport={startedAt:report.completedAt,completedAt:new Date().toISOString(),passed:results.every(item=>item.passed),cases:results};
  await writeFile(join(campaignRoot,'desktop-behavior-report.json'),JSON.stringify(desktopReport,null,2),'utf8');
  process.stdout.write(`${JSON.stringify(desktopReport,null,2)}\n`);
}

async function findFile(root,predicate){for(const entry of await readdir(root,{recursive:true,withFileTypes:true}).catch(()=>[])){if(entry.isFile()&&predicate(entry.name)){const parent=typeof entry.parentPath==='string'?entry.parentPath:entry.path;return join(parent,entry.name)}}}
function run(file,args,timeoutMs){return new Promise((resolvePromise,reject)=>{const child=spawn(file,args,{windowsHide:true,stdio:'ignore'});const timeout=setTimeout(()=>{child.kill();reject(new Error(`Timed out running ${file}`))},timeoutMs);child.once('error',error=>{clearTimeout(timeout);reject(error)});child.once('exit',code=>{clearTimeout(timeout);code===0?resolvePromise():reject(new Error(`${file} exited with code ${code}`))})})}

async function testNotes(client){
  await assert(client,`document.body.innerText.includes('Qualification Notes')`,'notes title was not visible');
  await evaluate(client,`[...document.querySelectorAll('button')].find(button=>button.textContent.includes('New note')).click()`);
  await setInput(client,`input.title`,'Desktop E2E note');
  await setInput(client,`input[placeholder="Search notes"]`,'Desktop E2E note');
  await assert(client,`document.body.innerText.includes('Desktop E2E note')`,'new note was not searchable');
  await reload(client);
  await assert(client,`document.body.innerText.includes('Desktop E2E note')`,'note did not persist after reload');
}

async function testTasks(client){
  await assert(client,`document.body.innerText.includes('Qualification Tasks')`,'tasks title was not visible');
  await setInput(client,`input[aria-label="Task name"]`,'Desktop persistence task');
  await evaluate(client,`document.querySelector('button.primary').click()`);
  await assert(client,`document.body.innerText.includes('Desktop persistence task')`,'task was not added');
  await reload(client);
  await assert(client,`document.body.innerText.includes('Desktop persistence task')`,'task did not persist after reload');
}

async function testExpenses(client){
  await assert(client,`document.body.innerText.includes('Qualification Expenses')`,'expenses title was not visible');
  await setInput(client,`input[aria-label="Description"]`,'Desktop test expense');
  await setInput(client,`input[aria-label="Amount"]`,'18.50');
  await evaluate(client,`document.querySelector('button.primary').click()`);
  await assert(client,`document.body.innerText.includes('Desktop test expense')&&document.body.innerText.includes('$18.50')`,'expense or total was not updated');
  await reload(client);
  await assert(client,`document.body.innerText.includes('Desktop test expense')&&document.body.innerText.includes('$18.50')`,'expense did not persist after reload');
}

async function setInput(client,selector,value){
  const source=`(()=>{const element=document.querySelector(${JSON.stringify(selector)});if(!element)throw new Error('Missing input: '+${JSON.stringify(selector)});const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(element,${JSON.stringify(value)});element.dispatchEvent(new Event('input',{bubbles:true}));})()`;
  await evaluate(client,source);await delay(150);
}

async function reload(client){await evaluate(client,'location.reload()');await delay(700);await waitFor(client,`document.readyState==='complete'&&document.body.innerText.trim().length>0`)}
async function assert(client,expression,message){if(!await evaluate(client,expression))throw new Error(message)}
async function evaluate(client,expression){const result=await client.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result?.value}
async function waitFor(client,expression,timeoutMs=15_000){const started=Date.now();while(Date.now()-started<timeoutMs){if(await evaluate(client,expression).catch(()=>false))return;await delay(150)}throw new Error(`Timed out waiting for packaged app: ${expression}`)}

async function connect(port,child){
  const started=Date.now();let target;
  while(Date.now()-started<20_000){if(child.exitCode!==null)throw new Error(`Packaged app exited early with code ${child.exitCode}.`);try{const pages=await fetch(`http://127.0.0.1:${port}/json/list`).then(response=>response.json());target=pages.find(page=>page.type==='page'&&page.webSocketDebuggerUrl);if(target)break}catch{}await delay(200)}
  if(!target)throw new Error('Packaged app did not expose its renderer for qualification.');
  return new CdpClient(target.webSocketDebuggerUrl);
}

class CdpClient{
  constructor(url){this.nextId=1;this.pending=new Map();this.listeners=new Map();this.socket=new WebSocket(url);this.ready=new Promise((resolve,reject)=>{this.socket.addEventListener('open',resolve,{once:true});this.socket.addEventListener('error',reject,{once:true})});this.socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result);return}for(const listener of this.listeners.get(message.method)??[])listener(message.params??{})})}
  async send(method,params={}){await this.ready;return new Promise((resolve,reject)=>{const id=this.nextId++;this.pending.set(id,{resolve,reject});this.socket.send(JSON.stringify({id,method,params}))})}
  on(method,listener){const listeners=this.listeners.get(method)??[];listeners.push(listener);this.listeners.set(method,listeners)}
  close(){this.socket.close()}
}

function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
