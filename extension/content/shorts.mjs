import { createShortsNotice } from '../ui/restriction.mjs';
import { Changes } from './changes.mjs';
import { featureEntry } from './entry.mjs';

// DOM adapter only: no policy selection, session state or access event generation.
export class ShortsControl {
  constructor(document) {
    this.document = document;
    this.changes = new Changes();
    this.onPlay = event => {
      if (this.active && featureEntry(document.location.href) === 'YOUTUBE_SHORTS' &&
          event.target.matches?.('video, audio') && event.target.closest('ytd-shorts')) event.target.pause();
    };
  }
  apply({allowElement=null}={}) {
    this.active = true;
    this.document.addEventListener('play', this.onPlay, true);
    const direct = featureEntry(this.document.location.href) === 'YOUTUBE_SHORTS';
    const elements = new Set(this.document.querySelectorAll('ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts]'));
    // URL parsing covers relative, absolute and protocol-relative links without
    // accidentally hiding watch links that only mention Shorts in a query.
    for (const anchor of this.document.querySelectorAll('a[href]')) {
      if (featureEntry(anchor.href) === 'YOUTUBE_SHORTS') elements.add(anchor);
    }
    const viewers = direct ? [...this.document.querySelectorAll('ytd-shorts')] : [];
    viewers.forEach(viewer => elements.add(viewer));
    let changed = 0, deferred = 0, status = elements.size ? 'SUPPORTED' : 'FAILED';
    let failure=elements.size?null:'TARGET_MISSING';
    const reject=code=>{status='FAILED';failure??=code;};
    this.lastApplyFailure=null;
    for (const element of elements) {
      // A ledger-backed adapter can defer a node which appeared after its
      // durable plan. Direct legacy callers retain the existing default.
      if(allowElement&&!allowElement(element)){deferred++;reject('UNPLANNED_NODE');continue;}
      try {
        if (this.changes.hide(element)) changed++; else reject('NODE_HIDE_UNCONFIRMED');
        if (direct && element.matches('ytd-shorts')) {
          for (const video of element.querySelectorAll('video, audio')) {
            video.pause();
            if (!video.paused) reject('MEDIA_PAUSE_UNCONFIRMED');
          }
        }
      } catch { reject('NODE_APPLY_EXCEPTION'); }
    }
    if (direct) {
      if (!viewers.length) reject('VIEWER_MISSING');
      if (!this.notice?.isConnected) {
        this.notice = createShortsNotice(this.document);
        this.document.documentElement.append(this.notice);
      }
      const view=this.document.defaultView,rect=this.notice.getBoundingClientRect(),style=view.getComputedStyle(this.notice);
      // CSSOM root client size is the document viewport excluding scrollbars;
      // innerWidth/Height includes them. A fixed inset:0 box covers the former.
      const viewport=this.document.compatMode==='BackCompat'?this.document.body:this.document.documentElement;
      const width=viewport?.clientWidth,height=viewport?.clientHeight;
      if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)reject('NOTICE_NOT_VISIBLE');
      if(style.pointerEvents==='none')reject('NOTICE_NOT_INTERACTIVE');
      if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||!['width','height','left','top','right','bottom'].every(key=>Number.isFinite(rect[key])))reject('NOTICE_VIEWPORT_UNCONFIRMED');
      else if(rect.width<width||rect.height<height||rect.left>0||rect.top>0||rect.right<width||rect.bottom<height)reject('NOTICE_VIEWPORT_NOT_COVERED');
      this.notice.updateRestrictionState(viewers.length > 0 && status !== 'FAILED');
      if(failure)this.lastApplyFailure={code:failure,viewport_width:Number.isFinite(width)?width:null,viewport_height:Number.isFinite(height)?height:null,notice_width:Number.isFinite(rect.width)?rect.width:null,notice_height:Number.isFinite(rect.height)?rect.height:null,notice_left:Number.isFinite(rect.left)?rect.left:null,notice_top:Number.isFinite(rect.top)?rect.top:null,notice_right:Number.isFinite(rect.right)?rect.right:null,notice_bottom:Number.isFinite(rect.bottom)?rect.bottom:null};
    } else { this.notice?.remove(); this.notice = null; }
    if(failure&&!this.lastApplyFailure)this.lastApplyFailure={code:failure};
    return {feature:'shorts',status,changed,...(allowElement?{deferred}:{})};
  }
  release() {
    this.active = false;
    this.document.removeEventListener('play',this.onPlay,true);
    this.notice?.remove(); this.notice = null;
    const changed = this.changes.size > 0;
    const restored = this.changes.restore();
    // A player initialized under display:none can retain zero-height geometry.
    // Ask the page to recalculate after confirmed restoration; do not own its
    // layout styles or force playback, and do not signal on failed/no-op release.
    if (restored && changed) {
      const view = this.document.defaultView;
      view?.dispatchEvent(new view.Event('resize'));
    }
    return restored;
  }
}
