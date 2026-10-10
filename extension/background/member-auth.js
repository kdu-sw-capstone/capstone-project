// D-09: background-only secrets and durable transitions. Never rewrite guest ownership/data.
(() => {
  const KEY = 'focurve_member_auth';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const token = value => typeof value === 'string' && /^[A-Za-z0-9_-]{32,256}$/.test(value);
  const defaults = { server_url: 'http://127.0.0.1:8080/api/v1', web_origin: 'http://127.0.0.1:5173' };
  const guestAllowed = phase => ['UNREGISTERED', 'REGISTERED'].includes(phase);
  function address(value, api) {
    let url;
    try { url = new URL(value); } catch { throw new Error('INVALID_SERVER_CONFIG'); }
    if (url.username || url.password || url.search || url.hash || url.pathname !== (api ? '/api/v1' : '/') ||
        url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
      throw new Error('INVALID_SERVER_CONFIG');
    return api ? url.href : url.origin;
  }
  class AuthStore {
    constructor(storage = globalThis.chrome.storage.local) { this.storage = storage; }
    async protect() {
      if (!this.storage.setAccessLevel) throw new Error('AUTH_STORAGE_UNAVAILABLE');
      await this.storage.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
    }
    async get() { await this.protect(); return (await this.storage.get(KEY))[KEY] || null; }
    async put(record) { await this.protect(); await this.storage.set({ [KEY]: record }); return record; }
  }
  class MemberAuth {
    constructor({ store, getInstallation, inspectIdle, callbackUri, clientVersion, openApproval,
      fetch = globalThis.fetch.bind(globalThis), crypto = globalThis.crypto, now = Date.now, timeoutMs = 10000 }) {
      Object.assign(this, { store, getInstallation, inspectIdle, callbackUri, clientVersion, openApproval, fetch, crypto, now, timeoutMs });
      this.queue = Promise.resolve();
    }
    serial(fn) { const result = this.queue.then(fn); this.queue = result.catch(() => {}); return result; }
    async load() {
      let record = await this.store.get();
      if (!record) return { phase: 'UNREGISTERED', ...defaults };
      const installation = await this.getInstallation();
      if (!UUID.test(record.executor_id) || record.executor_id !== installation.installation_id) throw new Error('AUTH_INSTALLATION_MISMATCH');
      address(record.server_url, true); address(record.web_origin, false);
      if (['REGISTERING', 'EXCHANGING', 'REFRESHING'].includes(record.phase)) {
        record = await this.store.put({ ...record, phase: record.phase === 'REGISTERING' ? 'REGISTRATION_UNCONFIRMED' : 'AUTH_RECOVERY_REQUIRED', error: 'RESPONSE_UNCONFIRMED' });
      }
      if (record.phase === 'REQUESTING') record = await this.store.put({ ...record, phase: 'REQUEST_UNCONFIRMED', error: 'RESPONSE_UNCONFIRMED' });
      if (['LINK_PENDING', 'REQUEST_UNCONFIRMED'].includes(record.phase) && this.now() >= record.expires_at) {
        record = await this.store.put(this.registered(record, 'LINK_EXPIRED'));
      }
      return record;
    }
    registered(r, error = null) {
      // Keep only installation credentials after an unconsumed request expires/is denied.
      return { phase: 'REGISTERED', executor_id: r.executor_id, server_url: r.server_url,
        web_origin: r.web_origin, installation_proof: r.installation_proof, error };
    }
    publicState(r) {
      return { phase: r.phase, guest_start_allowed: guestAllowed(r.phase), server_url: r.server_url,
        web_origin: r.web_origin, callback_uri: this.callbackUri, executor_id: r.executor_id || null,
        owner_user_id: r.owner_user_id || null, link_request_id: r.link_request_id || null,
        expires_at: r.expires_at ? new Date(r.expires_at).toISOString() : null, error: r.error || null };
    }
    status() { return this.serial(async () => this.publicState(await this.load())); }
    guardGuestStart(operation) { return this.serial(async () => {
      if (!guestAllowed((await this.load()).phase)) throw new Error('ACCOUNT_TRANSITION_ACTIVE');
      return operation();
    }); }
    async request(r, path, body, headers = {}) {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const result = await this.fetch(r.server_url + path, { method: body == null ? 'GET' : 'POST',
          headers: { 'Content-Type': 'application/json', ...headers }, ...(body == null ? {} : { body: JSON.stringify(body) }),
          credentials: 'omit', redirect: 'error', cache: 'no-store', signal: controller.signal });
        if (!result.ok) {
          let code; try { code = (await result.json()).error?.code; } catch {}
          const known = ['INSTALLATION_EXISTS', 'INVALID_CALLBACK', 'INVALID_INSTALLATION', 'INVALID_STATE', 'LINK_EXPIRED',
            'INVALID_GRANT', 'TOKEN_REUSE', 'IDENTITY_ALREADY_LINKED', 'GUEST_SESSION_ACTIVE', 'ACTIVE_SESSION_EXISTS',
            'EXECUTION_EVIDENCE_REQUIRED', 'RELEASE_UNCONFIRMED', 'INVALID_TOKEN', 'UNAUTHENTICATED'];
          const error = new Error(known.includes(code) ? code : 'AUTH_HTTP_' + result.status);
          error.definitive = result.status >= 400 && result.status < 500;
          throw error;
        }
        return await result.json();
      } catch (error) {
        if (error.definitive) throw error;
        throw new Error('AUTH_RESPONSE_UNCONFIRMED');
      } finally { clearTimeout(timer); }
    }
    random() {
      return btoa(String.fromCharCode(...this.crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
    }
    async evidence(r) {
      const observation = await this.inspectIdle();
      if (!observation || observation.active_session_id !== null || !Array.isArray(observation.owned_rule_ids) ||
          observation.owned_rule_ids.length || observation.pending_action_count !== 0) throw new Error('GUEST_SESSION_ACTIVE');
      const result = await this.request(r, '/extension-link-requests/' + r.link_request_id + '/evidence', {
        observation_id: this.crypto.randomUUID(), link_request_id: r.link_request_id, owner_context: 'GUEST:' + r.executor_id,
        transition: 'LINK_PENDING', active_session_id: null, owned_rule_ids: [], pending_action_count: 0,
        observed_at: new Date(this.now()).toISOString() }, { 'X-Installation-Proof': r.installation_proof });
      if (result.accepted !== true) throw new Error('INVALID_AUTH_RESPONSE');
    }
    begin(config) { return this.serial(async () => {
      let r = await this.load();
      if (!guestAllowed(r.phase)) throw new Error('ACCOUNT_TRANSITION_ACTIVE');
      const server_url = address(config?.server_url || r.server_url, true), web_origin = address(config?.web_origin || r.web_origin, false);
      if (r.installation_proof && r.server_url !== server_url) throw new Error('AUTH_SERVER_BOUND');
      const idle = await this.inspectIdle();
      if (idle.active_session_id !== null || idle.owned_rule_ids.length || idle.pending_action_count !== 0) throw new Error('GUEST_SESSION_ACTIVE');
      const installation = await this.getInstallation();
      r = { ...r, server_url, web_origin, executor_id: installation.installation_id };
      if (!r.installation_proof) {
        r = await this.store.put({ ...r, phase: 'REGISTERING', error: null });
        try {
          const result = await this.request(r, '/extension-installations', { executor_id: r.executor_id, client_version: this.clientVersion });
          if (result.executor_id !== r.executor_id || !token(result.installation_proof)) throw new Error('INVALID_AUTH_RESPONSE');
          r = await this.store.put({ ...r, phase: 'REGISTERED', installation_proof: result.installation_proof });
        } catch (error) {
          await this.store.put({ ...r, phase: error.definitive && error.message !== 'INSTALLATION_EXISTS' ? 'UNREGISTERED' : 'REGISTRATION_UNCONFIRMED', error: error.message }); throw error;
        }
      }
      const verifier = this.random(), state = this.random();
      const hash = new Uint8Array(await this.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
      const challenge = btoa(String.fromCharCode(...hash)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
      r = await this.store.put({ ...r, phase: 'REQUESTING', verifier, state, expires_at: this.now() + 300000, error: null });
      try {
        const result = await this.request(r, '/extension-link-requests', { executor_id: r.executor_id,
          code_challenge: challenge, state, callback_uri: this.callbackUri }, { 'X-Installation-Proof': r.installation_proof });
        const expires = Date.parse(result.expires_at);
        if (!UUID.test(result.link_request_id) || !Number.isFinite(expires) || expires <= this.now() || expires > this.now() + 305000 ||
            result.verification_uri !== web_origin + '/#link?id=' + result.link_request_id) throw new Error('INVALID_AUTH_RESPONSE');
        r = await this.store.put({ ...r, phase: 'LINK_PENDING', link_request_id: result.link_request_id, expires_at: expires });
        await this.evidence(r);
        await this.openApproval(result.verification_uri);
        return this.publicState(r);
      } catch (error) {
        if (r.phase === 'REQUESTING') await this.store.put(error.definitive ? this.registered(r, error.message) : { ...r, phase: 'REQUEST_UNCONFIRMED', error: error.message });
        // A known pending request remains recoverable by fresh evidence/claim; no silent success.
        else await this.store.put({ ...r, error: error.message });
        throw error;
      }
    }); }
    poll() { return this.serial(async () => {
      let r = await this.load();
      if (r.phase === 'LINKED') {
        try { return this.publicState(await this.verifyOwner(await this.refreshIfNeeded(r))); }
        catch (error) { const latest = await this.store.get(); await this.store.put({ ...latest, phase: 'AUTH_RECOVERY_REQUIRED', error: error.message }); throw error; }
      }
      if (r.phase === 'VERIFYING') return this.publicState(await this.verifyOwner(r));
      if (r.phase !== 'LINK_PENDING') return this.publicState(r);
      try {
        await this.evidence(r);
        const result = await this.request(r, '/extension-link-requests/' + r.link_request_id + '/claim', { state: r.state }, { 'X-Installation-Proof': r.installation_proof });
        if (result.status === 'PENDING') return this.publicState(r);
        if (result.status !== 'APPROVED' || result.state !== r.state || !token(result.code)) throw new Error('INVALID_AUTH_RESPONSE');
        r = await this.store.put({ ...r, phase: 'EXCHANGING', error: null });
        const tokens = await this.request(r, '/extension-tokens', { link_request_id: r.link_request_id, code: result.code, code_verifier: r.verifier }, { 'X-Installation-Proof': r.installation_proof });
        r = await this.saveTokens(r, tokens);
        return this.publicState(await this.verifyOwner(r));
      } catch (error) {
        if (r.phase === 'EXCHANGING') await this.store.put({ ...r, phase: 'AUTH_RECOVERY_REQUIRED', error: error.message });
        else if (error.message === 'LINK_EXPIRED') await this.store.put(this.registered(r, error.message));
        else await this.store.put({ ...r, error: error.message });
        throw error;
      }
    }); }
    async saveTokens(r, result) {
      if (!token(result.access_token) || !token(result.refresh_token) || !Number.isSafeInteger(result.expires_in) || result.expires_in < 1 || result.expires_in > 900) throw new Error('INVALID_AUTH_RESPONSE');
      const saved = { ...r, phase: 'VERIFYING', access_token: result.access_token, refresh_token: result.refresh_token,
        access_expires_at: this.now() + result.expires_in * 1000, error: null };
      delete saved.verifier; delete saved.state;
      return this.store.put(saved);
    }
    async verifyOwner(r) {
      const user = await this.request(r, '/auth/me', null, { Authorization: 'Bearer ' + r.access_token });
      if (typeof user.user_id !== 'string' || !/^[1-9][0-9]*$/.test(user.user_id) || r.owner_user_id && r.owner_user_id !== user.user_id)
        throw new Error('AUTH_OWNER_MISMATCH');
      return this.store.put({ ...r, phase: 'LINKED', owner_user_id: user.user_id, error: null });
    }
    async refreshIfNeeded(r) {
      if (this.now() >= r.access_expires_at - 60000) {
        r = await this.store.put({ ...r, phase: 'REFRESHING', error: null });
        try {
          const result = await this.request(r, '/extension-tokens/refresh', { refresh_token: r.refresh_token });
          r = await this.saveTokens(r, result);
          r = await this.verifyOwner(r);
        } catch (error) { await this.store.put({ ...r, phase: 'AUTH_RECOVERY_REQUIRED', error: error.message }); throw error; }
      }
      return r;
    }
    credentials() { return this.serial(async () => {
      let r = await this.load();
      if (r.phase === 'VERIFYING') r = await this.verifyOwner(r);
      if (r.phase !== 'LINKED') throw new Error('MEMBER_AUTH_REQUIRED');
      r = await this.refreshIfNeeded(r);
      return { owner_key: 'MEMBER:' + r.owner_user_id, executor_id: r.executor_id, access_token: r.access_token };
    }); }
  }
  globalThis.FocurveMemberAuth = Object.freeze({ MemberAuth, AuthStore });
})();
