import {NavigationSurfaceSession} from './navigation-surface.mjs';

const PROTECTED='[data-focurve-ui], [data-focurve-restriction], [aria-label="Messages"], [aria-label="메시지"], [aria-label="Direct"], input[type="password"], form[action*="/accounts/"]';
// User-confirmed scope includes profiles, their tabs, Explore and Stories.
// Account/authentication and DM routes remain outside the effect.
const routeAllowed=url=>!/^\/(?:direct|accounts|challenge|oauth|login|auth|two_factor)(?:\/|$)/i.test(url.pathname);
function collect(document){
  const targets=new Set();
  const visit=node=>{
    if(node.closest(PROTECTED))return;
    if(node.querySelector(PROTECTED)){for(const child of node.children)visit(child);}
    else targets.add(node);
  };
  // Public Instagram includes navigation and panels portaled outside MAIN.
  // Split protected branches instead of limiting coverage to semantic roots.
  for(const root of document.body.children)if(!root.matches('script, style, link, meta'))visit(root);
  return targets;
}

export class InstagramGrayscaleSession extends NavigationSurfaceSession {
  constructor(document,options){super(document,options,{feature_id:'IG-06',prefix:'INSTAGRAM_GRAYSCALE',routeAllowed,collect});}
}
