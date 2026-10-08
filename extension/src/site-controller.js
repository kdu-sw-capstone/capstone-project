import { buildSiteRules, blockedUrl, matchesSite, sameRule } from './site-rules.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const timestamp = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value)
  && Number.isFinite(Date.parse(value));

// Internal adapter, not an API or runtime message endpoint. getContext must come
// from trusted Core state AFTER reconciliation, never a page or command payload.
// journal.save resolves only when the durable transaction has committed.
export class SiteController {
  constructor({ dnr, tabs, journal, getContext, blockedPageUrl, now = Date.now,
    wait = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
    Object.assign(this, { dnr, tabs, journal, getContext, blockedPageUrl, now, wait });
    this.queue = Promise.resolve();
  }

  serial(fn) {
    const result = this.queue.then(fn);
    this.queue = result.catch(() => {});
    return result;
  }

  async guard(command, desired) {
    const context = await this.getContext();
    if (!context || context.reconciled !== true) throw new Error('RECONCILE_REQUIRED');
    if (!UUID.test(command?.command_id) || !UUID.test(command.session_id)
      || !UUID.test(command.executor_id) || !Number.isSafeInteger(command.desired_revision)
      || command.desired_revision < 1 || !timestamp(command.created_at)) throw new Error('INVALID_COMMAND');
    if (command.executor_id !== context.executor_id || command.session_id !== context.session_id) throw new Error('EXECUTION_SCOPE_MISMATCH');
    if (command.desired_revision !== context.revision || context.desired !== desired) throw new Error('STALE_COMMAND');
    const owner = context.owner_key;
    if (typeof owner !== 'string' || !(owner === `GUEST:${context.executor_id}` || /^MEMBER:[1-9][0-9]*$/.test(owner))) throw new Error('INVALID_OWNER');
    if (desired === 'APPLIED') {
      if (command.type !== 'APPLY_POLICY' || !timestamp(command.execute_before)
        || Date.parse(command.execute_before) <= this.now()) throw new Error('APPLY_EXPIRED_OR_INVALID');
      const snapshot = command.snapshot;
      if (!snapshot || snapshot.format_version !== '1.1' || !UUID.test(snapshot.policy_snapshot_id)
        || snapshot.executor_id !== context.executor_id
        || (owner.startsWith('MEMBER:') ? String(snapshot.owner_user_id) !== owner.slice(7) : snapshot.owner_user_id != null)) {
        throw new Error('SNAPSHOT_OWNER_MISMATCH');
      }
    } else if (command.type !== 'RELEASE_POLICY') throw new Error('INVALID_COMMAND');
    return structuredClone(context);
  }

  async recheck(command, context, desired) {
    const current = await this.guard(command, desired);
    if (current.owner_key !== context.owner_key) throw new Error('OWNER_CHANGED');
  }

  async checkOwned(entry) {
    const actual = await this.dnr.getSessionRules();
    for (const rule of entry.rules) {
      const found = actual.find(item => item.id === rule.id);
      if (found && !sameRule(found, rule)) throw new Error('RULE_OWNERSHIP_CONFLICT');
    }
    return actual;
  }

  async removeOwned(entry) {
    await this.checkOwned(entry);
    if (entry.rules.length) await this.dnr.updateSessionRules({ removeRuleIds: entry.rules.map(rule => rule.id) });
    const actual = await this.dnr.getSessionRules();
    if (actual.some(rule => entry.rules.some(owned => owned.id === rule.id))) throw new Error('RELEASE_UNCONFIRMED');
  }

  async divert(command, context, sites) {
    for (const tab of await this.tabs.query({})) {
      const site = sites.find(item => item.access_policy === 'BLOCK' && matchesSite(item, tab.pendingUrl || tab.url));
      if (!site) continue;
      await this.recheck(command, context, 'APPLIED');
      const url = blockedUrl(this.blockedPageUrl, site);
      try {
        await this.tabs.update(tab.id, { url });
        let confirmed = false;
        for (let attempt = 0; attempt < 30; attempt++) {
          const current = (await this.tabs.query({})).find(item => item.id === tab.id);
          if (!current || current.url === url) { confirmed = true; break; }
          await this.wait(100);
        }
        if (!confirmed) throw new Error('TAB_APPLY_UNCONFIRMED');
      } catch (error) {
        if ((await this.tabs.query({})).some(item => item.id === tab.id)) throw error;
      }
    }
  }

  apply(command) {
    // Clone before waiting on the queue; callers cannot mutate the saved snapshot.
    const input = structuredClone(command);
    return this.serial(async () => {
      const context = await this.guard(input, 'APPLIED');
      const saved = await this.journal.load(context.owner_key, input.session_id);
      if (saved) {
        if (saved.owner_key !== context.owner_key || saved.session_id !== input.session_id
          || saved.command_id !== input.command_id || saved.revision !== input.desired_revision
          || saved.executor_id !== context.executor_id || saved.desired !== 'APPLIED'
          || JSON.stringify(saved.snapshot) !== JSON.stringify(input.snapshot)) throw new Error('JOURNAL_CONFLICT');
        // Replay only checks existing state. It never reapplies an old command.
        const actual = await this.checkOwned(saved);
        if (saved.observed !== 'APPLIED' || !saved.rules.every(rule => actual.some(item => sameRule(item, rule)))) throw new Error('RECONCILE_REQUIRED');
        await this.divert(input, context, saved.snapshot.sites);
        await this.recheck(input, context, 'APPLIED');
        return { observed: 'APPLIED', duplicate: true };
      }
      const existing = await this.dnr.getSessionRules();
      const rules = buildSiteRules(input.snapshot.sites, existing, this.blockedPageUrl);
      const entry = { owner_key: context.owner_key, session_id: input.session_id,
        executor_id: input.executor_id, command_id: input.command_id,
        revision: input.desired_revision, action_seq: 1, desired: 'APPLIED', observed: 'UNCONFIRMED',
        rules, snapshot: input.snapshot };
      for (const rule of rules) {
        const result = await this.dnr.isRegexSupported({ regex: rule.condition.regexFilter, isCaseSensitive: false });
        if (!result.isSupported) throw new Error('RULE_UNSUPPORTED');
      }
      await this.recheck(input, context, 'APPLIED');
      await this.journal.save(entry);
      try {
        await this.recheck(input, context, 'APPLIED');
        // Re-read before adding: ID ownership can change across an await.
        const actual = await this.dnr.getSessionRules();
        if (actual.some(rule => rules.some(candidate => candidate.id === rule.id))) throw new Error('RULE_OWNERSHIP_CONFLICT');
        if (rules.length) await this.dnr.updateSessionRules({ addRules: rules });
        const after = await this.dnr.getSessionRules();
        if (!rules.every(rule => after.some(item => sameRule(item, rule)))) throw new Error('APPLY_UNCONFIRMED');
        await this.divert(input, context, input.snapshot.sites);
        await this.recheck(input, context, 'APPLIED');
        entry.observed = 'APPLIED';
        await this.journal.save(entry);
        return { observed: 'APPLIED', duplicate: false };
      } catch (error) {
        entry.desired = 'RELEASED'; entry.observed = 'UNCONFIRMED'; entry.action_seq++;
        try {
          await this.removeOwned(entry);
          entry.observed = 'RELEASED';
          await this.journal.save(entry);
        } catch {
          entry.observed = 'UNCONFIRMED';
          // If storage also fails, the original pre-apply journal still exists.
          try { await this.journal.save(entry); } catch { /* report failure below */ }
          throw new Error('ROLLBACK_UNCONFIRMED', { cause: error });
        }
        throw error;
      }
    });
  }

  release(command) {
    const input = structuredClone(command);
    return this.serial(async () => {
      const context = await this.guard(input, 'RELEASED');
      const entry = await this.journal.load(context.owner_key, input.session_id);
      if (!entry || entry.owner_key !== context.owner_key || entry.executor_id !== context.executor_id
        || entry.session_id !== input.session_id || entry.revision > input.desired_revision) throw new Error('JOURNAL_SCOPE_MISMATCH');
      entry.desired = 'RELEASED'; entry.observed = 'UNCONFIRMED';
      entry.revision = input.desired_revision; entry.action_seq++;
      await this.journal.save(entry);
      await this.recheck(input, context, 'RELEASED');
      await this.removeOwned(entry);
      entry.observed = 'RELEASED';
      await this.journal.save(entry);
      return { observed: 'RELEASED' };
    });
  }

  // Re-created worker can inspect, but never execute, pending commands here.
  inspect(ownerKey, sessionId) {
    return this.serial(async () => {
      const context = await this.getContext();
      if (!context || context.owner_key !== ownerKey || context.session_id !== sessionId) throw new Error('EXECUTION_SCOPE_MISMATCH');
      const entry = await this.journal.load(ownerKey, sessionId);
      if (!entry || entry.owner_key !== ownerKey || entry.session_id !== sessionId
        || entry.executor_id !== context.executor_id) throw new Error('JOURNAL_SCOPE_MISMATCH');
      const actual = await this.checkOwned(entry);
      return { desired: entry.desired, observed: entry.rules.length
        ? (entry.rules.every(rule => actual.some(item => sameRule(item, rule))) ? 'APPLIED'
          : entry.rules.every(rule => !actual.some(item => item.id === rule.id)) ? 'RELEASED' : 'UNCONFIRMED')
        : entry.observed };
    });
  }
}
