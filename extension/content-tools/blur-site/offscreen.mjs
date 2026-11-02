import {BlurResultCache,pixelCacheKey} from './result-cache.mjs';
import {LocalBlurClassifier} from './content/blur-classifier.mjs';
import {profile} from './model/profile.mjs';
import {allowedImage} from './image-source.mjs';
let model=new LocalBlurClassifier({baseUrl:new URL('./model/',import.meta.url),profile});
let queue=Promise.resolve(),lastInference=0;const cache=new BlurResultCache();
async function classifyCanvas(canvas){
  const key=await pixelCacheKey(canvas,profile.sha256),cached=cache.get(key);if(cached)return {...cached,cache_hit:true};
  await new Promise(resolve=>setTimeout(resolve,Math.max(0,150-(performance.now()-lastInference))));
  const result=await model.classify(canvas,{profile});lastInference=performance.now();cache.set(key,result);return {...result,cache_hit:false};
}
async function classify(message){
  if(message.encoded!==undefined){
    if(typeof message.encoded!=='string'||message.encoded.length>6000000||!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(message.encoded))throw Error('INVALID_IMAGE');
    const bitmap=await createImageBitmap(await (await fetch(message.encoded)).blob());
    try{if(bitmap.width<1||bitmap.height<1||bitmap.width>512||bitmap.height>512)throw Error('INVALID_IMAGE');
      const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d').drawImage(bitmap,0,0);return await classifyCanvas(canvas);
    }finally{bitmap.close();}
  }
  if(message.pixels!==undefined){
    const {pixels,width,height}=message;
    if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>512||height>512||!Array.isArray(pixels)||pixels.length!==width*height*4||pixels.some(v=>!Number.isInteger(v)||v<0||v>255))throw Error('INVALID_IMAGE');
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels),width,height),0,0);return await classifyCanvas(canvas);
  }
  const src=message.src;
  const url=allowedImage(src);
  // Original image is downloaded from its existing CDN; never uploaded elsewhere.
  const response=await fetch(url,{credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(15000)});
  if(!response.ok||!response.headers.get('content-type')?.startsWith('image/'))throw Error('IMAGE_FETCH_FAILED');
  const reader=response.body.getReader(),chunks=[];let total=0;
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>20000000){await reader.cancel();throw Error('IMAGE_TOO_LARGE');}chunks.push(value);}
  const bitmap=await createImageBitmap(new Blob(chunks));
  try{if(bitmap.width*bitmap.height>40000000)throw Error('IMAGE_TOO_LARGE');
    const scale=Math.min(1,512/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    return await classifyCanvas(canvas);
  }finally{bitmap.close();}
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.target!=='BLUR_OFFSCREEN'||sender.id!==chrome.runtime.id||sender.url!==chrome.runtime.getURL('background.mjs'))return;
  if(message.type==='MODEL_STATE'){reply({result:{...model.inspect(),profile}});return;}
  const task=queue.then(async()=>{if(message.type==='PREPARE'&&model.inspect().closed)model=new LocalBlurClassifier({baseUrl:new URL('./model/',import.meta.url),profile});
    await model.load();if(message.type==='PREPARE')return {ready:true,profile};if(message.type==='CLASSIFY')return await classify(message);throw Error('UNKNOWN_REQUEST');});
  queue=task.catch(()=>{});task.then(result=>reply({result}),error=>reply({error:/^[A-Z_]{1,80}$/.test(error.message)?error.message:'IMAGE_ANALYSIS_FAILED'}));return true;
});
