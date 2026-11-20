// Core-only foundation: no wire schema, Chrome listener, policy or credential storage.
// All reference/lifecycle inputs must come from trusted Chrome APIs, not message bodies.
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const text = v => typeof v === 'string' && v.length > 0 && v.length <= 200;
function reference(v) {
  if (!exact(v, ['executorKey', 'tab', 'frame', 'documentKey']) || !text(v.executorKey) || !text(v.documentKey)
    || !Number.isSafeInteger(v.tab) || v.tab < 0 || v.frame !== 0) throw new Error('INVALID_DOCUMENT_REFERENCE');
  return structuredClone(v);
}
function scope(v) {
  if (!exact(v, ['ownerKey', 'sessionKey', 'snapshotKey', 'revision', 'bindingKey'])
    || !/^((MEMBER:[1-9][0-9]*)|(GUEST:[A-Za-z0-9-]+))$/.test(v.ownerKey)
    || !['sessionKey', 'snapshotKey', 'bindingKey'].every(k => text(v[k]))
    || !Number.isSafeInteger(v.revision) || v.revision < 1) throw new Error('INVALID_CONTROL_SCOPE');
  return structuredClone(v);
}
const key = r => [r.executorKey, r.tab, r.frame, r.documentKey];
const slot = r => [r.executorKey, r.tab, r.frame];
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])]));
  return v;
}
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const terminal = state => ['RESTORED', 'DOCUMENT_GONE'].includes(state);
const invalidStored = () => { throw new Error('INVALID_DOCUMENT_REGISTRY'); };
// Validate existing v1 links, never repair/erase a missing restoration debt.
// Consistent data is not native authority or proof of a DOM effect.
function validateDocument(row, expectedRef = null) {
  try {
    if (!exact(row, ['key','ref','sequence','epoch','operations','obligations','lifecycle'])
      || !equal(row.key, key(reference(row.ref))) || expectedRef && !equal(row.ref, expectedRef)
      || !Number.isSafeInteger(row.sequence) || row.sequence < 0
      || !Number.isSafeInteger(row.epoch) || row.epoch < 1
      || !['ACTIVE','INACTIVE','GONE'].includes(row.lifecycle)
      || !Array.isArray(row.operations) || !Array.isArray(row.obligations)
      || row.sequence !== row.operations.length) invalidStored();
    const bindings = new Map(), operations = new Set();
    for (const item of row.obligations) {
      if (!exact(item, ['scope','state'])) invalidStored();
      const binding = scope(item.scope);
      if (bindings.has(binding.bindingKey)) invalidStored();
      bindings.set(binding.bindingKey, { scope: binding, state: 'UNCONFIRMED', applied: false });
    }
    let priorEpoch = 0;
    for (const [i, operation] of row.operations.entries()) {
      if (!exact(operation, ['operationKey','intent','ticket','result']) || !text(operation.operationKey)
        || operations.has(operation.operationKey) || ![null,'CONFIRMED','FAILED','UNCONFIRMED'].includes(operation.result)) invalidStored();
      const intent = operation.intent, ticket = operation.ticket;
      if (!exact(intent, ['operationKey','action','controlScope']) || intent.operationKey !== operation.operationKey
        || !['APPLY','RELEASE'].includes(intent.action)
        || !exact(ticket, ['ref','operationKey','sequence','epoch','action','controlScope'])
        || ticket.operationKey !== operation.operationKey || ticket.action !== intent.action
        || !equal(ticket.ref, row.ref) || !equal(scope(intent.controlScope), scope(ticket.controlScope))
        || ticket.sequence !== i + 1 || !Number.isSafeInteger(ticket.epoch)
        || ticket.epoch < 1 || ticket.epoch < priorEpoch || ticket.epoch > row.epoch) invalidStored();
      const binding = bindings.get(intent.controlScope.bindingKey);
      if (!binding || !equal(binding.scope, intent.controlScope)
        || (intent.action === 'APPLY' ? binding.applied : !binding.applied)) invalidStored();
      if (intent.action === 'APPLY') binding.applied = true;
      if (operation.result !== null) binding.state = intent.action === 'RELEASE'
        ? operation.result === 'CONFIRMED' ? 'RESTORED' : 'CLEANUP_UNCONFIRMED'
        : operation.result === 'CONFIRMED' ? 'APPLY_CONFIRMED' : 'UNCONFIRMED';
      operations.add(operation.operationKey); priorEpoch = ticket.epoch;
    }
    for (const item of row.obligations) {
      const binding = bindings.get(item.scope.bindingKey);
      const expected = row.lifecycle === 'GONE' && !terminal(binding.state) ? 'DOCUMENT_GONE' : binding.state;
      if (!binding.applied || item.state !== expected) invalidStored();
    }
  } catch { invalidStored(); }
}
function validateSlot(row, ref) {
  if (!exact(row, ['key','documentKey']) || !equal(row.key, slot(ref))
    || !Array.isArray(row.documentKey) || row.documentKey.length !== 4
    || !equal(row.documentKey.slice(0, 3), slot(ref)) || !text(row.documentKey[3])) invalidStored();
}
export class DocumentControlRegistry {
  constructor({ indexedDB = globalThis.indexedDB, name = 'focurve-core-documents', operationLimit = 256 } = {}) {
    if (!Number.isSafeInteger(operationLimit) || operationLimit < 1) throw new Error('INVALID_REGISTRY_LIMIT');
    Object.assign(this, { indexedDB, name, operationLimit });
    this.verifiedDocuments = new Set();
  }
  async transaction(mode, work) {
    const db = await new Promise((resolve, reject) => {
      const r = this.indexedDB.open(this.name, 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore('documents', { keyPath: 'key' });
        r.result.createObjectStore('slots', { keyPath: 'key' });
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = r.onblocked = () => reject(new Error('DOCUMENT_REGISTRY_UNAVAILABLE'));
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(['documents', 'slots'], mode); let value, error;
        const run = fn => { try { fn(); } catch (cause) { error = cause; tx.abort(); } };
        tx.oncomplete = () => resolve(value);
        tx.onabort = () => reject(error || new Error('DOCUMENT_REGISTRY_UNAVAILABLE'));
        run(() => work(tx.objectStore('documents'), tx.objectStore('slots'), result => { value = result; }, run));
      });
    } finally { db.close(); }
  }
  load(ref) {
    ref = reference(ref);
    return this.transaction('readonly', (documents, _slots, done, run) => {
      const r = documents.get(key(ref)); r.onsuccess = () => run(() => {
        if (r.result) validateDocument(r.result, ref);
        done(r.result ?? null);
      });
    });
  }
  // Replacement only proves inactivity. BFCache documents still need cleanup.
  observe(ref) {
    ref = reference(ref);
    return this.transaction('readwrite', (documents, slots, done, run) => {
      const current = slots.get(slot(ref));
      current.onsuccess = () => run(() => {
        if (current.result) validateSlot(current.result, ref);
        if (current.result && !equal(current.result.documentKey, key(ref))) {
          const prev = documents.get(current.result.documentKey);
          prev.onsuccess = () => run(() => {
            if (!prev.result) invalidStored();
            validateDocument(prev.result, { ...ref, documentKey: current.result.documentKey[3] });
            if (prev.result.lifecycle === 'ACTIVE') {
              const next = { ...prev.result, lifecycle: 'INACTIVE', epoch: prev.result.epoch + 1 };
              validateDocument(next); documents.put(next);
            }
          });
        }
        const r = documents.get(key(ref));
        r.onsuccess = () => run(() => {
          if (r.result) validateDocument(r.result, ref);
          else if (current.result && equal(current.result.documentKey, key(ref))) invalidStored();
          const row = r.result || { key: key(ref), ref, sequence: 0, epoch: 0, operations: [], obligations: [] };
          if (row.lifecycle === 'GONE') throw new Error('DOCUMENT_ALREADY_GONE');
          if (row.lifecycle !== 'ACTIVE') row.epoch++;
          row.lifecycle = 'ACTIVE'; validateDocument(row, ref); documents.put(row);
          slots.put({ key: slot(ref), documentKey: row.key }); done(row);
        });
      });
    }).then(row => { this.verifiedDocuments.add(JSON.stringify(row.key)); return row; });
  }
  // Future caller must verify actual tab close/document destruction, not a sendMessage failure.
  confirmGone(ref) {
    ref = reference(ref);
    return this.transaction('readwrite', (documents, slots, done, run) => {
      const r = documents.get(key(ref));
      r.onsuccess = () => run(() => {
        const row = r.result; if (!row) throw new Error('UNKNOWN_DOCUMENT');
        validateDocument(row, ref);
        row.lifecycle = 'GONE'; row.epoch++;
        for (const item of row.obligations) if (!terminal(item.state)) item.state = 'DOCUMENT_GONE';
        validateDocument(row, ref); documents.put(row);
        const current = slots.get(slot(ref)); current.onsuccess = () => run(() => {
          if (current.result) validateSlot(current.result, ref);
          if (equal(current.result?.documentKey, row.key)) slots.delete(slot(ref)); done(row);
        });
      });
    });
  }
  // Dispatch permitted only after this Promise resolves (transaction commit).
  stage(ref, { operationKey, action, controlScope }) {
    ref = reference(ref); controlScope = scope(controlScope);
    if (!text(operationKey) || !['APPLY', 'RELEASE'].includes(action)) throw new Error('INVALID_CONTROL_INTENT');
    const intent = { operationKey, action, controlScope };
    return this.transaction('readwrite', (documents, _slots, done, run) => {
      const r = documents.get(key(ref)); r.onsuccess = () => run(() => {
        const row = r.result; if (!row) throw new Error('UNKNOWN_DOCUMENT');
        validateDocument(row, ref);
        const previous = row.operations.find(item => item.operationKey === operationKey);
        if (previous) {
          if (!equal(previous.intent, intent)) throw new Error('OPERATION_CONFLICT');
          done({ ticket: previous.ticket, duplicate: true, result: previous.result }); return;
        }
        if (action === 'APPLY' && !this.verifiedDocuments.has(JSON.stringify(row.key))) throw new Error('DOCUMENT_RECHECK_REQUIRED');
        if (row.lifecycle === 'GONE' || action === 'APPLY' && row.lifecycle !== 'ACTIVE') throw new Error('INACTIVE_DOCUMENT');
        if (row.operations.length >= this.operationLimit && action === 'APPLY') throw new Error('REGISTRY_CAPACITY');
        if (!Number.isSafeInteger(row.sequence + 1)) throw new Error('CONTROL_SEQUENCE_EXHAUSTED');
        let obligation = row.obligations.find(item => item.scope.bindingKey === controlScope.bindingKey);
        if (action === 'APPLY') {
          const sameSession = row.obligations.filter(item => item.scope.ownerKey === controlScope.ownerKey
            && item.scope.sessionKey === controlScope.sessionKey);
          if (sameSession.some(item => item.scope.snapshotKey !== controlScope.snapshotKey)) throw new Error('FROZEN_SNAPSHOT_CONFLICT');
          if (sameSession.some(item => item.scope.revision > controlScope.revision)) throw new Error('STALE_SCOPE_REVISION');
          if (obligation) throw new Error('BINDING_ALREADY_EXISTS');
          if (row.obligations.some(item => !terminal(item.state)
            && (item.scope.ownerKey !== controlScope.ownerKey || item.scope.sessionKey !== controlScope.sessionKey)))
            throw new Error('CLEANUP_REQUIRED');
          obligation = { scope: controlScope, state: 'UNCONFIRMED' }; row.obligations.push(obligation);
        } else if (!obligation || !equal(obligation.scope, controlScope)) throw new Error('UNKNOWN_CLEANUP_BINDING');
        const ticket = { ref, operationKey, sequence: ++row.sequence, epoch: row.epoch, action, controlScope };
        row.operations.push({ operationKey, intent, ticket, result: null }); validateDocument(row, ref); documents.put(row);
        done({ ticket, duplicate: false, result: null });
      });
    });
  }
  // Internal verified adapter result, not DOM proof, Server report or aggregate success.
  complete(ticket, outcome) {
    const ref = reference(ticket?.ref);
    if (!['CONFIRMED', 'FAILED', 'UNCONFIRMED'].includes(outcome)) throw new Error('INVALID_CONTROL_OUTCOME');
    return this.transaction('readwrite', (documents, _slots, done, run) => {
      const r = documents.get(key(ref)); r.onsuccess = () => run(() => {
        const row = r.result;
        if (row) validateDocument(row, ref);
        const operation = row?.operations.find(item => item.operationKey === ticket.operationKey);
        if (!operation || !equal(operation.ticket, ticket)) throw new Error('UNKNOWN_CONTROL_TICKET');
        if (operation.result !== null) {
          if (operation.result !== outcome) throw new Error('CONTROL_RESULT_CONFLICT');
          done({ accepted: false, duplicate: true }); return;
        }
        if (ticket.action === 'APPLY' && !this.verifiedDocuments.has(JSON.stringify(row.key))) throw new Error('DOCUMENT_RECHECK_REQUIRED');
        if (row.lifecycle === 'GONE' || row.epoch !== ticket.epoch || row.sequence !== ticket.sequence
          || ticket.action === 'APPLY' && row.lifecycle !== 'ACTIVE') throw new Error('STALE_CONTROL_RESULT');
        operation.result = outcome;
        const obligation = row.obligations.find(item => item.scope.bindingKey === ticket.controlScope.bindingKey);
        obligation.state = ticket.action === 'RELEASE' && outcome === 'CONFIRMED' ? 'RESTORED'
          : ticket.action === 'RELEASE' ? 'CLEANUP_UNCONFIRMED' : outcome === 'CONFIRMED' ? 'APPLY_CONFIRMED' : 'UNCONFIRMED';
        validateDocument(row, ref); documents.put(row); done({ accepted: true, duplicate: false });
      });
    });
  }
  pending(executorKey) {
    if (!text(executorKey)) throw new Error('INVALID_EXECUTOR');
    return this.transaction('readonly', (documents, _slots, done, run) => {
      const r = documents.getAll(); r.onsuccess = () => run(() => {
        const selected = [];
        for (const row of r.result) {
          if (!Array.isArray(row?.key) || row.key.length !== 4 || !text(row.key[0])) invalidStored();
          if (row.key[0] !== executorKey && row.ref?.executorKey !== executorKey) continue;
          validateDocument(row);
          if (row.obligations.some(item => !terminal(item.state))) selected.push(row);
        }
        done(selected);
      });
    });
  }
}
