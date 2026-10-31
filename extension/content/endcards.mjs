import {NavigationSurfaceSession} from './navigation-surface.mjs';

// Internal desktop selectors; not policy, capability or native scope evidence.
const CARDS='.ytp-ce-element, .ytp-videowall-still, .ytp-suggestion-link';
const POST_PLAY_GRID='.ytp-fullscreen-grid-stills-container';
const PROTECTED='video, .html5-video-container, .ytp-chrome-bottom, .ytp-chrome-top, .ytp-caption-window-container, .caption-window, [data-focurve-restriction], [data-focurve-ui]';
function videoId(url){
  const values=url.searchParams.getAll('v');
  return url.pathname==='/watch'&&values.length===1&&values[0]?values[0]:null;
}
const PROFILE=Object.freeze({feature_id:'YT-08',prefix:'ENDCARDS',
  routeAllowed:url=>!!videoId(url),
  collect(document){
    const targets=new Set(),id=videoId(new URL(document.location.href));
    if(!id)return targets;
    for(const watch of document.querySelectorAll('ytd-watch-flexy')){
      if(watch.closest('[hidden]')||watch.getAttribute('video-id')!==id)continue;
      for(const player of watch.querySelectorAll('#movie_player')){
        if(player.closest('[hidden]'))continue;
        // The newer final recommendation grid does not use legacy card classes.
        // Match only its stills container in an ended player; keep replay and
        // player controls outside that container available.
        const selectors=player.classList.contains('ended-mode')?CARDS+', '+POST_PLAY_GRID:CARDS;
        for(const node of player.querySelectorAll(selectors)){
          if(!node.closest(PROTECTED)&&!node.querySelector(PROTECTED))targets.add(node);
        }
      }
    }
    return new Set([...targets].filter(node=>![...targets].some(other=>other!==node&&other.contains(node))));
  }});

// Hide cards only. Never click player controls or modify autoplay/media state.
export class EndCardsSession extends NavigationSurfaceSession {
  constructor(document,options){super(document,options,PROFILE);}
}
