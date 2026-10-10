const MemberExecutionRuntime = (() => {
  let loop, server;
  const alarm = 'focurve-member-execution';
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
    await chrome.alarms.create(alarm, { periodInMinutes: 0.5 });
    const current = await getLoop();
    if (!current) return { status: 'UNLINKED', session_id: null };
    try { return await current.tick(); }
    catch { return { status: 'UNCONFIRMED', session_id: current.view.session_id }; }
  }
  chrome.alarms.onAlarm.addListener(event => { if (event.name === alarm) tick().catch(() => {}); });
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
  tick().catch(() => {});
  return Object.freeze({ tick });
})();
