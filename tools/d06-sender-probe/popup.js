const output=document.querySelector('#output');
async function target(){
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
 if(!tab?.url || new URL(tab.url).origin!=='https://www.youtube.com')throw Error('YOUTUBE_TEST_TAB_REQUIRED');
 const frames=await chrome.webNavigation.getAllFrames({tabId:tab.id});
 const frame=frames?.find(f=>f.frameId===0);
 if(!frame?.documentId)throw Error('DOCUMENT_ID_REQUIRED');
 return {tabId:tab.id,documentId:frame.documentId};
}
function log(name,data){output.textContent+=JSON.stringify({name,at:new Date().toISOString(),data},null,2)+'\n';}
async function run(name,work){try{log(name,await work(await target()));}catch(e){log(name,{error:e.message});}}
document.querySelector('#inject').onclick=()=>run('injection',async ref=>{
 await chrome.scripting.executeScript({target:{tabId:ref.tabId,documentIds:[ref.documentId]},world:'ISOLATED',files:['observe.js','receiver.js']});return ref;
});
document.querySelector('#worker').onclick=()=>run('worker-to-content',ref=>chrome.runtime.sendMessage({probe:'D06_SENDER_PROBE',action:'worker-route',...ref}));
document.querySelector('#popup').onclick=()=>run('popup-to-content-spoof',ref=>chrome.tabs.sendMessage(ref.tabId,{probe:'D06_SENDER_PROBE',claimedSource:'worker'},{documentId:ref.documentId}));
document.querySelector('#content').onclick=()=>run('content-to-worker-spoof',async ref=>{
 const results=await chrome.scripting.executeScript({target:{tabId:ref.tabId,documentIds:[ref.documentId]},world:'ISOLATED',func:()=>chrome.runtime.sendMessage({probe:'D06_SENDER_PROBE',claimedSource:'worker'})});
 return results.map(r=>({documentId:r.documentId,frameId:r.frameId,result:r.result}));
});
