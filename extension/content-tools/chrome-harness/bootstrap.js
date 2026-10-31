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
const exploreReady=Promise.all([homeReady,import(chrome.runtime.getURL('content/explore.mjs'))])
  .then(([{ledger},{ExploreSession}])=>{
    let session=null,result=null,invalidated=null;
    return {handle(type){
      let released;
      if(type==='TEST_EXPLORE_APPLY'){
        if(invalidated)throw Error('OLD_SCOPE_CLEANUP_REQUIRED: 탐색 제한 해제 후 다시 적용하세요.');
        if(!session){
          session=new ExploreSession(document,{ledger,owner_binding_id:crypto.randomUUID(),binding_id:crypto.randomUUID(),
            // Synthetic test authorization only. Product Core must provide
            // validated document/navigation scope before granting a transition.
            authorizeNavigation:()=>true,
            onObservation:value=>{result=value;},onInvalidated:value=>{invalidated=value;}});
          try{session.start();}catch(error){session=null;throw error;}
        }else session.scan();
      }
      if(type==='TEST_EXPLORE_RELEASE'&&session){released=session.release();if(released.restored){session=null;result=null;invalidated=null;}}
      return {testOnly:true,coreConnected:false,result,invalidated,released};
    }};
  });
const mastheadReady=Promise.all([homeReady,import(chrome.runtime.getURL('content/masthead.mjs'))])
  .then(([{ledger},{MastheadSession}])=>{
    let session=null,result=null,invalidated=null;
    return {handle(type){
      let released;
      if(type==='TEST_MASTHEAD_APPLY'){
        if(invalidated)throw Error('OLD_SCOPE_CLEANUP_REQUIRED: 상단바 제한 해제 후 다시 적용하세요.');
        if(!session){
          session=new MastheadSession(document,{ledger,owner_binding_id:crypto.randomUUID(),binding_id:crypto.randomUUID(),
            // TEST ONLY: actual Core must verify native scope on navigation.
            authorizeNavigation:()=>true,
            onObservation:value=>{result=value;},onInvalidated:value=>{invalidated=value;}});
          try{session.start();}catch(error){session=null;throw error;}
        }else session.scan();
      }
      if(type==='TEST_MASTHEAD_RELEASE'&&session){released=session.release();if(released.restored){session=null;result=null;invalidated=null;}}
      return {testOnly:true,coreConnected:false,result,invalidated,released};
    }};
  });
const watchReady = Promise.all([homeReady, import(chrome.runtime.getURL('content/watch-panels.mjs'))])
  .then(([{ledger}, {WatchPanelSession}]) => {
  let session, results = [], invalidated = null, partialReleased = false;
  const state = () => ({testOnly:true, coreConnected:false, results, invalidated, ledger:ledger.inspect()});
  return {
    handle(type) {
      let released;
      if (type === 'TEST_WATCH_PANELS_APPLY') {
        if (invalidated) throw Error('OLD_SCOPE_CLEANUP_REQUIRED: 전체 해제 후 다시 적용하세요.');
        if (partialReleased) throw Error('FULL_RELEASE_REQUIRED: 개별 해제한 뒤에는 전체 해제 후 다시 적용하세요.');
        if (!session) {
          session = new WatchPanelSession(document, {ledger,
            owner_binding_id:crypto.randomUUID(), binding_id:crypto.randomUUID(),
            features:[{feature_id:'YT-03',enabled:true,required:true},{feature_id:'YT-04',enabled:true,required:true}],
            onObservation:value => { results = value; },
            onInvalidated:value => { invalidated = value; },
          });
          try { session.start(); } catch (error) { session = null; throw error; }
        } else session.scan();
      }
      if (['TEST_WATCH_COMMENTS_RELEASE','TEST_WATCH_RECOMMENDATIONS_RELEASE'].includes(type) && session) {
        const feature = type === 'TEST_WATCH_COMMENTS_RELEASE' ? 'YT-03' : 'YT-04';
        released = session.releaseFeature(feature);
        if (released.restored) { partialReleased = true; results = results.filter(value => value.feature_id !== feature); }
      }
      if (type === 'TEST_WATCH_PANELS_RELEASE' && session) {
        released = session.release();
        if (released.every(value => value.restored)) { session = null; invalidated = null; partialReleased = false; results = []; }
      }
      return {...state(), released};
    },
  };
});

const autoplayReady = Promise.all([homeReady,import(chrome.runtime.getURL('content/autoplay.mjs'))])
  .then(([{ledger},{AutoplaySession}]) => {
    let session=null,result=null,invalidated=null;
    return {handle(type){
      let released;
      if(type==='TEST_AUTOPLAY_APPLY'){
        if(invalidated)throw Error('OLD_SCOPE_CLEANUP_REQUIRED: 자동재생 제한 해제 후 다시 적용하세요.');
        if(!session){
          session=new AutoplaySession(document,{ledger,owner_binding_id:crypto.randomUUID(),binding_id:crypto.randomUUID(),
            onObservation:value=>{result=value;},onInvalidated:value=>{invalidated=value;}});
          try{session.start();}catch(error){session=null;throw error;}
        }else session.scan();
      }
      if(type==='TEST_AUTOPLAY_RELEASE'&&session){
        released=session.release();
        if(released.restored){session=null;result=null;invalidated=null;}
      }
      return {testOnly:true,coreConnected:false,result,invalidated,released};
    }};
  });

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup.html')) return;
  if(['TEST_AUTOPLAY_APPLY','TEST_AUTOPLAY_RELEASE','TEST_AUTOPLAY_STATE'].includes(message?.type)){
    autoplayReady.then(adapter=>reply(adapter.handle(message.type))).catch(error=>reply({testOnly:true,error:error.message}));
    return true;
  }
  if (['TEST_WATCH_PANELS_APPLY','TEST_WATCH_COMMENTS_RELEASE','TEST_WATCH_RECOMMENDATIONS_RELEASE','TEST_WATCH_PANELS_RELEASE','TEST_WATCH_PANELS_STATE'].includes(message?.type)) {
    watchReady.then(adapter => reply(adapter.handle(message.type))).catch(error => reply({testOnly:true,error:error.message}));
    return true;
  }
  if(['TEST_MASTHEAD_APPLY','TEST_MASTHEAD_RELEASE','TEST_MASTHEAD_STATE'].includes(message?.type)){
    mastheadReady.then(adapter=>reply(adapter.handle(message.type))).catch(error=>reply({testOnly:true,error:error.message}));return true;
  }
  if(['TEST_EXPLORE_APPLY','TEST_EXPLORE_RELEASE','TEST_EXPLORE_STATE'].includes(message?.type)){
    exploreReady.then(adapter=>reply(adapter.handle(message.type))).catch(error=>reply({testOnly:true,error:error.message}));return true;
  }
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
