import {ClaimLedger} from './claim-ledger.mjs';

// Internal navigation DOM primitive, not an authorized Core receiver. The caller owns
// frozen policy, native scope, durable intent and the wire evidence envelope.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HOSTS=new Set(['youtube.com','www.youtube.com']);
const LIVE=new WeakMap();

export class NavigationSurfaceSession {
  #document;#ledger;#scope;#targets=new Map();#next=0;#url;
  #open=false;#started=false;#scheduled=false;#observer;#observe;#invalidateCallback;
  #profile;#authorizeNavigation;
  constructor(document,{ledger,owner_binding_id,binding_id,onObservation=()=>{},onInvalidated=()=>{},authorizeNavigation=null},profile){
    // Profiles are module-owned selectors, not page/Wire policy or capability.
    if(!profile||!['YT-01','YT-05','YT-06','YT-07','YT-08'].includes(profile.feature_id)||typeof profile.collect!=='function'||typeof profile.routeAllowed!=='function')throw Error('INVALID_NAVIGATION_PROFILE');
    this.#profile=Object.freeze({...profile});
    if(!(ledger instanceof ClaimLedger))throw Error('SHARED_LEDGER_REQUIRED');
    if(![owner_binding_id,binding_id].every(value=>typeof value==='string'&&UUID.test(value)))throw Error('INVALID_CLAIM_SCOPE');
    this.#document=document;this.#ledger=ledger;this.#scope=JSON.stringify([owner_binding_id,binding_id,profile.feature_id]);
    this.#observe=onObservation;this.#invalidateCallback=onInvalidated;
    this.#authorizeNavigation=authorizeNavigation;
    this.refresh=()=>{
      if(!this.#open||this.#scheduled)return;this.#scheduled=true;
      queueMicrotask(()=>{this.#scheduled=false;if(this.#open)this.scan();});
    };
    this.pagehide=()=>this.#invalidate('PAGEHIDE');
  }
  start(){
    if(this.#started)throw Error(this.#profile.prefix+'_ALREADY_STARTED');
    const win=this.#document.defaultView,url=new URL(this.#document.location.href);
    if(win.top!==win||url.protocol!=='https:'||!HOSTS.has(url.hostname)||url.port||url.username||url.password
      ||!this.#profile.routeAllowed(url))throw Error('UNSUPPORTED_'+this.#profile.prefix+'_DOCUMENT');
    let live=LIVE.get(this.#ledger);if(!live){live=new Map();LIVE.set(this.#ledger,live);}
    if(live.has(this.#scope))throw Error(this.#profile.prefix+'_SCOPE_ALREADY_ACTIVE');
    live.set(this.#scope,this);this.#started=true;this.#open=true;this.#url=url.href;
    this.#observer=new win.MutationObserver(this.refresh);
    for(const name of ['popstate','hashchange','yt-navigate-finish'])win.addEventListener(name,this.refresh);
    win.navigation?.addEventListener('currententrychange',this.refresh);win.addEventListener('pagehide',this.pagehide);
    return this.scan();
  }
  #disconnect(){
    this.#observer?.disconnect();const win=this.#document.defaultView;
    for(const name of ['popstate','hashchange','yt-navigate-finish'])win.removeEventListener(name,this.refresh);
    win.navigation?.removeEventListener('currententrychange',this.refresh);win.removeEventListener('pagehide',this.pagehide);
  }
  #invalidate(reason){
    if(!this.#open)return;this.#open=false;this.#disconnect();
    this.#invalidateCallback({local_only:true,reason,cleanup_pending:this.#targets.size>0});
  }
  scan(){
    if(!this.#open)return null;
    if(this.#document.location.href!==this.#url){
      if(!['YT-06','YT-07','YT-08'].includes(this.#profile.feature_id)){this.#invalidate('ROUTE_CHANGED');return null;}
      const next=new URL(this.#document.location.href);let authorized=false;
      // Only a trusted caller may reauthorize a same-document transition.
      // A page event or URL alone is never authority. Default remains fail-closed.
      try{authorized=next.protocol==='https:'&&HOSTS.has(next.hostname)&&!next.port&&!next.username&&!next.password
        &&this.#profile.routeAllowed(next)&&this.#authorizeNavigation?.({previous_url:this.#url,next_url:next.href})===true;}catch{}
      this.#observer.disconnect();let pending=false;
      for(const[element,claim]of this.#targets){
        if(this.#ledger.release(claim).restored)this.#targets.delete(element);else pending=true;
      }
      if(pending||!authorized){this.#invalidate(pending?'ROUTE_CLEANUP_FAILED':'ROUTE_CHANGED');return null;}
      this.#url=next.href;
    }
    this.#observer.disconnect();let eligible=0,restricted=0,errors=0;
    try{
      const current=this.#profile.collect(this.#document);eligible=current.size;
      for(const [element,claim]of this.#targets)if(!current.has(element)){
        const cleanup=this.#ledger.release(claim);
        if(cleanup.restored)this.#targets.delete(element);else errors+=cleanup.error_count||1;
      }
      for(const element of current){
        let claim=this.#targets.get(element);
        if(!claim){
          if(this.#next===Number.MAX_SAFE_INTEGER)throw Error(this.#profile.prefix+'_TARGET_LIMIT');
          claim=`${this.#scope}:${++this.#next}`;this.#targets.set(element,claim);
        }
        if(this.#ledger.hide(claim,element))restricted++;else errors++;
      }
    }catch{errors++;}
    if(this.#open)this.#observer.observe(this.#document.documentElement,{subtree:true,childList:true,attributes:true,
      attributeFilter:['href','page-subtype','browse-id','video-id','id','class','style','inert','hidden','data-focurve-restriction','data-focurve-ui']});
    const result={feature_id:this.#profile.feature_id,local_only:true,native_verified:false,status:errors?'FAILED':eligible?'OBSERVED':'NO_TARGET',
      eligible_target_count:eligible,restricted_target_count:restricted,error_count:errors,remaining_targets:this.#targets.size};
    this.#observe(result);return result;
  }
  release(){
    this.#open=false;this.#disconnect();let errors=0;
    for(const [element,claim]of this.#targets){
      const cleanup=this.#ledger.release(claim);
      if(cleanup.restored)this.#targets.delete(element);else errors+=cleanup.error_count||1;
    }
    const restored=errors===0&&this.#targets.size===0;
    const live=LIVE.get(this.#ledger);if(restored&&live?.get(this.#scope)===this)live.delete(this.#scope);
    return {local_only:true,restored,remaining_targets:this.#targets.size,error_count:errors};
  }
}
