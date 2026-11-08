import { A0Receiver } from './receiver.mjs';
import { A0ShortsEffect } from './shorts-effect.mjs';
import { A0RegistryClient } from './registry-client.mjs';
// No inbound bootstrap message. Only Core's documentId-targeted Chrome injection.
export function installA0Content(config,chrome,document){
 const bootstrap=config.authority;
 if(globalThis.__focurveA0Content)throw new Error('A0_INSTANCE_ALREADY_BOUND');
 if(globalThis!==globalThis.top||document.location.protocol!=='https:'||document.location.hostname!=='www.youtube.com')throw new Error('UNSUPPORTED_DOCUMENT');
 const instance=config.instance;const effect=new A0ShortsEffect(document);
 const receiver=new A0Receiver({authority:bootstrap,instance,runtime:chrome.runtime,store:new A0RegistryClient(chrome.runtime,config),effect});
 const listener=(m,s,reply)=>{if(m?.type!=='D06_CONTENT_CONTROL')return;receiver.handle(m,s).then(reply);return true;};
 chrome.runtime.onMessage.addListener(listener);
 const invalidate=()=>receiver.invalidate();document.defaultView.addEventListener('pagehide',invalidate);
 for(const event of ['popstate','hashchange','yt-navigate-finish'])document.defaultView.addEventListener(event,()=>{if(document.location.href!==bootstrap.url)invalidate();});
 document.defaultView.navigation?.addEventListener('currententrychange',()=>{if(document.location.href!==bootstrap.url)invalidate();});
 globalThis.__focurveA0Content=Object.freeze({instance,invalidate});return instance;
}
