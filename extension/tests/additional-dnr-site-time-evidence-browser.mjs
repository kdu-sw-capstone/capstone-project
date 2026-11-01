// Optional real IndexedDB/Web Lock test; DNR/issued policy authority are SYNTHETIC.
// Not part of npm test / Node-only CI.
// PLAYWRIGHT_MODULE and CHROME_EXECUTABLE may point to existing installations.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../../', import.meta.url));

test('Chromium actual IndexedDB and Web Lock preserve evidence; DNR is SYNTHETIC', async () => {
  const browser = await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
  try {
    const page = await browser.newPage();
    await page.route('**/*', async route => {
      const path = new URL(route.request().url()).pathname;
      if (/^\/(extension\/(src|a1|member-a1)\/[a-z-]+\.(js|mjs|json)|contracts\/additional-mvp\/rc1\/schema\.json)$/.test(path)) {
        return route.fulfill({contentType:path.endsWith('.json')?'application/json':'text/javascript',body:await readFile(join(root,path.slice(1)),'utf8')});
      }
      return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Evidence storage test</title>'});
    });
    await page.goto('https://focurve.test/');
    const result = await page.evaluate(async () => {
      const [{ createMemberDB }, { digest }, { AdditionalDnrStore }, { AdditionalDnrCoordinator }, { SiteTimeDnrEvidence }] = await Promise.all([
        import('/extension/member-a1/db.mjs'), import('/extension/a1/contract.mjs'), import('/extension/src/additional-dnr-store.js'),
        import('/extension/src/additional-dnr-coordinator.js'), import('/extension/src/additional-dnr-site-time-evidence.js'),
      ]);
      const id = () => crypto.randomUUID(), db = createMemberDB(indexedDB, 'isolated-evidence');
      // No extension permission/native DNR here; isolate browser persistence/locking.
      // DNR and issued-policy authority are explicitly SYNTHETIC.
      let rules=[];
      const dnr={getSessionRules:async()=>structuredClone(rules),getDynamicRules:async()=>[],
        updateSessionRules:async({addRules=[],removeRuleIds=[]})=>{rules=rules.filter(r=>!removeRuleIds.includes(r.id)).concat(structuredClone(addRules));}};
      const store = new AdditionalDnrStore(db), coordinator = new AdditionalDnrCoordinator({
        store, dnr, assertWritersGuarded: () => true, verifyAdoption: () => true,
      });
      const epoch = await coordinator.startWriter(), context = {
        operation_id: id(), owner_binding_id: id(), executor_id: id(), runtime_execution_id: id(), package_id: id(), runtime_revision: 1, generation: 1,
      };
      const policy = { kind: 'SITE_TIME', policy_id: id(), version: 1, site_id: null, scope: { host: 'example.test', include_subdomains: true },
        enabled: true, tracking_scope: 'BROWSER_ALWAYS', daily_limit_ms: 60000, windows: [] };
      const rule = { id: 100000, priority: 1, action: { type: 'block' }, condition: { urlFilter: '||example.test^' } };
      const claim = { claim_id: id(), owner_binding_id: context.owner_binding_id, generation: 1, writer_epoch: epoch,
        rule_key: { rule_store: 'SESSION', rule_id: rule.id }, rule_sha256: await digest(rule), restore_state: 'APPLIED' };
      const evidence = new SiteTimeDnrEvidence({ coordinator, verifyBinding: () => true });
      await evidence.register({ context, policy, claims: [claim] });
      const before = await evidence.read(context);
      await coordinator.exclusive(() => dnr.updateSessionRules({ addRules: [rule] }));
      await coordinator.adopt(epoch, claim, rule);
      const applied = await evidence.read(context);
      await coordinator.releaseOwner(epoch, { operationId: id(), ownerBindingId: context.owner_binding_id, generation: 1 });
      const reopened = new SiteTimeDnrEvidence({ coordinator: new AdditionalDnrCoordinator({ store: new AdditionalDnrStore(createMemberDB(indexedDB, 'isolated-evidence')),
        dnr, assertWritersGuarded: () => true }), verifyBinding: () => true });
      const released = await reopened.read(context);
      return { before: before.current.claims[0], applied: applied.current.claims[0], released: released.current.claims[0],
        persistedRegistration: released.registration.snapshot_sha256 === before.registration.snapshot_sha256,
        remainingRules: (await dnr.getSessionRules()).length };
    });
    assert.equal(result.before.registered, false);
    assert.equal(result.applied.live_footprint_matches, true);
    assert.equal(result.applied.cleanup_pending, true);
    assert.equal(result.released.release_footprint_verified, true);
    assert.equal(result.released.cleanup_pending, false);
    assert.equal(result.persistedRegistration, true);
    assert.equal(result.remainingRules, 0);
  } finally {
    await browser.close();
  }
});
