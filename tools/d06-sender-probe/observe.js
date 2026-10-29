// Local diagnostic only. No authorization verdict and no page/user URL logging.
globalThis.senderObservation = function(sender) {
  const keys = ['id','url','origin','tab','frameId','documentId','documentLifecycle'];
  const result = {};
  for (const key of keys) {
    const present = Object.hasOwn(sender,key), value = sender[key];
    result[key] = {present, type: value === null ? 'null' : typeof value};
  }
  result.sameExtension = sender.id === chrome.runtime.id;
  result.exactWorkerURL = sender.url === chrome.runtime.getURL('worker.js');
  result.exactPopupURL = sender.url === chrome.runtime.getURL('popup.html');
  result.extensionOrigin = sender.origin === new URL(chrome.runtime.getURL('/')).origin;
  if (sender.tab && Number.isInteger(sender.tab.id)) result.tabId = sender.tab.id;
  if (Number.isInteger(sender.frameId)) result.frameId = sender.frameId;
  if (typeof sender.documentId === 'string') result.documentId = sender.documentId;
  if (typeof sender.documentLifecycle === 'string') result.documentLifecycle = sender.documentLifecycle;
  return result;
};
