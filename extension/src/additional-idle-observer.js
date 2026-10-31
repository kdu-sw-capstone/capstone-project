/** Worker-local C11 observation adapter. Observations are not trusted clock anchors
 * or proof that a DNR restriction took effect. Consumers settle intervals at each
 * boundary and quarantine unobserved tails; never subtract the first 60 seconds.
 */
export class AdditionalIdleObserver {
  constructor({ idle, permissions, onObservation, now = () => performance.now() }) {
    this.idle = idle;
    this.permissions = permissions;
    this.emit = onObservation;
    this.now = now;
    this.generation = 0;
    this.sequence = 0;
    this.running = false;
    this.state = 'UNAVAILABLE';
    this.onState = state => { if (this.running) this.publish(state); };
    this.onRemoved = change => {
      if (this.running && change.permissions?.includes('idle')) {
        this.generation++;
        this.idle?.onStateChanged?.removeListener?.(this.onState);
        this.publish('UNAVAILABLE');
      }
    };
  }
  publish(state) {
    if (!['active', 'idle', 'locked'].includes(state)) state = 'UNAVAILABLE';
    this.state = state;
    this.sequence++;
    this.emit(Object.freeze({
      sequence: this.sequence, state, observedMonoMs: this.now(),
      quality: state === 'UNAVAILABLE' ? 'UNKNOWN' : 'OBSERVED',
      thresholdSeconds: 60,
      // Only a candidate collection condition, not authority to count time.
      collectionEligible: state === 'active',
      requiresLimitedSiteHold: state === 'UNAVAILABLE'
    }));
  }
  async start() {
    this.stop();
    this.running = true;
    const generation = ++this.generation;
    this.publish('UNAVAILABLE');
    try {
      if (!this.idle?.queryState || !this.idle?.setDetectionInterval
        || !this.idle?.onStateChanged?.addListener || !this.permissions?.contains
        || !this.permissions?.onRemoved?.addListener) throw Error('IDLE_UNAVAILABLE');
      this.permissions.onRemoved.addListener(this.onRemoved);
      if (!await this.permissions.contains({ permissions: ['idle'] })) throw Error('IDLE_UNAVAILABLE');
      if (!this.running || generation !== this.generation) return;
      this.idle.setDetectionInterval(60);
      this.idle.onStateChanged.addListener(this.onState);
      const sequence = this.sequence;
      const state = await this.idle.queryState(60);
      // A delayed initial query must not overwrite a newer state event.
      if (this.running && generation === this.generation && sequence === this.sequence) this.publish(state);
    } catch {
      if (this.running && generation === this.generation) {
        this.idle?.onStateChanged?.removeListener?.(this.onState);
        this.publish('UNAVAILABLE');
      }
    }
  }
  stop() {
    this.running = false;
    this.generation++;
    this.idle?.onStateChanged?.removeListener?.(this.onState);
    this.permissions?.onRemoved?.removeListener?.(this.onRemoved);
  }
}
