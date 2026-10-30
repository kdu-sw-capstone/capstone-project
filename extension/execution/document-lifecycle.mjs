// Root event bookkeeping only. This model never grants APPLY, RELEASE or RUNNING.
export class DocumentLifecycle {
  constructor() { this.documents = new Map(); this.tabs = new Map(); }
  observe(kind, event) {
    if (event.frameId !== 0) return { accepted: false, reason: 'SUBFRAME' };
    if (!Number.isInteger(event.tabId) || event.tabId < 0 ||
        !Number.isFinite(event.timeStamp) || event.timeStamp < 0)
      throw Error('INVALID_SCHEMA');
    const tab = this.tabs.get(event.tabId);
    if (tab && event.timeStamp < tab.at) return { accepted: false, reason: 'STALE_EVENT' };
    if (kind === 'BEFORE') {
      if (!tab && this.tabs.size >= 128) throw Error('STORE_CAPACITY');
      // A pending navigation is not proof that the original document is gone.
      const generation = (tab?.generation ?? 0) + 1;
      this.tabs.set(event.tabId, { ...tab, at: event.timeStamp, pending: true, generation });
      return { accepted: true, phase: 'NAVIGATION_PENDING', generation };
    }
    if (!['COMMITTED', 'READY', 'HISTORY'].includes(kind) ||
        typeof event.documentId !== 'string' || !event.documentId ||
        event.documentId.length > 128 || typeof event.url !== 'string')
      throw Error('INVALID_SCHEMA');
    if (kind !== 'COMMITTED' && tab?.documentId && tab.documentId !== event.documentId)
      return { accepted: false, reason: 'OTHER_DOCUMENT' };
    // READY from the outgoing document cannot cancel an outstanding navigation.
    // Only a Root COMMITTED event closes that pending navigation boundary.
    if (kind !== 'COMMITTED' && tab?.pending)
      return { accepted: false, reason: 'NAVIGATION_PENDING' };
    const key = `${event.tabId}:${event.documentId}`;
    if (!this.documents.has(key) && this.documents.size >= 128) throw Error('STORE_CAPACITY');
    if (!tab && this.tabs.size >= 128) throw Error('STORE_CAPACITY');
    if (kind === 'COMMITTED' && tab?.documentId && tab.documentId !== event.documentId) {
      const previous = this.documents.get(`${event.tabId}:${tab.documentId}`);
      if (previous) previous.phase = 'REPLACED_ROOT_OBSERVED';
      // Persisted Binding retirement still requires the existing Core contract.
    }
    const prior = this.documents.get(key);
    if (kind !== 'COMMITTED' && prior &&
        ['REPLACED_ROOT_OBSERVED', 'TAB_REMOVED_ROOT_OBSERVED'].includes(prior.phase))
      return { accepted: false, reason: 'RETIRED_DOCUMENT' };
    if (kind === 'READY' && prior && prior.url !== event.url)
      return { accepted: false, reason: 'OTHER_DOCUMENT_URL' };
    // This is an observer epoch, not Core's authority generation. Only Root
    // navigation receipt changes it; it cannot grant APPLY or extend NR time.
    const generation = !tab ? 1 : kind === 'COMMITTED' ?
      (tab.generation ?? 0) + (!tab.pending && tab.documentId !== event.documentId ? 1 : 0) :
      (tab.generation ?? 0) + (kind === 'HISTORY' && prior?.url !== event.url ? 1 : 0);
    const phase = kind === 'READY' ? 'READY_ROOT_OBSERVED' :
      kind === 'HISTORY' ? 'POLICY_REEVALUATION_REQUIRED' :
      // Only a duplicate commit of the current document retains readiness.
      // A previously replaced document can become current again (e.g. a
      // history activation with no observed BEFORE); its old phase/READY is
      // neither current readiness nor a reason to suppress the Root recheck.
      prior && tab?.documentId === event.documentId && !tab.pending && prior.url === event.url ? prior.phase : 'COMMITTED_NOT_READY';
    this.documents.set(key, { ...prior, tabId: event.tabId, frameId: 0,
      documentId: event.documentId, url: event.url, phase, at: event.timeStamp, generation });
    this.tabs.set(event.tabId, { documentId: event.documentId, at: event.timeStamp, pending: false, generation });
    return { accepted: true, phase, generation };
  }
  current(event, observation) {
    const tab = this.tabs.get(event.tabId), doc = this.documents.get(`${event.tabId}:${event.documentId}`);
    return !!tab && !tab.pending && tab.documentId === event.documentId &&
      tab.generation === observation.generation && doc?.url === event.url &&
      !['REPLACED_ROOT_OBSERVED', 'TAB_REMOVED_ROOT_OBSERVED'].includes(doc.phase);
  }
  removed(tabId) {
    if (!Number.isInteger(tabId) || tabId < 0) throw Error('INVALID_SCHEMA');
    for (const document of this.documents.values())
      if (document.tabId === tabId) document.phase = 'TAB_REMOVED_ROOT_OBSERVED';
    this.tabs.delete(tabId);
  }
}
