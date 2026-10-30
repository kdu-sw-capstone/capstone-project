import { ClaimLedger } from './claim-ledger.mjs';

// Initial watch-page adapter; this is not an AMVP wire receiver or capability
// advertisement. Core must validate scope and persist intent before calling it.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SELECTORS = Object.freeze({
  'YT-03': 'ytd-watch-flexy ytd-comments, ytd-watch-flexy ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-comments-section"]',
  'YT-04': 'ytd-watch-flexy #related',
});

export class WatchPanelSession {
  #document;
  #ledger;
  #features;
  #claims;
  #active;
  #url;
  #open = false;
  #started = false;
  #scheduled = false;
  #observer;
  #onObservation;
  #onInvalidated;

  constructor(document, { ledger, owner_binding_id, binding_id, features, onObservation = () => {}, onInvalidated = () => {} }) {
    if (!(ledger instanceof ClaimLedger)) throw Error('SHARED_LEDGER_REQUIRED');
    if (!UUID.test(owner_binding_id ?? '') || !UUID.test(binding_id ?? '')) throw Error('INVALID_CLAIM_SCOPE');
    if (!Array.isArray(features) || features.length === 0) throw Error('EMPTY_WATCH_FEATURES');
    const ids = new Set();
    for (const feature of features) {
      if (!feature || !Object.hasOwn(SELECTORS, feature.feature_id) || typeof feature.enabled !== 'boolean' || feature.required !== true)
        throw Error('UNSUPPORTED_WATCH_FEATURE');
      if (ids.has(feature.feature_id)) throw Error('DUPLICATE_WATCH_FEATURE');
      ids.add(feature.feature_id);
    }
    this.#document = document; this.#ledger = ledger;
    this.#features = Object.freeze(features.map(feature => Object.freeze({ feature_id: feature.feature_id, enabled: feature.enabled })));
    this.#claims = new Map(this.#features.map(feature => [feature.feature_id, JSON.stringify([owner_binding_id, binding_id, feature.feature_id])]));
    this.#active = new Set(this.#features.filter(feature => feature.enabled).map(feature => feature.feature_id));
    this.#onObservation = onObservation; this.#onInvalidated = onInvalidated;
    this.refresh = () => {
      if (!this.#open || this.#scheduled) return;
      this.#scheduled = true;
      queueMicrotask(() => { this.#scheduled = false; if (this.#open) this.scan(); });
    };
    this.pagehide = () => this.#invalidate('PAGEHIDE');
  }

  start() {
    if (this.#started) throw Error('WATCH_SESSION_ALREADY_STARTED');
    const url = new URL(this.#document.location.href);
    if (this.#document.defaultView.top !== this.#document.defaultView || url.protocol !== 'https:' || !['youtube.com', 'www.youtube.com'].includes(url.hostname) || url.port || url.username || url.password || url.pathname !== '/watch')
      throw Error('UNSUPPORTED_WATCH_DOCUMENT');
    this.#started = true; this.#url = url.href;
    if (!this.#active.size) return [];
    this.#observer = new this.#document.defaultView.MutationObserver(this.refresh);
    this.#open = true;
    const window = this.#document.defaultView;
    for (const event of ['popstate', 'hashchange', 'yt-navigate-finish']) window.addEventListener(event, this.refresh);
    window.navigation?.addEventListener('currententrychange', this.refresh);
    window.addEventListener('pagehide', this.pagehide);
    return this.scan();
  }

  #disconnect() {
    this.#observer?.disconnect();
    const window = this.#document.defaultView;
    for (const event of ['popstate', 'hashchange', 'yt-navigate-finish']) window.removeEventListener(event, this.refresh);
    window.navigation?.removeEventListener('currententrychange', this.refresh);
    window.removeEventListener('pagehide', this.pagehide);
  }

  #invalidate(reason) {
    if (!this.#open) return;
    this.#open = false; this.#disconnect();
    // Do not assume a route change/pagehide proves release or document death.
    this.#onInvalidated({ local_only: true, reason, cleanup_pending: [...this.#active].some(id => this.#ledger.inspect(this.#claims.get(id)).remaining_targets > 0) });
  }

  scan() {
    if (!this.#open) return [];
    if (this.#document.location.href !== this.#url) { this.#invalidate('ROUTE_CHANGED'); return []; }
    this.#observer.disconnect();
    const results = [];
    for (const feature_id of this.#active) {
      let eligible = 0, restricted = 0, errors = 0;
      try {
        const targets = [...this.#document.querySelectorAll(SELECTORS[feature_id])];
        eligible = targets.length;
        for (const element of targets) {
          if (this.#ledger.hide(this.#claims.get(feature_id), element)) restricted++;
          else errors++;
        }
      } catch { errors++; }
      results.push({ feature_id, local_only: true, native_verified: false,
        status: errors ? 'FAILED' : eligible ? 'OBSERVED' : 'NO_TARGET',
        eligible_target_count: eligible, restricted_target_count: restricted, error_count: errors });
    }
    if (this.#open && this.#active.size) this.#observer.observe(this.#document.documentElement, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ['class', 'id', 'style', 'inert', 'hidden', 'target-id'],
    });
    // This local observation is deliberately NOT ContentResult/APPLIED. The Core
    // adapter must add issued-operation/profile/scan/native and durable evidence.
    this.#onObservation(results);
    return results;
  }

  releaseFeature(feature_id) {
    if (!this.#claims.has(feature_id)) throw Error('UNOWNED_WATCH_FEATURE');
    const result = this.#ledger.release(this.#claims.get(feature_id));
    if (result.restored) this.#active.delete(feature_id);
    if (!this.#active.size) { this.#open = false; this.#disconnect(); }
    return { feature_id, local_only: true, ...result };
  }

  release() { return [...this.#active].map(id => this.releaseFeature(id)); }
}
