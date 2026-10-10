import { Changes } from './changes.mjs';
import { featureEntry } from './entry.mjs';

// DOM adapter only: no policy selection, session state or access event generation.
export class ShortsControl {
  constructor(document) {
    this.document = document;
    this.changes = new Changes();
    this.onPlay = event => {
      if (this.active && featureEntry(document.location.href) === 'YOUTUBE_SHORTS' &&
          event.target.matches?.('video') && event.target.closest('ytd-shorts')) event.target.pause();
    };
  }
  apply() {
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
    let changed = 0, status = elements.size ? 'SUPPORTED' : 'FAILED';
    for (const element of elements) {
      try {
        if (this.changes.hide(element)) changed++; else status = 'FAILED';
        if (direct && element.matches('ytd-shorts')) {
          for (const video of element.querySelectorAll('video')) {
            video.pause();
            if (!video.paused) status = 'FAILED';
          }
        }
      } catch { status = 'FAILED'; }
    }
    if (direct) {
      if (!viewers.length) status = 'FAILED';
      if (!this.notice?.isConnected) {
        this.notice = this.document.createElement('aside');
        this.notice.setAttribute('role','status');
        this.notice.textContent = 'FOCURVE: Shorts 제한 중입니다. 일반 영상으로 이동할 수 있습니다.';
        this.notice.style.cssText = 'position:fixed;bottom:24px;left:24px;z-index:2147483647;padding:16px;background:#fff;color:#111;border:1px solid #999;font:16px sans-serif';
        this.document.documentElement.append(this.notice);
      }
      if (!viewers.length || status === 'FAILED') this.notice.textContent = 'FOCURVE: Shorts 제한을 확인하지 못했습니다. 감지 상태를 확인하세요.';
      else this.notice.textContent = 'FOCURVE: Shorts 제한 중입니다. 일반 영상으로 이동할 수 있습니다.';
    } else { this.notice?.remove(); this.notice = null; }
    return {feature:'shorts',status,changed};
  }
  release() {
    this.active = false;
    this.document.removeEventListener('play',this.onPlay,true);
    this.notice?.remove(); this.notice = null;
    return this.changes.restore();
  }
}
