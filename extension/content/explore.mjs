import {NavigationSurfaceSession} from './navigation-surface.mjs';
import {exploreDestination} from './explore-profile.mjs';
const LINKS='ytd-guide-entry-renderer a[href], ytd-mini-guide-entry-renderer a[href]';
const PROFILE=Object.freeze({feature_id:'YT-06',prefix:'EXPLORE',
  routeAllowed:url=>['/','/watch','/results','/feed/subscriptions'].includes(url.pathname)||!!exploreDestination(url),
  collect(document){
    const targets=new Set();
    const destination=exploreDestination(new URL(document.location.href));
    if(destination){
      for(const node of document.querySelectorAll('ytd-browse[page-subtype]')){
        if(node.hidden||node.closest('[hidden]'))continue;
        if(node.getAttribute('page-subtype')!==destination)continue;
        // A stale channel tree may survive a SPA URL change. Bind channel
        // content to its actual browse id rather than hiding every channel tree.
        if(destination==='channels'&&node.getAttribute('browse-id')!==document.location.pathname.split('/')[2])continue;
        targets.add(node);
      }
    }
    for(const link of document.querySelectorAll(LINKS)){
      let url;try{url=new URL(link.getAttribute('href'),document.location.href);}catch{continue;}
      if(exploreDestination(url))targets.add(link.closest('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer')??link);
    }
    return targets;
  }});

// DOM only; no redirect, account mutation or media playback changes.
export class ExploreSession extends NavigationSurfaceSession {
  constructor(document,options){super(document,options,PROFILE);}
}
