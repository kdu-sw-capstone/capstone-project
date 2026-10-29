import { canonical, fingerprint, validateA0, UUID, confirmedEffect, confirmedRelease } from './contract.mjs';
import registrySchema from './registry-schema.json' with { type:'json' };
export const REGISTRY_VERSION='d06-a0-registry-candidate-1';
export function validateRegistry(value,definition=null){
 const match=(v,s)=>{
  if(s.$ref)return match(v,registrySchema.$defs[s.$ref.split('/').at(-1)]);
  if(s.oneOf&&s.oneOf.filter(x=>match(v,x)).length!==1)return false;
  if(s.anyOf&&!s.anyOf.some(x=>match(v,x)))return false;
  if(s.not&&match(v,s.not))return false;
  if(Object.hasOwn(s,'const')&&v!==s.const||s.enum&&!s.enum.includes(v))return false;
  if(s.type==='null'&&v!==null||s.type==='boolean'&&typeof v!=='boolean')return false;
  if(s.type==='integer'&&(!Number.isSafeInteger(v)||v<(s.minimum??-Infinity)||v>(s.maximum??Infinity)))return false;
  if(s.type==='string'&&(typeof v!=='string'||[...v].length<(s.minLength??0)||[...v].length>(s.maxLength??Infinity)||s.pattern&&!new RegExp(s.pattern).test(v)))return false;
  if(s.type==='array'&&(!Array.isArray(v)||v.length<(s.minItems??0)||v.length>(s.maxItems??Infinity)||!v.every(x=>match(x,s.items))))return false;
  if(s.type==='object'&&(v===null||typeof v!=='object'||Array.isArray(v)||s.required.some(k=>!Object.hasOwn(v,k))||s.additionalProperties===false&&Object.keys(v).some(k=>!Object.hasOwn(s.properties,k))||Object.entries(s.properties).some(([k,t])=>Object.hasOwn(v,k)&&!match(v[k],t))))return false;
  if(s.allOf&&!s.allOf.every(x=>!x.if||!match(v,x.if)||match(v,x.then)))return false;
  return true;
 };return match(value,definition?registrySchema.$defs[definition]:registrySchema);
}
const clone=structuredClone, id=()=>crypto.randomUUID(), fail=code=>{throw new Error(code);};
const same=(a,b)=>canonical(a)===canonical(b);
const wireError=(request,code)=>({request_id:request,status:'ERROR',data:null,error:{protocol_version:REGISTRY_VERSION,code,retryable:['STORE_FAILED','STORE_QUEUE_FULL'].includes(code)}});
function validRow(r){
 if(!r||!UUID.test(r.registry_id)||!UUID.test(r.registry_epoch)||!UUID.test(r.record_version)||!UUID.test(r.core?.instance)||!validateA0(r.core.authority?.context,'context')||!validateA0(r.core.authority?.policy,'policy')||r.core.authority.owner_context!=='GUEST:'+r.core.authority.context.executor_id||!Number.isSafeInteger(r.core.tabId)||r.core.tabId<0||!/^[0-9a-f]{64}$/.test(r.credential)||r.credential==='0'.repeat(64)||!['PROVISIONAL','READY','BLOCKED'].includes(r.readiness)||!['ACTIVE','INACTIVE','GONE'].includes(r.lifecycle)||!Number.isSafeInteger(r.seq)||r.seq<0||!Array.isArray(r.ledger)||!Array.isArray(r.archive)||!Array.isArray(r.fifo)||!Array.isArray(r.receipt_fifo)||!r.operations||!r.writes||!r.core.requests)return false;
 if(r.ledger.length>512||r.archive.length>512||r.fifo.length>64||r.receipt_fifo.length>128)return false;
 const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
 if(!object(r.operations)||!object(r.writes)||!object(r.core.requests)||!['NONE','WORKER_RECREATED','RECORD_INVALID','DOCUMENT_UNREACHABLE'].includes(r.recovery)||![r.cleanup_pending,r.apply_closed,r.registered,r.core.active].every(x=>typeof x==='boolean'))return false;
 if(r.current!==null&&!validateA0(r.current,'current'))return false;
 if(![...r.ledger,...r.archive].every(e=>validateRegistry(e,'ledger_entry'))||new Set(r.ledger.map(e=>e.node_id)).size!==r.ledger.length)return false;
 if(Object.values(r.operations).filter(x=>x.cleanup).length>32||Object.values(r.operations).filter(x=>!x.cleanup).length>256||Object.values(r.writes).filter(x=>x.cleanup).length>256||Object.values(r.writes).filter(x=>!x.cleanup).length>1024)return false;
 if(!Object.entries(r.core.requests).every(([key,m])=>UUID.test(key)&&validateA0(m)&&m.type==='D06_CONTENT_CONTROL'&&m.payload.operation_id===key&&m.payload.target_document_id===r.core.authority.context.document_id&&(m.payload.context===null||same(m.payload.context,r.core.authority.context)&&m.owner_context===r.core.authority.owner_context&&m.payload.content_instance_id===r.core.instance)))return false;
 if(!Object.entries(r.writes).every(([key,x])=>UUID.test(key)&&object(x)&&typeof x.fp==='string'&&typeof x.cleanup==='boolean'&&(x.response===null||validateRegistry(x.response,'registry_ok')&&x.response.data.write_id===key)))return false;
 if(!r.fifo.every(key=>r.operations[key]&&!r.operations[key].cleanup)||!r.receipt_fifo.every(key=>r.writes[key]&&!r.writes[key].cleanup))return false;
 return Object.entries(r.operations).every(([key,x])=>UUID.test(key)&&object(x)&&r.core.requests[key]&&x.fp===fingerprint(r.core.requests[key])&&typeof x.cleanup==='boolean'&&['IN_FLIGHT','COMPLETED','RESULT_EVICTED','IN_DOUBT'].includes(x.phase)&&(x.response===null||validateA0(x.response)));
}
export class A0Registry {
 constructor({indexedDB=globalThis.indexedDB,name='focurve-a0-registry',beforeCommit=null}={}){this.indexedDB=indexedDB;this.name=name;this.beforeCommit=beforeCommit;this.pending=new Map();}
 async transaction(work){
  const db=await new Promise((resolve,reject)=>{const q=this.indexedDB.open(this.name,1);q.onupgradeneeded=()=>q.result.createObjectStore('registry',{keyPath:'registry_id'});q.onsuccess=()=>resolve(q.result);q.onerror=q.onblocked=()=>reject(Error('STORE_FAILED'));});
  try{return await new Promise((resolve,reject)=>{const tx=db.transaction('registry','readwrite'),store=tx.objectStore('registry');let result,reason;tx.oncomplete=()=>resolve(clone(result));tx.onabort=()=>reject(reason??Error('STORE_FAILED'));const q=store.getAll();q.onsuccess=()=>{try{if(q.result.some(r=>!validRow(r)))fail('STORE_RECORD_INVALID');let dirty=false;result=work(q.result,{put:value=>{dirty=true;return store.put(value);}});if(dirty&&this.beforeCommit)this.beforeCommit();}catch(e){reason=e;tx.abort();}};q.onerror=()=>tx.abort();});}finally{db.close();}
 }
 list(){return this.transaction(rows=>rows);}
 note(key,response){return this.transaction((rows,s)=>{const r=rows.find(x=>x.registry_id===key);if(!r)fail('STORE_UNAUTHORIZED');r.core.last=clone(response);s.put(r);return r;});}
 invalidateTab(tabId){return this.transaction((rows,s)=>{for(const r of rows.filter(x=>x.core.tabId===tabId)){this.mutate(r,{kind:'INVALIDATE'});r.record_version=id();s.put(r);}return rows;});}
 create(core,credential){return this.transaction((rows,s)=>{if(rows.some(r=>r.core.active||r.cleanup_pending))fail('CLEANUP_REQUIRED');const r={registry_id:id(),registry_epoch:id(),record_version:id(),credential,core:clone(core),readiness:'PROVISIONAL',lifecycle:'ACTIVE',recovery:'NONE',seq:0,cleanup_pending:false,apply_closed:false,registered:false,current:null,ledger:[],archive:[],operations:{},fifo:[],writes:{},receipt_fifo:[]};if(!validRow(r))fail('STORE_RECORD_INVALID');s.put(r);return r;});}
 ready(key){return this.transaction((rows,s)=>{const r=rows.find(x=>x.registry_id===key);if(!r||r.lifecycle!=='ACTIVE'||r.readiness!=='PROVISIONAL')fail('STORE_NOT_READY');r.readiness='READY';r.record_version=id();s.put(r);return r;});}
 issue(key,m){return this.transaction((rows,s)=>{const r=rows.find(x=>x.registry_id===key);if(!r||!validateA0(m)||m.type!=='D06_CONTENT_CONTROL')fail('STORE_INVALID_SCHEMA');const p=m.payload,a=r.core.authority;if(p.target_document_id!==a.context.document_id||p.context!==null&&(!same(p.context,a.context)||m.owner_context!==a.owner_context||p.content_instance_id!==r.core.instance))fail('STORE_SCOPE_MISMATCH');if(p.operation==='APPLY'&&(!same(p.policy,a.policy)||p.rule_id!==a.rule_id||p.cleanup_authorization_id!==a.cleanup_authorization_id))fail('STORE_SCOPE_MISMATCH');if(p.operation==='RELEASE'&&(p.applied_binding_id!==a.context.binding_id||p.cleanup_authorization_id!==a.cleanup_authorization_id))fail('STORE_SCOPE_MISMATCH');const old=r.core.requests[p.operation_id];if(old){if(fingerprint(old)!==fingerprint(m))fail('STORE_WRITE_CONFLICT');return r;}const cleanup=p.operation==='RELEASE';if(Object.values(r.core.requests).filter(x=>(x.payload.operation==='RELEASE')===cleanup).length>=(cleanup?32:256))fail('STORE_CAPACITY');r.core.requests[p.operation_id]=clone(m);s.put(r);return r;});}
 recover(){return this.transaction((rows,s)=>{for(const r of rows){r.lifecycle='INACTIVE';r.apply_closed=true;r.core.active=false;r.core.cleanup_pending=r.cleanup_pending||r.registered;r.recovery='WORKER_RECREATED';for(const op of Object.values(r.operations))if(op.phase==='IN_FLIGHT')op.phase='IN_DOUBT';if(r.current){r.current.lifecycle='INACTIVE';r.current.effect='UNCONFIRMED';r.current.binding_state='CLEANUP_PENDING';}r.record_version=id();s.put(r);}return rows;});}
 async handle(m,sender,chrome){
  if(!UUID.test(m?.request_id??''))return null;
  if(!validateRegistry(m,m?.payload?.action==='READ'?'registry_read':'registry_commit'))return wireError(m.request_id,'STORE_INVALID_SCHEMA');
  if(new TextEncoder().encode(canonical(m)).length>262144)return wireError(m.request_id,'STORE_CAPACITY');
  const key=m.payload.registry_id;
  try{
   // Native metadata is never supplied by the message body.
   if(!sender||sender.id!==chrome.runtime.id||sender.frameId!==0||!Number.isSafeInteger(sender.tab?.id)||!sender.documentId||!['active','cached'].includes(sender.documentLifecycle)||sender.origin!=='https://www.youtube.com')fail('STORE_UNAUTHORIZED');
   const frames=await chrome.webNavigation.getAllFrames({tabId:sender.tab.id});
   const frame=frames.find(f=>f.frameId===0&&f.documentId===sender.documentId);
   if(!frame||frame.url!==sender.url||frame.documentLifecycle!==sender.documentLifecycle)fail('STORE_UNAUTHORIZED');
   const p=m.payload;let cleanup=false;
   const snapshot=(await this.list()).find(r=>r.registry_id===key);
   if(!snapshot)fail('STORE_UNAUTHORIZED');
   const op=p.change?.operation_id,saved=snapshot.core.requests[op];cleanup=saved?.payload.operation==='RELEASE';
   if(snapshot.lifecycle!=='ACTIVE'&&!cleanup&&p.action!=='READ'&&p.change?.kind!=='INVALIDATE')fail('STORE_INACTIVE');
   if(sender.documentLifecycle!=='active'&&snapshot.lifecycle==='ACTIVE')fail('STORE_INACTIVE');
   const queue=this.pending.get(key)??{general:0,cleanup:0};const slot=cleanup?'cleanup':'general';if(queue[slot]>=(cleanup?8:32))fail('STORE_QUEUE_FULL');queue[slot]++;this.pending.set(key,queue);
   try{return await this.transaction((rows,store)=>{
    const r=rows.find(x=>x.registry_id===key),a=r?.core.authority;
    if(!r||sender.tab.id!==r.core.tabId||sender.documentId!==a.context.document_id||sender.url!==a.url||p.channel_credential!==r.credential)fail('STORE_UNAUTHORIZED');
    if(m.owner_context!==a.owner_context||!same(p.context,a.context)||p.content_instance_id!==r.core.instance||p.registry_epoch!==r.registry_epoch)fail('STORE_SCOPE_MISMATCH');
    if(p.action==='READ')return this.read(r,m);
    const fp=fingerprint(m),prior=r.writes[p.write_id];
    if(prior){if(prior.fp!==fp)fail('STORE_WRITE_CONFLICT');if(!prior.response)fail('STORE_RESULT_EVICTED');return {...clone(prior.response),request_id:m.request_id};}
    if(p.expected_record_version!==r.record_version)fail('STORE_VERSION_CONFLICT');
    const operation=r.core.requests[p.change.operation_id],isCleanup=operation?.payload.operation==='RELEASE';
    if(r.lifecycle!=='ACTIVE'&&!isCleanup&&p.change.kind!=='INVALIDATE')fail('STORE_INACTIVE');
    if(r.readiness!=='READY'&&p.change.kind!=='INVALIDATE')fail('STORE_NOT_READY');
    if(Object.values(r.writes).filter(w=>w.cleanup===isCleanup).length>=(isCleanup?256:1024))fail('STORE_CAPACITY');
    this.mutate(r,p.change);r.record_version=id();
    const result={request_id:m.request_id,status:'OK',data:{protocol_version:REGISTRY_VERSION,registry_id:key,registry_epoch:r.registry_epoch,record_version:r.record_version,action:'COMMIT',write_id:p.write_id,commit_receipt:id(),state:null},error:null};
    r.writes[p.write_id]={fp,cleanup:isCleanup,response:clone(result)};
    if(!isCleanup){r.receipt_fifo.push(p.write_id);while(r.receipt_fifo.length>128)r.writes[r.receipt_fifo.shift()].response=null;}
    store.put(r);return result;
   });}finally{queue[slot]--;}
  }catch(e){return wireError(m.request_id,/^STORE_/.test(e.message)?e.message:'STORE_FAILED');}
 }
 read(r,m){const p=m.payload,s=p.selector;let state;
  if(s.view==='SUMMARY')state={view:s.view,readiness:r.readiness,lifecycle:r.lifecycle,control_seq:r.seq,cleanup_pending:r.cleanup_pending,apply_closed:r.apply_closed,recovery:r.recovery,current:r.current};
  if(s.view==='LEDGER')state={view:s.view,entries:r.ledger,cleanup_pending:r.cleanup_pending};
  if(s.view==='OPERATION'){const op=r.operations[s.operation_id];if(!op)fail('STORE_UNKNOWN_OPERATION');state={view:s.view,operation_id:s.operation_id,phase:op.phase,response:op.response};}
  if(s.view==='RECEIPT'){const w=r.writes[s.write_id];if(!w)fail('STORE_UNKNOWN_WRITE');state={view:s.view,write_id:s.write_id,phase:w.response?'COMMITTED':'RESULT_EVICTED',commit_receipt:w.response?.data.commit_receipt??null,committed_record_version:w.response?.data.record_version??null};}
  const reply={request_id:m.request_id,status:'OK',data:{protocol_version:REGISTRY_VERSION,registry_id:r.registry_id,registry_epoch:r.registry_epoch,record_version:r.record_version,action:'READ',write_id:null,commit_receipt:null,state:clone(state)},error:null};if(!validateRegistry(reply,'registry_ok')||new TextEncoder().encode(canonical(reply)).length>262144)fail('STORE_CAPACITY');return reply;
 }
 mutate(r,c){
  if(c.kind==='INVALIDATE'){r.lifecycle='INACTIVE';r.apply_closed=true;r.core.active=false;if(r.current){r.current.lifecycle='INACTIVE';r.current.effect='UNCONFIRMED';r.current.binding_state='CLEANUP_PENDING';}return;}
  const command=r.core.requests[c.operation_id];if(!command)fail('STORE_UNKNOWN_OPERATION');const q=command.payload,isCleanup=q.operation==='RELEASE',op=r.operations[c.operation_id];
  if(c.kind==='BEGIN_OPERATION'){
   if(op)fail('STORE_WRITE_CONFLICT');
   if(Object.values(r.operations).filter(x=>x.cleanup===isCleanup).length>=(isCleanup?32:256))fail('STORE_CAPACITY');
   if(q.operation==='APPLY'&&(r.registered||r.apply_closed||r.lifecycle!=='ACTIVE'))fail('STORE_INACTIVE');
   if(q.operation==='RELEASE'&&!r.registered)fail('STORE_UNKNOWN_OPERATION');
   if(q.operation!=='QUERY'&&q.release_mode!=='CLEANUP_ONLY'){if(q.control_seq<=r.seq)fail('STORE_SCOPE_MISMATCH');r.seq=q.control_seq;}
   if(q.release_mode==='CLEANUP_ONLY'&&!(r.cleanup_pending||r.seq===Number.MAX_SAFE_INTEGER||r.lifecycle!=='ACTIVE'))fail('STORE_SCOPE_MISMATCH');
   if(q.operation==='APPLY'){r.registered=true;r.cleanup_pending=true;}
   if(isCleanup)r.apply_closed=true;
   r.operations[c.operation_id]={fp:fingerprint(command),cleanup:isCleanup,phase:'IN_FLIGHT',response:null};return;
  }
  // Completion freezes the first response, not the lifetime of an active
  // observer. Later owned DOM plans stay tied to this original APPLY/round.
  const livePlan=c.kind==='LEDGER_PLAN'&&q.operation==='APPLY'&&
   ['COMPLETED','RESULT_EVICTED'].includes(op?.phase)&&
   r.current?.result_state==='APPLIED'&&r.current.round_id===q.observation.round_id&&
   (op.phase==='RESULT_EVICTED'||op.response?.data?.result_state==='APPLIED');
  if(!op||(op.phase!=='IN_FLIGHT'&&!livePlan))fail('STORE_WRITE_CONFLICT');
  if(c.kind==='LEDGER_PLAN'){
   if(q.operation!=='APPLY'||r.lifecycle!=='ACTIVE'||r.apply_closed)fail('STORE_INACTIVE');
   const ids=new Set();for(const e of c.entries){if(ids.has(e.node_id))fail('STORE_INVALID_SCHEMA');ids.add(e.node_id);const old=r.ledger.find(x=>x.node_id===e.node_id);if(old&&!same(old,e))fail('STORE_WRITE_CONFLICT');if(!old)r.ledger.push(clone(e));}if(r.ledger.length>512)fail('STORE_CAPACITY');return;
  }
  const response=c.response;if(!validateA0(response)||response.request_id!==command.request_id)fail('STORE_INVALID_SCHEMA');
  if(response.status==='OK'){
   const d=response.data;if(d.operation_id!==c.operation_id||d.operation!==q.operation||d.target_document_id!==r.core.authority.context.document_id||d.content_instance_id!==r.core.instance)fail('STORE_SCOPE_MISMATCH');
   if(d.result_state==='APPLIED'&&(!confirmedEffect(d.evidence)||r.lifecycle!=='ACTIVE'||r.apply_closed))fail('STORE_INACTIVE');
   if(d.result_state==='RELEASED'&&(!confirmedRelease(d.release_evidence)||d.applied_binding_id!==r.core.authority.context.binding_id))fail('STORE_SCOPE_MISMATCH');
   if(q.operation==='QUERY'&&q.context!==null)r.current=clone(d.current);
   if(q.operation==='APPLY')r.current={binding_state:d.result_state==='APPLIED'?'ACTIVE':'CLEANUP_PENDING',lifecycle:r.lifecycle,control_seq:r.seq,result_state:d.result_state,effect:d.effect,round_id:d.round_id,evidence:d.evidence,release_evidence:null};
   if(isCleanup){r.current={binding_state:d.result_state==='RELEASED'?'RESTORED':'CLEANUP_PENDING',lifecycle:r.lifecycle,control_seq:r.seq,result_state:d.result_state,effect:d.effect,round_id:null,evidence:null,release_evidence:d.release_evidence};if(d.result_state==='RELEASED'){r.archive=clone(r.ledger);r.ledger=[];r.cleanup_pending=false;r.core.cleanup_pending=false;r.core.active=false;}}
  }
  op.response=clone(response);op.phase='COMPLETED';if(!isCleanup){r.fifo.push(c.operation_id);while(r.fifo.length>64){const old=r.operations[r.fifo.shift()];old.response=null;old.phase='RESULT_EVICTED';}}
 }
}
