import {classifyBlurStages} from '../../content/blur-verdict.mjs';
import * as tf from '@tensorflow/tfjs';
let models=[],manifest,profileHash,ready=false,busy=false;
const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
async function checked(base,name){const meta=manifest.files[name];if(!meta||meta.bytes>100000000)throw Error('MODEL_FILE_INVALID');const r=await fetch(new URL(name,base));if(!r.ok)throw Error('MODEL_FILE_UNAVAILABLE');const bytes=await r.arrayBuffer();if(bytes.byteLength!==meta.bytes||await digest(bytes)!==meta.sha256)throw Error('MODEL_HASH_MISMATCH');return bytes;}
async function init({base,expectedHash}){
  const url=new URL(base);if(!['http:','https:','chrome-extension:'].includes(url.protocol))throw Error('MODEL_ORIGIN_INVALID');
  const response=await fetch(new URL('manifest.json',url));if(!response.ok)throw Error('MANIFEST_UNAVAILABLE');const bytes=await response.arrayBuffer();
  if(await digest(bytes)!==expectedHash)throw Error('PROFILE_HASH_MISMATCH');manifest=JSON.parse(new TextDecoder().decode(bytes));
  if(manifest.format!=='FOCURVE_BLUR_LOCAL_TEST_1'||manifest.packages.tensorflow!==tf.version.tfjs||manifest.level!=='HIGH'||manifest.threshold!==0.75||manifest.fusion!=='SUM_PORN_HENTAI_SEXY_BOTH_MODELS_PRECISION_CANDIDATE'||JSON.stringify(manifest.sequence)!==JSON.stringify(['inception_v3','mobilenet_v2']))throw Error('PROFILE_INVALID');
  profileHash=expectedHash;tf.enableProdMode();try{if(!await tf.setBackend('webgl'))throw Error();await tf.ready();}catch{await tf.setBackend('cpu');await tf.ready();}
  for(const name of manifest.sequence){const description=JSON.parse(new TextDecoder().decode(await checked(url,name+'.json'))),weightData=await checked(url,name+'.bin');
    const model=await tf.loadLayersModel(tf.io.fromMemory({modelTopology:description.modelTopology,weightSpecs:description.weightSpecs,weightData}));
    models.push({name,size:description.size,model});
    const warm=tf.tidy(()=>model.predict(tf.zeros([1,description.size,description.size,3])));try{await warm.data();}finally{warm.dispose();}
  }ready=true;return {backend:tf.getBackend(),model_count:models.length,num_tensors:tf.memory().numTensors};
}
async function predict({pixels,width,height}){
  if(!ready||busy)throw Error('MODEL_NOT_READY_OR_BUSY');if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>512||height>512||pixels.byteLength!==width*height*4)throw Error('INVALID_IMAGE');
  busy=true;const stages=[];try{for(const {name,size,model}of models){
    // Matches pinned NSFWJS 4.2.1 preprocessing and class index order.
    const started=performance.now(),result=tf.tidy(()=>{const input=tf.browser.fromPixels({data:new Uint8Array(pixels),width,height}).toFloat().div(255);
      return model.predict(tf.image.resizeBilinear(input,[size,size],true).reshape([1,size,size,3]));});
    try{const scores=Array.from(await result.data());if(scores.length!==5||scores.some(v=>!Number.isFinite(v)||v<0||v>1)||Math.abs(scores.reduce((a,b)=>a+b,0)-1)>0.02)throw Error('INVALID_MODEL_OUTPUT');
      stages.push({model:name,scores:Object.fromEntries(manifest.classes.map((label,i)=>[label,scores[i]])),elapsed_ms:performance.now()-started});
    }finally{result.dispose();}
  }return {verdict:classifyBlurStages(stages,manifest.threshold),profile_sha256:profileHash,stages,backend:tf.getBackend(),num_tensors:tf.memory().numTensors};
  }finally{busy=false;}
}
self.onmessage=async({data})=>{const {id,type}=data;try{const result=type==='INIT'?await init(data):type==='CLASSIFY'?await predict(data):(()=>{throw Error('UNKNOWN_MODEL_REQUEST');})();self.postMessage({id,ok:true,result});}
  catch(error){if(type==='INIT'){ready=false;for(const {model}of models)model.dispose();models=[];}self.postMessage({id,ok:false,error:error.message});}};
