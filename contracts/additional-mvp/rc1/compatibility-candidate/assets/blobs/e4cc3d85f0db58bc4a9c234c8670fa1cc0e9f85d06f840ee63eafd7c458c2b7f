import { FeatureControls } from './features.mjs';
import { PageGate, inspectKeywords } from './keyword.mjs';

// Caller must supply the Core-selected site's flags and validated frozen policy.
// This is not a message listener or a session implementation.
export class ContentController {
  constructor(document, onResult = () => {}) {
    this.document = document; this.onResult = onResult;
    this.features = new FeatureControls(document); this.gate = new PageGate(document);
    this.refresh = () => {
      if (!this.options || this.timer) return;
      this.timer = this.document.defaultView.setTimeout(() => {
        this.timer = null; this.scan(false);
      }, 0);
      if (this.options.keywords?.enabled) {
        this.document.defaultView.clearTimeout(this.keywordTimer);
        this.keywordTimer = this.document.defaultView.setTimeout(() => this.scan(), 500);
      }
    };
  }
  start(options) {
    if (this.options) throw new Error('CONTENT_ALREADY_ACTIVE');
    this.options = structuredClone(options);
    this.url = this.document.location.href;
    this.observer = new this.document.defaultView.MutationObserver(this.refresh);
    this.observer.observe(this.document.documentElement, { subtree: true, childList: true,
      characterData: true, attributes: true, attributeFilter: ['href','class','style','hidden','aria-checked'] });
    for (const event of ['popstate', 'hashchange', 'yt-navigate-finish']) this.document.defaultView.addEventListener(event, this.refresh);
    this.document.defaultView.navigation?.addEventListener('currententrychange', this.refresh);
    return this.scan();
  }
  scan(inspectBody = true) {
    if (!this.options) return [];
    // Disconnect while writing our own styles to avoid self-triggered observer loops.
    this.observer.disconnect();
    try {
      if (this.url !== this.document.location.href) {
        const featuresReleased = this.features.release(), gateReleased = this.gate.release();
        if (!featuresReleased || !gateReleased)
          return this.publish([{ feature: 'release', status: 'FAILED' }]);
        this.url = this.document.location.href; this.keywordBlocked = false;
        inspectBody = true;
      }
      const results = [];
      if (this.options.siteBlocked === true) {
        // Site BLOCK is owned by Core; no feature event or success claim here.
        return this.publish([{ feature: 'site', status: 'UNSUPPORTED' }]);
      }
      if (this.options.keywords?.enabled && (inspectBody || this.keywordBlocked)) {
        const keyword = this.keywordBlocked ? { blocked: true, status: 'SUPPORTED' }
          : inspectKeywords(this.document, this.options.keywords);
        if (keyword.blocked) {
          this.keywordBlocked = true;
          keyword.applied = this.gate.block();
          if (!keyword.applied) keyword.status = 'FAILED';
        }
        results.push({ feature: 'keywords', ...keyword });
      }
      if (!this.keywordBlocked) results.push(...this.features.apply(this.options.features ?? {}));
      return this.publish(results);
    } finally {
      if (this.options) this.observer.observe(this.document.documentElement, { subtree: true, childList: true,
        characterData: true, attributes: true, attributeFilter: ['href','class','style','hidden','aria-checked'] });
    }
  }
  publish(results) { this.onResult(results); return results; }
  release() {
    this.observer?.disconnect();
    const window = this.document.defaultView;
    window.clearTimeout(this.timer); this.timer = null;
    window.clearTimeout(this.keywordTimer); this.keywordTimer = null;
    for (const event of ['popstate','hashchange','yt-navigate-finish']) window.removeEventListener(event, this.refresh);
    window.navigation?.removeEventListener('currententrychange', this.refresh);
    this.options = null; this.keywordBlocked = false;
    const features = this.features.release(), gate = this.gate.release();
    return features && gate;
  }
}
