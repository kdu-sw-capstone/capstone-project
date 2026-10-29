// A separate, top-level product document can invoke only explicitly provisioned termination.
importScripts('../safety/context.js','../integration/preserved-end.js');
let preservedEndActor;
function preservedEndController(){
 return preservedEndActor??=new FocurvePreservedEnd.PreservedEnd({
  readGrant:async()=>{const r=await fetch(chrome.runtime.getURL('preserved-end-context.json'),{cache:'no-store'});if(!r.ok)throw Error('PRESERVED_END_SCOPE_REQUIRED');return r.json();},
  getAdapter:()=>globalThis.__memberA1,
  getRawAuth:async()=>(await chrome.storage.local.get('focurve_member_auth')).focurve_member_auth,
  getInstallation:()=>LocalStore.guestContext(),
  identity:()=>({extensionId:chrome.runtime.id,origin:FOCURVE_SAFETY_CONTEXT?.origin,profileInstance:FOCURVE_SAFETY_CONTEXT?.profileInstance})
 });
}
chrome.runtime.onMessage.addListener((m,s,reply)=>{
 if(m?.type!=='PRODUCT_PRESERVED_END')return;
 const own=chrome.runtime.getURL('native-link/index.html');
 if(s.id!==chrome.runtime.id||s.url!==own||s.frameId!==0||typeof s.documentId!=='string'||!/^[-0-9a-f]{36}$/.test(m.request_id??'')||!['INSPECT','END_LOCAL','RECONCILE'].includes(m.action)){reply({ok:false,error:'UNAUTHORIZED_SENDER'});return false;}
 (async()=>{
  const rows=await chrome.runtime.getContexts({documentIds:[s.documentId]});
  if(rows.length!==1||rows[0].documentUrl!==own||rows[0].contextType!=='TAB'||rows[0].frameId!==0||rows[0].incognito)throw Error('PRODUCT_DOCUMENT_UNCONFIRMED');
  await globalThis.__memberA1Ready;
  const actor=preservedEndController();return m.action==='INSPECT'?actor.inspect():actor.run(m.action);
 })().then(result=>reply({ok:true,result}),e=>reply({ok:false,error:e.message}));return true;
});
