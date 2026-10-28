/* Fresh unlinked/guest installation observation. Read-only; no status/tick messages. */
(function(root){
 'use strict';
 // Diagnostic projection only. Never return a raw value or invoke MemberAuth.load/status.
 // Admission below remains authoritative and unchanged.
 function authClassification(auth,d){
  const phases=['UNREGISTERED','REGISTERED','REGISTERING','REGISTRATION_UNCONFIRMED','REQUESTING','REQUEST_UNCONFIRMED','LINK_PENDING','EXCHANGING','VERIFYING','REFRESHING','AUTH_RECOVERY_REQUIRED','LINKED'];
  const phase=!auth?'ABSENT':phases.includes(auth.phase)?auth.phase:'UNRECOGNIZED';
  const classification=phase==='ABSENT'?'ABSENT':phase==='LINKED'?'MEMBER':phase==='UNREGISTERED'?'GUEST_UNREGISTERED':phase==='REGISTERED'?'GUEST_REGISTERED':['REGISTRATION_UNCONFIRMED','REQUEST_UNCONFIRMED','AUTH_RECOVERY_REQUIRED'].includes(phase)?'UNCONFIRMED':phase==='UNRECOGNIZED'?'UNRECOGNIZED':'TRANSITION';
  const rejectionConditions=[];
  if(auth){
   if(!['UNREGISTERED','REGISTERED'].includes(auth.phase))rejectionConditions.push('PHASE_NOT_GUEST');
   if(auth.recovery_pending===true)rejectionConditions.push('RECOVERY_PENDING');
   if(auth.owner_user_id)rejectionConditions.push('MEMBER_OWNER_PRESENT');
   if(auth.access_token||auth.refresh_token)rejectionConditions.push('MEMBER_TOKEN_PRESENT');
   if(auth.error)rejectionConditions.push('ERROR_PRESENT');
   if(auth.phase==='UNREGISTERED'&&(auth.installation_proof||auth.executor_id))rejectionConditions.push('UNREGISTERED_INSTALLATION_PRESENT');
   if(auth.phase==='REGISTERED'){
    if(!/^[A-Za-z0-9_-]{32,256}$/.test(auth.installation_proof??''))rejectionConditions.push('REGISTERED_PROOF_INVALID');
    if(auth.server_url!==d.api||auth.web_origin!==d.origin)rejectionConditions.push('REGISTERED_DEPLOYMENT_MISMATCH');
   }
  }
  const errorCodes=['AUTH_RESPONSE_UNCONFIRMED','RESPONSE_UNCONFIRMED','LINK_EXPIRED','INVALID_GRANT','TOKEN_REUSE','AUTH_OWNER_MISMATCH','UNAUTHENTICATED','INVALID_TOKEN'];
  return {phase,classification,rejectionConditions,errorCode:!auth?.error?'NONE':errorCodes.includes(auth.error)?auth.error:'PRESENT_UNCLASSIFIED',accessExpiry:!Number.isFinite(auth?.access_expires_at)?'NOT_OBSERVED':auth.access_expires_at<=Date.now()?'EXPIRED':auth.access_expires_at<=Date.now()+60000?'REFRESH_WINDOW':'OUTSIDE_REFRESH_WINDOW'};
 }
 function create(env){
  let busy=false,cancel=()=>{};
  async function observe(){
   if(busy)return {gate:'UNKNOWN',issues:['OBSERVATION_ACTIVE']};busy=true;
   const begun=Date.now(),budget=Math.min(15000,env.timeoutMs??15000),handles=new Set(),txs=new Set();let stopped=false,timer,pending=0,stage='CONTEXT';
   const result={contract:'R4_GUEST_LOCAL_SAFETY_1',gate:'UNKNOWN',issues:[],counts:null,identity:{document:false,deployment:false,installation:false,profile:false},coverage:null};
   const check=()=>{if(stopped||Date.now()-begun>=budget)throw Error('OBSERVATION_TIMEOUT');};
   const close=()=>{stopped=true;for(const tx of txs)try{tx.abort();}catch{}for(const db of handles)db.close();handles.clear();};cancel=close;
   async function native(fn){check();pending++;try{return await fn();}finally{pending--;}}
   async function snapshot(){
    stage='SNAPSHOT_INVENTORY';
    const inventory=(await native(()=>env.indexedDB.databases())).sort((a,b)=>a.name.localeCompare(b.name));if(inventory.length>64)throw Error('DATABASE_LIMIT');
    const rows=[];
    for(const info of inventory){
     stage='DATABASE_SCHEMA';check();const schema=env.core.schema(info.name);if(!schema||info.version!==1)throw Error('DATABASE_SCHEMA_UNKNOWN');
     stage='DATABASE_READ';
     const db=await native(()=>new Promise((resolve,reject)=>{const q=env.indexedDB.open(info.name);q.onupgradeneeded=()=>{q.transaction.abort();reject(Error('DATABASE_SCHEMA_MISSING'));};q.onblocked=()=>reject(Error('DATABASE_BLOCKED'));q.onerror=()=>reject(Error('DATABASE_READ_FAILED'));q.onsuccess=()=>{if(stopped){q.result.close();reject(Error('OBSERVATION_TIMEOUT'));}else{handles.add(q.result);resolve(q.result);}};}));
     try{
      if(env.core.canonical([...db.objectStoreNames].sort())!==env.core.canonical(Object.keys(schema).sort()))throw Error('DATABASE_SCHEMA_MISSING');
      const data=await new Promise((resolve,reject)=>{const names=Object.keys(schema),tx=db.transaction(names,'readonly'),data={};txs.add(tx);let bad=false;
       tx.oncomplete=()=>{txs.delete(tx);bad?reject(Error('DATABASE_SCHEMA_UNKNOWN')):resolve(data);};tx.onerror=tx.onabort=()=>{txs.delete(tx);reject(Error('DATABASE_READ_FAILED'));};
       for(const name of names){const s=tx.objectStore(name);if(env.core.canonical(s.keyPath)!==env.core.canonical(schema[name]))bad=true;const q=s.getAll(undefined,10001);q.onsuccess=()=>{data[name]=q.result;if(q.result.length>10000)bad=true;};}
      });rows.push({name:info.name,data});
     }finally{db.close();handles.delete(db);}
    }
    stage='DNR_READ';return {rows,rules:{session:await native(()=>env.chrome.declarativeNetRequest.getSessionRules()),dynamic:await native(()=>env.chrome.declarativeNetRequest.getDynamicRules())}};
   }
   const work=(async()=>{
    const ch=env.chrome,u=new URL(env.location.href),tab=await native(()=>ch.tabs.getCurrent()),d=env.deployment,c=env.context;
    result.identity.document=u.href===ch.runtime.getURL(env.productLifecycle===true?'native-link/index.html':'safety/index.html')&&tab?.url===u.href&&!tab.incognito;
    const url=new URL(d.origin);result.identity.deployment=d.contract==='STANDALONE_API_1'&&url.protocol==='https:'&&url.hostname==='localhost'&&!!url.port&&url.origin===d.origin&&d.api===d.origin+'/api/v1';
    result.identity.profile=c?.contract==='R2_DEDICATED_PROFILE_1'&&c.extensionId===ch.runtime.id&&c.origin===d.origin&&/^[a-f0-9]{32}$/.test(c.profileInstance??'');
    if(!result.identity.document||!result.identity.deployment||!result.identity.profile)throw Error('CONTEXT_IDENTITY_MISMATCH');
    stage='AUTH_READ';const firstAuth=await native(()=>ch.storage.local.get(['focurve_member_auth','d06-a0-core']));
    const auth=firstAuth.focurve_member_auth;
    stage='AUTH_STATE';
    const authState=authClassification(auth,d);
    if(auth&&(!['UNREGISTERED','REGISTERED'].includes(auth.phase)||auth.recovery_pending===true||auth.owner_user_id||auth.access_token||auth.refresh_token||auth.error)){result.authState=authState;throw Error('AUTH_TRANSITION_OR_MEMBER_STATE');}
    if(auth?.phase==='UNREGISTERED'&&(auth.installation_proof||auth.executor_id)){result.authState=authState;throw Error('AUTH_TRANSITION_OR_MEMBER_STATE');}
    if(auth?.phase==='REGISTERED'&&(!/^[A-Za-z0-9_-]{32,256}$/.test(auth.installation_proof??'')||auth.server_url!==d.api||auth.web_origin!==d.origin)){result.authState=authState;throw Error('AUTH_TRANSITION_OR_MEMBER_STATE');}
    if(firstAuth['d06-a0-core']&&(!Array.isArray(firstAuth['d06-a0-core'].records)||firstAuth['d06-a0-core'].records.length))throw Error('DATABASE_SCHEMA_UNKNOWN');
    const first=await snapshot(),second=await snapshot();stage='AUTH_RECHECK';const lastAuth=await native(()=>ch.storage.local.get(['focurve_member_auth','d06-a0-core']));check();
    stage='SNAPSHOT_COMPARE';
    if(env.core.observationCanonical(first)!==env.core.observationCanonical(second)||env.core.observationCanonical(firstAuth)!==env.core.observationCanonical(lastAuth))throw Error('OBSERVATION_CHANGED');
    stage='SCHEMA_AND_IDENTITY';const required=['focurve-local','focurve-execution','focurve-a0-registry'];if(!required.every(n=>second.rows.some(r=>r.name===n)))throw Error('REQUIRED_DATABASE_MISSING');
    const install=second.rows.find(r=>r.name==='focurve-local').data.metadata.find(r=>r.key==='installation_id')?.value;
    result.identity.installation=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(install??'')&&(!auth||auth.phase!=='REGISTERED'||auth.executor_id===install);if(!result.identity.installation)throw Error('INSTALLATION_IDENTITY_MISMATCH');
    // Retained former-member rows are included in the debt projection, never
    // hidden or migrated. Foreign installation rows cannot establish clearance.
    for(const row of second.rows)for(const values of Object.values(row.data))for(const value of values)if(value.executor_id&&value.executor_id!==install)throw Error('INSTALLATION_IDENTITY_MISMATCH');
    stage='OBLIGATION_PROJECTION';const guest={phase:'UNREGISTERED',scope:'',owner_user_id:null,executor_id:install,server_url:d.api};
    // A disconnected member's ACKed originals remain retained evidence. Recover
    // only their observation context from a hash-bound, same-install namespace;
    // never change auth, acknowledge a row, or exclude actual outstanding debt.
    const groups=[];
    for(const row of second.rows){
     const match=/^focurve-member-a1:([a-f0-9]{64})$/.exec(row.name);if(!match)continue;
     const sessions=row.data.sessions??[],owners=[...new Set(sessions.map(s=>s.owner_key))];
     if(owners.length!==1||!/^MEMBER:[1-9][0-9]*$/.test(owners[0])||!sessions.length||sessions.some(s=>s.executor_id!==install))continue;
     const scope=match[1],owner=owners[0].slice(7),bytes=new TextEncoder().encode(env.core.canonical({owner_key:owners[0],executor_id:install,authority:d.api}));
     const digest=Array.from(new Uint8Array(await (env.crypto??root.crypto).subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');check();
     if(digest!==scope)continue;
     const names=new Set([row.name,'member-a1-site-access:'+scope,'member-a1-site-events:'+scope]);
     groups.push({names,auth:{...guest,scope,owner_user_id:owner}});
    }
    const grouped=new Set(groups.flatMap(g=>[...g.names]));
    const projection=env.core.project(second.rows.filter(r=>!grouped.has(r.name)),second.rules,guest);
    for(const group of groups){
     const part=env.core.project(second.rows.filter(r=>group.names.has(r.name)),{session:[],dynamic:[]},group.auth);
     for(const key of Object.keys(projection.counts))projection.counts[key]+=part.counts[key];
     projection.issues=[...new Set([...projection.issues,...part.issues])].sort();
    }
    result.counts=projection.counts;result.issues=projection.issues;result.coverage={requiredDatabases:3,observedDatabases:second.rows.length,schemaVersion:1,doubleReadStable:true,atomicAcrossDatabases:false};
    result.gate=result.issues.length?'UNKNOWN':Object.values(result.counts).some(v=>v!==0)?'BLOCKED':'CLEAR_LOCAL_ONLY';
   })();
   try{await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>{close();reject(Error('OBSERVATION_TIMEOUT'));},budget);})]);}
   catch(error){result.gate='UNKNOWN';result.counts=null;result.failureStage=stage;const allowed=['OBSERVATION_TIMEOUT','DATABASE_LIMIT','DATABASE_SCHEMA_UNKNOWN','DATABASE_SCHEMA_MISSING','DATABASE_BLOCKED','DATABASE_READ_FAILED','CONTEXT_IDENTITY_MISMATCH','AUTH_TRANSITION_OR_MEMBER_STATE','OBSERVATION_CHANGED','REQUIRED_DATABASE_MISSING','INSTALLATION_IDENTITY_MISMATCH'];result.issues=[allowed.includes(error?.message)?error.message:'GUEST_OBSERVATION_UNCONFIRMED'];}
   finally{clearTimeout(timer);close();work.catch(()=>{});busy=false;}
   result.resources={openConnections:handles.size,activeReadTransactions:txs.size,pendingNativeCalls:pending};
   if(pending||txs.size){result.gate='UNKNOWN';result.issues.push('OBSERVATION_SETTLEMENT_UNCONFIRMED');}
   result.elapsedMs=Date.now()-begun;return result;
  }
  return {observe,cancel:()=>cancel()};
 }
 root.FocurveGuestSafety={create};if(typeof module!=='undefined')module.exports=root.FocurveGuestSafety;
})(globalThis);
