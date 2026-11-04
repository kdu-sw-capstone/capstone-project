let creating;
async function ensure(){
  if(await chrome.offscreen.hasDocument())return;
  if(!creating)creating=chrome.offscreen.createDocument({url:'offscreen.html',reasons:['WORKERS'],justification:'선택한 사이트 이미지의 로컬 분류 Worker 실행'}).finally(()=>{creating=null;});
  await creating;
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.target!=='BLUR_BACKGROUND')return;
  const content=sender.id===chrome.runtime.id&&sender.frameId===0&&/^https?:\/\//.test(sender.url??'')&&sender.tab;
  const popup=sender.id===chrome.runtime.id&&!sender.tab&&sender.url===chrome.runtime.getURL('popup.html');
  if(!(content&&['CLASSIFY'].includes(message.type)||popup&&['PREPARE','MODEL_STATE'].includes(message.type))){reply({error:'CALLER_REJECTED'});return;}
  (async()=>{if(message.type==='MODEL_STATE'&&!await chrome.offscreen.hasDocument())return {result:{ready:false,loading:false,closed:false}};
    await ensure();return await chrome.runtime.sendMessage({target:'BLUR_OFFSCREEN',type:message.type,src:message.src,encoded:message.encoded,pixels:message.pixels,width:message.width,height:message.height});})().then(reply,()=>reply({error:'MODEL_TRANSPORT_FAILED'}));
  return true;
});
