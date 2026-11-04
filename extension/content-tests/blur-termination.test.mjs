import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,tick} from './blur-termination-fixture.mjs';import {BlurSession} from '../content/blur-session.mjs';
function make(extra={}){const h=fixture();h.requests=[];h.session=new BlurSession(h.doc,{profile:{id:'fixture',sha256:'b'.repeat(64),level:'HIGH'},canApply:()=>true,timeoutMs:100,
 classifyImage:()=>new Promise(resolve=>h.requests.push(resolve)),...extra});return h;}
test('blur release preserves unobserved classifier continuation after overlays are restored',async t=>{const h=make();t.after(()=>{h.requests.forEach(r=>r({verdict:'SAFE',profile_sha256:'b'.repeat(64)}));h.session.release();});h.session.start();await tick();
 const r=h.session.release();assert.equal(r.restored,true);assert.equal(r.cleanup_pending,true);assert.equal(h.session.inspect().local_termination.pending_model_tasks,1);
 h.requests[0]({verdict:'SAFE',profile_sha256:'b'.repeat(64)});await tick();assert.equal(h.session.inspect().local_termination.locally_quiescent,true);});
test('blur observer failure still detaches later global listeners and remains retryable',async t=>{const h=make();t.after(()=>{h.observers[0].failDisconnect=false;h.requests.forEach(r=>r({verdict:'SAFE',profile_sha256:'b'.repeat(64)}));h.session.release();});h.session.start();await tick();h.observers[0].failDisconnect=true;
 assert.equal(h.session.release().cleanup_pending,true);assert.equal(h.doc.listeners.get('load').size,0);assert.equal(h.win.listeners.get('scroll').size,0);
 h.observers[0].failDisconnect=false;h.requests[0]({verdict:'SAFE',profile_sha256:'b'.repeat(64)});await tick();assert.equal(h.session.release().cleanup_pending,false);});

test('blur timeout cannot convert a nonsettling provider into completed cleanup',async t=>{const h=make();t.after(()=>{h.requests.forEach(r=>r({verdict:'SAFE',profile_sha256:'b'.repeat(64)}));h.session.release();});h.session.start();await tick();await new Promise(r=>setTimeout(r,120));
 assert.equal(h.session.inspect().local_termination.analysis_loop_in_progress,false);assert.equal(h.session.inspect().local_termination.pending_model_tasks,1);
 assert.equal(h.session.release().cleanup_pending,true);h.requests[0]({verdict:'SAFE',profile_sha256:'b'.repeat(64)});await tick();assert.equal(h.session.inspect().cleanup_pending,false);});
test('blur image decode continuation is tracked even before model dispatch',async t=>{const h=make();let resolve;h.image.decode=()=>new Promise(r=>resolve=r);t.after(()=>{resolve();h.session.release();});h.session.start();
 assert.equal(h.session.release().cleanup_pending,true);assert.equal(h.requests.length,0);resolve();await tick();assert.equal(h.requests.length,0);assert.equal(h.session.inspect().local_termination.locally_quiescent,true);});
test('blur failed cover removal retries original cleanup without touching another session',async t=>{const h=make();const other=new BlurSession(h.doc,{profile:{id:'other',sha256:'c'.repeat(64),level:'HIGH'},canApply:()=>true,classifyImage:async()=>({verdict:'SAFE',profile_sha256:'c'.repeat(64)})});
 t.after(()=>{h.doc.created.forEach(e=>e.failRemoveNode=false);h.requests.forEach(r=>r({verdict:'SAFE',profile_sha256:'b'.repeat(64)}));h.session.release();other.release();});
 h.image.style.filter='grayscale(1)';h.session.start();other.start();await tick();const covers=h.doc.created.filter(e=>e.tagName==='BUTTON'),own=covers[0],foreign=covers[1];own.failRemoveNode=true;
 assert.equal(h.session.release().restored,false);assert.equal(foreign.isConnected,true);own.failRemoveNode=false;h.requests[0]({verdict:'SAFE',profile_sha256:'b'.repeat(64)});await tick();
 assert.equal(h.session.release().cleanup_pending,false);assert.equal(foreign.isConnected,true);assert.equal(h.image.style.filter,'grayscale(1)');});
test('blur image listener failure preserves a retryable row after DOM overlay removal',async t=>{const h=make();t.after(()=>{h.image.failRemove=false;h.requests.forEach(r=>r({verdict:'SAFE',profile_sha256:'b'.repeat(64)}));h.session.release();});h.session.start();await tick();h.image.failRemove=true;
 assert.equal(h.session.release().restored,false);assert.equal(h.session.inspect().local_termination.target_listeners_pending,1);
 h.image.failRemove=false;h.requests[0]({verdict:'SAFE',profile_sha256:'b'.repeat(64)});await tick();assert.equal(h.session.release().cleanup_pending,false);});
for(const change of ['pagehide','route','document','source'])test(`blur late response after ${change} never paints a replacement or clears old pending prematurely`,async t=>{const h=make();t.after(()=>{h.win.document=h.doc;h.requests.forEach(r=>r({verdict:'SAFE',profile_sha256:'b'.repeat(64)}));h.session.release();});h.session.start();await tick();
 if(change==='pagehide')h.win.dispatchEvent(new Event('pagehide'));
 if(change==='route'){h.doc.location=new URL('https://example.test/other');h.win.navigation.dispatchEvent(new Event('currententrychange'));}
 if(change==='document'){h.win.document={};h.session.scan();}
 if(change==='source'){h.image.src='new-fixture';h.session.scan();}
 assert.equal(h.session.release().cleanup_pending,true);h.requests[0]({verdict:'SAFE',profile_sha256:'b'.repeat(64)});await tick();
 assert.equal(h.requests.length,1);assert.equal(h.doc.created.filter(e=>e.tagName==='BUTTON'&&e.isConnected).length,0);assert.equal(h.session.inspect().cleanup_pending,false);});
test('blur unobservable partial observer startup stays unconfirmed after known listeners detach',()=>{const h=make();h.win.MutationObserver=class{constructor(){throw Error('UNKNOWN_OBSERVER');}};
 assert.throws(()=>h.session.start(),/UNKNOWN_OBSERVER/);assert.equal(h.session.release().cleanup_pending,true);assert.equal(h.session.inspect().local_termination.observer_stopped,false);
 assert.equal(h.win.navigation.listeners.get('currententrychange').size,0);});
test('blur real scan stack remains pending through reentrant release',async t=>{const h=make();t.after(()=>h.session.release());const create=h.doc.createElement;let during;
 h.doc.createElement=tag=>{const node=create(tag);if(tag==='button')during=h.session.release();return node;};h.session.start();assert.equal(during.local_termination.scan_in_progress,true);assert.equal(during.cleanup_pending,true);
 await tick();assert.equal(h.session.inspect().local_termination.locally_quiescent,true);assert.equal(h.requests.length,0);});
test('blur canceled refresh and animation callback stay fenced after release',async t=>{const h=make();h.doc.images=[];t.after(()=>h.session.release());h.session.start();h.session.refresh();h.session.move();
 const q=h.session.release();assert.equal(q.local_termination.scan_scheduled,false);assert.equal(q.local_termination.position_scheduled,false);assert.equal(q.cleanup_pending,false);
 await new Promise(r=>setTimeout(r,130));assert.equal(h.requests.length,0);});

test('blur provider rejection after release is counted as a real settled continuation',async t=>{let reject;const h=make({classifyImage:()=>new Promise((_,r)=>reject=r)});t.after(()=>h.session.release());h.session.start();await tick();
 assert.equal(h.session.release().cleanup_pending,true);reject(Error('PROVIDER_FAILED'));await tick();assert.equal(h.session.inspect().local_termination.pending_model_tasks,0);assert.equal(h.session.inspect().cleanup_pending,false);});
test('blur current position callback cannot claim completed cleanup before returning',async t=>{const h=make();t.after(()=>h.session.release());h.session.start();await tick();h.requests[0]({verdict:'SAFE',profile_sha256:'b'.repeat(64)});await tick();let during;
 const rect=h.image.getBoundingClientRect.bind(h.image);h.image.getBoundingClientRect=()=>{if(!during)during=h.session.release();return rect();};h.session.move();await new Promise(r=>setTimeout(r,10));
 assert.equal(during.local_termination.callbacks_in_progress>0,true);assert.equal(during.cleanup_pending,true);assert.equal(h.session.inspect().local_termination.locally_quiescent,true);});
test('blur termination metadata is a copy without image source or DOM content',async t=>{const h=make();t.after(()=>{h.requests.forEach(r=>r({verdict:'SAFE',profile_sha256:'b'.repeat(64)}));h.session.release();});h.session.start();await tick();h.session.release();
 const q=h.session.inspect();q.local_termination.pending_model_tasks=0;assert.equal(h.session.inspect().local_termination.pending_model_tasks,1);assert.equal(JSON.stringify(q.local_termination).includes('fixture'),false);});

test('blur observer callback cannot confirm local drain from inside its own stack',async t=>{const h=make({classifyImage:async()=>({verdict:'SAFE',profile_sha256:'b'.repeat(64)})});t.after(()=>h.session.release());h.session.start();await tick();let during;
 h.observers[0].callback([{target:{closest(){during=h.session.release();return false;}}}]);assert.equal(during.local_termination.callbacks_in_progress,1);assert.equal(during.cleanup_pending,true);assert.equal(h.session.inspect().local_termination.locally_quiescent,true);});
