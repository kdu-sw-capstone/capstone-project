import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentLifecycle} from '../execution/document-lifecycle.mjs';
import {DocumentCoordinator, installDocumentCoordinator} from '../execution/document-coordinator.mjs';
import {A1Core} from '../a1/core.mjs';
import {A1Core as MemberCore} from '../member-a1/core.mjs';
import {fixture as memberFixture} from './member-fixture.mjs';

const doc = (extra = {}) => ({ tabId: 7, frameId: 0, documentId: 'document-a',
  timeStamp: 100, url: 'https://www.youtube.com/watch?v=normal', ...extra });
function fixture() {
  const calls = [], failures = [];
  const core = { ready: Promise.resolve(), d1: {}, serial: async f => f(),
    navigation: async (d, options) => calls.push(['navigation', d.documentId, options]),
    nativeDocumentReady: d => calls.push(['ready', d.documentId]),
    requestCheck: () => calls.push(['check']), invalidate: async (...args) => calls.push(args) };
  return { core, calls, failures, engine: new DocumentCoordinator(core, { onFailure: c => failures.push(c) }) };
}

test('loading is separate from commit and Root readiness, never a success proof', () => {
  const model = new DocumentLifecycle();
  assert.equal(model.observe('BEFORE', doc()).phase, 'NAVIGATION_PENDING');
  assert.equal(model.observe('COMMITTED', doc()).phase, 'COMMITTED_NOT_READY');
  assert.equal(model.observe('READY', doc()).phase, 'READY_ROOT_OBSERVED');
  assert.equal(model.documents.get('7:document-a').result_state, undefined);
});

test('refresh proves replacement only on commit, preserving original bookkeeping', () => {
  const model = new DocumentLifecycle(); model.observe('COMMITTED', doc());
  model.observe('BEFORE', doc({ timeStamp: 101 }));
  assert.equal(model.documents.get('7:document-a').phase, 'COMMITTED_NOT_READY');
  model.observe('COMMITTED', doc({ documentId: 'document-b', timeStamp: 102 }));
  assert.equal(model.documents.get('7:document-a').phase, 'REPLACED_ROOT_OBSERVED');
  assert.equal(model.documents.get('7:document-b').phase, 'COMMITTED_NOT_READY');
});

test('stale readiness and history cannot replace the current document', () => {
  const model = new DocumentLifecycle(); model.observe('COMMITTED', doc());
  model.observe('COMMITTED', doc({ documentId: 'document-b', timeStamp: 102 }));
  assert.equal(model.observe('READY', doc({ timeStamp: 101 })).reason, 'STALE_EVENT');
  assert.equal(model.observe('HISTORY', doc({ timeStamp: 103 })).reason, 'OTHER_DOCUMENT');
  assert.equal(model.tabs.get(7).documentId, 'document-b');
});

for (const url of ['https://www.youtube.com/shorts/direct',
  'https://www.youtube.com/results?search_query=cats',
  'https://www.youtube.com/watch?v=general']) test('SPA re-evaluates without retiring document: ' + new URL(url).pathname, async () => {
  const f = fixture(); await f.engine.event('COMMITTED', doc());
  await f.engine.event('HISTORY', doc({ url, timeStamp: 101 }));
  assert.deepEqual(f.calls[1], ['navigation', 'document-a', { sameUrlHistory: true }]);
  assert.equal(f.engine.lifecycle.documents.get('7:document-a').phase, 'POLICY_REEVALUATION_REQUIRED');
});

test('back/forward history is not coalesced with an earlier completed request', async () => {
  const f = fixture(); await f.engine.event('COMMITTED', doc());
  for (let i = 1; i <= 3; i++) await f.engine.event('HISTORY', doc({ timeStamp: 100 + i }));
  assert.equal(f.calls.filter(c => c[0] === 'navigation').length, 3);
});

test('same pending event shares work; completed events are never cached as proof', async () => {
  const f = fixture(); let release; f.core.ready = new Promise(r => release = r);
  const first = f.engine.event('COMMITTED', doc()), duplicate = f.engine.event('COMMITTED', doc());
  assert.equal(first, duplicate); release(); await first;
  await f.engine.event('COMMITTED', doc()); assert.equal(f.calls.length, 2);
});

test('failed navigation records error and is not automatically retried', async () => {
  const f = fixture(); let count = 0;
  f.core.navigation = async () => { count++; throw Error('REVALIDATION_REQUIRED'); };
  await assert.rejects(f.engine.event('BEFORE', doc()), /REVALIDATION_REQUIRED/);
  await f.engine.idle(); assert.equal(count, 1);
  assert.deepEqual(f.failures, ['REVALIDATION_REQUIRED']);
});

test('connection loss is separated from session state and grants no recovery', () => {
  const f = fixture(); f.engine.connection(true);
  assert.equal(f.engine.transport, 'DISCONNECTED'); assert.equal(f.calls.length, 0);
  f.engine.connection(false); assert.equal(f.calls.length, 0);
});

test('D1 retirement remains single-owner and does not delete restoration obligations', async () => {
  const f = fixture(); await f.engine.event('COMMITTED', doc()); await f.engine.removed(7);
  assert.deepEqual(f.calls, [['check']]);
  assert.equal(f.engine.lifecycle.documents.get('7:document-a').phase, 'TAB_REMOVED_ROOT_OBSERVED');
});

test('without D1 uses existing Core invalidation, not a new cleanup path', async () => {
  const f = fixture(); f.core.d1 = null; await f.engine.removed(7);
  assert.deepEqual(f.calls, [['TAB_REMOVED', 7]]);
});

test('subframes never enter the top-document policy path', async () => {
  const f = fixture(); assert.equal((await f.engine.event('COMMITTED', doc({ frameId: 1 }))).accepted, false);
  assert.equal(f.calls.length, 0);
});

test('malformed Root identity is rejected before Core call', async () => {
  const f = fixture(); await assert.rejects(f.engine.event('COMMITTED', doc({ documentId: '' })), /INVALID_SCHEMA/);
  assert.equal(f.calls.length, 0);
});

test('normal completion cannot be reported as APPLY confirmation', async () => {
  const f = fixture(); await f.engine.complete(7);
  assert.deepEqual(f.calls, [['check']]);
});

for (const [name, Core] of [['guest', A1Core], ['member', MemberCore]])
  test(name + ' coordinator preserves real Core readiness and pending URL rejection', async () => {
    const event = doc({ documentLifecycle: 'active' });
    const tab = { id: 7, status: 'loading', url: event.url };
    const core = Object.create(Core.prototype);
    Object.assign(core, { boot: 'test-boot', nativeReadyDocs: new Map(), requestCheck() {},
      ready: Promise.resolve(), env: { policy: { select: () => ({ access_policy: 'ALLOW',
        feature_policies: [{ enabled: true }], site_id: 'youtube' }) } },
      chrome: { tabs: { query: async () => [tab] }, webNavigation: { getAllFrames: async () => [event] } } });
    const engine = new DocumentCoordinator(core);
    await assert.rejects(core.census({ sites: [] }), /REVALIDATION_REQUIRED/);
    await engine.event('COMMITTED', event);
    await assert.rejects(core.census({ sites: [] }), /REVALIDATION_REQUIRED/);
    await engine.event('READY', event);
    assert.equal((await core.census({ sites: [] })).required.length, 1);
    tab.pendingUrl = 'https://www.youtube.com/shorts/pending';
    await assert.rejects(core.census({ sites: [] }), /REVALIDATION_REQUIRED/);
  });

for (const changeURL of [false, true]) test('shared coordinator composes with durable member START, ' + (changeURL ? 'changed SPA URL' : 'same URL history') + ', END and restored DNR', async () => {
  const f = await memberFixture({ nd01: true, dp01: true, nr01: true, d1b5: true,
    p1: true, limitedProduct11: true });
  const engine = new DocumentCoordinator(f.core);
  f.env.experimentalDocumentCoordinator = true;
  Object.assign(f.command, { native_transition_contract: 'NR01_1',
    dom_transition_contract: 'DP01_1', document_transition_contract: 'ND01_1' });
  assert.equal((await f.core.startCommand(f.command)).session.status, 'RUNNING');
  const frame = f.frames[0];
  await engine.event('COMMITTED', { ...frame, timeStamp: f.core.now() });
  if (changeURL) {
    frame.url = 'https://www.youtube.com/shorts/changed-via-spa';
    f.senderUrls.set(frame.documentId, frame.url);
  }
  await engine.event('HISTORY', { ...frame, timeStamp: f.core.now() });
  assert.equal((await f.core.tick()).session.status, 'RUNNING');
  assert.equal((await f.core.end(f.command.session_id)).session.status, 'ENDED');
  const after = await f.core.bundle();
  assert.equal(after.state.journal.observed, 'RELEASED');
  assert.equal(after.bindings.some(b => b.cleanup_pending || b.resolution === 'NONE'), false);
  assert.equal(f.rules().length, 0);
});

test('installed Root event listeners are removed without clearing stored state', async () => {
  const channels = Array.from({ length: 6 }, () => ({ handlers: new Set(),
    addListener(f) { this.handlers.add(f); }, removeListener(f) { this.handlers.delete(f); } }));
  const chrome = { webNavigation: { onBeforeNavigate: channels[0], onCommitted: channels[1],
    onDOMContentLoaded: channels[2], onHistoryStateUpdated: channels[3] },
    tabs: { onUpdated: channels[4], onRemoved: channels[5] } };
  const f = fixture(); const installed = installDocumentCoordinator(f.core, chrome, { excludedDocument: () => true });
  for (const fn of channels[1].handlers) fn(doc()); await installed.coordinator.idle();
  assert.equal(f.calls.length, 0); installed.dispose();
  assert(channels.every(c => c.handlers.size === 0));
  await assert.rejects(installed.coordinator.event('COMMITTED', doc()), /INACTIVE_SCOPE/);
});
