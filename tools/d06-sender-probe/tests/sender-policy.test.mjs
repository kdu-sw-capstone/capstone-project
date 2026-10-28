import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {acceptsWorker, matchesBinding} from './sender-policy-candidate.mjs';
const runtime={id:'test-extension',getURL:p=>`chrome-extension://test-extension/${p}`};
const worker={id:runtime.id,url:runtime.getURL('worker.js'),origin:'chrome-extension://test-extension'};
// Node's URL reports a null origin for chrome-extension, as the browser probe does.
worker.origin=new URL(worker.url).origin;
test('exact Worker candidate accepted without sender document/frame fields',()=>assert.equal(acceptsWorker(worker,runtime),true));
const negatives={popup:{url:runtime.getURL('popup.html')},content:{url:'https://www.youtube.com/',tab:{id:1}},otherExtension:{id:'other'},suffix:{url:worker.url+'?worker'},prefix:{url:worker.url+'/extra'},wrongOrigin:{origin:'https://www.youtube.com'},tabNull:{tab:null},tabUndefined:{tab:undefined},bodyClaim:{url:runtime.getURL('popup.html'),claimedSource:'worker'}};
for(const [name,patch] of Object.entries(negatives))test(`reject ${name}`,()=>assert.equal(acceptsWorker({...worker,...patch},runtime),false));
for(const key of ['id','url','origin'])for(const value of [undefined,null,0,{},[]])test(`reject ${key} ${JSON.stringify(value)}`,()=>assert.equal(acceptsWorker({...worker,[key]:value},runtime),false));
test('missing sender denied',()=>assert.equal(acceptsWorker(null,runtime),false));
test('prototype-inherited identity fields denied',()=>assert.equal(acceptsWorker(Object.create(worker),runtime),false));
test('prototype-inherited document binding denied',()=>assert.equal(matchesBinding(Object.create(binding),binding),false));
const binding={tabId:1,frameId:0,documentId:'document-A',instance:'instance-A',active:true};
test('trusted active binding accepted',()=>assert.equal(matchesBinding(binding,binding),true));
for(const [key,value] of Object.entries({tabId:2,frameId:1,documentId:'old-document',instance:'old-instance'}))test(`reject binding ${key}`,()=>assert.equal(matchesBinding({...binding,[key]:value},binding),false));
for(const key of ['tabId','frameId','documentId','instance'])test(`reject missing binding ${key}`,()=>{const message={...binding};delete message[key];assert.equal(matchesBinding(message,binding),false);});
test('inactive binding denied',()=>assert.equal(matchesBinding(binding,{...binding,active:false}),false));
test('payload active cannot override trusted lifecycle',()=>assert.equal(matchesBinding({...binding,active:true},{...binding,active:false}),false));

async function route(sender, options={}) {
 let listener,sends=0;
 const chrome={runtime:{...runtime,onMessage:{addListener:f=>listener=f}},tabs:{get:async()=>({id:1,url:options.url??'https://www.youtube.com/'}),sendMessage:async()=>{sends++;if(options.lost)throw Error('RECEIVER_MISSING');return {instance:'instance-A'};}},webNavigation:{getAllFrames:async()=>options.frames??[{frameId:0,documentId:'document-A'}]}};
 const context=vm.createContext({chrome,URL,importScripts:()=>{},senderObservation:()=>({})});
 vm.runInContext(readFileSync(new URL('../worker.js',import.meta.url),'utf8'),context);
 const response=await new Promise(resolve=>listener({probe:'D06_SENDER_PROBE',action:'worker-route',tabId:1,documentId:options.requestDocument??'document-A'},sender,resolve));
 return {response,sends};
}
const popup={id:runtime.id,url:runtime.getURL('popup.html')};
test('probe routes exact popup request to selected document',async()=>assert.equal((await route(popup)).sends,1));
test('Content cannot relay a Worker claim',async()=>assert.equal((await route({...popup,url:'https://www.youtube.com/',tab:{id:1}})).sends,0));
test('other extension cannot relay',async()=>assert.equal((await route({...popup,id:'other'})).sends,0));
test('stale document rejected before send',async()=>{const r=await route(popup,{requestDocument:'old'});assert.equal(r.sends,0);assert.equal(r.response.error,'DOCUMENT_CHANGED');});
test('iframe alone cannot replace top frame',async()=>assert.equal((await route(popup,{frames:[{frameId:1,documentId:'document-A'}]})).sends,0));
test('outside host rejected before send',async()=>assert.equal((await route(popup,{url:'https://example.com/'})).sends,0));
test('lost receiver response remains failure',async()=>assert.equal((await route(popup,{lost:true})).response.error,'RECEIVER_MISSING'));

test('receiver duplicate injection preserves singleton and single listener',()=>{
 let listeners=0;const context=vm.createContext({crypto:{randomUUID:()=> 'stable-instance'},chrome:{runtime:{onMessage:{addListener:()=>listeners++}}}});
 const source=readFileSync(new URL('../receiver.js',import.meta.url),'utf8');
 vm.runInContext(source,context);vm.runInContext(source,context);
 assert.equal(listeners,1);assert.equal(context.__focurveSenderProbe.instance,'stable-instance');
});
test('probe manifest has no external channel or product storage/DNR permissions',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../manifest.json',import.meta.url),'utf8'));
 assert.equal(manifest.externally_connectable,undefined);
 assert.deepEqual(manifest.permissions,['tabs','scripting','webNavigation']);
 assert.deepEqual(manifest.host_permissions,['https://www.youtube.com/*']);
 const source=readFileSync(new URL('../worker.js',import.meta.url),'utf8')+readFileSync(new URL('../receiver.js',import.meta.url),'utf8');
 assert.equal(source.includes('onMessageExternal'),false);
});

for(const key of ['tabId','frameId','documentId','instance'])for(const value of [null,undefined,{},[]])test(`invalid bound ${key} ${JSON.stringify(value)}`,()=>assert.equal(matchesBinding({...binding,[key]:value},binding),false));
for(const active of [false,undefined,null,'active',1])test(`invalid lifecycle ${JSON.stringify(active)}`,()=>assert.equal(matchesBinding(binding,{...binding,active}),false));
for(const url of [runtime.getURL('options.html'),runtime.getURL('other-worker.js'),'https://www.youtube.com/','chrome-extension://other/worker.js'])test(`other source ${url}`,()=>assert.equal(acceptsWorker({...worker,url},runtime),false));
test('fresh instance cannot inherit previous document authority',()=>{
 const replaced={...binding,documentId:'document-B',instance:'instance-B'};
 assert.equal(matchesBinding(binding,replaced),false);
 assert.equal(matchesBinding(replaced,replaced),true);
});
test('frozen/BFCache synthetic binding denied until independently revalidated',()=>{
 const frozen={...binding,active:false};assert.equal(matchesBinding(binding,frozen),false);
 assert.equal(matchesBinding({...binding,active:true},frozen),false);
 assert.equal(matchesBinding(binding,{...binding,active:true}),true);
});
test('valid sender alone cannot authorize a different tab/document',()=>{
 assert.equal(acceptsWorker(worker,runtime)&&matchesBinding({...binding,tabId:2},binding),false);
 assert.equal(acceptsWorker({...worker,url:runtime.getURL('popup.html')},runtime)&&matchesBinding(binding,binding),false);
});
