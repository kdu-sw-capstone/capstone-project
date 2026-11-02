import { ClaimLedger } from './claim-ledger.mjs';

// Internal YT-10 adapter, not a wire receiver. The caller owns native scope,
// frozen policy and durable intent. No video play/pause/mute/next interception.
const SELECTOR = 'ytd-watch-flexy .ytp-autonav-toggle-button[aria-checked]';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const registries = new WeakMap();
const checked = element => element.getAttribute('aria-checked');

export class AutoplaySession {
  #document; #registry; #scope; #targets = new Set(); #url;
  #open = false; #started = false; #observer; #scheduled = false;
  #observe; #invalidateCallback; #canObserve; #busy=false;

  constructor(document, {ledger, owner_binding_id, binding_id, onObservation = () => {}, onInvalidated = () => {}, canObserve = () => true}) {
    if (!(ledger instanceof ClaimLedger)) throw Error('SHARED_LEDGER_REQUIRED');
    if (![owner_binding_id,binding_id].every(value => typeof value === 'string' && UUID.test(value))) throw Error('INVALID_CLAIM_SCOPE');
    this.#document = document;
    if (!registries.has(ledger)) registries.set(ledger,{document,live:new Map(),elements:new Map()});
    this.#registry = registries.get(ledger);
    if (this.#registry.document !== document) throw Error('FOREIGN_DOCUMENT');
    this.#scope = JSON.stringify([owner_binding_id,binding_id]);
    this.#observe = onObservation; this.#invalidateCallback = onInvalidated;
    this.#canObserve = canObserve;
    this.refresh = () => {
      if (!this.#open || this.#scheduled) return;
      this.#scheduled = true;
      queueMicrotask(() => {this.#scheduled=false;if(this.#open)this.scan();});
    };
    this.pagehide = () => this.#invalidate('PAGEHIDE');
  }

  start() {
    if (this.#started) throw Error('AUTOPLAY_ALREADY_STARTED');
    const win=this.#document.defaultView,url=new URL(this.#document.location.href);
    if (win.top!==win || url.protocol!=='https:' || !['youtube.com','www.youtube.com'].includes(url.hostname)
      || url.port || url.username || url.password || url.pathname!=='/watch') throw Error('UNSUPPORTED_WATCH_DOCUMENT');
    if (this.#registry.live.has(this.#scope)) throw Error('AUTOPLAY_SCOPE_ALREADY_ACTIVE');
    this.#registry.live.set(this.#scope,this);this.#started=true;this.#open=true;this.#url=url.href;
    this.#observer=new win.MutationObserver(this.refresh);
    for(const name of ['popstate','hashchange','yt-navigate-finish'])win.addEventListener(name,this.refresh);
    win.navigation?.addEventListener('currententrychange',this.refresh);
    win.addEventListener('pagehide',this.pagehide);
    return this.scan();
  }

  #disconnect() {
    this.#observer?.disconnect();const win=this.#document.defaultView;
    for(const name of ['popstate','hashchange','yt-navigate-finish'])win.removeEventListener(name,this.refresh);
    win.navigation?.removeEventListener('currententrychange',this.refresh);
    win.removeEventListener('pagehide',this.pagehide);
  }
  #invalidate(reason) {
    if(!this.#open)return;this.#open=false;this.#disconnect();
    this.#invalidateCallback({local_only:true,reason,cleanup_pending:this.#targets.size>0});
  }

  stop(){this.#invalidate('AUTHORITY_REVOKED');}
  #canApply(){
    if(!this.#open)return false;
    let current=false;try{current=this.#canObserve()===true;}catch{}
    if(!current||!this.#open||this.#document.defaultView?.document!==this.#document){this.#invalidate('AUTHORITY_REVOKED');return false;}
    if(this.#document.location.href!==this.#url){this.#invalidate('ROUTE_CHANGED');return false;}
    return true;
  }
  #restrict(element) {
    if(element.ownerDocument!==this.#document||!this.#canApply())return false;
    let entry=this.#registry.elements.get(element);
    const value=checked(element);
    if(!['true','false'].includes(value))return false;
    if(!entry){
      // Reserve cleanup ownership before clicking a possibly throwing handler.
      entry={original:value,changed:false,failed:false,owners:new Set()};
      this.#registry.elements.set(element,entry);
    }
    entry.owners.add(this);this.#targets.add(element);
    if(value==='false'){entry.failed=false;return true;}
    if(entry.failed)return false; // Do not hammer a rejected toggle on rescans.
    entry.changed=true;entry.failed=true;
    if(!this.#canApply())return false;
    try{element.click();}catch{return false;}
    if(!this.#canApply())return false;
    const off=checked(element)==='false';entry.failed=!off;return off;
  }

  #releaseTarget(element) {
    const entry=this.#registry.elements.get(element);
    if(!entry?.owners.has(this)){this.#targets.delete(element);return true;}
    if(element.ownerDocument!==this.#document)return false;
    if(entry.owners.size>1){entry.owners.delete(this);this.#targets.delete(element);return true;}
    const value=checked(element);
    if(!['true','false'].includes(value))return false;
    // Restore only a change we made, still in our last written OFF state.
    // Already-ON state is a later page/user change and is left alone.
    if(entry.changed && entry.original==='true' && value==='false'){
      try{element.click();}catch{return false;}
      if(checked(element)!=='true')return false;
    }
    entry.owners.delete(this);this.#registry.elements.delete(element);this.#targets.delete(element);return true;
  }

  scan() {
    if(!this.#open||this.#busy)return null;
    this.#busy=true;
    try{
    let current=false;try{current=this.#canObserve()===true;}catch{}
    if(!current||!this.#open){this.#invalidate('AUTHORITY_REVOKED');return null;}
    if(this.#document.location.href!==this.#url){this.#invalidate('ROUTE_CHANGED');return null;}
    this.#observer.disconnect();let eligible=0,restricted=0,errors=0;
    try{
      const targets=[...this.#document.querySelectorAll(SELECTOR)],current=new Set(targets);
      for(const element of this.#targets)if(!current.has(element)&&!this.#releaseTarget(element))errors++;
      eligible=targets.length;
      for(const element of targets){if(!this.#canApply())break;if(this.#restrict(element))restricted++;else errors++;}
    }catch{errors++;}
    if(this.#open)this.#observer.observe(this.#document.documentElement,{subtree:true,childList:true,attributes:true,
      attributeFilter:['aria-checked','class','id']});
    const result={feature_id:'YT-10',local_only:true,native_verified:false,
      status:errors?'FAILED':eligible?'OBSERVED':'NO_TARGET',eligible_target_count:eligible,
      restricted_target_count:restricted,error_count:errors,remaining_targets:this.#targets.size};
    if(!this.#open)return null;
    this.#observe(result);return result;
    }finally{this.#busy=false;}
  }

  release() {
    this.#open=false;this.#disconnect();
    if(this.#busy)return {local_only:true,restored:false,remaining_targets:this.#targets.size,error_count:0,cleanup_pending:true,scan_pending:true};
    this.#busy=true;
    try{let errors=0;
    for(const element of this.#targets)if(!this.#releaseTarget(element))errors++;
    const restored=errors===0&&this.#targets.size===0;
    if(restored&&this.#registry.live.get(this.#scope)===this)this.#registry.live.delete(this.#scope);
    return {local_only:true,restored,remaining_targets:this.#targets.size,error_count:errors};
    }finally{this.#busy=false;}
  }
}
