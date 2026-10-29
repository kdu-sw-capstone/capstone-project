/* Read the existing display preference only; never change product/auth state. */
'use strict';
(()=>{
 let selected='light';const media=globalThis.matchMedia?.('(prefers-color-scheme: dark)');
 const apply=()=>{document.documentElement.dataset.theme=selected==='system'?(media?.matches?'dark':'light'):selected;};
 const accept=value=>{selected=['light','dark','system'].includes(value)?value:'light';apply();};
 apply();
 chrome.storage.local.get(['focurve_ui_theme']).then(x=>accept(x.focurve_ui_theme)).catch(()=>apply());
 const listener=(changes,area)=>{if(area==='local'&&changes.focurve_ui_theme)accept(changes.focurve_ui_theme.newValue);};
 chrome.storage.onChanged?.addListener(listener);media?.addEventListener?.('change',apply);
 addEventListener('pagehide',()=>{chrome.storage.onChanged?.removeListener(listener);media?.removeEventListener?.('change',apply);},{once:true});
})();
