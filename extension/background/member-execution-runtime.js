const MemberExecutionRuntime = (() => {
  let loop, server;
  const alarm = 'focurve-member-execution';
  const deadlineAlarm = 'focurve-member-deadline';
  let waking = null, wakeAgain = false, connecting = null;
  // Keep one pending follow-up: END arriving during APPLY must never be dropped.
  function wake() {
    wakeAgain = true;
    if (!waking) waking = (async () => {
      do { wakeAgain = false; await tick(); } while (wakeAgain);
    })().finally(() => { waking = null; if (wakeAgain) wake().catch(() => {}); });
    return waking;
  }
  async function getLoop() {
    const status = await MemberAuthRuntime.status();
    if (!status.owner_user_id || !status.executor_id) return null;
    if (loop && server !== status.server_url) throw new Error('EXECUTION_SCOPE_MISMATCH');
    if (!loop) {
      server = status.server_url;
      const credentials = () => MemberAuthRuntime.credentials();
      const identity = async () => {
        const state = await MemberAuthRuntime.status();
        if (!state.owner_user_id || !state.executor_id || state.server_url !== server) throw new Error('EXECUTION_SCOPE_MISMATCH');
        return { owner_key: 'MEMBER:' + state.owner_user_id, executor_id: state.executor_id };
      };
      const client = new FocurveMemberExecution.MemberExecutionClient({ baseUrl: server, getCredentials: credentials });
      loop = new FocurveMemberExecution.MemberExecutionLoop({ client, getCredentials: credentials, getIdentity: identity,
        dnr: chrome.declarativeNetRequest, tabs: chrome.tabs, blockedPageUrl: chrome.runtime.getURL('blocked/blocked.html'),
        idle: async () => {
          const state = await GuestSession.state();
          if (state && (!['ENDED', 'START_FAILED', 'INTERRUPTED'].includes(state.session.status)
            || state.journal.observed !== 'RELEASED')) throw new Error('GUEST_SESSION_ACTIVE');
        } });
    }
    return loop;
  }
  async function tick() {
    if (!await chrome.alarms.get(alarm)) await chrome.alarms.create(alarm, { periodInMinutes: 0.5 });
    const current = await getLoop();
    if (!current) return { status: 'UNLINKED', session_id: null };
    try {
      const result = await current.tick();
      const end = Date.parse(result.planned_end_at);
      if (result.status === 'RUNNING' && Number.isFinite(end)) {
        const existing = await chrome.alarms.get(deadlineAlarm);
        if (!existing || existing.scheduledTime !== end) await chrome.alarms.create(deadlineAlarm, { when: Math.max(Date.now() + 1, end) });
      } else await chrome.alarms.clear(deadlineAlarm);
      return result;
    }
    catch { return { status: 'UNCONFIRMED', session_id: current.view.session_id }; }
  }
  chrome.alarms.onAlarm.addListener(event => { if ([alarm, deadlineAlarm].includes(event.name)) tick().catch(() => {}); });
  chrome.runtime.onStartup.addListener(() => tick().catch(() => {}));
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (!['DEV_MEMBER_EXECUTION_STATE', 'DEV_MEMBER_EXECUTION_END'].includes(message?.type)) return;
    if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup/popup.html')
      || sender.frameId && sender.frameId !== 0 || typeof message.request_id !== 'string'
      || !message.request_id.length || message.request_id.length > 64) return;
    const operation = message.type === 'DEV_MEMBER_EXECUTION_STATE' ? tick() : getLoop().then(current => {
      if (!current) throw new Error('UNAUTHENTICATED'); return current.end(message.payload?.session_id);
    });
    operation.then(data => respond({ request_id: message.request_id, status: 'OK', data, error: null }))
      .catch(() => respond({ request_id: message.request_id, status: 'ERROR', data: null,
        error: { code: 'EXECUTION_UNCONFIRMED' } }));
    return true;
  });
  // Local Web bridge; neither message authorizes APPLY/END or exposes credentials.
  chrome.runtime.onMessageExternal.addListener((message, sender, respond) => {
    if (sender.id || sender.frameId !== 0 || !Number.isInteger(sender.tab?.id)
      || !message || Object.keys(message).sort().join(',') !== 'owner_context,payload,request_id,type'
      || !['FOCURVE_EXECUTION_WAKE', 'FOCURVE_EXECUTION_CONNECT'].includes(message.type) || message.owner_context !== null
      || typeof message.request_id !== 'string' || !message.request_id.length || message.request_id.length > 64
      || !message.payload || Array.isArray(message.payload)
      || (message.type === 'FOCURVE_EXECUTION_CONNECT' ? Object.keys(message.payload).length !== 0
        : Object.keys(message.payload).join(',') !== 'executor_id'
          || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(message.payload.executor_id))) return;
    (async () => {
      const auth = await MemberAuthRuntime.status();
      let origin; try { origin = new URL(sender.url).origin; } catch { return false; }
      if (auth.phase !== 'LINKED' || origin !== auth.web_origin) return { received: false };
      if (message.type === 'FOCURVE_EXECUTION_CONNECT') {
        if (!connecting) connecting = tick().finally(() => { connecting = null; });
        const state = await connecting;
        const current = await MemberAuthRuntime.status();
        if (['UNCONFIRMED', 'UNLINKED', 'RECOVERY_REQUIRED'].includes(state.status)
          || current.phase !== 'LINKED' || current.executor_id !== auth.executor_id
          || current.owner_user_id !== auth.owner_user_id || current.server_url !== auth.server_url
          || current.web_origin !== origin) throw new Error('CONNECTION_UNCONFIRMED');
        return { executor_id: auth.executor_id };
      }
      if (auth.executor_id !== message.payload.executor_id) return { received: false };
      wake().catch(() => {});
      return { received: true };
    })().then(data => respond({ request_id: message.request_id, status: 'OK', data, error: null }))
      .catch(() => respond({ request_id: message.request_id, status: 'ERROR', data: null, error: { code: 'WAKE_UNAVAILABLE' } }));
    return true;
  });
  tick().catch(() => {});
  return Object.freeze({ tick });
})();
