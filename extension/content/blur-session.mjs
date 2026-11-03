// Local image display seam. No model activation, Core authority, durable ACK,
// ContentResult or Server evidence. The verified caller owns those boundaries.
// Separate backdrop layers preserve every image declaration and other owner.
export class BlurSession {
  #doc;#canAnalyze;#refreshTimer;#moveFrame;#classifyImage;#selectImage;#classify;#currentAuthority;#profile;#items=new Map();#active=false;#started=false;
  #url;#observer;#resize;#navigation;#busy=false;#queued=false;#epoch=0;#overflow=0;#timeout;#max;
  #observerState='NOT_ATTEMPTED';#resizeState='NOT_ATTEMPTED';#listeners=[];#scans=0;#pendingModelTasks=0;#callbacks=0;
  constructor(document,{classify,classifyImage,selectImage=()=>true,canAnalyze=()=>true,profile,canApply=()=>false,timeoutMs=3000,maxTargets=128}={}){
    if(!profile||typeof profile.id!=='string'||!profile.id||!/^[a-f0-9]{64}$/.test(profile.sha256)||profile.level!=='HIGH')throw Error('INVALID_BLUR_PROFILE');
    if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000||!Number.isSafeInteger(maxTargets)||maxTargets<1||maxTargets>512)throw Error('INVALID_BLUR_LIMIT');
    this.#doc=document;this.#classifyImage=classifyImage;this.#selectImage=selectImage;this.#canAnalyze=canAnalyze;this.#classify=classify;this.#currentAuthority=canApply;this.#profile=Object.freeze({...profile});this.#timeout=timeoutMs;this.#max=maxTargets;
    this.refresh=()=>{if(!this.#active||this.#queued)return;this.#queued=true;this.#refreshTimer=setTimeout(()=>{this.#refreshTimer=null;this.#queued=false;if(this.#active)this.scan();},120);};
    this.move=()=>{if(!this.#current()||this.#moveFrame!=null)return;this.#moveFrame=this.#doc.defaultView.requestAnimationFrame(()=>this.#callback(()=>{this.#moveFrame=null;if(this.#current()){for(const row of this.#items.values())this.#position(row);this.refresh();}}));};
    this.hide=()=>this.invalidate();
    this.route=()=>{this.#current();};
    for(const key of ['refresh','move','hide','route']){const callback=this[key];this[key]=(...args)=>this.#callback(()=>callback(...args));}
  }
  #current(){
    if(!this.#active)return false;
    let current=false;
    try{const v=this.#currentAuthority();
      if(v&&typeof v.then==='function')Promise.resolve(v).catch(()=>{});
      else current=this.#active&&v===true&&this.#doc.defaultView?.document===this.#doc&&this.#doc.location.href===this.#url;
    }catch{}
    // Once an observation loses authority/document scope, this instance retires.
    // A later true value needs a new session; existing layers remain cleanup debt.
    if(!current)this.invalidate();
    return current;
  }
  #key(image){return JSON.stringify([image.currentSrc,image.src,image.srcset,image.sizes,image.naturalWidth,image.naturalHeight]);}
  #valid(row){return this.#current()&&this.#items.get(row.image)===row&&row.image.ownerDocument===this.#doc&&row.image.isConnected&&row.key===this.#key(row.image);}
  #callback(work){this.#callbacks++;try{return work();}finally{this.#callbacks--;}}
  #listen(target,type,callback,capture=false){const entry={target,type,callback,capture,removed:false};this.#listeners.push(entry);target.addEventListener(type,callback,capture);}
  #termination(){const observer_stopped=['NOT_ATTEMPTED','CONSTRUCTED','STOPPED'].includes(this.#observerState),resize_stopped=['NOT_ATTEMPTED','CONSTRUCTED','STOPPED'].includes(this.#resizeState);
    const listeners_pending=this.#listeners.filter(e=>!e.removed).length,target_listeners_pending=[...this.#items.values()].reduce((n,r)=>n+(r.imageListener?1:0)+(r.coverListener?1:0),0);
    return {scan_in_progress:this.#scans>0,scan_scheduled:this.#queued,position_scheduled:this.#moveFrame!=null,analysis_loop_in_progress:this.#busy,
      pending_model_tasks:this.#pendingModelTasks,callbacks_in_progress:this.#callbacks,observer_stopped,resize_stopped,listeners_pending,target_listeners_pending,
      locally_quiescent:!this.#active&&!this.#scans&&!this.#queued&&this.#moveFrame==null&&!this.#busy&&!this.#pendingModelTasks&&!this.#callbacks&&observer_stopped&&resize_stopped&&!listeners_pending&&!target_listeners_pending};}
  #remove(row){
    if(row.removing)return false;row.removing=true;
    try{
      let clean=true;
      try{row.controller.abort();}catch{clean=false;}
      if(row.imageListener)try{row.image.removeEventListener('click',row.click,true);row.imageListener=false;}catch{clean=false;}
      if(row.coverListener)try{row.cover.removeEventListener('click',row.click);row.coverListener=false;}catch{clean=false;}
      try{this.#resize?.unobserve(row.image);}catch{clean=false;}
      if(row.cover.ownerDocument!==this.#doc)return false;
      try{row.cover.remove();return !row.cover.parentNode&&clean;}catch{return false;}
    }finally{row.removing=false;}
  }
  #position(row){if(row.cover.ownerDocument!==this.#doc)return;
    const image=row.image,rect=image.getBoundingClientRect();
    const win=this.#doc.defaultView;const visible=image.ownerDocument===this.#doc&&image.isConnected&&rect.width>0&&rect.height>0&&rect.bottom>0&&rect.top<win.innerHeight&&rect.right>0&&rect.left<win.innerWidth&&win.getComputedStyle(image).visibility!=='hidden';
    for(const [key,value]of Object.entries({left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'}))if(row.cover.style[key]!==value)row.cover.style[key]=value;
    const hidden=!visible||row.revealed||row.status==='SAFE';if(row.cover.hidden!==hidden)row.cover.hidden=hidden;
  }
  #ensureCover(row){
    if(row.cover.ownerDocument!==this.#doc){row.status='FAILED';row.error='OVERLAY_DOCUMENT_CHANGED';return false;}
    if(row.cover.isConnected)return true;
    if(!this.#valid(row))return false;
    try{this.#doc.documentElement.append(row.cover);}catch{row.status='FAILED';row.error='OVERLAY_UNAVAILABLE';return false;}
    if(!this.#valid(row)){if(this.#remove(row))this.#items.delete(row.image);else this.#items.set(row.image,row);return false;}
    return this.#paint(row);
  }
  #paint(row){if(!this.#valid(row)||row.cover.ownerDocument!==this.#doc||!row.cover.isConnected)return false;
    const failed=row.status==='FAILED';row.cover.textContent=failed?'이미지 분석 실패 · 클릭 보기 / 다시 가림':row.status==='PENDING'?'이미지 분석 대기 · 클릭 보기':'가려진 이미지 · 클릭 보기';
    row.cover.style.background=row.status==='SENSITIVE'?'rgba(235,235,235,.12)':'#ddd';
    row.cover.style.backdropFilter=row.status==='SENSITIVE'?'blur(24px)':'none';this.#position(row);
    return this.#valid(row)&&row.cover.isConnected;
  }
  start(){if(this.#started)throw Error('BLUR_ALREADY_STARTED');this.#started=true;this.#url=this.#doc.location.href;this.#active=true;
    if(!this.#current()){this.invalidate();return this.inspect();}
    const win=this.#doc.defaultView;
    // Observe committed route identity, not a future model response's URL.
    // State-only updates at the same URL retain their existing authority.
    this.#navigation=win.navigation;
    if(this.#navigation)this.#listen(this.#navigation,'currententrychange',this.route);
    this.#listen(win,'yt-navigate-finish',this.route);
    this.#observerState='UNCONFIRMED';this.#observer=new win.MutationObserver(records=>this.#callback(()=>{if(records.some(record=>!record.target.closest?.('[data-focurve-ui="blur"]')))this.refresh();}));this.#observerState='CONSTRUCTED';this.#resizeState='UNCONFIRMED';this.#resize=new win.ResizeObserver(this.move);this.#resizeState='CONSTRUCTED';
    this.#observerState='UNCONFIRMED';this.#observer.observe(this.#doc.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src','srcset','sizes','style','class']});this.#observerState='ATTACHED';
    this.#listen(this.#doc,'load',this.refresh,true);this.#listen(this.#doc,'visibilitychange',this.refresh);this.#listen(win,'scroll',this.move,true);this.#listen(win,'resize',this.move);
    for(const event of ['pagehide','popstate','hashchange'])this.#listen(win,event,this.hide);
    return this.scan();
  }
  scan(){this.#scans++;try{return this.#scan();}finally{this.#scans--;}}
  #scan(){if(!this.#current()){this.invalidate();return this.inspect();}
    this.#observerState='UNCONFIRMED';this.#observer.disconnect();this.#observerState='STOPPED';this.#overflow=0;
    try{
      for(const [image,row]of this.#items)if(image.ownerDocument!==this.#doc||!image.isConnected||row.key!==this.#key(image)){
        if(this.#remove(row))this.#items.delete(image);else row.status='FAILED';
      }
      for(const image of this.#doc.querySelectorAll('img')){
        if(!this.#current())break;
        if(image.closest('[data-focurve-ui], [data-focurve-restriction]'))continue;
        if(!this.#items.has(image)&&this.#selectImage(image)!==true)continue;
        if(this.#items.has(image)){const row=this.#items.get(image);if(this.#ensureCover(row))this.#position(row);continue;}
        if(this.#items.size>=this.#max){this.#overflow++;continue;}
        const cover=this.#doc.createElement('button');
        if(!this.#current())break;
        cover.type='button';cover.dataset.focurveUi='blur';cover.setAttribute('aria-label','가려진 이미지 보기');
        cover.style.cssText='position:fixed;z-index:2147483646;border:0;margin:0;padding:0;overflow:hidden;color:#111;font:14px sans-serif;cursor:pointer;box-sizing:border-box';
        const row={image,cover,key:this.#key(image),status:'PENDING',revealed:false,controller:new AbortController()};
        row.click=event=>this.#callback(()=>{if(row.status==='SAFE'||!this.#valid(row))return;event.preventDefault();event.stopImmediatePropagation();row.revealed=!row.revealed;this.#paint(row);});
        this.#items.set(image,row);row.coverListener=true;cover.addEventListener('click',row.click);row.imageListener=true;image.addEventListener('click',row.click,true);
        if(!this.#valid(row)){this.invalidate();break;}
        this.#doc.documentElement.append(cover);
        if(!this.#valid(row)){if(this.#remove(row))this.#items.delete(image);else this.#items.set(image,row);this.invalidate();break;}
        this.#resizeState='UNCONFIRMED';this.#resize.observe(image);this.#resizeState='ATTACHED';this.#paint(row);
      }
    }finally{if(this.#active){this.#observerState='UNCONFIRMED';this.#observer.observe(this.#doc.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src','srcset','sizes','style','class']});this.#observerState='ATTACHED';}}
    if(!this.#current())this.invalidate();
    this.#drain();return this.inspect();
  }
  async #analyze(row){
    const controller=row.controller;
    this.#pendingModelTasks++;
    const task=(async()=>{
      await row.image.decode();if(controller.signal.aborted||!this.#valid(row))throw Error('STALE_IMAGE');
      if(typeof this.#classifyImage==='function')return this.#classifyImage(row.image,{signal:controller.signal,profile:this.#profile});
      const canvas=this.#doc.createElement('canvas'),scale=Math.min(1,512/Math.max(row.image.naturalWidth,row.image.naturalHeight));
      canvas.width=Math.max(1,Math.round(row.image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(row.image.naturalHeight*scale));
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(row.image,0,0,canvas.width,canvas.height);ctx.getImageData(0,0,1,1);
      if(!this.#valid(row)||typeof this.#classify!=='function')throw Error('MODEL_UNAVAILABLE');
      return this.#classify(canvas,{signal:controller.signal,profile:this.#profile,image:row.image});
    })();
    // Count the real decode/provider continuation, even after abort/timeout wins.
    task.then(()=>{this.#pendingModelTasks--;},()=>{this.#pendingModelTasks--;});
    let timer;try{return await Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>{reject(Error('CLASSIFICATION_TIMEOUT'));controller.abort();},this.#timeout);})]);}finally{clearTimeout(timer);}
  }
  async #drain(){if(this.#busy||!this.#current())return;this.#busy=true;const epoch=this.#epoch;
    try{for(const row of this.#items.values()){
      if(epoch!==this.#epoch||!this.#current())break;let allowed=false;try{allowed=this.#canAnalyze()===true;}catch{}if(!allowed)break;if(row.status!=='PENDING'||!this.#valid(row)||this.#selectImage(row.image)!==true)continue;
      row.status='ANALYZING';
      try{const result=await this.#analyze(row);if(!['SAFE','SENSITIVE'].includes(result?.verdict)||result.profile_sha256!==this.#profile.sha256)throw Error('INVALID_CLASSIFICATION');
        if(this.#valid(row)){if(!this.#ensureCover(row))throw Error('OVERLAY_UNAVAILABLE');row.status=result.verdict;delete row.error;}
      }catch(error){if(this.#valid(row)){row.status='FAILED';row.error=error?.name==='SecurityError'?'PIXEL_UNREADABLE':/^[A-Z_]{1,80}$/.test(error?.message??'')?error.message:'INFERENCE_FAILED';}}
      if(this.#valid(row))this.#paint(row);
    }}finally{this.#busy=false;let allowed=false;try{allowed=this.#canAnalyze()===true;}catch{}if(allowed&&this.#current()&&[...this.#items.values()].some(row=>row.status==='PENDING'&&this.#valid(row)&&this.#selectImage(row.image)===true))this.refresh();}
  }
  retry(){if(!this.#current())return this.inspect();for(const row of this.#items.values())if(row.status==='FAILED'&&this.#valid(row)){row.controller.abort();row.controller=new AbortController();row.status='PENDING';delete row.error;row.revealed=false;this.#paint(row);}this.#drain();return this.inspect();}
  invalidate(){
    this.#active=false;this.#epoch++;
    if(this.#refreshTimer!=null)try{clearTimeout(this.#refreshTimer);this.#refreshTimer=null;this.#queued=false;}catch{}
    if(this.#moveFrame!=null)try{this.#doc.defaultView.cancelAnimationFrame(this.#moveFrame);this.#moveFrame=null;}catch{}
    if(this.#observer){this.#observerState='UNCONFIRMED';try{this.#observer.disconnect();this.#observerState='STOPPED';}catch{}}
    if(this.#resize){this.#resizeState='UNCONFIRMED';try{this.#resize.disconnect();this.#resizeState='STOPPED';}catch{}}
    for(const row of this.#items.values())try{row.controller.abort();}catch{}
    for(const entry of this.#listeners)if(!entry.removed)try{entry.target.removeEventListener(entry.type,entry.callback,entry.capture);entry.removed=true;}catch{}
  }
  release(){this.invalidate();for(const [image,row]of this.#items)if(this.#remove(row))this.#items.delete(image);
    return {local_only:true,restored:this.#items.size===0,local_termination:this.#termination(),cleanup_pending:this.#items.size>0||!this.#termination().locally_quiescent};}
  inspectImage(image){const row=this.#items.get(image);return {status:row?.status??'NOT_TARGETED',failure_reason:row?.error??null,revealed:row?.revealed===true,stale:!!row&&row.key!==this.#key(image)};}
  inspect(){const counts={},failure_reasons={};for(const row of this.#items.values()){counts[row.status]=(counts[row.status]??0)+1;if(row.status==='FAILED')failure_reasons[row.error??'CLEANUP_FAILED']=(failure_reasons[row.error??'CLEANUP_FAILED']??0)+1;}
    return {local_only:true,native_verified:false,core_connected:false,active:this.#active,profile_id:this.#profile.id,
      counts,failure_reasons,overflow_count:this.#overflow,local_termination:this.#termination(),cleanup_pending:this.#items.size>0||(!this.#active&&!this.#termination().locally_quiescent),status:this.#overflow||counts.FAILED?'PARTIAL_LOCAL':'OBSERVED_LOCAL'};}
}
