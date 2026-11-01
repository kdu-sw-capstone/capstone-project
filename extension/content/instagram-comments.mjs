import {NavigationSurfaceSession} from './navigation-surface.mjs';

const HOSTS=new Set(['instagram.com','www.instagram.com']);
const PROTECTED='[data-focurve-ui], [data-focurve-restriction], nav, header, footer, aside, [role="search"]';
const routeAllowed=url=>!/^\/(?:accounts|challenge|oauth|login|auth|two_factor)(?:\/|$)/i.test(url.pathname);
const post=url=>/^\/(?:(?:p|reel)\/[^/]+|reels(?:\/[^/]+)?)\/?$/.test(url.pathname);
const name=node=>(node.getAttribute('aria-label')??'').normalize('NFKC').trim().toLowerCase();
const commentsName=value=>/^(?:comments|댓글)(?:\s*\(\d+\))?$/.test(value);
function inScope(node,url){
  if(node.closest(PROTECTED)||/^\/(?:direct|stories)(?:\/|$)/.test(url.pathname))return false;
  // Reels may portal its comment panel outside semantic MAIN/ARTICLE.
  // This exception is restricted to a canonical post/Reels document; actual
  // row selection still requires exact comment identity and safe structure.
  if(post(url))return true;
  const scope=node.closest('article, [role="dialog"], main, [role="main"]');
  if(!scope)return false;
  const dialog=node.closest('[role="dialog"]');
  return post(url)||!!dialog&&commentsName(name(dialog));
}
function safeContainer(node){
  return !node.matches('article, main, [role="dialog"], [role="main"]')
    &&!node.querySelector(PROTECTED+', video, audio, article, h1, h2');
}
function localPath(link,url){
  let target;try{target=new URL(link.getAttribute('href'),url);}catch{return null;}
  return target.protocol==='https:'&&HOSTS.has(target.hostname)&&!target.port&&!target.username&&!target.password?target.pathname:null;
}
function oneComment(node,link,url){
  const paths=new Set([...node.querySelectorAll('a[href]')].map(a=>localPath(a,url)).filter(path=>path&&/^\/(?:p|reel)\/[^/]+\/c\//.test(path)));
  return paths.size===1&&paths.has(localPath(link,url));
}
function profileLink(node,url){
  return [...node.querySelectorAll('a[href]')].some(a=>{const path=localPath(a,url);
    return path&&/^\/[^/]+\/?$/.test(path)&&!/^\/(?:p|reel|reels|explore|direct|stories|accounts)\/?$/.test(path);});
}
function isProfile(link,url){
  const path=link&&localPath(link,url);
  return path&&/^\/[^/]+\/?$/.test(path)&&!/^\/(?:p|reel|reels|explore|direct|stories|accounts)\/?$/.test(path);
}
function bodyImage(node,url){
  return [...node.querySelectorAll('img')].some(img=>{
    const link=img.closest('a[href]');
    return !isProfile(link,url)&&!(img.closest('[role="link"]')&&!link)&&!img.closest('button, [role="button"]');
  });
}
function bodyContent(node,url){
  if(bodyImage(node,url))return true;
  return [...node.querySelectorAll('span[dir="auto"]')].some(body=>{
    if(body.closest('a, [role="button"], h1, h2, h3')||body.querySelector('time'))return false;
    if([...body.querySelectorAll('a[href]')].some(a=>a.textContent.trim().startsWith('@')))return true;
    if([...body.querySelectorAll('a[href]')].some(a=>a.textContent.trim().startsWith('#')
      &&/^\/explore\/tags\/[^/]+\/?$/.test(localPath(a,url)??'')))return true;
    const walker=body.ownerDocument.createTreeWalker(body,4);let text;
    while((text=walker.nextNode()))if(text.nodeValue.trim()&&!text.parentElement.closest('a, time, [role="button"]'))return true;
    return false;
  });
}
const controlName=node=>(node.getAttribute('aria-label')??node.textContent).normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const replyAction=node=>/^(?:reply|답글\s*달기)$/.test(controlName(node));
const replyToggle=node=>/^(?:답글(?:\s*\d+\s*개)?\s*(?:모두\s*)?(?:보기|숨기기)(?:\s*\(\s*\d+\s*개\s*\))?|view(?: all)?(?: \d+)? replies|hide(?: all)? replies)$/.test(controlName(node));
function emptyCommentRow(node,url){
  if(node.querySelector('p, h1, h2, video, audio, picture, input, textarea, [role="textbox"]'))return false;
  const content=node.cloneNode(true);
  content.querySelectorAll('a, button, [role="button"], time, h3, svg, canvas').forEach(control=>control.remove());
  if(content.textContent.trim())return false;
  const profiles=[...node.querySelectorAll('a[href]')].filter(a=>isProfile(a,url));
  const avatar=profiles.find(a=>a.querySelector('img'));
  return !!avatar&&profiles.some(a=>a!==avatar&&localPath(a,url)===localPath(avatar,url))
    &&[...node.querySelectorAll('img')].every(img=>isProfile(img.closest('a[href]'),url))
    &&[...node.querySelectorAll('button, [role="button"]')].some(replyAction);
}
function nestedIdentityBoundary(row,link,url){
  let branch=link;
  while(branch.parentElement!==row)branch=branch.parentElement;
  if(branch===link)return true; // Flat GIF rows keep their existing evidence.
  // Evidence inside a nested column cannot authorize unrelated post content
  // outside that column. Avatar/author and row controls are the only extras.
  for(const sibling of row.childNodes){
    if(sibling===branch)continue;
    const copy=sibling.cloneNode(true);
    if(copy.nodeType===3){if(copy.textContent.trim())return false;continue;}
    if(copy.nodeType!==1)continue;
    for(const a of [...copy.querySelectorAll('a[href]')])if(isProfile(a,url))a.remove();
    if(copy.matches('a[href]')&&isProfile(copy,url))continue;
    copy.querySelectorAll('button, [role="button"], [role="link"], svg, canvas').forEach(e=>e.remove());
    if(copy.matches('button, [role="button"], [role="link"], svg, canvas'))continue;
    if(copy.textContent.trim()||copy.matches('img, picture')||copy.querySelector('img, picture'))return false;
  }
  return true;
}
function commentRow(link,url){
  const row=link.closest('li, [role="listitem"]');
  if(row&&safeContainer(row)&&oneComment(row,link,url)&&row.querySelectorAll('h3').length<=1
    &&!row.querySelector('p, picture, input, textarea, [role="textbox"], li, [role="listitem"]')){
    // Preserve simple inline rows and structured comment rows, including link-
    // only/empty bodies. The permalink alone never authorizes a whole post.
    if(link.parentElement===row&&[...row.children].every(child=>child===link||child.tagName==='SPAN')
      &&[...row.querySelectorAll('img')].every(img=>isProfile(img.closest('a[href]'),url)||!!img.closest('[role="link"]')))return row;
    if(link.querySelector('time[datetime]')&&profileLink(row,url)&&nestedIdentityBoundary(row,link,url)
      &&[...row.querySelectorAll('button, [role="button"]')].some(replyAction))return row;
  }
  if(!link.querySelector('time[datetime]'))return null;
  // Supplied post/Reels layouts use DIV rows: a profile link, exact comment
  // time, separate body and reply controls. H3 is optional; H2 captions alone
  // cannot establish a comment. No class/account ID is used.
  for(let node=link.parentElement;node;node=node.parentElement){
    if(node===row)break;
    if(node.matches('article, main, [role="dialog"], [role="main"]'))break;
    if(node.tagName!=='DIV'||!safeContainer(node)||node.querySelectorAll('h3').length>1||!oneComment(node,link,url)||!profileLink(node,url)
      ||!node.querySelector('button, [role="button"]')||!(bodyContent(node,url)||emptyCommentRow(node,url)))continue;
    // The text column can be nested several levels below its avatar/heart.
    // Expand only through wrappers belonging to this single comment identity.
    let whole=node;
    for(let parent=node.parentElement;parent?.tagName==='DIV';parent=parent.parentElement){
      if(parent===row)break;
      // Stop at an external post without discarding the verified full row.
      // A partial column with protected UI in its own avatar wrapper stays denied.
      if(!safeContainer(parent)&&!whole.querySelector('[role="link"] img')&&oneComment(parent,link,url)
        &&[...parent.querySelectorAll('[role="link"] img')].some(img=>!whole.contains(img)))return null;
      if(!safeContainer(parent)||parent.querySelectorAll('h3').length>1||!oneComment(parent,link,url))break;
      const siblings=[...parent.children].filter(child=>!child.contains(whole));
      if(siblings.some(child=>{const copy=child.cloneNode(true);copy.querySelectorAll('svg').forEach(svg=>svg.remove());return !!copy.textContent.trim();}))break;
      if([...parent.querySelectorAll('img')].some(img=>!node.contains(img)&&!isProfile(img.closest('a[href]'),url)&&!img.closest('[role="link"]')))break;
      whole=parent;
    }
    return whole;
  }
  return null;
}
function collect(document){
  const found=new Set(),url=new URL(document.location.href);
  if(!routeAllowed(url))return found;
  // Only semantically named lists, never every UL or the entire post modal.
  for(const list of document.querySelectorAll('ul[aria-label], ol[aria-label], [role="list"][aria-label]')){
    if(inScope(list,url)&&commentsName(name(list))&&safeContainer(list))found.add(list);
  }
  // Unlabelled layouts may still expose an exact per-comment permalink. Keep
  // caption/post links and unrelated profile links outside these rows intact.
  for(const link of document.querySelectorAll('a[href]')){
    if(!inScope(link,url))continue;
    let target;try{target=new URL(link.getAttribute('href'),url);}catch{continue;}
    if(target.protocol!=='https:'||!HOSTS.has(target.hostname)||target.port||target.username||target.password)continue;
    const match=/^\/(?:p|reel)\/([^/]+)\/c\/[^/]+(?:\/r\/[^/]+)?\/?$/.exec(target.pathname);
    if(!match)continue;
    const current=/^\/(?:p|reel|reels)\/([^/]+)\/?$/.exec(url.pathname);
    if(current&&current[1]!==match[1])continue;
    const row=commentRow(link,url);
    if(row&&inScope(row,url)&&safeContainer(row))found.add(row);
  }
  // Supplied image/GIF comments omit timestamps and comment permalinks. Require
  // body image + linked avatar/profile + an explicit Reply action in one safe
  // row. A regular post image/like/comment button does not establish this shape.
  for(const img of document.querySelectorAll('img')){
    if(!inScope(img,url)||isProfile(img.closest('a[href]'),url))continue;
    for(let node=img.parentElement;node;node=node.parentElement){
      if(node.matches('article, main, [role="dialog"], [role="main"]'))break;
      if(node.tagName!=='DIV'||!safeContainer(node)||!profileLink(node,url)||!bodyImage(node,url)
        ||![...node.querySelectorAll('a[href] img')].some(avatar=>isProfile(avatar.closest('a[href]'),url))
        ||![...node.querySelectorAll('button, [role="button"]')].some(replyAction)
        ||[...node.querySelectorAll('a[href]')].some(a=>/\/(?:c)\//.test(localPath(a,url)??'')))continue;
      found.add(node);break;
    }
  }
  // Reply controls/UL are a separate sibling of the parent comment in the
  // supplied layout. Own the attached reply section too, including avatars.
  for(const row of [...found])for(let node=row;node?.tagName==='DIV';node=node.parentElement){
    if(!safeContainer(node)||[...found].some(other=>other!==row&&node.contains(other)))break;
    const section=node.nextElementSibling;
    if(section?.tagName==='DIV'&&safeContainer(section)&&inScope(section,url)
      &&[...section.querySelectorAll('button, [role="button"]')].some(replyToggle)
      &&![...section.querySelectorAll('img')].some(img=>!img.closest('ul, ol, [role="list"]'))
      &&[...section.querySelectorAll('a[href]')].every(a=>{
        const match=/^\/(?:p|reel)\/([^/]+)\/c\//.exec(localPath(a,url)??'');
        const current=/^\/(?:p|reel|reels)\/([^/]+)\/?$/.exec(url.pathname);
        return !match||!current||match[1]===current[1];
      })){
      found.add(section);break;
    }
  }
  // Collapsed reply controls remain after their parent row is hidden and may
  // be inserted independently. Claim only the explicitly named control.
  for(const button of document.querySelectorAll('button, [role="button"]')){
    if(inScope(button,url)&&replyToggle(button)&&safeContainer(button))found.add(button);
  }
  // Do not inspect values or hide arbitrary forms/editors. A comment-named
  // textarea/textbox is an independent local target; other controls stay usable.
  for(const editor of document.querySelectorAll('textarea, [role="textbox"]')){
    if(!inScope(editor,url)||editor.querySelector(PROTECTED))continue;
    const labels=[editor.getAttribute('aria-label'),editor.getAttribute('placeholder')].filter(Boolean);
    if(labels.some(value=>/^(?:add a comment|write a comment|댓글 달기|댓글 추가|댓글을 입력)(?:[\s.…!]*)$/i.test(value.normalize('NFKC').trim())))found.add(editor);
  }
  return new Set([...found].filter(node=>![...found].some(other=>other!==node&&other.contains(node))));
}

// Internal DOM adapter only. Core supplies issued/native/frozen/durable authority.
export class InstagramCommentsSession extends NavigationSurfaceSession {
  constructor(document,options){super(document,options,{feature_id:'IG-04',prefix:'INSTAGRAM_COMMENTS',routeAllowed,collect});}
}
