import {NavigationSurfaceSession} from './navigation-surface.mjs';

// Desktop YouTube only. These selectors are not a Wire policy or authority.
const PROTECTED='[data-focurve-restriction], [data-focurve-ui]';
const PATHS=new Set(['/','/watch','/results','/feed/subscriptions','/feed/explore','/feed/trending','/feed/storefront','/playlist']);
const PROFILE=Object.freeze({feature_id:'YT-07',prefix:'MASTHEAD',
  routeAllowed:url=>PATHS.has(url.pathname)||/^\/(?:shorts|channel|c|user)\/[^/]+(?:\/.*)?$/.test(url.pathname)||/^\/@[^/]+(?:\/.*)?$/.test(url.pathname),
  collect(document){
    return new Set([...document.querySelectorAll('ytd-masthead')].filter(node=>
      !node.closest(PROTECTED)&&!node.querySelector(PROTECTED)));
  }});

// The caller supplies authorized frozen scope. No search/account/media mutation.
export class MastheadSession extends NavigationSurfaceSession {
  constructor(document,options){super(document,options,PROFILE);}
}
