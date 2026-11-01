import {InstagramMediaSession} from './instagram-media.mjs';

const HOSTS=new Set(['instagram.com','www.instagram.com']);
const PROTECTED='[data-focurve-ui], [data-focurve-restriction], article, nav, header, footer, aside, [role="navigation"]';
const storyRoute=url=>/^\/stories\/[^/]+(?:\/[^/]+)?\/?$/.test(url.pathname);
const direct=document=>storyRoute(new URL(document.location.href));
function supportedRoute(url){
  // Observation lifetime is broader than effect eligibility. Instagram may
  // pass through index/alias/intermediate routes before the final story URL.
  // collect() below still changes only HOME story entries or a direct viewer.
  // The shared surface separately requires same-host/native reauthorization.
  return !/^\/(?:accounts|challenge|oauth|login|auth|two_factor)(?:\/|$)/i.test(url.pathname);
}
function targets(document){
  const found=new Set();
  if(document.location.pathname==='/'){
    for(const link of document.querySelectorAll('a[href]')){
      if(link.closest(PROTECTED)||link.querySelector(PROTECTED))continue;
      let url;try{url=new URL(link.getAttribute('href'),document.location.href);}catch{continue;}
      if(url.protocol==='https:'&&HOSTS.has(url.hostname)&&!url.port&&!url.username&&!url.password&&storyRoute(url))found.add(link);
    }
    // Current home tray uses a labeled div/button rather than an href. Require
    // the story label AND list/ring/profile shape, not volatile CSS classes or
    // every profile button. Attribute values never leave this local adapter.
    for(const button of document.querySelectorAll('[role="button"][aria-label], button[aria-label]')){
      if(button.closest(PROTECTED)||button.querySelector(PROTECTED))continue;
      const label=button.getAttribute('aria-label').normalize('NFKC');
      if(!/^.+(?:님의 스토리|['’]s story)(?:,|$)/i.test(label))continue;
      const item=button.closest('li');
      if(item?.closest('ul, ol')&&button.querySelector('canvas')&&button.querySelector('[role="link"] img'))found.add(button);
    }
  }else if(direct(document)){
    // Route-bound media only: never hide the page container, close controls,
    // ordinary post articles, navigation, or protected FOCURVE UI.
    for(const media of document.querySelectorAll('main img, main video, main audio, [role="main"] img, [role="main"] video, [role="main"] audio, [role="dialog"] img, [role="dialog"] video, [role="dialog"] audio, [role="presentation"] img, [role="presentation"] video, [role="presentation"] audio')){
      if(!media.closest(PROTECTED)&&!media.closest('button, a, [role="button"], [hidden]'))found.add(media);
    }
    // User-observed viewer: an ordinary portrait-sized div, without semantic
    // main/dialog roles. Require that local frame shape on a STORIES route;
    // never broaden to every image/video on every Instagram page.
    for(const media of document.querySelectorAll('img, video, audio')){
      if(found.has(media)||media.closest(PROTECTED)||media.closest('button, a, [role="button"], [hidden]'))continue;
      if(media.matches('img')&&(media.getAttribute('alt')!==''||media.getAttribute('draggable')!=='false'))continue;
      let frame=media.parentElement;
      // Instagram nests repost/music viewers many levels below their frame.
      // DOM depth is not an authority boundary; keep walking this document's
      // ancestors while retaining the route/frame/protected-content checks.
      for(;frame;frame=frame.parentElement){
        const w=frame.style.width,h=frame.style.height;
        if(frame.tagName==='DIV'&&/^\d+(?:\.\d+)?px$/.test(w)&&/^\d+(?:\.\d+)?px$/.test(h)
          &&parseFloat(w)>0&&parseFloat(h)>parseFloat(w)
          &&!frame.querySelector(PROTECTED)&&!frame.querySelector('input, textarea, [contenteditable="true"]')){found.add(media);break;}
      }
    }
  }
  return new Set([...found].filter(node=>![...found].some(other=>other!==node&&other.contains(node))));
}

export class InstagramStoriesSession extends InstagramMediaSession {
  constructor(document,options){super(document,options,{feature_id:'IG-01',prefix:'INSTAGRAM_STORIES',
    routeAllowed:supportedRoute,collect:targets,mediaTargets:targets,mediaEligible:direct,direct,revision:'ig-stories-observe-3'});}
}
