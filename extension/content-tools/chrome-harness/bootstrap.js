// TEST ONLY. These messages are not the D-06 product contract.
const ready = import(chrome.runtime.getURL('content/controller.mjs')).then(({ContentController}) => {
  let result = [];
  const controller = new ContentController(document, value => { result = value; });
  return {controller, read: () => result};
});
const watchReady = Promise.all([
  import(chrome.runtime.getURL('content/claim-ledger.mjs')),
  import(chrome.runtime.getURL('content/watch-panels.mjs')),
]).then(([{ClaimLedger}, {WatchPanelSession}]) => {
  const ledger = new ClaimLedger(document);
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
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup.html')) return;
  if (['TEST_WATCH_PANELS_APPLY','TEST_WATCH_COMMENTS_RELEASE','TEST_WATCH_RECOMMENDATIONS_RELEASE','TEST_WATCH_PANELS_RELEASE','TEST_WATCH_PANELS_STATE'].includes(message?.type)) {
    watchReady.then(adapter => reply(adapter.handle(message.type))).catch(error => reply({testOnly:true,error:error.message}));
    return true;
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
