// TEST ONLY. These messages are not the D-06 product contract.
const ready = import(chrome.runtime.getURL('content/controller.mjs')).then(({ContentController}) => {
  let result = [];
  const controller = new ContentController(document, value => { result = value; });
  return {controller, read: () => result};
});
const homeReady=Promise.all([import(chrome.runtime.getURL('content/claim-ledger.mjs')),import(chrome.runtime.getURL('content/home.mjs'))])
  .then(([{ClaimLedger},{HomeSession}])=>{
    const ledger=new ClaimLedger(document);let session=null,result=null,invalidated=null;
    return {ledger,handle(type){
      let released;
      if(type==='TEST_HOME_APPLY'){
        if(invalidated)throw Error('OLD_SCOPE_CLEANUP_REQUIRED: 홈 제한 해제 후 다시 적용하세요.');
        if(!session){
          session=new HomeSession(document,{ledger,owner_binding_id:crypto.randomUUID(),binding_id:crypto.randomUUID(),
            onObservation:value=>{result=value;},onInvalidated:value=>{invalidated=value;}});
          try{session.start();}catch(error){session=null;throw error;}
        }else session.scan();
      }
      if(type==='TEST_HOME_RELEASE'&&session){released=session.release();if(released.restored){session=null;result=null;invalidated=null;}}
      return {testOnly:true,coreConnected:false,result,invalidated,released};
    }};
  });
const subscriptionsReady=Promise.all([homeReady,import(chrome.runtime.getURL('content/subscriptions.mjs'))])
  .then(([{ledger},{SubscriptionsSession}])=>{
    let session=null,result=null,invalidated=null;
    return {handle(type){
      let released;
      if(type==='TEST_SUBSCRIPTIONS_APPLY'){
        if(invalidated)throw Error('OLD_SCOPE_CLEANUP_REQUIRED: 구독 제한 해제 후 다시 적용하세요.');
        if(!session){
          session=new SubscriptionsSession(document,{ledger,owner_binding_id:crypto.randomUUID(),binding_id:crypto.randomUUID(),
            onObservation:value=>{result=value;},onInvalidated:value=>{invalidated=value;}});
          try{session.start();}catch(error){session=null;throw error;}
        }else session.scan();
      }
      if(type==='TEST_SUBSCRIPTIONS_RELEASE'&&session){released=session.release();if(released.restored){session=null;result=null;invalidated=null;}}
      return {testOnly:true,coreConnected:false,result,invalidated,released};
    }};
  });
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup.html')) return;
  if(['TEST_SUBSCRIPTIONS_APPLY','TEST_SUBSCRIPTIONS_RELEASE','TEST_SUBSCRIPTIONS_STATE'].includes(message?.type)){
    subscriptionsReady.then(adapter=>reply(adapter.handle(message.type))).catch(error=>reply({testOnly:true,error:error.message}));return true;
  }
  if(['TEST_HOME_APPLY','TEST_HOME_RELEASE','TEST_HOME_STATE'].includes(message?.type)){
    homeReady.then(adapter=>reply(adapter.handle(message.type))).catch(error=>reply({testOnly:true,error:error.message}));return true;
  }
  if (!['TEST_SHORTS_APPLY','TEST_SHORTS_RELEASE','TEST_SHORTS_STATE'].includes(message?.type)) return;
  ready.then(({controller, read}) => {
    let released;
    if (message.type === 'TEST_SHORTS_APPLY') {
      if (controller.options) controller.scan();
      else controller.start({features:{shorts:true}});
    }
    if (message.type === 'TEST_SHORTS_RELEASE') released = controller.release();
    reply({testOnly:true, active:!!controller.options, released, result:read()});
  }).catch(error => reply({testOnly:true, error:error.message}));
  return true;
});
