import {ClaimLedger} from './claim-ledger.mjs';
import {inspectKeywordUrl} from './keyword-url.mjs';

// Document-local trusted caller seam. Not a Core listener, native URL proof or
// durable cleanup registry. Caller must reserve effects BEFORE granting true.
export class KeywordSession {
  #doc;#ledger;#policy;#canApply;#authorize;#claim;#url;#observer;#notice;
  #active=false;#started=false;#busy=false;#queued=false;#timer;#result=null;
  constructor(document,{ledger,policy,owner_binding_id,binding_id,canApply=()=>false,authorizeNavigation=()=>false}) {
    const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
    if(!(ledger instanceof ClaimLedger)||![owner_binding_id,binding_id].every(x=>typeof x==='string'&&uuid.test(x)))throw Error('INVALID_KEYWORD_SCOPE');
    if(typeof canApply!=='function'||typeof authorizeNavigation!=='function')throw Error('INVALID_KEYWORD_AUTHORITY');
    this.#doc=document;this.#ledger=ledger;this.#policy=structuredClone(policy);this.#canApply=canApply;this.#authorize=authorizeNavigation;
    this.#claim=JSON.stringify(['KEYWORD',owner_binding_id,binding_id,crypto.randomUUID()]);
    this.refresh=()=>{if(this.#active&&!this.#queued){this.#queued=true;queueMicrotask(()=>{this.#queued=false;if(this.#active)this.scan();});}};
    this.play=event=>{if(this.#active&&this.#ledger.inspect(this.#claim).remaining_targets>0&&this.#current()&&event.target?.ownerDocument===this.#doc){try{event.target.pause();if(event.target.paused!==true)throw Error('MEDIA_NOT_STOPPED');}catch{this.#result={...this.#result,status:'FAILED',media_stopped:false};}}};
    this.pagehide=()=>this.stop();
  }
  #current(checkUrl=true){try{const v=this.#canApply();if(v&&typeof v.then==='function')Promise.resolve(v).catch(()=>{});return this.#active&&this.#doc.defaultView?.document===this.#doc&&(!checkUrl||this.#doc.location.href===this.#url)&&v===true;}catch{return false;}}
  #base(){return {local_only:true,native_verified:false,core_connected:false};}
  #observe(){if(this.#active)this.#observer.observe(this.#doc.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['style','inert']});}
  #clean(){const r=this.#ledger.release(this.#claim);
    if(this.#notice&&this.#notice.ownerDocument!==this.#doc)return {...r,restored:false,remaining_targets:r.remaining_targets+1,error_count:r.error_count+1};
    if(r.restored){this.#notice?.remove();this.#notice=null;}return r;}
  start(){
    if(this.#started)throw Error('KEYWORD_ALREADY_STARTED');
    if(this.#doc.defaultView.top!==this.#doc.defaultView||!/^https?:$/.test(this.#doc.location.protocol))throw Error('UNSUPPORTED_KEYWORD_DOCUMENT');
    this.#started=true;this.#active=true;this.#url=this.#doc.location.href;
    this.#observer=new this.#doc.defaultView.MutationObserver(this.refresh);
    for(const event of ['popstate','hashchange','yt-navigate-finish'])this.#doc.defaultView.addEventListener(event,this.refresh);
    this.#doc.defaultView.navigation?.addEventListener('currententrychange',this.refresh);
    this.#doc.defaultView.addEventListener('pagehide',this.pagehide);
    this.#doc.addEventListener('play',this.play,true);
    // Fallback only observes URL identity; it does not authorize a transition.
    this.#timer=this.#doc.defaultView.setInterval(()=>{if(this.#doc.location.href!==this.#url)this.refresh();},250);
    return this.scan();
  }
  scan(){
    if(this.#busy)return this.inspect();
    if(!this.#current(false)){this.stop();return this.#result={...this.#base(),status:'REVALIDATION_REQUIRED',matched:null,cleanup_pending:this.#ledger.inspect(this.#claim).remaining_targets>0};}
    if(this.#doc.location.href!==this.#url){
      let approved=false;try{approved=this.#authorize({previous_url:this.#url,next_url:this.#doc.location.href})===true;}catch{}
      if(!approved||!this.#current(false)){this.stop();return this.#result={...this.#base(),status:'REVALIDATION_REQUIRED',matched:null,cleanup_pending:this.#ledger.inspect(this.#claim).remaining_targets>0};}
      this.#url=this.#doc.location.href;
    }
    this.#busy=true;this.#observer.disconnect();
    try{
      const check=inspectKeywordUrl(this.#url,this.#policy);
      this.#result={...this.#base(),...check};
      if(check.matched!==true){
        // Invalid input is not permission to remove an already owned restriction.
        const cleanup=check.status==='UNCONFIRMED'?null:this.#clean();
        return this.#result={...this.#result,status:cleanup&&!cleanup.restored?'FAILED':check.status,cleanup,cleanup_pending:this.#ledger.inspect(this.#claim).remaining_targets>0};
      }
      if(!this.#doc.body)throw Error('BODY_UNAVAILABLE');
      if(!this.#notice){
        this.#notice=this.#doc.createElement('aside');this.#notice.dataset.focurveUi='keyword';this.#notice.setAttribute('role','alert');
        this.#notice.textContent='FOCURVE: URL 키워드 정책에 따라 이 페이지가 제한되었습니다. 해제는 확장 프로그램에서 진행하세요.';
        this.#notice.style.cssText='position:fixed;inset:0;z-index:2147483647;background:white;color:black;padding:40px;font:20px sans-serif;display:block!important';
      }
      if(this.#notice.ownerDocument!==this.#doc)throw Error('FOREIGN_NOTICE');
      if(!this.#notice.isConnected)this.#doc.documentElement.append(this.#notice);
      const hidden=this.#ledger.hide(this.#claim,this.#doc.body,()=>this.#current());
      let mediaStopped=true;
      for(const media of this.#doc.querySelectorAll('video,audio')){
        if(!this.#current())break;
        try{media.pause();if(media.ownerDocument!==this.#doc||media.paused!==true)mediaStopped=false;}catch{mediaStopped=false;}
      }
      const noticeVisible=this.#notice.isConnected&&this.#doc.defaultView.getComputedStyle(this.#notice).display!=='none';
      return this.#result={...this.#result,status:hidden&&mediaStopped&&noticeVisible&&this.#current()?'RESTRICTED_LOCAL':'FAILED',media_stopped:mediaStopped,cleanup_pending:this.#ledger.inspect(this.#claim).remaining_targets>0};
    }catch{return this.#result={...this.#base(),status:'FAILED',matched:null,cleanup_pending:this.#ledger.inspect(this.#claim).remaining_targets>0};}
    finally{this.#busy=false;this.#observe();}
  }
  stop(){
    this.#active=false;this.#observer?.disconnect();clearInterval(this.#timer);
    for(const event of ['popstate','hashchange','yt-navigate-finish'])this.#doc.defaultView.removeEventListener(event,this.refresh);
    this.#doc.defaultView.navigation?.removeEventListener('currententrychange',this.refresh);
    this.#doc.defaultView.removeEventListener('pagehide',this.pagehide);this.#doc.removeEventListener('play',this.play,true);
  }
  release(){this.stop();const cleanup=this.#clean();return {...this.#base(),...cleanup,cleanup_pending:!cleanup.restored};}
  inspect(){return structuredClone({...this.#base(),active:this.#active,result:this.#result,cleanup_pending:this.#ledger.inspect(this.#claim).remaining_targets>0||!!this.#notice&&this.#notice.ownerDocument!==this.#doc});}
}
