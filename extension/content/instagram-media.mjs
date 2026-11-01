import {NavigationSurfaceSession} from './navigation-surface.mjs';

// Internal DOM adapter only. Caller must provide actual frozen/native authority
// and durable effect/cleanup storage before any product use.
export class InstagramMediaSession {
  #surface;#document;#media=new Set();#open=false;#started=false;#url;#last=null;#observe;#invalidated;#canObserve;#busy=false;#profile;
  constructor(document,options,profile){
    this.#profile=profile;
    this.#document=document;this.#observe=options.onObservation??(()=>{});this.#invalidated=options.onInvalidated??(()=>{});
    const canObserve=options.canObserve??(()=>true);this.#canObserve=canObserve;
    this.onPlay=event=>{if(this.#open&&document.location.href===this.#url&&this.#media.has(event.target)&&event.target.ownerDocument===document&&profile.mediaEligible(document)){
      if(!this.#canApply())return;
      if(this.#busy)return;this.#busy=true;
      try{event.target.pause();if(this.#canApply()&&!event.target.paused)this.#failure();}catch{this.#failure();}finally{this.#busy=false;}
    }};
    this.#surface=new NavigationSurfaceSession(document,{...options,
      onObservation:r=>this.#observeMedia(r),onInvalidated:r=>{this.#stop();this.#invalidated(r);}},
      // Neutral pages keep the authorized same-document controller alive, but
      // collect() returns nothing there. Every transition still needs the
      // caller's explicit native/frozen reauthorization in the shared surface.
      profile);
  }
  #stop(){this.#open=false;this.#document.removeEventListener('play',this.onPlay,true);this.#media.clear();}
  #failure(){if(this.#last){this.#last={...this.#last,status:'FAILED',error_count:this.#last.error_count+1,media_stopped_if_route_block:false};this.#observe(this.#last);}}
  stop(){this.#surface.stop();this.#stop();}
  #canApply(){
    if(!this.#open)return false;
    let current=false;try{current=this.#canObserve()===true;}catch{}
    if(!current||!this.#open||this.#document.defaultView?.document!==this.#document||this.#document.location.href!==this.#url){this.stop();return false;}
    return true;
  }
  #observeMedia(result){
    if(!this.#open)return;
    this.#url=this.#document.location.href;
    this.#media.clear();let errors=0;
    if(this.#profile.mediaEligible(this.#document))for(const media of this.#profile.mediaTargets(this.#document))if(media.matches('video, audio')){
      if(!this.#canApply())break;
      this.#media.add(media);try{media.pause();if(!this.#canApply())break;if(!media.paused)errors++;}catch{errors++;}
    }
    if(!this.#open)return;
    this.#last={...result,adapter_revision:this.#profile.revision,status:errors?'FAILED':this.#profile.requiresMedia&&this.#profile.direct(this.#document)&&!this.#media.size?'OBSERVING':result.status,error_count:result.error_count+errors,
      media_target_count:this.#media.size,media_stopped_if_route_block:this.#profile.direct(this.#document)?result.eligible_target_count>0&&result.error_count===0&&result.restricted_target_count===result.eligible_target_count&&errors===0&&(!this.#profile.requiresMedia||this.#media.size>0):null};
    this.#observe(this.#last);
  }
  start(){
    if(this.#started)throw Error(this.#profile.prefix+'_ALREADY_STARTED');
    this.#open=true;this.#document.addEventListener('play',this.onPlay,true);
    try{this.#surface.start();this.#started=true;return this.#last;}catch(error){this.#stop();throw error;}
  }
  scan(){const r=this.#surface.scan();return r?this.#last:null;}
  release(){
    if(this.#busy){this.stop();return {local_only:true,restored:false,remaining_targets:null,error_count:0,cleanup_pending:true,scan_pending:true};}
    const result=this.#surface.release();
    // Retain replay protection for unresolved owned changes in this document.
    // Do not auto-play on release: the user retains manual playback control.
    if(result.restored)this.#stop();
    return result;
  }
}
