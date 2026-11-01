import {DomRoot,DP} from './dom.mjs';
import {VERSION,valid,same,fail,digest,preflight,makeTrialSnapshot,makeGuestSnapshot,ref,releaseConfirmed} from './contract.mjs';
import {id,instant,aggregate,binding,control,proof,invalidateAggregate,closeInterval,error,saveSession} from './domain.mjs';
import {P1,P1Native,rawHash,validP1} from './p1.mjs';
import {A1Store} from './store.mjs';
import {D1Lifecycle,capacityProfile} from './d1.mjs';
import {A1Registry} from './registry.mjs';
const terminal=s=>['ENDED','START_FAILED','INTERRUPTED'].includes(s),bump=x=>x===Number.MAX_SAFE_INTEGER?x:x+1;
export class A1Core {
 constructor(env,{nd01=false,dp01=false,nr01=false,d1b5=false,p1=false,isolatedTrial=false,limitedProduct11=false,now=Date.now,mono=()=>performance.now()}={}){
  if(dp01&&(!nr01||!p1||!d1b5))fail('UNSUPPORTED_POLICY');if(nd01&&(!nr01||!p1||!d1b5))fail('UNSUPPORTED_POLICY');this.documentRetirement=env.experimentalDocumentCoordinator===true&&nd01;this.nd01=nd01;this.dp01=dp01;this.nr01=nr01;this.env=env;this.chrome=env.chrome;this.now=now;this.mono=mono;this.boot=id();this.limitedProduct11=limitedProduct11;this.enabled=isolatedTrial||limitedProduct11;this.tail=Promise.resolve();this.clock=null;this.watchReady=false;
  this.nativeReadyDocs=new Map();this.store=new A1Store(env.db,{hostPolicy:env.policy,isolatedTrial:!limitedProduct11,limitedProduct11,verifyNative:a=>this.verifyNative(a)});this.registry=new A1Registry(this.store,this.chrome,{onChange:()=>this.requestCheck()});this.p1=p1?new P1Native(this):null;this.store.p1=p1;this.registry.p1=this.p1;this.d1b5=d1b5;this.store.d1b5=d1b5;if(d1b5&&!p1)fail('UNSUPPORTED_POLICY');this.d1=d1b5?new D1Lifecycle(this):null;this.dom=dp01?new DomRoot(this):null;this.registry.dom=this.dom;this.ready=this.initialize();
 }
 serial(f){const p=this.tail.then(f);this.tail=p.catch(()=>{});return p;}
 traceNative(stage,bundle,code=null){
  // Bounded console evidence only: no storage, browser call, wait, or authority.
  try{
   const stages=['BEGIN_COMMITTED','CHECK_ENTER','CENSUS_WAIT','FRESH_ATTEST_ENTER','FRESH_ATTEST_COMMITTED','FRESH_APPLY_ENTER','FRESH_APPLY_COMMITTED','LOCAL_CONFIRMED','FAILURE'];
   if(!stages.includes(stage))return;
   const a=bundle?.a,n=a?.native_transition,request=bundle?.state?.session?.start_request_id,uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(x);
   if(!uuid(a?.session_id)||!uuid(request))return;
   const codes=['LOADING','PENDING_URL','MISSING_TOP_DOCUMENT','NATIVE_API_ERROR','SAME_DOCUMENT_NATIVE_VIEW_CHANGED','DOCUMENT_ADDITION_CANDIDATE','REVALIDATION_REQUIRED','STORE_UNCONFIRMED','CLEANUP_REQUIRED','UNAUTHORIZED_SENDER','SCOPE_MISMATCH','GENERATION_CHANGED','RUNNING_GATE_DENIED','INVALID_EFFECT_EVIDENCE','OWNER_MISMATCH','INVALID_TRANSITION_STATE'];
   const safeCode=code===null?null:codes.includes(code)?code:'OTHER',key=(n?.transition_id??a.session_id)+':'+stage+':'+safeCode;
   this.nativeTraceSeen??=new Set();if(this.nativeTraceSeen.has(key))return;this.nativeTraceSeen.add(key);while(this.nativeTraceSeen.size>64)this.nativeTraceSeen.delete(this.nativeTraceSeen.values().next().value);
   console.info('FOCURVE_GUEST_NATIVE_TRACE',JSON.stringify({stage,at_epoch_ms:this.now(),request_id:request,session_id:a.session_id,transition_id:uuid(n?.transition_id)?n.transition_id:null,started_at:Number.isSafeInteger(n?.started_at)?n.started_at:null,deadline_at:Number.isSafeInteger(n?.deadline_at)?n.deadline_at:null,last_seen_at:Number.isSafeInteger(n?.last_seen_at)?n.last_seen_at:null,code:safeCode,authority_granted:false}));
  }catch{} // Logging cannot mask an execution error or change its result.
 }
 requestCheck(){
  this.checkDirty=true;if(this.uiPending||this.checkTimer||this.checkPending)return;
  this.checkTimer=setTimeout(()=>{
   this.checkTimer=null;if(this.uiPending)return;this.checkPending=true;this.checkDirty=false;
   this.tick().catch(()=>{}).finally(()=>{this.checkPending=false;if(this.checkDirty)this.requestCheck();});
  },50);
 }
 async initialize(){
  const flag=await this.store.read('a1:trial');this.enabled ||= flag?.enabled===true;
  const marker=await this.chrome.storage.session.get('focurve_a1_profile');this.newProfile=!marker.focurve_a1_profile;this.profile=marker.focurve_a1_profile??id();await this.chrome.storage.session.set({focurve_a1_profile:this.profile});
  if(!this.enabled)return;
  const state=await this.env.db.load();if(!state||state.execution_contract!==VERSION||terminal(state.session.status))return;
  const storedAggregate=await this.store.read('a1:aggregate:'+state.session.session_id);if(storedAggregate?.document_transition_contract&&!this.nd01)fail('UNSUPPORTED_POLICY');if(storedAggregate?.dom_transition_contract&&!this.dp01)fail('UNSUPPORTED_POLICY');if(storedAggregate?.native_transition_contract&&!this.nr01)fail('UNSUPPORTED_POLICY');const mode=await this.store.read('start:'+state.session.start_request_id);if(mode?.native_binding_mode===P1&&!this.p1)fail('UNSUPPORTED_POLICY');capacityProfile([mode].filter(Boolean),await this.store.read('a1:aggregate:'+state.session.session_id),this.d1b5);
  this.snapshot=structuredClone(state.session.snapshot);
  let bootWait=null;
  if(this.nr01&&storedAggregate?.native_transition_contract==='NR01_1'&&storedAggregate.session_status==='RUNNING'&&!storedAggregate.nr_first_failure&&marker.focurve_a1_profile&&this.now()>=Date.parse(storedAggregate.time.last_trusted_at)&&this.now()-Date.parse(storedAggregate.time.last_trusted_at)<=30000){
   const rows=await this.registry.rows(),live=rows.filter(b=>b.record_kind==='A1_BINDING'&&b.scope.session_id===storedAggregate.session_id&&b.resolution==='NONE'),refs=[];let ok=live.length<=5&&!rows.some(o=>o.record_kind==='A1_OPERATION'&&o.command?.payload?.scope?.session_id===storedAggregate.session_id&&['IN_FLIGHT','IN_DOUBT'].includes(o.phase));
   for(const b of live){const pr=rows.find(x=>x.key==='a1:p1:NATIVE_BINDING_PROOF:'+b.scope.binding_id);if(!proof(b)||!pr||pr.phase!=='ATTESTED'||pr.scope_sha256!==await digest(b.scope)||pr.credential_sha256!==await rawHash(b.channel_credential)||pr.profile!==this.profile||pr.owner_context!==storedAggregate.owner_context||pr.executor_id!==storedAggregate.executor_id||pr.session_id!==storedAggregate.session_id||pr.content_instance!==b.scope.content_instance_id||pr.fence_epoch!==(rows.find(x=>x.key==='a1:owner-fence')?.epoch)||pr.registration_epoch!==b.registration_epoch)ok=false;else refs.push({binding_id:b.scope.binding_id,scope_sha256:pr.scope_sha256,proof_version:pr.record_version});}
   const deadline=Math.min(this.now()+5000,Date.parse(storedAggregate.time.last_trusted_at)+30000,state.session.member_admission?Date.parse(state.session.member_admission.command.execute_before):Infinity);if(ok&&deadline>this.now())bootWait={version:'NR01_1',transition_id:id(),phase:'VERIFYING',anchor_generation:bump(storedAggregate.generation),started_at:this.now(),deadline_at:deadline,last_seen_at:this.now(),boot:this.boot,profile:this.profile,old:refs,first_failure:null};
  }
  await this.updateBundle({state,a:await this.store.read('a1:aggregate:'+state.session.session_id),ownerFenceEpoch:(await this.store.read('a1:owner-fence'))?.epoch},({a,state:latest,rows,tx})=>{
   this.previousProfile=a.profile_epoch;a.boot_epoch=this.boot;a.profile_epoch=this.profile;for(const b of rows.filter(r=>r.record_kind==='A1_BINDING'&&r.scope.session_id===a.session_id&&r.resolution==='NONE')){b.ordinary_authority='INACTIVE';b.apply_closed=true;b.native_lifecycle='UNCONFIRMED';b.record_version=id();tx.objectStore('metadata').put(b);}
   for(const l of rows.filter(r=>r.record_kind==='CLEANUP_LEASE'&&r.session_id===a.session_id&&r.phase!=='COMPLETED')){l.phase='EXPIRED';l.record_version=id();tx.objectStore('metadata').put(l);}
   for(const o of rows.filter(r=>r.record_kind==='A1_OPERATION'&&r.phase==='IN_FLIGHT')){o.phase='IN_DOUBT';tx.objectStore('metadata').put(o);}
   if(bootWait){for(const r of bootWait.old){const pr=rows.find(x=>x.key==='a1:p1:NATIVE_BINDING_PROOF:'+r.binding_id);if(pr?.record_version!==r.proof_version)fail('GENERATION_CHANGED');}closeInterval(a,latest.session,latest.journal,tx);a.generation=bootWait.anchor_generation;a.native_transition=bootWait;a.session_status='NATIVE_VERIFYING';a.phase='REVALIDATING';a.intent='RECOVER';a.commit_fence=null;a.time.clock_quality='UNCONFIRMED';a.record_version=id();latest.session.status='NATIVE_VERIFYING';saveSession(tx,latest.session,latest.journal);tx.objectStore('metadata').put(a);}else{invalidateAggregate(a,latest.session,latest.journal,tx,marker.focurve_a1_profile?'WORKER_RECREATED':'PROCESS_STATE_LOST');}return a;
  });if(bootWait&&this.env.onNativeWait)await this.env.onNativeWait();
 }
 async enableTrial(){await this.ready;const owner=await this.env.owner();await this.env.guardStart(async()=>{const s=await this.env.db.load();if(s&&!terminal(s.session.status))fail('SESSION_ACTIVE');await this.store.atomic((tx,done)=>{tx.objectStore('metadata').put({key:'a1:trial',enabled:true});done(null);});await this.chrome.storage.local.set({focurve_a1_trial_ui:true});this.enabled=true;await this.fence(owner);});return true;}
 async fence(owner){return this.store.atomic((tx,done,reject)=>{const md=tx.objectStore('metadata'),q=md.get('a1:owner-fence');q.onsuccess=()=>{try{const existing=q.result;if(existing){if(existing.owner_context!==owner.owner_key||existing.transitioning)fail('OWNER_MISMATCH');done(existing.epoch);return;}const epoch=id();md.add({key:'a1:owner-fence',owner_context:owner.owner_key,epoch,transitioning:false});done(epoch);}catch(e){reject(e);}};});}
 async beforeAuthWrite(){if(!this.enabled)return;const state=await this.env.db.load();if(state&&!terminal(state.session.status))fail('GUEST_SESSION_ACTIVE');const owner=await this.env.owner();await this.store.atomic((tx,done)=>{tx.objectStore('metadata').put({key:'a1:owner-fence',owner_context:owner.owner_key,epoch:id(),transitioning:true});done(null);});}
 async afterAuthWrite(record){if(!this.enabled)return;const owner=await this.env.owner();await this.store.atomic((tx,done)=>{tx.objectStore('metadata').put({key:'a1:owner-fence',owner_context:['UNREGISTERED','REGISTERED'].includes(record.phase)?owner.owner_key:'MEMBER_OR_TRANSITION',epoch:id(),transitioning:!['UNREGISTERED','REGISTERED'].includes(record.phase)});done(null);});}
 async bundle({includeBindings=true}={}){const state=await this.env.db.load();if(!state||state.execution_contract!==VERSION)return null;const a=await this.store.read('a1:aggregate:'+state.session.session_id);if(!a||!valid(a,'aggregate'))fail('INVALID_TRANSITION_STATE');const owner=await this.env.owner();if(owner.owner_key!==a.owner_context||owner.installation_id!==a.executor_id||!same(await ref(state.session.snapshot),a.snapshot_ref))fail('OWNER_MISMATCH');return {state,a,ownerFenceEpoch:(await this.store.read('a1:owner-fence'))?.epoch,bindings:includeBindings?(await this.registry.rows()).filter(r=>r.record_kind==='A1_BINDING'&&r.scope.session_id===a.session_id):[]};}
 // State writers read the complete current tuple inside the same transaction.
 // A bundle is an expected-version token, never the Session/Journal put source.
 updateBundle(expected,work,{endIntent=false}={}){
  return this.store.atomic((tx,done,reject)=>{
   const all=tx.objectStore('metadata').getAll();all.onsuccess=()=>{
    const rows=all.result,a=rows.find(r=>r.key==='a1:aggregate:'+expected.state.session.session_id),fence=rows.find(r=>r.key==='a1:owner-fence'),current=rows.find(r=>r.key==='current');
    try{
     if(!a||!valid(a,'aggregate')||!current||current.execution_contract!==VERSION||current.session_id!==a.session_id||current.owner_key!==a.owner_context)fail('INVALID_TRANSITION_STATE');
     if(a.owner_context!==expected.state.session.owner_key||a.executor_id!==expected.state.session.executor_id||!same(a.snapshot_ref,expected.a.snapshot_ref)||!fence||fence.owner_context!==a.owner_context||fence.transitioning||fence.epoch!==expected.ownerFenceEpoch)fail('OWNER_MISMATCH');
     const sq=tx.objectStore('sessions').get([a.owner_context,a.session_id]),jq=tx.objectStore('journal').get([a.owner_context,a.session_id]);let session,journal,loaded=0;
     const finish=()=>{if(++loaded!==2)return;try{
      if(!session||!journal||session.execution_contract!==VERSION||session.executor_id!==a.executor_id||!same(session.snapshot,expected.state.session.snapshot)||session.status!==a.session_status||journal.revision!==a.desired_revision||journal.revision!==a.local_links.journal_revision||journal.action_seq!==a.local_links.journal_action_seq)fail('INVALID_TRANSITION_STATE');
      if(terminal(a.session_status)){done(structuredClone(a));return;}
      // Explicit END derives its intent from this latest tuple; it does not replay
      // an old outcome. All observation writers require the original exact CAS.
      if(!endIntent&&(a.record_version!==expected.a.record_version||a.generation!==expected.a.generation||a.session_revision!==expected.a.session_revision||a.desired_revision!==expected.a.desired_revision||journal.revision!==expected.state.journal.revision||journal.action_seq!==expected.state.journal.action_seq))fail('GENERATION_CHANGED');
      const result=work({a,state:{execution_contract:VERSION,session,journal},rows,tx});if(a.native_transition&&new TextEncoder().encode(JSON.stringify(a.native_transition)).length>8192)fail('STORE_CAPACITY');done(structuredClone(result));
     }catch(e){reject(e);}};
     sq.onsuccess=()=>{session=sq.result;finish();};jq.onsuccess=()=>{journal=jq.result;finish();};
    }catch(e){reject(e);}
   };
  });
 }
 async denyUnconfirmedNative(reason,tab,frames,snapshot){
  const top=(frames??[]).find(f=>f.frameId===0),observation={origin:'ROOT_CHROME_CENSUS',reason,observed_at:instant(),tab_id:tab.id,tab_status:tab.status??null,pending_url_present:!!tab.pendingUrl,tab_url_sha256:typeof tab.url==='string'?await rawHash(tab.url):null,pending_url_sha256:typeof tab.pendingUrl==='string'?await rawHash(tab.pendingUrl):null,frame:top?{frame_id:top.frameId,document_id:top.documentId??null,lifecycle:top.documentLifecycle??null,url_sha256:typeof top.url==='string'?await rawHash(top.url):null}:null,snapshot_ref:await ref(snapshot),authority_granted:false};
  this.firstNativeRevalidation??=structuredClone(observation);this.lastNativeRevalidation=structuredClone(observation);
  throw new Error('REVALIDATION_REQUIRED',{cause:{stage:'ROOT_NATIVE_CENSUS',native_observation:observation}});
 }
 nativeDocumentReady(d){
  // Same Root-owned readiness observation as the member path. It is not a
  // Content ACK, policy success, or permission to extend the native deadline.
  if(d?.frameId!==0||!Number.isInteger(d.tabId)||typeof d.documentId!=='string'||!d.documentId||d.documentId.length>128||d.tabId<0||d.documentLifecycle!=='active'||typeof d.url!=='string'||d.url.length>8192)return;
  let u;try{u=new URL(d.url);}catch{return;}if(u.protocol!=='https:'||!['youtube.com','www.youtube.com'].includes(u.hostname))return;
  const key=d.tabId+':'+d.documentId;this.nativeReadyDocs.delete(key);this.nativeReadyDocs.set(key,{url:d.url,boot:this.boot});while(this.nativeReadyDocs.size>32)this.nativeReadyDocs.delete(this.nativeReadyDocs.keys().next().value);this.requestCheck();
 }
 nativeDocumentReadyFor(t,f){const seen=this.nativeReadyDocs?.get(t.id+':'+f.documentId);return !t.pendingUrl&&seen?.boot===this.boot&&seen.url===f.url&&t.url===f.url;}
 async census(snapshot){const view=[],required=[];for(const t of await this.chrome.tabs.query({})){if(!Number.isInteger(t.id))continue;let frames;try{frames=await this.chrome.webNavigation.getAllFrames({tabId:t.id});}catch{if(this.env.policy.select(snapshot.sites,t.pendingUrl||t.url)?.feature_policies.some(f=>f.enabled))return this.denyUnconfirmedNative('NATIVE_API_ERROR',t,null,snapshot);continue;}
   const pendingSite=this.env.policy.select(snapshot.sites,t.pendingUrl||t.url);if(pendingSite?.access_policy!=='BLOCK'&&pendingSite?.feature_policies.some(p=>p.enabled)&&!t.discarded&&(!(frames??[]).some(f=>f.frameId===0&&f.documentId)||t.pendingUrl))return this.denyUnconfirmedNative(t.pendingUrl?'PENDING_URL':'MISSING_TOP_DOCUMENT',t,frames,snapshot);
   for(const f of frames??[]){if(!f.documentId)continue;const site=this.env.policy.select(snapshot.sites,f.url);if(!site?.feature_policies.some(p=>p.enabled)||site.access_policy==='BLOCK')continue;const u=new URL(f.url);
    if(f.documentLifecycle==='cached'){view.push({tabId:t.id,documentId:f.documentId,url:f.url,lifecycle:'cached'});continue;}
    if(f.documentLifecycle!=='active'||f.frameId!==0||u.protocol!=='https:'||!['youtube.com','www.youtube.com'].includes(u.hostname)){const rejected_fields=[];if(f.documentLifecycle!=='active')rejected_fields.push('document_lifecycle');if(f.frameId!==0)rejected_fields.push('frame_id');if(u.protocol!=='https:')rejected_fields.push('protocol');if(!['youtube.com','www.youtube.com'].includes(u.hostname))rejected_fields.push('hostname');throw new Error('UNSUPPORTED_POLICY',{cause:{stage:'NATIVE_CENSUS',rejected_fields,matched_policy_host:site.canonical_host,access_policy:site.access_policy,frame_id:f.frameId,protocol:u.protocol,hostname:u.hostname,document_lifecycle:f.documentLifecycle}});}
    // Require COMPLETE or exact boot-local Root DOMContentLoaded identity+URL.
    // Pending/changed URLs and every existing P1/effect/ACK check remain fenced.
    if(t.status==='loading'&&!this.nativeDocumentReadyFor(t,f))return this.denyUnconfirmedNative('LOADING',t,frames,snapshot);
    const item={tabId:t.id,frameId:0,documentId:f.documentId,url:f.url,lifecycle:'active',site_id:site.site_id};view.push(item);required.push({...item,site});
   }
  }view.sort((a,b)=>a.tabId-b.tabId||a.documentId.localeCompare(b.documentId));return {view,required,hash:await digest(view)};}
 async dnrVerified(state){const actual=await this.chrome.declarativeNetRequest.getSessionRules();return state.journal.rules.every(r=>actual.some(x=>same(x,r)));}
 async verifyNative(a){const state=await this.env.db.load();if(!state||state.session.session_id!==a.session_id||!this.watchReady||!this.snapshot||!same(await ref(state.session.snapshot),a.snapshot_ref))return false;preflight(state.session.snapshot,this.env.policy);const c=await this.census(state.session.snapshot),dnr=await this.dnrVerified(state)&&await digest(state.journal.rules)===a.commit_fence?.dnr_rules_sha256;if(!dnr)return false;if(c.hash!==a.commit_fence?.native_view_sha256&&this.nrEnabled(a)){const b=await this.bundle(),live=b?.bindings.filter(x=>x.resolution==='NONE')??[];if(b?.a.session_id===a.session_id&&b.a.owner_context===a.owner_context&&a.r0.length===live.length&&c.view.length===live.length&&live.every(x=>a.r0.includes(x.scope.binding_id)&&c.view.some(v=>v.tabId===x.scope.tab_id&&v.documentId===x.scope.document_id&&v.lifecycle==='active')))throw new Error('REVALIDATION_REQUIRED',{cause:{native_observation:{origin:'ROOT_CHROME_COMMIT_CENSUS',reason:'SAME_DOCUMENT_NATIVE_VIEW_CHANGED',observed_at:new Date(this.now()).toISOString(),authority_granted:false}}});if(this.nd01&&b?.a.document_transition_contract==='ND01_1'&&a.r0.length===live.length&&c.view.length>live.length&&c.view.length<=5&&c.view.every(v=>v.lifecycle==='active')&&live.every(x=>a.r0.includes(x.scope.binding_id)&&c.view.some(v=>v.tabId===x.scope.tab_id&&v.documentId===x.scope.document_id))&&!c.view.some(v=>live.some(x=>x.scope.tab_id===v.tabId&&x.scope.document_id!==v.documentId))&&await digest(c.view.filter(v=>live.some(x=>x.scope.tab_id===v.tabId&&x.scope.document_id===v.documentId)))===a.commit_fence.native_view_sha256)throw new Error('REVALIDATION_REQUIRED',{cause:{native_observation:{origin:'ROOT_CHROME_COMMIT_CENSUS',reason:'DOCUMENT_ADDITION_CANDIDATE',observed_at:new Date(this.now()).toISOString(),authority_granted:false}}});}return c.hash===a.commit_fence?.native_view_sha256;}
 async interruptedApplyCompleted(b,a,m,response){
  if(m.payload.operation!=='APPLY'||response?.status!=='ERROR'||response.error.code!=='REVALIDATION_REQUIRED')return false;
  const current=await this.bundle();if(!current||!this.nrPending(current.a)||current.a.intent==='END'||current.a.nr_first_failure||current.a.owner_context!==a.owner_context||current.a.executor_id!==a.executor_id||!same(current.a.snapshot_ref,a.snapshot_ref))return false;
  this.nrCheck(current.a);const op=await this.store.read('a1:operation:'+b.scope.binding_id+':'+m.payload.operation_id);
  if(!op||op.phase!=='COMPLETED'||!same(op.first_response,response)||!same(op.command,m))return false;
  const proof=await this.store.read('a1:p1:NATIVE_BINDING_PROOF:'+b.scope.binding_id),native=await this.p1.frame(b);
  if(!proof||proof.creation_boot!==this.boot||native.url_sha256===proof.native_url_sha256)return false;
  return this.nrNativeTransition(b,native);
 }
 // A request may consume only the remaining time of its existing NR fence.
 // Explicit END/cleanup outside NR keeps the original request timeout.
 nativeResponseBudget(a){if(this.nrPending(a)&&a.intent!=='END'){this.nrCheck(a);return {milliseconds:Math.min(5000,a.native_transition.deadline_at-this.now()),native:true};}return {milliseconds:5000,native:false};}
 nativeResponseTimeout(a,budget){return budget.native?Error('REVALIDATION_REQUIRED',{cause:{stage:'NATIVE_TRANSITION_GUARD',rejected_fields:['deadline_at'],transition_phase:a.native_transition.phase}}):Error('STORE_UNCONFIRMED');}
 async dispatch(b,a,m){const apply=m.payload.operation==='APPLY';if(apply)this.nrCheck(a);await this.registry.issue(b,m);if(apply)this.nrCheck(a);const responseBudget=this.nativeResponseBudget(a);let response,timer;try{response=await Promise.race([this.chrome.tabs.sendMessage(b.scope.tab_id,m,{documentId:b.scope.document_id}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(this.nativeResponseTimeout(a,responseBudget)),responseBudget.milliseconds);})]);}finally{clearTimeout(timer);}if(responseBudget.native)this.nrCheck(a);if(!valid(response,response?.status==='OK'?'control_ok':'error')||response.request_id!==m.request_id)fail('INVALID_CURRENT_RESPONSE');if(response.status==='ERROR'){if(await this.interruptedApplyCompleted(b,a,m,response)){this.requestCheck();return null;}fail(response.error.code);}if(response.data.operation_id!==m.payload.operation_id||!same(response.data.scope,b.scope))fail('SCOPE_MISMATCH');const recorded=await this.store.read('a1:operation:'+b.scope.binding_id+':'+m.payload.operation_id);if(!recorded?.first_response||!same(recorded.first_response,response))fail('STORE_UNCONFIRMED');return response;}
 async release(b,a,cleanup,ownerFenceEpoch,selectedOperationId=null){
  // Internal explicit recovery only; automatic callers never select among
  // legacy pending commands. No public message or storage capability is added.
  const p1Proof=this.p1&&await this.store.read('a1:p1:NATIVE_BINDING_PROOF:'+b.scope.binding_id);
  const op=await this.registry.issue(b,control(b,a,'RELEASE',p1Proof?true:cleanup),{reuseCleanup:true,ownerFenceEpoch,selectedOperationId,aggregateRecordVersion:a.record_version});
  const original=structuredClone(op.command);delete original.request_id;
  if(await digest(original)!==op.fingerprint)fail('OPERATION_CONFLICT');
  if(['IN_FLIGHT','IN_DOUBT'].includes(op.phase))fail('STORE_UNCONFIRMED');
  if(op.phase==='RESULT_EVICTED')fail('OPERATION_RESULT_EVICTED');
  if(op.phase==='COMPLETED'){
   const r=op.first_response;
   if(!r)fail('OPERATION_RESULT_EVICTED');
   if(r.status==='ERROR')fail(r.error.code);
   if(!valid(r,'control_ok')||r.request_id!==op.command.request_id||!same(r.data.scope,b.scope)||r.data.operation_id!==op.operation_id||r.data.operation!=='RELEASE'||r.data.result_state!=='RELEASED'||!releaseConfirmed(r.data.release_evidence))fail('STORE_UNCONFIRMED');
   return r;
  }
  if(op.phase!=='ISSUED')fail('STORE_UNCONFIRMED');
  if(p1Proof){if(this.d1&&b.ordinary_authority!=='ACTIVE')await this.p1.attest(await this.store.read(b.key),{revalidate:true});await this.p1.lease(await this.store.read(b.key),op);}
  return this.dispatch(b,a,structuredClone(op.command));
 }
 async receiverDigest(){this.receiverHash??=rawHash(await (await fetch(this.chrome.runtime.getURL('a1/content.bundle.js'))).text());return this.receiverHash;}
 async bootstrap(b){
  await this.chrome.scripting.executeScript({target:{tabId:b.scope.tab_id,documentIds:[b.scope.document_id]},files:['a1/content.bundle.js']});
  const config={bootstrap_kind:'WORKER_NATIVE_INJECTION',protocol_version:VERSION,scope:b.scope,registration_id:b.registration_id,registration_epoch:b.registration_epoch,channel_credential:b.channel_credential,projection:b.projection,rule_id:'feature:'+b.scope.snapshot_ref.policy_snapshot_id+':'+b.projection.site_id+':YOUTUBE_SHORTS',cleanup_authorization_id:b.cleanup_authorization_id};
  const results=await this.chrome.scripting.executeScript({target:{tabId:b.scope.tab_id,documentIds:[b.scope.document_id]},func:c=>globalThis.__focurveA1Content?.instance===c.scope.content_instance_id?c.scope.content_instance_id:globalThis.__focurveA1Install(c),args:[config]});if(results.length!==1||results[0].documentId!==b.scope.document_id||results[0].result!==b.scope.content_instance_id)fail('SCOPE_MISMATCH');if(this.p1){const proof=await this.store.read('a1:p1:NATIVE_BINDING_PROOF:'+b.scope.binding_id);if(proof)await this.p1.attest(b,{revalidate:proof.phase==='ATTESTED'});}return this.registry.ready(b);
 }
 async prepare(a,item){let b=binding(a,item,item.site);
  try{a=await this.store.reserve(b,a.record_version,await this.fence(await this.env.owner()));}catch(e){
   // A failed reservation transaction has made no native effect or durable binding.
   // Replan once from the current tuple, never replay the stale CAS or credential.
   if(['INACTIVE_SCOPE','STALE_AGGREGATE'].includes(e.message)){const fresh=await this.bundle();if(fresh&&this.dom?.pending(fresh.a)&&fresh.a.session_id===a.session_id&&fresh.a.owner_context===a.owner_context&&fresh.a.executor_id===a.executor_id&&same(fresh.a.snapshot_ref,a.snapshot_ref)&&fresh.ownerFenceEpoch===await this.fence(await this.env.owner())&&(!a.commit_fence||a.commit_fence.owner_fence_epoch===fresh.ownerFenceEpoch)){this.dom.check(fresh.a);this.requestCheck();return null;}}if(e.message!=='STALE_AGGREGATE')throw e;
   const fresh=await this.bundle();
   if(!fresh||fresh.a.intent==='END'||terminal(fresh.a.session_status))fail('END_WINS');
   if(fresh.a.session_id!==a.session_id||fresh.a.owner_context!==a.owner_context||fresh.a.executor_id!==a.executor_id||fresh.a.desired_revision!==a.desired_revision||!same(fresh.a.snapshot_ref,a.snapshot_ref))fail('STALE_AGGREGATE');
   const native=(await this.census(fresh.state.session.snapshot)).required.find(f=>f.tabId===item.tabId&&f.documentId===item.documentId&&f.url===item.url&&f.lifecycle===item.lifecycle&&same(f.site,item.site));
   if(!native)fail('REVALIDATION_REQUIRED');
   b=binding(fresh.a,native,native.site);a=await this.store.reserve(b,fresh.a.record_version,fresh.ownerFenceEpoch);
  }
  b=await this.bootstrap(b);const latest=(await this.bundle()).a;if(latest.intent!=='END'&&b.ordinary_authority==='ACTIVE')await this.dispatch(b,latest,control(b,latest,'QUERY'));return b;
 }
 start(minutes,requestId){return this.serial(async()=>{await this.ready;if(!this.enabled)fail('UNSUPPORTED_POLICY');if(!Number.isInteger(minutes)||minutes<1||minutes>180||typeof requestId!=='string'||!/^[0-9a-f-]{36}$/i.test(requestId))fail('INVALID_SCHEMA');const replay=await this.env.db.byRequest(requestId);if(replay){if(replay.execution_contract!==VERSION||replay.session.duration_minutes!==minutes)fail('OPERATION_CONFLICT');if(replay.session.owner_key!==(await this.env.owner()).owner_key)fail('OWNER_MISMATCH');const current=await this.env.db.load();return current?.session.session_id===replay.session.session_id?this.reconcile():replay;}
   const owner=await this.env.owner(),settings=await this.env.sites.list(),snapshot=await (this.limitedProduct11?makeGuestSnapshot:makeTrialSnapshot)({owner,sites:settings.items,sourceVersion:settings.settings_version,createdAt:instant(),contentPolicy:settings.content_policy,limitedProduct11:this.limitedProduct11},this.env.policy);this.snapshot=structuredClone(snapshot);
   const epoch=await this.fence(owner),session={owner_key:owner.owner_key,session_id:id(),executor_id:owner.installation_id,start_request_id:requestId,interval_id:id(),duration_minutes:minutes,last_local_seq:0,last_access_seq:0,status:'STARTING',started_at:null,ended_at:null,expires_at:null,active_duration_ms:0,overrun_ms:0,record_status:'PENDING',snapshot,last_error_code:null,execution_contract:VERSION};const journal={owner_key:owner.owner_key,session_id:session.session_id,revision:1,action_seq:1,desired:'APPLIED',observed:'UNCONFIRMED',rules:this.env.policy.rules(snapshot.sites,await this.chrome.declarativeNetRequest.getSessionRules(),site=>this.chrome.runtime.getURL('blocked/blocked.html')+'?host='+encodeURIComponent(site.canonical_host)+'&session='+encodeURIComponent(session.session_id),100000,true)};let a=aggregate(session,await ref(snapshot),{boot:this.boot,profile:this.profile});if(this.nr01)a.native_transition_contract='NR01_1';if(this.dp01)a.dom_transition_contract=DP;if(this.nd01)a.document_transition_contract='ND01_1';if(this.d1b5)a.cleanup_budget={operation_capacity:160,write_capacity:320};a.owned_dnr_rule_ids=journal.rules.map(r=>r.id);await this.store.begin({session,journal},a,{ownerFenceEpoch:epoch});
   try{for(const r of journal.rules)if(!(await this.chrome.declarativeNetRequest.isRegexSupported({regex:r.condition.regexFilter,isCaseSensitive:false})).isSupported)throw new Error('UNSUPPORTED_POLICY',{cause:{stage:'DNR_REGEX',rejected_fields:['isRegexSupported'],rule_id:r.id}});if(journal.rules.length)await this.guardedDnrUpdate({session,journal},{addRules:journal.rules},true);await this.divert({session,journal});return await this.reconcile();}
   catch(e){await this.markUnknown(e.message,'START_APPLY_FAILED');await this.endIntent(session.session_id,'SYSTEM_START_FAILURE');try{await this.finish();}catch{}throw e;}
  });}
 async divert(state){for(const tab of await this.chrome.tabs.query({})){const site=this.env.policy.select(state.session.snapshot.sites,tab.pendingUrl||tab.url);if(site?.access_policy!=='BLOCK')continue;const url=this.chrome.runtime.getURL('blocked/blocked.html')+'?host='+encodeURIComponent(site.canonical_host)+'&session='+encodeURIComponent(state.session.session_id);await this.chrome.tabs.update(tab.id,{url});let seen=false;for(let i=0;i<30;i++){const t=(await this.chrome.tabs.query({})).find(x=>x.id===tab.id);if(!t||t.url===url){seen=true;break;}await new Promise(r=>setTimeout(r,100));}if(!seen)fail('REVALIDATION_REQUIRED');}}
 async markUnknown(code,cause='RESPONSE_UNCONFIRMED',relatedCode=null){const bundle=await this.bundle();if(!bundle)return;return this.updateBundle(bundle,({a,state,tx})=>{const diagnostic=code.replace(/[^A-Z_]/g,'_');const related=typeof relatedCode==='string'&&/^[A-Z][A-Z_]{0,63}$/.test(relatedCode)?relatedCode:null;a.diagnostic_codes=[...new Set([...a.diagnostic_codes,...(related?[related]:[]),diagnostic])].slice(-32);state.session.last_error_code=diagnostic;invalidateAggregate(a,state.session,state.journal,tx,cause);return a;});}
 async reachable(b){try{return (await this.chrome.webNavigation.getAllFrames({tabId:b.scope.tab_id}))?.some(f=>f.frameId===0&&f.documentId===b.scope.document_id&&f.documentLifecycle==='active');}catch{return false;}}
 async guardedDnrUpdate(suppliedState,suppliedRequest,applying=false){
  const state=structuredClone(suppliedState),request=structuredClone(suppliedRequest);
  // Isolated source consumers retain their existing adapter. The shipped Worker
  // supplies dnrWriter before Guest A1 is constructed (tested in the bundle).
  if(typeof this.env.dnrWriter!=='function')return this.chrome.declarativeNetRequest.updateSessionRules(request);
  const observed=await this.bundle({includeBindings:false});
  if(!observed||observed.a.session_id!==state.session.session_id||observed.a.owner_context!==state.session.owner_key||observed.a.executor_id!==state.session.executor_id||!same(observed.state.session.snapshot,state.session.snapshot)||!same(observed.state.journal.rules,state.journal.rules))fail('OWNER_MISMATCH');
  return this.env.dnrWriter(request,async send=>{
   const actual=await this.chrome.declarativeNetRequest.getSessionRules();
   for(const r of request.addRules??[]){if(!state.journal.rules.some(x=>same(x,r))||actual.some(x=>x.id===r.id&&!same(x,r)))fail('OWNER_MISMATCH');}
   for(const id of request.removeRuleIds??[]){const expected=state.journal.rules.find(r=>r.id===id);if(!expected||actual.some(x=>x.id===id&&!same(x,expected)))fail('OWNER_MISMATCH');}
   // A pre-lock bundle/fence is not current Guest authority. Re-read identity
   // while holding the DNR lock; a synchronous auth-write token fences the IDB
   // await that follows. Removal-only cleanup keeps its original exact scope.
   const adding=(request.addRules?.length??0)>0;
   const authority=adding?this.env.dnrAuthorityState?.():null;
   if(adding){
    if(authority?.pending)fail('OWNER_MISMATCH');
    await this.env.assertDnrApply?.();
    const owner=await this.env.owner();
    if(owner.owner_key!==state.session.owner_key||owner.installation_id!==state.session.executor_id)fail('OWNER_MISMATCH');
   }
   let reason;
   try{return await this.env.db.transaction('readonly',(tx,done)=>{
    const md=tx.objectStore('metadata'),keys=['current','a1:aggregate:'+state.session.session_id,'a1:owner-fence'],rows={};let pending=keys.length+2;
    const reject=e=>{reason=e;tx.abort();};
    const finish=()=>{if(--pending)return;try{
     const a=rows[keys[1]],f=rows['a1:owner-fence'],c=rows.current;
     if(!a||!c||c.execution_contract!==VERSION||!f||f.transitioning||f.epoch!==observed.ownerFenceEpoch||f.owner_context!==state.session.owner_key||c.owner_key!==state.session.owner_key||c.session_id!==state.session.session_id||!same(a,observed.a)||!same(rows.session,observed.state.session)||!same(rows.journal,observed.state.journal))fail('GENERATION_CHANGED');
     if(applying){
      this.nrCheck(a);this.dom?.check(a);
      if(a.intent==='END'||terminal(a.session_status)||rows.journal.desired!=='APPLIED')fail('END_WINS');
     }
     if(adding&&typeof this.env.dnrAuthorityState==='function'&&(authority?.pending||this.env.dnrAuthorityState()!==authority))fail('OWNER_MISMATCH');
     // Linearize dispatch inside the same readonly snapshot as current/END/fence.
     // send boxes its Promise, so neither this transaction nor owner END waits for Chrome.
     done(send());
    }catch(e){reject(e);}};
    for(const key of keys){const q=md.get(key);q.onsuccess=()=>{rows[key]=q.result;finish();};}
    for(const [name,store] of [['session','sessions'],['journal','journal']]){const q=tx.objectStore(store).get([state.session.owner_key,state.session.session_id]);q.onsuccess=()=>{rows[name]=q.result;finish();};}
   });}catch(e){throw reason??e;}
  });
 }
 async releaseDnr(state){const actual=await this.chrome.declarativeNetRequest.getSessionRules();for(const r of state.journal.rules){const found=actual.find(x=>x.id===r.id);if(found&&!same(found,r))fail('OWNER_MISMATCH');}if(state.journal.rules.length)await this.guardedDnrUpdate(state,{removeRuleIds:state.journal.rules.map(x=>x.id)});}
 async suspend(cause='RUNTIME_APPLY_FAILED'){const b=await this.bundle();if(!b||b.a.intent==='END')return;await this.releaseDnr(b.state);await this.updateBundle(b,({a,state,rows,tx})=>{for(const row of rows.filter(r=>r.record_kind==='A1_BINDING'&&r.scope.session_id===a.session_id&&r.resolution==='NONE')){row.ordinary_authority='INACTIVE';row.apply_closed=true;row.record_version=id();tx.objectStore('metadata').put(row);}invalidateAggregate(a,state.session,state.journal,tx,cause);return a;});}
 async cleanupInactive(bundle){for(let b of bundle.bindings.filter(r=>r.resolution==='NONE'&&r.ordinary_authority!=='ACTIVE').sort((a,b)=>Number(a.readiness==='PROVISIONAL')-Number(b.readiness==='PROVISIONAL'))){const current=await this.store.read(b.key);if(this.documentRetirement&&current?.resolution==='GONE_NATIVE'){await this.d1.verifyResolved(await this.bundle());continue;}if(!await this.reachable(b)){if(this.documentRetirement&&await this.d1.committedReplacement(await this.bundle(),b))continue;fail('CLEANUP_REQUIRED');}try{if(b.readiness==='PROVISIONAL')b=await this.bootstrap(b);const latest=await this.bundle();await this.release(b,latest.a,true,latest.ownerFenceEpoch);}catch(e){throw new Error('CLEANUP_REQUIRED',{cause:e});}}}
 async reconcile(){await this.ready;let bundle=await this.bundle();if(!bundle||terminal(bundle.state.session.status))return bundle?.state??null;if(bundle.a.intent==='END')return this.finish();
  if(this.dom?.pending(bundle.a)){if(!await this.dom.finish(bundle))return bundle.state;bundle=await this.bundle();}if(this.nrEnabled(bundle.a)&&(bundle.a.nr_first_failure||bundle.a.native_transition?.phase==='FAILED'))return bundle.state;this.nrCheck(bundle.a);if(this.documentRetirement&&this.d1.replacementPending())return bundle.state;if(this.nrPending(bundle.a)&&this.nrReportPending)return bundle.state;
  const owner=await this.env.owner();await this.fence(owner);this.snapshot=structuredClone(bundle.state.session.snapshot);preflight(this.snapshot,this.env.policy);
  // Deny impossible fresh coverage before consuming any original cleanup budget.
  // END is handled above; old owner reservations are still checked atomically in reserve.
  const capacity=capacityProfile(await this.registry.rows(),bundle.a,this.d1b5);let initialCensus;try{initialCensus=await this.census(this.snapshot);}catch(e){if(e.message==='REVALIDATION_REQUIRED')await this.cleanupInactive(bundle);throw e;}if(initialCensus.required.length>(capacity?.max_documents??4))fail('CLEANUP_CAPACITY');
  if(await this.ndBegin(bundle,initialCensus))return this.env.db.load();if(this.p1)bundle=await this.p1.transitions(bundle);bundle=await this.bundle();if(this.dom?.pending(bundle.a)){this.dom.check(bundle.a);this.requestCheck();return bundle.state;}await this.cleanupInactive(bundle);bundle=await this.bundle();const census=await this.census(this.snapshot);
  if(!await this.dnrVerified(bundle.state)){if(bundle.a.session_status!=='UNKNOWN')fail('REVALIDATION_REQUIRED');const rules=await this.chrome.declarativeNetRequest.getSessionRules();for(const r of bundle.state.journal.rules){const existing=rules.find(x=>x.id===r.id);if(existing&&!same(existing,r))fail('OWNER_MISMATCH');}const missing=bundle.state.journal.rules.filter(r=>!rules.some(x=>same(x,r)));if(missing.length)await this.guardedDnrUpdate(bundle.state,{addRules:missing},true);await this.divert(bundle.state);}
  // Old/cached bindings remain cleanup obligations; absence is not GONE.
  const gone=bundle.bindings.filter(b=>b.resolution==='NONE'&&b.ordinary_authority==='ACTIVE'&&!census.required.some(f=>f.documentId===b.scope.document_id&&f.tabId===b.scope.tab_id));
  if(gone.length){await this.invalidate('DOCUMENT_REPLACED',null);fail('CLEANUP_REQUIRED');}
  this.ndCensusCheck(bundle,census);await this.nrStage('FRESH_ATTEST');
  for(const item of census.required){bundle=await this.bundle();if(!bundle.bindings.some(b=>b.resolution==='NONE'&&b.ordinary_authority==='ACTIVE'&&b.scope.document_id===item.documentId&&b.scope.tab_id===item.tabId)){if(this.dom?.pending(bundle.a)){this.dom.check(bundle.a);this.requestCheck();return bundle.state;}if(!await this.prepare(bundle.a,item))return this.env.db.load();}}
  bundle=await this.bundle();if(bundle.a.intent==='END')return this.finish();if(this.dom?.pending(bundle.a)){this.dom.check(bundle.a);this.requestCheck();return bundle.state;}const required=census.required.map(f=>bundle.bindings.find(b=>b.resolution==='NONE'&&b.ordinary_authority==='ACTIVE'&&b.scope.document_id===f.documentId&&b.scope.tab_id===f.tabId));
  if(required.some(b=>!b))fail('GENERATION_CHANGED');
  // Native census can await while END commits outside the execution queue.
  // Observe its durable intent atomically; no APPLY bookkeeping is written after END.
  const endWon=await this.registry.update((rows,tx)=>{const a=rows.find(r=>r.key===bundle.a.key);if(a.intent==='END')return true;a.r0=required.map(b=>b.scope.binding_id);a.no_target=required.length===0;tx.objectStore('metadata').put(a);return false;});
  if(endWon)return this.finish();
  await this.nrStage('FRESH_APPLY');
  for(let b of required){const current=await this.store.read(b.key),a=(await this.bundle()).a,nativeSeen=this.registry.proofs.get(current.scope.binding_id);if(a.session_status==='RUNNING'&&proof(current)&&current.evidence_generation===a.generation&&nativeSeen&&Date.now()-nativeSeen.at<=35000)continue;const response=await this.dispatch(current,a,control(current,a,current.cleanup_pending?'QUERY':'APPLY'));const afterDispatch=await this.bundle();if(response===null){if(!this.nrPending(afterDispatch.a))fail('REVALIDATION_REQUIRED');this.requestCheck();return afterDispatch.state;}if(this.nrPending(afterDispatch.a)&&afterDispatch.a.generation!==a.generation){this.requestCheck();return this.env.db.load();}if(!['APPLIED','COVERED','NOT_APPLICABLE'].includes(response.data.result_state)){await this.markUnknown('INVALID_EFFECT_EVIDENCE','RUNTIME_APPLY_FAILED');fail('INVALID_EFFECT_EVIDENCE');}if(this.dom?.pending(afterDispatch.a)||this.dom?.active(afterDispatch.a)&&afterDispatch.a.generation!==a.generation){this.dom.check(afterDispatch.a);this.requestCheck();return this.env.db.load();}}
  bundle=await this.bundle();if(bundle.a.intent==='END')return this.finish();if(this.dom?.pending(bundle.a)){this.dom.check(bundle.a);this.requestCheck();return bundle.state;}const fresh=await this.census(this.snapshot);if(fresh.hash!==census.hash){if(await this.nrCensusTransition(census,fresh,bundle))return this.env.db.load();await this.markUnknown('GENERATION_CHANGED');fail('GENERATION_CHANGED');}
  if(!bundle.a.r0.every(bid=>{const b=bundle.bindings.find(x=>x.scope.binding_id===bid);return b&&proof(b)&&b.evidence_generation===bundle.a.generation;})){await this.markUnknown('RUNNING_GATE_DENIED');fail('RUNNING_GATE_DENIED');}
  const old=structuredClone(bundle.a),a=bundle.a,state=bundle.state,wall=this.now(),monotonic=this.mono();
  if(this.clock&&Math.abs((wall-this.clock.wall)-(monotonic-this.clock.mono))>2000){await this.markUnknown('REVALIDATION_REQUIRED');this.clock=null;fail('REVALIDATION_REQUIRED');}
  const at=new Date(wall).toISOString();let interval=null,event=null;
  this.nrCheck(a);if(a.session_status==='RUNNING'&&a.time.last_trusted_at){const delta=wall-Date.parse(a.time.last_trusted_at);if(delta<0||delta>30000){await this.markUnknown('REVALIDATION_REQUIRED');fail('REVALIDATION_REQUIRED');}a.time.confirmed_run_ms+=delta;}
  if(!a.time.open_interval_id){const iid=id();a.time.open_interval_id=iid;a.local_links.interval_ids.push(iid);interval={owner_key:a.owner_context,session_id:a.session_id,interval_id:iid,kind:'RUN',start_at:at,end_at:null,duration_ms:null,quality:'CONFIRMED'};if(!state.session.started_at){state.session.started_at=at;state.session.last_local_seq++;event=this.event(state.session,'SESSION_STARTED');a.local_links.first_started_event_id=event.event_id;}}
  a.time.last_trusted_at=at;a.time.clock_quality='VERIFIED';a.time.active_duration_ms=Math.min(a.time.target_ms,a.time.confirmed_run_ms);a.time.overrun_ms=Math.max(0,a.time.confirmed_run_ms-a.time.target_ms);a.time.remaining_ms=Math.max(0,a.time.target_ms-a.time.confirmed_run_ms);a.time.planned_end_at=new Date(wall+a.time.remaining_ms).toISOString();if(this.nrPending(a)){a.native_transition.phase='CONFIRMED';a.native_transition.last_seen_at=wall;}if(a.effect_transition?.phase==='READY'){this.dom.check(a);a.effect_transition.phase='CONFIRMED';}a.phase='RUNNING';a.session_status='RUNNING';a.cause='NONE';a.record_version=id();a.session_revision=bump(a.session_revision);a.commit_fence={commit_id:id(),expected_record_version:a.record_version,expected_session_revision:a.session_revision,expected_generation:a.generation,owner_fence_epoch:await this.fence(owner),native_view_sha256:fresh.hash,dnr_rules_sha256:await digest(state.journal.rules),checked_at:at,route_guard_ready:this.watchReady,policy_preflight_verified:true,dnr_verified:true,prepared_commit_recheck_verified:true};a.local_links.record_status=a.local_links.record_status==='PENDING'?'PARTIAL':a.local_links.record_status;
  state.session.status='RUNNING';state.session.last_confirmed_at=at;state.session.planned_end_at=a.time.planned_end_at;state.session.active_duration_ms=a.time.active_duration_ms;state.session.overrun_ms=a.time.overrun_ms;state.journal.observed='APPLIED';
  await this.store.commitBundle({aggregate:a,session:state.session,journal:state.journal,interval,event,expectedRecordVersion:old.record_version,expectedRevision:old.session_revision,expectedGeneration:old.generation,ownerFenceEpoch:a.commit_fence.owner_fence_epoch});
  if(a.native_transition?.phase==='CONFIRMED'&&old.native_transition?.phase!=='CONFIRMED')this.traceNative('LOCAL_CONFIRMED',{a,state});
  if(!await this.verifyNative(a)){const current=await this.bundle(),observed=await this.census(this.snapshot);if(await this.nrCensusTransition(fresh,observed,current))return this.env.db.load();await this.markUnknown('GENERATION_CHANGED');fail('GENERATION_CHANGED');}if(a.native_transition?.phase==='CONFIRMED'&&old.native_transition?.phase!=='CONFIRMED'&&this.env.onNativeConfirmed)await this.env.onNativeConfirmed();if(a.effect_transition?.phase==='CONFIRMED'&&old.effect_transition?.phase!=='CONFIRMED'&&this.env.onEffectConfirmed)await this.env.onEffectConfirmed();this.clock={wall,mono:monotonic};await this.chrome.alarms.create('focurve-a1-check',{when:wall+5000});if(a.time.remaining_ms===0){await this.endIntent(a.session_id,'TIME_LIMIT');return this.finish();}return this.env.db.load();
 }
 event(s,type){const eid=id();return {owner_key:s.owner_key,event_id:eid,session_id:s.session_id,ack:false,payload:{schema_version:'1.1',event_id:eid,executor_id:s.executor_id,session_id:s.session_id,policy_snapshot_id:s.snapshot.policy_snapshot_id,event_type:type,occurred_at:type==='SESSION_ENDED'&&s.ended_at?s.ended_at:type==='SESSION_STARTED'&&s.started_at?s.started_at:instant(),local_seq:s.last_local_seq,payload:{}}};}
 async endIntent(sessionId,origin='USER_END'){const releaseTransition=this.p1?.holdTransition();try{const bundle=await this.bundle();if(!bundle||bundle.a.session_id!==sessionId)fail('SESSION_NOT_FOUND');return await this.updateBundle(bundle,({a,state,tx})=>{if(origin==='USER_END'&&state.session.status==='STARTING')fail('INVALID_TRANSITION');if(terminal(a.session_status)||a.intent==='END'&&(a.end_origin===origin||a.end_origin==='USER_END'))return a;closeInterval(a,state.session,state.journal,tx);a.intent='END';if(a.effect_transition&&['VERIFYING','READY'].includes(a.effect_transition.phase))a.effect_transition.phase='CANCELLED';if(origin==='USER_END'||!a.end_origin)a.end_origin=origin;a.phase='ENDING';a.session_status='ENDING';a.cause=origin==='USER_END'?'USER_END':origin==='TIME_LIMIT'?'TIME_LIMIT':'START_APPLY_FAILED';a.commit_fence=null;a.generation=bump(a.generation);a.session_revision=bump(a.session_revision);a.desired_revision=bump(a.desired_revision);a.record_version=id();a.cleanup_pending=true;state.session.status='ENDING';state.journal.desired='RELEASED';state.journal.revision=a.desired_revision;state.journal.action_seq=bump(state.journal.action_seq);a.local_links.journal_revision=a.desired_revision;a.local_links.journal_action_seq=state.journal.action_seq;tx.objectStore('metadata').put(a);saveSession(tx,state.session,state.journal);return a;},{endIntent:true});}finally{try{await this.p1?.refreshExecuting(null);}finally{releaseTransition?.();}}}
 end(sessionId){return this.endIntent(sessionId).then(()=>this.serial(()=>this.finish()));}
 async finish(){let bundle=await this.bundle();if(!bundle)return null;const state=bundle.state;if(terminal(state.session.status))return state;
  const actual=await this.chrome.declarativeNetRequest.getSessionRules();for(const r of state.journal.rules){const found=actual.find(x=>x.id===r.id);if(found&&!same(found,r))fail('OWNER_MISMATCH');}if(state.journal.rules.length)await this.guardedDnrUpdate(state,{removeRuleIds:state.journal.rules.map(x=>x.id)});if((await this.chrome.declarativeNetRequest.getSessionRules()).some(x=>state.journal.rules.some(r=>r.id===x.id)))fail('REVALIDATION_REQUIRED');
  for(let b of bundle.bindings.filter(x=>x.resolution==='NONE').sort((a,b)=>Number(a.readiness==='PROVISIONAL')-Number(b.readiness==='PROVISIONAL'))){if(!await this.reachable(b))return this.env.db.load();try{if(b.readiness==='PROVISIONAL')b=await this.bootstrap(b);const latest=await this.bundle();await this.release(b,latest.a,b.ordinary_authority!=='ACTIVE'||b.control_seq===Number.MAX_SAFE_INTEGER,latest.ownerFenceEpoch);}catch(e){await this.markUnknown(e.message);return this.env.db.load();}}
  bundle=await this.bundle();if(bundle.bindings.some(b=>b.cleanup_pending||b.resolution==='NONE'))fail('CLEANUP_REQUIRED');if(this.d1)await this.d1.verifyResolved(bundle);const old=structuredClone(bundle.a),a=bundle.a,s=bundle.state.session,j=bundle.state.journal,at=instant();a.cleanup_pending=false;a.phase=a.end_origin==='SYSTEM_START_FAILURE'&&!s.started_at?'START_FAILED':'ENDED';a.session_status=a.phase;a.time.open_interval_id=null;a.time.planned_end_at=null;a.commit_fence=null;a.record_version=id();s.status=a.session_status;s.ended_at??=at;s.policy_released_at=at;s.expires_at=new Date(Date.parse(s.ended_at)+30*86400000).toISOString();s.record_status='PARTIAL';a.local_links.expires_at=s.expires_at;a.local_links.record_status='PARTIAL';j.observed='RELEASED';s.last_local_seq++;const event=this.event(s,'SESSION_ENDED');await this.store.commitBundle({aggregate:a,session:s,journal:j,event,expectedRecordVersion:old.record_version,expectedRevision:old.session_revision,expectedGeneration:old.generation,ownerFenceEpoch:await this.fence(await this.env.owner())});await this.chrome.alarms.clear('focurve-a1-check');return this.env.db.load();
 }
 async invalidate(cause,tabId=null,documentId=null,selection=null){if(this.d1&&cause==='TAB_REMOVED')fail('UNAUTHORIZED_SENDER');const releaseTransition=this.p1?.holdTransition();try{await this.ready;const bundle=await this.bundle();if(!bundle||terminal(bundle.state.session.status))return;await this.updateBundle(bundle,({a,state,rows,tx})=>{if(selection&&a.session_id!==selection.session)fail('GENERATION_CHANGED');const affected=rows.filter(x=>x.record_kind==='A1_BINDING'&&x.scope.session_id===a.session_id&&x.resolution==='NONE'&&(!selection||selection.bindingIds.includes(x.scope.binding_id))&&(tabId===null||x.scope.tab_id===tabId));if(tabId!==null&&affected.length===0)return a;for(const b of affected){b.ordinary_authority='INACTIVE';b.apply_closed=true;b.native_lifecycle='UNCONFIRMED';if(cause==='TAB_REMOVED'){b.resolution='GONE_NATIVE';b.native_resolution_event='TAB_REMOVED';b.native_lifecycle='GONE';b.cleanup_pending=false;}b.record_version=id();tx.objectStore('metadata').put(b);}a.generation=bump(a.generation);invalidateAggregate(a,state.session,state.journal,tx,cause==='BFCACHE'?'BFCACHE':'RESPONSE_UNCONFIRMED');return a;});this.clock=null;this.requestCheck();}finally{try{await this.p1?.refreshExecuting(tabId);}finally{releaseTransition?.();}}}
 async unchangedHistory(d,seen){
  // This is an observation filter, not a new Sender/cleanup authorization path.
  // Only a no-op history replacement in the already committed native census
  // may keep existing authority. Missing proof or any debt takes the old path.
  try{
   if(d.documentLifecycle!=='active'||!d.documentId||!seen.a.commit_fence||seen.a.session_status!=='RUNNING'||seen.a.intent==='END')return false;
   const live=seen.bindings.filter(b=>b.resolution==='NONE');
   const fresh=b=>proof(b)&&!b.apply_closed&&b.evidence_generation===seen.a.generation&&Date.now()-(this.registry.proofs.get(b.scope.binding_id)?.at??0)<=35000;
   if(!live.length||live.some(b=>!fresh(b))||seen.a.r0.length!==live.length||live.some(b=>!seen.a.r0.includes(b.scope.binding_id)))return false;
   const c=await this.census(seen.state.session.snapshot);
   if(c.hash!==seen.a.commit_fence.native_view_sha256||!c.required.some(f=>f.tabId===d.tabId&&f.documentId===d.documentId&&f.url===d.url))return false;
   if(!await this.verifyNative(seen.a))return false;
   const checked=await this.updateBundle(seen,({a,rows})=>{
    if(a.intent==='END'||a.session_status!=='RUNNING')return false;
    const current=rows.filter(b=>b.record_kind==='A1_BINDING'&&b.scope.session_id===a.session_id&&b.resolution==='NONE');
    if(current.length!==live.length||current.some(b=>{
     const old=live.find(x=>x.key===b.key);if(!old||!same(b.scope,old.scope)||!fresh(b))return true;
     if(b.record_version===old.record_version)return false;
     // No stale write is retried. A read-only observation may use a newer,
     // authenticated receipt only when every authority/effect/debt field stayed
     // identical. An unexplained version change still invalidates normally.
     for(const key of ['registration_id','registration_epoch','channel_credential','cleanup_authorization_id','projection','ledger','control_seq','evidence_round_id','native_lifecycle','current_effect','current_coverage','cleanup_pending','cleanup_reservation','apply_closed'])if(!same(b[key],old[key]))return true;
     return !rows.some(r=>r.record_kind==='A1_WRITE_RECEIPT'&&r.binding_id===b.scope.binding_id&&r.scope_epoch===b.scope.scope_epoch&&r.committed_record_version===b.record_version&&!r.cleanup_slot&&r.phase==='COMPLETED'&&valid(r,'receipt')&&valid(r.first_response,'write_result')&&r.first_response.status==='OK'&&r.first_response.data.action==='COMMIT'&&r.first_response.data.registration_id===b.registration_id&&r.first_response.data.registration_epoch===b.registration_epoch&&r.first_response.data.record_version===b.record_version&&r.first_response.data.write_id===r.write_id&&r.first_response.data.view.readiness==='READY'&&r.first_response.data.view.lifecycle==='ACTIVE'&&r.first_response.data.view.control_seq===b.control_seq&&['APPLIED','COVERED','NOT_APPLICABLE'].includes(r.first_response.data.view.current_result));
    }))return false;
    const ids=new Set(current.map(b=>b.scope.binding_id));
    return !rows.some(o=>o.record_kind==='A1_OPERATION'&&ids.has(o.binding_id)&&['ISSUED','IN_FLIGHT','IN_DOUBT'].includes(o.phase));
   });
   if(!checked||!await this.verifyNative(seen.a))return false;
   const latest=await this.bundle();return latest.a.record_version===seen.a.record_version&&latest.a.generation===seen.a.generation&&latest.ownerFenceEpoch===seen.ownerFenceEpoch&&latest.a.session_status==='RUNNING'&&latest.a.intent!=='END';
  }catch{return false;}
 }

 async nrRejectUncertain(b){
  const rows=await this.registry.rows();if(rows.some(o=>o.record_kind==='A1_OPERATION'&&o.command?.payload?.scope?.session_id===b.a.session_id&&o.phase==='IN_DOUBT')){await this.markUnknown('STORE_UNCONFIRMED');fail('STORE_UNCONFIRMED');}
 }
 async nrReplan(b){
  if(!this.nrPending(b.a)||b.a.intent==='END')return false;await this.nrRejectUncertain(b);this.nrCheck(b.a);
  if(b.bindings.some(x=>x.resolution==='NONE'&&x.ordinary_authority==='ACTIVE')){const release=this.p1.holdTransition();try{await this.updateBundle(b,({a,rows,tx})=>{for(const x of rows.filter(x=>x.record_kind==='A1_BINDING'&&x.scope.session_id===a.session_id&&x.resolution==='NONE'&&x.ordinary_authority==='ACTIVE')){x.ordinary_authority='INACTIVE';x.apply_closed=true;x.native_lifecycle='UNCONFIRMED';x.record_version=id();tx.objectStore('metadata').put(x);}a.generation=bump(a.generation);a.commit_fence=null;a.native_transition.phase='VERIFYING';a.native_transition.last_seen_at=this.now();a.record_version=id();tx.objectStore('metadata').put(a);return a;});}finally{try{await this.p1.refreshExecuting();}finally{release();}}}
  this.clock=null;this.requestCheck();return true;
 }
 async nrNativeTransition(binding,native){
  const b=await this.bundle();if(!b||!this.nrEnabled(b.a)||binding.scope.session_id!==b.a.session_id||native.frameId!==0||native.documentId!==binding.scope.document_id||native.documentLifecycle!=='active')return false;
  if(this.nrPending(b.a))return this.nrReplan(b);return this.nrBegin(b,{tabId:binding.scope.tab_id,documentId:native.documentId});
 }
 async nrCensusTransition(before,after,bundle){
  if(!this.nrEnabled(bundle.a)||bundle.a.intent==='END'||bundle.a.session_status==='UNKNOWN')return false;
  // Two Root browser reads, never a Content claim. A replaced/cached/missing
  // document cannot acquire this bounded, negative-authority transition.
  const identity=c=>c.view.map(x=>({tabId:x.tabId,documentId:x.documentId,lifecycle:x.lifecycle}));
  if(before.hash===after.hash||!await this.dnrVerified(bundle.state)||!before.view.length||before.view.some(x=>x.lifecycle!=='active')||after.view.some(x=>x.lifecycle!=='active')||!same(identity(before),identity(after)))return false;
  if(this.nrPending(bundle.a))return this.nrReplan(bundle);return this.nrBegin(bundle);
 }

 async ndBegin(bundle,observed,firstSeen=this.now()){
  const a=bundle.a;if(!this.nd01||a.document_transition_contract!=='ND01_1'||a.session_status!=='RUNNING'||a.intent==='END'||a.nr_first_failure||!a.commit_fence)return false;
  const live=bundle.bindings.filter(b=>b.resolution==='NONE'),ids=new Set(live.map(b=>b.scope.tab_id+':'+b.scope.document_id));
  if(!live.length||live.some(b=>!proof(b)||b.evidence_generation!==a.generation)||observed.view.some(v=>v.lifecycle!=='active'))return false;
  const existing=observed.view.filter(v=>ids.has(v.tabId+':'+v.documentId)),added=observed.view.filter(v=>!ids.has(v.tabId+':'+v.documentId));
  if(!added.length||existing.length!==live.length||added.some(v=>live.some(b=>b.scope.tab_id===v.tabId))||await digest(existing)!==a.commit_fence.native_view_sha256)return false;
  const second=await this.census(bundle.state.session.snapshot);if(second.hash!==observed.hash||!await this.dnrVerified(bundle.state))fail('REVALIDATION_REQUIRED');
  const docs=[];for(const v of second.view)docs.push({tab_id:v.tabId,document_id:v.documentId,url_sha256:await rawHash(v.url)});
  return this.nrBegin(bundle,{timeStamp:firstSeen},{before_sha256:a.commit_fence.native_view_sha256,after_sha256:second.hash,documents:docs});
 }
 ndCensusCheck(bundle,census){const n=bundle.a.native_transition;if(!this.nrPending(bundle.a)||n?.transition_kind!=='DOCUMENT_ADDITION')return;
  if(bundle.a.document_transition_contract!=='ND01_1'||n.document_set.after_sha256!==census.hash)fail('REVALIDATION_REQUIRED');
  if(n.old.some(ref=>{const b=bundle.bindings.find(x=>x.scope.binding_id===ref.binding_id);return !b||!['RELEASE_VERIFIED','GONE_NATIVE'].includes(b.resolution);}))fail('CLEANUP_REQUIRED');
 }
 nrEnabled(a){return a?.native_transition_contract==='NR01_1';}
 nrPending(a){return this.nrEnabled(a)&&a.native_transition&&a.native_transition.phase!=='CONFIRMED'&&a.native_transition.phase!=='FAILED';}
 nrCheck(a){const n=a.native_transition;if(!n)return;if(n.version!=='NR01_1'||n.profile!==this.profile||n.deadline_at<=n.started_at||n.deadline_at-n.started_at>5000)fail('INVALID_TRANSITION_STATE');if(new TextEncoder().encode(JSON.stringify(n)).length>8192)fail('STORE_CAPACITY');if(this.nrPending(a)&&(this.now()>=n.deadline_at||this.now()<n.last_seen_at||n.boot!==this.boot))fail('REVALIDATION_REQUIRED');}
 async nrBegin(bundle,event=null,documentSet=null){
  if(!this.nrEnabled(bundle.a)||!this.p1)return false;if(documentSet&&(!this.nd01||bundle.a.document_transition_contract!=='ND01_1'))fail('UNSUPPORTED_POLICY');
  if(bundle.a.intent==='END')return false;
  if(bundle.a.nr_first_failure||bundle.a.session_status==='UNKNOWN'||bundle.a.native_transition?.phase==='FAILED')return false;
  await this.nrRejectUncertain(bundle);if(this.nrPending(bundle.a)){this.nrCheck(bundle.a);this.requestCheck();return true;}
  const dpTransition=this.dom?.active(bundle.a)===true;if(dpTransition)this.dom.check(bundle.a);if(!['RUNNING',...(dpTransition?['EFFECT_VERIFYING']:[])].includes(bundle.a.session_status)||bundle.a.cleanup_pending||bundle.bindings.some(b=>b.resolution==='NONE'&&!proof(b)&&!(dpTransition&&this.dom.grant(bundle.a,b)&&b.ordinary_authority==='INACTIVE')))return false;if(dpTransition&&this.env.onEffectWait)await this.env.onEffectWait();
  const owner=await this.env.owner(),fence=await this.fence(owner);if(fence!==bundle.ownerFenceEpoch)fail('OWNER_MISMATCH');
  const live=bundle.bindings.filter(b=>b.resolution==='NONE');if(live.length>5)fail('STORE_CAPACITY');
  const refs=[];for(const b of live){const p=await this.store.read('a1:p1:NATIVE_BINDING_PROOF:'+b.scope.binding_id);if(!p||!validP1(p)||p.phase!=='ATTESTED'||p.profile!==this.profile||p.executor_id!==bundle.a.executor_id||p.tab_id!==b.scope.tab_id||p.frame_id!==0||p.document_id!==b.scope.document_id||p.scope_sha256!==await digest(b.scope)||p.credential_sha256!==await rawHash(b.channel_credential)||p.fence_epoch!==fence||p.session_id!==bundle.a.session_id||p.owner_context!==bundle.a.owner_context||p.registration_epoch!==b.registration_epoch||p.content_instance!==b.scope.content_instance_id)fail('UNAUTHORIZED_SENDER');refs.push({binding_id:b.scope.binding_id,scope_sha256:p.scope_sha256,proof_version:p.record_version});}
  if(event?.documentId){const old=live.find(b=>b.scope.tab_id===event.tabId);if(old&&old.scope.document_id!==event.documentId)return false;}
  const now=this.now(),started=Number.isFinite(event?.timeStamp)?Math.min(now,Math.floor(event.timeStamp)):now,commandExpiry=bundle.state.session.member_admission?Date.parse(bundle.state.session.member_admission.command.execute_before):Infinity,deadline=Math.min(started+5000,commandExpiry,Date.parse(bundle.a.time.last_trusted_at)+30000);if(!Number.isFinite(deadline)||deadline<=now||started<0){await this.markUnknown('REVALIDATION_REQUIRED');fail('REVALIDATION_REQUIRED');}
  const release=this.p1.holdTransition();this.nrReportPending=!!this.env.onNativeWait;try{const begun=await this.updateBundle(bundle,({a,state,rows,tx})=>{
   for(const r of refs){const p=rows.find(x=>x.key==='a1:p1:NATIVE_BINDING_PROOF:'+r.binding_id);if(p?.record_version!==r.proof_version)fail('GENERATION_CHANGED');}
   if(dpTransition)a.effect_transition.phase='CANCELLED';closeInterval(a,state.session,state.journal,tx);for(const b of rows.filter(b=>b.record_kind==='A1_BINDING'&&b.scope.session_id===a.session_id&&b.resolution==='NONE')){b.ordinary_authority='INACTIVE';b.apply_closed=true;b.native_lifecycle='UNCONFIRMED';b.record_version=id();tx.objectStore('metadata').put(b);}
   a.generation=bump(a.generation);a.session_status='NATIVE_VERIFYING';a.phase='REVALIDATING';a.intent='RECOVER';a.commit_fence=null;a.time.clock_quality='UNCONFIRMED';a.native_transition={version:'NR01_1',transition_id:id(),phase:'VERIFYING',anchor_generation:a.generation,started_at:started,deadline_at:deadline,last_seen_at:now,boot:this.boot,profile:this.profile,old:refs,first_failure:null,...(documentSet?{transition_kind:'DOCUMENT_ADDITION',document_set:documentSet}:{})};a.record_version=id();state.session.status='NATIVE_VERIFYING';saveSession(tx,state.session,state.journal);tx.objectStore('metadata').put(a);return a;
  });this.traceNative('BEGIN_COMMITTED',{...bundle,a:begun});this.clock=null;}catch(e){this.nrReportPending=false;throw e;}finally{release();}
  try{if(this.env.onNativeWait)await this.env.onNativeWait();}catch(e){await this.markUnknown('STORE_UNCONFIRMED');throw e;}finally{this.nrReportPending=false;this.requestCheck();}return true;
 }
 async nrStage(phase){const b=await this.bundle();if(!this.nrPending(b?.a))return;this.traceNative(phase+'_ENTER',b);this.nrCheck(b.a);const committed=await this.updateBundle(b,({a,tx})=>{a.native_transition.phase=phase;a.native_transition.last_seen_at=this.now();a.record_version=id();tx.objectStore('metadata').put(a);return a;});this.traceNative(phase+'_COMMITTED',{...b,a:committed});}

 async navigation(d,{sameUrlHistory=false}={}){
  if(d.frameId!==0)return;await this.ready;const seen=await this.bundle();if(!seen||terminal(seen.state.session.status))return;
  const bindingIds=seen.bindings.filter(b=>b.resolution==='NONE'&&b.scope.tab_id===d.tabId).map(b=>b.scope.binding_id);
  if(!bindingIds.length)return;
  if(!sameUrlHistory&&this.documentRetirement&&await this.d1.beforeNavigation(seen,d,{withinNative:this.nrPending(seen.a)}))return;
  if(sameUrlHistory&&await this.unchangedHistory(d,seen)){this.requestCheck();return;}
  if(sameUrlHistory&&this.nrEnabled(seen.a)&&await this.nrBegin(seen,d))return;
  return this.invalidate('BFCACHE',d.tabId,d.documentId,{session:seen.a.session_id,bindingIds});
 }
 tick(onStart=null){return this.serial(async()=>{onStart?.();await this.ready;if(!this.enabled)return null;const original=await this.bundle();if(this.nrPending(original?.a))this.traceNative('CHECK_ENTER',original);try{await this.expire();for(let attempt=0;;attempt++){try{return await this.reconcile();}catch(e){
   // Only a confirmed, aborted aggregate CAS can be replanned; unknown writes are never replayed.
   if(e.message!=='STALE_AGGREGATE'||attempt>=2||!original)throw e;
   const current=await this.bundle();if(!current||current.a.session_id!==original.a.session_id||current.a.owner_context!==original.a.owner_context||current.a.executor_id!==original.a.executor_id||!same(current.a.snapshot_ref,original.a.snapshot_ref))throw e;
   // Reconcile reads new state, checks owner/native fences, and preserves END priority.
  }}}catch(e){const current=await this.bundle().catch(()=>null);if(e.message==='REVALIDATION_REQUIRED'&&e.cause?.native_observation&&current&&this.nrEnabled(current.a)){this.traceNative('CENSUS_WAIT',current,e.cause.native_observation.reason);try{if(this.nrPending(current.a)){this.nrCheck(current.a);this.requestCheck();return current.state;}if(e.cause.native_observation.reason==='DOCUMENT_ADDITION_CANDIDATE'){if(await this.ndBegin(current,await this.census(current.state.session.snapshot),Date.parse(e.cause.native_observation.observed_at)))return (await this.bundle()).state;fail('REVALIDATION_REQUIRED');}if(await this.nrBegin(current)){return (await this.bundle()).state;}}catch(denied){e=denied;}}this.traceNative('FAILURE',current,e.message);try{await this.markUnknown(e.message,'RESPONSE_UNCONFIRMED',e.cause?.message);await this.suspend(e.message==='REVALIDATION_REQUIRED'?'RESPONSE_UNCONFIRMED':'RUNTIME_APPLY_FAILED');}catch{}throw e;}});}
 state(){return this.tick();}
 uiState(){
  // Share only an unstarted check with no intervening serial mutation. Never
  // reuse a running/completed result as evidence of current UI authority.
  const prior=this.uiPending;if(prior&&!prior.started&&prior.tail===this.tail)return prior.promise;
  const pending={started:false},promise=this.uiStateOnce(()=>{pending.started=true;});
  pending.promise=promise;pending.tail=this.tail;this.uiPending=pending;
  const clear=()=>{if(this.uiPending===pending){this.uiPending=null;if(this.checkDirty)this.requestCheck();}};promise.then(clear,clear);return promise;
 }
 async uiStateOnce(onStart){
  try{return await this.tick(onStart);}catch(failure){
   // UI can report an already durable UNKNOWN/ENDING state, never infer RUNNING
   // or restoration from a failed recovery. Native tick callers still throw.
   try{const owner=await this.env.owner(),observed=await this.env.db.transaction('readonly',(tx,done)=>{
    const all=tx.objectStore('metadata').getAll();all.onsuccess=()=>{const rows=all.result,p=rows.find(x=>x.key==='current'),a=rows.find(x=>x.key==='a1:aggregate:'+p?.session_id),f=rows.find(x=>x.key==='a1:owner-fence');
     if(!p||p.execution_contract!==VERSION||p.owner_key!==owner.owner_key||!valid(a,'aggregate')||a.owner_context!==owner.owner_key||a.executor_id!==owner.installation_id||a.boot_epoch!==this.boot||!f||f.owner_context!==owner.owner_key||f.transitioning||typeof f.epoch!=='string'||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(f.epoch)){done(null);return;}
     const sq=tx.objectStore('sessions').get([p.owner_key,p.session_id]);sq.onsuccess=()=>{const s=sq.result,jq=tx.objectStore('journal').get([p.owner_key,p.session_id]);jq.onsuccess=()=>{const j=jq.result;if(!s||!j||s.execution_contract!==VERSION||s.owner_key!==owner.owner_key||s.executor_id!==owner.installation_id||s.session_id!==a.session_id||s.status!==a.session_status||!['UNKNOWN','ENDING'].includes(s.status)||!valid(s.snapshot,'guest_snapshot')||j.revision!==a.desired_revision||j.revision!==a.local_links.journal_revision||j.action_seq!==a.local_links.journal_action_seq||a.commit_fence!==null||s.status==='UNKNOWN'&&a.time.clock_quality!=='UNCONFIRMED'||s.status==='ENDING'&&(a.intent!=='END'||j.desired!=='RELEASED')){done(null);return;}done({state:{execution_contract:VERSION,session:s,journal:j},a});};};
    };
   });if(!observed||!same(await ref(observed.state.session.snapshot),observed.a.snapshot_ref))throw failure;
    console.error('FOCURVE_A1_STATE_RECOVERY_UNCONFIRMED',JSON.stringify({code:/^[A-Z_]{1,64}$/.test(failure.message)?failure.message:'EXECUTION_UNCONFIRMED',reported_status:observed.state.session.status}));return observed.state;
   }catch{throw failure;}
  }
 }
 async profileStartup(){await this.ready;if(!this.enabled||!this.newProfile||!this.previousProfile||this.previousProfile===this.profile)return;if(this.d1b5)fail('REVALIDATION_REQUIRED');const currentIds=new Set();for(const tab of await this.chrome.tabs.query({})){const frames=await this.chrome.webNavigation.getAllFrames({tabId:tab.id});for(const f of frames??[])if(f.documentId)currentIds.add(f.documentId);}const bundle=await this.bundle();if(!bundle||terminal(bundle.state.session.status))return;
  await this.updateBundle(bundle,({a,state,rows,tx})=>{for(const b of rows.filter(r=>r.record_kind==='A1_BINDING'&&r.scope.session_id===a.session_id&&r.resolution==='NONE')){if(currentIds.has(b.scope.document_id))fail('REVALIDATION_REQUIRED');b.ordinary_authority='REVOKED';b.native_lifecycle='GONE';b.resolution='GONE_NATIVE';b.native_resolution_event='PROFILE_RESTART_VERIFIED';b.cleanup_pending=false;b.record_version=id();tx.objectStore('metadata').put(b);}invalidateAggregate(a,state.session,state.journal,tx,'PROFILE_STARTUP');return a;});
  this.requestCheck();
 }
 async expire(){const owner=await this.env.owner(),now=this.now();return this.store.atomic((tx,done,reject)=>{const md=tx.objectStore('metadata'),all=md.getAll();all.onsuccess=()=>{
   const rows=all.result,q=tx.objectStore('sessions').openCursor();q.onsuccess=()=>{const c=q.result;if(!c){done(null);return;}const s=c.value,a=rows.find(r=>r.key==='a1:aggregate:'+s.session_id);const bindings=rows.filter(r=>r.record_kind==='A1_BINDING'&&r.scope.session_id===s.session_id);
    const knownP1=r=>validP1(r)&&r.session_id===s.session_id&&r.owner_context===s.owner_key&&r.executor_id===s.executor_id&&bindings.some(b=>b.scope.binding_id===r.binding_id)&&!(r.record_kind==='CLEANUP_LEASE'&&r.phase!=='COMPLETED');
    const knownFeature=r=>r.record_kind==='GUEST_FEATURE_CAPTURE'&&r.session_id===s.session_id&&r.owner_key===s.owner_key&&['PENDING','COMPLETED','MARKER'].includes(r.phase)&&r.key?.startsWith('guest-feature:');
    const unknown=rows.some(r=>r.session_id===s.session_id&&(r.owner_context===s.owner_key||r.owner_key===s.owner_key)&&!['A1_AGGREGATE'].includes(r.record_kind)&&!knownP1(r)&&!knownFeature(r)&&r.key!=='current'&&!r.key?.startsWith('start:'));
    if(s.execution_contract!==VERSION||s.owner_key!==owner.owner_key||!terminal(s.status)||!a||a.cleanup_pending||unknown||bindings.some(b=>b.cleanup_pending||b.resolution==='NONE')||!s.ended_at||now<Date.parse(s.ended_at)+30*86400000){c.continue();return;}
    const bids=new Set(bindings.map(b=>b.scope.binding_id));c.delete();tx.objectStore('journal').delete([s.owner_key,s.session_id]);
    for(const r of rows)if(r.key===a.key||r.key==='start:'+s.start_request_id||r.key==='current'&&r.owner_key===s.owner_key&&r.session_id===s.session_id||r.record_kind==='A1_BINDING'&&bids.has(r.scope.binding_id)||['A1_OPERATION','A1_WRITE_RECEIPT'].includes(r.record_kind)&&bids.has(r.binding_id)||knownP1(r)||knownFeature(r))md.delete(r.key);
    for(const name of ['events','intervals','outbox']){const child=tx.objectStore(name).openCursor();child.onsuccess=()=>{const r=child.result;if(r){if(r.value.owner_key===s.owner_key&&r.value.session_id===s.session_id)r.delete();r.continue();}};}c.continue();
   };
  };});}
 async observe(stage,details){const state=await this.env.db.load(),owner=await this.env.owner();if(state?.execution_contract!==VERSION)return null;try{return stage==='before'?await this.env.access.begin(state,details):stage==='error'?await this.env.access.fail(details):await this.env.access.commit(owner,details);}catch(e){await this.markUnknown('STORE_UNCONFIRMED','STORE_UNCONFIRMED');throw e;}}
}
