import {ClaimLedger} from './claim-ledger.mjs';
import {inspectKeywordUrl} from './keyword-url.mjs';

// Document-local trusted caller seam. Not a Core listener, native URL proof or
// durable cleanup registry. Caller must reserve effects BEFORE granting true.
export class KeywordSession {
  #doc;#ledger;#policy;#canApply;#authorize;#claim;#url;#observer;#notice;
  #active=false;#started=false;#busy=false;#queued=false;#timer;#result=null;#revision=0;#cleaning=false;
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
  #pending(){return this.#ledger.inspect(this.#claim).remaining_targets>0||!!this.#notice;}
  #cleanNotice(){const notice=this.#notice;if(!notice)return true;
    if(notice.ownerDocument!==this.#doc)return false;
    try{notice.remove();if(notice.parentNode)return false;if(this.#notice===notice)this.#notice=null;return true;}catch{return false;}}
  #clean(){if(this.#cleaning)return {restored:false,remaining_targets:1,error_count:1};
    this.#cleaning=true;try{const r=this.#ledger.release(this.#claim);
      if(!this.#cleanNotice())return {...r,restored:false,remaining_targets:r.remaining_targets+1,error_count:r.error_count+1};
      return r;
    }finally{this.#cleaning=false;}}
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
    if(!this.#current(false)){this.stop();return this.#result={...this.#base(),status:'REVALIDATION_REQUIRED',matched:null,cleanup_pending:this.#pending()};}
    if(this.#doc.location.href!==this.#url){
      let approved=false;try{approved=this.#authorize({previous_url:this.#url,next_url:this.#doc.location.href})===true;}catch{}
      if(!approved||!this.#current(false)){this.stop();return this.#result={...this.#base(),status:'REVALIDATION_REQUIRED',matched:null,cleanup_pending:this.#pending()};}
      this.#url=this.#doc.location.href;
    }
    this.#busy=true;this.#observer.disconnect();const revision=this.#revision;
    const current=()=>revision===this.#revision&&this.#current();
    try{
      const check=inspectKeywordUrl(this.#url,this.#policy);
      this.#result={...this.#base(),...check};
      if(check.matched!==true){
        // Invalid input is not permission to remove an already owned restriction.
        const cleanup=check.status==='UNCONFIRMED'?null:this.#clean();
        return this.#result={...this.#result,status:cleanup&&!cleanup.restored?'FAILED':check.status,cleanup,cleanup_pending:this.#pending()};
      }
      if(!this.#doc.body)throw Error('BODY_UNAVAILABLE');
      if(!this.#notice){
        const notice=this.#doc.createElement('aside');
        if(!current())throw Error('REVALIDATION_REQUIRED');
        this.#notice=notice;notice.dataset.focurveUi='keyword';notice.setAttribute('role','alert');
        notice.textContent='FOCURVE: URL 키워드 정책에 따라 이 페이지가 제한되었습니다. 해제는 확장 프로그램에서 진행하세요.';
        notice.style.cssText='position:fixed;inset:0;z-index:2147483647;background:white;color:black;padding:40px;font:20px sans-serif;display:block!important';
      }
      if(!current())throw Error('REVALIDATION_REQUIRED');
      if(this.#notice.ownerDocument!==this.#doc)throw Error('FOREIGN_NOTICE');
      const notice=this.#notice;
      if(!notice.isConnected){this.#doc.documentElement.append(notice);
        // append may synchronously re-enter release before it actually connects.
        if(!current()){this.#notice=notice;throw Error('REVALIDATION_REQUIRED');}}
      if(!current())throw Error('REVALIDATION_REQUIRED');
      const hidden=this.#ledger.hide(this.#claim,this.#doc.body,current);
      let mediaStopped=true;
      for(const media of this.#doc.querySelectorAll('video,audio')){
        if(!current())break;
        try{media.pause();if(media.ownerDocument!==this.#doc||media.paused!==true)mediaStopped=false;}catch{mediaStopped=false;}
      }
      const noticeVisible=this.#notice.isConnected&&this.#doc.defaultView.getComputedStyle(this.#notice).display!=='none';
      return this.#result={...this.#result,status:hidden&&mediaStopped&&noticeVisible&&this.#current()?'RESTRICTED_LOCAL':'FAILED',media_stopped:mediaStopped,cleanup_pending:this.#pending()};
    }catch{if(!current()){this.stop();this.#cleanNotice();}return this.#result={...this.#base(),status:'FAILED',matched:null,cleanup_pending:this.#pending()};}
    finally{this.#busy=false;this.#observe();}
  }
  stop(){
    this.#revision++;
    this.#active=false;this.#observer?.disconnect();clearInterval(this.#timer);
    for(const event of ['popstate','hashchange','yt-navigate-finish'])this.#doc.defaultView.removeEventListener(event,this.refresh);
    this.#doc.defaultView.navigation?.removeEventListener('currententrychange',this.refresh);
    this.#doc.defaultView.removeEventListener('pagehide',this.pagehide);this.#doc.removeEventListener('play',this.play,true);
  }
  release(){this.stop();const cleanup=this.#clean();return {...this.#base(),...cleanup,cleanup_pending:!cleanup.restored};}
  inspect(){return structuredClone({...this.#base(),active:this.#active,result:this.#result,cleanup_pending:this.#pending()});}
}
