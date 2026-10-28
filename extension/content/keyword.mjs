import { Changes } from './changes.mjs';

export const normalize = text => text.normalize('NFKC').toLowerCase();
export function matchesHost(host, entries) {
  return entries.some(entry => host === entry.host ||
    (entry.include_subdomains === true && host.endsWith('.' + entry.host)));
}

export function visibleText(document, limit = 200000) {
  const walker = document.createTreeWalker(document.body, 4);
  let text = '', truncated = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || parent.closest('input,textarea,select,option,[contenteditable]:not([contenteditable="false"]),script,style,noscript')) continue;
    let visible = true;
    for (let element = parent; element; element = element.parentElement) {
      const style = document.defaultView.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') { visible = false; break; }
    }
    if (!visible) continue;
    const value = node.nodeValue;
    if (text.length + value.length > limit) {
      text += value.slice(0, limit - text.length); truncated = true; break;
    }
    text += value;
  }
  return { text, truncated };
}

// Return only a boolean/coverage, never matching words, URL or page text.
export function inspectKeywords(document, policy) {
  const url = new URL(document.location.href);
  if (!policy.enabled || matchesHost(url.hostname, policy.exceptions)) return { blocked: false, status: 'SUPPORTED' };
  if (!['https:', 'http:'].includes(url.protocol) || document.defaultView.top !== document.defaultView)
    return { blocked: false, status: 'UNSUPPORTED' };
  let path = url.pathname + url.search;
  try { path = decodeURIComponent(path); } catch { /* compare original once */ }
  const bodyRequired = policy.rules.some(rule => rule.scopes.includes('BODY'));
  const body = bodyRequired ? visibleText(document) : { text: '', truncated: false };
  const values = { TITLE: normalize(document.title), URL: normalize(url.origin + path + url.hash), BODY: normalize(body.text) };
  const blocked = policy.rules.some(rule => rule.scopes.some(scope => values[scope]?.includes(normalize(rule.text))));
  const limited = bodyRequired && (body.truncated || Boolean(document.querySelector('iframe,frame')) ||
    [...document.querySelectorAll('*')].some(element => element.shadowRoot));
  return { blocked, status: limited ? 'UNSUPPORTED' : 'SUPPORTED', limited };
}

export class PageGate {
  constructor(document) { this.document = document; this.changes = new Changes(); }
  block() {
    if (!this.document.body) return false;
    if (!this.notice) {
      this.notice = this.document.createElement('aside');
      this.notice.setAttribute('role', 'alert');
      this.notice.textContent = 'FOCURVE: 현재 집중 정책에 따라 이 페이지가 제한되었습니다.';
      this.notice.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#fff;color:#111;padding:48px;font:20px sans-serif;display:block!important';
      this.document.documentElement.append(this.notice);
    }
    this.document.querySelectorAll('video,audio').forEach(media => media.pause());
    return this.changes.hide(this.document.body) && this.notice.isConnected &&
      this.document.defaultView.getComputedStyle(this.notice).display !== 'none';
  }
  release() {
    const confirmed = this.changes.restore();
    this.notice?.remove(); this.notice = null;
    return confirmed;
  }
}
