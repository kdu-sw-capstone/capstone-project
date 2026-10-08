const GuestSession = (() => {
 const terminal=new Set(['ENDED','INTERRUPTED','START_FAILED']);
 const alarmName='focurve-guest-session';
 let queue=Promise.resolve();let workerRecovered=false;
 function serial(fn){const result=queue.then(fn);queue=result.catch(()=>{});return result;}
 const now=()=>new Date().toISOString();
 function checkApplyDeadline(state){
  const value=state.journal.execute_before;
  const deadline=typeof value==='string'?Date.parse(value):NaN;
  if(!Number.isFinite(deadline)||Date.now()>=deadline)throw new Error('APPLY_EXPIRED');
 }
 function stable(value){if(Array.isArray(value))return JSON.stringify(value.map(v=>JSON.parse(stable(v))));if(value&&typeof value==='object')return JSON.stringify(Object.fromEntries(Object.keys(value).sort().map(k=>[k,JSON.parse(stable(value[k]))])));return JSON.stringify(value);}
 function matches(site,raw){try{const u=new URL(raw);return ['http:','https:'].includes(u.protocol)&&(u.hostname.toLowerCase()===site.canonical_host||(site.include_subdomains&&u.hostname.toLowerCase().endsWith(`.${site.canonical_host}`)));}catch{return false;}}
 function blockedUrl(site,session){return chrome.runtime.getURL('blocked/blocked.html')+'?host='+encodeURIComponent(site.canonical_host)+'&session='+encodeURIComponent(session.session_id);}
 function buildRules(session,existing){
  let id=100000;const used=new Set(existing.map(r=>r.id));
  return session.snapshot.sites.filter(s=>s.access_policy==='BLOCK').map(site=>{
   while(used.has(id))id++;used.add(id);
   const host=site.canonical_host.replace(/\./g,'\\.');
   return {id:id++,priority:100,action:{type:'redirect',redirect:{url:blockedUrl(site,session)}},condition:{regexFilter:'^https?://'+(site.include_subdomains?'([a-z0-9-]+\\.)*':'')+host+'(:[0-9]+)?([/?#]|$)',isUrlFilterCaseSensitive:false,resourceTypes:['main_frame']}};
  });
 }
 async function rulesMatch(state){const actual=await chrome.declarativeNetRequest.getSessionRules();return state.journal.rules.every(rule=>actual.some(r=>r.id===rule.id&&stable(r)===stable(rule)));}
 async function release(state){
  const actual=await chrome.declarativeNetRequest.getSessionRules();
  // ID 충돌 시 다른 기능의 규칙을 임의로 지우지 않습니다.
  for(const rule of state.journal.rules){const found=actual.find(r=>r.id===rule.id);if(found&&stable(found)!==stable(rule))throw new Error('RULE_OWNERSHIP_CONFLICT');}
  const ids=state.journal.rules.map(r=>r.id);
  if(ids.length)await chrome.declarativeNetRequest.updateSessionRules({removeRuleIds:ids});
  const after=await chrome.declarativeNetRequest.getSessionRules();if(after.some(r=>ids.includes(r.id)))throw new Error('RELEASE_UNCONFIRMED');
 }
 function event(state,type){return {owner_key:state.session.owner_key,event_id:crypto.randomUUID(),session_id:state.session.session_id,ack:false,payload:{schema_version:'1.1',event_id:null,executor_id:state.session.executor_id,session_id:state.session.session_id,policy_snapshot_id:state.session.snapshot.policy_snapshot_id,event_type:type,occurred_at:now(),local_seq:(state.session.last_local_seq??(state.session.started_at?1:0))+1,payload:{}}};}
 async function persist(state,type){let e=type?event(state,type):null;if(e){e.payload.event_id=e.event_id;state.session.last_local_seq=e.payload.local_seq;}await SessionDB.save(state,e);}
 async function schedule(state){if(state.session.status==='RUNNING')await chrome.alarms.create(alarmName,{when:Math.min(Date.parse(state.session.planned_end_at),Date.now()+30000)});else await chrome.alarms.clear(alarmName);}
 async function divertTabs(state){
  const tabs=await chrome.tabs.query({});
  for(const tab of tabs){const site=state.session.snapshot.sites.find(s=>s.access_policy==='BLOCK'&&matches(s,tab.pendingUrl||tab.url));if(!site)continue;
   try{await chrome.tabs.update(tab.id,{url:blockedUrl(site,state.session)});
    let confirmed=false;
    for(let attempt=0;attempt<30;attempt++){
     const current=(await chrome.tabs.query({})).find(t=>t.id===tab.id);
     if(!current||current.url===blockedUrl(site,state.session)){confirmed=true;break;}
     await new Promise(resolve=>setTimeout(resolve,100));
    }
    if(!confirmed)throw new Error('TAB_APPLY_UNCONFIRMED');}catch(e){const alive=await chrome.tabs.query({});if(alive.some(t=>t.id===tab.id))throw e;}
  }
 }
 async function completeStart(state){
  if(state.journal.desired!=='APPLIED')throw new Error('STALE_APPLY');
  checkApplyDeadline(state);
  if(!await rulesMatch(state))throw new Error('APPLY_UNCONFIRMED');
  await divertTabs(state);
  checkApplyDeadline(state);
  const at=now();state.session.status='RUNNING';state.session.started_at=at;state.session.last_confirmed_at=at;
  state.session.planned_end_at=new Date(Date.parse(at)+state.session.duration_minutes*60000).toISOString();
  state.journal.observed='APPLIED';state.interval={owner_key:state.session.owner_key,session_id:state.session.session_id,interval_id:state.session.interval_id,kind:'RUN',start_at:at,end_at:null,duration_ms:null,quality:'CONFIRMED'};
  await persist(state,'SESSION_STARTED');await schedule(state);return state;
 }
 async function finish(state,status='ENDED',reason='USER_END'){
  if(terminal.has(state.session.status))return state;
  state.session.status='ENDING';state.session.end_reason=reason;state.journal.desired='RELEASED';state.journal.revision++;state.journal.action_seq++;
  try { await persist(state); } catch(error) {
   // 저장 실패를 숨기지 않으며, 신규 차단은 남겨두지 않도록 해제를 시도합니다.
   try { await release(state); } catch { throw new Error('RELEASE_UNCONFIRMED'); }
   throw error;
  }
  try{
   await release(state);const at=now();state.session.status=status;state.session.ended_at=at;state.session.policy_released_at=at;if(status!=='START_FAILED'&&reason!=='ACCESS_STORAGE_FAILED')state.session.last_error_code=null;
   state.session.expires_at=new Date(Date.parse(at)+30*86400000).toISOString();state.journal.observed='RELEASED';
   if(state.session.started_at){const end=status==='INTERRUPTED'?state.session.last_confirmed_at:at;const ms=Math.max(0,Date.parse(end)-Date.parse(state.session.started_at));state.session.active_duration_ms=Math.min(ms,state.session.duration_minutes*60000);state.session.overrun_ms=Math.max(0,ms-state.session.duration_minutes*60000);
    state.interval={owner_key:state.session.owner_key,session_id:state.session.session_id,interval_id:state.session.interval_id,kind:'RUN',start_at:state.session.started_at,end_at:end,duration_ms:ms,quality:'CONFIRMED'};
   }
   state.session.record_status='PARTIAL';await persist(state,'SESSION_ENDED');await schedule(state);return state;
  }catch(error){state.session.status='UNKNOWN';state.session.last_error_code=error.message;await persist(state);
   await chrome.alarms.create(alarmName,{when:Date.now()+30000});throw error;}
 }
 async function recover(){
  const marker=await chrome.storage.session.get('focurve_boot');const state=await SessionDB.load();
  const owner=await LocalStore.guestContext();
  if(state&&(state.session.owner_key!==owner.owner_key||state.session.executor_id!==owner.installation_id||state.journal.owner_key!==owner.owner_key||state.journal.session_id!==state.session.session_id))throw new Error('OWNER_MISMATCH');
  if(!marker.focurve_boot){
   if(state&&!terminal.has(state.session.status))await finish(state,'INTERRUPTED','BROWSER_OR_EXTENSION_RESTART');
   await chrome.storage.session.set({focurve_boot:true});
  }else if(state&&!terminal.has(state.session.status)){
   if(state.journal.desired==='RELEASED')await finish(state,state.session.end_reason==='APPLY_FAILED'?'START_FAILED':'ENDED',state.session.end_reason||'RECOVERY');
   else if(state.session.status==='STARTING'){
    try{await completeStart(state);}catch{await finish(state,'START_FAILED','APPLY_FAILED');}
   }else if(state.session.status==='RUNNING'){
    if(!await rulesMatch(state))await finish(state,'INTERRUPTED','POLICY_MISMATCH');
    else if(Date.now()>=Date.parse(state.session.planned_end_at))await finish(state,'ENDED','TIME_LIMIT');
    else{state.session.last_confirmed_at=now();if(!workerRecovered)await divertTabs(state);await persist(state);await schedule(state);}
   }else await finish(state,'INTERRUPTED','UNCONFIRMED_RECOVERY');
  }
  await SessionDB.expire();workerRecovered=true;return SessionDB.load();
 }
 async function begin(minutes,requestId){
  if(!Number.isInteger(minutes)||minutes<1||minutes>180||typeof requestId!=='string'||!/^[0-9a-f-]{36}$/i.test(requestId))throw new Error('INVALID_START');
  const previous=await recover();
  const replay=await SessionDB.byRequest(requestId);
  if(replay){if(replay.session.duration_minutes!==minutes)throw new Error('IDEMPOTENCY_CONFLICT');return replay;}
  if(previous&&!terminal.has(previous.session.status))throw new Error('SESSION_ACTIVE');
  const owner=await LocalStore.guestContext();const siteList=await GuestSites.list();const sites=siteList.items;
  for(const site of sites)GuestSites.validate({url:site.canonical_host,display_name:site.display_name,include_subdomains:site.include_subdomains,purpose:site.purpose,access_policy:site.access_policy,feature_policies:site.feature_policies});
  if(sites.some(s=>s.feature_policies?.some(p=>p.enabled)))throw new Error('FEATURE_NOT_IMPLEMENTED');
  const sessionId=crypto.randomUUID();const session={owner_key:owner.owner_key,session_id:sessionId,executor_id:owner.installation_id,start_request_id:requestId,interval_id:crypto.randomUUID(),duration_minutes:minutes,last_local_seq:0,last_access_seq:0,status:'STARTING',started_at:null,ended_at:null,expires_at:null,active_duration_ms:0,overrun_ms:0,record_status:'PENDING',snapshot:{policy_snapshot_id:crypto.randomUUID(),format_version:'1.1',executor_id:owner.installation_id,created_at:now(),source_version:siteList.settings_version,sites:structuredClone(sites)},last_error_code:null};
  const rules=buildRules(session,await chrome.declarativeNetRequest.getSessionRules());
  const state={session,journal:{owner_key:owner.owner_key,session_id:sessionId,revision:1,action_seq:1,desired:'APPLIED',observed:'UNCONFIRMED',rules,execute_before:new Date(Date.now()+30000).toISOString()}};
  await persist(state);
  try{
   await chrome.alarms.create(alarmName,{when:Date.now()+30000});
   for(const rule of rules){const check=await chrome.declarativeNetRequest.isRegexSupported({regex:rule.condition.regexFilter,isCaseSensitive:false});if(!check.isSupported)throw new Error('RULE_UNSUPPORTED');}
   checkApplyDeadline(state);
   if(rules.length)await chrome.declarativeNetRequest.updateSessionRules({addRules:rules});
   return await completeStart(state);
  }catch(error){state.session.last_error_code=error.message;try{await finish(state,'START_FAILED','APPLY_FAILED');}catch{throw new Error('RELEASE_UNCONFIRMED');}throw error;}
 }
 async function collect(stage,details){
  const state=await SessionDB.load();const owner=await LocalStore.guestContext();
  if(state&&(state.session.owner_key!==owner.owner_key||state.session.executor_id!==owner.installation_id))throw new Error('OWNER_MISMATCH');
  try{
   return stage==='before'?await AccessStore.begin(state,details):await AccessStore.commit(owner,details);
  }catch(error){
   // 저장 실패 시 계속 수집하는 대신 세션 해제를 시도하고 오류를 유지합니다.
   if(state&&state.session.status==='RUNNING'){
    state.session.last_error_code='ACCESS_STORAGE_FAILED';
    try{await finish(state,'INTERRUPTED','ACCESS_STORAGE_FAILED');}catch(releaseError){throw releaseError;}
   }
   throw error;
  }
 }
 return Object.freeze({observe:(stage,details)=>serial(()=>collect(stage,details)),records:()=>serial(async()=>{await recover();return AccessStore.list(await LocalStore.guestContext());}),start:(minutes,id)=>serial(()=>begin(minutes,id)),state:()=>serial(recover),end:(sessionId)=>serial(async()=>{const state=await recover();if(!state||state.session.session_id!==sessionId)throw new Error('SESSION_NOT_FOUND');return finish(state);}),tick:()=>serial(recover),matches,buildRules});
})();
