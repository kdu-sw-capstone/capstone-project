import {effectConfirmed} from './contract.mjs';

// Root-native telemetry only. No Content message can create an access event.
export class GuestFeatureCapture {
 constructor(core,env){this.core=core;this.env=env;this.tail=Promise.resolve();}
 serial(work){const p=this.tail.then(work);this.tail=p.catch(()=>{});return p;}
 async context(allowUnknown=false){const owner=await this.env.owner(),b=await this.core.bundle();
  if(!b||b.a.owner_context!==owner.owner_key||!owner.owner_key.startsWith('GUEST:')||!((allowUnknown?['RUNNING','UNKNOWN']:['RUNNING']).includes(b.a.session_status)||allowUnknown&&b.a.session_status==='NATIVE_VERIFYING'&&b.a.native_transition_contract==='NR01_1'&&b.a.native_transition&&!b.a.native_transition.first_failure)||b.a.intent==='END'||b.state.journal.desired!=='APPLIED'||b.state.journal.observed!=='APPLIED')return null;
  return b;
 }
 async hash(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),v=>v.toString(16).padStart(2,'0')).join('');}
 observe(stage,d){return this.serial(async()=>{
  if(!['commit','history','baseline'].includes(stage)||d.frameId!==0||!Number.isInteger(d.tabId)||d.tabId<0||!d.documentId||d.documentLifecycle!=='active'||!Number.isFinite(d.timeStamp)||!Number.isFinite(d.observed_at))return;
  if(stage!=='baseline'&&(!['link','typed','auto_bookmark','reload','form_submit','generated','keyword','keyword_generated'].includes(d.transitionType)||(d.transitionQualifiers??[]).includes('client_redirect')))return;
  const u=new URL(d.url);if(u.protocol!=='https:'||!['youtube.com','www.youtube.com'].includes(u.hostname)||u.port||u.username||u.password)return;
  const b=await this.context(true);if(!b||d.timeStamp<Date.parse(b.state.session.started_at))return;
  const entry=await this.hash(u.origin+u.pathname),fingerprint=await this.hash(u.href),sid=b.a.session_id,owner=b.state.session.owner_key;
  const markerKey='guest-feature:marker:'+sid+':'+d.tabId+':'+d.documentId;
  const marker=await this.core.store.read(markerKey);
  if(stage==='baseline'&&marker||stage==='history'&&marker?.entry===entry)return;
  const site=this.env.policy.select(b.state.session.snapshot.sites,u.href);
  const qualifies=stage!=='baseline'&&(stage!=='history'||marker)&&/^\/shorts\/[^/]+\/?$/.test(u.pathname)&&site&&site.access_policy!=='BLOCK'&&site.feature_policies?.some(f=>f.feature_code==='YOUTUBE_SHORTS'&&f.enabled);
  const key='guest-feature:entry:'+sid+':'+d.tabId+':'+d.documentId+':'+d.timeStamp+':'+fingerprint;
  const value={key,record_kind:'GUEST_FEATURE_CAPTURE',owner_key:owner,session_id:sid,executor_id:b.state.session.executor_id,native_tab_id:d.tabId,document_id:d.documentId,entry,phase:'PENDING',event_id:crypto.randomUUID(),navigation_id:crypto.randomUUID(),occurred_at:new Date(d.observed_at).toISOString(),target_host:u.hostname,policy_host:site?.canonical_host};
  await this.env.db.transaction('readwrite',(tx,done)=>{const md=tx.objectStore('metadata'),q=md.get(key);q.onsuccess=()=>{md.put({key:markerKey,record_kind:'GUEST_FEATURE_CAPTURE',owner_key:owner,session_id:sid,entry,phase:'MARKER'});if(qualifies&&!q.result)md.put(value);done(null);};});
 });}
 flush(){return this.serial(()=>this.core.serial(async()=>{
  const seen=await this.core.bundle(),owner=await this.env.owner();
  if(seen?.a.session_status==='UNKNOWN'&&seen.a.owner_context===owner.owner_key){
   await this.env.db.transaction('readwrite',(tx,done)=>{const md=tx.objectStore('metadata'),q=md.getAll();q.onsuccess=()=>{for(const d of q.result)if(d.record_kind==='GUEST_FEATURE_CAPTURE'&&d.owner_key===owner.owner_key&&d.session_id===seen.a.session_id&&d.phase==='COMPLETED'&&!d.review_required)md.put({...d,review_required:true,review_error:'ROOT_EXECUTION_UNCONFIRMED'});done(null);};});
   return [];
  }
  const b=await this.context();if(!b)return [];
  await this.env.access.flush(owner);
  const rows=await this.env.db.transaction('readonly',(tx,done)=>{const q=tx.objectStore('metadata').getAll();q.onsuccess=()=>done(q.result.filter(x=>x.record_kind==='GUEST_FEATURE_CAPTURE'&&x.phase==='PENDING'&&x.owner_key===b.state.session.owner_key&&x.session_id===b.a.session_id));});
  const result=[];for(const draft of rows){
   const binding=b.bindings.find(x=>x.scope.tab_id===draft.native_tab_id&&x.scope.document_id===draft.document_id&&x.scope.frame_id===0&&x.scope.owner_context===draft.owner_key&&x.scope.executor_id===draft.executor_id&&x.scope.target_host===draft.target_host&&x.scope.matched_policy_host===draft.policy_host&&x.scope.snapshot_ref.policy_snapshot_id===b.a.snapshot_ref.policy_snapshot_id&&x.ordinary_authority==='ACTIVE'&&x.readiness==='READY'&&x.resolution==='NONE'&&!x.apply_closed&&x.evidence_generation===b.a.generation&&effectConfirmed(x.current_effect));
   if(!binding)continue;
   const frame=await this.core.p1.frame(binding),p=await this.core.store.read('a1:p1:NATIVE_BINDING_PROOF:'+binding.scope.binding_id),u=new URL(frame.url);
   if(!p||p.phase!=='ATTESTED'||p.native_url_sha256!==frame.url_sha256||draft.entry!==await this.hash(u.origin+u.pathname)||p.registration_epoch!==binding.registration_epoch||p.content_instance!==binding.scope.content_instance_id||p.fence_epoch!==b.ownerFenceEpoch||p.owner_context!==draft.owner_key||p.session_id!==draft.session_id||p.executor_id!==draft.executor_id)continue;
   const event=await this.env.db.transaction('readwrite',(tx,done)=>{const md=tx.objectStore('metadata'),q=md.get(draft.key);q.onsuccess=()=>{
    if(q.result?.phase!=='PENDING'){done(null);return;}
    const ar=md.get(b.a.key);ar.onsuccess=()=>{if(ar.result?.record_version!==b.a.record_version){done(null);return;}
     const br=md.get(binding.key);br.onsuccess=()=>{if(br.result?.record_version!==binding.record_version){done(null);return;}const fr=md.get('a1:owner-fence');fr.onsuccess=()=>{if(fr.result?.epoch!==b.ownerFenceEpoch||fr.result.owner_context!==draft.owner_key||fr.result.transitioning){done(null);return;}
     const sr=tx.objectStore('sessions').get([draft.owner_key,draft.session_id]);sr.onsuccess=()=>{const s=sr.result;if(!s||s.status!=='RUNNING'){done(null);return;}
      const local_seq=(s.last_local_seq||1)+1,access_seq=(s.last_access_seq||0)+1;if(!Number.isSafeInteger(local_seq)||!Number.isSafeInteger(access_seq)){tx.abort();return;}
      const payload={schema_version:'1.2',event_id:draft.event_id,executor_id:s.executor_id,session_id:s.session_id,policy_snapshot_id:s.snapshot.policy_snapshot_id,event_type:'BLOCKED_FEATURE_ACCESS',occurred_at:draft.occurred_at,local_seq,payload:{access_seq,navigation_id:draft.navigation_id,target_kind:'FEATURE',target_host:draft.target_host,target_key:draft.target_host,feature_code:'YOUTUBE_SHORTS',matched_policy_host:draft.policy_host,blocked_reasons:['FEATURE'],reason:'FEATURE'}};
      globalThis.FocurveMemberEvents.validate(payload);tx.objectStore('events').add({owner_key:s.owner_key,event_id:payload.event_id,session_id:s.session_id,ack:false,payload});tx.objectStore('sessions').put({...s,last_local_seq:local_seq,last_access_seq:access_seq});md.put({...q.result,phase:'COMPLETED'});done(payload);
     };};};};};});if(event)result.push(event);
  }return result;
 }));}
 async seed(){const b=await this.context();if(!b)return;for(const tab of await this.env.chrome.tabs.query({})){if(!/^https:\/\/(www\.)?youtube\.com\//.test(tab.url??''))continue;for(const f of await this.env.chrome.webNavigation.getAllFrames({tabId:tab.id})??[])if(f.frameId===0)await this.observe('baseline',{...f,tabId:tab.id,timeStamp:Date.now(),observed_at:Date.now()});}}
}
