import {NavigationSurfaceSession} from './navigation-surface.mjs';

const HOSTS=new Set(['youtube.com','www.youtube.com']);
const LINKS='ytd-guide-entry-renderer a[href], ytd-mini-guide-entry-renderer a[href], ytd-masthead a#logo[href], ytd-topbar-logo-renderer a[href]';
const PROFILE=Object.freeze({feature_id:'YT-01',prefix:'HOME',
  routeAllowed:url=>['/','/watch','/results'].includes(url.pathname),
  collect(document){
    const targets=new Set();
    // A hidden/stale HOME tree on /results or /watch is not the current feed.
    if(document.location.pathname==='/')for(const node of document.querySelectorAll('ytd-browse[page-subtype="home"]'))targets.add(node);
    for(const link of document.querySelectorAll(LINKS)){
      let url;try{url=new URL(link.getAttribute('href'),document.location.href);}catch{continue;}
      if(url.protocol==='https:'&&HOSTS.has(url.hostname)&&!url.port&&!url.username&&!url.password&&url.pathname==='/'){
        targets.add(link.closest('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer')??link);
      }
    }
    return targets;
  }});

// Public internal adapter API remains unchanged; no new Wire/profile contract.
export class HomeSession extends NavigationSurfaceSession {
  constructor(document,options){super(document,options,PROFILE);}
}
