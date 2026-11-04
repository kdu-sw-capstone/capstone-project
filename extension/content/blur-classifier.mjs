// Runs packaged models in a local Worker; no image upload or remote fallback.
export class LocalBlurClassifier {
  #worker;#pending=new Map();#next=0;#closed=false;#ready=false;#profile;#busy=false;#details=null;#loading=null;
  constructor({baseUrl,profile,WorkerClass=globalThis.Worker}){
    if(!profile||profile.level!=='HIGH'||typeof profile.id!=='string'||!profile.id||!/^[a-f0-9]{64}$/.test(profile.sha256))throw Error('INVALID_MODEL_PROFILE');
    this.#profile=Object.freeze({...profile});this.#worker=new WorkerClass(new URL('worker.js',baseUrl));
    this.#worker.onmessage=({data})=>{const entry=this.#pending.get(data.id);if(!entry)return;this.#pending.delete(data.id);clearTimeout(entry.timer);data.ok?entry.resolve(data.result):entry.reject(Error(data.error));};
    this.#worker.onerror=()=>this.close('MODEL_WORKER_FAILED');
    this.baseUrl=String(baseUrl);
  }
  #call(type,body,timeoutMs,transfer=[]){if(this.#closed)return Promise.reject(Error('MODEL_CLOSED'));const id=++this.#next;
    return new Promise((resolve,reject)=>{const timer=setTimeout(()=>this.close('MODEL_TIMEOUT'),timeoutMs);this.#pending.set(id,{resolve,reject,timer});try{this.#worker.postMessage({id,type,...body},transfer);}catch{this.close('MODEL_TRANSPORT_FAILED');}});
  }
  async load(){if(this.#ready)return this.#details;if(this.#loading)return this.#loading;
    this.#loading=this.#call('INIT',{base:this.baseUrl,expectedHash:this.#profile.sha256},120000).then(result=>{if(this.#closed)throw Error('MODEL_CLOSED');this.#details=result;this.#ready=true;return result;});
    try{return await this.#loading;}finally{this.#loading=null;}}
  inspect(){return {ready:this.#ready&&!this.#closed,loading:!!this.#loading,closed:this.#closed};}
  async classify(canvas,{signal,profile}={}){
    if(!this.#ready||this.#closed||this.#busy||signal?.aborted||profile?.sha256!==this.#profile.sha256)throw Error('MODEL_SCOPE_UNAVAILABLE');
    // A stale image cancels its result, not another image's model lifetime.
    // The current kernel is allowed to settle under the bounded request timeout.
    this.#busy=true;let cancelled=false;const abort=()=>{cancelled=true;};signal?.addEventListener('abort',abort,{once:true});
    try{const {width,height}=canvas;if(width<1||height<1||width>512||height>512)throw Error('INVALID_IMAGE');const image=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,width,height);
      const result=await this.#call('CLASSIFY',{pixels:image.data.buffer,width,height},30000,[image.data.buffer]);
      if(cancelled||signal?.aborted||this.#closed)throw Error('MODEL_REQUEST_ABORTED');return result;
    }finally{signal?.removeEventListener('abort',abort);this.#busy=false;}
  }
  close(reason='MODEL_CLOSED'){if(this.#closed)return;this.#closed=true;this.#ready=false;this.#worker.terminate();for(const {reject,timer}of this.#pending.values()){clearTimeout(timer);reject(Error(reason));}this.#pending.clear();}
}
