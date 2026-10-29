// No external/Content messages may trigger authentication or receive credentials.
const MemberAuthRuntime = (() => {
  const alarmName = 'focurve-member-link';
  async function inspectIdle() {
    const state = await GuestSession.state();
    const actual = await chrome.declarativeNetRequest.getSessionRules();
    const owned = new Set(state?.journal?.rules?.map(rule => rule.id) || []);
    const owned_rule_ids = actual.filter(rule => owned.has(rule.id)).map(rule => rule.id);
    const terminal = !state || ['ENDED', 'INTERRUPTED', 'START_FAILED'].includes(state.session.status);
    const confirmed = !state || state.journal.observed === 'RELEASED';
    return { active_session_id: terminal ? null : state.session.session_id, owned_rule_ids,
      // Without a journal, existing rules cannot be certified as unrelated/fully released.
      // Keep them intact and require recovery; never claim empty execution evidence.
      pending_action_count: terminal && confirmed && (state || actual.length === 0) ? 0 : 1 };
  }
  const auth = new FocurveMemberAuth.MemberAuth({ store: new FocurveMemberAuth.AuthStore(),
    getInstallation: () => LocalStore.guestContext(), inspectIdle,
    callbackUri: chrome.runtime.getURL('popup/popup.html'), clientVersion: chrome.runtime.getManifest().version,
    openApproval: async url => {
      await chrome.alarms.create(alarmName, { periodInMinutes: 0.5 });
      await chrome.tabs.create({ url });
    } });
  async function poll() {
    const result = await auth.poll();
    if (result.phase !== 'LINK_PENDING') await chrome.alarms.clear(alarmName);
    return result;
  }
  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === alarmName) poll().catch(() => {}); // Safe UI error state is persisted, never log credentials.
  });
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (!['FOCURVE_AUTH_STATUS', 'FOCURVE_AUTH_BEGIN', 'FOCURVE_AUTH_POLL'].includes(message?.type)) return;
    if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup/popup.html') ||
        sender.frameId && sender.frameId !== 0 || typeof message.request_id !== 'string' ||
        !message.request_id.length || message.request_id.length > 64) return;
    const operation = message.type === 'FOCURVE_AUTH_BEGIN' ? auth.begin(message.payload) :
      message.type === 'FOCURVE_AUTH_POLL' ? poll() : auth.status();
    operation.then(data => respond({ request_id: message.request_id, status: 'OK', data, error: null }))
      .catch(async error => {
        let data = null; try { data = await auth.status(); } catch {}
        const allowed = ['GUEST_SESSION_ACTIVE', 'ACCOUNT_TRANSITION_ACTIVE', 'AUTH_SERVER_BOUND', 'INVALID_SERVER_CONFIG',
          'INSTALLATION_EXISTS', 'INVALID_CALLBACK', 'INVALID_INSTALLATION', 'INVALID_STATE', 'LINK_EXPIRED',
          'INVALID_GRANT', 'TOKEN_REUSE', 'IDENTITY_ALREADY_LINKED', 'ACTIVE_SESSION_EXISTS', 'EXECUTION_EVIDENCE_REQUIRED',
          'RELEASE_UNCONFIRMED', 'INVALID_TOKEN', 'UNAUTHENTICATED', 'AUTH_RESPONSE_UNCONFIRMED', 'INVALID_AUTH_RESPONSE', 'AUTH_OWNER_MISMATCH'];
        respond({ request_id: message.request_id, status: 'ERROR', data, error: {
          code: allowed.includes(error.message) ? error.message : 'AUTH_OPERATION_FAILED' } });
      });
    return true;
  });
  // Credentials are available only to a future background member command/event caller.
  return Object.freeze({ guardGuestStart: operation => auth.guardGuestStart(operation), credentials: () => auth.credentials(),
    status: () => auth.status() });
})();
