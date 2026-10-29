/* R2 safety observation. No product modules, messages, mutation or network APIs. */
(function(root){
 'use strict';
 const canonical=v=>JSON.stringify(Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])):v);
 // IndexedDB structured clones retain explicit undefined values. Keep that
 // distinct from a missing field; identity digest canonicalization stays unchanged.
 function observationCanonical(value){
  const encode=v=>v===undefined?['undefined']:v===null?['null']:typeof v==='string'?['string',v]:typeof v==='boolean'?['boolean',v]:typeof v==='number'&&Number.isFinite(v)?['number',v]:
   Array.isArray(v)?['array',Array.from({length:v.length},(_,i)=>Object.hasOwn(v,i)?encode(v[i]):['hole'])]:
   v&&Object.prototype.toString.call(v)==='[object Object]'?['object',Object.keys(v).sort().map(k=>[k,encode(v[k])])]:
   (()=>{throw Error('OBSERVATION_VALUE_UNSUPPORTED');})();
  return JSON.stringify(encode(value));
 }
 const terminal=new Set(['ENDED','START_FAILED','INTERRUPTED']);
 const fields=['activeSessions','unresolvedBindings','unreleasedJournals','pendingLeases','pendingOutbox','pendingImports','transitions','rootClaims','sessionRules','dynamicRules'];
 const sessionStores={metadata:'key',sessions:['owner_key','session_id'],journal:['owner_key','session_id'],events:['owner_key','event_id'],intervals:['owner_key','interval_id'],outbox:['owner_key','item_id']};
 function schema(name){
  if(name==='focurve-a0-registry')return {registry:'registry_id'};
  if(name==='focurve-local')return {metadata:'key',owner_settings:'owner_key'};
  if(name==='focurve-execution'||name==='focurve-member-a1-root-authority'||/^focurve-member-a1:[a-f0-9]{64}$/.test(name))return sessionStores;
  if(name==='focurve-member-execution'||name==='focurve-member-control')return {journal:['owner_key','session_id']};
  if(name==='focurve-member-reports')return {reports:['owner_key','executor_id','report_id']};
  if(name==='focurve-member-events'||/^member-a1-site-events:[a-f0-9]{64}$/.test(name))return {events:['owner_key','event_id']};
  if(name==='focurve-member-access'||/^member-a1-site-access:[a-f0-9]{64}$/.test(name))return {pending:'tab_id',sequences:'scope',originals:['scope','event_id']};
  return null;
 }
 // P1 revalidation is retained evidence, never a new cleanup/Native authority.
 // Mirror the current pure P1 wire schema and bind it to the stored proof,
 // binding, aggregate and session. Unknown/corrupt rows still reject clearance.
 function validNativeRevalidation(r,data){
  const common=['schema_version','record_kind','key','record_version','binding_id','owner_context','executor_id','session_id'];
  const boot=['proof_id','proof_version','boot','profile','generation','fence_epoch','native_url_sha256','challenge_id','challenge_sha256','scope_sha256'];
  const attested=['phase','reserved_sidecars','proof_id','scope_sha256','snapshot_sha256','registration_epoch','content_instance','credential_sha256','receiver_sha256','tab_id','frame_id','document_id','origin','sender_url_sha256','native_url_sha256','creation_boot','profile','generation','fence_epoch','challenge_id','challenge_sha256','pre_effect'];
  const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(x),hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
  const shape=(x,kind,fields)=>x&&x.record_kind===kind&&x.schema_version==='FOCURVE_NATIVE_P1_1'&&Object.keys(x).sort().join(',')===[...common,...fields].sort().join(',')&&common.every(k=>typeof x[k]==='string'&&x[k])&&uuid(x.record_version)&&x.key==='a1:p1:'+kind+':'+x.binding_id&&new TextEncoder().encode(JSON.stringify(x)).length<=16384;
  if(!shape(r,'NATIVE_BOOT_REVALIDATION',boot)||!Number.isSafeInteger(r.generation)||r.generation<0||boot.filter(k=>k!=='generation').some(k=>typeof r[k]!=='string'||!r[k])||!['scope_sha256','native_url_sha256','challenge_sha256'].every(k=>hash(r[k])))return false;
  const md=data.metadata??[],p=md.find(x=>x.key==='a1:p1:NATIVE_BINDING_PROOF:'+r.binding_id),b=md.find(x=>x.key==='a1:binding:'+r.binding_id),a=md.find(x=>x.key==='a1:aggregate:'+r.session_id),session=(data.sessions??[]).find(x=>x.session_id===r.session_id&&x.owner_key===r.owner_context&&x.executor_id===r.executor_id);
  if(!shape(p,'NATIVE_BINDING_PROOF',attested)||p.phase!=='ATTESTED'||p.reserved_sidecars!==3||p.frame_id!==0||!Number.isInteger(p.tab_id)||!Number.isSafeInteger(p.generation)||p.pre_effect!==true||attested.filter(k=>!['phase','reserved_sidecars','tab_id','frame_id','generation','pre_effect'].includes(k)).some(k=>typeof p[k]!=='string'||!p[k])||!['scope_sha256','snapshot_sha256','credential_sha256','receiver_sha256','sender_url_sha256','native_url_sha256','challenge_sha256'].every(k=>hash(p[k])))return false;
  return !!(session&&a?.record_kind==='A1_AGGREGATE'&&b?.record_kind==='A1_BINDING'&&['session_id','owner_context','executor_id'].every(k=>a[k]===r[k]&&b.scope?.[k]===r[k]&&p[k]===r[k])&&b.scope.binding_id===r.binding_id&&p.binding_id===r.binding_id&&p.proof_id===r.proof_id&&p.record_version===r.proof_version&&p.profile===r.profile&&p.scope_sha256===r.scope_sha256);
 }
 // Pure projection of a diagnostic row; never opens a Worker or grants CLEAR.
 function projectStoredFirstFailure(data,sessionId,owner,executor){
  const row=(data.metadata??[]).find(r=>r.key==='member:first-failure:'+sessionId);
  if(!row)return {status:'ABSENT',historicalEvidenceReconstructed:false};
  const invalid=()=>({status:'INVALID',historicalEvidenceReconstructed:false});
  const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(x);
  const fields=['key','contract','session_id','owner_key','executor_id','request_id','generation','transition_id','at_epoch_ms','diagnostic','authority_granted'];
  const sessions=(data.sessions??[]).filter(x=>x.session_id===sessionId&&x.owner_key===owner&&x.executor_id===executor),a=(data.metadata??[]).find(x=>x.key==='a1:aggregate:'+sessionId),d=row.diagnostic;
  const codes=['BFCACHE','RESPONSE_UNCONFIRMED','TAB_REMOVED','INACTIVE_SCOPE','MEMBER_COMMAND_REJECTED','UNSUPPORTED_POLICY','REVALIDATION_REQUIRED','CLEANUP_CAPACITY','CLEANUP_REQUIRED','STORE_UNCONFIRMED','OWNER_MISMATCH','GENERATION_CHANGED','INVALID_EFFECT_EVIDENCE','RUNNING_GATE_DENIED','INVALID_CURRENT_RESPONSE','SCOPE_MISMATCH','INVALID_TRANSITION_STATE','STORE_CAPACITY','UNCLASSIFIED_FAILURE'];
  const stages=['NATIVE_CENSUS','ROOT_NATIVE_CENSUS','DNR_REGEX','COMMAND_CONTRACT','NATIVE_TRANSITION_GUARD','DOCUMENT_RETIREMENT_GUARD','CORE_INVALIDATE','P1_NATIVE_POSTCHECK','REGISTRY_INVALIDATE','CONTENT_RESPONSE_WAIT','REPORT_PUBLICATION_WAIT','UNCLASSIFIED_STAGE'];
  const rejected=['native_url_sha256','native_frame','document_lifecycle','frame_id','protocol','hostname','isRegexSupported','native_transition_contract','dom_transition_contract','document_transition_contract','transition_version','profile_epoch','deadline_at','started_at','last_seen_at','worker_boot','serialized_bytes','prior_document_present','replacement_document_missing','replacement_document_identity','replacement_frame_type','replacement_error'];
  if(Object.keys(row).sort().join(',')!==fields.sort().join(',')||row.contract!=='MEMBER_FIRST_FAILURE_1'||row.authority_granted!==false||row.session_id!==sessionId||row.owner_key!==owner||row.executor_id!==executor||!uuid(sessionId)||!uuid(executor)||!uuid(row.request_id)||!Number.isSafeInteger(row.generation)||row.generation<1||!Number.isSafeInteger(row.at_epoch_ms)||row.at_epoch_ms<0||row.transition_id!==null&&!uuid(row.transition_id)||sessions.length!==1||sessions[0].start_request_id!==row.request_id||!a||a.owner_context!==owner||a.executor_id!==executor||row.generation>a.generation||!d||d.version!=='MEMBER_LOCAL_DIAGNOSTIC_1'||d.authority_granted!==false||!codes.includes(d.code)||!stages.includes(d.stage)||!Array.isArray(d.rejected_fields)||d.rejected_fields.some(x=>!rejected.includes(x))||Object.keys(d).some(k=>!['version','code','stage','rejected_fields','authority_granted','wait_stage','wait_started_at','wait_finished_at','transition_phase'].includes(k))||new TextEncoder().encode(JSON.stringify(row)).length>4096)return invalid();
  if(d.wait_stage!==undefined&&!['CONTENT_RESPONSE_WAIT','REPORT_PUBLICATION_WAIT'].includes(d.wait_stage)||d.transition_phase!==undefined&&!['VERIFYING','FRESH_ATTEST','FRESH_APPLY','SERVER_WAIT','CONFIRMED','FAILED'].includes(d.transition_phase)||['wait_started_at','wait_finished_at'].some(k=>d[k]!==undefined&&(!Number.isSafeInteger(d[k])||d[k]<0)))return invalid();
  return {status:'STORED_FIRST_FAILURE',sessionId:row.session_id,requestId:row.request_id,generation:row.generation,transitionId:row.transition_id,observedAtEpochMs:row.at_epoch_ms,code:d.code,stage:d.stage,...(d.wait_stage?{waitStage:d.wait_stage}:{}),...(d.wait_started_at!==undefined?{waitStartedAt:d.wait_started_at,waitFinishedAt:d.wait_finished_at}:{}),...(d.transition_phase?{transitionPhase:d.transition_phase}:{}),rejectedFields:[...d.rejected_fields],authorityGranted:false,historicalEvidenceReconstructed:false};
 }
 function project(rows,rules,auth,purpose){
  const c=Object.fromEntries(fields.map(k=>[k,0]));const issues=new Set();
  let guestMemberHandoffGuards=0;
  const uuid=s=>typeof s==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(s);
  const linkedMember=rows.find(r=>r.name==='focurve-member-a1:'+auth.scope);
  const guestFences=rows.find(r=>r.name==='focurve-execution')?.data.metadata?.filter(m=>m.key==='a1:owner-fence')??[];
  const invalid=()=>issues.add('ROW_SCHEMA_UNKNOWN');
  // Completed guest-to-member fencing is also a retained ownership marker during
  // explicit reauthentication. This projection never grants normal local clearance.
  const memberOwned=auth.phase==='LINKED'||purpose==='REAUTH_ONLY'&&(['AUTH_RECOVERY_REQUIRED'].includes(auth.phase)||auth.phase==='LINK_PENDING'&&auth.recovery_mode==='SAME_OWNER_RECOVERY_1_CANDIDATE');
  if(memberOwned&&guestFences.length!==1)invalid();
  // Guest A1 intentionally remains fenced after LINKED. It is not a member transition.
  // A real in-progress auth write instead has the GUEST owner and is never excluded.
  const guestHandoff=(name,data,m)=>name==='focurve-execution'&&memberOwned&&(purpose==='REAUTH_ONLY'||auth.error===null)&&linkedMember&&
   /^[1-9][0-9]*$/.test(String(auth.owner_user_id))&&uuid(auth.executor_id)&&
   Object.keys(m).sort().join(',')==='epoch,key,owner_context,transitioning'&&
   m.owner_context==='MEMBER_OR_TRANSITION'&&m.transitioning===true&&uuid(m.epoch)&&
   (data.sessions??[]).every(s=>terminal.has(s.status))&&
   !(linkedMember.data.metadata??[]).some(f=>f.key==='a1:owner-fence'&&f.transitioning!==false);
  const own='member-a1-site-access:'+auth.scope,receipts=rows.find(r=>r.name==='member-a1-site-events:'+auth.scope)?.data.events??[];
  const passive=p=>{try{const a=JSON.parse(p.scope);return Object.keys(p).sort().join(',')==='entry_fingerprint,fingerprint,scope,tab_id'&&/^feature-marker:[0-9]+:(?:[a-f0-9]{32}|[a-f0-9-]{36})$/i.test(p.tab_id)&&/^[a-f0-9]{64}$/.test(p.fingerprint)&&/^[a-f0-9]{64}$/.test(p.entry_fingerprint)&&a.length===6&&a[0]===auth.server_url&&a[1]==='MEMBER:'+auth.owner_user_id&&a[2]===auth.executor_id&&/^[a-f0-9-]{36}$/i.test(a[3])&&Number.isSafeInteger(a[4])&&a[4]>0&&/^[a-f0-9-]{36}$/i.test(a[5]);}catch{return false;}};

  for(const {name,data} of rows){
   for(const r of data.registry??[]){if(!r.core||typeof r.cleanup_pending!=='boolean')invalid();if(r.core?.active||r.cleanup_pending||(r.ledger??[]).length)c.unresolvedBindings++;}
   for(const s of data.sessions??[]){if(typeof s.status!=='string')invalid();else if(!terminal.has(s.status))c.activeSessions++;}
   for(const j of data.journal??[]){if(typeof j.desired!=='string'||typeof j.observed!=='string')invalid();else if(j.desired!=='RELEASED'||j.observed!=='RELEASED')c.unreleasedJournals++;}
   for(const m of data.metadata??[]){
    if(m.key==='current'&&(!(data.sessions??[]).some(s=>s.owner_key===m.owner_key&&s.session_id===m.session_id)||!(data.journal??[]).some(j=>j.owner_key===m.owner_key&&j.session_id===m.session_id)))invalid();
    if(typeof m.key!=='string'){invalid();continue;}
    if(m.record_kind==='NATIVE_BOOT_REVALIDATION'){if(!validNativeRevalidation(m,data))invalid();}
    else if(m.record_kind&&!['A1_AGGREGATE','A1_BINDING','A1_OPERATION','A1_WRITE_RECEIPT','CLEANUP_LEASE','DOM_EFFECT_PROOF','GUEST_FEATURE_CAPTURE','NATIVE_BINDING_PROOF'].includes(m.record_kind))invalid();
    if(m.record_kind==='GUEST_FEATURE_CAPTURE'){if(!['MARKER','PENDING','COMPLETED'].includes(m.phase))invalid();if(m.phase==='PENDING'||m.review_required)c.pendingOutbox++;}
    for(const [prefix,kind] of [['a1:binding:','A1_BINDING'],['a1:aggregate:','A1_AGGREGATE']])if(m.key.startsWith(prefix)&&m.record_kind!==kind)invalid();
    if(m.record_kind==='A1_BINDING'){if(!['NONE','RELEASE_VERIFIED','GONE_NATIVE'].includes(m.resolution)||typeof m.cleanup_pending!=='boolean')invalid();if(m.resolution==='NONE'||m.cleanup_pending)c.unresolvedBindings++;}
    if(m.record_kind==='CLEANUP_LEASE'){if(typeof m.phase!=='string')invalid();if(m.phase!=='COMPLETED')c.pendingLeases++;}
    if(m.record_kind==='A1_AGGREGATE'){if(typeof m.session_status!=='string'||typeof m.cleanup_pending!=='boolean')invalid();if(!terminal.has(m.session_status)||m.cleanup_pending)c.transitions++;}
    if(m.record_kind==='A1_OPERATION'){if(!['ISSUED','IN_FLIGHT','COMPLETED','RESULT_EVICTED','IN_DOUBT'].includes(m.phase))invalid();if(['ISSUED','IN_FLIGHT','IN_DOUBT'].includes(m.phase))c.transitions++;}
    if(m.key==='a1:owner-fence'){
     if(typeof m.transitioning!=='boolean'||typeof m.owner_context!=='string'||!uuid(m.epoch))invalid();
     if(name==='focurve-member-a1:'+auth.scope&&m.owner_context!=='MEMBER:'+auth.owner_user_id)issues.add('OWNER_FENCE_IDENTITY_MISMATCH');
     if(m.transitioning){if(guestHandoff(name,data,m))guestMemberHandoffGuards++;else c.transitions++;}
    }
    if(m.key.startsWith('member:first-failure:')){const sid=m.key.slice('member:first-failure:'.length);if(projectStoredFirstFailure(data,sid,m.owner_key,m.executor_id).status==='INVALID')invalid();}
     if(m.key==='member:start-intent'){if(typeof m.completed!=='boolean')invalid();if(!m.completed)c.transitions++;}
    if(m.key==='member:root-authority'){if(!['ACTIVE','RELEASED'].includes(m.phase))invalid();if(m.phase!=='RELEASED')c.rootClaims++;}
    if(m.key.startsWith('member:outbox:')){if(typeof m.acked!=='boolean')invalid();if(!m.acked)c.pendingOutbox++;}
    if(m.key.startsWith('import:lease:')||m.key.startsWith('import:settings:')){if(typeof m.phase!=='string')invalid();if(!['SUCCEEDED','SKIPPED_CONFLICT'].includes(m.phase))c.pendingImports++;}
    if(m.key.startsWith('access_pending:'))c.pendingOutbox++;
   }
   for(const o of data.outbox??[]){if(typeof o.acked!=='boolean'&&typeof o.status!=='string')invalid();if(o.acked!==true&&!['ACKED','REJECTED'].includes(o.status))c.pendingOutbox++;}
   if(name.includes('events'))for(const e of data.events??[]){if(typeof e.status!=='string')invalid();if(!['ACKED','REJECTED'].includes(e.status))c.pendingOutbox++;if(e.status==='REJECTED')issues.add('DELIVERY_REJECTED');}
   // Retained originals/markers need full receipt correlation before they can be cleared.
   // Conservative positive counts do not authorize ACK or cleanup.
   c.pendingOutbox+=(data.originals??[]).filter(o=>!(name===own&&!o.review_required&&o.owner_key==='MEMBER:'+auth.owner_user_id&&o.executor_id===auth.executor_id&&o.base_url===auth.server_url&&receipts.some(a=>a.owner_key===o.owner_key&&a.executor_id===o.executor_id&&a.event_id===o.event_id&&a.body===o.body&&a.status==='ACKED'))).length;
   c.pendingOutbox+=(data.pending??[]).filter(p=>p.phase!=='COMPLETED'&&!(name===own&&passive(p))).length;
   for(const r of data.reports??[]){if(r.acked!==true&&!['ACKED','REJECTED'].includes(r.status))c.pendingOutbox++;}
  }
  c.sessionRules=rules.session.length;c.dynamicRules=rules.dynamic.length;
  return {counts:c,issues:[...issues].sort(),observations:{guestMemberHandoffGuards}};
 }
 // Observation only. A missing frame is never a fabricated TAB_REMOVED event,
 // Content RELEASE receipt, or authority to resolve a binding.
 async function observeStoredDocument(scope,ch,read=op=>op()){
  const result={tabId:Number.isInteger(scope?.tab_id)?scope.tab_id:null,frameId:scope?.frame_id===0?0:null,documentId:typeof scope?.document_id==='string'&&scope.document_id.length<=128?scope.document_id:null,classification:'UNCONFIRMED',disappearanceProven:false,nativeIdentityVerified:false,mutationAllowed:false};
  if(result.tabId===null||result.tabId<0||result.frameId!==0||!result.documentId){result.reason='STORED_DOCUMENT_SCOPE_INVALID';return result;}
  let api='WEB_NAVIGATION_GET_ALL_FRAMES';
  try{
   if(typeof ch.webNavigation?.getAllFrames!=='function'||typeof ch.webNavigation?.getFrame!=='function'){result.reason='NATIVE_READ_API_UNAVAILABLE';return result;}
   const frames=await read(()=>ch.webNavigation.getAllFrames({tabId:result.tabId}));
   if(frames!==null&&!Array.isArray(frames)){result.reason='NATIVE_RESPONSE_INVALID';return result;}
   api='WEB_NAVIGATION_GET_FRAME';const original=await read(()=>ch.webNavigation.getFrame({documentId:result.documentId}));
   if(original!==null&&(typeof original!=='object'||Array.isArray(original))){result.reason='NATIVE_RESPONSE_INVALID';return result;}
   const root=frames?.find(f=>f.frameId===0&&f.documentId===result.documentId);
   if(original&&original.documentId!==result.documentId){result.reason='DOCUMENT_ID_MISMATCH';return result;}
   if(root?.documentLifecycle==='active'&&original?.documentLifecycle==='active'&&!root.errorOccurred&&!original.errorOccurred){result.classification='ACTIVE_MATCH';result.reason='BOTH_READS_MATCH_ACTIVE_DOCUMENT';}
   else if(original&&['cached','prerender','pending_deletion'].includes(original.documentLifecycle)){result.classification='INACTIVE_MATCH';result.lifecycle=original.documentLifecycle;result.reason='ORIGINAL_DOCUMENT_NOT_ACTIVE';}
   else if(original===null&&!root){result.classification='NOT_RETURNED';result.reason='ORIGINAL_DOCUMENT_NOT_RETURNED_NOT_RETIREMENT_PROOF';}
   else result.reason='NATIVE_READS_NOT_CONFIRMED';
   return result;
  }catch(error){result.classification='QUERY_ERROR';result.failureStage=api;result.errorName=['Error','TypeError','SecurityError','NotAllowedError','InvalidStateError'].includes(error?.name)?error.name:'UNCLASSIFIED';return result;}
 }
 function create(env){
  let busy=false,cancelActive=null;
  async function observe(auditOptions=null){
   if(busy)return {contract:'R3_LOCAL_SAFETY_2',gate:'UNKNOWN',issues:['OBSERVATION_ACTIVE']};busy=true;
   const started=Date.now(),budget=Math.min(15000,env.timeoutMs??15000),handles=new Set(),transactions=new Set();let stopped=false,pending=0,timer,stage='CONTEXT';
   const audit=auditOptions!==null,diagnosticAudit=auditOptions?.action==='FIRST_FAILURE',stateAudit=auditOptions?.action==='STATE'||diagnosticAudit,keys=audit?['focurve_member_auth','d06-a0-core','focurve_user_ui_hold']:['focurve_member_auth','d06-a0-core'];
   const safe={contract:diagnosticAudit?'R4_FIRST_FAILURE_AUDIT_1':stateAudit?'R4_STATE_LEDGER_AUDIT_1':audit?'R4_START_LEDGER_AUDIT_1':'R3_LOCAL_SAFETY_2',gate:'UNKNOWN',issues:[],counts:null,identity:{document:false,deployment:false,installation:false,profile:false},coverage:null};
   function check(){if(stopped||Date.now()-started>=budget)throw Error('OBSERVATION_TIMEOUT');}
   function native(op){check();pending++;return Promise.resolve().then(()=>{check();return op();}).finally(()=>pending--);}
   function close(){stopped=true;for(const tx of transactions)try{tx.abort();}catch{}for(const db of handles)db.close();handles.clear();}
   cancelActive=close;
   const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{close();reject(Error('OBSERVATION_TIMEOUT'));},budget);});
   async function existing(info){
    check();const expected=schema(info.name);if(!expected||info.version!==1)throw Error('DATABASE_SCHEMA_UNKNOWN');
    const db=await new Promise((resolve,reject)=>{
     pending++;const q=env.indexedDB.open(info.name);let finished=false,settled=false;
     const settle=()=>{if(!settled){settled=true;pending--;}};
     const finish=(error,db)=>{if(finished)return;finished=true;error?reject(Error(error)):resolve(db);};
     q.onupgradeneeded=()=>{q.transaction.abort();finish('DATABASE_SCHEMA_MISSING');};
     q.onerror=()=>{settle();finish('DATABASE_READ_FAILED');};q.onblocked=()=>finish('DATABASE_BLOCKED');
     q.onsuccess=()=>{settle();if(finished||stopped){q.result.close();if(!finished)finish('OBSERVATION_TIMEOUT');return;}handles.add(q.result);finish(null,q.result);};
    });
    try{
     check();db.onversionchange=()=>{db.close();stopped=true;};
     if(db.version!==1||canonical([...db.objectStoreNames].sort())!==canonical(Object.keys(expected).sort()))throw Error('DATABASE_SCHEMA_MISSING');
     return await new Promise((resolve,reject)=>{
      const names=Object.keys(expected),tx=db.transaction(names,'readonly'),data={};transactions.add(tx);let bad=false;
      tx.oncomplete=()=>{transactions.delete(tx);bad?reject(Error('DATABASE_SCHEMA_UNKNOWN')):resolve(data);};
      tx.onabort=tx.onerror=()=>{transactions.delete(tx);reject(Error('DATABASE_READ_FAILED'));};
      for(const n of names){const store=tx.objectStore(n);if(canonical(store.keyPath)!==canonical(expected[n]))bad=true;const q=store.getAll(undefined,10001);q.onsuccess=()=>{data[n]=q.result;if(q.result.length>10000)bad=true;};}
     });
    }finally{db.close();handles.delete(db);}
   }
   async function snapshot(){
    const inventory=(await native(()=>env.indexedDB.databases())).sort((a,b)=>a.name.localeCompare(b.name));
    if(inventory.length>64)throw Error('DATABASE_LIMIT');
    const rows=[];for(const info of inventory){check();rows.push({name:info.name,data:await existing(info)});}
    const session=await native(()=>env.chrome.declarativeNetRequest.getSessionRules()),dynamic=await native(()=>env.chrome.declarativeNetRequest.getDynamicRules());
    if(!Array.isArray(session)||!Array.isArray(dynamic))throw Error('DNR_READ_FAILED');
    return {inventory,rows,rules:{session,dynamic}};
   }
   const work=(async()=>{
    const ch=env.chrome,d=env.deployment,u=new URL(env.location.href),tab=await native(()=>ch.tabs.getCurrent());
    safe.identity.document=u.protocol==='chrome-extension:'&&u.host===ch.runtime.id&&u.pathname===(!audit&&env.productLifecycle===true?'/native-link/index.html':'/safety/index.html')&&!u.search&&!u.hash&&tab?.url===u.href&&!tab.incognito;
    const origin=new URL(d?.origin);safe.identity.deployment=d?.contract==='STANDALONE_API_1'&&origin.protocol==='https:'&&origin.hostname==='localhost'&&!!origin.port&&origin.origin===d.origin&&d.api===d.origin+'/api/v1';
    safe.identity.profile=env.context?.contract==='R2_DEDICATED_PROFILE_1'&&env.context.extensionId===ch.runtime.id&&/^[a-f0-9]{32}$/.test(env.context.profileInstance??'')&&env.context.origin===d.origin;
    if(!safe.identity.document||!safe.identity.deployment||!safe.identity.profile)throw Error('CONTEXT_IDENTITY_MISMATCH');
    stage='AUTH_READ';const storage=await native(()=>ch.storage.local.get(keys));
    const auth=storage.focurve_member_auth;
    if(audit&&!diagnosticAudit){
     const marker=storage.focurve_user_ui_hold;
     if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(auditOptions.requestId??'')||marker?.requestId!==auditOptions.requestId||marker.action!==(stateAudit?'STATE':'START')||marker.unconfirmed!==true)throw Error(stateAudit?'PENDING_STATE_IDENTITY_UNCONFIRMED':'PENDING_START_IDENTITY_UNCONFIRMED');
    }
    if(storage['d06-a0-core']&&(!Array.isArray(storage['d06-a0-core'].records)||storage['d06-a0-core'].records.length))throw Error('DATABASE_SCHEMA_UNKNOWN');
    // recovery_pending is a derived publicState field, absent from MemberAuth
    // storage. Only this negative STATE audit accepts its absence; explicit
    // true/malformed values and LINK_PENDING still grant no stored-owner lane.
    const storedStateOwner=stateAudit&&auth&&['LINKED','AUTH_RECOVERY_REQUIRED'].includes(auth.phase)&&(!Object.hasOwn(auth,'recovery_pending')||auth.recovery_pending===false)&&(auth.error===null||['AUTH_RESPONSE_UNCONFIRMED','RESPONSE_UNCONFIRMED'].includes(auth.error));
    if(!auth||(!storedStateOwner&&(auth.phase!=='LINKED'||auth.error!==null))||auth.recovery_pending===true||typeof auth.access_token!=='string'||!auth.access_token||typeof auth.refresh_token!=='string'||!auth.refresh_token||typeof auth.installation_proof!=='string'||!auth.installation_proof||!Number.isFinite(auth.access_expires_at)||!audit&&auth.access_expires_at<=Date.now()+60000||auth.server_url!==d.api||auth.web_origin!==d.origin||!/^\d+$/.test(String(auth.owner_user_id))||Number(auth.owner_user_id)<=0) {
     // Failure classification only. Original admission predicate above remains
     // unchanged; no token/proof values, reads of ledgers or recovery occur.
     const phases=['UNREGISTERED','REGISTERED','LINK_PENDING','LINKED','AUTH_RECOVERY_REQUIRED','REFRESHING'];
     const errors=['AUTH_RESPONSE_UNCONFIRMED','RESPONSE_UNCONFIRMED','AUTH_REFRESH_UNCONFIRMED','MEMBER_AUTH_REQUIRED'];
     const rejects=[];
     if(!auth)rejects.push('AUTH_ROW_MISSING');
     if(auth&&!storedStateOwner&&(auth.phase!=='LINKED'||auth.error!==null))rejects.push('AUTH_STATE_NOT_ALLOWED');
     if(auth?.recovery_pending===true)rejects.push('RECOVERY_PENDING');
     for(const [field,code] of [['access_token','ACCESS_TOKEN_MISSING'],['refresh_token','REFRESH_TOKEN_MISSING'],['installation_proof','INSTALLATION_PROOF_MISSING']])if(typeof auth?.[field]!=='string'||!auth[field])rejects.push(code);
     if(!Number.isFinite(auth?.access_expires_at))rejects.push('ACCESS_EXPIRY_INVALID');
     else if(!audit&&auth.access_expires_at<=Date.now()+60000)rejects.push('ACCESS_EXPIRED_FOR_ORDINARY_QUERY');
     if(auth?.server_url!==d.api)rejects.push('API_ORIGIN_MISMATCH');
     if(auth?.web_origin!==d.origin)rejects.push('WEB_ORIGIN_MISMATCH');
     if(!/^\d+$/.test(String(auth?.owner_user_id))||Number(auth?.owner_user_id)<=0)rejects.push('MEMBER_OWNER_INVALID');
     safe.authState={phase:phases.includes(auth?.phase)?auth.phase:'UNRECOGNIZED',errorCode:auth?.error===null?null:errors.includes(auth?.error)?auth.error:'OTHER_ERROR_PRESENT',authenticationVerified:false,rejectionConditions:rejects};
     throw Error('AUTH_IDENTITY_UNCONFIRMED');
    }
    const key={owner_key:'MEMBER:'+auth.owner_user_id,executor_id:auth.executor_id,authority:auth.server_url};
    const digest=Array.from(new Uint8Array(await env.crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(key)))),x=>x.toString(16).padStart(2,'0')).join('');check();
    stage='SNAPSHOT_READ';const first=await snapshot(),second=await snapshot();
    const currentStorage=await native(()=>ch.storage.local.get(keys));
    const current=currentStorage.focurve_member_auth;
    check();
    stage='SNAPSHOT_COMPARE';if(observationCanonical(storage)!==observationCanonical(currentStorage)||observationCanonical(first)!==observationCanonical(second))throw Error('OBSERVATION_CHANGED');
    stage='SCHEMA_AND_IDENTITY';const required=['focurve-local','focurve-execution','focurve-member-a1-root-authority','focurve-member-a1:'+digest,'focurve-a0-registry'];
    if(!required.every(name=>second.rows.some(r=>r.name===name)))throw Error('REQUIRED_DATABASE_MISSING');
    const local=second.rows.find(r=>r.name==='focurve-local').data.metadata,install=local.find(r=>r.key==='installation_id')?.value;
    safe.identity.installation=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(install??'')&&install===auth.executor_id;
    if(!safe.identity.installation)throw Error('INSTALLATION_IDENTITY_MISMATCH');
    stage='OBLIGATION_PROJECTION';const result=project(second.rows,second.rules,{...auth,scope:digest},stateAudit?'REAUTH_ONLY':undefined);safe.counts=result.counts;safe.issues=result.issues;safe.observations=result.observations;
    safe.coverage={requiredDatabases:5,observedDatabases:second.rows.length,schemaVersion:1,doubleReadStable:true,atomicAcrossDatabases:false};
    const memberData=second.rows.find(r=>r.name==='focurve-member-a1:'+digest).data,storedCurrent=memberData.metadata.find(x=>x.key==='current');
    safe.firstFailure=projectStoredFirstFailure(memberData,storedCurrent?.session_id,'MEMBER:'+auth.owner_user_id,auth.executor_id);
    if(diagnosticAudit){
     if(!storedCurrent||storedCurrent.owner_key!=='MEMBER:'+auth.owner_user_id||!memberData.sessions.some(s=>s.session_id===storedCurrent.session_id&&s.owner_key===storedCurrent.owner_key&&s.executor_id===auth.executor_id&&s.member_admission?.authority===d.api))throw Error('STATE_AUDIT_IDENTITY_UNCONFIRMED');
     safe.auditOnly=true;safe.issues=[...new Set([...safe.issues,'AUDIT_ONLY_NOT_END_OR_START_AUTHORIZATION'])];return;
    }
    if(stateAudit){
     stage='STATE_AUDIT_BINDING';
     const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(x);
     const member=second.rows.find(r=>r.name==='focurve-member-a1:'+digest),md=member.data.metadata;
     const current=md.find(x=>x.key==='current'),a=md.find(x=>x.key==='a1:aggregate:'+current?.session_id);
     const owner='MEMBER:'+auth.owner_user_id,session=member.data.sessions.find(x=>x.session_id===current?.session_id&&x.owner_key===owner),journal=member.data.journal.find(x=>x.session_id===current?.session_id&&x.owner_key===owner);
     const fence=md.find(x=>x.key==='a1:owner-fence'),claim=second.rows.find(r=>r.name==='focurve-member-a1-root-authority').data.metadata.find(x=>x.key==='member:root-authority');
     if(!current||current.owner_key!==owner||!uuid(current.session_id)||!a||a.record_kind!=='A1_AGGREGATE'||a.session_id!==current.session_id||a.owner_context!==owner||a.executor_id!==auth.executor_id||!session||session.executor_id!==auth.executor_id||session.status!==a.session_status||!journal||journal.revision!==a.desired_revision||journal.revision!==a.local_links?.journal_revision||journal.action_seq!==a.local_links?.journal_action_seq||session.member_admission?.authority!==d.api||session.member_admission?.session_id!==a.session_id||session.member_admission?.executor_id!==auth.executor_id||!uuid(a.snapshot_ref?.policy_snapshot_id)||fence?.owner_context!==owner||fence.transitioning!==false||!uuid(fence.epoch))throw Error('STATE_AUDIT_IDENTITY_UNCONFIRMED');
     if(!['STARTING','RUNNING','UNKNOWN','ENDING','ENDED','START_FAILED','INTERRUPTED','NATIVE_VERIFYING','EFFECT_VERIFYING'].includes(a.session_status)||!Number.isSafeInteger(a.desired_revision)||a.desired_revision<1||!Number.isSafeInteger(journal.action_seq)||journal.action_seq<1||!['APPLIED','RELEASED'].includes(journal.desired)||!['APPLIED','RELEASED','UNKNOWN','PENDING','UNCONFIRMED'].includes(journal.observed))throw Error('STATE_AUDIT_IDENTITY_UNCONFIRMED');
     const snapshot=session.snapshot;
     if(!snapshot||snapshot.policy_snapshot_id!==a.snapshot_ref.policy_snapshot_id||snapshot.owner_user_id!==String(auth.owner_user_id)||snapshot.executor_id!==auth.executor_id||snapshot.format_version!==a.snapshot_ref.snapshot_format||snapshot.source_version!==a.snapshot_ref.source_version)throw Error('STATE_AUDIT_IDENTITY_UNCONFIRMED');
     const snapshotHash=Array.from(new Uint8Array(await env.crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(snapshot)))),x=>x.toString(16).padStart(2,'0')).join('');check();
     if(snapshotHash!==a.snapshot_ref.snapshot_sha256)throw Error('STATE_AUDIT_IDENTITY_UNCONFIRMED');
     if(!claim||claim.owner_key!==owner||claim.executor_id!==auth.executor_id||claim.authority!==d.api||claim.session_id!==a.session_id||!['ACTIVE','RELEASED'].includes(claim.phase))throw Error('STATE_AUDIT_ROOT_UNCONFIRMED');
     const bindings=md.filter(x=>x.record_kind==='A1_BINDING'&&x.scope?.session_id===a.session_id);
     if(bindings.some(b=>b.scope.owner_context!==owner||b.scope.executor_id!==auth.executor_id||!uuid(b.scope.binding_id)||!Array.isArray(b.ledger)||!['NONE','RELEASE_VERIFIED','GONE_NATIVE'].includes(b.resolution)||!['ACTIVE','GONE','UNCONFIRMED'].includes(b.native_lifecycle)||typeof b.cleanup_pending!=='boolean'||typeof b.apply_closed!=='boolean'))throw Error('STATE_AUDIT_IDENTITY_UNCONFIRMED');
     if(!Array.isArray(journal.rules)||journal.rules.some(x=>!Number.isSafeInteger(x.id)||x.id<=0)||new Set(journal.rules.map(x=>x.id)).size!==journal.rules.length)throw Error('STATE_AUDIT_DNR_UNCONFIRMED');
     const actual=second.rules.session,expected=journal.rules;
     const exact=actual.filter(x=>expected.some(y=>x.id===y.id&&observationCanonical(x)===observationCanonical(y))).map(x=>x.id);
     const missing=expected.filter(x=>!actual.some(y=>y.id===x.id)).map(x=>x.id),foreign=actual.filter(x=>!exact.includes(x.id)).map(x=>x.id);
     const dynamic=second.rules.dynamic.map(x=>x.id);
     if([...actual.map(x=>x.id),...dynamic].some(x=>!Number.isSafeInteger(x)||x<=0))throw Error('STATE_AUDIT_DNR_UNCONFIRMED');
     safe.auditOnly=true;safe.requestId=auditOptions.requestId;
     safe.unconfirmedOperation={action:'STATE',classification:'QUERY_REQUEST',unconfirmed:true,requestId:auditOptions.requestId};
     safe.authentication={phase:auth.phase,accessExpiry:auth.access_expires_at<=Date.now()?'EXPIRED':'CURRENT',authenticationVerified:false};
     safe.session={sessionId:a.session_id,ownerContext:owner,executorId:a.executor_id,status:a.session_status,desiredRevision:a.desired_revision,policySnapshotId:a.snapshot_ref.policy_snapshot_id,storedIdentityMatches:true};
     safe.rootAuthority={phase:claim.phase,sameStoredSession:true,nativeIdentityVerified:false};
     safe.journal={desired:journal.desired,observed:journal.observed,revision:journal.revision};
     safe.bindings=bindings.map(b=>({bindingId:b.scope.binding_id,resolution:b.resolution,cleanupPending:b.cleanup_pending,applyClosed:b.apply_closed,nativeLifecycle:b.native_lifecycle,ledgerEntries:b.ledger.length,releaseEvidencePresent:!!b.release_evidence}));
     // Only the stored ENDING obligation, after the existing ownership checks.
     // No Worker message, refresh, DOM execution or storage/DNR write is used.
     if(a.session_status==='ENDING'){
      safe.nativeDocuments=[];
      for(const b of bindings.filter(b=>b.resolution==='NONE').slice(0,8))safe.nativeDocuments.push({bindingId:b.scope.binding_id,...await observeStoredDocument(b.scope,ch,native)});
     }
     safe.leases=md.filter(x=>x.record_kind==='CLEANUP_LEASE'&&x.session_id===a.session_id).map(x=>({phase:['OPEN','ISSUED','COMPLETED','EXPIRED'].includes(x.phase)?x.phase:'OTHER',bindingId:uuid(x.binding_id)?x.binding_id:null}));
     const outbox=md.filter(x=>x.key?.startsWith('member:outbox:')&&x.body?.session_id===a.session_id);
     safe.outbox={ownership:'COUNTS_ONLY_NOT_RELEASE_PROOF',memberReportRows:outbox.length,unacknowledgedMemberReports:outbox.filter(x=>x.acked!==true).length};
     const intent=md.find(x=>x.key==='member:start-intent');safe.startIntent={present:!!intent,completed:typeof intent?.completed==='boolean'?intent.completed:null,sessionId:uuid(intent?.session_id)?intent.session_id:null,correlation:'NOT_A_START_REQUEST_NO_RETROACTIVE_ATTRIBUTION'};
     safe.dnr={nativeIdentityVerified:false,sessionRuleIds:actual.map(x=>x.id),dynamicRuleIds:dynamic,expectedJournalRuleIds:expected.map(x=>x.id),exactOwnedRuleIds:exact,missingRuleIds:missing,unownedOrChangedRuleIds:foreign,ownership:foreign.length||dynamic.length?'UNCONFIRMED_RULES_PRESENT':missing.length?'JOURNAL_RULES_MISSING':actual.length?'EXACT_SESSION_JOURNAL_MATCH':'NO_RULES_PRESENT'};
     safe.issues=[...new Set([...safe.issues,'USER_OPERATION_UNCONFIRMED','AUDIT_ONLY_NOT_END_OR_START_AUTHORIZATION'])];
     return;
    }
    if(audit){
     const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(x),member=second.rows.find(r=>r.name==='focurve-member-a1:'+digest);
     const intent=member.data.metadata.find(x=>x.key==='member:start-intent');
     safe.auditOnly=true;safe.requestId=auditOptions.requestId;
     safe.authentication={phase:'LINKED',accessExpiry:auth.access_expires_at<=Date.now()?'EXPIRED':'CURRENT',authenticationVerified:false};
     safe.startIntent=intent?{present:true,id:uuid(intent.id)?intent.id:null,uiRequestId:uuid(intent.ui_request_id)?intent.ui_request_id:null,completed:typeof intent.completed==='boolean'?intent.completed:null,sessionId:uuid(intent.session_id)?intent.session_id:null,correlation:intent.ui_request_id===auditOptions.requestId?'MATCH':intent.ui_request_id?'OTHER_REQUEST':'LEGACY_ID_NOT_LINKED'}:{present:false,correlation:'NO_INTENT'};
     safe.ledgerRows=Object.fromEntries(['sessions','journal','outbox'].map(name=>[name,second.rows.reduce((sum,r)=>sum+(r.data[name]?.length??0),0)]));
     safe.dnr={sessionRuleIds:second.rules.session.map(r=>r.id),dynamicRuleIds:second.rules.dynamic.map(r=>r.id),ownership:second.rules.session.length+second.rules.dynamic.length===0?'NO_RULES_PRESENT':'NOT_ESTABLISHED_BY_COUNTS'};
     if([...safe.dnr.sessionRuleIds,...safe.dnr.dynamicRuleIds].some(id=>!Number.isSafeInteger(id)||id<=0))throw Error('DNR_READ_FAILED');
     safe.issues=[...new Set([...safe.issues,'USER_OPERATION_UNCONFIRMED','AUDIT_ONLY_NOT_START_AUTHORIZATION'])];
     // Expired credentials may identify a read-only stored owner, never grant
     // authentication, CLEAR, ACK, recovery or permission to start a session.
     return;
    }
    safe.gate=result.issues.length?'UNKNOWN':Object.values(result.counts).some(x=>x>0)?'BLOCKED':'CLEAR_LOCAL_ONLY';
   })();
   try{await Promise.race([work,timeout]);}catch(e){safe.gate='UNKNOWN';safe.counts=null;safe.failureStage=stage;safe.issues=[['PENDING_START_IDENTITY_UNCONFIRMED','PENDING_STATE_IDENTITY_UNCONFIRMED','STATE_AUDIT_IDENTITY_UNCONFIRMED','STATE_AUDIT_ROOT_UNCONFIRMED','STATE_AUDIT_DNR_UNCONFIRMED','OBSERVATION_TIMEOUT','DATABASE_SCHEMA_UNKNOWN','DATABASE_SCHEMA_MISSING','DATABASE_BLOCKED','DATABASE_READ_FAILED','DATABASE_LIMIT','DNR_READ_FAILED','CONTEXT_IDENTITY_MISMATCH','AUTH_IDENTITY_UNCONFIRMED','REQUIRED_DATABASE_MISSING','INSTALLATION_IDENTITY_MISMATCH','OBSERVATION_CHANGED','OBSERVATION_VALUE_UNSUPPORTED'].includes(e.message)?e.message:'READ_UNAVAILABLE'];}
   finally{clearTimeout(timer);close();work.catch(()=>{});cancelActive=null;busy=false;}
   safe.resources={openConnections:handles.size,activeReadTransactions:transactions.size,pendingNativeCalls:pending};
   if(pending||transactions.size){safe.gate='UNKNOWN';safe.issues.push('OBSERVATION_SETTLEMENT_UNCONFIRMED');}
   safe.elapsedMs=Date.now()-started;safe.observedAtUTC=new Date().toISOString();return safe;
  }
  return Object.freeze({observe:()=>observe(),auditPendingStart:requestId=>observe({requestId}),auditPendingState:requestId=>observe({requestId,action:'STATE'}),auditFirstFailure:()=>observe({action:'FIRST_FAILURE'}),cancel:()=>cancelActive?.()});
 }
 root.R2LocalSafety=Object.freeze({create,project,projectRecovery:(rows,rules,auth)=>project(rows,rules,auth,'REAUTH_ONLY'),schema,canonical,observationCanonical,observeStoredDocument,projectStoredFirstFailure});
 if(typeof module!=='undefined')module.exports=root.R2LocalSafety;
})(globalThis);
