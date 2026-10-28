// Root-only SITE and native Shorts-entry collection; no Content event endpoint.
let memberAccessInit;
async function memberSiteAccess(){
 const adapter=globalThis.__memberA1;if(!adapter)return null;
 if(memberAccessInit?.adapter===adapter)return memberAccessInit.promise;
 const promise=(async()=>{
  const identity=await adapter.identity();
  if(globalThis.__memberA1!==adapter)throw Error('OWNER_MISMATCH');
  const same=i=>i.owner_key===identity.owner_key&&i.executor_id===identity.executor_id&&i.authority===identity.authority;
  const assertCurrent=async()=>{if(globalThis.__memberA1!==adapter)throw Error('OWNER_MISMATCH');const i=await adapter.identity();if(globalThis.__memberA1!==adapter||!same(i))throw Error('OWNER_MISMATCH');return i;};
  const suffix=await MemberA1Contract.digest(identity),store=new FocurveMemberExecution.MemberAccessStore({indexedDB,name:'member-a1-site-access:'+suffix});
  const getCredentials=async()=>{await assertCurrent();const credentials=await __memberIntegration.auth.credentials();await assertCurrent();if(credentials.owner_key!==identity.owner_key||credentials.executor_id!==identity.executor_id)throw Error('OWNER_MISMATCH');return credentials;};
  const delivery=new FocurveMemberEvents.MemberEventDelivery({baseUrl:identity.authority,getCredentials,fetch:globalThis.fetch.bind(globalThis),store:new FocurveMemberEvents.MemberEventStore({indexedDB,name:'member-a1-site-events:'+suffix})});
  const collector=new FocurveMemberExecution.MemberAccessCollector({store,blockedPageUrl:chrome.runtime.getURL('blocked/blocked.html'),getContext:async()=>{
   if(globalThis.__memberA1!==adapter)return null;
   const i=await assertCurrent(),b=await adapter.core.bundle();
   const n=b?.a.native_transition,d=b?.a.effect_transition,nr=b?.a.native_transition_contract==='NR01_1'&&n&&!n.first_failure&&Date.now()<n.deadline_at&&n.deadline_at-n.started_at<=5000,dp=b?.a.dom_transition_contract==='DP01_1'&&d&&!d.first_failure&&Date.now()<d.deadline_at&&d.deadline_at-d.started_at<=3000;
   if(!b||b.a.intent==='END'||b.a.nr_first_failure||!['RUNNING',...(nr?['NATIVE_VERIFYING']:[]),...(dp?['EFFECT_VERIFYING']:[])].includes(b.a.session_status))return null;
   const s=await adapter.request('/sessions/'+b.a.session_id);
   const active=s.execution_status==='RUNNING'||nr&&s.execution_status==='NATIVE_VERIFYING'&&s.native_transition?.transition_id===n.transition_id&&!s.first_nr_failure||dp&&s.execution_status==='EFFECT_VERIFYING'&&s.effect_transition?.transition_id===d.transition_id&&!s.first_dp_failure;
   if(!active||s.executor_id!==i.executor_id||s.owner_user_id!==i.owner_key.slice(7)||s.policy_snapshot_id!==b.a.snapshot_ref.policy_snapshot_id||s.desired_revision!==b.state.session.member_admission.server_revision)return null;
   if(b.state.journal.desired!=='APPLIED'||b.state.journal.observed!=='APPLIED')return null;
   const installed=await chrome.declarativeNetRequest.getSessionRules(),blocked_redirects={};
   for(const site of b.state.session.snapshot.sites.filter(x=>x.access_policy==='BLOCK')){
    const url=chrome.runtime.getURL('blocked/blocked.html')+'?host='+encodeURIComponent(site.canonical_host)+'&session='+encodeURIComponent(s.session_id),original=b.state.journal.rules.find(r=>r.action?.redirect?.url===url),native=original&&installed.find(r=>r.id===original.id);
    if(!original||!native||await MemberA1Contract.digest(original)!==await MemberA1Contract.digest(native))return null;
    blocked_redirects[site.canonical_host]=url;
   }
   await assertCurrent();return {base_url:i.authority,owner_key:i.owner_key,executor_id:i.executor_id,session_id:s.session_id,revision:s.desired_revision,snapshot:b.state.session.snapshot,applied_at:s.started_at,can_freeze:b.a.session_status==='RUNNING'&&s.execution_status==='RUNNING',blocked_redirects};
  }});
  await assertCurrent();
  return {collector,store,delivery,identity,async flush(){await assertCurrent();const originals=await store.originals(identity.owner_key,identity.executor_id,identity.authority);await assertCurrent();await FocurveMemberEvents.transferOriginals(originals,store,delivery);await assertCurrent();return delivery.flush();}};
 })();
 const entry={adapter,promise};memberAccessInit=entry;
 try{return await promise;}catch(error){if(memberAccessInit===entry)memberAccessInit=undefined;throw error;}
}

function observeMemberSite(stage,details){if(globalThis.FocurveSafetyNavigation?.document(details)||!globalThis.__memberA1)return;memberSiteAccess().then(async a=>{const event=await a.collector.observe(stage,{...details,observed_at:Date.now()});if(event){console.info('MEMBER_SITE_EVENT_CAPTURED');await a.flush();}if(stage==='commit'){setTimeout(()=>flushMemberFeature().catch(()=>{}),300);setTimeout(()=>flushMemberFeature().catch(()=>{}),1500);}}).catch(e=>console.error('MEMBER_SITE_EVENT_UNCONFIRMED',e.message));}
chrome.webNavigation.onBeforeNavigate.addListener(d=>observeMemberSite('before',d));chrome.webNavigation.onCommitted.addListener(d=>observeMemberSite('commit',d));chrome.webNavigation.onErrorOccurred.addListener(d=>observeMemberSite('error',d));
chrome.tabs.onRemoved.addListener(tabId=>{
 if(globalThis.FocurveSafetyNavigation?.tab(tabId))return;
 const entry=memberAccessInit,adapter=globalThis.__memberA1;if(!entry||entry.adapter!==adapter)return;
 entry.promise.then(async access=>{const i=await adapter.identity();if(globalThis.__memberA1!==adapter||i.owner_key!==access.identity.owner_key||i.executor_id!==access.identity.executor_id||i.authority!==access.identity.authority)throw Error('OWNER_MISMATCH');await access.collector.forget(tabId);}).catch(e=>console.error('MEMBER_SITE_EVENT_UNCONFIRMED',e.message));
});

let memberFeatureInit;
async function memberFeatureAccess(){
 const adapter=globalThis.__memberA1;if(!adapter)return null;
 if(memberFeatureInit?.adapter===adapter)return memberFeatureInit.promise;
 const promise=(async()=>{const access=await memberSiteAccess();
  const getContext=async()=>{
   if(globalThis.__memberA1!==adapter)return null;
   const i=await adapter.identity(),b=await adapter.core.bundle();
   const nr=b?.a.native_transition_contract==='NR01_1'&&b.a.native_transition&&!b.a.native_transition.first_failure;const dp=b?.a.dom_transition_contract==='DP01_1'&&b.a.effect_transition&&['VERIFYING','READY'].includes(b.a.effect_transition.phase)&&!b.a.effect_transition.first_failure&&!b.a.nr_first_failure&&Date.now()<b.a.effect_transition.deadline_at&&b.a.effect_transition.deadline_at-b.a.effect_transition.started_at<=3000;if(!b?.state.session.started_at||b.a.intent==='END'||!(['RUNNING','UNKNOWN'].includes(b.a.session_status)||nr&&b.a.session_status==='NATIVE_VERIFYING'||dp&&b.a.session_status==='EFFECT_VERIFYING'))return null;
   const s=await adapter.request('/sessions/'+b.a.session_id);
   if(!(s.execution_status==='RUNNING'||nr&&s.execution_status==='NATIVE_VERIFYING'&&s.native_transition_contract==='NR01_1'&&s.native_transition?.transition_id===b.a.native_transition.transition_id&&!s.first_nr_failure||dp&&s.execution_status==='EFFECT_VERIFYING'&&s.dom_transition_contract==='DP01_1'&&s.effect_transition?.transition_id===b.a.effect_transition.transition_id&&!s.first_dp_failure&&!s.first_nr_failure)||s.owner_user_id!==i.owner_key.slice(7)||s.executor_id!==i.executor_id||s.policy_snapshot_id!==b.a.snapshot_ref.policy_snapshot_id||s.desired_revision!==b.state.session.member_admission.server_revision)return null;
   return {base_url:i.authority,owner_key:i.owner_key,executor_id:i.executor_id,session_id:s.session_id,revision:s.desired_revision,snapshot:b.state.session.snapshot,applied_at:s.started_at};
  };
  const getAppliedProof=async(draft,c)=>{
   const core=adapter.core,b=await core.bundle();if(globalThis.__memberA1!==adapter||!b||b.a.session_id!==c.session_id||b.a.session_status!=='RUNNING'||b.a.intent==='END'||b.state.journal.observed!=='APPLIED')return false;
   if(draft.root_gate_proof)return globalThis.FocurveRootGateEvents?.verify(draft,c,b)??false;
   const binding=b.bindings.find(x=>x.scope.tab_id===draft.native_tab_id&&x.scope.document_id===draft.document_id&&x.scope.frame_id===0&&x.scope.owner_context===c.owner_key&&x.scope.executor_id===c.executor_id&&x.scope.target_host===draft.target_host&&x.scope.matched_policy_host===draft.policy_host&&x.scope.snapshot_ref.policy_snapshot_id===c.snapshot.policy_snapshot_id&&x.ordinary_authority==='ACTIVE'&&x.readiness==='READY'&&x.resolution==='NONE'&&!x.apply_closed&&x.evidence_generation===b.a.generation&&MemberA1Contract.effectConfirmed(x.current_effect));
   if(!binding)return core.d1?.featureProof(draft,c)??false;
   const frame=await core.p1.frame(binding),p=await core.store.read('a1:p1:NATIVE_BINDING_PROOF:'+binding.scope.binding_id);
   const u=new URL(frame.url),entryHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(u.origin+u.pathname))),x=>x.toString(16).padStart(2,'0')).join('');
   if(!p||p.phase!=='ATTESTED'||p.native_url_sha256!==frame.url_sha256||entryHash!==draft.entry_fingerprint||p.registration_epoch!==binding.registration_epoch||p.content_instance!==binding.scope.content_instance_id||p.fence_epoch!==b.ownerFenceEpoch||p.owner_context!==c.owner_key||p.session_id!==c.session_id||p.executor_id!==c.executor_id)return false;
   const fresh=await core.bundle();return fresh?.a.record_version===b.a.record_version&&fresh.ownerFenceEpoch===b.ownerFenceEpoch&&fresh.bindings.some(x=>x.key===binding.key&&x.record_version===binding.record_version);
  };
  return {collector:new FocurveMemberExecution.MemberFeatureCollector({store:access.store,getContext,getAppliedProof,withConfirmedEffect:work=>adapter.core.serial(work)}),access};
 })();const entry={adapter,promise};memberFeatureInit=entry;try{return await promise;}catch(error){if(memberFeatureInit===entry)memberFeatureInit=undefined;throw error;}
}
async function flushMemberFeature(){await memberFeatureQuality();const actor=globalThis.__memberA1;const f=await memberFeatureAccess();if(!f)return;let failure;try{const deferred=await f.access.collector.flushCommitted();const events=await f.collector.flush();if(events.length)console.info('MEMBER_FEATURE_EVENT_CAPTURED',events.length);}catch(e){failure=e;}try{await f.access.flush();}catch(e){failure??=e;}const wasPending=f.pendingProof===true;f.pendingProof=(await f.access.store.drafts('feature-entry:')).some(d=>d.phase==='PENDING');if(typeof memberFeatureInit!=='undefined'&&memberFeatureInit?.adapter===actor&&globalThis.__memberA1===actor)memberFeatureInit.pendingProof=f.pendingProof;if(f.pendingProof&&!wasPending)queueMicrotask(()=>globalThis.__memberFeatureProofNotify?.());if(failure)throw failure;}
function observeMemberFeature(stage,d){if(!globalThis.__memberA1)return;memberFeatureAccess().then(async f=>{await f.collector.observe(stage,{...d,observed_at:Date.now()});await flushMemberFeature();}).catch(e=>console.error('MEMBER_FEATURE_EVENT_UNCONFIRMED',e.message));}
chrome.webNavigation.onCommitted.addListener(d=>observeMemberFeature('commit',d));
chrome.webNavigation.onHistoryStateUpdated.addListener(d=>observeMemberFeature('history',d));
chrome.alarms.onAlarm.addListener(a=>{if(a.name==='focurve-member-server-poll'&&globalThis.__memberA1)flushMemberFeature().catch(e=>console.error('MEMBER_FEATURE_EVENT_UNCONFIRMED',e.message));});
async function seedMemberFeatureBaseline(){const f=await memberFeatureAccess();if(!f)return;const b=await __memberA1.core.bundle();if(b?.a.session_status!=='RUNNING'||f.seededSession===b.a.session_id)return;for(const tab of await chrome.tabs.query({})){if(!/^https:\/\/(www\.)?youtube\.com\//.test(tab.url??''))continue;for(const frame of await chrome.webNavigation.getAllFrames({tabId:tab.id})??[])if(frame.frameId===0&&frame.documentLifecycle==='active')await f.collector.observe('baseline',{...frame,tabId:tab.id,timeStamp:Date.now(),observed_at:Date.now()});}f.seededSession=b.a.session_id;}

// A late Root failure changes only quality metadata; immutable originals/receipts remain untouched.
async function memberFeatureQuality(){
 const actor=globalThis.__memberA1;if(!actor)return {quality:'NOT_COLLECTED',events:[]};
 const access=await memberSiteAccess(),i=await actor.identity(),b=await actor.core.bundle();
 if(globalThis.__memberA1!==actor||!b||b.a.owner_context!==i.owner_key||b.a.executor_id!==i.executor_id)return {quality:'NOT_COLLECTED',events:[]};
 const scope=JSON.stringify([i.authority,i.owner_key,i.executor_id,b.a.session_id,b.state.session.member_admission.server_revision,b.a.snapshot_ref.policy_snapshot_id]);
 if(b.a.session_status==='UNKNOWN')await access.store.markFeatureReview(scope,'ROOT_EXECUTION_UNCONFIRMED');
 return access.store.featureQuality(scope);
}
