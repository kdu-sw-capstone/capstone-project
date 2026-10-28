importScripts('observe.js');
chrome.runtime.onMessage.addListener((message,sender,reply) => {
  if (message?.probe !== 'D06_SENDER_PROBE') return;
  const observation = {channel:'worker-runtime',authorized:false,effects:0,sender:senderObservation(sender)};
  // Only the probe popup can request a worker-origin routing observation.
  // Content-origin messages are observed but never relayed to a receiver.
  if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup.html')
    || sender.tab || message.action !== 'worker-route') {reply(observation);return;}
  (async()=>{
    const tab=await chrome.tabs.get(message.tabId);
    if (new URL(tab.url).origin !== 'https://www.youtube.com') throw Error('YOUTUBE_TEST_TAB_REQUIRED');
    const frames=await chrome.webNavigation.getAllFrames({tabId:tab.id});
    const frame=frames?.find(f=>f.frameId===0);
    if (!frame?.documentId || frame.documentId !== message.documentId) throw Error('DOCUMENT_CHANGED');
    const response=await chrome.tabs.sendMessage(tab.id,{probe:'D06_SENDER_PROBE',claimedSource:'worker'},
      {documentId:frame.documentId});
    reply({observation,response});
  })().catch(error=>reply({observation,error:error.message}));
  return true;
});
