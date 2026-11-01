import {NavigationSurfaceSession} from './navigation-surface.mjs';

const PROTECTED='[data-focurve-ui], [data-focurve-restriction]';
const PATHS=new Set(['/','/watch','/results','/playlist','/feed/subscriptions','/feed/explore','/feed/trending','/feed/storefront','/feed/history','/feed/library']);
const PROFILE=Object.freeze({feature_id:'YT-09',prefix:'GRAYSCALE',
  routeAllowed:url=>PATHS.has(url.pathname)||/^\/(?:shorts|live|channel|c|user)\/[^/]+(?:\/.*)?$/.test(url.pathname)||/^\/@[^/]+(?:\/.*)?$/.test(url.pathname),
  collect(document){
    const targets=new Set();
    // Filtering an ancestor also filters its protected descendants. Split that
    // branch instead; filter:none on the notice cannot undo ancestor grayscale.
    const visit=node=>{
      if(node.closest(PROTECTED))return;
      if(node.querySelector(PROTECTED)){for(const child of node.children)visit(child);}
      else targets.add(node);
    };
    for(const app of document.querySelectorAll('ytd-app')){
      if(!app.parentElement?.closest('ytd-app'))visit(app);
    }
    return targets;
  }});

// Document-local primitive. Caller owns verified frozen/native scope and the
// durable intent/result envelope. This does not issue Core/Server success.
export class GrayscaleSession extends NavigationSurfaceSession {
  constructor(document,options){super(document,options,PROFILE);}
}
