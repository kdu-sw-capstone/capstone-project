// Document-local effect primitive. The verified caller owns policy selection,
// durable intent/receipt, native binding, and the Core wire evidence envelope.
// Sharing this ledger is required when independent options own the same node.
export class ClaimLedger {
  #document;
  #entries = new Map();
  #open = true;
  #busy = false;

  constructor(document) { this.#document = document; }

  // A lifecycle invalidation never grants a new document authority. Cleanup of
  // this exact document remains possible after new effects have been closed.
  suspend() { this.#open = false; }

  hide(claim, element, canApply = () => true) { return this.#acquire(claim, element, ['display', 'inert'], canApply); }
  grayscale(claim, element, canApply = () => true) { return this.#acquire(claim, element, ['filter'], canApply); }

  #read(element, property) {
    if (property === 'inert') return { value: element.inert };
    return { value: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property) };
  }

  #equal(a, b) { return a.value === b.value && a.priority === b.priority; }

  #write(element, property, state) {
    if (property === 'inert') element.inert = state.value;
    else if (state.value) element.style.setProperty(property, state.value, state.priority);
    else element.style.removeProperty(property);
  }

  #restricted(property, original, filterBase) {
    if (property === 'inert') return { value: true };
    if (property === 'display') return { value: 'none', priority: 'important' };
    const base = filterBase.trim();
    return { value: `${base && base !== 'none' ? base + ' ' : ''}grayscale(1)`, priority: 'important' };
  }

  #apply(element, property, entry, canApply = () => true) {
    if (element.ownerDocument !== this.#document || canApply() !== true) return false;
    if (entry.pending?.kind === 'RESTORE') return false;
    const current = this.#read(element, property);
    // A page edit is the new baseline; never adopt another claim's owned value.
    const changed = !entry.pending && entry.written && !this.#equal(current, entry.written);
    if (changed) entry.original = current;
    // Preserve the original declaration (including variables) for cleanup, but
    // compose from its resolved value so `var(--x) -> none` stays valid CSS.
    // Reuse this baseline while owned to avoid accumulating our own grayscale.
    if (property === 'filter' && ((!entry.written && !entry.pending) || changed)) {
      entry.filterBase = this.#document.defaultView.getComputedStyle(element).filter;
      if (typeof entry.filterBase !== 'string' || !entry.filterBase) return false;
    }
    const next = entry.pending?.target ?? this.#restricted(property, entry.original, entry.filterBase);
    // Record intended ownership before the setter: a setter can mutate then throw.
    entry.written = next;
    entry.pending = {kind:'APPLY',target:next};
    if (canApply() !== true || element.ownerDocument !== this.#document) return false;
    if (!this.#equal(current, next)) this.#write(element, property, next);
    if (canApply() !== true || element.ownerDocument !== this.#document) return false;
    const written = this.#equal(this.#read(element, property), next);
    const verified = property === 'filter'
      ? written && /(?:^|\s)grayscale\(1\)$/.test(this.#document.defaultView.getComputedStyle(element).filter)
      : written;
    if (verified) entry.pending = null;
    return verified;
  }

  #acquire(claim, element, properties, canApply) {
    if (typeof claim !== 'string' || !claim || claim.length > 256) throw Error('INVALID_CLAIM_ID');
    if (!this.#open) throw Error('DOCUMENT_EFFECTS_CLOSED');
    if (element?.ownerDocument !== this.#document) throw Error('FOREIGN_DOCUMENT');
    // A page setter can synchronously call back into acquire/release. Never
    // mutate an entry while an outer effect still owns its pending write.
    if (this.#busy) return false;
    if (canApply() !== true) return false;
    let entries = this.#entries.get(element);
    // Do not add another owner or reapply over an unresolved restoration.
    if ([...(entries?.values() ?? [])].some(entry => entry.pending?.kind === 'RESTORE')) return false;
    if (!entries) { entries = new Map(); this.#entries.set(element, entries); }
    this.#busy = true;
    try {
      // Plan ALL properties before effect. This is an in-memory cleanup ledger,
      // not a replacement for the caller's effect-before-durable-write gate.
      for (const property of properties) {
        let entry = entries.get(property);
        if (!entry) {
          entry = { original: this.#read(element, property), written: null, claims: new Set() };
          entries.set(property, entry);
        }
        entry.claims.add(claim);
      }
      let verified = true;
      for (const property of properties) {
        if (canApply() !== true || !this.#apply(element, property, entries.get(property), canApply)) { verified = false; break; }
      }
      // Inline values alone do not prove hiding against page/user styles.
      if (properties.includes('display')) {
        verified = this.#document.defaultView.getComputedStyle(element).display === 'none' && element.inert === true && verified;
      }
      return verified;
    } catch { return false; } finally { this.#busy = false; }
  }

  release(claim) {
    if (this.#busy) return {restored:false,remaining_targets:this.inspect(claim).remaining_targets,error_count:0,cleanup_pending:true};
    this.#busy = true;
    try {
    let errors = 0;
    for (const [element, entries] of this.#entries) {
      for (const [property, entry] of entries) {
        if (!entry.claims.has(claim)) continue;
        // Adoption is not detachment or GONE. No authority to mutate the new
        // document, including when reasserting another old claim. Retain debt.
        if (element.ownerDocument !== this.#document) { errors++; continue; }
        try {
          if (entry.claims.size > 1) {
            // Reconcile a page edit while the other owner still needs protection.
            if (!this.#apply(element, property, entry)) { errors++; continue; }
            entry.claims.delete(claim);
          } else {
            const current = this.#read(element, property);
            // A detached node is not GONE: attempt restoration and retain failures.
            // Once a write has begun, an unexpected value may be its partial
            // result, not a page edit. Keep the immutable goal across retries.
            // Without separate provenance, pending writes never redefine baseline.
            const expected = entry.pending?.kind === 'RESTORE' ? entry.pending.target
              : entry.pending?.kind === 'APPLY' || entry.written && this.#equal(current, entry.written) ? entry.original : current;
            entry.pending = {kind:'RESTORE',target:expected};
            if (!this.#equal(current, expected)) this.#write(element, property, expected);
            if (!this.#equal(this.#read(element, property), expected)) { errors++; continue; }
            entries.delete(property);
          }
        } catch { errors++; }
      }
      if (entries.size === 0) this.#entries.delete(element);
    }
    const remaining = this.inspect(claim).remaining_targets;
    return { restored: errors === 0 && remaining === 0, remaining_targets: remaining, error_count: errors };
    } finally { this.#busy = false; }
  }

  inspect(claim) {
    let remaining = 0, properties = 0;
    for (const entries of this.#entries.values()) {
      let matched = false;
      for (const entry of entries.values()) {
        if (claim === undefined || entry.claims.has(claim)) { matched = true; properties++; }
      }
      if (matched) remaining++;
    }
    // No DOM references, text, URL, or native/whole-session success assertion.
    return { remaining_targets: remaining, remaining_properties: properties };
  }
}
