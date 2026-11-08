import {installDocumentCoordinator} from '../execution/document-coordinator.mjs';
import {A1Core} from './core.mjs';
export function installMemberWorker(env){const core=new A1Core(env,{shortsDocumentGate:true,documentRetirement:true,limitedProduct11:true,p1:true,d1b5:true,nd01:env.documentTransitionContract==='ND01_1',dp01:env.domTransitionContract==='DP01_1',nr01:env.nativeTransitionContract==='NR01_1'});
 const runtime=env.chrome.runtime;runtime.onMessage.addListener((m,s,reply)=>{
 if(m?.type==='D06_MEMBER_P1_ATTEST'){core.ready.then(()=>core.p1.receive(m,s)).then(reply,()=>reply({status:'REJECTED'}));return true;}
 if(m?.type==='D06_MEMBER_A1_STORAGE'){core.ready.then(()=>core.registry.handle(m,s)).then(reply,()=>reply(null));return true;}});
 if(env.experimentalDocumentCoordinator===true){
  core.documentCoordinator=installDocumentCoordinator(core,env.chrome,{excludedDocument:d=>globalThis.FocurveSafetyNavigation?.document(d),excludedTab:id=>globalThis.FocurveSafetyNavigation?.tab(id),onFailure:code=>console.error('FOCURVE_DOCUMENT_COORDINATOR_UNCONFIRMED',code)});
 }else{
 env.chrome.webNavigation.onBeforeNavigate.addListener(d=>{if(!globalThis.FocurveSafetyNavigation?.document(d))core.navigation(d).catch(()=>{});});
 env.chrome.webNavigation.onDOMContentLoaded.addListener(d=>{if(!globalThis.FocurveSafetyNavigation?.document(d))core.nativeDocumentReady(d);});
 env.chrome.webNavigation.onCommitted.addListener(d=>{if(!globalThis.FocurveSafetyNavigation?.document(d)&&d.frameId===0)core.requestCheck();});
 env.chrome.webNavigation.onHistoryStateUpdated.addListener(d=>{if(!globalThis.FocurveSafetyNavigation?.document(d))core.serial(()=>core.navigation(d,{sameUrlHistory:true})).catch(()=>{});});
 // Native COMPLETE is only a recheck signal, never document/authentication proof.
 env.chrome.tabs.onUpdated.addListener((tabId,change)=>{if(change.status==='complete'&&!globalThis.FocurveSafetyNavigation?.tab(tabId))core.requestCheck();});
 }
 env.chrome.alarms.onAlarm.addListener(a=>{if(a.name==='focurve-member-a1-check')core.requestCheck();});
 env.chrome.runtime.onStartup.addListener(()=>{core.startupObserved=true;core.profileStartup().catch(()=>{});});core.watchReady=true;
 return core;}
