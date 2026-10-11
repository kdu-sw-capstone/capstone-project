// TEST ONLY. These messages are not the D-06 product contract.
const ready = import(chrome.runtime.getURL('content/controller.mjs')).then(({ContentController}) => {
  let result = [];
  const controller = new ContentController(document, value => { result = value; });
  return {controller, read: () => result};
});
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup.html')) return;
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
