export const MODE='MEMBER_A1_CONFIRMED_1';
export const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(x);
const ms=x=>typeof x==='string'&&/Z$/.test(x)?Date.parse(x):NaN;
const canonical=v=>JSON.stringify(Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])):v);
export const equal=(a,b)=>canonical(a)===canonical(b);
export function validateReport(r,{local=false}={}){
 if(!r||Object.keys(r).some(k=>!['report_id','command_id','session_id','executor_id','desired_revision','result','observed_at','intervals','error_code','rollback_confirmed','local_action_seq','transition_context','effect_transition_context','effect_cancel_ref'].includes(k))||!uuid(r.report_id)||!uuid(r.session_id)||!uuid(r.executor_id)||(!local&&!uuid(r.command_id))||(local&&r.command_id!==null)||!Number.isSafeInteger(r.desired_revision)||r.desired_revision<1||!Number.isFinite(ms(r.observed_at))||!['APPLIED','RELEASED','FAILED','UNCONFIRMED','REVALIDATING','EFFECT_VERIFYING'].includes(r.result)||!Array.isArray(r.intervals)||r.intervals.length>512)throw Error('INVALID_MEMBER_REPORT');
 if(r.transition_context){const n=r.transition_context;if(Object.keys(n).some(k=>!['version','transition_id','root_generation','phase','started_at','deadline_at','root_evidence_sha256','transition_kind','document_transition_contract'].includes(k))||n.version!=='NR01_1'||(n.transition_kind!==undefined&&(n.transition_kind!=='DOCUMENT_ADDITION'||n.document_transition_contract!=='ND01_1'))||(n.document_transition_contract!==undefined&&n.transition_kind!=='DOCUMENT_ADDITION')||!uuid(n.transition_id)||!Number.isSafeInteger(n.root_generation)||n.root_generation<1||!['VERIFYING','CONFIRMED','FAILED'].includes(n.phase)||!Number.isFinite(ms(n.started_at))||!Number.isFinite(ms(n.deadline_at))||ms(n.deadline_at)<=ms(n.started_at)||ms(n.deadline_at)-ms(n.started_at)>5000||!/^[a-f0-9]{64}$/.test(n.root_evidence_sha256)||r.result==='REVALIDATING'&&n.phase!=='VERIFYING'||r.result==='APPLIED'&&n.phase!=='CONFIRMED')throw Error('INVALID_MEMBER_REPORT');}else if(r.result==='REVALIDATING')throw Error('INVALID_MEMBER_REPORT');
 if(r.effect_cancel_ref&&(!uuid(r.effect_cancel_ref)||r.result!=='REVALIDATING'||!r.transition_context||r.effect_transition_context))throw Error('INVALID_MEMBER_REPORT');if(r.effect_transition_context){const n=r.effect_transition_context;if(r.transition_context||Object.keys(n).some(k=>!['version','transition_id','root_generation','phase','started_at','deadline_at','root_evidence_sha256'].includes(k))||n.version!=='DP01_1'||!uuid(n.transition_id)||!Number.isSafeInteger(n.root_generation)||n.root_generation<1||!['VERIFYING','CONFIRMED','FAILED'].includes(n.phase)||!Number.isFinite(ms(n.started_at))||!Number.isFinite(ms(n.deadline_at))||ms(n.deadline_at)<=ms(n.started_at)||ms(n.deadline_at)-ms(n.started_at)>3000||!/^[a-f0-9]{64}$/.test(n.root_evidence_sha256)||r.result==='EFFECT_VERIFYING'&&n.phase!=='VERIFYING'||r.result==='APPLIED'&&n.phase!=='CONFIRMED')throw Error('INVALID_MEMBER_REPORT');}else if(r.result==='EFFECT_VERIFYING')throw Error('INVALID_MEMBER_REPORT');
 const seen=new Set();for(const i of r.intervals){const a=ms(i.start_at),b=i.end_at==null?null:ms(i.end_at);if(Object.keys(i).some(k=>!['interval_id','kind','start_at','end_at','duration_ms','quality'].includes(k))||!uuid(i.interval_id)||seen.has(i.interval_id)||i.kind!=='RUN'||i.quality!=='CONFIRMED'||!Number.isFinite(a)||a>ms(r.observed_at)||b!==null&&(!Number.isFinite(b)||b<a||b>ms(r.observed_at)||i.duration_ms!==b-a))throw Error('INVALID_MEMBER_INTERVAL');seen.add(i.interval_id);}
 if(['RELEASED','REVALIDATING','EFFECT_VERIFYING'].includes(r.result)&&r.intervals.some(i=>i.end_at==null))throw Error('INVALID_MEMBER_INTERVAL');
 return r;
}
export function mergeIntervals(previous,report){
 validateReport(report,{local:report.command_id===null});const rows=structuredClone(previous),until=ms(report.observed_at);
 for(const i of report.intervals){const old=rows.find(x=>x.interval_id===i.interval_id);if(old){if(old.start_at!==i.start_at||old.kind!==i.kind||old.quality!==i.quality||old.end_at!=null&&!equal(old.interval,i))throw Error('INTERVAL_CONFLICT');if(old.end_at!=null)continue;if(i.end_at==null){old.confirmed_until=Math.max(old.confirmed_until,until);continue;}if(ms(i.end_at)<old.confirmed_until)throw Error('INTERVAL_CONFLICT');Object.assign(old,{end_at:i.end_at,interval:structuredClone(i),confirmed_until:ms(i.end_at)});}else rows.push({...structuredClone(i),interval:structuredClone(i),confirmed_until:i.end_at==null?until:ms(i.end_at)});}
 const sorted=[...rows].sort((a,b)=>ms(a.start_at)-ms(b.start_at));for(let j=1;j<sorted.length;j++)if(sorted[j-1].confirmed_until>ms(sorted[j].start_at))throw Error('INTERVAL_OVERLAP');
 return {rows,confirmed_run_ms:rows.reduce((n,i)=>n+Math.max(0,i.confirmed_until-ms(i.start_at)),0)};
}
function validateCommand(command,session,identity,now,continuation=false){
 if(!command||!uuid(command.command_id)||!uuid(command.session_id)||command.session_id!==session?.session_id||session.owner_user_id!==identity.owner_key.slice(7)||!uuid(command.executor_id)||command.executor_id!==identity.executor_id||session.executor_id!==identity.executor_id||command.desired_revision!==session.desired_revision||!Number.isSafeInteger(command.desired_revision)||command.desired_revision<1||!['APPLY_POLICY','RELEASE_POLICY'].includes(command.type))throw Error('MEMBER_COMMAND_REJECTED');
 // The Server issues these fields from the stored session. Bind both presence
 // and version before the Adapter claims root authority or persists admission.
 if(command.type==='APPLY_POLICY'){
  for(const [field,version] of [['native_transition_contract','NR01_1'],['dom_transition_contract','DP01_1'],['document_transition_contract','ND01_1']]){
   const requested=command[field];if(requested!==session[field]||requested!==undefined&&requested!==version)throw new Error('MEMBER_COMMAND_REJECTED',{cause:{stage:'COMMAND_CONTRACT',rejected_fields:[field]}});
  }
  for(const field of ['dom_transition_contract','document_transition_contract'])if(command[field]!==undefined&&command.native_transition_contract!=='NR01_1')throw new Error('MEMBER_COMMAND_REJECTED',{cause:{stage:'COMMAND_CONTRACT',rejected_fields:[field]}});
 }
 if(command.type==='APPLY_POLICY'&&(!(['STARTING','RUNNING','UNKNOWN'].includes(session.execution_status)||session.execution_status==='NATIVE_VERIFYING'&&command.native_transition_contract==='NR01_1'&&session.native_transition_contract==='NR01_1'&&!session.first_nr_failure||session.execution_status==='EFFECT_VERIFYING'&&command.dom_transition_contract==='DP01_1'&&session.dom_transition_contract==='DP01_1'&&!session.first_dp_failure)||session.time_accounting_mode!==MODE||session.policy_snapshot_id!==command.snapshot?.policy_snapshot_id||command.snapshot.executor_id!==identity.executor_id||'MEMBER:'+command.snapshot.owner_user_id!==identity.owner_key||session.duration_minutes!==command.duration_minutes||!Number.isFinite(ms(command.execute_before))))throw Error('MEMBER_COMMAND_REJECTED');
 // Expiration is classified only after owner, executor, revision, Snapshot and
 // transition-contract validation. Only this narrow case permits normal expiry END.
 if(command.type==='APPLY_POLICY'&&!continuation&&ms(command.execute_before)<=now)throw new Error('MEMBER_COMMAND_REJECTED',{cause:{stage:'COMMAND_EXPIRY',rejected_fields:['execute_before']}});
 if(command.type==='RELEASE_POLICY'&&!['ENDING','UNKNOWN','STARTING','START_FAILED','ENDED'].includes(session.execution_status))throw Error('MEMBER_COMMAND_REJECTED');return true;
}

// A consumed START deadline is not an ongoing session lease. Continuation is
// permitted only for the already-started, exact admitted command, with fresh
// Server identity/revision checks performed by assertApply. New commands still expire.
export function authorizeCommand(command,session,identity,now=Date.now()){
 return validateCommand(command,session,identity,now);
}
export function authorizeContinuation(command,session,identity,bundle,now=Date.now()){
 const local=bundle?.state?.session,a=bundle?.a,admission=local?.member_admission;
 const states=['RUNNING','NATIVE_VERIFYING','EFFECT_VERIFYING'];
 if(command?.type!=='APPLY_POLICY'||!local||!a||!states.includes(a.session_status)||!states.includes(session?.execution_status)||a.intent==='END'||a.nr_first_failure||session.first_nr_failure||session.first_dp_failure||a.native_transition?.phase==='FAILED'||a.effect_transition?.phase==='FAILED'||!equal(admission?.command,command)||local.session_id!==command.session_id||a.session_id!==command.session_id||!Number.isFinite(ms(local.started_at))||!Number.isFinite(ms(session.started_at))||ms(local.started_at)>ms(command.execute_before)||ms(session.started_at)>ms(command.execute_before)||ms(local.started_at)<ms(command.created_at)-60000||ms(session.started_at)<ms(command.created_at)-60000)throw Error('MEMBER_CONTINUATION_REJECTED');
 return validateCommand(command,session,identity,now,true);
}
