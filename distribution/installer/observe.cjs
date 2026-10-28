'use strict';
// Only the new installation's loopback CDP endpoint; no existing Chrome discovery.
const fs=require('node:fs'),path=require('node:path');
const [directory,extensionId,mode='safety']=process.argv.slice(2);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
class CDP{
 constructor(url){this.ws=new WebSocket(url);this.pending=new Map();this.id=0;this.ready=new Promise((r,j)=>{this.ws.addEventListener('open',r,{once:true});this.ws.addEventListener('error',()=>j(Error('OWNED_BROWSER_CONNECTION_UNAVAILABLE')),{once:true});});this.ws.addEventListener('message',e=>{const v=JSON.parse(e.data);if(v.id){const p=this.pending.get(v.id);if(p){this.pending.delete(v.id);clearTimeout(p.timer);v.error?p.reject(Error('BROWSER_READ_UNCONFIRMED')):p.resolve(v.result);}}});}
 async send(method,params={},sessionId,timeout=5000){await this.ready;return new Promise((resolve,reject)=>{const id=++this.id,timer=setTimeout(()=>{this.pending.delete(id);reject(Error('BROWSER_READ_TIMEOUT'));},timeout);this.pending.set(id,{resolve,reject,timer});this.ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
 close(){for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('OBSERVATION_CLOSED'));}this.pending.clear();this.ws.close();}
}
async function main(){
 if(!/^[a-p]{32}$/.test(extensionId)||!['safety','identity','quiesce','ready','openWeb'].includes(mode))throw Error('INVALID_OBSERVATION_SCOPE');
 const installation=JSON.parse(fs.readFileSync(path.join(directory,'installation.json'),'utf8'));
 const profile=path.join(path.resolve(directory),'profile'),processRecord=JSON.parse(fs.readFileSync(path.join(directory,'chrome-process.json'),'utf8'));
 const created=typeof processRecord.CreationDate==='string'&&processRecord.CreationDate.match(/Date\((\d+)\)/);const createdMs=created?Number(created[1]):Date.parse(processRecord.CreationDate);if(!Number.isFinite(createdMs))throw Error('OWNED_PROCESS_TIME_UNCONFIRMED');let lines;
 for(let n=0;n<60;n++){try{const file=path.join(profile,'DevToolsActivePort');if(fs.statSync(file).mtimeMs<createdMs)throw Error('STALE_PORT_FILE');lines=fs.readFileSync(file,'utf8').trim().split(/\r?\n/);break;}catch{await delay(200);}}
 if(!lines||!/^\d+$/.test(lines[0])||!/^\/devtools\/browser\/[a-z0-9-]+$/.test(lines[1]))throw Error('OWNED_BROWSER_ENDPOINT_MISSING');
 const origin='http://127.0.0.1:'+Number(lines[0]);const response=await fetch(origin+'/json/version',{signal:AbortSignal.timeout(3000)}),info=await response.json();
 const version=(info.Browser??'').match(/^Chrome\/(\d+)\./);const supported=installation.config.browserMode==='regular_manual'?version&&Number(version[1])>=120:/^Chrome\/156\.0\.8078\.47$/.test(info.Browser??'');
 const endpoint=new URL(info.webSocketDebuggerUrl);if(!supported||endpoint.pathname!==lines[1]||Number(endpoint.port)!==Number(lines[0])||!['127.0.0.1','localhost'].includes(endpoint.hostname))throw Error('OWNED_BROWSER_ENDPOINT_CHANGED');
 const cdp=new CDP(endpoint.href);let target;
 try{
  if(mode==='openWeb'){const u=new URL(installation.origin);if(u.protocol!=='https:'||u.hostname!=='localhost'||u.origin!==installation.origin)throw Error('ORIGIN_UNCONFIRMED');await cdp.send('Target.createTarget',{url:installation.origin+'/#login'});process.stdout.write('{"opened":true}\n');return;}
  if(['identity','quiesce','ready'].includes(mode)){
   let worker;for(let n=0;n<60;n++){const r=await cdp.send('Target.getTargets');worker=r.targetInfos.find(x=>x.type==='service_worker'&&x.url==='chrome-extension://'+extensionId+'/background/service-worker.js');if(worker)break;await delay(200);}
   if(!worker)throw Error('NEW_EXTENSION_NOT_LOADED');
   const {sessionId}=await cdp.send('Target.attachToTarget',{targetId:worker.targetId,flatten:true});
   const expression=mode==='identity'?'JSON.stringify({extensionId:chrome.runtime.id,version:chrome.runtime.getManifest().version,api:globalThis.FocurveDeploymentBinding.config().server_url})':mode==='ready'?'FocurveUserAdmission.open('+JSON.stringify({launchId:installation.launchId,launchDeadlineUTC:installation.launchDeadlineUTC})+').then(x=>JSON.stringify(x))':'FocurveUserAdmission.quiesce().then(x=>JSON.stringify(x))';
   const r=await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:mode!=='identity'},sessionId,mode==='identity'?5000:19000);
   if(r.exceptionDetails)throw Error('EXTENSION_IDENTITY_READ_FAILED');const data=JSON.parse(r.result.value);if(mode==='identity')data.browser=info.Browser;process.stdout.write(JSON.stringify(data)+'\n');return;
  }
  const created=await cdp.send('Target.createTarget',{url:'chrome-extension://'+extensionId+'/safety/index.html',background:true});target=created.targetId;
  const {sessionId}=await cdp.send('Target.attachToTarget',{targetId:target,flatten:true});
  for(let n=0;n<40;n++){const r=await cdp.send('Runtime.evaluate',{expression:'document.readyState === "complete" && typeof reader !== "undefined"',returnByValue:true},sessionId);if(r.result.value)break;if(n===39)throw Error('SAFETY_DOCUMENT_NOT_READY');await delay(100);}
  const r=await cdp.send('Runtime.evaluate',{expression:'reader.observe().then(x=>JSON.stringify(x))',awaitPromise:true,returnByValue:true},sessionId,19000);
  if(r.exceptionDetails||typeof r.result.value!=='string')throw Error('SAFETY_READ_UNCONFIRMED');process.stdout.write(r.result.value+'\n');
 }finally{if(target)await cdp.send('Target.closeTarget',{targetId:target}).catch(()=>{});cdp.close();}
}
const watchdog=setTimeout(()=>{process.stderr.write('OBSERVATION_TIME_LIMIT\n');process.exit(1);},32000);
main().catch(()=>{process.stderr.write('NEW_INSTALLATION_OBSERVATION_UNCONFIRMED\n');process.exitCode=1;}).finally(()=>clearTimeout(watchdog));
