import {InstagramMediaSession} from './instagram-media.mjs';

const HOSTS=new Set(['instagram.com','www.instagram.com']);
const PROTECTED='[data-focurve-ui], [data-focurve-restriction], header, footer, aside, nav, [role="navigation"], [contenteditable="true"]';
const reelRoute=url=>/^\/(?:reel\/[^/]+|reels(?:\/[^/]+)?)\/?$/.test(url.pathname);
const direct=document=>reelRoute(new URL(document.location.href));
const supportedRoute=url=>!/^\/(?:accounts|challenge|oauth|login|auth|two_factor)(?:\/|$)/i.test(url.pathname);
function entryURL(link,document){
  let url;try{url=new URL(link.getAttribute('href'),document.location.href);}catch{return false;}
  return url.protocol==='https:'&&HOSTS.has(url.hostname)&&!url.port&&!url.username&&!url.password&&reelRoute(url);
}
function targets(document){
  const found=new Set();
  if(!supportedRoute(new URL(document.location.href)))return found;
  // Hide exact Reels links, including the navigation entry. A DM link/repost
  // is not an authorized feed surface. Never hide ancestor page containers.
  if(!/^\/(?:direct|stories)(?:\/|$)/.test(document.location.pathname))for(const link of document.querySelectorAll('a[href]')){
    if(link.closest('[data-focurve-ui], [data-focurve-restriction], aside, header, footer, [contenteditable="true"]')
      ||link.querySelector('[data-focurve-ui], [data-focurve-restriction], input, textarea, [contenteditable="true"]'))continue;
    if(entryURL(link,document))found.add(link);
  }
  if(direct(document))for(const media of document.querySelectorAll('main video, main audio, [role="main"] video, [role="main"] audio, [role="dialog"] video, [role="dialog"] audio')){
    if(media.closest(PROTECTED)||media.closest('button, [role="button"], [hidden]'))continue;
    // An unrelated linked ordinary post is not part of the direct viewer.
    const link=media.closest('a[href]');if(link&&!entryURL(link,document))continue;
    found.add(media);
  }
  return new Set([...found].filter(node=>![...found].some(other=>other!==node&&other.contains(node))));
}
function mediaTargets(document){
  const found=new Set();
  for(const target of targets(document)){
    if(target.matches('video, audio'))found.add(target);
    for(const media of target.querySelectorAll('video, audio'))if(!media.closest(PROTECTED))found.add(media);
  }
  return found;
}

// Local composition only: issued/native scope, durable intent and cleanup lease
// must be supplied by the real Core adapter before product activation.
export class InstagramReelsSession extends InstagramMediaSession {
  constructor(document,options){super(document,options,{feature_id:'IG-02',prefix:'INSTAGRAM_REELS',
    routeAllowed:supportedRoute,collect:targets,mediaTargets,mediaEligible:()=>true,direct,
    requiresMedia:true,revision:'ig-reels-observe-1'});}
}
