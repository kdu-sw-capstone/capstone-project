import { SiteController } from './src/site-controller.js';
const executor = '11111111-1111-4111-8111-111111111111';
const session = '22222222-2222-4222-8222-222222222222';
const owner = `GUEST:${executor}`;
const request = indexedDB.open('focurve-ext02-test-only', 1);
request.onupgradeneeded = () => request.result.createObjectStore('journal', { keyPath: ['owner_key', 'session_id'] });
const db = await new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
});
const journal = {
  load: (key, id) => new Promise((resolve, reject) => {
    const tx = db.transaction('journal'); const get = tx.objectStore('journal').get([key, id]);
    tx.oncomplete = () => resolve(get.result ?? null); tx.onabort = () => reject(tx.error);
  }),
  save: entry => new Promise((resolve, reject) => {
    const tx = db.transaction('journal', 'readwrite'); tx.objectStore('journal').put(entry);
    tx.oncomplete = resolve; tx.onabort = () => reject(tx.error);
  }),
};
let context = { owner_key: owner, executor_id: executor, session_id: session, revision: 1, desired: 'APPLIED', reconciled: true };
const controller = new SiteController({ dnr: chrome.declarativeNetRequest, tabs: chrome.tabs,
  journal, getContext: async () => context, blockedPageUrl: chrome.runtime.getURL('blocked/index.html') });
function command(revision) {
  return { command_id: '33333333-3333-4333-8333-333333333333', session_id: session, executor_id: executor,
    type: 'APPLY_POLICY', desired_revision: revision, reason: 'TEST_ONLY', created_at: new Date().toISOString(),
    execute_before: new Date(Date.now() + 30000).toISOString(), snapshot: {
      policy_snapshot_id: '44444444-4444-4444-8444-444444444444', executor_id: executor,
      format_version: '1.1', created_at: '2026-10-08T00:00:00Z', source_version: 1, content_policy: {},
      sites: [
        { canonical_host: 'example.com', include_subdomains: true, access_policy: 'BLOCK' },
        { canonical_host: 'example.org', include_subdomains: true, access_policy: 'ALLOW' },
        { canonical_host: 'example.net', include_subdomains: true, access_policy: 'RECORD' },
      ],
    } };
}
async function refreshContext() {
  const entry = await journal.load(owner, session);
  if (entry) context = { ...context, revision: entry.revision, desired: entry.desired };
  return entry;
}
const output = document.querySelector('#result');
async function run(action) {
  for (const button of document.querySelectorAll('button')) button.disabled = true;
  try { output.textContent = JSON.stringify(await action(), null, 2); }
  catch (error) { output.textContent = `오류: ${error.message}\n성공으로 처리하지 않았습니다.`; console.error(error.message); }
  finally { for (const button of document.querySelectorAll('button')) button.disabled = false; }
}
document.querySelector('#apply').onclick = () => run(async () => {
  const entry = await refreshContext();
  if (entry?.desired === 'RELEASED') {
    // New synthetic test execution needs a fresh journal. Preserve the old one;
    // use reload of unpacked extension / new test profile for a new test run.
    throw new Error('TEST_RUN_FINISHED_USE_NEW_TEST_PROFILE');
  }
  return controller.apply(command(context.revision));
});
document.querySelector('#release').onclick = () => run(async () => {
  const entry = await refreshContext(); if (!entry) throw new Error('NO_TEST_JOURNAL');
  context = { ...context, revision: entry.desired === 'RELEASED' ? entry.revision : entry.revision + 1, desired: 'RELEASED' };
  return controller.release({ ...command(context.revision), type: 'RELEASE_POLICY' });
});
document.querySelector('#inspect').onclick = () => run(async () => {
  await refreshContext(); return controller.inspect(owner, session);
});
document.querySelector('#expired').onclick = () => run(async () => {
  await refreshContext(); const input = command(context.revision); input.execute_before = '2020-01-01T00:00:00Z';
  const before = await chrome.declarativeNetRequest.getSessionRules();
  try { await controller.apply(input); throw new Error('TEST_FAILED_EXPIRED_ACCEPTED'); }
  catch (error) {
    if (!error.message.includes('APPLY_EXPIRED') && !error.message.includes('STALE_COMMAND')) throw error;
    const after = await chrome.declarativeNetRequest.getSessionRules();
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('TEST_FAILED_RULES_CHANGED');
    return { result: 'REJECTED', error: error.message, rules_unchanged: true, authentication: 'MOCK_CONTEXT' };
  }
});
document.querySelector('#wrong').onclick = () => run(async () => {
  await refreshContext(); const input = command(context.revision); input.executor_id = session;
  const before = await chrome.declarativeNetRequest.getSessionRules();
  try { await controller.apply(input); throw new Error('TEST_FAILED_EXECUTOR_ACCEPTED'); }
  catch (error) {
    if (error.message !== 'EXECUTION_SCOPE_MISMATCH') throw error;
    const after = await chrome.declarativeNetRequest.getSessionRules();
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('TEST_FAILED_RULES_CHANGED');
    return { result: 'REJECTED', rules_unchanged: true, authentication: 'MOCK_CONTEXT' };
  }
});
await refreshContext(); output.textContent = '준비 완료. 실제 규칙 확인 전 적용 성공으로 표시하지 않습니다.';
