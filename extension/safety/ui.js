'use strict';
const env={chrome,indexedDB,crypto,location,deployment:globalThis.FOCURVE_DEPLOYMENT,context:globalThis.FOCURVE_SAFETY_CONTEXT,core:R2LocalSafety};
const memberReader=R2LocalSafety.create(env),guestReader=FocurveGuestSafety.create(env);
const held=marker=>{
 const row=marker&&typeof marker==='object'&&!Array.isArray(marker)?marker:{};
 const allowed=new Set(['STATE','START','END','CONNECT','CLAIM','DISCONNECT','IMPORT_LIST','IMPORT_SELECTED','SETTINGS_LIST','SETTINGS_SELECTED','RECOVER_BEGIN','RECOVER_CONFIRM']);
 const action=allowed.has(row.action)?row.action:'UNRECOGNIZED';
 // Report only bounded request metadata. The marker remains untouched and
 // blocks observation exactly as before; this is not a CLEAR or recovery path.
 const operation={action,classification:action==='UNRECOGNIZED'?'UNKNOWN':['STATE','IMPORT_LIST','SETTINGS_LIST'].includes(action)?'QUERY_REQUEST':'MUTATION_REQUEST',unconfirmed:row.unconfirmed===true};
 if(typeof row.requestId==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(row.requestId))operation.requestId=row.requestId;
 if(typeof row.atUTC==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(row.atUTC)&&Number.isFinite(Date.parse(row.atUTC)))operation.atUTC=new Date(row.atUTC).toISOString();
 return {contract:'R4_UI_HOLD_1',gate:'UNKNOWN',issues:['USER_OPERATION_UNCONFIRMED'],counts:null,identity:{},unconfirmedOperation:operation,resources:{openConnections:0,activeReadTransactions:0,pendingNativeCalls:0}};
};
const reader={observe:async()=>{const before=await chrome.storage.local.get(['focurve_member_auth','focurve_user_ui_hold']);if(before.focurve_user_ui_hold){const marker=before.focurve_user_ui_hold;if(marker.action==='STATE'&&marker.unconfirmed===true&&typeof memberReader.auditPendingState==='function'){const result=await memberReader.auditPendingState(marker.requestId);return result.contract==='R4_STATE_LEDGER_AUDIT_1'&&result.gate==='UNKNOWN'?result:held(marker);}if(marker.action==='START'&&marker.unconfirmed===true&&typeof memberReader.auditPendingStart==='function'){const result=await memberReader.auditPendingStart(marker.requestId);return result.contract==='R4_START_LEDGER_AUDIT_1'&&result.gate==='UNKNOWN'?result:held(marker);}if(typeof memberReader.auditFirstFailure!=='function')return held(marker);const diagnostic=await memberReader.auditFirstFailure();return diagnostic.contract==='R4_FIRST_FAILURE_AUDIT_1'&&diagnostic.gate==='UNKNOWN'&&diagnostic.auditOnly===true&&diagnostic.identity?.installation===true?diagnostic:held(marker);}const r=await (before.focurve_member_auth?.phase==='LINKED'?memberReader:guestReader).observe();const after=(await chrome.storage.local.get('focurve_user_ui_hold')).focurve_user_ui_hold;if(after)return held(after);return r;},cancel:()=>{memberReader.cancel();guestReader.cancel();}};
document.querySelector('#inspect').addEventListener('click',async()=>{document.querySelector('#inspect').disabled=true;document.querySelector('#result').textContent=JSON.stringify(await reader.observe(),null,2);});
addEventListener('pagehide',()=>reader.cancel(),{once:true});
