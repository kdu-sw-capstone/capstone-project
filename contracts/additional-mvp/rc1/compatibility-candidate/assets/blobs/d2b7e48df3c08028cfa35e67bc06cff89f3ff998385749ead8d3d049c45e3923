import {VERSION,valid,same,fail,trialReservations,preflight,ref,effectConfirmed} from './contract.mjs';
import {reserveP1,P1} from './p1.mjs';
import {D1B5,capacityProfile} from './d1.mjs';
import {B5_PROFILE} from './contract.mjs';
import {saveSession,invalidateAggregate} from './domain.mjs';
const clone=structuredClone;
// Uses the existing SessionDB transaction; no A0 DB or cross-DB atomic claim.
export class A1Store {
 constructor(sessionDB,{hostPolicy,isolatedTrial=false,limitedProduct11=false,verifyNative=null}={}){this.db=sessionDB;this.hostPolicy=hostPolicy;this.isolatedTrial=isolatedTrial;this.limitedProduct11=limitedProduct11;this.verifyNative=verifyNative;}
 async read(key){return this.db.transaction('readonly',(tx,done)=>{const q=tx.objectStore('metadata').get(key);q.onsuccess=()=>done(q.result??null);});}
 async bundle({includeBindings=true}={}){
  let reason;try{return await this.db.transaction('readonly',(tx,done)=>{
   const md=tx.objectStore('metadata');
   const reject=e=>{reason=e;tx.abort();};
   const read=rows=>{try{
    const current=rows.find(r=>r.key==='current');
    if(!current||current.execution_contract!==VERSION){done(null);return;}
    const a=rows.find(r=>r.key==='a1:aggregate:'+current.session_id),fence=rows.find(r=>r.key==='a1:owner-fence');
    if(!a||!valid(a,'aggregate')||a.owner_context!==current.owner_key)fail('INVALID_TRANSITION_STATE');
    const sq=tx.objectStore('sessions').get([a.owner_context,a.session_id]),jq=tx.objectStore('journal').get([a.owner_context,a.session_id]);let session,journal,pending=2;
    const finish=()=>{if(--pending)return;try{
     if(!session||!journal||session.execution_contract!==VERSION||session.executor_id!==a.executor_id||session.status!==a.session_status||journal.revision!==a.desired_revision||journal.revision!==a.local_links.journal_revision||journal.action_seq!==a.local_links.journal_action_seq)fail('INVALID_TRANSITION_STATE');
     done({state:{execution_contract:VERSION,session,journal},a,ownerFenceEpoch:fence?.epoch,bindings:includeBindings?rows.filter(r=>r.record_kind==='A1_BINDING'&&r.scope.session_id===a.session_id):[]});
    }catch(e){reject(e);}};
    sq.onsuccess=()=>{session=sq.result;finish();};jq.onsuccess=()=>{journal=jq.result;finish();};
   }catch(e){reject(e);}};
   if(includeBindings){
    // Historical operation and receipt payloads are irrelevant to this read.
    // Keep the same single readonly snapshot and inspect every Binding key,
    // including unlisted obligations; do not trust a cached binding-id list.
    const cq=md.get('current');cq.onsuccess=()=>{
     const current=cq.result;if(!current||current.execution_contract!==VERSION){done(null);return;}
     const kq=md.getAllKeys();kq.onsuccess=()=>{
      const keys=[...new Set(['a1:aggregate:'+current.session_id,'a1:owner-fence',...kq.result.filter(k=>typeof k==='string'&&k.startsWith('a1:binding:'))])],rows=[current];let pending=keys.length;
      for(const key of keys){const q=md.get(key);q.onsuccess=()=>{if(q.result)rows.push(q.result);if(!--pending)read(rows);};}
     };
    };
   }
   else{const q=md.get('current');q.onsuccess=()=>{
    const current=q.result;if(!current||current.execution_contract!==VERSION){done(null);return;}
    const rows=[current],aq=md.get('a1:aggregate:'+current.session_id),fq=md.get('a1:owner-fence');let pending=2;
    const finish=r=>{if(r)rows.push(r);if(!--pending)read(rows);};
    aq.onsuccess=()=>finish(aq.result);fq.onsuccess=()=>finish(fq.result);
   };}
  });}catch(e){throw reason??e;}
 }
 async atomic(work){let reason;try{return await this.db.transaction('readwrite',(tx,done)=>{const reject=e=>{reason=e;tx.abort();};const complete=value=>{try{this.beforeCommit?.(tx);done(value);}catch(e){reject(e);}};try{work(tx,complete,reject);}catch(e){reject(e);}});}catch(e){throw reason??e;}}
 async begin(state,aggregate,{ownerFenceEpoch}){
  if(!(this.isolatedTrial||this.limitedProduct11)||!this.hostPolicy)fail('A1_TRIAL_NOT_ENABLED');
  preflight(state.session.snapshot,this.hostPolicy,{isolatedTrial:this.isolatedTrial,limitedProduct11:this.limitedProduct11,newlyGenerated:true});
  if(!same(await ref(state.session.snapshot),aggregate.snapshot_ref)||state.session.status!=='STARTING'||!Number.isInteger(state.session.duration_minutes)||state.session.duration_minutes<1||state.session.duration_minutes>180)fail('INVALID_A1_RECORD');
  if(this.d1b5&&!same(aggregate.cleanup_budget,{operation_capacity:160,write_capacity:320}))fail('INVALID_CLEANUP_RESERVATION');
  if(!valid(aggregate,'aggregate')||aggregate.phase!=='PREPARING'||aggregate.session_status!=='STARTING'||aggregate.intent!=='APPLY'||aggregate.commit_fence!==null||aggregate.cleanup_pending)fail('INVALID_A1_RECORD');
  if(aggregate.owner_context!==state.session.owner_key||aggregate.executor_id!==state.session.executor_id||aggregate.session_id!==state.session.session_id||aggregate.snapshot_ref.policy_snapshot_id!==state.session.snapshot.policy_snapshot_id)fail('OWNER_MISMATCH');
  return this.atomic((tx,done,reject)=>{
   const md=tx.objectStore('metadata'),current=md.get('current');
   current.onsuccess=()=>{
    const guard=()=>{const f=md.get('a1:owner-fence');f.onsuccess=()=>{
     try{
      if(!f.result||f.result.owner_context!==aggregate.owner_context||f.result.epoch!==ownerFenceEpoch||f.result.transitioning)fail('OWNER_FENCE_MISMATCH');
      const key='start:'+state.session.start_request_id,lookup=md.get(key);
      lookup.onsuccess=()=>{try{
       if(lookup.result)fail('IDEMPOTENCY_CONFLICT');
       if(!state.session.member_admission||state.session.member_admission.session_id!==aggregate.session_id)fail('MEMBER_COMMAND_REQUIRED');md.add({key:'member:admission:'+aggregate.session_id,...clone(state.session.member_admission)});tx.objectStore('sessions').add(clone(state.session));tx.objectStore('journal').add(clone(state.journal));
       md.add(clone(aggregate));md.add({key,owner_key:aggregate.owner_context,session_id:aggregate.session_id,execution_contract:VERSION,...(this.p1?{native_binding_mode:P1}:{}),...(this.d1b5?{transition_contract:D1B5,capacity_profile:structuredClone(B5_PROFILE)}:{})});
       md.put({key:'current',owner_key:aggregate.owner_context,session_id:aggregate.session_id,execution_contract:VERSION});done(clone(aggregate));
      }catch(e){reject(e);}};
     }catch(e){reject(e);}
    };};
    if(!current.result){guard();return;}
    const q=tx.objectStore('sessions').get([current.result.owner_key,current.result.session_id]);
    q.onsuccess=()=>{if(!q.result||!['ENDED','INTERRUPTED','START_FAILED'].includes(q.result.status)){reject(Error('SESSION_ACTIVE'));return;}
     const old=md.get('a1:aggregate:'+current.result.session_id);old.onsuccess=()=>{if(old.result?.cleanup_pending){reject(Error('CLEANUP_REQUIRED'));return;}guard();};};
   };
  });
 }
 async reserve(binding,aggregateExpected,ownerFenceEpoch){
  if(!valid(binding,'binding')||binding.resolution!=='NONE'||binding.readiness!=='PROVISIONAL')fail('INVALID_A1_RECORD');
  return this.atomic((tx,done,reject)=>{
   const md=tx.objectStore('metadata'),q=md.get('a1:aggregate:'+binding.scope.session_id);
   q.onsuccess=()=>{try{
    const a=q.result;if(!a||a.record_version!==aggregateExpected||a.intent==='END'||a.owner_context!==binding.scope.owner_context||!same(a.snapshot_ref,binding.scope.snapshot_ref))fail('STALE_AGGREGATE');
    if(!valid(a,'aggregate'))fail('INVALID_A1_RECORD');if(a.session_status==='EFFECT_VERIFYING')fail('INACTIVE_SCOPE');
    if(a.generation===Number.MAX_SAFE_INTEGER||a.session_revision===Number.MAX_SAFE_INTEGER||a.desired_revision===Number.MAX_SAFE_INTEGER)fail('INVALID_TRANSITION');
    const all=md.getAll();all.onsuccess=()=>{try{
     const fence=all.result.find(r=>r.key==='a1:owner-fence');if(!fence||fence.transitioning||fence.owner_context!==a.owner_context||typeof ownerFenceEpoch!=='string'||fence.epoch!==ownerFenceEpoch)fail('OWNER_FENCE_MISMATCH');
     const rows=all.result.filter(r=>r.record_kind==='A1_BINDING'&&r.scope.owner_context===binding.scope.owner_context);
     if(rows.some(r=>r.key===binding.key||r.scope.binding_id===binding.scope.binding_id))fail('BINDING_CONFLICT');
      // Native invalidation may commit while Core awaits census/cleanup. Admit
      // against current rows, not the earlier in-memory cleanup selection.
      // Never replace a live document authority or bypass an inactive debt.
      if(rows.some(r=>r.resolution==='NONE'&&(r.ordinary_authority!=='ACTIVE'||r.scope.tab_id===binding.scope.tab_id&&r.scope.document_id===binding.scope.document_id)))fail('CLEANUP_REQUIRED');
      const capacity=capacityProfile(all.result,a,this.d1b5===true);
      if(capacity&&rows.some(r=>r.resolution==='NONE'&&!all.result.some(m=>m.key.startsWith('start:')&&m.session_id===r.scope.session_id&&m.transition_contract===D1B5&&same(m.capacity_profile,capacity))))fail('CLEANUP_REQUIRED');
      trialReservations([...rows,binding],capacity);const mode=all.result.find(r=>r.key.startsWith('start:')&&r.session_id===a.session_id);if(mode?.native_binding_mode){if(mode.native_binding_mode!==P1||mode.owner_key!==a.owner_context||mode.execution_contract!==VERSION)fail('SCOPE_MISMATCH');reserveP1(binding,all.result,md);}md.add(clone(binding));a.binding_ids.push(binding.scope.binding_id);a.generation++;a.record_version=crypto.randomUUID();if(!valid(a,'aggregate'))fail('INVALID_A1_RECORD');
     if(a.session_status==='RUNNING'){const s=tx.objectStore('sessions').get([a.owner_context,a.session_id]),j=tx.objectStore('journal').get([a.owner_context,a.session_id]);s.onsuccess=()=>{j.onsuccess=()=>{if(!s.result||!j.result){reject(Error('INVALID_TRANSITION_STATE'));return;}invalidateAggregate(a,s.result,j.result,tx);done(clone(a));};};}else{if(!valid(a,'aggregate'))fail('INVALID_A1_RECORD');md.put(a);done(clone(a));}
    }catch(e){reject(e);}};
   }catch(e){reject(e);}};
  });
 }
 async commitBundle({aggregate,session,journal,interval=null,event=null,expectedRecordVersion,expectedRevision,expectedGeneration,ownerFenceEpoch}){
  if(!valid(aggregate,'aggregate')||aggregate.owner_context!==session.owner_key||aggregate.session_id!==session.session_id||journal.session_id!==session.session_id||journal.owner_key!==session.owner_key||session.status!==aggregate.session_status||journal.revision!==aggregate.desired_revision)fail('INVALID_A1_RECORD');
  if(aggregate.session_status==='RUNNING'&&(!this.verifyNative||!await this.verifyNative(aggregate)))fail('RUNNING_GATE_DENIED');
  return this.atomic((tx,done,reject)=>{
   const md=tx.objectStore('metadata'),q=md.get(aggregate.key);
   q.onsuccess=()=>{try{
    const old=q.result;if(!old||old.record_version!==expectedRecordVersion||old.session_revision!==expectedRevision||old.generation!==expectedGeneration)fail('STALE_AGGREGATE');
    if(aggregate.native_transition?.phase==='CONFIRMED'&&old.native_transition?.phase!=='CONFIRMED'){const n=old.native_transition;if(!n||n.phase==='FAILED'||n.transition_id!==aggregate.native_transition.transition_id||n.deadline_at!==aggregate.native_transition.deadline_at||Date.now()>=n.deadline_at)fail('REVALIDATION_REQUIRED');}if(aggregate.effect_transition?.phase==='CONFIRMED'&&old.effect_transition?.phase==='READY'&&Date.now()>=aggregate.effect_transition.deadline_at)fail('REVALIDATION_REQUIRED');if(old.intent==='END'&&aggregate.intent!=='END')fail('END_WINS');
    const f=md.get('a1:owner-fence');f.onsuccess=()=>{try{
     if(!f.result||f.result.owner_context!==aggregate.owner_context||f.result.epoch!==ownerFenceEpoch||f.result.transitioning)fail('OWNER_FENCE_MISMATCH');
     const p=md.get('current');p.onsuccess=()=>{try{
      if(p.result?.execution_contract!==VERSION||p.result.owner_key!==session.owner_key||p.result.session_id!==session.session_id)fail('CURRENT_ROUTE_MISMATCH');
      const all=md.getAll();all.onsuccess=()=>{try{
       if(this.d1b5)capacityProfile(all.result,aggregate,true);
       if(aggregate.session_status==='RUNNING'){
        const a=aggregate,proof=a.commit_fence;
        if(!proof||a.intent==='END'||a.phase!=='RUNNING'||a.cause!=='NONE'||a.time.clock_quality!=='VERIFIED'||!a.time.open_interval_id||proof.expected_generation!==a.generation||proof.expected_session_revision!==a.session_revision||proof.expected_record_version!==a.record_version||proof.owner_fence_epoch!==ownerFenceEpoch||!proof.route_guard_ready||!proof.policy_preflight_verified||!proof.dnr_verified||!proof.prepared_commit_recheck_verified||!a.local_links.first_started_event_id||!a.local_links.interval_ids.includes(a.time.open_interval_id))fail('RUNNING_GATE_DENIED');
        if(a.no_target!==(a.r0.length===0))fail('RUNNING_GATE_DENIED');
        const rows=all.result.filter(r=>r.record_kind==='A1_BINDING'&&r.scope.session_id===a.session_id);
        if(a.r0.some(bid=>{const b=rows.find(r=>r.scope.binding_id===bid),e=b?.current_coverage;return !b||b.ordinary_authority!=='ACTIVE'||b.readiness!=='READY'||b.evidence_generation!==a.generation||b.scope.owner_context!==a.owner_context||!same(b.scope.snapshot_ref,a.snapshot_ref)||b.cleanup_reservation.remaining_operations<1||b.cleanup_reservation.remaining_writes<2||!(effectConfirmed(b.current_effect)||e&&e.observer_ready&&e.scan_completed_without_error&&e.error_count===0&&e.hidden_candidate_count===e.candidate_count&&e.inert_candidate_count===e.candidate_count);}))fail('RUNNING_GATE_DENIED');
       }
       if(['ENDED','START_FAILED'].includes(aggregate.session_status)&&(aggregate.cleanup_pending||aggregate.time.open_interval_id||all.result.some(r=>r.record_kind==='A1_BINDING'&&r.scope.session_id===aggregate.session_id&&(r.cleanup_pending||r.resolution==='NONE'))))fail('CLEANUP_REQUIRED');
       saveSession(tx,clone(session),clone(journal),event?clone(event):null,interval?clone(interval):null);md.put(clone(aggregate));done(clone(aggregate));
      }catch(e){reject(e);}};
     }catch(e){reject(e);}};
    }catch(e){reject(e);}};
   }catch(e){reject(e);}};
  });
 }
}
