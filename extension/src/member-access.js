import '../background/member-events.js';
import { selectSite, blockedUrl } from './site-rules.js';
import { parseServerTime } from './server-time.js';

// Durable navigation drafts, sequence allocation and frozen originals in one database.
// The delivery outbox is separate; originals remain replayable after a crash between stores.
export class MemberAccessStore {
  constructor({indexedDB=globalThis.indexedDB,name='focurve-member-access'}={}) { Object.assign(this,{indexedDB,name}); }
  async transaction(mode,work) {
    const db=await new Promise((resolve,reject)=>{
      const r=this.indexedDB.open(this.name,1);
      r.onupgradeneeded=()=>{r.result.createObjectStore('pending',{keyPath:'tab_id'});r.result.createObjectStore('sequences',{keyPath:'scope'});r.result.createObjectStore('originals',{keyPath:['scope','event_id']});};
      r.onsuccess=()=>resolve(r.result);r.onerror=r.onblocked=()=>reject(new Error('ACCESS_STORAGE_UNAVAILABLE'));
    });
    try { return await new Promise((resolve,reject)=>{
      const tx=db.transaction(['pending','sequences','originals'],mode);let value;
      tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(new Error('ACCESS_STORAGE_UNAVAILABLE'));
      try { work(tx,v=>{value=v;}); } catch { tx.abort(); }
    }); } finally { db.close(); }
  }
  pending(tab) { return this.transaction('readonly',(tx,done)=>{const r=tx.objectStore('pending').get(tab);r.onsuccess=()=>done(r.result??null);}); }
  begin(draft,tab) { return this.transaction('readwrite',(tx,done)=>{const s=tx.objectStore('pending');if(draft)s.put(draft);else s.delete(tab);done(null);}); }
  consume(draft,event) {
    return this.transaction('readwrite',(tx,done)=>{
      const pending=tx.objectStore('pending'),r=pending.get(draft.tab_id);
      r.onsuccess=()=>{
        if(r.result?.event_id!==draft.event_id){done(null);return;}
        pending.delete(draft.tab_id);
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

export class MemberAccessCollector {
  constructor({getContext,store=new MemberAccessStore(),blockedPageUrl,randomUUID=()=>crypto.randomUUID(),digest=async raw=>{
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(new URL(raw).href));
    return Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
  }}) { Object.assign(this,{getContext,store,blockedPageUrl,randomUUID,digest});this.queue=Promise.resolve(); }
  serial(work) {const p=this.queue.then(work);this.queue=p.catch(()=>{});return p;}
  observe(stage,details) {return this.serial(()=>this.collect(stage,details));}
  async collect(stage,d) {
    if(!valid(d))return null;
    if(stage==='before') {
      // DNR's intermediate extension navigation must not replace the original attempted host.
      try {const u=new URL(d.url),b=new URL(this.blockedPageUrl);if(u.origin===b.origin&&u.host===b.host&&u.pathname===b.pathname)return null;}catch{}
      const c=await this.getContext(d.observed_at),site=c&&selectSite(c.snapshot.sites,d.url);
      if(!c||!site||!['BLOCK','RECORD'].includes(site.access_policy)){await this.store.begin(null,d.tabId);return null;}
      const draft={tab_id:d.tabId,scope:scope(c),sequence_scope:JSON.stringify([c.base_url,c.owner_key,c.executor_id,c.session_id]),owner_key:c.owner_key,executor_id:c.executor_id,base_url:c.base_url,session_id:c.session_id,
        navigation_id:this.randomUUID(),event_id:this.randomUUID(),captured_at:d.observed_at,navigation_started_at:d.timeStamp,
        fingerprint:await this.digest(d.url),target_host:host(d.url),policy_host:site.canonical_host,policy:site.access_policy,
        blocked_url:site.access_policy==='BLOCK'?blockedUrl(this.blockedPageUrl,site):null};
      await this.store.begin(draft,d.tabId);return null;
    }
    const draft=await this.store.pending(d.tabId);if(!draft||d.timeStamp<draft.navigation_started_at)return null;
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
    return this.store.consume(draft,{schema_version:'1.2',event_id:draft.event_id,executor_id:c.executor_id,session_id:c.session_id,
      policy_snapshot_id:c.snapshot.policy_snapshot_id,event_type:draft.policy==='BLOCK'?'BLOCKED_SITE_ACCESS':'RECORDED_ACCESS',
      occurred_at:new Date(d.observed_at).toISOString(),payload:{navigation_id:draft.navigation_id,target_kind:'SITE',target_host:draft.target_host,
        target_key:draft.target_host,matched_policy_host:draft.policy_host,blocked_reasons:draft.policy==='BLOCK'?['USER_SITE']:[],reason:draft.policy==='BLOCK'?'USER_SITE':'RECORD'}});
  }
  forget(tabId) {return this.serial(()=>this.store.begin(null,tabId));}
}
