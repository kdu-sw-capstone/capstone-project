const MemberExecutionRuntime = (() => {
  let loop, server, accessDelivery, delivering, deliveryAgain = false;
  const storageFailure = error => ['MEMBER_STORAGE_UNAVAILABLE','MEMBER_STORAGE_BLOCKED','ACCESS_STORAGE_UNAVAILABLE'].includes(error?.message);
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
      const credentials = async () => {
        const state = await MemberAuthRuntime.status();
        if (state.server_url !== server) throw new Error('EXECUTION_SCOPE_MISMATCH');
        const value = await MemberAuthRuntime.credentials();
        const fresh = await MemberAuthRuntime.status();
        if (fresh.server_url !== server || fresh.executor_id !== value.executor_id
          || 'MEMBER:' + fresh.owner_user_id !== value.owner_key) throw new Error('EXECUTION_SCOPE_MISMATCH');
        return value;
      };
      const identity = async () => {
        const state = await MemberAuthRuntime.status();
        if (!state.owner_user_id || !state.executor_id || state.server_url !== server) throw new Error('EXECUTION_SCOPE_MISMATCH');
        return { owner_key: 'MEMBER:' + state.owner_user_id, executor_id: state.executor_id };
      };
      const client = new FocurveMemberExecution.MemberExecutionClient({ baseUrl: server, getCredentials: credentials });
      accessDelivery = new FocurveMemberEvents.MemberEventDelivery({baseUrl:server,getCredentials:credentials,
        store:new FocurveMemberEvents.MemberEventStore({name:'focurve-member-events:'+encodeURIComponent(server)})});
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
  // Copy durable originals into the existing delivery outbox; ack deletes only staging originals.
  function deliverAccess() {
    if (!loop || !accessDelivery) return Promise.resolve();
    deliveryAgain = true;
    if (delivering) return delivering;
    delivering = (async () => {
      do {
        deliveryAgain = false;
        const identity = await MemberAuthRuntime.status();
        const owner = 'MEMBER:' + identity.owner_user_id;
        const originals = await loop.access.store.originals(owner,identity.executor_id,server);
        const transferred = originals.length ? await FocurveMemberEvents.transferOriginals(originals,loop.access.store,accessDelivery) : [];
        const receipts = await accessDelivery.flush();
        loop.accessPending = receipts.filter(r=>!['ACKED','REJECTED','LOCAL_REVIEW_REQUIRED'].includes(r.status)).length;
        for (const original of transferred) if (receipts.some(r=>r.event_id===original.event_id&&r.owner_key===original.owner_key&&r.executor_id===original.executor_id&&r.body===original.body&&['ACKED','REJECTED'].includes(r.status)))
          await loop.access.store.acknowledged(original.scope,original.event_id);
        loop.deliveryError = null;
      } while (deliveryAgain);
    })().catch(error=>{loop.deliveryError=storageFailure(error)?'ACCESS_DELIVERY_STORAGE_UNCONFIRMED':'ACCESS_DELIVERY_UNCONFIRMED';throw error;}).finally(()=>{delivering=null;if(deliveryAgain)deliverAccess().catch(()=>{});});
    return delivering;
  }
  async function observe(stage,details) {
    await ready;
    if (loop?.view.status === 'CHECKING') await loop.queue;
    if (!loop || loop.view.status !== 'RUNNING') return Promise.resolve(null);
    return loop.observe(stage,details).then(event=>{if(event)deliverAccess().catch(()=>{});return event;});
  }
  async function tick() {
    if (!await chrome.alarms.get(alarm)) await chrome.alarms.create(alarm, { periodInMinutes: 0.5 });
    const current = await getLoop();
    if (!current) return { status: 'UNLINKED', session_id: null };
    try {
      const result = await current.tick();
      deliverAccess().catch(()=>{});
      const end = Date.parse(result.planned_end_at);
      if (result.status === 'RUNNING' && Number.isFinite(end)) {
        const existing = await chrome.alarms.get(deadlineAlarm);
        if (!existing || existing.scheduledTime !== end) await chrome.alarms.create(deadlineAlarm, { when: Math.max(Date.now() + 1, end) });
      } else await chrome.alarms.clear(deadlineAlarm);
      return {...result,...((current.accessError||current.deliveryError)?{access_error:current.accessError||current.deliveryError}:{}),...(current.accessPending?{access_pending:current.accessPending}:{})};
    }
    catch { return { status: 'UNCONFIRMED', session_id: current.view.session_id }; }
  }
  async function deliveryState(recheck = false) {
    const before = await MemberAuthRuntime.status();
    const allowed = state => state.owner_user_id && state.executor_id
      && ['LINKED', 'AUTH_RECOVERY_REQUIRED', 'REFRESHING', 'VERIFYING'].includes(state.phase);
    if (!allowed(before)) throw new Error('UNAUTHENTICATED');
    const same = state => allowed(state) && state.owner_user_id === before.owner_user_id
      && state.executor_id === before.executor_id && state.server_url === before.server_url;
    const current = await getLoop();
    if (!current || !same(await MemberAuthRuntime.status())) throw new Error('EXECUTION_SCOPE_MISMATCH');
    if (recheck) {
      if (before.phase !== 'LINKED') throw new Error('AUTH_REQUIRED');
      await deliverAccess();
    }
    const scope = {owner_key:'MEMBER:'+before.owner_user_id,executor_id:before.executor_id,base_url:before.server_url};
    // Read staging first: an enqueue/ACK between reads must not make a durable event disappear.
    const originals = await current.access.store.originals(scope.owner_key,scope.executor_id,scope.base_url);
    const records = await accessDelivery.store.list(scope.owner_key,scope.executor_id);
    if (!same(await MemberAuthRuntime.status())) throw new Error('EXECUTION_SCOPE_MISMATCH');
    return FocurveMemberEvents.summarize(records,originals,scope);
  }
  chrome.alarms.onAlarm.addListener(event => { if ([alarm, deadlineAlarm].includes(event.name)) tick().catch(() => {}); });
  chrome.runtime.onStartup.addListener(() => tick().catch(() => {}));
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (!['DEV_MEMBER_EXECUTION_STATE', 'DEV_MEMBER_EXECUTION_END', 'MEMBER_DELIVERY_STATE', 'MEMBER_DELIVERY_RECHECK'].includes(message?.type)) return;
    if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup/popup.html')
      || sender.frameId && sender.frameId !== 0 || typeof message.request_id !== 'string'
      || !message.request_id.length || message.request_id.length > 64) return;
    if (message.type.startsWith('MEMBER_DELIVERY_') && (!message.payload || typeof message.payload !== 'object'
      || Array.isArray(message.payload) || Object.keys(message.payload).length
      || Object.keys(message).some(key => !['type','request_id','payload'].includes(key)))) return;
    const operation = message.type.startsWith('MEMBER_DELIVERY_') ? deliveryState(message.type === 'MEMBER_DELIVERY_RECHECK')
      : message.type === 'DEV_MEMBER_EXECUTION_STATE' ? tick() : getLoop().then(current => {
      if (!current) throw new Error('UNAUTHENTICATED'); return current.end(message.payload?.session_id);
    });
    operation.then(data => respond({ request_id: message.request_id, status: 'OK', data, error: null }))
      .catch(error => respond({ request_id: message.request_id, status: 'ERROR', data: null,
        error: { code: message.type.startsWith('MEMBER_DELIVERY_')&&storageFailure(error)?'DELIVERY_STORAGE_UNAVAILABLE':'EXECUTION_UNCONFIRMED' } }));
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
  const ready = tick().catch(() => {});
  return Object.freeze({ tick, observe, forget: tabId => loop?.access.forget(tabId) ?? Promise.resolve() });
})();
