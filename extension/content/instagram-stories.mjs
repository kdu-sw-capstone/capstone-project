import {NavigationSurfaceSession} from './navigation-surface.mjs';

const HOSTS=new Set(['instagram.com','www.instagram.com']);
const PROTECTED='[data-focurve-ui], [data-focurve-restriction], article, nav, header, footer, aside, [role="navigation"]';
const storyRoute=url=>/^\/stories\/[^/]+(?:\/[^/]+)?\/?$/.test(url.pathname);
const direct=document=>storyRoute(new URL(document.location.href));
function supportedRoute(url){
  // Observation lifetime is broader than effect eligibility. Instagram may
  // pass through index/alias/intermediate routes before the final story URL.
  // collect() below still changes only HOME story entries or a direct viewer.
  // The shared surface separately requires same-host/native reauthorization.
  return !/^\/(?:accounts|challenge|oauth|login|auth|two_factor)(?:\/|$)/i.test(url.pathname);
}
function targets(document){
  const found=new Set();
  if(document.location.pathname==='/'){
    for(const link of document.querySelectorAll('a[href]')){
      if(link.closest(PROTECTED)||link.querySelector(PROTECTED))continue;
      let url;try{url=new URL(link.getAttribute('href'),document.location.href);}catch{continue;}
      if(url.protocol==='https:'&&HOSTS.has(url.hostname)&&!url.port&&!url.username&&!url.password&&storyRoute(url))found.add(link);
    }
    // Current home tray uses a labeled div/button rather than an href. Require
    // the story label AND list/ring/profile shape, not volatile CSS classes or
    // every profile button. Attribute values never leave this local adapter.
    for(const button of document.querySelectorAll('[role="button"][aria-label], button[aria-label]')){
      if(button.closest(PROTECTED)||button.querySelector(PROTECTED))continue;
      const label=button.getAttribute('aria-label').normalize('NFKC');
      if(!/^.+(?:님의 스토리|['’]s story)(?:,|$)/i.test(label))continue;
      const item=button.closest('li');
      if(item?.closest('ul, ol')&&button.querySelector('canvas')&&button.querySelector('[role="link"] img'))found.add(button);
    }
  }else if(direct(document)){
    // Route-bound media only: never hide the page container, close controls,
    // ordinary post articles, navigation, or protected FOCURVE UI.
    for(const media of document.querySelectorAll('main img, main video, main audio, [role="main"] img, [role="main"] video, [role="main"] audio, [role="dialog"] img, [role="dialog"] video, [role="dialog"] audio, [role="presentation"] img, [role="presentation"] video, [role="presentation"] audio')){
      if(!media.closest(PROTECTED)&&!media.closest('button, a, [role="button"], [hidden]'))found.add(media);
    }
    // User-observed viewer: an ordinary portrait-sized div, without semantic
    // main/dialog roles. Require that local frame shape on a STORIES route;
    // never broaden to every image/video on every Instagram page.
    for(const media of document.querySelectorAll('img, video, audio')){
      if(found.has(media)||media.closest(PROTECTED)||media.closest('button, a, [role="button"], [hidden]'))continue;
      if(media.matches('img')&&(media.getAttribute('alt')!==''||media.getAttribute('draggable')!=='false'))continue;
      let frame=media.parentElement;
      // Instagram nests repost/music viewers many levels below their frame.
      // DOM depth is not an authority boundary; keep walking this document's
      // ancestors while retaining the route/frame/protected-content checks.
      for(;frame;frame=frame.parentElement){
        const w=frame.style.width,h=frame.style.height;
        if(frame.tagName==='DIV'&&/^\d+(?:\.\d+)?px$/.test(w)&&/^\d+(?:\.\d+)?px$/.test(h)
          &&parseFloat(w)>0&&parseFloat(h)>parseFloat(w)
          &&!frame.querySelector(PROTECTED)&&!frame.querySelector('input, textarea, [contenteditable="true"]')){found.add(media);break;}
      }
    }
  }
  return new Set([...found].filter(node=>![...found].some(other=>other!==node&&other.contains(node))));
}

// Internal DOM adapter only. Caller must provide actual frozen/native authority
// and durable effect/cleanup storage before any product use.
export class InstagramStoriesSession {
  #surface;#document;#media=new Set();#open=false;#started=false;#url;#last=null;#observe;#invalidated;#canObserve;#busy=false;
  constructor(document,options){
    this.#document=document;this.#observe=options.onObservation??(()=>{});this.#invalidated=options.onInvalidated??(()=>{});
    const canObserve=options.canObserve??(()=>true);this.#canObserve=canObserve;
    this.onPlay=event=>{if(this.#open&&document.location.href===this.#url&&this.#media.has(event.target)&&event.target.ownerDocument===document&&direct(document)){
      if(!this.#canApply())return;
      if(this.#busy)return;this.#busy=true;
      try{event.target.pause();if(this.#canApply()&&!event.target.paused)this.#failure();}catch{this.#failure();}finally{this.#busy=false;}
    }};
    this.#surface=new NavigationSurfaceSession(document,{...options,
      onObservation:r=>this.#observeMedia(r),onInvalidated:r=>{this.#stop();this.#invalidated(r);}},
      // Neutral pages keep the authorized same-document controller alive, but
      // collect() returns nothing there. Every transition still needs the
      // caller's explicit native/frozen reauthorization in the shared surface.
      {feature_id:'IG-01',prefix:'INSTAGRAM_STORIES',routeAllowed:supportedRoute,collect:targets});
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
    if(direct(this.#document))for(const media of targets(this.#document))if(media.matches('video, audio')){
      if(!this.#canApply())break;
      this.#media.add(media);try{media.pause();if(!this.#canApply())break;if(!media.paused)errors++;}catch{errors++;}
    }
    if(!this.#open)return;
    this.#last={...result,adapter_revision:'ig-stories-observe-3',status:errors?'FAILED':result.status,error_count:result.error_count+errors,
      media_target_count:this.#media.size,media_stopped_if_route_block:direct(this.#document)?result.eligible_target_count>0&&errors===0:null};
    this.#observe(this.#last);
  }
  start(){
    if(this.#started)throw Error('INSTAGRAM_STORIES_ALREADY_STARTED');
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
