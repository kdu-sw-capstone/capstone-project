import '../background/member-events.js';
import { selectSite, blockedUrl } from './site-rules.js';
import { parseServerTime } from './server-time.js';

// Durable navigation drafts, sequence allocation and frozen originals in one database.
// The delivery outbox is separate; originals remain replayable after a crash between stores.
export class MemberAccessStore {
  constructor({indexedDB=globalThis.indexedDB,name='focurve-member-access'}={}) { Object.assign(this,{indexedDB,name}); }
  async transaction(mode,work) {
    let db;
    try {
      db=await new Promise((resolve,reject)=>{
        const r=this.indexedDB.open(this.name,1);let abandoned=false;
        r.onupgradeneeded=()=>{r.result.createObjectStore('pending',{keyPath:'tab_id'});r.result.createObjectStore('sequences',{keyPath:'scope'});r.result.createObjectStore('originals',{keyPath:['scope','event_id']});};
        r.onsuccess=()=>{if(abandoned){r.result.close();return;}resolve(r.result);};
        r.onerror=()=>reject(new Error('ACCESS_STORAGE_UNAVAILABLE'));
        r.onblocked=()=>{abandoned=true;reject(new Error('ACCESS_STORAGE_UNAVAILABLE'));};
      });
      return await new Promise((resolve,reject)=>{
        const tx=db.transaction(['pending','sequences','originals'],mode);let value;
        tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(new Error('ACCESS_STORAGE_UNAVAILABLE'));
        try { work(tx,v=>{value=v;}); } catch { tx.abort(); }
      });
    } catch { throw new Error('ACCESS_STORAGE_UNAVAILABLE'); }
    finally { db?.close(); }
  }
  pending(tab) { return this.transaction('readonly',(tx,done)=>{const r=tx.objectStore('pending').get(tab);r.onsuccess=()=>done(r.result??null);}); }
  drafts(prefix) { return this.transaction('readonly',(tx,done)=>{const r=tx.objectStore('pending').getAll();r.onsuccess=()=>done(r.result.filter(x=>typeof x.tab_id==='string'&&x.tab_id.startsWith(prefix)));}); }
  begin(draft,tab) { return this.transaction('readwrite',(tx,done)=>{
    const s=tx.objectStore('pending');
    const replace=()=>{const old=s.get(tab);old.onsuccess=()=>{
      if(old.result?.committed_details)s.put({...old.result,native_tab_id:old.result.native_tab_id??tab,tab_id:'site-entry:'+old.result.event_id});
      if(draft)s.put(draft);else s.delete(tab);done(null);
    };};
    if(!draft){replace();return;}

    const markers=tx.objectStore('sequences'),markerKey='site-observed:'+tab,r=markers.get(markerKey);
    r.onsuccess=()=>{
      const previous=r.result;
      if(previous?.navigation_scope===draft.scope&&(previous.navigation_started_at>draft.navigation_started_at||
         (previous.navigation_started_at===draft.navigation_started_at&&previous.fingerprint===draft.fingerprint))){done(null);return;}
      markers.put({scope:markerKey,navigation_scope:draft.scope,navigation_started_at:draft.navigation_started_at,fingerprint:draft.fingerprint});
      replace();
    };
  }); }
  // An entry marker must never commit without its associated durable draft.
  beginFeature(marker,draft) {
    return this.transaction('readwrite',(tx,done)=>{
      const s=tx.objectStore('pending'),r=s.get(draft.tab_id);
      r.onsuccess=()=>{
        try {s.put(marker);if(!r.result)s.put(draft);done(null);}
        catch {tx.abort();}
      };
    });
  }
  committedSites(){return this.transaction('readonly',(tx,done)=>{const r=tx.objectStore('pending').getAll();r.onsuccess=()=>done(r.result.filter(d=>(Number.isInteger(d.tab_id)||typeof d.tab_id==='string'&&d.tab_id.startsWith('site-entry:'))&&d.committed_details).sort((a,b)=>a.navigation_started_at-b.navigation_started_at));});}
  deferCommit(draft,details){return this.transaction('readwrite',(tx,done)=>{
    const p=tx.objectStore('pending'),r=p.get(draft.tab_id);r.onsuccess=()=>{
      if(r.result?.event_id!==draft.event_id){done(false);return;}
      const {frameId,tabId,timeStamp,observed_at,documentId,documentLifecycle,transitionType,transitionQualifiers}=details;
      p.put({...r.result,committed_details:{frameId,tabId,timeStamp,observed_at,documentId,documentLifecycle,transitionType,transitionQualifiers,url:new URL(details.url).origin+'/'}});done(true);
    };
  });}
  // Gate evidence may arrive after the ordinary receiver already froze this entry.
  // Compare-and-set: a late proof can never resurrect a consumed original.
  attachFeatureProof(draft) {
    return this.transaction('readwrite',(tx,done)=>{
      const s=tx.objectStore('pending'),r=s.get(draft.tab_id);
      r.onsuccess=()=>{
        const current=r.result;
        if(current&&(current.event_id!==draft.event_id||current.phase!=='PENDING')){done(false);return;}
        s.put(current?{...current,root_gate_proof:draft.root_gate_proof}:draft);done(true);
      };
    });
  }
  markFeatureReview(scope,error) {
    return this.transaction('readwrite',(tx,done)=>{
      const s=tx.objectStore('pending'),r=s.getAll();
      r.onsuccess=()=>{for(const d of r.result)if(d.scope===scope&&d.phase==='COMPLETED'&&d.retain_consumed&&!d.review_required)
        s.put({...d,review_required:true,review_error:error});done(null);};
    });
  }
  featureQuality(scope) {
    return this.transaction('readonly',(tx,done)=>{
      const r=tx.objectStore('pending').getAll();r.onsuccess=()=>{
        const events=r.result.filter(d=>d.scope===scope&&d.phase==='COMPLETED'&&d.review_required)
          .map(d=>({event_id:d.event_id,quality:'REVIEW_REQUIRED',error:d.review_error}));
        done({quality:events.length?'REVIEW_REQUIRED':'PARTIAL',events});
      };
    });
  }
  consume(draft,event) {
    return this.transaction('readwrite',(tx,done)=>{
      const pending=tx.objectStore('pending'),r=pending.get(draft.tab_id);
      r.onsuccess=()=>{
        if(r.result?.event_id!==draft.event_id||r.result.phase==='COMPLETED'){done(null);return;}
        if(draft.retain_consumed)pending.put({...draft,phase:'COMPLETED'});else pending.delete(draft.tab_id);
        if(!event){done(null);return;}
        const seq=tx.objectStore('sequences'),sequenceScope=draft.sequence_scope??draft.scope,q=seq.get(sequenceScope);
        q.onsuccess=()=>{
          const n=(q.result?.value??0)+1;if(!Number.isSafeInteger(n)){tx.abort();return;}
          event.local_seq=n;event.payload.access_seq=n;
          try { globalThis.FocurveMemberEvents.validate(event); } catch { tx.abort();return; }
          const body=JSON.stringify(event);
          tx.objectStore('originals').add({scope:draft.scope,event_id:event.event_id,owner_key:draft.owner_key,executor_id:draft.executor_id,base_url:draft.base_url,body});
          seq.put({scope:sequenceScope,value:n});done(event);
        };
      };
    });
  }
  originals(owner,executor,base) { return this.transaction('readonly',(tx,done)=>{const r=tx.objectStore('originals').getAll();r.onsuccess=()=>done(r.result.filter(x=>x.owner_key===owner&&x.executor_id===executor&&x.base_url===base));}); }
  review(scope,id,body) {
    return this.transaction('readwrite',(tx,done)=>{
      const store=tx.objectStore('originals'),r=store.get([scope,id]);
      r.onsuccess=()=>{
        if(!r.result||r.result.body!==body){tx.abort();return;}
        store.put({...r.result,review_required:true,review_error:'LOCAL_EVENT_INVALID'});done(null);
      };
    });
  }
  acknowledged(scope,id) { return this.transaction('readwrite',(tx,done)=>{tx.objectStore('originals').delete([scope,id]);done(null);}); }
}
const explicit=new Set(['link','typed','auto_bookmark','reload','form_submit','generated','keyword','keyword_generated']);
const valid=d=>d.frameId===0&&Number.isInteger(d.tabId)&&d.tabId>=0&&Number.isFinite(d.timeStamp)&&Number.isFinite(d.observed_at);
const scope=c=>JSON.stringify([c.base_url,c.owner_key,c.executor_id,c.session_id,c.revision,c.snapshot.policy_snapshot_id]);
const host=raw=>globalThis.FocurveHostPolicy.normalize(raw);
// SITE observations are candidates, never a second writer for a restricted route.
function restrictedShorts(snapshot,raw) {
  try{const u=new URL(raw),site=selectSite(snapshot.sites,raw);
    return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&['youtube.com','www.youtube.com'].includes(u.hostname)&&
      /^\/shorts\/[^/]+\/?$/.test(u.pathname)&&site?.access_policy!=='BLOCK'&&
      site?.feature_policies?.some(f=>f.feature_code==='YOUTUBE_SHORTS'&&f.enabled===true);
  }catch{return false;}
}

function blockedDestination(context,site,base){
  if(context.blocked_redirects===undefined)return blockedUrl(base,site);
  const raw=context.blocked_redirects?.[site.canonical_host];if(typeof raw!=='string')return null;
  try{const u=new URL(raw),b=new URL(base);if(u.protocol!==b.protocol||u.host!==b.host||u.pathname!==b.pathname||u.hash||u.username||u.password||u.searchParams.getAll('host').length!==1||u.searchParams.get('host')!==site.canonical_host||u.searchParams.getAll('session').length!==1||u.searchParams.get('session')!==context.session_id||[...u.searchParams.keys()].some(k=>!['host','session'].includes(k)))return null;return raw;}catch{return null;}
}

export class MemberAccessCollector {
  constructor({getContext,store=new MemberAccessStore(),blockedPageUrl,randomUUID=()=>crypto.randomUUID(),digest=async raw=>{
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(new URL(raw).href));
    return Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
  }}) { Object.assign(this,{getContext,store,blockedPageUrl,randomUUID,digest});this.queue=Promise.resolve(); }
  serial(work) {const p=this.queue.then(work);this.queue=p.catch(()=>{});return p;}
  observe(stage,details) {return this.serial(()=>this.collect(stage,details));}
  async collect(stage,d,providedDraft=null) {
    if(!valid(d))return null;
    if(stage==='before') {
      // DNR's intermediate extension navigation must not replace the original attempted host.
      try {const u=new URL(d.url),b=new URL(this.blockedPageUrl);if(u.origin===b.origin&&u.host===b.host&&u.pathname===b.pathname)return null;}catch{}
      const c=await this.getContext(d.observed_at),site=c&&selectSite(c.snapshot.sites,d.url);
      if(!c||!site||!['BLOCK','RECORD'].includes(site.access_policy)){await this.store.begin(null,d.tabId);return null;}
      const destination=site.access_policy==='BLOCK'?blockedDestination(c,site,this.blockedPageUrl):null;
      if(site.access_policy==='BLOCK'&&!destination){await this.store.begin(null,d.tabId);return null;}
      const draft={tab_id:d.tabId,scope:scope(c),sequence_scope:JSON.stringify([c.base_url,c.owner_key,c.executor_id,c.session_id]),owner_key:c.owner_key,executor_id:c.executor_id,base_url:c.base_url,session_id:c.session_id,
        navigation_id:this.randomUUID(),event_id:this.randomUUID(),captured_at:d.observed_at,navigation_started_at:d.timeStamp,
        fingerprint:await this.digest(d.url),target_host:host(d.url),policy_host:site.canonical_host,policy:site.access_policy,
        blocked_url:destination,await_feature:site.access_policy==='RECORD'&&restrictedShorts(c.snapshot,d.url)};
      await this.store.begin(draft,d.tabId);return null;
    }
    const draft=providedDraft??await this.store.pending(d.tabId);if(!draft||d.timeStamp<draft.navigation_started_at)return null;
    if(stage==='error') {
      if(await this.digest(d.url)===draft.fingerprint)await this.store.consume(draft,null);
      return null;
    }
    if(stage!=='commit')return null;
    const c=await this.getContext(d.observed_at);
    const qualifies=explicit.has(d.transitionType)&&!(d.transitionQualifiers??[]).includes('client_redirect')
      &&(!d.documentLifecycle||d.documentLifecycle==='active');
    const targetMatches=draft.policy==='BLOCK'?d.url===draft.blocked_url:host(d.url)===draft.target_host;
    if(!c||scope(c)!==draft.scope||!qualifies||!targetMatches||draft.captured_at<parseServerTime(c.applied_at)) {
      await this.store.consume(draft,null);return null;
    }
    if(draft.policy==='RECORD'&&(draft.await_feature||restrictedShorts(c.snapshot,d.url))){await this.store.consume(draft,null);return null;}
    if(c.can_freeze===false){await this.store.deferCommit(draft,d);return null;}
    return this.store.consume(draft,{schema_version:'1.2',event_id:draft.event_id,executor_id:c.executor_id,session_id:c.session_id,
      policy_snapshot_id:c.snapshot.policy_snapshot_id,event_type:draft.policy==='BLOCK'?'BLOCKED_SITE_ACCESS':'RECORDED_ACCESS',
      occurred_at:new Date(d.observed_at).toISOString(),payload:{navigation_id:draft.navigation_id,target_kind:'SITE',target_host:draft.target_host,
        target_key:draft.target_host,matched_policy_host:draft.policy_host,blocked_reasons:draft.policy==='BLOCK'?['USER_SITE']:[],reason:draft.policy==='BLOCK'?'USER_SITE':'RECORD'}});
  }
  flushCommitted(){return this.serial(async()=>{const events=[];for(const draft of await this.store.committedSites()){const c=await this.getContext();if(!c||c.can_freeze===false||scope(c)!==draft.scope)continue;const event=await this.collect('commit',draft.committed_details,draft);if(event)events.push(event);}return events;});}
  forget(tabId) {return this.serial(()=>this.store.begin(null,tabId));}
}

// Root-native navigation observations only. Content messages and DOM scans are
// never inputs. Drafts and the common SITE/FEATURE sequence survive Worker loss.
export class MemberFeatureCollector {
 constructor({getContext,getAppliedProof,store,withConfirmedEffect=work=>work(),digest=async raw=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw))),x=>x.toString(16).padStart(2,'0')).join(''),randomUUID=()=>crypto.randomUUID()}){Object.assign(this,{getContext,getAppliedProof,store,withConfirmedEffect,digest,randomUUID});this.queue=Promise.resolve();}
 serial(work){const p=this.queue.then(work);this.queue=p.catch(()=>{});return p;}
 observe(stage,d){return this.serial(async()=>{
  if(!['commit','history','baseline'].includes(stage)||!valid(d)||!d.documentId||d.documentLifecycle!=='active'||stage!=='baseline'&&(!explicit.has(d.transitionType)||(d.transitionQualifiers??[]).includes('client_redirect')))return null;
  let u;try{u=new URL(d.url);}catch{return null;}
  if(u.protocol!=='https:'||!['youtube.com','www.youtube.com'].includes(u.hostname)||u.username||u.password||u.port)return null;
  const c=await this.getContext();if(!c||d.timeStamp<parseServerTime(c.applied_at))return null;
  const fp=await this.digest(u.href),entry=await this.digest(u.origin+u.pathname),markerKey='feature-marker:'+d.tabId+':'+d.documentId,marker=await this.store.pending(markerKey);
  if(stage==='baseline'&&marker?.scope===scope(c))return null;
  // Identical history notifications/DOM updates are not new feature entries.
  if(stage==='history'&&marker?.scope===scope(c)&&marker.entry_fingerprint===entry)return null;
  const nextMarker={tab_id:markerKey,fingerprint:fp,entry_fingerprint:entry,scope:scope(c)};
  if(stage==='baseline'||stage==='history'&&marker?.scope!==scope(c)||!/^\/shorts\/[^/]+\/?$/.test(u.pathname)){await this.store.begin(nextMarker,markerKey);return null;}
  const site=selectSite(c.snapshot.sites,u.href);
  if(!site||site.access_policy==='BLOCK'||!site.feature_policies?.some(f=>f.feature_code==='YOUTUBE_SHORTS'&&f.enabled)){await this.store.begin(nextMarker,markerKey);return null;}
  const key='feature-entry:'+d.tabId+':'+d.documentId+':'+d.timeStamp+':'+fp;
  await this.store.beginFeature(nextMarker,{tab_id:key,native_tab_id:d.tabId,document_id:d.documentId,fingerprint:fp,entry_fingerprint:entry,scope:scope(c),sequence_scope:JSON.stringify([c.base_url,c.owner_key,c.executor_id,c.session_id]),owner_key:c.owner_key,executor_id:c.executor_id,base_url:c.base_url,session_id:c.session_id,navigation_id:this.randomUUID(),event_id:this.randomUUID(),captured_at:d.observed_at,target_host:u.hostname,policy_host:site.canonical_host,phase:'PENDING',retain_consumed:true});
  return null;
 });}
 flush(){return this.serial(async()=>{
  const events=[];for(const draft of await this.store.drafts('feature-entry:')){
   if(draft.phase!=='PENDING')continue;const c=await this.getContext();
   if(!c||scope(c)!==draft.scope)continue;
   const event=await this.withConfirmedEffect(async()=>{if(!await this.getAppliedProof(draft,c))return null;return this.store.consume(draft,{schema_version:'1.2',event_id:draft.event_id,executor_id:c.executor_id,session_id:c.session_id,policy_snapshot_id:c.snapshot.policy_snapshot_id,event_type:'BLOCKED_FEATURE_ACCESS',occurred_at:new Date(draft.captured_at).toISOString(),payload:{navigation_id:draft.navigation_id,target_kind:'FEATURE',target_host:draft.target_host,target_key:draft.target_host,feature_code:'YOUTUBE_SHORTS',matched_policy_host:draft.policy_host,blocked_reasons:['FEATURE'],reason:'FEATURE'}});});
   if(event)events.push(event);
  }return events;
 });}
}
