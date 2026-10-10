import { Changes } from './changes.mjs';
import { featureEntry } from './entry.mjs';

const YOUTUBE = new Set(['youtube.com', 'www.youtube.com']);
const INSTAGRAM = new Set(['instagram.com', 'www.instagram.com']);
const SELECTORS = {
  shorts: 'ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts], a[href^="/shorts/"]',
  recommendations: 'ytd-browse[page-subtype="home"] #contents, ytd-watch-flexy #related',
  comments: 'ytd-watch-flexy ytd-comments',
};

// Internal library API only. No Core wire format, credentials, storage or session state.
export class FeatureControls {
  constructor(document) {
    this.document = document;
    this.changes = new Changes();
    this.autoplay = new Map();
  }
  apply(flags) {
    const url = new URL(this.document.location.href);
    const results = [];
    const youtube = YOUTUBE.has(url.hostname) && url.protocol === 'https:';
    const instagram = INSTAGRAM.has(url.hostname) && url.protocol === 'https:';
    const entry = featureEntry(url.href);
    for (const feature of ['shorts', 'recommendations', 'comments', 'reels', 'autoplay']) {
      if (flags[feature] !== true) continue;
      const result = { feature, status: 'UNSUPPORTED', changed: 0 };
      try {
        if (youtube && feature in SELECTORS) {
          let selector = SELECTORS[feature];
          if (feature === 'shorts' && entry === 'YOUTUBE_SHORTS')
            selector += ', ytd-shorts';
          const elements = [...this.document.querySelectorAll(selector)];
          result.status = elements.length ? 'SUPPORTED' : 'FAILED';
          for (const element of elements) {
            if (!this.changes.hide(element)) result.status = 'FAILED';
            else result.changed++;
            if (feature === 'shorts' && element.matches('ytd-shorts'))
              element.querySelectorAll('video').forEach(video => video.pause());
          }
          // A link/shelf alone cannot prove that a directly opened Shorts player is blocked.
          if (feature === 'shorts' && entry === 'YOUTUBE_SHORTS' &&
              !this.document.querySelector('ytd-shorts')) result.status = 'FAILED';
        } else if (instagram && feature === 'reels') {
          if (entry === 'INSTAGRAM_REELS') {
            const main = this.document.querySelector('main');
            result.status = main && main.querySelector('video') && this.changes.hide(main) ? 'SUPPORTED' : 'FAILED';
            if (result.status === 'SUPPORTED') {
              main.querySelectorAll('video').forEach(video => video.pause());
              result.changed = 1;
            }
          } else result.status = 'FAILED';
        } else if (youtube && feature === 'autoplay') {
          const toggle = this.document.querySelector('.ytp-autonav-toggle-button[aria-checked]');
          result.status = 'FAILED';
          if (toggle) {
            const checked = toggle.getAttribute('aria-checked');
            if (checked === 'true' && !this.autoplay.has(toggle)) {
              this.autoplay.set(toggle, true);
              toggle.click();
            }
            if (toggle.getAttribute('aria-checked') === 'false') result.status = 'SUPPORTED';
          }
        }
      } catch { result.status = 'FAILED'; }
      results.push(result);
    }
    return results;
  }
  release() {
    let confirmed = this.changes.restore();
    for (const [toggle] of this.autoplay) {
      try {
        if (toggle.getAttribute('aria-checked') === 'false') toggle.click();
        if (toggle.getAttribute('aria-checked') !== 'true') { confirmed = false; continue; }
        this.autoplay.delete(toggle);
      } catch { confirmed = false; }
    }
    return confirmed;
  }
}
