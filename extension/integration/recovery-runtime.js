importScripts(chrome.runtime.getURL('safety/reader.js'));
// Scoped product reauthentication. No credential return, refresh replay, START or SYNC.
(()=>{
 const counts=FocurveSameOwnerRecovery.obligationFields;
 const terminal=new Set(['ENDED','START_FAILED','INTERRUPTED']);
 async function existing(info,deadline){
  if(Date.now()>=deadline)throw Error('RECOVERY_STORAGE_UNCONFIRMED');
  const db=await new Promise((resolve,reject)=>{let abandoned=false;const q=indexedDB.open(info.name,info.version),timer=setTimeout(()=>{abandoned=true;reject(Error('RECOVERY_STORAGE_UNCONFIRMED'));},Math.max(1,Math.min(2000,deadline-Date.now())));q.onupgradeneeded=()=>q.transaction.abort();q.onerror=()=>{clearTimeout(timer);reject(Error('RECOVERY_STORAGE_UNCONFIRMED'));};q.onblocked=()=>{abandoned=true;clearTimeout(timer);reject(Error('RECOVERY_STORAGE_UNCONFIRMED'));};q.onsuccess=()=>{clearTimeout(timer);if(abandoned){q.result.close();return;}resolve(q.result);};});
  try{return await new Promise((resolve,reject)=>{
   const names=[...db.objectStoreNames],expected=R2LocalSafety.schema(info.name);if(!expected||info.version!==1||R2LocalSafety.canonical(names.sort())!==R2LocalSafety.canonical(Object.keys(expected).sort())||((info.name==='focurve-execution'||info.name.startsWith('focurve-member-a1:'))&&!['metadata','sessions','journal'].every(n=>names.includes(n)))||(info.name==='focurve-member-a1-root-authority'&&!names.includes('metadata')))return reject(Error('RECOVERY_STORAGE_UNCONFIRMED'));
   const tx=db.transaction(names,'readonly'),data={};let overflow=false;
   const timer=setTimeout(()=>{try{tx.abort();}catch{}reject(Error('RECOVERY_STORAGE_UNCONFIRMED'));},Math.max(1,deadline-Date.now()));
   tx.oncomplete=()=>{clearTimeout(timer);overflow?reject(Error('RECOVERY_STORAGE_UNCONFIRMED')):resolve(data);};
   tx.onabort=tx.onerror=()=>{clearTimeout(timer);reject(Error('RECOVERY_STORAGE_UNCONFIRMED'));};
   for(const n of names){const store=tx.objectStore(n);if(R2LocalSafety.canonical(store.keyPath)!==R2LocalSafety.canonical(expected[n]))overflow=true;const q=store.getAll(undefined,10001);q.onsuccess=()=>{data[n]=q.result;if(q.result.length>10000)overflow=true;};}
  });}finally{db.close();}
 }
 async function snapshot(deadline){
  if(Date.now()>=deadline)throw Error('RECOVERY_STORAGE_UNCONFIRMED');
  const inventory=(await indexedDB.databases()).sort((a,b)=>a.name.localeCompare(b.name));
  if(!inventory.some(x=>x.name==='focurve-execution')||!inventory.some(x=>x.name==='focurve-member-a1-root-authority')||!inventory.some(x=>x.name.startsWith('focurve-member-a1:')))throw Error('RECOVERY_CORE_NOT_READY');
  if(inventory.length>64)throw Error('RECOVERY_STORAGE_UNCONFIRMED');const rows=[];for(const info of inventory)rows.push({name:info.name,data:await existing(info,deadline)});
  return {rows,sessionRules:await chrome.declarativeNetRequest.getSessionRules(),dynamicRules:await chrome.declarativeNetRequest.getDynamicRules()};
 }
 async function obligations(){
  const deadline=Date.now()+15000,raw=await __memberIntegration.auth.store.get(),authFingerprint=R2LocalSafety.observationCanonical(raw),first=await snapshot(deadline),second=await snapshot(deadline);
  if(R2LocalSafety.observationCanonical(first)!==R2LocalSafety.observationCanonical(second))throw Error('RECOVERY_STATE_CHANGED');
  // Credential values remain in memory only; any concurrent auth change invalidates this observation.
  let currentAuth;try{currentAuth=await __memberIntegration.auth.store.get();}catch{throw Error('RECOVERY_STORAGE_UNCONFIRMED');}
  if(authFingerprint!==R2LocalSafety.observationCanonical(currentAuth))throw Error('RECOVERY_STATE_CHANGED');
  const currentScope=await MemberA1Contract.digest({owner_key:'MEMBER:'+raw?.owner_user_id,executor_id:raw?.executor_id,authority:raw?.server_url});
  const installation=second.rows.find(r=>r.name==='focurve-local')?.data.metadata?.find(r=>r.key==='installation_id')?.value;
  if(installation!==raw?.executor_id||!second.rows.some(r=>r.name==='focurve-a0-registry')||!second.rows.some(r=>r.name==='focurve-member-a1:'+currentScope))throw Error('RECOVERY_IDENTITY_REQUIRED');
  for(const row of second.rows)for(const values of Object.values(row.data))for(const value of values)if(value.executor_id&&value.executor_id!==installation)throw Error('RECOVERY_IDENTITY_REQUIRED');
  const projected=R2LocalSafety.projectRecovery(second.rows,{session:second.sessionRules,dynamic:second.dynamicRules},{...raw,scope:currentScope});
  if(projected.issues.length||Object.values(projected.counts).some(v=>!Number.isSafeInteger(v)||v!==0))throw Error('RECOVERY_OBLIGATION_UNCONFIRMED');
  const passive=x=>{try{const v=JSON.parse(x.scope);return Object.keys(x).sort().join(',')==='entry_fingerprint,fingerprint,scope,tab_id'&&/^feature-marker:[0-9]+:(?:[a-f0-9]{32}|[a-f0-9-]{36})$/i.test(x.tab_id)&&/^[a-f0-9]{64}$/.test(x.fingerprint)&&/^[a-f0-9]{64}$/.test(x.entry_fingerprint)&&Array.isArray(v)&&v.length===6&&v[0]===raw.server_url&&v[1]==='MEMBER:'+raw.owner_user_id&&v[2]===raw.executor_id&&/^[a-f0-9-]{36}$/i.test(v[3])&&Number.isSafeInteger(v[4])&&v[4]>0&&/^[a-f0-9-]{36}$/i.test(v[5]);}catch{return false;}};
  const result={owner:'MEMBER:'+raw?.owner_user_id,executor:raw?.executor_id,memberRootPhase:'RELEASED',...Object.fromEntries(counts.map(k=>[k,0]))};
  for(const {name,data} of second.rows){
   const md=data.metadata??[],sessions=data.sessions??[],journals=data.journal??[];
   result.activeSessions+=sessions.filter(x=>!terminal.has(x.status)).length;
   result.unknownAggregates+=md.filter(x=>x.record_kind==='A1_AGGREGATE'&&x.session_status==='UNKNOWN').length;
   result.cleanupPending+=md.filter(x=>x.record_kind==='A1_AGGREGATE'&&x.cleanup_pending).length;
   result.unresolvedBindings+=md.filter(x=>x.record_kind==='A1_BINDING'&&(x.resolution==='NONE'||x.cleanup_pending)).length;
   result.pendingLeases+=md.filter(x=>x.record_kind==='CLEANUP_LEASE'&&x.phase!=='COMPLETED').length;
   result.inFlightOrInDoubt+=md.filter(x=>x.record_kind==='A1_OPERATION'&&['IN_FLIGHT','IN_DOUBT'].includes(x.phase)).length;
   result.unreleasedJournals+=journals.filter(x=>x.desired!=='RELEASED'||x.observed!=='RELEASED').length;
   result.pendingOutbox+=md.filter(x=>x.key?.startsWith('member:outbox:')&&!x.acked).length;
   if(name.startsWith('member-a1-site-events:')||name.startsWith('integration-events:')||name.startsWith('focurve-member-events'))result.pendingOutbox+=(data.events??[]).filter(x=>!['ACKED','REJECTED'].includes(x.status)).length;
   const receipts=second.rows.find(x=>x.name==='member-a1-site-events:'+currentScope)?.data.events??[];
   result.pendingOutbox+=(data.originals??[]).filter(o=>!(name==='member-a1-site-access:'+currentScope&&!o.review_required&&o.owner_key==='MEMBER:'+raw.owner_user_id&&o.executor_id===raw.executor_id&&o.base_url===raw.server_url&&receipts.some(a=>a.owner_key===o.owner_key&&a.executor_id===o.executor_id&&a.event_id===o.event_id&&a.body===o.body&&['ACKED','REJECTED'].includes(a.status)))).length;
   result.pendingOutbox+=(data.pending??[]).filter(x=>x.phase!=='COMPLETED'&&!(name==='member-a1-site-access:'+currentScope&&passive(x))).length;
   result.pendingOutbox+=(data.outbox??[]).filter(x=>!x.acked&&!['ACKED','REJECTED'].includes(x.status)).length;
   result.pendingImportLeases+=md.filter(x=>x.key?.startsWith('import:lease:')&&!['SUCCEEDED','SKIPPED_CONFLICT'].includes(x.phase)).length;
   result.pendingImportSettings+=md.filter(x=>x.key?.startsWith('import:settings:')&&!['SUCCEEDED','SKIPPED_CONFLICT'].includes(x.phase)).length;
   const root=md.find(x=>x.key==='member:root-authority');if(root&&root.phase!=='RELEASED')result.memberRootPhase=root.phase??'UNKNOWN';
  }
  result.sessionRules=second.sessionRules.length;result.dynamicRules=second.dynamicRules.length;return result;
 }
 const auth=__memberIntegration.auth;
 async function authorization(){
  const raw=await auth.store.get();
  if(!raw||!['AUTH_RECOVERY_REQUIRED','LINK_PENDING'].includes(raw.phase)||!raw.owner_user_id||!raw.installation_proof)throw Error('RECOVERY_NOT_ADMISSIBLE');
  FocurveDeploymentBinding.assertInput(raw);
  const x=await auth.request(raw,'/install/auth-recovery',null,{'X-Installation-Id':raw.executor_id,'X-Installation-Proof':raw.installation_proof});
  const end=Date.parse(x.not_after);
  if(x.contract!=='FOCURVE_MEMBER_REAUTH_READY_1'||x.focus_allowed!==false||x.executor_id!==raw.executor_id||x.owner_user_id!==raw.owner_user_id||x.web_origin!==raw.web_origin||x.callback_uri!==auth.callbackUri||!/^[a-f0-9]{32}$/.test(x.operation_id??'')||!Number.isFinite(end)||end<=Date.now()||end>Date.now()+1200000)throw Error('RECOVERY_OWNER_MISMATCH');
  if(R2LocalSafety.observationCanonical(raw)!==R2LocalSafety.observationCanonical(await auth.store.get()))throw Error('RECOVERY_STATE_CHANGED');
  return x;
 }

 const actor=new FocurveSameOwnerRecovery.SameOwnerRecovery({auth,inspectObligations:obligations,isolated:true});
 let active=false;
 const run=operation=>{
  if(active)return Promise.reject(Error('RECOVERY_OPERATION_ACTIVE'));
  active=true;
  const adapter=globalThis.__memberA1;
  const job=__memberIntegration.serial(()=>adapter?adapter.serial(operation):Promise.reject(Error('RECOVERY_CORE_NOT_READY')));
  return job.finally(()=>{active=false;});
 };
 globalThis.MemberRecovery=Object.freeze({inspectorVersion:'ACK_SCOPED_MARKER_DOC32_1',generation:crypto.randomUUID(),
  begin:payload=>run(async()=>{await authorization();return actor.begin(payload.config,payload.approval_id);}),
  confirm:()=>run(async()=>{await authorization();const result=await actor.poll();if(result.phase==='LINKED'){const i=await __memberA1.identity();if(i.owner_key!=='MEMBER:'+result.owner_user_id||i.executor_id!==result.executor_id)throw Error('RECOVERY_OWNER_MISMATCH');}return result;}),
  // Counts only; caller never receives sessions, outbox content or credentials.
  status:async()=>{try{await authorization();await obligations();return {recovery_available:true};}catch{return {recovery_available:false};}},
  observe:obligations
 });
})();
