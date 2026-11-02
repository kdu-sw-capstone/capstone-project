import {ClaimLedger} from './claim-ledger.mjs';
import {HomeSession} from './home.mjs';
import {SubscriptionsSession} from './subscriptions.mjs';
import {ExploreSession} from './explore.mjs';
import {MastheadSession} from './masthead.mjs';
import {EndCardsSession} from './endcards.mjs';
import {GrayscaleSession} from './grayscale.mjs';
import {InstagramStoriesSession} from './instagram-stories.mjs';
import {WatchPanelSession} from './watch-panels.mjs';
import {AutoplaySession} from './autoplay.mjs';

const FACTORIES=new Map([['YT-01',HomeSession],['YT-05',SubscriptionsSession],['YT-06',ExploreSession],
  ['YT-07',MastheadSession],['YT-08',EndCardsSession],['YT-09',GrayscaleSession],['YT-10',AutoplaySession],['IG-01',InstagramStoriesSession]]);
const WATCH=new Set(['YT-03','YT-04']);
const DOCUMENTS=new WeakMap(),LIVE=new WeakMap();
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Internal trusted-caller composition only. No runtime listener, authority issuer,
// durable store, wire result conversion, or Shorts receiver replacement.
export class ContentSessionAdapter {
  #document;#options;#features;#ledger;#scope;#entries=new Map();#started=false;#closed=false;
  #isCurrent;#authorizeNavigation;#onObservation;#onInvalidated;#callbackErrors=0;#startupError=null;#invalidated=null;
  constructor(document,{owner_binding_id,binding_id,features,isCurrent,authorizeNavigation=null,
    ledger,onObservation=()=>{},onInvalidated=()=>{}}){
    if(![owner_binding_id,binding_id].every(v=>typeof v==='string'&&UUID.test(v)))throw Error('INVALID_CLAIM_SCOPE');
    if(typeof isCurrent!=='function')throw Error('CURRENT_AUTHORITY_CHECK_REQUIRED');
    if(!Array.isArray(features)||!features.length)throw Error('EMPTY_CONTENT_FEATURES');
    const seen=new Set(),url=new URL(document.location.href);
    for(const f of features){
      if(!f||(!FACTORIES.has(f.feature_id)&&!WATCH.has(f.feature_id))||typeof f.enabled!=='boolean'||f.required!==true)throw Error('UNSUPPORTED_CONTENT_FEATURE');
      if(seen.has(f.feature_id))throw Error('DUPLICATE_CONTENT_FEATURE');seen.add(f.feature_id);
      const hosts=f.feature_id.startsWith('IG-')?['instagram.com','www.instagram.com']:['youtube.com','www.youtube.com'];
      if(document.defaultView?.top!==document.defaultView||url.protocol!=='https:'||!hosts.includes(url.hostname)||url.port||url.username||url.password)throw Error('UNSUPPORTED_CONTENT_DOCUMENT');
    }
    this.#features=Object.freeze(features.map(f=>Object.freeze({feature_id:f.feature_id,enabled:f.enabled,required:true})));
    if(ledger&&!(ledger instanceof ClaimLedger))throw Error('SHARED_LEDGER_REQUIRED');
    if(DOCUMENTS.has(document)&&ledger&&DOCUMENTS.get(document)!==ledger)throw Error('SHARED_LEDGER_REQUIRED');
    if(!DOCUMENTS.has(document))DOCUMENTS.set(document,ledger??new ClaimLedger(document));
    this.#ledger=DOCUMENTS.get(document);
    if(!(this.#ledger instanceof ClaimLedger))throw Error('SHARED_LEDGER_REQUIRED');
    this.#document=document;this.#options=Object.freeze({owner_binding_id,binding_id});
    this.#scope=JSON.stringify([owner_binding_id,binding_id]);this.#isCurrent=isCurrent;
    this.#authorizeNavigation=authorizeNavigation;this.#onObservation=onObservation;this.#onInvalidated=onInvalidated;
    this.pagehide=()=>this.invalidate('PAGEHIDE');
  }
  #current(){
    if(this.#closed||this.#document.defaultView?.document!==this.#document)return false;
    try{const result=this.#isCurrent();if(result&&typeof result.then==='function')Promise.resolve(result).catch(()=>{});return result===true;}catch{return false;}
  }
  #emit(callback,value){try{const result=callback(structuredClone(value));if(result&&typeof result.then==='function')Promise.resolve(result).catch(()=>{this.#callbackErrors++;});}catch{this.#callbackErrors++;}}
  #observe(value){
    for(const r of Array.isArray(value)?value:[value]){
      const e=this.#entries.get(r.feature_id);if(e&&!e.released)e.observation=structuredClone(r);
    }
    this.#emit(this.#onObservation,this.inspect());
  }
  start(){
    if(this.#started)throw Error('CONTENT_ADAPTER_ALREADY_STARTED');
    if(!this.#current())throw Error('CURRENT_AUTHORITY_REJECTED');
    let live=LIVE.get(this.#ledger);if(!live){live=new Map();LIVE.set(this.#ledger,live);}
    if(live.has(this.#scope))throw Error('CONTENT_SCOPE_CLEANUP_REQUIRED');
    live.set(this.#scope,this);this.#started=true;this.#document.defaultView.addEventListener('pagehide',this.pagehide);
    const options={...this.#options,ledger:this.#ledger,canObserve:()=>this.#current(),
      authorizeNavigation:change=>{if(!this.#current())return false;const result=this.#authorizeNavigation?.(change);if(result&&typeof result.then==='function')Promise.resolve(result).catch(()=>{});return result===true&&this.#current();},
      onObservation:r=>this.#observe(r),onInvalidated:r=>this.invalidate(r.reason)};
    try{
      const watch=this.#features.filter(f=>WATCH.has(f.feature_id)&&f.enabled);
      if(watch.length){const session=new WatchPanelSession(this.#document,{...options,features:watch});for(const f of watch)this.#entries.set(f.feature_id,{session,released:false});}
      for(const f of this.#features)if(f.enabled&&!WATCH.has(f.feature_id))this.#entries.set(f.feature_id,{session:new (FACTORIES.get(f.feature_id))(this.#document,options),released:false});
      for(const session of new Set([...this.#entries.values()].map(e=>e.session))){session.start();if(this.#closed)throw Error('CONTENT_START_INVALIDATED');}
    }catch(error){this.#startupError=error.message;this.release();}
    return this.inspect();
  }
  invalidate(reason='AUTHORITY_REVOKED'){
    if(this.#closed)return this.inspect();this.#closed=true;this.#invalidated=reason;
    // Stop synchronously without recursively scanning an in-flight target list.
    // Claims/debt remain retryable; re-enabling a callback never resumes them.
    for(const session of new Set([...this.#entries.values()].filter(e=>!e.released).map(e=>e.session)))session.stop();
    this.#emit(this.#onInvalidated,{local_only:true,native_verified:false,reason,cleanup_pending:this.#entries.size>0});
    return this.inspect();
  }
  releaseFeature(feature_id){
    const e=this.#entries.get(feature_id);
    if(!e)throw Error('UNOWNED_CONTENT_FEATURE');
    e.closing=true;
    if(!e.released){
      try{e.cleanup=WATCH.has(feature_id)?e.session.releaseFeature(feature_id):e.session.release();}
      catch{e.cleanup={local_only:true,restored:false,remaining_targets:null,error_count:1};}
      e.released=e.cleanup.restored===true&&e.cleanup.cleanup_pending!==true;
    }
    return structuredClone({feature_id,local_only:true,native_verified:false,...e.cleanup});
  }
  release(){
    this.#closed=true;
    for(const id of this.#entries.keys())this.releaseFeature(id);
    if([...this.#entries.values()].every(e=>e.released)){
      this.#document.defaultView?.removeEventListener('pagehide',this.pagehide);
      if(LIVE.get(this.#ledger)?.get(this.#scope)===this)LIVE.get(this.#ledger).delete(this.#scope);
    }
    return this.inspect();
  }
  inspect(){
    const pending=[...this.#entries].filter(([,e])=>!e.released).map(([id])=>id);
    return structuredClone({local_only:true,native_verified:false,scope:this.#options,started:this.#started,closed:this.#closed,invalidation_reason:this.#invalidated,
      startup_error:this.#startupError,callback_error_count:this.#callbackErrors,
      // Before release, a live session may own unobserved/failed mutations. Only
      // its verified release result can clear this conservative obligation.
      cleanup_pending:pending.length>0,pending_features:pending,
      features:[...this.#entries].map(([feature_id,e])=>({feature_id,active:!this.#closed&&!e.released&&!e.closing,observation:e.observation??null,cleanup:e.cleanup??null}))});
  }
}
