import {DocumentLifecycle} from './document-lifecycle.mjs';

// Shared guest/member orchestration. Core remains the only persisted session writer.
// No new journal, transport, recovery permission, timer or success validator.
export class DocumentCoordinator {
  constructor(core, { onFailure = () => {} } = {}) {
    this.core = core; this.lifecycle = new DocumentLifecycle(); this.onFailure = onFailure;
    this.tail = Promise.resolve(); this.pending = new Map(); this.disposed = false;
    this.transport = 'UNOBSERVED'; this.failures = [];
    this.readyDelivered = new Map();
  }
  enqueue(key, operation, { signal = false } = {}) {
    if (this.disposed) return Promise.reject(Error('INACTIVE_SCOPE'));
    if (this.pending.has(key)) return this.pending.get(key);
    if (this.pending.size >= 128) return Promise.reject(Error('STORE_CAPACITY'));
    const work = (signal ? Promise.resolve() : this.tail).then(() => {
      if (this.disposed) throw Error('INACTIVE_SCOPE');
      return operation();
    });
    this.pending.set(key, work);
    const observed = work.catch(error => {
      const code = /^[A-Z_]{1,64}$/.test(error.message) ? error.message : 'STORE_UNCONFIRMED';
      if (this.failures.length < 32) this.failures.push(Object.freeze({ code }));
      // Observer failures cannot turn an execution error into success.
      try { this.onFailure(code); } catch {}
    });
    if (!signal) this.tail = observed;
    work.then(() => this.pending.delete(key), () => this.pending.delete(key));
    return work;
  }
  event(kind, event) {
    if (this.disposed) return Promise.reject(Error('INACTIVE_SCOPE'));
    const captured = structuredClone(event);
    if (kind === 'READY') {
      let url;try { url = new URL(captured.url); } catch { return Promise.resolve({ accepted: false, reason: 'INVALID_READY_URL' }); }
      if (captured.documentLifecycle !== 'active' || url.protocol !== 'https:' ||
          !['youtube.com', 'www.youtube.com'].includes(url.hostname))
        return Promise.resolve({ accepted: false, reason: 'INACTIVE_OR_UNSUPPORTED_READY' });
    }
    const key = JSON.stringify([kind, captured.tabId, captured.frameId,
      captured.documentId, captured.url, captured.timeStamp]);
    if (this.pending.has(key)) return this.pending.get(key);
    // Record trusted Root receipt order before awaiting any policy operation.
    // COMMITTED/READY are observations, not permission or success acknowledgments.
    let result;
    try { result = this.lifecycle.observe(kind, captured); }
    catch (error) { return this.enqueue(key, () => { throw error; }, { signal: true }); }
    if (!result.accepted) return Promise.resolve(result);
    const signal = kind === 'READY' || kind === 'COMMITTED';
    return this.enqueue(key, async () => {
      await this.core.ready;
      if (this.disposed) throw Error('INACTIVE_SCOPE');
      if (signal || kind === 'HISTORY') {
        if (!this.lifecycle.current(captured, result)) return { accepted: false, reason: 'SUPERSEDED_DOCUMENT' };
      } else if (kind === 'BEFORE' && this.lifecycle.tabs.get(captured.tabId)?.generation !== result.generation)
        return { accepted: false, reason: 'SUPERSEDED_NAVIGATION' };
      if (kind === 'BEFORE') await this.core.navigation(captured);
      else if (kind === 'READY') {
        if (captured.documentLifecycle !== 'active') return { accepted: false, reason: 'INACTIVE_DOCUMENT' };
        const readyKey = `${captured.tabId}:${captured.documentId}`;
        const previous = this.readyDelivered.get(readyKey);
        if (previous?.generation === result.generation && previous.url === captured.url)
          return { accepted: false, reason: 'DUPLICATE_READY' };
        this.core.nativeDocumentReady(captured);
        this.readyDelivered.set(readyKey, { generation: result.generation, url: captured.url });
        if (this.readyDelivered.size > 128) this.readyDelivered.delete(this.readyDelivered.keys().next().value);
      }
      else if (kind === 'HISTORY')
        await this.core.serial(() => this.core.navigation(captured, { sameUrlHistory: true }));
      else this.core.requestCheck();
      return result;
    }, { signal });
  }
  complete(tabId) {
    // COMPLETE is a recheck signal; it does not attest Content or renew a deadline.
    return this.enqueue(`complete:${tabId}`, () => this.core.requestCheck(), { signal: true });
  }
  removed(tabId) {
    if (this.disposed) return Promise.reject(Error('INACTIVE_SCOPE'));
    try { this.lifecycle.removed(tabId); }
    catch (error) { return this.enqueue(`removed:${tabId}`, () => { throw error; }, { signal: true }); }
    return this.enqueue(`removed:${tabId}`, async () => {
      // D1 owns durable tab removal; do not create a second retirement path.
      if (!this.core.d1) await this.core.invalidate('TAB_REMOVED', tabId);
    });
  }
  connection(closed) {
    this.transport = closed ? 'DISCONNECTED' : 'CONNECTED';
    // Transport status alone is neither a session failure nor an APPLY proof.
    // Caller must still use Core's current native/ownership/effect verification.
  }
  async idle() { await this.tail; await Promise.allSettled([...this.pending.values()]); }
  dispose() { this.disposed = true; }
}

export function installDocumentCoordinator(core, chrome, { excludedDocument = () => false,
  excludedTab = () => false, onFailure } = {}) {
  const coordinator = new DocumentCoordinator(core, { onFailure });
  const listeners = [];
  const listen = (source, handler) => {
    if (!source) return;
    source.addListener(handler); listeners.push(() => source.removeListener(handler));
  };
  const route = kind => event => {
    if (excludedDocument(event)) return;
    coordinator.event(kind, event).catch(() => {}); // Recorded by enqueue, never replayed.
  };
  listen(chrome.webNavigation.onBeforeNavigate, route('BEFORE'));
  listen(chrome.webNavigation.onCommitted, route('COMMITTED'));
  listen(chrome.webNavigation.onDOMContentLoaded, route('READY'));
  listen(chrome.webNavigation.onHistoryStateUpdated, route('HISTORY'));
  listen(chrome.webNavigation.onReferenceFragmentUpdated, route('HISTORY'));
  listen(chrome.tabs.onUpdated, (tabId, change) => {
    if (change.status === 'complete' && !excludedTab(tabId)) coordinator.complete(tabId).catch(() => {});
  });
  listen(chrome.tabs.onRemoved, tabId => {
    if (!excludedTab(tabId)) coordinator.removed(tabId).catch(() => {});
  });
  return { coordinator, dispose() { for (const remove of listeners) remove(); coordinator.dispose(); } };
}
