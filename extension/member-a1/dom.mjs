import {same,fail,digest,effectConfirmed} from './contract.mjs';
import {id,coverageConfirmed,closeInterval,saveSession} from './domain.mjs';
export const DP='DP01_1';
export class DomRoot {
 constructor(core){this.core=core;}
 active(a){return a?.intent!=='END'&&a?.dom_transition_contract===DP&&['VERIFYING','READY'].includes(a.effect_transition?.phase);}
 pending(a){return a?.intent!=='END'&&a?.dom_transition_contract===DP&&a.effect_transition?.phase==='VERIFYING';}
 grant(a,b){return a.effect_transition?.grants.find(g=>g.binding_id===b.scope.binding_id);}
 check(a){const n=a.effect_transition;if(a?.dom_transition_contract!==DP||!['VERIFYING','READY'].includes(n?.phase))return;if(n.boot!==this.core.boot||n.profile!==this.core.profile||Date.now()>=n.deadline_at||n.deadline_at-n.started_at>3000||n.deadline_at<=n.started_at||a.nr_first_failure)fail('REVALIDATION_REQUIRED');}
 async expire(){const b=await this.core.bundle();if(b?.a.intent!=='END'&&b?.a.dom_transition_contract===DP&&['VERIFYING','READY'].includes(b.a.effect_transition?.phase))try{this.check(b.a);}catch{await this.core.markUnknown('REVALIDATION_REQUIRED');}}
 guard(ctx,m,rows,b,a,fp){
  if(!this.pending(a)||b.ordinary_authority!=='INACTIVE')return false;this.check(a);
  const n=a.effect_transition,g=this.grant(a,b),q=m.payload,p=rows.find(r=>r.key==='a1:p1:NATIVE_BINDING_PROOF:'+b.scope.binding_id);
  if(!g||!p||ctx.native_hash!==p.native_url_sha256||g.native_hash!==ctx.native_hash||g.scope_hash!==ctx.scope_hash||g.credential_hash!==ctx.credential_hash||g.proof_version!==p.record_version||g.fence!==ctx.fence_epoch||g.generation!==a.generation||g.operation_id!==q.change?.operation_id&&q.action==='COMMIT')return false;
  const replay=rows.find(r=>r.key==='a1:receipt:'+b.scope.binding_id+':'+q.write_id);
  if(q.action==='COMMIT'&&q.change.kind==='LEDGER_PLAN'&&q.write_id===g.plan_write_id&&replay?.fingerprint===fp&&replay.first_response)return true;
  if(!q.dom_cap||!same(q.dom_cap,this.cap(n,g)))return false;
  if(q.action==='READ')return q.selector==='SUMMARY'||q.selector==='LEDGER'||q.selector==='RECEIPT'&&q.selected_id===g.plan_write_id;
  return q.change.kind==='LEDGER_PLAN'||q.change.kind==='DOM_CONFIRM'&&g.phase==='OPEN';
 }
 cap(n,g){return {version:DP,transition_id:n.transition_id,grant_id:g.grant_id,token:g.token,plan_hash:g.plan_hash,plan_version:g.plan_version,deadline_at:n.deadline_at};}
 enter(rows,tx,a,b,op,m,ctx,planHash,sessionReq,journalReq){
  const c=this.core,now=Date.now(),n=a.effect_transition,p=rows.find(x=>x.key==='a1:p1:NATIVE_BINDING_PROOF:'+b.scope.binding_id),member=rows.find(x=>x.key==='member:admission:'+a.session_id);
  if(a.dom_transition_contract!==DP||!['RUNNING','EFFECT_VERIFYING'].includes(a.session_status)||a.intent==='END'||a.nr_first_failure||c.nrPending(a)||!ctx||!p||ctx.native_hash!==p.native_url_sha256||p.creation_boot!==c.boot||op.phase!=='COMPLETED'||op.command.payload.operation!=='APPLY'||!op.first_response||b.resolution!=='NONE'||rows.some(r=>r.record_kind==='A1_OPERATION'&&r.binding_id===b.scope.binding_id&&['IN_FLIGHT','IN_DOUBT'].includes(r.phase)))fail('INVALID_TRANSITION');
  if(member&&member.command.dom_transition_contract!==DP)fail('SCOPE_MISMATCH');
  if(!['VERIFYING','READY'].includes(a.effect_transition?.phase)){
   const deadline=Math.min(now+3000,Date.parse(a.time.last_trusted_at)+30000);if(deadline<=now)fail('REVALIDATION_REQUIRED');
   if(a.generation===Number.MAX_SAFE_INTEGER)fail('INVALID_TRANSITION');a.generation++;a.effect_transition={version:DP,transition_id:id(),phase:'VERIFYING',anchor_generation:a.generation,started_at:now,deadline_at:deadline,last_seen_at:now,boot:c.boot,profile:c.profile,grants:[]};
  }else this.check(a);
  const w=a.effect_transition;w.phase='VERIFYING';let g=this.grant(a,b);if(!g){if(w.grants.length>=5)fail('STORE_CAPACITY');g={binding_id:b.scope.binding_id,plan_version:0};w.grants.push(g);}
  Object.assign(g,{grant_id:id(),token:id(),plan_hash:planHash,plan_version:g.plan_version+1,operation_id:op.operation_id,operation_fingerprint:op.fingerprint,plan_write_id:m.payload.write_id,phase:'OPEN',scope_hash:ctx.scope_hash,credential_hash:ctx.credential_hash,native_hash:ctx.native_hash,proof_version:p.record_version,fence:ctx.fence_epoch,generation:a.generation});
  tx.objectStore('metadata').add({key:'a1:dom:'+g.grant_id+':plan',record_kind:'DOM_EFFECT_PROOF',phase:'OPEN',session_id:a.session_id,binding_id:b.scope.binding_id,transition_id:w.transition_id,anchor_generation:w.anchor_generation,base_ledger:rows.some(x=>x.record_kind==='DOM_EFFECT_PROOF'&&x.binding_id===b.scope.binding_id)?null:structuredClone(b.ledger),delta:structuredClone(m.payload.change.entries.slice(b.ledger.length)),started_at:w.started_at,deadline_at:w.deadline_at,boot:w.boot,profile:w.profile,grant:structuredClone(g)});b.ordinary_authority='INACTIVE';a.session_status='EFFECT_VERIFYING';a.phase='REVALIDATING';a.commit_fence=null;a.time.clock_quality='UNCONFIRMED';a.record_version=id();w.last_seen_at=now;
  if(new TextEncoder().encode(JSON.stringify(w)).length>8192)fail('STORE_CAPACITY');
  sessionReq.onsuccess=()=>{journalReq.onsuccess=()=>{if(!sessionReq.result||!journalReq.result){tx.abort();return;}closeInterval(a,sessionReq.result,journalReq.result,tx);sessionReq.result.status='EFFECT_VERIFYING';saveSession(tx,sessionReq.result,journalReq.result);tx.objectStore('metadata').put(a);};};
  clearTimeout(this.timer);this.timer=setTimeout(()=>c.serial(()=>this.expire()).catch(()=>{}),Math.max(1,w.deadline_at-now));this.timer.unref?.();
 }
 confirm(a,b,c,op,tx){this.check(a);const g=this.grant(a,b);if(!op||op.phase!=='COMPLETED'||op.command.payload.operation!=='APPLY'||c.round_id!==op.command.payload.round_id||!g||g.phase!=='OPEN'||g.operation_id!==c.operation_id||!same(c.dom_cap,this.cap(a.effect_transition,g)))fail('UNAUTHORIZED_SENDER');if(!effectConfirmed(c.effect_evidence)&&!coverageConfirmed(c.coverage_evidence))fail('INVALID_EFFECT_EVIDENCE');tx.objectStore('metadata').add({key:'a1:dom:'+g.grant_id+':confirmed',record_kind:'DOM_EFFECT_PROOF',phase:'CONFIRMED',session_id:a.session_id,binding_id:b.scope.binding_id,transition_id:a.effect_transition.transition_id,grant:structuredClone(g),effect:structuredClone(c.effect_evidence),coverage:structuredClone(c.coverage_evidence),confirmed_at:Date.now()});g.phase='CONFIRMED';b.current_effect=structuredClone(c.effect_evidence);b.current_coverage=structuredClone(c.coverage_evidence);b.evidence_generation=a.generation;a.record_version=id();}
 async after(m){const b=await this.core.bundle();if(!this.pending(b?.a))return;if(m.payload.change?.kind==='LEDGER_PLAN'&&this.core.env.onEffectWait){this.reportPending=true;try{await this.core.env.onEffectWait();}catch(e){await this.core.markUnknown('STORE_UNCONFIRMED');throw e;}finally{this.reportPending=false;}}this.core.requestCheck();}
 async finish(bundle){
  this.check(bundle.a);if(this.reportPending||bundle.a.effect_transition.grants.some(g=>g.phase!=='CONFIRMED'))return false;
  const c=this.core,frames=[];for(const g of bundle.a.effect_transition.grants){const b=bundle.bindings.find(b=>b.scope.binding_id===g.binding_id),f=await c.p1.frame(b);if(f.url_sha256!==g.native_hash)fail('REVALIDATION_REQUIRED');frames.push([g,b,f]);}
  await c.updateBundle(bundle,({a,rows,tx})=>{this.check(a);for(const [g,b]of frames){const current=rows.find(x=>x.key===b.key),proof=rows.find(x=>x.key==='a1:p1:NATIVE_BINDING_PROOF:'+g.binding_id),op=rows.find(x=>x.record_kind==='A1_OPERATION'&&x.operation_id===g.operation_id&&x.binding_id===g.binding_id),receipt=rows.find(x=>x.key==='a1:receipt:'+g.binding_id+':'+g.plan_write_id);if(!current||current.record_version!==b.record_version||proof?.record_version!==g.proof_version||op?.fingerprint!==g.operation_fingerprint||!receipt?.first_response||current.resolution!=='NONE')fail('GENERATION_CHANGED');current.ordinary_authority='ACTIVE';current.record_version=id();tx.objectStore('metadata').put(current);}a.effect_transition.phase='READY';a.record_version=id();tx.objectStore('metadata').put(a);return a;},{domFinalize:true});return true;
 }
}
