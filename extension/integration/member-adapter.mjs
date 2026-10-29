import {MemberAuth} from '../src/member-auth.js';
import {MemberExecutionClient,MemberReportStore} from '../src/member-execution-client.js';
import {MemberExecutionLoop} from '../src/member-execution-loop.js';
import {MemberJournalStore} from '../src/member-journal-store.js';
import {MemberAccessStore} from '../src/member-access.js';
import {MemberEventStore,MemberEventDelivery,transferOriginals} from '../src/member-events.js';
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(x);
// Background-only composition of existing contracts. Never accepts Content credentials.
// This adapter deliberately retains the member site-only capability boundary.
export class MemberIntegrationAdapter {
 constructor({authStore,getInstallation,inspectIdle,callbackUri,clientVersion,openApproval,indexedDB,
  dnr,tabs,blockedPageUrl,fetch=globalThis.fetch.bind(globalThis),now=Date.now}){
  Object.assign(this,{indexedDB,dnr,tabs,blockedPageUrl,fetch,now,inspectIdle});this.tail=Promise.resolve();
  this.auth=new MemberAuth({store:authStore,getInstallation,inspectIdle,callbackUri,clientVersion,openApproval,fetch,now});
 }
 serial(f){const p=this.tail.then(f);this.tail=p.catch(()=>{});return p;}
 connect(config){return this.serial(()=>this.auth.begin(config));}
 pollLink(){return this.serial(()=>this.auth.poll());}
 async ensure(){const status=await this.auth.status();if(status.phase!=='LINKED')throw Error('MEMBER_AUTH_REQUIRED');
  if(this.base&&this.base!==status.server_url)throw Error('EXECUTION_SCOPE_MISMATCH');
  if(this.loop)return;
  this.base=status.server_url;const getIdentity=async()=>{const s=await this.auth.status();if(s.server_url!==this.base||!s.owner_user_id)throw Error('EXECUTION_SCOPE_MISMATCH');return {owner_key:'MEMBER:'+s.owner_user_id,executor_id:s.executor_id};};
  const getCredentials=async()=>{const before=await getIdentity(),c=await this.auth.credentials(),after=await getIdentity();if(c.owner_key!==before.owner_key||c.executor_id!==before.executor_id||c.owner_key!==after.owner_key||c.executor_id!==after.executor_id)throw Error('EXECUTION_SCOPE_MISMATCH');return c;};
  this.getIdentity=getIdentity;const tag=encodeURIComponent(this.base),db=this.indexedDB;
  this.client=new MemberExecutionClient({baseUrl:this.base,getCredentials,fetch:this.fetch,now:this.now,store:new MemberReportStore({indexedDB:db,name:'integration-reports:'+tag})});
  this.loop=new MemberExecutionLoop({client:this.client,getCredentials,getIdentity,idle:async()=>{const s=await this.inspectIdle();if(s.active_session_id!==null||s.owned_rule_ids.length||s.pending_action_count)throw Error('GUEST_SESSION_ACTIVE');},dnr:this.dnr,tabs:this.tabs,blockedPageUrl:this.blockedPageUrl,now:this.now,
   journal:new MemberJournalStore({indexedDB:db,name:'integration-journal:'+tag}),control:new MemberJournalStore({indexedDB:db,name:'integration-control:'+tag}),accessStore:new MemberAccessStore({indexedDB:db,name:'integration-access:'+tag})});
  this.delivery=new MemberEventDelivery({baseUrl:this.base,getCredentials,fetch:this.fetch,now:this.now,store:new MemberEventStore({indexedDB:db,name:'integration-events:'+tag})});
 }
 start(minutes,key){return this.serial(async()=>{if(!Number.isInteger(minutes)||minutes<1||minutes>180||!uuid(key))throw Error('INVALID_SESSION');await this.ensure();const c=await this.client.credentials(),s=await this.client.request('/sessions',c,JSON.stringify({executor_id:c.executor_id,duration_minutes:minutes}),{'Idempotency-Key':key});const fresh=await this.getIdentity();if(s.executor_id!==c.executor_id||fresh.owner_key!==c.owner_key||fresh.executor_id!==c.executor_id||!uuid(s.session_id)||s.execution_status!=='STARTING')throw Error('INVALID_SESSION_RESPONSE');return {session_id:s.session_id,execution_status:'STARTING'};});}
 async deliver(){const scope=await this.getIdentity(),originals=await this.loop.access.store.originals(scope.owner_key,scope.executor_id,this.base);const transferred=await transferOriginals(originals,this.loop.access.store,this.delivery),rows=await this.delivery.flush();const fresh=await this.getIdentity();if(fresh.owner_key!==scope.owner_key||fresh.executor_id!==scope.executor_id)throw Error('EXECUTION_SCOPE_MISMATCH');for(const o of transferred)if(rows.some(r=>r.owner_key===o.owner_key&&r.executor_id===o.executor_id&&r.event_id===o.event_id&&r.body===o.body&&['ACKED','REJECTED'].includes(r.status)))await this.loop.access.store.acknowledged(o.scope,o.event_id);return rows.map(r=>({event_id:r.event_id,status:r.status}));}
 tick(){return this.serial(async()=>{await this.ensure();const view=await this.loop.tick();await this.deliver();return view;});}
 end(session,key){return this.serial(async()=>{if(!uuid(session)||!uuid(key))throw Error('INVALID_SESSION');await this.ensure();await this.client.end(session,key);return this.loop.tick();});}
 observe(stage,nativeDetails){return this.serial(async()=>{if(!this.loop||this.loop.view.status!=='RUNNING')return null;await this.ensure();const e=await this.loop.observe(stage,nativeDetails);if(e)await this.deliver();return e?{event_id:e.event_id}:null;});}
 async status(){return {auth:await this.auth.status(),execution:structuredClone(this.loop?.view??{status:'UNLINKED',session_id:null})};}
}
