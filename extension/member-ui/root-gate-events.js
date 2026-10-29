// Independent Root-only native DNR observation. No page-provided URL or proof.
(()=>{
 const attempts=new Map(),work=new Set(),VERSION='ROOT_SHORTS_DNR_EVENT_1';
 const track=p=>{work.add(p);p.catch(()=>console.error('MEMBER_FEATURE_EVENT_UNCONFIRMED','ROOT_GATE_OBSERVATION_FAILED')).finally(()=>work.delete(p));};
 const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),v=>v.toString(16).padStart(2,'0')).join('');
 const parse=s=>{try{return new URL(s);}catch{return null;}};
 const entry=u=>u?.protocol==='https:'&&['youtube.com','www.youtube.com'].includes(u.hostname)&&!u.port&&!u.username&&!u.password&&/^\/shorts\/[^/]+\/?$/.test(u.pathname);
 const ownGate=(url,sid)=>{const u=parse(url);return u?.protocol==='chrome-extension:'&&u.hostname===chrome.runtime.id&&u.pathname==='/blocked/shorts.html'&&u.searchParams.getAll('session').length===1&&u.searchParams.get('session')===sid;};
 const installedSame=async(rule,installed)=>{const expected=await MemberA1Contract.digest(rule);for(const r of installed)if(r.id===rule.id&&await MemberA1Contract.digest(r)===expected)return true;return false;};
 const scope=c=>JSON.stringify([c.base_url,c.owner_key,c.executor_id,c.session_id,c.revision,c.snapshot.policy_snapshot_id]);
 function capture(d,history=false){
  if(d.frameId!==0||!Number.isInteger(d.tabId))return;const u=parse(d.url);
  // Intermediate extension navigation must not erase the original attempted URL.
  if(u?.protocol==='chrome-extension:'&&u.hostname===chrome.runtime.id&&u.pathname==='/blocked/shorts.html')return;
  if(!entry(u)){attempts.delete(d.tabId);return;}
  const actor=globalThis.__memberA1;if(!actor)return;const at=Date.now(),cap={tab:d.tabId,url:u.href,entry:u.origin+u.pathname,document:d.documentId??null,timeStamp:d.timeStamp,at,actor,history,completed:false};attempts.set(d.tabId,cap);while(attempts.size>32)attempts.delete(attempts.keys().next().value);
  cap.ready=actor.core.bundle().then(b=>{if(!b||!b.state.session.started_at||b.a.intent==='END'||!['RUNNING','NATIVE_VERIFYING','EFFECT_VERIFYING'].includes(b.a.session_status)||b.a.nr_first_failure)return null;return {session:b.a.session_id,owner:b.a.owner_context,executor:b.a.executor_id,fence:b.ownerFenceEpoch,profile:actor.core.profile};}).catch(()=>null);
 }
 async function verify(draft,c,b){
  const p=draft.root_gate_proof,actor=globalThis.__memberA1;if(!actor||p?.version!==VERSION||!b||b.a.session_status!=='RUNNING'||b.a.intent==='END'||b.a.owner_context!==c.owner_key||b.a.executor_id!==c.executor_id||b.a.session_id!==c.session_id||p.session!==c.session_id||p.owner!==c.owner_key||p.executor!==c.executor_id||p.snapshot!==c.snapshot.policy_snapshot_id||p.fence!==b.ownerFenceEpoch||p.profile!==actor.core.profile||p.entry!==draft.entry_fingerprint||p.source_document!==draft.document_id||p.tab!==draft.native_tab_id||p.target_host!==draft.target_host||p.policy_host!==draft.policy_host||p.observed_at<draft.captured_at)return false;
  const own=b.state.journal.rules.find(r=>r.id===p.rule_id),installed=await chrome.declarativeNetRequest.getSessionRules();if(!own||await MemberA1Contract.digest(own)!==p.rule_hash||!await installedSame(own,installed))return false;
  const fresh=await actor.core.bundle();return globalThis.__memberA1===actor&&fresh.a.record_version===b.a.record_version&&fresh.ownerFenceEpoch===b.ownerFenceEpoch;
 }
 async function finalize(cap,sender){
  const identity=await cap.ready;if(!identity||cap.completed||attempts.get(cap.tab)!==cap||globalThis.__memberA1!==cap.actor||Date.now()-cap.at>5000)return;
  const commit=cap.commit;if(!commit||commit.documentId!==sender.documentId||!ownGate(sender.url,identity.session)||!ownGate(commit.url,identity.session)||sender.documentLifecycle!=='active'||sender.frameId!==0||sender.id!==chrome.runtime.id||sender.tab?.id!==cap.tab)return;
  if(!cap.history&&(!['typed','link','reload','auto_bookmark','generated','keyword','keyword_generated'].includes(commit.transitionType)||(commit.transitionQualifiers??[]).includes('client_redirect')))return;
  const b=await cap.actor.core.bundle();if(!b||b.a.session_id!==identity.session||b.a.owner_context!==identity.owner||b.a.executor_id!==identity.executor||b.ownerFenceEpoch!==identity.fence||b.a.nr_first_failure||b.a.intent==='END'||!['RUNNING','NATIVE_VERIFYING','EFFECT_VERIFYING'].includes(b.a.session_status))return;
  const tab=await chrome.tabs.get(cap.tab);if(tab.url!==sender.url||tab.pendingUrl&&tab.pendingUrl!==sender.url)return;
  const site=cap.actor.core.env.policy.select(b.state.session.snapshot.sites,cap.url);if(!site||site.access_policy==='BLOCK'||!site.feature_policies?.some(p=>p.feature_code==='YOUTUBE_SHORTS'&&p.enabled===true))return;
  const installed=await chrome.declarativeNetRequest.getSessionRules(),rule=b.state.journal.rules.find(r=>r.action?.redirect?.regexSubstitution?.startsWith(cap.actor.core.shortsGateUrl(b.state.session)+'&target=')&&r.condition?.resourceTypes?.includes('main_frame')&&new RegExp(r.condition.regexFilter).test(cap.url));if(!rule||!await installedSame(rule,installed))return;
  const f=await memberFeatureAccess(),c=await f?.collector.getContext();if(!c||c.session_id!==identity.session||c.owner_key!==identity.owner||c.executor_id!==identity.executor||attempts.get(cap.tab)!==cap||globalThis.__memberA1!==cap.actor)return;
  const fingerprint=await hash(cap.url),entryHash=await hash(cap.entry),rows=await f.access.store.drafts('feature-entry:');const matching=rows.filter(d=>d.native_tab_id===cap.tab&&d.entry_fingerprint===entryHash&&d.scope===scope(c)&&Math.abs(d.captured_at-cap.at)<=1500&&(cap.document?d.document_id===cap.document:d.root_gate_proof?.gate_document===sender.documentId));
  if(matching.some(d=>d.phase==='COMPLETED')){cap.completed=true;return;}const original=matching.find(d=>d.phase==='PENDING');
  const document=original?.document_id??cap.document??sender.documentId,key='feature-entry:gate:'+sender.documentId+':'+fingerprint;
  const proof={version:VERSION,...identity,snapshot:c.snapshot.policy_snapshot_id,entry:entryHash,source_document:document,gate_document:sender.documentId,tab:cap.tab,target_host:new URL(cap.url).hostname,policy_host:site.canonical_host,observed_at:Date.now(),rule_id:rule.id,rule_hash:await MemberA1Contract.digest(rule)};
  const draft=original??{tab_id:key,native_tab_id:cap.tab,document_id:document,fingerprint,entry_fingerprint:entryHash,scope:scope(c),sequence_scope:JSON.stringify([c.base_url,c.owner_key,c.executor_id,c.session_id]),owner_key:c.owner_key,executor_id:c.executor_id,base_url:c.base_url,session_id:c.session_id,navigation_id:crypto.randomUUID(),event_id:crypto.randomUUID(),captured_at:cap.at,target_host:proof.target_host,policy_host:site.canonical_host,phase:'PENDING',retain_consumed:true};
  await f.access.store.attachFeatureProof({...draft,root_gate_proof:proof});cap.completed=true;await flushMemberFeature();
 }
 chrome.webNavigation.onBeforeNavigate.addListener(d=>capture(d));chrome.webNavigation.onHistoryStateUpdated.addListener(d=>capture(d,true));
 chrome.webNavigation.onCommitted.addListener(d=>{const cap=attempts.get(d.tabId);if(d.frameId===0&&cap)cap.commit={documentId:d.documentId,url:d.url,transitionType:d.transitionType,transitionQualifiers:d.transitionQualifiers};});
 chrome.tabs.onRemoved.addListener(tab=>attempts.delete(tab));
 chrome.runtime.onMessage.addListener((m,s)=>{if(m?.type!=='FOCURVE_SHORTS_GATE_STATUS'||parse(s.url)?.searchParams.get('session')!==m.session||s.id!==chrome.runtime.id||s.frameId!==0||!s.documentId||!Number.isInteger(s.tab?.id))return;const cap=attempts.get(s.tab.id);if(!cap||cap.completed||cap.busy)return;cap.busy=true;track(finalize(cap,s).finally(()=>{cap.busy=false;}));});
 globalThis.FocurveRootGateEvents={verify,settled:()=>Promise.allSettled([...work])};
})();
