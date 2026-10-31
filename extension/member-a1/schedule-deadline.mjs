import {digest, same} from './contract.mjs';
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const PREFIX='member:schedule-deadline:';
const ALARM='focurve-member-fixed-end:';
const terminal=s=>['ENDED','START_FAILED','INTERRUPTED'].includes(s);
const fail=code=>{throw Error(code);};
const utc=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(Date.parse(v)).toISOString()===v;
function validatePlan(p){
 if(!p||Object.keys(p).sort().join(',')!=='command_id,occurrence_id,schedule_id,schedule_version,scheduled_end_at,scheduled_start_at,session_id'
   ||['command_id','occurrence_id','schedule_id','session_id'].some(k=>typeof p[k]!=='string'||!UUID.test(p[k]))
   ||!Number.isSafeInteger(p.schedule_version)||p.schedule_version<1||!utc(p.scheduled_start_at)||!utc(p.scheduled_end_at))fail('INVALID_SCHEDULE_DEADLINE');
 const length=Date.parse(p.scheduled_end_at)-Date.parse(p.scheduled_start_at);
 if(length<60000||length>180*60000||length%60000!==0)fail('INVALID_SCHEDULE_DEADLINE');
}
/** Opt-in internal service for an ALREADY admitted session. Does not start a
 * session or grant PR46 readiness. Production admission/clock verification and
 * before-APPLY / Worker alarm wiring are required before activation.
 */
export class ScheduleDeadline {
 constructor(core,{verifyScheduledAdmission=()=>false}={}){this.core=core;this.verify=verifyScheduledAdmission;}
 async read(sessionId){
  const row=await this.core.store.read(PREFIX+sessionId);if(!row)return null;
  const {sha256,...payload}=row;
  if(await digest(payload)!==sha256||row.key!==PREFIX+sessionId||row.version!==1
    ||!['ARMED','ENDING','RELEASED'].includes(row.phase)
    ||!Number.isFinite(row.anchor_wall)||!Number.isFinite(row.anchor_mono)||row.anchor_mono<0
    ||typeof row.boot_epoch!=='string'||!UUID.test(row.boot_epoch)
    ||typeof row.owner_fence!=='string'||!UUID.test(row.owner_fence)
    ||typeof row.executor_id!=='string'||!UUID.test(row.executor_id)
    ||typeof row.owner_key!=='string'||!/^MEMBER:[1-9][0-9]*$/.test(row.owner_key)
    ||!Number.isSafeInteger(row.command_revision)||row.command_revision<1)fail('INVALID_SCHEDULE_DEADLINE_RECORD');
  validatePlan(row.plan);return row;
 }
 scope(b,row){
  const s=b?.state?.session,a=b?.a,c=s?.member_admission?.command;
  if(!b||a.session_id!==row.plan.session_id||s.start_request_id!==row.plan.command_id||c?.command_id!==row.plan.command_id
    ||a.owner_context!==row.owner_key||a.executor_id!==row.executor_id||b.ownerFenceEpoch!==row.owner_fence
    ||!same(a.snapshot_ref,row.snapshot_ref)||c.desired_revision!==row.command_revision)fail('STALE_SCHEDULE_SCOPE');
  if(a.boot_epoch!==this.core.boot||row.boot_epoch!==this.core.boot)fail('SCHEDULE_DEADLINE_REVALIDATION_REQUIRED');
 }
 async save(payload,expected,b){
  const row={...payload,sha256:await digest(payload)},c=this.core;
  return c.store.atomic((tx,done,reject)=>{
   const md=tx.objectStore('metadata'),keys=[row.key,'current','a1:aggregate:'+row.plan.session_id,'a1:owner-fence'],found={};let pending=keys.length;
   for(const key of keys){const q=md.get(key);q.onsuccess=()=>{
    found[key]=q.result;if(--pending)return;
    try{
     const current=found.current,a=found['a1:aggregate:'+row.plan.session_id],f=found['a1:owner-fence'];
     if((found[row.key]?.sha256??null)!==expected)fail('SCHEDULE_DEADLINE_CAS_CONFLICT');
     if(current?.session_id!==row.plan.session_id||current.owner_key!==row.owner_key||a?.record_version!==b.a.record_version
       ||a.boot_epoch!==c.boot||f?.epoch!==row.owner_fence||f.owner_context!==row.owner_key||f.transitioning)fail('STALE_SCHEDULE_SCOPE');
     md.put(row);done(row);
    }catch(error){reject(error);}
   };}
  });
 }
 arm(input){const plan=structuredClone(input);return this.core.serial(async()=>{
  validatePlan(plan);await this.core.ready;const b=await this.core.bundle();
  if(!b||terminal(b.a.session_status)||b.a.intent==='END')fail('SCHEDULE_SESSION_NOT_ACTIVE');
  const clock={wall:this.core.now(),mono:this.core.mono(),boot:this.core.boot};
  if(!Number.isFinite(clock.wall)||!Number.isFinite(clock.mono)||clock.mono<0||clock.wall<Date.parse(plan.scheduled_start_at))fail('SCHEDULE_CLOCK_UNCONFIRMED');
  if(await this.verify(structuredClone(plan),{session:structuredClone(b.state.session),generation:b.a.generation,clock:structuredClone(clock)})!==true)fail('SCHEDULE_ADMISSION_UNVERIFIED');
  const existing=await this.read(plan.session_id);
  if(existing&&!same(existing.plan,plan))fail('SCHEDULE_DEADLINE_CONFLICT');
  const {sha256:_ignored,...prior}=existing??{};
  const row={key:PREFIX+plan.session_id,version:1,plan,owner_key:b.a.owner_context,executor_id:b.a.executor_id,
   owner_fence:b.ownerFenceEpoch,snapshot_ref:structuredClone(b.a.snapshot_ref),command_revision:b.state.session.member_admission.command.desired_revision,
   boot_epoch:this.core.boot,anchor_wall:clock.wall,anchor_mono:clock.mono,phase:existing?.phase??'ARMED'};
  this.scope(b,row);
  if(existing){
   // Revalidation may replace a lost boot anchor, never deadline or owner scope.
   if(existing.owner_key!==row.owner_key||existing.executor_id!==row.executor_id||existing.owner_fence!==row.owner_fence
     ||!same(existing.snapshot_ref,row.snapshot_ref)||existing.command_revision!==row.command_revision)fail('STALE_SCHEDULE_SCOPE');
   if(existing.boot_epoch===row.boot_epoch){row.anchor_wall=prior.anchor_wall;row.anchor_mono=prior.anchor_mono;}
  }
  if(!Number.isFinite(row.anchor_wall)||!Number.isFinite(row.anchor_mono)||row.anchor_mono<0)fail('SCHEDULE_CLOCK_UNCONFIRMED');
  const saved=await this.save(row,existing?.sha256??null,b);return this.enforce(saved);
 });}
 check(sessionId){if(!UUID.test(sessionId))return Promise.reject(Error('INVALID_SCHEDULE_DEADLINE'));return this.core.serial(async()=>{
  await this.core.ready;const row=await this.read(sessionId);if(!row)fail('SCHEDULE_DEADLINE_NOT_FOUND');return this.enforce(row);
 });}
 async enforce(row){
  const c=this.core;let b=await c.bundle();this.scope(b,row);
  const wall=c.now(),mono=c.mono();
  if(!Number.isFinite(wall)||!Number.isFinite(mono)||mono<row.anchor_mono)fail('SCHEDULE_CLOCK_UNCONFIRMED');
  // Admission must verify the captured UTC/mono anchor. Later wall jumps must
  // neither extend nor shorten physical remaining time on that same boot.
  const remaining=Date.parse(row.plan.scheduled_end_at)-row.anchor_wall-(mono-row.anchor_mono);
  if(row.phase==='ARMED'&&remaining>0&&!terminal(b.a.session_status)){
   await c.chrome.alarms.create(ALARM+row.plan.session_id,{when:wall+remaining});
   return {state:'WAITING',fixed_end_at:row.plan.scheduled_end_at};
  }
  if(row.phase!=='RELEASED'){
   const {sha256,...payload}=row;
   row=await this.save({...payload,phase:'ENDING'},sha256,b);
   if(!terminal(b.a.session_status)){
    await c.endIntent(row.plan.session_id,'TIME_LIMIT');
    b=await c.bundle();this.scope(b,row);
    await c.finish();
   }
   b=await c.bundle();this.scope(b,row);
  }
  if(!terminal(b.a.session_status)||b.a.cleanup_pending||b.state.journal.desired!=='RELEASED'||b.state.journal.observed!=='RELEASED'
    ||b.bindings.some(x=>x.resolution==='NONE'||x.cleanup_pending))fail('SCHEDULE_RELEASE_UNCONFIRMED');
  if(row.phase!=='RELEASED'){const {sha256,...payload}=row;await this.save({...payload,phase:'RELEASED'},sha256,b);}
  await c.chrome.alarms.clear(ALARM+row.plan.session_id);
  return {state:'RELEASED',fixed_end_at:row.plan.scheduled_end_at};
 }
 onAlarm(alarm){const name=alarm?.name;if(typeof name!=='string'||!name.startsWith(ALARM))return Promise.resolve(null);return this.check(name.slice(ALARM.length));}
}
