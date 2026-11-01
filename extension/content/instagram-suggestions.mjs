import {NavigationSurfaceSession} from './navigation-surface.mjs';

const PROTECTED='[data-focurve-ui], [data-focurve-restriction], nav, footer, [role="dialog"], [role="search"], form, [contenteditable="true"]';
const text=node=>(node.getAttribute('aria-label')??node.textContent).normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const accountLabel=value=>/^(?:회원님을 위한 추천|추천 계정|suggested for you|suggested accounts|people you may know)$/.test(value);
const postLabel=value=>/^(?:추천 게시물|suggested posts|suggested for you|회원님을 위한 추천)$/.test(value);
const follow=node=>/^(?:팔로우|follow|follow back|맞팔로우)$/.test(text(node));
const routeAllowed=url=>url.pathname==='/'||/^\/explore\/people\/?$/.test(url.pathname);
function profile(link,document){
  const href=link?.getAttribute('href');if(!href)return false;
  let url;try{url=new URL(href,document.location.href);}catch{return false;}
  return url.protocol==='https:'&&['instagram.com','www.instagram.com'].includes(url.hostname)&&!url.port&&!url.username&&!url.password
    &&/^\/[^/]+\/?$/.test(url.pathname)&&!/^\/(?:direct|stories|reels|explore|accounts|p|reel)\/?$/.test(url.pathname);
}
function accountRegion(node,document){
  if(node.matches('body, main, [role="main"], article')||node.closest(PROTECTED)||node.querySelector(PROTECTED+', article, video, audio, textarea, input, [role="textbox"]'))return false;
  const links=[...node.querySelectorAll('a[href]')],controls=[...node.querySelectorAll('button, [role="button"]')];
  if(!links.some(a=>profile(a,document))||!controls.some(follow))return false;
  // Current-account switchers and post/DM links are not suggestion evidence.
  if(controls.some(b=>/^(?:전환|switch|메시지|message)$/.test(text(b)))||links.some(a=>!profile(a,document)&&!/^\/(?:explore\/people)\/?$/.test(new URL(a.getAttribute('href'),document.location.href).pathname)))return false;
  return [...node.querySelectorAll('img')].every(img=>{
    if(profile(img.closest('a[href]'),document))return true;
    // Supplied mutual-follow badges are small role=link avatars, not post media.
    const badge=img.closest('[role="link"]');
    const width=Number.parseFloat(badge?.style.width),height=Number.parseFloat(badge?.style.height);
    return !!badge&&!badge.matches('a[href]')&&width>0&&width<=32&&height>0&&height<=32;
  });
}
function postHeadings(article,document){
  const headings=[...article.querySelectorAll('header')];
  for(const label of article.querySelectorAll('span')){
    if(!postLabel(text(label))||label.closest('p, a, button, [role="button"]'))continue;
    for(let node=label.parentElement;node&&node!==article;node=node.parentElement){
      if(node.querySelector('video, audio, p, article, [aria-label="Video player"], textarea, [role="textbox"]'))break;
      if([...node.querySelectorAll('img')].some(img=>!profile(img.closest('a[href]'),document)))break;
      if([...node.querySelectorAll('a[href]')].some(a=>profile(a,document))
        &&[...node.querySelectorAll('a[href]')].some(a=>a.querySelector('time[datetime]')&&/^\/(?:p|reel)\/[^/]+\/?$/.test(new URL(a.getAttribute('href'),document.location.href).pathname))){headings.push(node);break;}
    }
  }
  return headings;
}
function collect(document){
  const found=new Set(),url=new URL(document.location.href);if(!routeAllowed(url))return found;
  // Whole suggested posts require a recommendation marker in their own header.
  // Ordinary captions/comments and advertisements cannot authorize a post claim.
  for(const article of document.querySelectorAll('article')){
    if(article.closest(PROTECTED)||article.querySelector(PROTECTED))continue;
    const labels=postHeadings(article,document).flatMap(header=>[...header.querySelectorAll('span, h2, h3, h4, [aria-label]')]).filter(n=>!n.closest('button, a'));
    if(labels.some(n=>/^(?:광고|sponsored|advertisement)$/.test(text(n))))continue;
    if(labels.some(n=>postLabel(text(n))))found.add(article);
  }
  for(const label of document.querySelectorAll('h2, h3, h4, span, div[role="heading"]')){
    if(!accountLabel(text(label))||label.closest(PROTECTED+', article, a, button, [role="button"]'))continue;
    // Find only a compact account recommendation group; never the feed root.
    let node=label.parentElement,candidate=null;
    for(;node;node=node.parentElement){
      if(node.matches('body, main, [role="main"], article')||node.closest(PROTECTED))break;
      if(accountRegion(node,document))candidate=node;
      else if(candidate)break;
    }
    if(candidate)found.add(candidate);
  }
  return new Set([...found].filter(node=>![...found].some(other=>other!==node&&other.contains(node))));
}

// Internal DOM primitive. Production authority/frozen policy/durable cleanup is Core-owned.
export class InstagramSuggestionsSession extends NavigationSurfaceSession {
  constructor(document,options){super(document,options,{feature_id:'IG-05',prefix:'INSTAGRAM_SUGGESTIONS',routeAllowed,collect});}
}
