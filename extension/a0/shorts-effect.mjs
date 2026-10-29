import { ShortsControl } from '../content/shorts.mjs';
import { featureEntry } from '../content/entry.mjs';
import { confirmedEffect } from './contract.mjs';
export class A0ShortsEffect {
 constructor(document,{deadline=3000,preserveOnFailure=false}={}){this.document=document;this.window=document.defaultView;this.control=new ShortsControl(document);this.deadline=deadline;this.preserveOnFailure=preserveOnFailure;this.epoch=0;this.nodeIds=new WeakMap();this.nextId=0;this.plans=new Map();}
 id(element){if(!this.nodeIds.has(element))this.nodeIds.set(element,++this.nextId);return this.nodeIds.get(element);}
 plan(){
  // Plan only nodes that ShortsControl.apply can mutate on this route.
  // Keep all previous plans: route changes never erase restoration baselines.
  const elements=new Set(this.document.querySelectorAll('ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts]'));
  if(featureEntry(this.document.location.href)==='YOUTUBE_SHORTS')for(const viewer of this.document.querySelectorAll('ytd-shorts'))elements.add(viewer);
  for(const a of this.document.querySelectorAll('a[href]'))if(featureEntry(a.href)==='YOUTUBE_SHORTS')elements.add(a);
  for(const el of elements){const id=this.id(el);if(!this.plans.has(id))this.plans.set(id,{node_id:id,display:el.style.getPropertyValue('display'),priority:el.style.getPropertyPriority('display'),inert:el.inert});}
  return [...this.plans.values()];
 }
 evidence(){
  const e={route_kind:featureEntry(this.document.location.href)==='YOUTUBE_SHORTS'?'SHORTS':'OTHER',viewer_count:0,hidden_viewer_count:0,inert_viewer_count:0,media_count:0,paused_media_count:0,error_count:this.errors??0,observer_ready:!!this.observer&&this.running===true,scan_completed_without_error:!this.scanning&&!this.queuedScans};
  try{for(const v of this.document.querySelectorAll('ytd-shorts')){e.viewer_count++;if(this.window.getComputedStyle(v).display==='none')e.hidden_viewer_count++;if(v.inert===true)e.inert_viewer_count++;for(const m of v.querySelectorAll('video, audio')){e.media_count++;if(m.paused===true)e.paused_media_count++;}}}catch{e.error_count++;e.scan_completed_without_error=false;}
  return e;
 }
 async start(saveLedger){
  const epoch=++this.epoch;this.running=true;this.errors=0;this.queuedScans=0;this.startedURL=this.document.location.href;let initializing=true,startupTimedOut=false;const end=Date.now()+this.deadline;
  this.observer=new this.window.MutationObserver(()=>{if(this.running&&!this.scanning)this.refresh();});
  this.scan=async()=>{
   if(!this.running||epoch!==this.epoch)return;
   this.scanning=true;this.observer.disconnect();
   let deferred=false;
   try{if(initializing&&Date.now()>=end){startupTimedOut=true;this.stopEpoch();return;}const plan=this.plan();await saveLedger(plan);if(!this.running||epoch!==this.epoch)return;if(initializing&&Date.now()>=end){startupTimedOut=true;this.stopEpoch();return;}const durable=new Set(plan.map(x=>x.node_id)),result=this.control.apply({allowElement:element=>durable.has(this.nodeIds.get(element))});deferred=result.deferred>0;const evidence=this.evidence();if(!deferred&&result.status==='FAILED'&&evidence.route_kind==='SHORTS'&&evidence.viewer_count>0&&evidence.media_count>0){this.errors++;try{console.error('FOCURVE_SHORTS_APPLY_REJECTED',JSON.stringify(this.control.lastApplyFailure));}catch{}}}
   catch(error){console.error('FOCURVE_EFFECT_SCAN_FAILED',/^[A-Z_]{1,64}$/.test(error?.message??'')?error.message:'UNCONFIRMED');this.errors++;this.stopEpoch();if(!this.preserveOnFailure)this.control.release();}
   finally{this.scanning=false;if(this.running&&epoch===this.epoch){this.observer.observe(this.document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['style','inert','href','is-shorts']});if(deferred)this.refresh();}}
  };
  this.refresh=()=>{this.queuedScans++;this.pending=this.pending.then(()=>{this.queuedScans--;return this.scan();}).catch(()=>{this.errors++;});};this.pending=Promise.resolve();
  this.observer.observe(this.document.documentElement,{childList:true,subtree:true});this.refresh();
  for(let pending;;){pending=this.pending;await pending;if(pending===this.pending||!this.running)break;}
  initializing=false;if(startupTimedOut)return {result_state:'TIMED_OUT',evidence:this.evidence()};
  while(this.running&&epoch===this.epoch){const evidence=this.evidence();if(evidence.error_count)return {result_state:'APPLY_FAILED',evidence};if(evidence.route_kind==='OTHER')return {result_state:'NOT_APPLICABLE',evidence};if(confirmedEffect(evidence))return {result_state:'APPLIED',evidence};if(Date.now()>=end)return {result_state:'TIMED_OUT',evidence};await new Promise(resolve=>{this.waitResolve=resolve;this.timer=this.window.setTimeout(resolve,30);});}
  return {result_state:'APPLY_FAILED',evidence:this.evidence()};
 }
 stopEpoch(){this.epoch++;this.running=false;this.observer?.disconnect();this.window.clearTimeout(this.timer);this.waitResolve?.();this.waitResolve=null;}
 async release(){
  this.stopEpoch();await this.pending;let restored=false,error_count=0;
  try{restored=this.control.release();}catch{error_count++;}
  const remaining=this.control.changes.size;
  if(!restored)error_count++;
  return {observer_stopped:!this.running,timers_cleared:!this.running,listeners_removed:this.control.active===false,notice_removed:!this.control.notice?.isConnected,owned_changes_restored:restored&&remaining===0,remaining_owned_changes:remaining,error_count};
 }
}
