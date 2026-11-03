import {ClaimLedger} from './claim-ledger.mjs';
import {HideReservationGate} from './hide-reservation-gate.mjs';

// Internal navigation DOM primitive, not an authorized Core receiver. The caller owns
// frozen policy, native scope, durable intent and the wire evidence envelope.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HOSTS=new Set(['youtube.com','www.youtube.com']);
const INSTAGRAM=new Set(['instagram.com','www.instagram.com']);
const LIVE=new WeakMap();

export class NavigationSurfaceSession {
  #document;#ledger;#scope;#targets=new Map();#next=0;#url;
  #open=false;#started=false;#scheduled=false;#observer;#observe;#invalidateCallback;
  #profile;#authorizeNavigation;#canObserve;#busy=false;
  #reservation;
  #observing=false;#scanSequence=0;#scanComplete=false;#lastObservation=null;#lastCleanup=null;
  #claimEpoch='';
  #observerState='NOT_ATTEMPTED';#listeners=[];
  constructor(document,{ledger,owner_binding_id,binding_id,onObservation=()=>{},onInvalidated=()=>{},authorizeNavigation=null,canObserve=()=>true,ig04Reservation},profile){
    // Profiles are module-owned selectors, not page/Wire policy or capability.
    if(!profile||!['YT-01','YT-05','YT-06','YT-07','YT-08','YT-09','IG-01','IG-02','IG-03','IG-04','IG-05','IG-06'].includes(profile.feature_id)||typeof profile.collect!=='function'||typeof profile.routeAllowed!=='function')throw Error('INVALID_NAVIGATION_PROFILE');
    this.#profile=Object.freeze({...profile});
    if(!(ledger instanceof ClaimLedger))throw Error('SHARED_LEDGER_REQUIRED');
    if(![owner_binding_id,binding_id].every(value=>typeof value==='string'&&UUID.test(value)))throw Error('INVALID_CLAIM_SCOPE');
    this.#document=document;this.#ledger=ledger;this.#scope=JSON.stringify([owner_binding_id,binding_id,profile.feature_id]);
    this.#observe=onObservation;this.#invalidateCallback=onInvalidated;
    this.#authorizeNavigation=authorizeNavigation;
    this.#canObserve=canObserve;
    this.refresh=()=>{
      if(!this.#open||this.#scheduled)return;this.#scheduled=true;
      queueMicrotask(()=>{this.#scheduled=false;if(this.#open)this.scan();});
    };
    this.pagehide=()=>this.#invalidate('PAGEHIDE');
    if(profile.feature_id==='IG-04'&&ig04Reservation!==undefined){
      this.#reservation=new HideReservationGate(ledger,ig04Reservation,this.refresh,{owner_binding_id,binding_id});this.#claimEpoch=':'+crypto.randomUUID();
    }
  }
  start(){
    if(this.#started)throw Error(this.#profile.prefix+'_ALREADY_STARTED');
    const win=this.#document.defaultView,url=new URL(this.#document.location.href);
    const hosts=this.#profile.feature_id.startsWith('IG-')?INSTAGRAM:HOSTS;
    if(win.top!==win||url.protocol!=='https:'||!hosts.has(url.hostname)||url.port||url.username||url.password
      ||!this.#profile.routeAllowed(url))throw Error('UNSUPPORTED_'+this.#profile.prefix+'_DOCUMENT');
    let live=LIVE.get(this.#ledger);if(!live){live=new Map();LIVE.set(this.#ledger,live);}
    if(live.has(this.#scope))throw Error(this.#profile.prefix+'_SCOPE_ALREADY_ACTIVE');
    live.set(this.#scope,this);this.#started=true;this.#open=true;this.#url=url.href;
    this.#observerState='UNCONFIRMED';this.#observer=new win.MutationObserver(this.refresh);this.#observerState='CONSTRUCTED';
    for(const name of ['popstate','hashchange','yt-navigate-finish'])this.#listen(win,name,this.refresh);
    if(win.navigation)this.#listen(win.navigation,'currententrychange',this.refresh);
    this.#listen(win,'pagehide',this.pagehide);
    return this.scan();
  }
  #listen(target,type,callback){
    const entry={target,type,callback,removed:false};this.#listeners.push(entry);
    target.addEventListener(type,callback);
  }
  #disconnect(){
    // Attempt every owned resource even if an earlier removal throws. Unknown
    // acquisition/removal remains unknown; it must not become a scan0 proof.
    if(this.#observer){this.#observerState='UNCONFIRMED';try{this.#observer.disconnect();this.#observing=false;this.#observerState='STOPPED';}catch{}}
    for(const entry of this.#listeners)if(!entry.removed){try{entry.target.removeEventListener(entry.type,entry.callback);entry.removed=true;}catch{}}
    return this.#observerState!=='UNCONFIRMED'&&this.#listeners.every(entry=>entry.removed);
  }
  #invalidate(reason,details=null){
    if(!this.#open)return;this.#open=false;this.#disconnect();
    this.#reservation?.close();
    const reservation=this.#reservation?.inspect();
    this.#invalidateCallback({local_only:true,reason,cleanup_pending:this.#targets.size>0||!!reservation?.reservation_obligations.length,
      ...(reservation??{}),...(details?{navigation_check:details}:{})});
  }
  stop(){this.#invalidate('AUTHORITY_REVOKED');}
  // Feature-local closing is not a document/authority invalidation. Keep all
  // claims and pending restore targets until an explicit release retry.
  close(){this.#open=false;this.#disconnect();this.#reservation?.close();}
  #canApply(){
    if(!this.#open)return false;
    let current=false;try{current=this.#canObserve()===true;}catch{}
    if(!current||!this.#open||this.#document.defaultView?.document!==this.#document){this.#invalidate('AUTHORITY_REVOKED');return false;}
    if(this.#document.location.href!==this.#url){this.#invalidate('ROUTE_CHANGED');return false;}
    return true;
  }
  scan(){
    if(!this.#open||this.#busy)return null;
    this.#busy=true;
    this.#scanSequence++;this.#scanComplete=false;
    try{
    let current=false;try{current=this.#canObserve()===true;}catch{}
    if(!current||!this.#open){this.#invalidate('AUTHORITY_REVOKED');return null;}
    if(this.#document.location.href!==this.#url){
      // A same-document navigation needs a NEW reservation context even when
      // the legacy trusted caller explicitly permits observing the new route.
      this.#reservation?.close();
      if(!['YT-06','YT-07','YT-08','YT-09','IG-01','IG-02','IG-03','IG-04','IG-05','IG-06'].includes(this.#profile.feature_id)){this.#invalidate('ROUTE_CHANGED');return null;}
      const next=new URL(this.#document.location.href);let authorized=false,originAllowed=false,routeAllowed=false,reauthorization='NOT_CALLED';
      // Only a trusted caller may reauthorize a same-document transition.
      // A page event or URL alone is never authority. Default remains fail-closed.
      const hosts=this.#profile.feature_id.startsWith('IG-')?INSTAGRAM:HOSTS;
      try{
        originAllowed=next.protocol==='https:'&&hosts.has(next.hostname)&&!next.port&&!next.username&&!next.password;
        routeAllowed=originAllowed&&this.#profile.routeAllowed(next);
        if(routeAllowed){authorized=this.#authorizeNavigation?.({previous_url:this.#url,next_url:next.href})===true;reauthorization=authorized?'GRANTED':'DENIED';}
      }catch{reauthorization='THREW';}
      this.#observer.disconnect();this.#observing=false;let pending=false;
      for(const[element,claim]of this.#targets){
        if(this.#ledger.release(claim).restored)this.#targets.delete(element);else pending=true;
      }
      if(pending||!authorized){
        this.#invalidate(pending?'ROUTE_CLEANUP_FAILED':'ROUTE_CHANGED',this.#profile.feature_id.startsWith('IG-')?{
          origin_allowed:originAllowed,route_allowed:routeAllowed,reauthorization,
          path_segment_count:next.pathname.split('/').filter(Boolean).length,
          route_family:next.pathname==='/'?'HOME':/^\/stories(?:\/|$)/.test(next.pathname)?'STORIES':/^\/accounts(?:\/|$)/.test(next.pathname)?'ACCOUNTS':'OTHER',
        }:null);return null;
      }
      this.#url=next.href;
    }
    this.#observer.disconnect();this.#observing=false;let eligible=0,restricted=0,errors=0;
    try{
      const current=this.#profile.collect(this.#document);eligible=current.size;
      for(const [element,claim]of this.#targets)if(!current.has(element)){
        this.#reservation?.cancel(claim);
        const cleanup=this.#ledger.release(claim);
        if(cleanup.restored)this.#targets.delete(element);else errors+=cleanup.error_count||1;
      }
      for(const element of current){
        // A failed IG-06 protection split must retain its old restoration debt
        // and must not acquire new branch effects before that cleanup succeeds.
        if(this.#profile.feature_id==='IG-06'&&errors)break;
        if(!this.#canApply())break;
        let claim=this.#targets.get(element);
        if(!claim){
          if(this.#next===Number.MAX_SAFE_INTEGER)throw Error(this.#profile.prefix+'_TARGET_LIMIT');
          claim=`${this.#scope}${this.#claimEpoch}:${++this.#next}`;this.#targets.set(element,claim);
        }
        const apply=['YT-09','IG-06'].includes(this.#profile.feature_id)?'grayscale':this.#profile.preserveLayout?'conceal':'hide';
        const verified=this.#reservation?this.#reservation.hide(claim,element,()=>this.#canApply()
          &&element.isConnected&&this.#profile.collect(this.#document).has(element))
          :this.#ledger[apply](claim,element,()=>this.#canApply());
        if(verified)restricted++;else if(verified!==null)errors++;
      }
    }catch{errors++;}
    if(this.#open){this.#observerState='UNCONFIRMED';this.#observer.observe(this.#document.documentElement,{subtree:true,childList:true,attributes:true,
      characterData:['IG-03','IG-04','IG-05'].includes(this.#profile.feature_id),
      attributeFilter:['href','page-subtype','browse-id','video-id','id','class','style','inert','hidden','data-focurve-restriction','data-focurve-ui',
        ...(this.#profile.feature_id.startsWith('IG-')?['aria-label','role','alt','draggable','contenteditable']:[]),
        ...(this.#profile.feature_id==='IG-03'?['title','aria-labelledby']:[]),
        ...(this.#profile.feature_id==='IG-04'?['placeholder','dir','datetime']:[]),
        ...(this.#profile.feature_id==='IG-06'?['type','action']:[])]});this.#observerState='ATTACHED';}
    this.#observing=this.#open;this.#scanComplete=this.#open;
    const reservation=this.#reservation?.inspect();
    const result={feature_id:this.#profile.feature_id,local_only:true,native_verified:false,status:errors?'FAILED':reservation?.pending_reservations?'OBSERVING':eligible?'OBSERVED':'NO_TARGET',
      eligible_target_count:eligible,restricted_target_count:restricted,error_count:errors,remaining_targets:this.#targets.size};
    if(reservation)Object.assign(result,reservation);
    if(!this.#open)return null;
    this.#lastObservation=structuredClone(result);
    this.#observe(result);return result;
    }finally{this.#busy=false;}
  }
  release(){
    this.#open=false;const disconnected=this.#disconnect();
    this.#reservation?.close();
    if(this.#busy){this.#lastCleanup={local_only:true,restored:false,remaining_targets:this.#targets.size,error_count:0,cleanup_pending:true,scan_pending:true,
      ...(this.#reservation?.inspect()??{})};return structuredClone(this.#lastCleanup);}
    this.#busy=true;
    try{let errors=disconnected?0:1;
    for(const [element,claim]of this.#targets){
      const cleanup=this.#ledger.release(claim);
      if(cleanup.restored)this.#targets.delete(element);else errors+=cleanup.error_count||1;
    }
    const restored=errors===0&&this.#targets.size===0;
    const reservation=this.#reservation?.inspect();
    const live=LIVE.get(this.#ledger);if(restored&&!reservation?.reservation_obligations.length&&live?.get(this.#scope)===this)live.delete(this.#scope);
    this.#lastCleanup={local_only:true,restored,remaining_targets:this.#targets.size,error_count:errors,
      ...(reservation?{...reservation,dom_restored:restored,cleanup_pending:!restored||reservation.reservation_obligations.length>0}: {})};
    return structuredClone(this.#lastCleanup);
    }finally{this.#busy=false;}
  }
  #ownClaims(){return [...new Set([...this.#targets.values(),...(this.#reservation?.claims()??[])])];}
  #restored(){return !this.#open&&!this.#busy&&!this.#observing&&this.#targets.size===0&&this.#lastCleanup?.restored===true
    &&this.#ledger.snapshotClaims(this.#ownClaims()).remaining_targets===0;}
  async evidenceSnapshot(){
    if(this.#profile.feature_id!=='IG-04')throw Error('UNSUPPORTED_EVIDENCE_FEATURE');
    const gate=await this.#reservation?.snapshot();
    return structuredClone({local_only:true,native_verified:false,feature_id:'IG-04',
      observer_active:this.#observing,scan_in_progress:this.#busy,scan_scheduled:this.#scheduled,
      scan_sequence:this.#scanSequence,scan_complete:this.#scanComplete,observation:this.#lastObservation,
      cleanup:this.#lastCleanup,dom_cleanup_confirmed:this.#restored(),ledger:this.#ledger.snapshotClaims(this.#ownClaims()),gate:gate??null});
  }
  async quiescenceSnapshot(){
    if(this.#profile.feature_id!=='IG-04')throw Error('UNSUPPORTED_EVIDENCE_FEATURE');
    // Close synchronously, but let the actual queued refresh and synchronous
    // scan stack finish. Never force busy/scheduled to false or clear claims.
    this.close();await new Promise(resolve=>queueMicrotask(resolve));
    const snapshot=await this.evidenceSnapshot();
    const observer_stopped=['NOT_ATTEMPTED','CONSTRUCTED','STOPPED'].includes(this.#observerState);
    const listeners_detached=this.#listeners.every(entry=>entry.removed);
    const scan_drained=!this.#busy&&!this.#scheduled;
    const reservation_callbacks_settled=(snapshot.gate?.local_tracking.reserve_callbacks_unsettled??0)===0;
    return {...snapshot,local_quiescence:{future_effects_closed:!this.#open,observer_stopped,listeners_detached,scan_drained,reservation_callbacks_settled,
      locally_quiescent:!this.#open&&observer_stopped&&listeners_detached&&scan_drained&&reservation_callbacks_settled}};
  }
  async completeReservation(identity,proof){
    if(!this.#reservation)return {local_only:true,accepted:false,reason:'RESERVATION_GATE_REQUIRED'};
    const result=await this.#reservation.completeReservation(identity,proof,()=>this.#restored());
    if(result.accepted)this.release();
    return {...result,cleanup:structuredClone(this.#lastCleanup)};
  }
}
