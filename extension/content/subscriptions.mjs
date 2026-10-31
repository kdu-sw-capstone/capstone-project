import {NavigationSurfaceSession} from './navigation-surface.mjs';

const HOSTS=new Set(['youtube.com','www.youtube.com']);
const PATH='/feed/subscriptions';
const LINKS='ytd-guide-entry-renderer a[href], ytd-mini-guide-entry-renderer a[href]';
function localUrl(link,document){
  try{
    const url=new URL(link.getAttribute('href'),document.location.href);
    return url.protocol==='https:'&&HOSTS.has(url.hostname)&&!url.port&&!url.username&&!url.password?url:null;
  }catch{return null;}
}
const channelPath=path=>/^\/(?:@[^/]+|(?:channel|c|user)\/[^/]+)(?:\/.*)?$/.test(path);
const PROFILE=Object.freeze({feature_id:'YT-05',prefix:'SUBSCRIPTIONS',
  routeAllowed:url=>['/','/watch','/results',PATH].includes(url.pathname),
  collect(document){
    const targets=new Set();
    if(document.location.pathname===PATH){
      // Legacy subscription layouts and current rich-grid layouts share browse.
      // Only the current subscriptions route is eligible, never channel pages.
      for(const node of document.querySelectorAll('ytd-browse[page-subtype="subscriptions"], ytd-browse[page-subtype="subscriptions-feed"]'))targets.add(node);
    }
    for(const link of document.querySelectorAll(LINKS)){
      const url=localUrl(link,document);
      if(url?.pathname===PATH){
        targets.add(link.closest('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer')??link);
      }
    }
    // Modern sidebar: the subscriptions heading and followed channel entries
    // are siblings. Restrict only a section identified by its subscriptions URL,
    // not arbitrary channel links elsewhere or a locale-dependent heading text.
    for(const section of document.querySelectorAll('ytd-guide-section-renderer, ytd-guide-collapsible-section-entry-renderer')){
      const links=[...section.querySelectorAll('a[href]')],urls=links.map(link=>localUrl(link,document));
      if(!urls.some(url=>url?.pathname===PATH))continue;
      const isSubscription=url=>url&&(url.pathname===PATH||url.pathname==='/feed/channels'||channelPath(url.pathname));
      if(urls.every(isSubscription))targets.add(section);
      else{
        // Mixed/legacy navigation: preserve Home/Shorts/history and hide only
        // Use the same subscription classification as the whole-section path,
        // including /feed/channels, while preserving unrelated siblings.
        for(let i=0;i<links.length;i++)if(isSubscription(urls[i]))
          targets.add(links[i].closest('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer')??links[i]);
      }
    }
    // One ancestor claim covers its descendants without duplicate footprints.
    return new Set([...targets].filter(node=>![...targets].some(other=>other!==node&&other.contains(node))));
  }});

// DOM only: never clicks subscribe/unsubscribe, mutates account state, or calls API.
export class SubscriptionsSession extends NavigationSurfaceSession {
  constructor(document,options){super(document,options,PROFILE);}
}
