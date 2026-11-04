// Memory-only numeric results; keys bind the exact resized pixels and profile.
export class BlurResultCache {
  #entries=new Map();
  constructor({limit=64,ttl=300000,now=()=>Date.now()}={}){this.limit=limit;this.ttl=ttl;this.now=now;}
  get(key){const item=this.#entries.get(key);if(!item)return null;
    this.#entries.delete(key);if(this.now()-item.at>=this.ttl)return null;
    this.#entries.set(key,item);return structuredClone(item.result);
  }
  set(key,result){if(!['SAFE','SENSITIVE'].includes(result?.verdict))return;
    this.#entries.delete(key);this.#entries.set(key,{at:this.now(),result:structuredClone(result)});
    while(this.#entries.size>this.limit)this.#entries.delete(this.#entries.keys().next().value);
  }
}
export async function pixelCacheKey(canvas,profileHash){
  const bytes=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height).data;
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
  return `${profileHash}:${canvas.width}x${canvas.height}:${hash}`;
}
