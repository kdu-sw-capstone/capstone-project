/* New installation admission fence. Does not END, SYNC, recover or clean state. */
(() => {
 'use strict';
 const scope=()=>globalThis.FOCURVE_DEPLOYMENT?.launchId;
 const lock='focurve-user-installation-admission',key='focurve_installation_quiesced',readyKey='focurve_installation_ready_launch',preparedKey='focurve_installation_prepared_launch';
 let contextBound=false;
 const refreshReadyMetadata=async()=>{
  const pinned=globalThis.FOCURVE_DEPLOYMENT,abort=new AbortController(),timer=setTimeout(()=>abort.abort(),3000);
  try{
   const response=await fetch(chrome.runtime.getURL('launch-context.json')+'?start='+Date.now(),{cache:'no-store',credentials:'omit',redirect:'error',signal:abort.signal});
   if(!response.ok)throw Error('INSTALLATION_NOT_READY');
   const current=await response.json(),deadline=Date.parse(current?.launchDeadlineUTC);
   if(current?.contract!=='STANDALONE_LAUNCH_1'||current.extensionId!==chrome.runtime.id||current.api!==pinned?.api||current.origin!==pinned?.origin||!/^[a-f0-9]{32}$/.test(current.launchId??'')||!Number.isFinite(deadline)||deadline<=Date.now()||deadline>Date.now()+8*3600000)throw Error('INSTALLATION_NOT_READY');
   if((await chrome.storage.local.get(readyKey))[readyKey]!==current.launchId)throw Error('INSTALLATION_NOT_READY');
   if((await chrome.storage.local.get(key))[key]===current.launchId)throw Error('INSTALLATION_STOPPING');
   if(scope()===current.launchId&&pinned.launchDeadlineUTC!==current.launchDeadlineUTC)throw Error('INSTALLATION_NOT_READY');
   globalThis.FOCURVE_DEPLOYMENT=Object.freeze({...pinned,launchId:current.launchId,launchDeadlineUTC:current.launchDeadlineUTC});contextBound=true;
  }catch(error){if(error?.message==='INSTALLATION_STOPPING')throw error;throw Error('INSTALLATION_NOT_READY');}
  finally{clearTimeout(timer);}
 };
 globalThis.FocurveUserAdmission=Object.freeze({
  version:'LAUNCH_CONTEXT_2',
  // Drain ordinary member polling before QUIESCE. This neither opens services
  // nor grants focus authority, refreshes credentials or repairs local state.
  withServices:operation=>navigator.locks.request(lock,async()=>{
   if(!contextBound)await refreshReadyMetadata();
   if(!scope()||(await chrome.storage.local.get(readyKey))[readyKey]!==scope())throw Error('INSTALLATION_NOT_READY');
   if((await chrome.storage.local.get(key))[key]===scope())throw Error('INSTALLATION_STOPPING');
   const deadline=Date.parse(globalThis.FOCURVE_DEPLOYMENT.launchDeadlineUTC);
   if(!Number.isFinite(deadline)||deadline<=Date.now())throw Error('INSTALLATION_NOT_READY');
   return operation();
  }),
  start:(operation,minutes)=>navigator.locks.request(lock,async()=>{
   if(!contextBound)await refreshReadyMetadata();
   if(!scope())throw Error('INSTALLATION_CONFIGURATION_REQUIRED');
   if((await chrome.storage.local.get(readyKey))[readyKey]!==scope())throw Error('INSTALLATION_NOT_READY');
   if((await chrome.storage.local.get(key))[key]===scope())throw Error('INSTALLATION_STOPPING');
   const deadline=Date.parse(globalThis.FOCURVE_DEPLOYMENT.launchDeadlineUTC);
   if(!Number.isFinite(deadline)||!Number.isInteger(minutes)||minutes<1||minutes>180||Date.now()+minutes*60000>deadline-600000)throw Error('INSTALLATION_START_WINDOW_CLOSED');
   return operation();
  }),
  open:expected=>navigator.locks.request(lock,async()=>{
   if(!expected||!/^[a-f0-9]{32}$/.test(expected.launchId))throw Error('INSTALLATION_CONTEXT_UNCONFIRMED');
   const pinned=globalThis.FOCURVE_DEPLOYMENT,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3000);let current;
   try{const response=await fetch(chrome.runtime.getURL('launch-context.json')+'?launch='+expected.launchId,{cache:'no-store',credentials:'omit',redirect:'error',signal:controller.signal});if(!response.ok)throw Error('INSTALLATION_CONTEXT_UNCONFIRMED');current=await response.json();}finally{clearTimeout(timer);}
   const deadline=Date.parse(current?.launchDeadlineUTC);
   if(current?.contract!=='STANDALONE_LAUNCH_1'||current.extensionId!==chrome.runtime.id||current.api!==pinned?.api||current.origin!==pinned?.origin||current.launchId!==expected.launchId||current.launchDeadlineUTC!==expected.launchDeadlineUTC||!Number.isFinite(deadline)||deadline<=Date.now()||deadline>Date.now()+8*3600000)throw Error('INSTALLATION_CONTEXT_UNCONFIRMED');
   if((await chrome.storage.local.get(key))[key]===current.launchId)throw Error('INSTALLATION_STOPPING');
   if(scope()===current.launchId&&pinned.launchDeadlineUTC!==current.launchDeadlineUTC)throw Error('INSTALLATION_SCOPE_REUSE');
   // Refresh public launch metadata through the owner bootstrap, not cached
   // importScripts. API/origin/extension identity must remain exactly pinned.
   globalThis.FOCURVE_DEPLOYMENT=Object.freeze({...pinned,launchId:current.launchId,launchDeadlineUTC:current.launchDeadlineUTC});contextBound=true;
   await chrome.storage.local.set({[readyKey]:scope()});return {ready:true,launchId:scope(),launchDeadlineUTC:current.launchDeadlineUTC,version:'LAUNCH_CONTEXT_2'};
  }),
  bindClosed:expected=>navigator.locks.request(lock,async()=>{
   if(!expected||!/^[a-f0-9]{32}$/.test(expected.launchId))throw Error('INSTALLATION_CONTEXT_UNCONFIRMED');
   const pinned=globalThis.FOCURVE_DEPLOYMENT,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3000);let current;
   try{const response=await fetch(chrome.runtime.getURL('launch-context.json')+'?launch='+expected.launchId,{cache:'no-store',credentials:'omit',redirect:'error',signal:controller.signal});if(!response.ok)throw Error('INSTALLATION_CONTEXT_UNCONFIRMED');current=await response.json();}finally{clearTimeout(timer);}
   const deadline=Date.parse(current?.launchDeadlineUTC);
   if(current?.contract!=='STANDALONE_LAUNCH_1'||current.extensionId!==chrome.runtime.id||current.api!==pinned?.api||current.origin!==pinned?.origin||current.launchId!==expected.launchId||current.launchDeadlineUTC!==expected.launchDeadlineUTC||!Number.isFinite(deadline)||deadline<=Date.now()||deadline>Date.now()+8*3600000)throw Error('INSTALLATION_CONTEXT_UNCONFIRMED');
   if(scope()===current.launchId&&pinned.launchDeadlineUTC!==current.launchDeadlineUTC)throw Error('INSTALLATION_SCOPE_REUSE');
   globalThis.FOCURVE_DEPLOYMENT=Object.freeze({...pinned,launchId:current.launchId,launchDeadlineUTC:current.launchDeadlineUTC});contextBound=true;
   await chrome.storage.local.set({[key]:scope(),[readyKey]:null});return {quiesced:true,launchId:scope()};
  }),
  prepareClosed:expected=>navigator.locks.request(lock,async()=>{
   if(!expected||!/^[a-f0-9]{32}$/.test(expected.launchId))throw Error('INSTALLATION_CONTEXT_UNCONFIRMED');
   const pinned=globalThis.FOCURVE_DEPLOYMENT,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3000);let current;
   try{const response=await fetch(chrome.runtime.getURL('launch-context.json')+'?launch='+expected.launchId,{cache:'no-store',credentials:'omit',redirect:'error',signal:controller.signal});if(!response.ok)throw Error('INSTALLATION_CONTEXT_UNCONFIRMED');current=await response.json();}finally{clearTimeout(timer);}
   const deadline=Date.parse(current?.launchDeadlineUTC);
   if(current?.contract!=='STANDALONE_LAUNCH_1'||current.extensionId!==chrome.runtime.id||current.api!==pinned?.api||current.origin!==pinned?.origin||current.launchId!==expected.launchId||current.launchDeadlineUTC!==expected.launchDeadlineUTC||!Number.isFinite(deadline)||deadline<=Date.now()||deadline>Date.now()+8*3600000)throw Error('INSTALLATION_CONTEXT_UNCONFIRMED');
   if(scope()===current.launchId&&pinned.launchDeadlineUTC!==current.launchDeadlineUTC)throw Error('INSTALLATION_SCOPE_REUSE');
   if((await chrome.storage.local.get(key))[key]===current.launchId)throw Error('INSTALLATION_STOPPING');
   globalThis.FOCURVE_DEPLOYMENT=Object.freeze({...pinned,launchId:current.launchId,launchDeadlineUTC:current.launchDeadlineUTC});contextBound=true;
   await chrome.storage.local.set({[preparedKey]:scope(),[readyKey]:null});return {quiesced:true,prepared:true,launchId:scope()};
  }),
  openPrepared:async expected=>{
   if(!expected||(await chrome.storage.local.get(preparedKey))[preparedKey]!==expected.launchId)throw Error('INSTALLATION_NOT_PREPARED');
   return globalThis.FocurveUserAdmission.open(expected);
  },
  quiesce:()=>navigator.locks.request(lock,async()=>{
   if(!scope())throw Error('INSTALLATION_CONFIGURATION_REQUIRED');
   await chrome.storage.local.set({[key]:scope(),[readyKey]:null});return {quiesced:true};
  })
 });
 const original=MemberAuthRuntime.guardGuestStart;
 MemberAuthRuntime.guardGuestStart=(operation,minutes)=>FocurveUserAdmission.start(()=>original(operation),minutes);
})();
