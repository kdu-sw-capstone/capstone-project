import test from 'node:test';
import assert from 'node:assert/strict';
import { AdditionalForegroundObserver } from '../src/additional-foreground-observer.js';
const event = () => {
  const listeners = new Set();
  return { addListener: f => listeners.add(f), removeListener: f => listeners.delete(f),
    fire: (...args) => [...listeners].forEach(f => f(...args)), size: () => listeners.size };
};
const flush = () => new Promise(resolve => setImmediate(resolve));
function setup() {
  const boundaries = [];
  const win = { id: 1, focused: true, type: 'normal' };
  const tab = { id: 10, windowId: 1, active: true, url: 'https://example.com/private?q=secret' };
  const windows = { getLastFocused: async () => ({ ...win }), onFocusChanged: event(), onRemoved: event() };
  const tabs = { query: async () => [{ ...tab }] };
  for (const name of ['onActivated','onUpdated','onRemoved','onReplaced','onAttached','onDetached']) tabs[name] = event();
  const idle = { queryState: async () => 'active', setDetectionInterval() {}, onStateChanged: event() };
  const permissions = { contains: async () => true, onRemoved: event() };
  const observer = new AdditionalForegroundObserver({ windows, tabs, idle, permissions,
    onBoundary: b => boundaries.push(b), now: () => 123 });
  return { observer, boundaries, win, tab, windows, tabs, idle, permissions };
}
test('single foreground candidate exposes host only and never confirms duration', async () => {
  const h = setup(); await h.observer.start();
  assert.equal(h.boundaries.at(-1).status, 'CANDIDATE');
  assert.deepEqual(h.boundaries.at(-1).target, { windowId: 1, tabId: 10, host: 'example.com' });
  assert.equal(h.boundaries.at(-1).priorTailRequiresValidation, true);
  h.observer.stop(); assert.equal(h.boundaries.at(-1).collectionEligible, false);
});
test('focus loss, internal page and idle exclude collection', async () => {
  const h = setup(); await h.observer.start();
  h.win.focused = false; await h.observer.refresh(); assert.equal(h.boundaries.at(-1).status, 'INELIGIBLE');
  h.win.focused = true; h.tab.url = 'chrome://settings'; await h.observer.refresh();
  assert.equal(h.boundaries.at(-1).status, 'INELIGIBLE');
  h.idle.onStateChanged.fire('idle'); await flush(); assert.equal(h.boundaries.at(-1).status, 'INELIGIBLE');
});
test('permission removal immediately prevents foreground collection', async () => {
  const h = setup(); await h.observer.start(); h.permissions.onRemoved.fire({ permissions: ['idle'] });
  await flush(); assert.equal(h.boundaries.at(-1).requiresLimitedSiteHold, true);
});
test('tab event invalidates pending query, including same-host tab switch', async () => {
  const h = setup(); await h.observer.start(); let resolve;
  h.tabs.query = () => new Promise(r => { resolve = r; });
  const old = h.observer.refresh(); await Promise.resolve();
  h.tab.id = 11; h.tabs.query = async () => [{ ...h.tab }]; h.tabs.onActivated.fire({ tabId: 11 });
  assert.equal(h.boundaries.at(-1).status, 'UNKNOWN');
  await flush(); resolve([{ ...h.tab, id: 10 }]); await old;
  assert.equal(h.boundaries.at(-1).target.tabId, 11);
});
test('API failure, missing URL, pending navigation and ambiguous result stay unknown', async () => {
  for (const kind of ['error','url','pending','duplicate']) {
    const h = setup();
    if (kind === 'error') h.tabs.query = async () => { throw Error('denied'); };
    if (kind === 'url') delete h.tab.url;
    if (kind === 'pending') h.tab.pendingUrl = 'https://new.example';
    if (kind === 'duplicate') h.tabs.query = async () => [h.tab, h.tab];
    await h.observer.start(); assert.equal(h.boundaries.at(-1).status, 'UNKNOWN');
  }
});
test('focus change during tab lookup cannot produce candidate', async () => {
  const h = setup(); await h.observer.start();
  h.tabs.query = async () => { h.win.focused = false; return [h.tab]; };
  await h.observer.refresh(); assert.equal(h.boundaries.at(-1).status, 'UNKNOWN');
});
test('stop discards pending read and restart does not duplicate event listeners', async () => {
  const h = setup(); await h.observer.start(); let resolve;
  h.tabs.query = () => new Promise(r => { resolve = r; });
  const reading = h.observer.refresh(); await Promise.resolve(); h.observer.stop();
  const count = h.boundaries.length; resolve([h.tab]); await reading;
  assert.equal(h.boundaries.length, count);
  h.tabs.query = async () => [h.tab]; await h.observer.start(); await h.observer.start();
  assert.equal(h.tabs.onActivated.size(), 1); assert.equal(h.windows.onFocusChanged.size(), 1);
});

test('older startup cannot reopen stopped observation', async () => {
  const h = setup(); let resolve;
  h.permissions.contains = () => new Promise(r => { resolve = r; });
  const starting = h.observer.start(); h.observer.stop(); const count = h.boundaries.length;
  resolve(true); await starting; assert.equal(h.boundaries.length, count);
  assert.equal(h.tabs.onActivated.size(), 0);
});

test('URL permission revocation fences pending tab reads until explicit verified restart', async () => {
  for (const change of [{permissions:['tabs']},{origins:['<all_urls>']}]) {
    const h=setup(); await h.observer.start(); let resolve;
    h.tabs.query=()=>new Promise(r=>{resolve=r;});
    const reading=h.observer.refresh(); await Promise.resolve();
    const revision=h.boundaries.at(-1).revision;
    h.permissions.onRemoved.fire(change);
    assert.ok(h.boundaries.at(-1).revision>revision);
    resolve([h.tab]); await reading;
    assert.equal(h.boundaries.at(-1).status,'UNKNOWN');
    h.tabs.query=async()=>[h.tab]; await h.observer.refresh();
    assert.equal(h.boundaries.at(-1).status,'UNKNOWN');
    h.permissions.contains=async q=>q.permissions?.[0]==='idle';
    await h.observer.start(); assert.equal(h.boundaries.at(-1).status,'UNKNOWN');
    h.permissions.contains=async()=>true;
    await h.observer.start(); assert.equal(h.boundaries.at(-1).status,'CANDIDATE');
  }
});
test('revocation while current URL permission check is pending cannot publish stale candidate', async () => {
  const h=setup(); await h.observer.start(); let resolve;
  h.permissions.contains=()=>new Promise(r=>{resolve=r;});
  const reading=h.observer.refresh(); await Promise.resolve(); await Promise.resolve();
  h.permissions.onRemoved.fire({origins:['https://example.com/*']});
  resolve(true); await reading; assert.equal(h.boundaries.at(-1).status,'UNKNOWN');
});
test('origin grant can authorize observation without tabs grant', async()=>{
  const h=setup();h.permissions.contains=async q=>q.permissions?.[0]==='idle'||q.origins?.[0]==='https://example.com/*';
  await h.observer.start();assert.equal(h.boundaries.at(-1).status,'CANDIDATE');
});
