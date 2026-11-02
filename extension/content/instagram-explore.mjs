import {NavigationSurfaceSession} from './navigation-surface.mjs';

const HOSTS=new Set(['instagram.com','www.instagram.com']);
const PROTECTED='[data-focurve-ui], [data-focurve-restriction], aside, header, footer, [role="dialog"], [role="search"], form, [contenteditable="true"]';
const routeAllowed=url=>!/^\/(?:accounts|challenge|oauth|login|auth|two_factor)(?:\/|$)/i.test(url.pathname);
function localURL(link,document){
  let url;try{url=new URL(link.getAttribute('href'),document.location.href);}catch{return null;}
  return url.protocol==='https:'&&HOSTS.has(url.hostname)&&!url.port&&!url.username&&!url.password?url:null;
}
const explore=url=>/^\/explore\/?$/.test(url.pathname)&&!url.searchParams.has('q')&&!url.searchParams.has('query');
function confirmedExploreEntry(link,document){
  const labels=[link.getAttribute('aria-label'),link.getAttribute('title'),link.textContent,
    ...[...link.querySelectorAll('svg[aria-label], svg title')].map(node=>node.getAttribute('aria-label')??node.textContent),
    ...(link.getAttribute('aria-labelledby')??'').split(/\s+/).filter(Boolean).map(id=>document.getElementById(id)?.textContent)]
    .filter(Boolean).map(value=>value.normalize('NFKC').trim().toLowerCase());
  // Search can share the Explore href in the actual UI. Unknown labels are
  // preserved; a URL alone is not enough to authorize removing an entry point.
  if(labels.some(value=>/^(?:검색|search)$/.test(value)))return false;
  return labels.some(value=>/^(?:탐색|탐색 탭|explore)$/.test(value));
}
function collect(document){
  const found=new Set(),current=new URL(document.location.href);
  if(!routeAllowed(current))return found;
  // Require both route and explicit menu identity; never hide the container.
  for(const link of document.querySelectorAll('a[href]')){
    if(link.closest(PROTECTED)||link.querySelector(PROTECTED)||/^\/direct(?:\/|$)/.test(current.pathname))continue;
    const url=localURL(link,document);
    if(url&&explore(url)&&confirmedExploreEntry(link,document))found.add(link);
  }
  if(explore(current))for(const link of document.querySelectorAll('main a[href], [role="main"] a[href]')){
    if(link.closest(PROTECTED)||link.closest('nav, [role="navigation"]')||link.querySelector(PROTECTED))continue;
    const url=localURL(link,document);
    if(url&&/^\/(?:p|reel)\/[^/]+\/?$/.test(url.pathname)&&link.querySelector('img, video'))found.add(link);
  }
  // Only suppress a list's semantic loading indicator after identifying cards.
  // Preserve initial loading and search/dialog progress. Keep its geometry too.
  if(explore(current)&&[...found].some(node=>node.closest('main, [role="main"]')&&node.querySelector('img, video')))
    for(const loader of document.querySelectorAll('main [role="progressbar"], [role="main"] [role="progressbar"]')){
      if(!loader.closest(PROTECTED)&&!loader.querySelector(PROTECTED)&&!loader.closest('nav, [role="navigation"]'))found.add(loader);
    }
  return new Set([...found].filter(node=>![...found].some(other=>other!==node&&other.contains(node))));
}

// Local DOM primitive; production issued/native/durable proof is caller-owned.
export class InstagramExploreSession extends NavigationSurfaceSession {
  constructor(document,options){super(document,options,{feature_id:'IG-03',prefix:'INSTAGRAM_EXPLORE',routeAllowed,collect,preserveLayout:true});}
}
