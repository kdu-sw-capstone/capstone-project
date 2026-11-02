// Isolated-world TEST caller; no product permission or Server evidence.
let session,opening=false,results=[],imageResults=new WeakMap(),targetIndex=0,selecting=false,diagnosisEpoch=0,inspector,selected=null,lastScroll=-Infinity,scrollTimer;
addEventListener('scroll',()=>{lastScroll=performance.now();clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>{if(session?.inspect().active)session.scan();},220);},{capture:true,passive:true});
const ready=Promise.all([import(chrome.runtime.getURL('content/blur-session.mjs')),import(chrome.runtime.getURL('model/profile.mjs')),import(chrome.runtime.getURL('diagnostics.mjs'))]);
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.target!=='BLUR_CONTENT'||sender.id!==chrome.runtime.id||sender.url!==chrome.runtime.getURL('popup.html'))return;
  (async()=>{
    const [{BlurSession},{profile},{imageKey}]=await ready;
    if(message.type==='SELECT_IMAGE'){diagnosisEpoch++;selecting=true;return {testOnly:true,selecting:true};}
    if(message.type==='SELECTED_STATE')return {testOnly:true,selected_image:selected};
    if(message.type==='RELEASE'){diagnosisEpoch++;selecting=false;selected=null;const uiClean=!inspector||inspector.release();if(uiClean)inspector=null;const result=session?.release();if(!result||result.restored)session=null;return {released:result??{restored:true},testOnly:true,diagnosis_cleanup_pending:!uiClean};}
    if(message.type==='APPLY'){
      if(opening)throw Error('BUSY');opening=true;
      try{if(session&&!session.inspect().active)throw Error('OLD_SCOPE_CLEANUP_REQUIRED');
        if(!session){results=[];imageResults=new WeakMap();targetIndex=0;session=new BlurSession(document,{profile,maxTargets:128,timeoutMs:60000,canApply:()=>true,canAnalyze:()=>document.visibilityState==='visible'&&performance.now()-lastScroll>=200,
          selectImage:image=>{const r=image.getBoundingClientRect();return r.width>=80&&r.height>=80&&r.bottom>0&&r.top<innerHeight;},
          classifyImage:async(image,{signal})=>{const key=imageKey(image);let input;
            try{const scale=Math.min(1,512/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,canvas.width,canvas.height);ctx.getImageData(0,0,1,1);const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('PIXEL_ENCODING_FAILED')),'image/png'));const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('PIXEL_ENCODING_FAILED'));reader.readAsDataURL(blob);});input={encoded};}
            catch{input={src:image.currentSrc||image.src};}
            if(signal.aborted)throw Error('STALE_IMAGE');const response=await chrome.runtime.sendMessage({target:'BLUR_BACKGROUND',type:'CLASSIFY',...input});
            if(signal.aborted||key!==imageKey(image))throw Error('STALE_IMAGE');if(response?.error)throw Error(response.error);if(!response?.result)throw Error('MODEL_RESPONSE_MISSING');
            const previous=imageResults.get(image),index=previous?.key===key?previous.index:++targetIndex;imageResults.set(image,{index,key,result:response.result});const {verdict,stages,cache_hit}=response.result;results.push({index,verdict,stages,cache_hit:cache_hit===true});if(results.length>128)results.shift();return response.result;}});session.start();}
      }finally{opening=false;}
    }
    if(message.type==='RETRY')session?.retry();
    if(session?.inspect().active)session.scan();
    return {testOnly:true,realModel:true,productActivated:false,coreConnected:false,test_build:'blur-site-image-diagnosis-4',session:session?.inspect()??null,results};
  })().then(reply,error=>reply({testOnly:true,error:error.message}));return true;
});

// One-shot explicit selection: the selected thumbnail is identified at the click,
// not by asking the user to search a long page-wide report.
document.addEventListener('click',event=>{
  if(!selecting||event.target.closest?.('[data-focurve-ui="blur-diagnosis"]'))return;
  const image=document.elementsFromPoint(event.clientX,event.clientY).find(node=>node.tagName==='IMG');
  if(!image)return;
  selecting=false;const epoch=diagnosisEpoch;event.preventDefault();event.stopImmediatePropagation();
  ready.then(([, {profile},{describeImage,showImageDiagnosis}])=>{
    if(epoch!==diagnosisEpoch||image.ownerDocument!==document||!image.isConnected)return;
    if(inspector&&!inspector.release())return;
    selected=describeImage(image,imageResults.get(image),profile,session?.inspectImage(image));inspector=showImageDiagnosis(document,selected);
  });
},true);
addEventListener('pagehide',()=>{diagnosisEpoch++;selecting=false;selected=null;inspector?.release();});
