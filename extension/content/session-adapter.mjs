import {ClaimLedger} from './claim-ledger.mjs';
import {freezeCopy} from './local-evidence.mjs';
import {HomeSession} from './home.mjs';
import {SubscriptionsSession} from './subscriptions.mjs';
import {ExploreSession} from './explore.mjs';
import {MastheadSession} from './masthead.mjs';
import {EndCardsSession} from './endcards.mjs';
import {GrayscaleSession} from './grayscale.mjs';
import {InstagramStoriesSession} from './instagram-stories.mjs';
import {InstagramReelsSession} from './instagram-reels.mjs';
import {InstagramExploreSession} from './instagram-explore.mjs';
import {InstagramGrayscaleSession} from './instagram-grayscale.mjs';
import {InstagramSuggestionsSession} from './instagram-suggestions.mjs';
import {InstagramCommentsSession} from './instagram-comments.mjs';
import {WatchPanelSession} from './watch-panels.mjs';
import {AutoplaySession} from './autoplay.mjs';

const FACTORIES=new Map([['YT-01',HomeSession],['YT-05',SubscriptionsSession],['YT-06',ExploreSession],
  ['YT-07',MastheadSession],['YT-08',EndCardsSession],['YT-09',GrayscaleSession],['YT-10',AutoplaySession],['IG-01',InstagramStoriesSession],['IG-02',InstagramReelsSession],['IG-03',InstagramExploreSession],['IG-04',InstagramCommentsSession],['IG-05',InstagramSuggestionsSession],['IG-06',InstagramGrayscaleSession]]);
const WATCH=new Set(['YT-03','YT-04']);
const DOCUMENTS=new WeakMap(),LIVE=new WeakMap();
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Internal trusted-caller composition only. No runtime listener, authority issuer,
// durable store, wire result conversion, or Shorts receiver replacement.
export class ContentSessionAdapter {
  #document;#options;#features;#ledger;#scope;#entries=new Map();#started=false;#closed=false;
  #isCurrent;#authorizeNavigation;#onObservation;#onInvalidated;#callbackErrors=0;#startupError=null;#invalidated=null;
  #ig04Reservation;
  // Local diagnostics, not a watch identity, durable receipt or terminal proof.
  #localStartup={phase:'NOT_ENTERED',start_calls:0,pagehide_listener:'NOT_ATTEMPTED',session_construct_attempts:0,sessions_constructed:0,session_start_attempts:0,session_start_returned:0,resource_uncertainty:false,first_failure:null};
  constructor(document,{owner_binding_id,binding_id,features,isCurrent,authorizeNavigation=null,
    ledger,onObservation=()=>{},onInvalidated=()=>{},ig04Reservation}){
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
    this.#ig04Reservation=ig04Reservation&&typeof ig04Reservation==='object'
      ?{...ig04Reservation,...(ig04Reservation.context!==undefined?{context:freezeCopy(ig04Reservation.context)}:{})}:ig04Reservation;
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
    this.#localStartup.start_calls++;
    if(this.#started)throw Error('CONTENT_ADAPTER_ALREADY_STARTED');
    this.#localStartup.phase='ENTERED';
    try{this.#start();this.#localStartup.phase=this.#startupError?'FAILED_OR_PARTIAL':'RETURNED';return this.inspect();}
    catch(error){
      this.#localStartup.phase=this.#started||this.#localStartup.resource_uncertainty?'FAILED_OR_PARTIAL':'FAILED_BEFORE_RESOURCES';
      this.#localStartup.first_failure??=this.#startupError??error.message;
      throw error;
    }
  }
  #construct(factory){
    this.#localStartup.session_construct_attempts++;
    try{const session=factory();this.#localStartup.sessions_constructed++;return session;}
    catch(error){this.#localStartup.resource_uncertainty=true;throw error;}
  }
  #start(){
    if(this.#started)throw Error('CONTENT_ADAPTER_ALREADY_STARTED');
    if(!this.#current())throw Error('CURRENT_AUTHORITY_REJECTED');
    let live=LIVE.get(this.#ledger);if(!live){live=new Map();LIVE.set(this.#ledger,live);}
    if(live.has(this.#scope))throw Error('CONTENT_SCOPE_CLEANUP_REQUIRED');
    live.set(this.#scope,this);this.#started=true;
    this.#localStartup.pagehide_listener='UNCONFIRMED';
    this.#document.defaultView.addEventListener('pagehide',this.pagehide);
    this.#localStartup.pagehide_listener='ATTACHED';
    const options={...this.#options,ledger:this.#ledger,canObserve:()=>this.#current(),ig04Reservation:this.#ig04Reservation,
      authorizeNavigation:change=>{if(!this.#current())return false;const result=this.#authorizeNavigation?.(change);if(result&&typeof result.then==='function')Promise.resolve(result).catch(()=>{});return result===true&&this.#current();},
      onObservation:r=>this.#observe(r),onInvalidated:r=>this.invalidate(r.reason)};
    try{
      const watch=this.#features.filter(f=>WATCH.has(f.feature_id)&&f.enabled);
      if(watch.length){const session=this.#construct(()=>new WatchPanelSession(this.#document,{...options,features:watch}));for(const f of watch)this.#entries.set(f.feature_id,{session,released:false});}
      for(const f of this.#features)if(f.enabled&&!WATCH.has(f.feature_id))this.#entries.set(f.feature_id,{session:this.#construct(()=>new (FACTORIES.get(f.feature_id))(this.#document,options)),released:false});
      for(const session of new Set([...this.#entries.values()].map(e=>e.session))){
        this.#localStartup.session_start_attempts++;
        try{session.start();this.#localStartup.session_start_returned++;}
        catch(error){this.#localStartup.resource_uncertainty=true;throw error;}
        if(this.#closed)throw Error('CONTENT_START_INVALIDATED');
      }
    }catch(error){this.#startupError=error.message;this.#localStartup.first_failure??=error.message;this.release();}
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
      this.#localStartup.pagehide_listener='UNCONFIRMED';
      if(this.#document.defaultView){this.#document.defaultView.removeEventListener('pagehide',this.pagehide);this.#localStartup.pagehide_listener='REMOVED';}
      if(LIVE.get(this.#ledger)?.get(this.#scope)===this)LIVE.get(this.#ledger).delete(this.#scope);
    }
    return this.inspect();
  }
  inspect(){
    const pending=[...this.#entries].filter(([,e])=>!e.released).map(([id])=>id);
    return structuredClone({local_only:true,native_verified:false,scope:this.#options,started:this.#started,closed:this.#closed,invalidation_reason:this.#invalidated,
      startup_error:this.#startupError,callback_error_count:this.#callbackErrors,
      local_startup:{...this.#localStartup,scope_registered:LIVE.get(this.#ledger)?.get(this.#scope)===this,
        resources_may_remain:this.#localStartup.resource_uncertainty||pending.length>0||['ATTACHED','UNCONFIRMED'].includes(this.#localStartup.pagehide_listener)},
      // Before release, a live session may own unobserved/failed mutations. Only
      // its verified release result can clear this conservative obligation.
      cleanup_pending:pending.length>0,pending_features:pending,
      features:[...this.#entries].map(([feature_id,e])=>({feature_id,active:!this.#closed&&!e.released&&!e.closing,observation:e.observation??null,cleanup:e.cleanup??null}))});
  }
  async evidenceSnapshot(feature_id='IG-04'){
    const e=this.#entries.get(feature_id);
    if(feature_id!=='IG-04'||!e)throw Error('UNOWNED_EVIDENCE_FEATURE');
    return e.session.evidenceSnapshot();
  }
  async quiescenceSnapshot(){
    if(this.#features.length!==1||this.#features[0].feature_id!=='IG-04')throw Error('UNSUPPORTED_EVIDENCE_FEATURE');
    this.invalidate('LOCAL_QUIESCENCE_REQUESTED');
    // Detaching this adapter's listener is independent of RELEASE authority.
    // Keep LIVE registration, claims and all durable obligations untouched.
    if(this.#localStartup.pagehide_listener!=='NOT_ATTEMPTED'){
      this.#localStartup.pagehide_listener='UNCONFIRMED';
      try{this.#document.defaultView.removeEventListener('pagehide',this.pagehide);this.#localStartup.pagehide_listener='REMOVED';}catch{}
    }
    const e=this.#entries.get('IG-04');
    const snapshot=e?await e.session.quiescenceSnapshot():null;
    const listener_detached=['NOT_ATTEMPTED','REMOVED'].includes(this.#localStartup.pagehide_listener);
    const session_confirmed=e?snapshot.local_quiescence.locally_quiescent:!this.#localStartup.resource_uncertainty;
    return {local_only:true,native_verified:false,state:this.inspect(),snapshot,
      local_quiescence:{future_effects_closed:this.#closed,adapter_listener_detached:listener_detached,
        locally_quiescent:this.#closed&&listener_detached&&session_confirmed&&!this.#localStartup.resource_uncertainty}};
  }
  async completeReservation(identity,proof){
    const e=this.#entries.get('IG-04');
    if(!e)return {local_only:true,accepted:false,reason:'UNOWNED_RESERVATION_FEATURE'};
    const result=await e.session.completeReservation(identity,proof);
    if(result.accepted){this.releaseFeature('IG-04');if(this.#closed)this.release();}
    return {...result,state:this.inspect()};
  }
}
