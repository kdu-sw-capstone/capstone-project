import { AdditionalIdleObserver } from './additional-idle-observer.js';

/** Internal Worker adapter. Emits boundaries, never confirmed usage or Wire claims.
 * Browser queries are not an atomic snapshot: every relevant event invalidates
 * outstanding reads and publishes an UNKNOWN boundary before querying again.
 */
export class AdditionalForegroundObserver {
  constructor({ tabs, windows, idle, permissions, onBoundary, now = () => performance.now() }) {
    this.tabs = tabs;
    this.windows = windows;
    this.permissions = permissions;
    this.accessRevoked = false;
    this.emit = onBoundary;
    this.now = now;
    this.running = false;
    this.lifecycle = 0;
    this.revision = 0;
    this.listeners = [];
    this.idleState = 'UNAVAILABLE';
    this.idleObserver = new AdditionalIdleObserver({ idle, permissions, now,
      onObservation: observation => {
        this.idleState = observation.state;
        if (this.running) void this.refresh('IDLE');
      } });
  }
  publish(reason, status, target = null) {
    this.emit(Object.freeze({ revision: this.revision, observedMonoMs: this.now(),
      reason, status, target: target && Object.freeze(target),
      collectionEligible: status === 'CANDIDATE',
      requiresLimitedSiteHold: status === 'UNKNOWN',
      // Callback time cannot prove when the OS/browser transition really happened.
      priorTailRequiresValidation: true }));
  }
  async refresh(reason = 'RECHECK') {
    if (!this.running) return;
    const revision = ++this.revision;
    const current = () => this.running && revision === this.revision;
    this.publish(reason, 'UNKNOWN');
    if (this.accessRevoked || this.idleState === 'UNAVAILABLE') return;
    if (this.idleState !== 'active') { this.publish(reason, 'INELIGIBLE'); return; }
    try {
      const win = await this.windows.getLastFocused();
      if (!current()) return;
      if (!win?.focused || !Number.isInteger(win.id) || win.id < 0
        || !['normal', 'popup'].includes(win.type)) {
        this.publish(reason, 'INELIGIBLE'); return;
      }
      const tabs = await this.tabs.query({ active: true, windowId: win.id });
      if (!current()) return;
      if (!Array.isArray(tabs) || tabs.length !== 1) throw Error('AMBIGUOUS_ACTIVE_TAB');
      const tab = tabs[0];
      if (!Number.isInteger(tab.id) || tab.id < 0 || tab.windowId !== win.id || tab.active !== true
        || tab.discarded || tab.pendingUrl || typeof tab.url !== 'string') throw Error('TAB_UNCONFIRMED');
      const url = new URL(tab.url);
      if (!['http:', 'https:'].includes(url.protocol)) { this.publish(reason, 'INELIGIBLE'); return; }
      const tabsAccess = await this.permissions.contains({ permissions: ['tabs'] });
      if (!current()) return;
      if (!tabsAccess && !await this.permissions.contains({ origins: [`${url.protocol}//${url.hostname}/*`] })) throw Error('URL_PERMISSION_UNAVAILABLE');
      if (!current()) return;
      // Recheck focus after tab lookup; an event racing either read wins via revision.
      const after = await this.windows.getLastFocused();
      if (!current()) return;
      if (!after?.focused || after.id !== win.id || after.type !== win.type) throw Error('FOCUS_CHANGED');
      this.publish(reason, 'CANDIDATE', { windowId: win.id, tabId: tab.id, host: url.hostname });
    } catch {
      if (current()) this.publish(reason, 'UNKNOWN');
    }
  }
  async start() {
    this.stop();
    this.running = true;
    const lifecycle = this.lifecycle;
    this.idleState = 'UNAVAILABLE';
    this.accessRevoked = false;
    try {
      const events = [this.windows?.onFocusChanged, this.windows?.onRemoved,
        this.tabs?.onActivated, this.tabs?.onUpdated, this.tabs?.onRemoved,
        this.tabs?.onReplaced, this.tabs?.onAttached, this.tabs?.onDetached];
      if (!this.windows?.getLastFocused || !this.tabs?.query
        || events.some(event => !event?.addListener || !event?.removeListener)) throw Error('API_UNAVAILABLE');
      const removed = this.permissions?.onRemoved;
      if (!removed?.addListener || !removed?.removeListener) throw Error('API_UNAVAILABLE');
      const onRemoved = change => {
        if (!this.running || !(change.permissions?.includes('tabs') || change.origins?.length)) return;
        // Require an explicit restart and fresh current-context access check.
        this.accessRevoked = true;
        ++this.revision;
        this.publish('URL_PERMISSION_REMOVED', 'UNKNOWN');
      };
      removed.addListener(onRemoved);
      this.listeners.push([removed, onRemoved]);
      for (const event of events) {
        const listener = () => { void this.refresh('BROWSER_EVENT'); };
        event.addListener(listener);
        this.listeners.push([event, listener]);
      }
      await this.idleObserver.start();
      if (!this.running || lifecycle !== this.lifecycle) return;
      await this.refresh('START');
    } catch {
      if (!this.running || lifecycle !== this.lifecycle) return;
      this.stop();
      this.publish('START_FAILED', 'UNKNOWN');
    }
  }
  stop() {
    const wasRunning = this.running;
    this.lifecycle++;
    this.running = false;
    this.revision++;
    this.idleObserver.stop();
    for (const [event, listener] of this.listeners) event.removeListener(listener);
    this.listeners = [];
    if (wasRunning) this.publish('STOP', 'UNKNOWN');
  }
}
