// Core의 navigation API 관찰만 받습니다. Content 메시지는 여기서 처리하지 않습니다.
const AccessStore = (() => {
 const key=tabId=>`access_pending:${tabId}`;
 const explicit=new Set(['link','typed','auto_bookmark','reload','form_submit','generated','keyword','keyword_generated']);
 const host=raw=>GuestSession.normalizeHost(raw);
 function restrictedShorts(snapshot,raw){try{const u=new URL(raw),site=GuestSession.select(snapshot,raw);return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&['youtube.com','www.youtube.com'].includes(u.hostname)&&/^\/shorts\/[^/]+\/?$/.test(u.pathname)&&site?.access_policy!=='BLOCK'&&site?.feature_policies?.some(f=>f.feature_code==='YOUTUBE_SHORTS'&&f.enabled===true);}catch{return false;}}

 function pending(state,details){
  if(!state||!(state.session.status==='RUNNING'||state.execution_contract&&['NATIVE_VERIFYING','EFFECT_VERIFYING'].includes(state.session.status))||details.frameId!==0||!Number.isInteger(details.tabId)||details.tabId<0||!Number.isFinite(details.observed_at)||details.observed_at<Date.parse(state.session.started_at))return null;
  const target=GuestSession.select(state.session.snapshot,details.url);
  if(!target||!['BLOCK','RECORD'].includes(target.access_policy))return null;
  return {key:key(details.tabId),owner_key:state.session.owner_key,session_id:state.session.session_id,revision:state.journal.revision,navigation_id:crypto.randomUUID(),event_id:crypto.randomUUID(),target_host:host(details.url),target_key:`SITE:${host(details.url)}`,registered_host:target.canonical_host,policy:target.access_policy,await_feature:target.access_policy==='RECORD'&&restrictedShorts(state.session.snapshot,details.url),include_subdomains:target.include_subdomains,navigation_started_at:details.timeStamp,captured_at:details.observed_at};
 }
 async function fingerprint(raw){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(new URL(raw).href)))).map(v=>v.toString(16).padStart(2,'0')).join('');}
 async function begin(state,details){
  if(details.frameId!==0||!Number.isInteger(details.tabId)||details.tabId<0)return Promise.resolve();
  // DNR 안내 전환의 before 이벤트에서는 원래 탐색 관찰을 유지합니다.
  if(details.url?.startsWith(chrome.runtime.getURL('blocked/blocked.html')))return Promise.resolve();
  const observation=pending(state,details);
  if(observation)observation.navigation_fingerprint=await fingerprint(details.url);
  return SessionDB.transaction('readwrite',(tx,done)=>{
   const m=tx.objectStore('metadata');
   const replace=()=>{const old=m.get(key(details.tabId));old.onsuccess=()=>{
     if(old.result?.committed_details)m.put({...old.result,key:'access_committed:'+old.result.event_id});
     if(observation)m.put(observation);else m.delete(key(details.tabId));done(null);
   };};
   if(!observation||!Number.isFinite(observation.navigation_started_at)){if(!observation){replace();return;}done(null);return;}
   // Keep one durable high-water mark per tab, including after the pending row is consumed.
   // A replayed before/commit pair must not allocate a second access event.
   const markerKey=`access_observed:${details.tabId}`,request=m.get(markerKey);
   request.onsuccess=()=>{
    const prior=request.result;
    const sameScope=prior&&prior.owner_key===observation.owner_key&&prior.session_id===observation.session_id&&prior.revision===observation.revision;
    if(sameScope&&(prior.navigation_started_at>observation.navigation_started_at||
       (prior.navigation_started_at===observation.navigation_started_at&&prior.navigation_fingerprint===observation.navigation_fingerprint))){done(null);return;}
    m.put({key:markerKey,owner_key:observation.owner_key,session_id:observation.session_id,revision:observation.revision,navigation_started_at:observation.navigation_started_at,navigation_fingerprint:observation.navigation_fingerprint});
    replace();
   };
  });
 }
 function commit(owner,details,observationKey=key(details.tabId)){
  if(details.frameId!==0||!Number.isInteger(details.tabId)||details.tabId<0)return Promise.resolve(null);
  return SessionDB.transaction('readwrite',(tx,done)=>{
   const metadata=tx.objectStore('metadata');const request=metadata.get(observationKey);
   request.onsuccess=()=>{
    const observation=request.result;
    if(!observation){done(null);return;}
    metadata.delete(observationKey);
    if(observation.owner_key!==owner.owner_key||
       !explicit.has(details.transitionType)||(details.transitionQualifiers||[]).includes('client_redirect')||
       (details.documentLifecycle&&details.documentLifecycle!=='active')){done(null);return;}
    // 이전 Worker에서 저장한 pending도 실제 방문 host로 기록한다. 원본 이벤트는 수정하지 않는다.
    const actualHost=host('https://'+observation.target_host);
    if(!actualHost){done(null);return;}
    const targetKey=actualHost;
    let targetMatches=false;
    if(observation.policy==='BLOCK'){
     try{const url=new URL(details.url);targetMatches=url.protocol==='chrome-extension:'&&url.hostname===new URL(chrome.runtime.getURL('')).hostname&&url.pathname==='/blocked/blocked.html'&&url.searchParams.get('session')===observation.session_id&&url.searchParams.get('host')===observation.registered_host;}catch{}
    }else targetMatches=host(details.url)===actualHost&&GuestSession.matches({canonical_host:observation.registered_host,include_subdomains:observation.include_subdomains},details.url);
    if(!targetMatches){done(null);return;}
    const current=metadata.get('current');current.onsuccess=()=>{
     if(current.result?.owner_key!==owner.owner_key||current.result.session_id!==observation.session_id){done(null);return;}
     const lookup=tx.objectStore('sessions').get([owner.owner_key,observation.session_id]);lookup.onsuccess=()=>{
      const session=lookup.result;
      if(!session||session.executor_id!==owner.installation_id||observation.captured_at<Date.parse(session.started_at)){done(null);return;}
      if(session.status!=='RUNNING'){
       if(['NATIVE_VERIFYING','EFFECT_VERIFYING'].includes(session.status)){
        const {frameId,tabId,timeStamp,observed_at,documentId,documentLifecycle,transitionType,transitionQualifiers}=details;
        metadata.put({...observation,await_feature:observation.await_feature||restrictedShorts(session.snapshot,details.url),committed_details:{frameId,tabId,timeStamp,observed_at,documentId,documentLifecycle,transitionType,transitionQualifiers,url:new URL(details.url).origin+'/'}});
       }else if(session.status==='UNKNOWN')metadata.put(observation);
       done(null);return;
      }
      const journal=tx.objectStore('journal').get([owner.owner_key,session.session_id]);journal.onsuccess=()=>{
       if(journal.result?.revision!==observation.revision||journal.result.desired!=='APPLIED'){done(null);return;}
       const events=tx.objectStore('events');const existing=events.get([owner.owner_key,observation.event_id]);existing.onsuccess=()=>{
        if(existing.result){
         if(existing.result.payload.payload.navigation_id!==observation.navigation_id||existing.result.payload.payload.target_key!==targetKey){tx.abort();return;}
         done(existing.result);return;
        }
        if(observation.policy==='RECORD'&&(observation.await_feature||restrictedShorts(session.snapshot,details.url))){done(null);return;}
        const accessSeq=(session.last_access_seq||0)+1;const localSeq=(session.last_local_seq||1)+1;
        if(!Number.isSafeInteger(accessSeq)||!Number.isSafeInteger(localSeq)){tx.abort();return;}
        const event={owner_key:owner.owner_key,event_id:observation.event_id,session_id:session.session_id,ack:false,payload:{schema_version:'1.2',event_id:observation.event_id,executor_id:owner.installation_id,session_id:session.session_id,policy_snapshot_id:session.snapshot.policy_snapshot_id,event_type:observation.policy==='BLOCK'?'BLOCKED_SITE_ACCESS':'RECORDED_ACCESS',occurred_at:new Date(details.observed_at).toISOString(),local_seq:localSeq,payload:{access_seq:accessSeq,navigation_id:observation.navigation_id,target_kind:'SITE',target_host:actualHost,target_key:targetKey,matched_policy_host:observation.registered_host,blocked_reasons:observation.policy==='BLOCK'?['USER_SITE']:[],reason:observation.policy==='BLOCK'?'USER_SITE':'RECORD'}}};
        session.last_access_seq=accessSeq;session.last_local_seq=localSeq;
        events.add(event);tx.objectStore('sessions').put(session);tx.objectStore('journal').put({...journal.result,observed:'APPLIED'});done(event);
       };
      };
     };
    };
   };
  });
 }
 async function flush(owner){const rows=await SessionDB.transaction('readonly',(tx,done)=>{const q=tx.objectStore('metadata').getAll();q.onsuccess=()=>done(q.result.filter(x=>(x.key?.startsWith('access_pending:')||x.key?.startsWith('access_committed:'))&&x.owner_key===owner.owner_key&&x.committed_details).sort((a,b)=>a.navigation_started_at-b.navigation_started_at));});const events=[];for(const row of rows){const e=await commit(owner,row.committed_details,row.key);if(e)events.push(e);}return events;}
 async function list(owner){
  const state=await SessionDB.load();if(!state)return {items:[],total_access:0,repeat_access:0,session_id:null,record_status:'NO_DATA'};
  if(state.session.owner_key!==owner.owner_key||state.session.executor_id!==owner.installation_id)throw new Error('OWNER_MISMATCH');
  return SessionDB.transaction('readonly',(tx,done)=>{
   const items=[];const quality=tx.objectStore('metadata').getAll();quality.onsuccess=()=>{const reviews=new Set(quality.result.filter(d=>d.record_kind==='GUEST_FEATURE_CAPTURE'&&d.owner_key===owner.owner_key&&d.session_id===state.session.session_id&&d.phase==='COMPLETED'&&d.review_required).map(d=>d.event_id));const cursor=tx.objectStore('events').openCursor();cursor.onsuccess=()=>{
    const c=cursor.result;if(c){const event=c.value;if(event.owner_key===owner.owner_key&&event.session_id===state.session.session_id&&['BLOCKED_SITE_ACCESS','RECORDED_ACCESS','BLOCKED_FEATURE_ACCESS'].includes(event.payload?.event_type))items.push(event.payload);c.continue();return;}
    items.sort((a,b)=>a.payload.access_seq-b.payload.access_seq);const counts=new Map();let repeats=0;const quarantined=[];const valid=[];
    for(const event of items){
     const p=event.payload;const actualHost=host('https://'+p.target_host);
     const modern=event.schema_version==='1.2';
     try{globalThis.FocurveMemberEvents.validate(event);}catch{quarantined.push({...event,diagnostic_error:modern?'INVALID_EVENT_CONTRACT':'INVALID_LEGACY_EVENT_CONTRACT'});continue;}
     const repeatKey=modern?actualHost:p.target_key;
     const rank=(counts.get(repeatKey)||0)+1;counts.set(repeatKey,rank);event.target_access_index=rank;event.repeat_count=rank-1;event.is_repeat=rank>1;if(event.is_repeat)repeats++;if(reviews.has(event.event_id))Object.assign(event,{quality:'REVIEW_REQUIRED',review_required:true});valid.push(event);
    }
    done({items:valid.slice(-20).reverse(),quarantined_items:quarantined,quarantined_count:quarantined.length,total_access:valid.length,repeat_access:repeats,session_id:state.session.session_id,record_status:quarantined.length||reviews.size?'REVIEW_REQUIRED':'PARTIAL'});
   };};
  });
 }
 async function fail(details){
  if(details.frameId!==0||!Number.isInteger(details.tabId)||details.tabId<0||!Number.isFinite(details.timeStamp))return Promise.resolve();
  let failedFingerprint;try{failedFingerprint=await fingerprint(details.url);}catch{return;}
  return SessionDB.transaction('readwrite',(tx,done)=>{
   const metadata=tx.objectStore('metadata');const request=metadata.get(key(details.tabId));
   request.onsuccess=()=>{const observation=request.result;
    // Chrome 이벤트 시각끼리만 비교하여 이전 탐색의 늦은 오류가 다음 탐색을 지우지 않게 합니다.
    if(observation&&Number.isFinite(observation.navigation_started_at)&&details.timeStamp>=observation.navigation_started_at&&failedFingerprint===observation.navigation_fingerprint)metadata.delete(key(details.tabId));
    done(null);
   };
  });
 }
 function forget(tabId){return SessionDB.transaction('readwrite',(tx,done)=>{tx.objectStore('metadata').delete(key(tabId));tx.objectStore('metadata').delete(`access_observed:${tabId}`);done(null);});}
 return Object.freeze({begin,commit,fail,list,forget,pending,flush});
})();
