/* Background-only member event adapter. No guest upload or token refresh is implicit. */
(() => {
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const integer=n=>Number.isSafeInteger(n)&&n>0;
 const keys=(value,allowed)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>allowed.includes(k));
 const canonicalHost=value=>typeof value==='string'&&value.length<=253&&value.includes('.')&&!value.endsWith('.localhost')&&!/^[0-9.]+$/.test(value)&&value.split('.').every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))&&globalThis.FocurveHostPolicy.normalize('https://'+value)===value;
 const fail=()=>{throw new Error('INVALID_EVENT_CONTRACT');};
 function validate(event){
  if(!keys(event,['schema_version','event_id','executor_id','session_id','policy_snapshot_id','event_type','occurred_at','local_seq','payload'])||!['1.1','1.2'].includes(event.schema_version)||!integer(event.local_seq))fail();
  for(const key of ['event_id','executor_id','session_id','policy_snapshot_id'])if(!UUID.test(event[key]))fail();
  if(typeof event.occurred_at!=='string'||!/^\d{4}-\d\d-\d\dT.*Z$/.test(event.occurred_at)||!Number.isFinite(Date.parse(event.occurred_at)))fail();
  if(['SESSION_STARTED','SESSION_ENDED'].includes(event.event_type)){if(!keys(event.payload,[]))fail();return event;}
  const p=event.payload,modern=event.schema_version==='1.2';
  if(!keys(p,['access_seq','navigation_id','target_kind','target_host','target_key','reason','feature_code','rule_id',...(modern?['matched_policy_host','blocked_reasons']:[])])||!integer(p.access_seq)||!UUID.test(p.navigation_id)||!['SITE','FEATURE'].includes(p.target_kind))fail();
  const host=p.target_host;
  if(!canonicalHost(host))fail();
  if(p.target_key!==(modern?host:p.target_kind==='SITE'?`SITE:${host}`:`FEATURE:${host}:${p.feature_code}`))fail();
  if(modern){
   if(!Object.hasOwn(p,'matched_policy_host')||p.matched_policy_host!==null&&!canonicalHost(p.matched_policy_host))fail();
   if(!Array.isArray(p.blocked_reasons)||new Set(p.blocked_reasons).size!==p.blocked_reasons.length||p.blocked_reasons.some(r=>!['USER_SITE','ADULT_DOMAIN','KEYWORD','FEATURE'].includes(r)))fail();
   const primary=['USER_SITE','ADULT_DOMAIN','KEYWORD','FEATURE'].find(r=>p.blocked_reasons.includes(r));
   if(event.event_type==='RECORDED_ACCESS'){if(p.reason!=='RECORD'||primary||p.target_kind!=='SITE')fail();}
   else if(!primary||p.reason!==primary)fail();
   const feature=p.blocked_reasons.includes('FEATURE');
   if(event.event_type!=='RECORDED_ACCESS'&&(event.event_type!==(feature?'BLOCKED_FEATURE_ACCESS':'BLOCKED_SITE_ACCESS')||p.target_kind!==(feature?'FEATURE':'SITE')))fail();
  }else if(!['USER_SITE','FEATURE','RECORD'].includes(p.reason))fail();
  if(!['RECORDED_ACCESS','BLOCKED_SITE_ACCESS','BLOCKED_FEATURE_ACCESS'].includes(event.event_type))fail();
  if(p.target_kind==='FEATURE'&&(p.feature_code!=='YOUTUBE_SHORTS'||!(host==='youtube.com'||host.endsWith('.youtube.com'))))fail();
  if(p.target_kind==='SITE'&&p.feature_code!=null)fail();
  if(!modern&&(event.event_type==='RECORDED_ACCESS'&&(p.reason!=='RECORD'||p.target_kind!=='SITE')||event.event_type==='BLOCKED_SITE_ACCESS'&&(p.reason!=='USER_SITE'||p.target_kind!=='SITE')||event.event_type==='BLOCKED_FEATURE_ACCESS'&&(p.reason!=='FEATURE'||p.target_kind!=='FEATURE')))fail();
  return event;
 }
 class MemberEventStore{
  constructor({indexedDB=globalThis.indexedDB,name='focurve-member-events'}={}){this.indexedDB=indexedDB;this.name=name;}
  async transaction(mode,work){
   const db=await new Promise((resolve,reject)=>{const r=this.indexedDB.open(this.name,1);r.onupgradeneeded=()=>r.result.createObjectStore('events',{keyPath:['owner_key','event_id']});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(new Error('MEMBER_STORAGE_UNAVAILABLE'));r.onblocked=()=>reject(new Error('MEMBER_STORAGE_BLOCKED'));});
   try{return await new Promise((resolve,reject)=>{const tx=db.transaction('events',mode);let value;tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(new Error('MEMBER_STORAGE_UNAVAILABLE'));try{work(tx.objectStore('events'),result=>{value=result;});}catch{tx.abort();}});}finally{db.close();}
  }
  put(record){return this.transaction('readwrite',(store,done)=>{const r=store.get([record.owner_key,record.event_id]);r.onsuccess=()=>{if(r.result&&r.result.body!==record.body){store.transaction.abort();return;}store.put(record);done(record);};});}
  get(owner,id){return this.transaction('readonly',(store,done)=>{const r=store.get([owner,id]);r.onsuccess=()=>done(r.result||null);});}
  list(owner,executor){return this.transaction('readonly',(store,done)=>{const r=store.getAll();r.onsuccess=()=>done(r.result.filter(item=>item.owner_key===owner&&item.executor_id===executor));});}
 }
 class MemberEventDelivery{
  constructor({baseUrl,store,getCredentials,fetch=globalThis.fetch.bind(globalThis),now=Date.now,random=Math.random,timeoutMs=10000}){
   const url=new URL(baseUrl);
   if(url.username||url.password||url.search||url.hash||url.pathname!=='/api/v1'||url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw new Error('INVALID_SERVER_URL');
   Object.assign(this,{baseUrl:url.href,store,getCredentials,fetch,now,random,timeoutMs});this.queue=Promise.resolve();
  }
  serial(fn){const result=this.queue.then(fn);this.queue=result.catch(()=>{});return result;}
  async credentials(){const c=await this.getCredentials();if(!c||!/^MEMBER:[1-9][0-9]*$/.test(c.owner_key)||!UUID.test(c.executor_id)||typeof c.access_token!=='string'||!c.access_token||/[\r\n]/.test(c.access_token))throw new Error('MEMBER_AUTH_REQUIRED');return {...c};}
  async scope(expected){const c=await this.credentials();if(c.owner_key!==expected.owner_key||c.executor_id!==expected.executor_id)throw new Error('MEMBER_OWNER_CHANGED');return c;}
  enqueue(event){return this.serial(async()=>{
   const c=await this.credentials();validate(event);if(event.executor_id!==c.executor_id)throw new Error('EXECUTOR_MISMATCH');
   const body=JSON.stringify(event);if(new TextEncoder().encode(body).length>1048500)throw new Error('EVENT_TOO_LARGE');
   const old=await this.store.get(c.owner_key,event.event_id);if(old){if(old.body!==body)throw new Error('EVENT_CONFLICT');return old;}
   return this.store.put({owner_key:c.owner_key,executor_id:c.executor_id,event_id:event.event_id,body,status:'QUEUED',attempts:0,next_attempt_at:0,error:null});
  });}
  async request(endpoint,data,scope){
   const c=await this.scope(scope);const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),this.timeoutMs);
   try{
    const response=await this.fetch(this.baseUrl+endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+c.access_token},body:JSON.stringify(data),signal:controller.signal,redirect:'error',credentials:'omit',cache:'no-store'});
    if(!response.ok){const error=new Error(response.status===401||response.status===403?'MEMBER_AUTH_REQUIRED':'HTTP_'+response.status);error.httpStatus=response.status;throw error;}
    return await response.json();
   }finally{clearTimeout(timer);}
  }
  async uncertain(record,error){const attempts=record.attempts+1;return this.store.put({...record,status:error==='MEMBER_AUTH_REQUIRED'?'AUTH_REQUIRED':'RESPONSE_UNCONFIRMED',attempts,next_attempt_at:this.now()+Math.min(30000,1000*2**Math.min(attempts-1,5))*(1+this.random()*.2),error});}
  async results(records,response,statusLookup){
   if(!Array.isArray(response?.items))throw new Error('INVALID_EVENT_RESPONSE');
   const ids=new Set(records.map(r=>r.event_id));const duplicate=new Set();const byId=new Map();
   for(const item of response.items){if(!item||!ids.has(item.event_id))throw new Error('INVALID_EVENT_RESPONSE');if(byId.has(item.event_id))duplicate.add(item.event_id);byId.set(item.event_id,item);}
   for(const record of records){
    const item=byId.get(record.event_id);const status=item?.status;
    if(!item||duplicate.has(record.event_id)||!['ACCEPTED','DUPLICATE','PENDING_DEPENDENCY','REJECTED',...(statusLookup?['NOT_RECEIVED']:[])].includes(status)||['ACCEPTED','DUPLICATE'].includes(status)&&item.error!=null){await this.uncertain(record,'INVALID_EVENT_RESPONSE');continue;}
    const state=['ACCEPTED','DUPLICATE'].includes(status)?'ACKED':status==='NOT_RECEIVED'?'QUEUED':status;
    await this.store.put({...record,status:state,error:status==='REJECTED'?(typeof item.error==='string'?item.error:'EVENT_REJECTED'):null,next_attempt_at:state==='QUEUED'?0:this.now()+30000});
   }
  }
  flush(){return this.serial(async()=>{
   const c=await this.credentials();let records=await this.store.list(c.owner_key,c.executor_id);
   const unresolved=records.filter(r=>['IN_FLIGHT','RESPONSE_UNCONFIRMED','PENDING_DEPENDENCY','AUTH_REQUIRED'].includes(r.status)&&r.next_attempt_at<=this.now()).slice(0,100);
   if(unresolved.length){
    try{await this.results(unresolved,await this.request('/events/status',{event_ids:unresolved.map(r=>r.event_id)},c),true);}
    catch(error){for(const r of unresolved)await this.uncertain(r,error.message);return this.store.list(c.owner_key,c.executor_id);}
   }
   records=await this.store.list(c.owner_key,c.executor_id);
   const batch=[];let bytes=14;
   for(const r of records.filter(r=>r.status==='QUEUED'&&r.next_attempt_at<=this.now()).sort((a,b)=>JSON.parse(a.body).local_seq-JSON.parse(b.body).local_seq)){
    const size=new TextEncoder().encode(r.body).length+1;if(batch.length===100||bytes+size>1048576)break;batch.push(r);bytes+=size;
   }
   if(batch.length){
    for(const r of batch)await this.store.put({...r,status:'IN_FLIGHT'});
    try{await this.results(batch,await this.request('/events/batch',{events:batch.map(r=>JSON.parse(r.body))},c),false);}
    catch(error){for(const r of batch){const current=await this.store.get(c.owner_key,r.event_id);if(current?.status!=='ACKED'&&current?.status!=='REJECTED')await this.uncertain(current||r,error.message);}}
   }
   return this.store.list(c.owner_key,c.executor_id);
  });}
 }
 globalThis.FocurveMemberEvents=Object.freeze({validate,MemberEventStore,MemberEventDelivery});
})();
