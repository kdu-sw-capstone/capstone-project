import {installDocumentCoordinator} from '../execution/document-coordinator.mjs';
import {VERSION,valid,fail} from './contract.mjs';
import {A1Core} from './core.mjs';
import {error} from './domain.mjs';
import {GuestFeatureCapture} from './guest-feature.mjs';
export function installWorker(env){
 // Limited local product implementation approved by user on 2026-10-13; not deployment approval.
 const core=new A1Core(env,{limitedProduct11:true,p1:true,d1b5:true,nd01:env.documentTransitionContract==='ND01_1',dp01:env.domTransitionContract==='DP01_1',nr01:env.nativeTransitionContract==='NR01_1'});globalThis.FocurveA1=core;
 const feature=new GuestFeatureCapture(core,env);core.featureCapture=feature;
 const flushFeature=()=>feature.flush().catch(e=>console.error('GUEST_FEATURE_EVENT_UNCONFIRMED',e.message));
 const observeFeature=(stage,d)=>{if(globalThis.FocurveSafetyNavigation?.document(d))return;return feature.observe(stage,{...d,observed_at:Date.now()}).then(()=>{setTimeout(flushFeature,300);setTimeout(flushFeature,1500);}).catch(e=>console.error('GUEST_FEATURE_EVENT_UNCONFIRMED',e.message));};
 env.chrome.webNavigation.onCommitted.addListener(d=>observeFeature('commit',d));
 env.chrome.webNavigation.onHistoryStateUpdated?.addListener(d=>observeFeature('history',d));
 const trusted=s=>s?.id===env.chrome.runtime.id&&s.url===env.chrome.runtime.getURL('popup/popup.html')&&(!s.frameId||s.frameId===0);
 env.chrome.runtime.onMessage.addListener((m,s,reply)=>{
  if(m?.type==='D06_P1_ATTEST'){core.ready.then(()=>core.p1.receive(m,s)).then(reply,()=>reply({status:'REJECTED'}));return true;}
  if(m?.type==='D06_A1_STORAGE'){core.ready.then(()=>core.registry.handle(m,s)).then(reply,()=>reply(error(m.request_id,'STORE_UNCONFIRMED',true)));return true;}
  if(!['GET_STATE','START','END','SAVE_SITE'].includes(m?.type)||m.payload?.protocol_version!==VERSION)return;
  if(!trusted(s))return;
  (async()=>{await core.ready;if(!core.enabled)fail('UNSUPPORTED_POLICY');if(!valid(m,'ui_request'))fail('INVALID_SCHEMA');const owner=await env.owner();if(m.owner_context!==owner.owner_key)fail('OWNER_MISMATCH');let state,site=null;
   if(m.type==='START')state=await env.guardStart(()=>core.start(m.payload.duration_minutes,m.request_id));else if(m.type==='END')state=await core.end(m.payload.session_id);else if(m.type==='GET_STATE')state=await core.uiState();else{
    const p=m.payload;if(p.site_id===null){if(p.expected_version!==null)fail('INVALID_SCHEMA');site=await env.sites.create(p.site,m.request_id);}else site=await env.sites.update(p.site_id,p.expected_version,p.site,m.request_id);state=await env.db.load();
   }
   if(m.type==='START'){try{await feature.seed();}catch(e){console.error('GUEST_FEATURE_BASELINE_UNCONFIRMED',e.message);}}
   const a=state?.execution_contract===VERSION?await core.store.read('a1:aggregate:'+state.session.session_id):null;
   const response={request_id:m.request_id,status:'OK',data:{protocol_version:VERSION,family:'UI',kind:site?'SITE_SAVED':'SESSION_STATE',session_id:a?.session_id??null,execution_status:a?.session_status??null,execution_phase:a?.phase??null,remaining_ms:a?.time.remaining_ms??null,confirmed_run_ms:a?.time.confirmed_run_ms??null,feature_event_collection:'NOT_COLLECTED',site},error:null};if(!valid(response,'ui_ok'))fail('INVALID_CURRENT_RESPONSE');return response;
  })().then(reply,e=>reply(error(m.request_id,e.message)));return true;
 });
 if(env.experimentalDocumentCoordinator===true){
  core.documentCoordinator=installDocumentCoordinator(core,env.chrome,{excludedDocument:d=>globalThis.FocurveSafetyNavigation?.document(d),excludedTab:id=>globalThis.FocurveSafetyNavigation?.tab(id),onFailure:code=>console.error('FOCURVE_DOCUMENT_COORDINATOR_UNCONFIRMED',code)});
 }else{
 const nav=d=>{if(!globalThis.FocurveSafetyNavigation?.document(d))core.navigation(d).catch(()=>{});};
 env.chrome.webNavigation.onBeforeNavigate.addListener(nav);env.chrome.webNavigation.onCommitted.addListener(d=>{if(!globalThis.FocurveSafetyNavigation?.document(d)&&d.frameId===0)core.requestCheck();});
 env.chrome.webNavigation.onDOMContentLoaded.addListener(d=>{if(!globalThis.FocurveSafetyNavigation?.document(d))core.nativeDocumentReady(d);});
 env.chrome.tabs.onUpdated.addListener((tabId,change)=>{if(change.status==='complete'&&!globalThis.FocurveSafetyNavigation?.tab(tabId))core.requestCheck();});
 env.chrome.webNavigation.onHistoryStateUpdated?.addListener(d=>{if(!globalThis.FocurveSafetyNavigation?.document(d))core.serial(()=>core.navigation(d,{sameUrlHistory:true})).catch(()=>{});});
 if(!core.d1)env.chrome.tabs.onRemoved.addListener(t=>{if(!globalThis.FocurveSafetyNavigation?.tab(t))core.invalidate('TAB_REMOVED',t).catch(()=>{});});
 }
 env.chrome.alarms.onAlarm.addListener(a=>{if(a.name==='focurve-a1-check'){core.requestCheck();flushFeature();}});
 env.chrome.runtime.onStartup.addListener(()=>{core.startupObserved=true;core.profileStartup().catch(()=>{});});
 core.watchReady=true;core.ready.then(()=>{if(core.enabled)core.tick().catch(()=>{});});return core;
}
