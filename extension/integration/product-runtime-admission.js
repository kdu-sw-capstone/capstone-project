/* Product UI only. No external listener, arbitrary command or START/END. Explicit prepared admission only. */
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 if(message?.type!=='PRODUCT_RUNTIME_FENCE')return;
 const own=chrome.runtime.getURL('native-link/index.html');
 if(sender.id!==chrome.runtime.id||sender.url!==own||typeof sender.documentId!=='string'||(sender.frameId!==undefined&&sender.frameId!==0)){reply({ok:false,error:'PRODUCT_CALLER_UNCONFIRMED'});return false;}
 (async()=>{
  const contexts=await chrome.runtime.getContexts({documentIds:[sender.documentId]});
  if(contexts.length!==1||contexts[0].documentUrl!==own||contexts[0].contextType!=='TAB'||contexts[0].frameId!==0||contexts[0].incognito)throw Error('PRODUCT_DOCUMENT_UNCONFIRMED');
  if(message.operation==='BIND_CLOSED')return FocurveUserAdmission.bindClosed(message.scope);
  if(message.operation==='PREPARE_CLOSED')return FocurveUserAdmission.prepareClosed(message.scope);
  if(message.operation==='OPEN_PREPARED')return FocurveUserAdmission.openPrepared(message.scope);
  if(message.operation==='QUIESCE')return FocurveUserAdmission.quiesce();
  throw Error('PRODUCT_OPERATION_REJECTED');
 })().then(result=>reply({ok:true,result}),()=>reply({ok:false,error:'PRODUCT_FENCE_UNCONFIRMED'}));return true;
});
