// Isolated Node DOM/resource double: no Chrome, model, network or provider.
class Events extends EventTarget {
 listeners=new Map();
 addEventListener(type,fn,options){super.addEventListener(type,fn,options);if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
 removeEventListener(type,fn,options){if(this.failRemove)throw Error('REMOVE_FAILED');super.removeEventListener(type,fn,options);this.listeners.get(type)?.delete(fn);}
}
class Element extends Events {
 constructor(doc,tag){super();this.ownerDocument=doc;this.tagName=tag.toUpperCase();this.dataset={};this.parentNode=null;this.isConnected=false;this.inert=false;this.style={};this.attrs={};}
 closest(){return null;}contains(e){return e===this;}querySelector(){return null;}
 setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k]??null;}
 remove(){if(this.failRemoveNode)throw Error('RESTORE_FAILED');this.parentNode=null;this.isConnected=false;}
 getBoundingClientRect(){return {left:0,top:0,right:100,bottom:100,width:100,height:100};}
 decode(){return Promise.resolve();}
}
export function fixture(){
 const win=new Events(),doc=new Events(),observers=[];
 doc.location=new URL('https://example.test/restricted');doc.defaultView=win;win.document=doc;win.top=win;win.navigation=new Events();win.innerHeight=800;win.innerWidth=1000;
 win.MutationObserver=class{observing=false;constructor(callback){this.callback=callback;observers.push(this);}observe(){this.observing=true;}disconnect(){if(this.failDisconnect)throw Error('DISCONNECT_FAILED');this.observing=false;}};
 win.ResizeObserver=class{observe(){}unobserve(){if(this.failUnobserve)throw Error('UNOBSERVE_FAILED');}disconnect(){if(this.failDisconnect)throw Error('RESIZE_FAILED');}};
 win.setInterval=setInterval;win.clearInterval=clearInterval;win.requestAnimationFrame=fn=>setTimeout(fn,1);win.cancelAnimationFrame=clearTimeout;
 win.getComputedStyle=e=>({display:e.style.getPropertyValue?.('display')??'block',visibility:'visible'});
 doc.documentElement=new Element(doc,'html');doc.documentElement.append=e=>{e.parentNode=doc.documentElement;e.isConnected=true;};
 doc.body=new Element(doc,'body');doc.body.isConnected=true;
 const props=new Map([['display',['grid','important']]]);doc.body.style={getPropertyValue:k=>props.get(k)?.[0]??'',getPropertyPriority:k=>props.get(k)?.[1]??'',setProperty:(k,v,p='')=>{props.set(k,[v,p]);},removeProperty:k=>props.delete(k)};
 doc.created=[];doc.createElement=tag=>{const e=new Element(doc,tag);doc.created.push(e);return e;};doc.images=[];doc.media=[];doc.querySelectorAll=s=>s==='img'?doc.images:s==='video,audio'?doc.media:[];
 const image=new Element(doc,'img');image.isConnected=true;image.src='fixture';image.currentSrc='fixture';image.srcset='';image.sizes='';image.naturalWidth=100;image.naturalHeight=100;doc.images.push(image);
 return {doc,win,observers,image,Element};
}
export const tick=()=>new Promise(resolve=>setImmediate(resolve));
