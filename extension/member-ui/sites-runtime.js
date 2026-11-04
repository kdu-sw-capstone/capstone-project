/* UI-only /sites transport. Credentials stay in the Worker; no policy execution. */
(function(root){
 'use strict';
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,id=/^[1-9][0-9]*$/;
 const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>keys.includes(k));
 const validName=value=>typeof value==='string'&&Boolean(value.trim())&&Array.from(value).length<=100&&!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value);
 function siteInput(s){
  if(!exact(s,['url','display_name','purpose','access_policy','include_subdomains','feature_policies'])||typeof s.url!=='string'||!s.url.trim()||s.url.length>2048||!validName(s.display_name)||!['FOCUS','DISTRACTION','GENERAL'].includes(s.purpose)||!(s.purpose==='DISTRACTION'?['BLOCK','RECORD']:['ALLOW']).includes(s.access_policy)||typeof s.include_subdomains!=='boolean'||!Array.isArray(s.feature_policies)||s.feature_policies.length>6)throw Error('INVALID_SITE');
  const seen=new Set();for(const f of s.feature_policies){if(!exact(f,['feature_code','enabled'])||typeof f.enabled!=='boolean'||!['YOUTUBE_SHORTS','YOUTUBE_RECOMMENDATIONS','YOUTUBE_COMMENTS','YOUTUBE_AUTOPLAY','INSTAGRAM_REELS','INSTAGRAM_RECOMMENDATIONS'].includes(f.feature_code)||seen.has(f.feature_code))throw Error('INVALID_SITE');seen.add(f.feature_code);}
  return structuredClone(s);
 }
 function publicSite(s){
  if(!s||!id.test(s.site_id??'')||!Number.isSafeInteger(s.version)||s.version<1||typeof s.canonical_host!=='string'||typeof s.display_name!=='string'||!Array.isArray(s.feature_policies)||typeof s.include_subdomains!=='boolean'||!['FOCUS','DISTRACTION','GENERAL'].includes(s.purpose)||!['BLOCK','RECORD','ALLOW'].includes(s.access_policy)||s.feature_policies.some(f=>!f||typeof f.feature_code!=='string'||typeof f.enabled!=='boolean'))throw Error('RESPONSE_UNCONFIRMED');
  // Same public SiteInput policy/name/features as MemberSites, not a frozen Snapshot.
  // Snapshot validation accepts a different feature subset and requires extra fields.
  try{
   siteInput({url:s.canonical_host,display_name:s.display_name,purpose:s.purpose,access_policy:s.access_policy,include_subdomains:s.include_subdomains,feature_policies:s.feature_policies});
   if(s.canonical_host.length>253||!s.canonical_host.includes('.')||s.canonical_host.endsWith('.localhost')||/^[0-9.]+$/.test(s.canonical_host)||!s.canonical_host.split('.').every(l=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(l)))throw Error();
   for(const f of s.feature_policies)if(!(f.feature_code.startsWith('YOUTUBE_')?['youtube.com','www.youtube.com']:['instagram.com','www.instagram.com']).includes(s.canonical_host))throw Error();
  }catch{throw Error('RESPONSE_UNCONFIRMED');}
  return {site_id:s.site_id,version:s.version,canonical_host:s.canonical_host,display_name:s.display_name,purpose:s.purpose,access_policy:s.access_policy,include_subdomains:s.include_subdomains,feature_policies:s.feature_policies.map(f=>({feature_code:f.feature_code,enabled:f.enabled}))};
 }
 function operation(action,p){
  if(action==='TIMING'&&exact(p,[])&&Object.keys(p).length===0)return {method:'TIMING'};
  if(action==='LIST'&&exact(p,['cursor'])&&(p.cursor===undefined||typeof p.cursor==='string'&&p.cursor.length<=2048))return {method:'GET',path:'/sites'+(p.cursor?'?cursor='+encodeURIComponent(p.cursor):'')};
  if(action==='GET'&&exact(p,['site_id'])&&id.test(p.site_id??''))return {method:'GET',path:'/sites/'+p.site_id};
  if(!['CREATE','UPDATE','DELETE'].includes(action)||!uuid.test(p?.key??''))throw Error('INVALID_REQUEST');
  const keys=action==='CREATE'?['site','key']:action==='UPDATE'?['site_id','version','site','key']:['site_id','version','key'];
  if(!exact(p,keys)||action!=='CREATE'&&(!id.test(p.site_id??'')||!Number.isSafeInteger(p.version)||p.version<1))throw Error('INVALID_REQUEST');
  return {method:action==='CREATE'?'POST':action==='UPDATE'?'PATCH':'DELETE',path:'/sites'+(action==='CREATE'?'':'/'+p.site_id),headers:{'Idempotency-Key':p.key,...(action==='CREATE'?{}:{'If-Match':'"'+p.version+'"'})},...(action==='DELETE'?{}:{body:siteInput(p.site)})};
 }
 function transport({getAdapter,getAuth,writeState,withServices,fetch:fetcher,timeoutMs=10000}){
  return async function handle(action,payload,expectedScope){
   let dispatched=false;
   let scope;
   try{
    const op=operation(action,payload);
    const data=await withServices(async()=>{
     const adapter=getAdapter(),auth=getAuth();if(!adapter||!auth||adapter.preservedEndScope)throw Error('MEMBER_AUTH_REQUIRED');
     const initial=await adapter.identity();
     scope={...initial};
     const same=i=>i.owner_key===initial.owner_key&&i.executor_id===initial.executor_id&&i.authority===initial.authority;
     if(expectedScope&&!same(expectedScope)||!['GET','TIMING'].includes(op.method)&&!expectedScope)throw Error('OWNER_MISMATCH');
     const assertCurrent=async()=>{if(getAdapter()!==adapter||getAuth()!==auth||!same(await adapter.identity()))throw Error('OWNER_MISMATCH');};
     if(op.method==='TIMING'){
      const fence=writeState();if(!fence||fence.pending)throw Error('AUTH_TRANSITION_ACTIVE');
      const before=await adapter.core.bundle(),status=await adapter.status(),b=await adapter.core.bundle();await assertCurrent();
      if(writeState()!==fence)throw Error('OWNER_MISMATCH');
      const a=b?.a,s=b?.state?.session,planned=s?.planned_end_at;
      const stable=Number.isSafeInteger(a?.generation)&&a.generation===before?.a?.generation&&a.session_id===before?.a?.session_id&&b.ownerFenceEpoch===before?.ownerFenceEpoch&&planned===before?.state?.session?.planned_end_at;
      const running=stable&&status.server_confirmed_running===true&&status.local_status==='RUNNING'&&a?.session_status==='RUNNING'&&a.intent!=='END'&&s?.status==='RUNNING'&&s.owner_key===initial.owner_key&&s.executor_id===initial.executor_id&&a.owner_context===initial.owner_key&&a.executor_id===initial.executor_id&&status.session_id===s.session_id&&a.session_id===s.session_id&&planned===a.time?.planned_end_at&&Number.isFinite(Date.parse(planned));
      return {planned_end_at:running?planned:null,session_id:running?s.session_id:null,server_confirmed_running:!!running};
     }
     const credentials=await auth.credentials();await assertCurrent();
     if(credentials.owner_key!==initial.owner_key||credentials.executor_id!==initial.executor_id)throw Error('OWNER_MISMATCH');
     const fence=writeState();if(!fence||fence.pending)throw Error('AUTH_TRANSITION_ACTIVE');
     const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
     try{
      // No await between the final fence check and request dispatch.
      if(writeState()!==fence)throw Error('AUTH_TRANSITION_ACTIVE');dispatched=true;
      const response=await fetcher(initial.authority+op.path,{method:op.method,redirect:'error',credentials:'omit',cache:'no-store',signal:controller.signal,headers:{Authorization:'Bearer '+credentials.access_token,'Content-Type':'application/json',...op.headers},...(op.body===undefined?{}:{body:JSON.stringify(op.body)})});
      await assertCurrent();if(writeState()!==fence||fence.pending)throw Error('OWNER_MISMATCH');
      if(!response.ok){let code='SITE_REQUEST_FAILED';try{const e=await response.json();if(typeof e?.error?.code==='string')code=e.error.code;}catch{}await assertCurrent();if(writeState()!==fence)throw Error('OWNER_MISMATCH');const error=Error(code);error.status=response.status;throw error;}
      if(op.method==='DELETE'){if(response.status!==204)throw Error('RESPONSE_UNCONFIRMED');return {site_id:payload.site_id,deleted:true};}
      const result=await response.json();await assertCurrent();if(writeState()!==fence)throw Error('OWNER_MISMATCH');
      if(action==='LIST'){if(!Array.isArray(result?.items)||result.next_cursor!==null&&(typeof result.next_cursor!=='string'||!result.next_cursor||result.next_cursor.length>2048)||typeof result.has_more!=='boolean'||result.has_more!==(result.next_cursor!==null))throw Error('RESPONSE_UNCONFIRMED');return {items:result.items.map(publicSite),next_cursor:result.next_cursor,has_more:result.has_more};}
      return publicSite(result);
     }finally{clearTimeout(timer);}
    });return {ok:true,data,scope};
   }catch(error){return {ok:false,error:error.message,status:error.status??null,definitive:!dispatched||Number.isInteger(error.status)&&error.status>=400&&error.status<500&&error.status!==408};}
  };
 }
 const api=Object.freeze({transport,operation,publicSite});root.FocurveMemberSitesRuntime=api;
 if(typeof module!=='undefined')module.exports=api;
 if(root.chrome?.runtime?.onMessage){
  const handle=transport({getAdapter:()=>root.__memberA1,getAuth:()=>root.__memberIntegration?.auth,writeState:()=>root.FocurveMemberAuth?.AuthStore.writeState(),withServices:fn=>{if(typeof root.FocurveUserAdmission?.withServices!=='function')throw Error('INSTALLATION_NOT_READY');return root.FocurveUserAdmission.withServices(fn);},fetch:(...args)=>root.fetch(...args)});
  root.chrome.runtime.onMessage.addListener((message,sender,respond)=>{
   if(message?.type!=='INDEPENDENT_MEMBER_SITES')return;
   if(sender.id!==chrome.runtime.id||sender.url!==chrome.runtime.getURL('member-ui/popup.html')||sender.frameId!==undefined&&sender.frameId!==0||!uuid.test(message.request_id??'')||!exact(message,['type','request_id','action','payload','scope'])||message.scope!==undefined&&!exact(message.scope,['owner_key','executor_id','authority'])){respond({ok:false,error:'UNAUTHORIZED_SENDER',definitive:true,request_id:message.request_id});return false;}
   handle(message.action,message.payload,message.scope).then(r=>respond({...r,request_id:message.request_id}));return true;
  });
 }
})(globalThis);
