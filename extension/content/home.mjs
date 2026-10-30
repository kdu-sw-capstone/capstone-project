import {ClaimLedger} from './claim-ledger.mjs';

// YT-01 DOM adapter, not an authorized Core receiver. The trusted caller owns
// frozen policy, native scope, durable intent and the wire evidence envelope.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HOSTS=new Set(['youtube.com','www.youtube.com']);
const LIVE=new WeakMap();
const LINKS='ytd-guide-entry-renderer a[href], ytd-mini-guide-entry-renderer a[href], ytd-masthead a#logo[href], ytd-topbar-logo-renderer a[href]';

export class HomeSession {
  #document;#ledger;#scope;#targets=new Map();#next=0;#url;
  #open=false;#started=false;#scheduled=false;#observer;#observe;#invalidateCallback;
  constructor(document,{ledger,owner_binding_id,binding_id,onObservation=()=>{},onInvalidated=()=>{}}){
    if(!(ledger instanceof ClaimLedger))throw Error('SHARED_LEDGER_REQUIRED');
    if(![owner_binding_id,binding_id].every(value=>typeof value==='string'&&UUID.test(value)))throw Error('INVALID_CLAIM_SCOPE');
    this.#document=document;this.#ledger=ledger;this.#scope=JSON.stringify([owner_binding_id,binding_id,'YT-01']);
    this.#observe=onObservation;this.#invalidateCallback=onInvalidated;
    this.refresh=()=>{
      if(!this.#open||this.#scheduled)return;this.#scheduled=true;
      queueMicrotask(()=>{this.#scheduled=false;if(this.#open)this.scan();});
    };
    this.pagehide=()=>this.#invalidate('PAGEHIDE');
  }
  start(){
    if(this.#started)throw Error('HOME_ALREADY_STARTED');
    const win=this.#document.defaultView,url=new URL(this.#document.location.href);
    if(win.top!==win||url.protocol!=='https:'||!HOSTS.has(url.hostname)||url.port||url.username||url.password
      ||!['/','/watch','/results'].includes(url.pathname))throw Error('UNSUPPORTED_HOME_DOCUMENT');
    let live=LIVE.get(this.#ledger);if(!live){live=new Map();LIVE.set(this.#ledger,live);}
    if(live.has(this.#scope))throw Error('HOME_SCOPE_ALREADY_ACTIVE');
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
  #eligible(){
    const targets=new Set();
    // A hidden/stale HOME tree on /results or /watch is not the current feed.
    if(this.#document.location.pathname==='/')for(const node of this.#document.querySelectorAll('ytd-browse[page-subtype="home"]'))targets.add(node);
    for(const link of this.#document.querySelectorAll(LINKS)){
      let url;try{url=new URL(link.getAttribute('href'),this.#document.location.href);}catch{continue;}
      if(url.protocol==='https:'&&HOSTS.has(url.hostname)&&!url.port&&!url.username&&!url.password&&url.pathname==='/'){
        // Hide this entry, never the whole sidebar, search bar or player.
        targets.add(link.closest('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer')??link);
      }
    }
    return targets;
  }
  scan(){
    if(!this.#open)return null;
    if(this.#document.location.href!==this.#url){this.#invalidate('ROUTE_CHANGED');return null;}
    this.#observer.disconnect();let eligible=0,restricted=0,errors=0;
    try{
      const current=this.#eligible();eligible=current.size;
      for(const [element,claim]of this.#targets)if(!current.has(element)){
        const cleanup=this.#ledger.release(claim);
        if(cleanup.restored)this.#targets.delete(element);else errors+=cleanup.error_count||1;
      }
      for(const element of current){
        let claim=this.#targets.get(element);
        if(!claim){
          if(this.#next===Number.MAX_SAFE_INTEGER)throw Error('HOME_TARGET_LIMIT');
          claim=`${this.#scope}:${++this.#next}`;this.#targets.set(element,claim);
        }
        if(this.#ledger.hide(claim,element))restricted++;else errors++;
      }
    }catch{errors++;}
    if(this.#open)this.#observer.observe(this.#document.documentElement,{subtree:true,childList:true,attributes:true,
      attributeFilter:['href','page-subtype','id','class','style','inert','hidden']});
    const result={feature_id:'YT-01',local_only:true,native_verified:false,status:errors?'FAILED':eligible?'OBSERVED':'NO_TARGET',
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
