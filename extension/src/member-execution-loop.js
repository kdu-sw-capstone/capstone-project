import { MemberJournalStore } from './member-journal-store.js';
import { SiteController } from './site-controller.js';
import { parseServerTime } from './server-time.js';
import { sameRule } from './site-rules.js';
import { MemberAccessCollector } from './member-access.js';

const finished = state => ['ENDED', 'START_FAILED'].includes(state.execution_status);
export function requireSiteOnly(snapshot) {
  if (!Array.isArray(snapshot?.sites) || snapshot.sites.some(site => !Array.isArray(site.feature_policies) || site.feature_policies.length))
    throw new Error('FEATURE_NOT_IMPLEMENTED');
  const policy = snapshot.content_policy;
  if (!policy || !['keywords', 'adult_domains', 'image_blur', 'usage_tracking'].every(key => policy[key]?.enabled === false)
    || Object.keys(policy).some(key => !['version', 'keywords', 'adult_domains', 'image_blur', 'usage_tracking'].includes(key)))
    throw new Error('FEATURE_NOT_IMPLEMENTED');
}

// Background-only coordinator. Control metadata is durable separately from the
// SiteController journal, so a crash before/after apply never invents new IDs.
export class MemberExecutionLoop {
  constructor({ client, getCredentials, getIdentity = getCredentials, idle, dnr, tabs, blockedPageUrl,
    accessStore, journal = new MemberJournalStore(), control = new MemberJournalStore({ name: 'focurve-member-control' }),
    now = Date.now, randomUUID = () => crypto.randomUUID() }) {
    Object.assign(this, { client, getCredentials, getIdentity, idle, journal, control, now, randomUUID });
    this.queue = Promise.resolve(); this.recovered = new Set(); this.command = null;
    this.controller = new SiteController({ dnr, tabs, journal, blockedPageUrl, now,
      getContext: () => this.context() });
    this.access = new MemberAccessCollector({store:accessStore,getContext: at => this.accessContext(at), blockedPageUrl});
    this.view = { status: 'IDLE', session_id: null };
  }
  serial(work) { const result = this.queue.then(work); this.queue = result.catch(() => {}); return result; }
  async context() {
    const credentials = await this.getCredentials(), command = this.command;
    if (!command) throw new Error('RECONCILE_REQUIRED');
    const session = await this.client.session(command.session_id);
    if (session.executor_id !== credentials.executor_id || command.executor_id !== credentials.executor_id
      || session.desired_revision !== command.desired_revision) throw new Error('STALE_COMMAND');
    const applying = command.type === 'APPLY_POLICY';
    if (applying && (session.automatic_recovery_supported !== false || session.time_accounting_mode !== 'LEGACY_WALL_CLOCK'))
      throw new Error('TIME_ACCOUNTING_UNSUPPORTED');
    if (applying && (!['STARTING', 'UNKNOWN'].includes(session.execution_status)
      || session.policy_snapshot_id !== command.snapshot.policy_snapshot_id || session.duration_minutes !== command.duration_minutes)
      || !applying && !['ENDING', 'UNKNOWN', 'STARTING'].includes(session.execution_status)) throw new Error('STALE_COMMAND');
    // Fresh authenticated command + current session + idle/journal checks is the
    // initial execution authorization. POST reconcile is for persisted recovery;
    // sending RELEASED before first APPLY would supersede that new APPLY.
    return { owner_key: credentials.owner_key, executor_id: credentials.executor_id,
      session_id: command.session_id, revision: command.desired_revision,
      desired: applying ? 'APPLIED' : 'RELEASED', reconciled: true };
  }
  async scope(row) {
    const credentials = await this.getIdentity();
    if (row.owner_key !== credentials.owner_key || row.executor_id !== credentials.executor_id
      || row.base_url !== this.client.baseUrl) throw new Error('EXECUTION_SCOPE_MISMATCH');
  }
  summary(row, observed) {
    return { format_version: '1.1', session_id: row.session_id, known_revision: row.revision,
      last_report_id: null, last_access_seq: 0, last_local_seq: 0,
      observed_at: new Date(this.now()).toISOString(), observed_state: observed, final: false };
  }
  intervals(row, end) {
    if (!row.applied_at) return [];
    const interval = { interval_id: row.interval_id, kind: 'RUN', start_at: row.applied_at, quality: 'CONFIRMED' };
    if (end != null) Object.assign(interval, { end_at: new Date(end).toISOString(), duration_ms: end - parseServerTime(row.applied_at) });
    return [interval];
  }
  async saveReport(row, command, result, extra = {}) {
    await this.scope(row);
    const report = { report_id: this.randomUUID(), command_id: command.command_id,
      session_id: row.session_id, executor_id: row.executor_id, desired_revision: command.desired_revision,
      result, observed_at: result === 'APPLIED' ? row.applied_at : new Date(this.now()).toISOString(), intervals: this.intervals(row,
        result === 'RELEASED' ? row.run_end_ms : null), ...extra };
    row.reports.push(report); await this.control.save(row);
    await this.client.enqueue(report, row);
  }
  async cleanup(row) {
    await this.scope(row);
    const journal = await this.journal.load(row.owner_key, row.session_id);
    if (!journal) {
      if ((await this.controller.dnr.getSessionRules()).length) throw new Error('RELEASE_UNCONFIRMED');
      return;
    }
    if (journal.executor_id !== row.executor_id || journal.owner_key !== row.owner_key) throw new Error('JOURNAL_SCOPE_MISMATCH');
    journal.desired = 'RELEASED'; journal.observed = 'UNCONFIRMED'; await this.journal.save(journal);
    await this.scope(row); await this.controller.removeOwned(journal);
    journal.observed = 'RELEASED'; await this.journal.save(journal);
  }
  async localEnd(row, reason) {
    await this.cleanup(row);
    if (!row.local_end) {
      const releasedAt = new Date(this.now()).toISOString();
      const end = row.run_end_ms ?? Math.max(parseServerTime(row.applied_at) || 0,
        Math.min(this.now(), row.checkpoint_ms ?? this.now(), parseServerTime(row.planned_end_at) || this.now()));
      row.run_end_ms = end;
      row.local_end = { action_id: this.randomUUID(), local_action_seq: 1, session_id: row.session_id,
        base_revision: row.revision, type: 'END', observed_at: releasedAt, reason,
        report: { report_id: this.randomUUID(), command_id: null, executor_id: row.executor_id,
          session_id: row.session_id, desired_revision: row.revision, result: 'RELEASED',
          observed_at: releasedAt, intervals: this.intervals(row, end) } };
      row.phase = 'ENDING'; await this.control.save(row);
    }
    await this.scope(row);
    let ack;
    try { ack = await this.client.reconcile({ journal_summary: this.summary(row, 'RELEASED'), local_actions: [row.local_end] }); }
    catch (error) {
      // A concurrent Server RELEASE may already have ended this session. Verify
      // that terminal state rather than repeatedly submitting a new local END.
      if (error.status === 409 && finished(await this.client.session(row.session_id))) {
        row.phase = 'FINAL'; row.local_action_unconfirmed = true; await this.control.save(row); return;
      }
      throw error;
    }
    if (ack.desired_state !== 'RELEASED' || !ack.acknowledged_actions.some(item => item.action_id === row.local_end.action_id && item.status === 'ACCEPTED'))
      throw new Error('RELEASE_UNCONFIRMED');
    row.phase = 'FINAL'; await this.control.save(row);
  }
  async recover(row) {
    await this.scope(row);
    const session = await this.client.session(row.session_id);
    if (finished(session)) { await this.cleanup(row); row.phase = 'FINAL'; await this.control.save(row); return; }
    this.view = { status: 'UNCONFIRMED', session_id: row.session_id };
    if (row.local_end) { await this.localEnd(row, row.local_end.reason); return; }
    if (row.phase === 'PREPARING') {
      // An interrupted preparation is never replayed as a fresh APPLY.
      const entry = await this.journal.load(row.owner_key, row.session_id);
      if (entry?.applied_at) Object.assign(row, { applied_at: entry.applied_at,
        planned_end_at: entry.planned_end_at, checkpoint_ms: parseServerTime(entry.applied_at) });
      await this.cleanup(row); row.run_end_ms = row.checkpoint_ms;
      row.phase = 'RECOVERY_REQUIRED'; await this.control.save(row); return;
    }
    if (row.phase === 'RECOVERY_REQUIRED' && row.planned_end_at && this.now() >= parseServerTime(row.planned_end_at)) {
      await this.localEnd(row, 'EXPIRED'); return;
    }
    if (row.phase !== 'APPLIED') return;
    const journal = await this.journal.load(row.owner_key, row.session_id);
    let observed = 'UNCONFIRMED';
    if (journal) {
      const actual = await this.controller.checkOwned(journal);
      if (journal.observed === 'APPLIED' && journal.rules.every(rule => actual.some(item =>
        sameRule(item, rule)))) observed = 'APPLIED';
    }
    if (observed !== 'APPLIED') {
      await this.cleanup(row); row.run_end_ms = row.checkpoint_ms ?? parseServerTime(row.applied_at);
      row.phase = 'RECOVERY_REQUIRED'; await this.control.save(row); return;
    }
    if (session.desired_revision !== row.revision || session.execution_status !== 'RUNNING') return;
    if (!this.recovered.has(row.session_id)) {
      const result = await this.client.reconcile({ journal_summary: this.summary(row, observed), local_actions: [] });
      if (result.desired_state !== 'APPLIED' || result.revision !== row.revision) throw new Error('RECONCILE_REQUIRED');
      this.recovered.add(row.session_id);
    }
    const verified = await this.controller.checkOwned(journal);
    if (!journal.rules.every(rule => verified.some(item => sameRule(item, rule)))) {
      await this.cleanup(row); row.run_end_ms = row.checkpoint_ms ?? parseServerTime(row.applied_at);
      row.phase = 'RECOVERY_REQUIRED'; await this.control.save(row);
      this.view = { status: 'RECOVERY_REQUIRED', session_id: row.session_id }; return;
    }
    if (this.now() >= parseServerTime(row.planned_end_at)) { await this.localEnd(row, 'EXPIRED'); return; }
    row.checkpoint_ms = this.now(); await this.control.save(row);
    this.view = { status: 'RUNNING', session_id: row.session_id, planned_end_at: row.planned_end_at };
  }
  async execute(command, credentials) {
    this.command = command;
    let row = await this.control.load(credentials.owner_key, command.session_id);
    await this.context();
    if (command.type === 'APPLY_POLICY') {
      if (row) return; // Crash or duplicate never starts a second timer/application.
      await this.idle();
      if ((await this.controller.dnr.getSessionRules()).length) throw new Error('EXECUTION_EVIDENCE_REQUIRED');
      row = { owner_key: credentials.owner_key, executor_id: credentials.executor_id, session_id: command.session_id,
        base_url: this.client.baseUrl, revision: command.desired_revision, phase: 'PREPARING', reports: [],
        interval_id: this.randomUUID(), command };
      await this.control.save(row);
      try {
        requireSiteOnly(command.snapshot); await this.controller.apply(command);
        const journal = await this.journal.load(row.owner_key, row.session_id);
        Object.assign(row, { phase: 'APPLIED', applied_at: journal.applied_at, planned_end_at: journal.planned_end_at,
          checkpoint_ms: parseServerTime(journal.applied_at) });
      } catch (error) {
        // Storage failure after confirmed apply is uncertain, never an invented FAILED.
        const journal = await this.journal.load(row.owner_key, row.session_id);
        const uncertain = journal && journal.observed !== 'RELEASED';
        row.phase = 'RECOVERY_REQUIRED';
        await this.saveReport(row, command, uncertain ? 'UNCONFIRMED' : 'FAILED', {
          intervals: [], error_code: /^[A-Z][A-Z0-9_]{0,79}$/.test(error.message) ? error.message : 'EXECUTION_UNCONFIRMED',
          rollback_confirmed: !uncertain });
        this.view = { status: 'RECOVERY_REQUIRED', session_id: row.session_id };
        return;
      }
      await this.saveReport(row, command, 'APPLIED');
    } else {
      if (!row) {
        // No evidence from an older client: unknown existing rules must survive.
        if ((await this.controller.dnr.getSessionRules()).length) throw new Error('EXECUTION_EVIDENCE_REQUIRED');
        row = { owner_key: credentials.owner_key, executor_id: credentials.executor_id, session_id: command.session_id,
          base_url: this.client.baseUrl, revision: command.desired_revision, reports: [] };
      }
      await this.scope(row);
      if (row.reports.some(report => report.command_id === command.command_id && report.result === 'RELEASED')) return;
      row.run_end_ms ??= row.applied_at ? Math.max(parseServerTime(row.applied_at), this.now()) : 0;
      await this.cleanup(row); row.revision = command.desired_revision; row.phase = 'RELEASED';
      await this.saveReport(row, command, 'RELEASED');
    }
  }
  tick() {
    return this.serial(async () => {
      this.view = { status: 'CHECKING', session_id: this.view.session_id };
      // Safety cleanup must precede network/auth refresh. Local identity grants
      // removal of owned rules only; it can never authorize a new APPLY.
      const identity = await this.getIdentity();
      for (const row of await this.control.list(identity.owner_key, identity.executor_id)) {
        if (row.phase !== 'FINAL') this.view.session_id = row.session_id;
        if (row.phase !== 'FINAL' && (row.local_end || ['APPLIED', 'RECOVERY_REQUIRED', 'PREPARING'].includes(row.phase)
          && row.planned_end_at && this.now() >= parseServerTime(row.planned_end_at)))
          await this.localEnd(row, row.local_end?.reason || 'EXPIRED');
      }
      const credentials = await this.getCredentials();
      for (const row of await this.control.list(credentials.owner_key, credentials.executor_id)) {
        if (row.base_url !== this.client.baseUrl) throw new Error('EXECUTION_SCOPE_MISMATCH');
        await this.scope(row);
        for (const report of row.reports || []) await this.client.enqueue(report, row);
      }
      await this.client.flush();
      for (const row of await this.control.list(credentials.owner_key, credentials.executor_id)) {
        if (row.phase !== 'FINAL') {
          await this.recover(row);
          if (row.phase === 'RECOVERY_REQUIRED' || row.phase === 'PREPARING') this.view = { status: 'RECOVERY_REQUIRED', session_id: row.session_id };
        }
      }
      for (const command of (await this.client.commands()).commands) await this.execute(command, credentials);
      await this.client.flush();
      for (const row of await this.control.list(credentials.owner_key, credentials.executor_id)) {
        if (row.phase === 'APPLIED') await this.recover(row);
      }
      if (this.view.status === 'CHECKING') this.view = { status: 'IDLE', session_id: null };
      return structuredClone(this.view);
    });
  }
  async accessContext(at) {
    if (this.view.status !== 'RUNNING' || !this.recovered.has(this.view.session_id)) return null;
    const identity = await this.getIdentity(), row = await this.control.load(identity.owner_key, this.view.session_id);
    if (!row || row.phase !== 'APPLIED' || row.local_end || row.executor_id !== identity.executor_id
      || row.base_url !== this.client.baseUrl || at < parseServerTime(row.applied_at)
      || at >= parseServerTime(row.planned_end_at) || this.now() >= parseServerTime(row.planned_end_at)) return null;
    const journal = await this.journal.load(row.owner_key, row.session_id);
    if (!journal || journal.revision !== row.revision || journal.desired !== 'APPLIED' || journal.observed !== 'APPLIED') return null;
    const actual = await this.controller.checkOwned(journal);
    if (!journal.rules.every(rule => actual.some(item => sameRule(item, rule)))) return null;
    requireSiteOnly(row.command.snapshot);
    const fresh = await this.getIdentity();
    if (fresh.owner_key !== identity.owner_key || fresh.executor_id !== identity.executor_id) return null;
    return {owner_key:row.owner_key,executor_id:row.executor_id,base_url:row.base_url,session_id:row.session_id,
      revision:row.revision,applied_at:row.applied_at,snapshot:structuredClone(row.command.snapshot)};
  }
  observe(stage,details) {
    if (this.view.status !== 'RUNNING') return Promise.resolve(null);
    return this.serial(() => this.access.observe(stage,details)).catch(error => {this.accessError='ACCESS_STORAGE_UNCONFIRMED';throw error;});
  }
  end(sessionId) {
    return this.serial(async () => {
      const credentials = await this.getIdentity(), row = await this.control.load(credentials.owner_key, sessionId);
      if (!row || row.phase === 'FINAL') throw new Error('SESSION_NOT_FOUND');
      await this.localEnd(row, 'MANUAL'); return { status: 'RELEASED', session_id: sessionId };
    });
  }
}
