import { AdditionalForegroundObserver } from './additional-foreground-observer.js';

/** Internal staging runtime: OBSERVING means observations are being saved, not
 * trusted measurement, confirmed usage, or an applied quota restriction.
 */
export class AdditionalTimeRuntime {
  constructor({ journal, browser, onStatus = () => {}, now, maxPending = 128,
    createObserver = options => new AdditionalForegroundObserver(options) }) {
    if (!Number.isSafeInteger(maxPending) || maxPending < 1) throw Error('INVALID_QUEUE_CAPACITY');
    this.journal = journal;
    this.maxPending = maxPending;
    this.onStatus = onStatus;
    this.state = 'STOPPED';
    this.queue = [];
    this.failure = null;
    this.generation = 0;
    this.draining = null;
    this.starting = false;
    this.observer = createObserver({ ...browser, now, onBoundary: b => this.capture(b) });
  }
  status(state) {
    this.state = state;
    this.onStatus(Object.freeze({ state, pending: this.queue.length,
      measurementQuality: 'UNKNOWN', requiresLimitedSiteHold: true,
      failure: this.failure?.message ?? null }));
  }
  fail(error) {
    if (this.failure) return;
    this.failure = error instanceof Error ? error : Error('CAPTURE_FAILED');
    this.status('FAILED');
    // FAILED prevents the observer's STOP boundary from recursively queuing work.
    this.observer.stop();
  }
  capture(boundary) {
    if (!['STARTING','OBSERVING','STOPPING'].includes(this.state) || this.failure) return;
    try {
      if (this.queue.length >= this.maxPending) throw Error('OBSERVATION_QUEUE_EXHAUSTED');
      this.queue.push({ id: crypto.randomUUID(), epoch: this.epoch, boundary: structuredClone(boundary) });
      this.drain();
    } catch (error) { this.fail(error); }
  }
  drain() {
    if (this.draining || this.failure) return;
    this.draining = this.runQueue().finally(() => {
      this.draining = null;
      if (this.queue.length && !this.failure) this.drain();
    });
  }
  async runQueue() {
    while (this.queue.length && !this.failure) {
      const item = this.queue[0];
      try {
        await this.journal.append(item.epoch, item.id, item.boundary);
        // Remove only after durable append succeeds, even if stop/failure raced it.
        this.queue.shift();
      } catch (error) { this.fail(error); }
    }
  }
  async flush() {
    while (this.draining) await this.draining;
    if (this.failure) throw this.failure;
  }
  async start(context) {
    if (this.state !== 'STOPPED' || this.failure || this.starting) throw Error('RUNTIME_NOT_STOPPED');
    this.starting = true;
    const generation = ++this.generation;
    this.status('STARTING');
    try {
      const epoch = await this.journal.start(context);
      if (generation !== this.generation) return;
      this.epoch = epoch;
      await this.observer.start();
      if (generation !== this.generation) return;
      await this.flush();
      if (generation === this.generation && !this.failure) this.status('OBSERVING');
    } catch (error) {
      if (generation === this.generation) this.fail(error);
      throw error;
    } finally { this.starting = false; }
  }
  async stop() {
    ++this.generation;
    if (!this.failure) this.status('STOPPING');
    this.observer.stop();
    await this.flush();
    this.status('STOPPED');
  }
}
