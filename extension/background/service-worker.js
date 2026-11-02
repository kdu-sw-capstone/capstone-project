// The read-only safety document must not enter mutating access collectors.
const safetyObservationTabs = new Set();
function safetyDocument(details) {
 let own=false;try {const u=new URL(details.url);own=u.origin===new URL(chrome.runtime.getURL('/')).origin&&u.protocol==='chrome-extension:'&&u.hostname===chrome.runtime.id&&['/safety/index.html','/native-link/index.html'].includes(u.pathname);}catch{}
 if(details.frameId===0){if(own)safetyObservationTabs.add(details.tabId);else safetyObservationTabs.delete(details.tabId);}
 return own;
}
globalThis.FocurveSafetyNavigation={document:safetyDocument,tab:id=>safetyObservationTabs.has(id)};
importScripts('../release-config.js','../integration/deployment-binding.js');
globalThis.MemberAuthRuntime={status:async()=>globalThis.__memberIntegration?.auth.status()??{phase:'UNREGISTERED'},guardGuestStart:op=>{if(!globalThis.__memberIntegration)throw Error('MEMBER_ADAPTER_NOT_READY');return __memberRootAuthority.idle().then(()=>__memberIntegration.auth.guardGuestStart(op));},credentials:()=>__memberIntegration.auth.credentials(),
 // START already holds MemberAuth.serial. A nested status()/guardGuestStart()
 // would deadlock; use its existing local load and final auth-write token instead.
 assertGuestDnrApply:async()=>{
  const auth=globalThis.__memberIntegration?.auth;if(!auth)throw Error('MEMBER_ADAPTER_NOT_READY');
  if(!['UNREGISTERED','REGISTERED'].includes((await auth.load()).phase))throw Error('ACCOUNT_TRANSITION_ACTIVE');
  await __memberRootAuthority.idle();
 }};
importScripts("a0-core.bundle.js");
importScripts("host-policy.js", "local-store.js", "site-store.js", "session-db.js", "session-core.js", "access-store.js", "guest-history.js", "member-events.js", "member-auth.js", "member-execution.js");

// 개발용 연결 진단입니다. 제품의 세션/정책 메시지와 분리합니다.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "DEV_CORE_PING") return;

  // 우리 확장의 팝업에서 보낸 요청만 받습니다.
  if (sender.id !== chrome.runtime.id ||
      sender.url !== chrome.runtime.getURL("popup/popup.html")) return;

  if (typeof message.request_id !== "string" ||
      message.request_id.length > 64) return;

  sendResponse({
    request_id: message.request_id,
    status: "OK",
    data: { client_version: chrome.runtime.getManifest().version },
    error: null
  });
});

// 진단용 요청입니다. 제품 GET_STATE/START 계약과 구분합니다.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "DEV_GUEST_STORAGE_CHECK") return;
  if (sender.id !== chrome.runtime.id ||
      sender.url !== chrome.runtime.getURL("popup/popup.html")) return;
  if (typeof message.request_id !== "string" || !message.request_id.length ||
      message.request_id.length > 64) return;
  LocalStore.guestContext().then(data => sendResponse({
    request_id: message.request_id, status: "OK", data, error: null
  })).catch(error => sendResponse({
    request_id: message.request_id, status: "ERROR", data: null,
    error: { code: ["LOCAL_DATA_INVALID", "LOCAL_STORAGE_BLOCKED"].includes(error.message)
      ? error.message : "LOCAL_STORAGE_UNAVAILABLE" }
  }));
  return true;
});

// DEV_*는 로컬 개발용 adapter. 제품 SAVE_SITE/GET_STATE 계약은 후속 연결합니다.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!["DEV_GUEST_SITE_LIST", "DEV_GUEST_SITE_CREATE"].includes(message?.type)) return;
  if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL("popup/popup.html")) return;
  if (typeof message.request_id !== "string" || message.request_id.length > 64) return;
  const operation = message.type === "DEV_GUEST_SITE_LIST"
    ? GuestSites.list() : GuestSites.create(message.payload, message.request_id);
  operation.then(data => sendResponse({ request_id: message.request_id, status: "OK", data, error: null }))
    .catch(error => sendResponse({ request_id: message.request_id, status: "ERROR", data: null,
      error: { code: ["INVALID_SITE", "INVALID_URL", "INVALID_POLICY", "FEATURE_NOT_IMPLEMENTED",
        "INVALID_REQUEST", "LOCAL_DATA_INVALID", "SITE_SCOPE_CONFLICT", "IDEMPOTENCY_CONFLICT",
        "LOCAL_STORAGE_BLOCKED"].includes(error.message) ? error.message : "LOCAL_STORAGE_UNAVAILABLE" } }));
  return true;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!["DEV_SESSION_START", "DEV_SESSION_END", "DEV_SESSION_STATE"].includes(message?.type)) return;
  if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL("popup/popup.html") || (sender.frameId && sender.frameId !== 0)) return;
  if (typeof message.request_id !== "string" || !message.request_id.length || message.request_id.length > 64) return;
  const operation = message.type === "DEV_SESSION_START" ? MemberAuthRuntime.guardGuestStart(async () => { await globalThis.FocurveA1?.ready; if (!globalThis.FocurveA1?.enabled) throw new Error('SNAPSHOT_ISSUANCE_DISABLED'); return GuestSession.start(message.payload?.duration_minutes, message.request_id); }, message.payload?.duration_minutes)
    : message.type === "DEV_SESSION_END" ? GuestSession.end(message.payload?.session_id) : GuestSession.state();
  operation.then(state => sendResponse({ request_id: message.request_id, status: "OK", data: state?.session || null, error: null }))
    .catch(error => { if(error.message==='UNSUPPORTED_POLICY')console.error('Guest session policy rejected:', JSON.stringify({operation:message.type,code:error.message,...(error.cause?.stage==='NATIVE_CENSUS'||error.cause?.stage==='DNR_REGEX'?error.cause:{stage:'UNCONFIRMED'})})); return sendResponse({ request_id: message.request_id, status: "ERROR", data: null,
      error: { code: ["INSTALLATION_NOT_READY", "INSTALLATION_STOPPING", "INSTALLATION_START_WINDOW_CLOSED", "ACCOUNT_TRANSITION_ACTIVE", "SNAPSHOT_ISSUANCE_DISABLED", "INVALID_START", "INVALID_SNAPSHOT", "SESSION_ACTIVE", "SESSION_NOT_FOUND", "IDEMPOTENCY_CONFLICT", "FEATURE_NOT_IMPLEMENTED", "APPLY_EXPIRED", "RULE_UNSUPPORTED", "RULE_OWNERSHIP_CONFLICT", "APPLY_UNCONFIRMED", "RELEASE_UNCONFIRMED", "CLEANUP_CAPACITY", "UNSUPPORTED_POLICY", "REVALIDATION_REQUIRED", "GENERATION_CHANGED", "INVALID_EFFECT_EVIDENCE", "RUNNING_GATE_DENIED", "STORE_UNCONFIRMED", "CLEANUP_REQUIRED", "INACTIVE_SCOPE", "SCOPE_MISMATCH", "POLICY_COMBINATION_PENDING_B", "INVALID_SCHEMA"].includes(error.message) ? error.message : "EXECUTION_UNCONFIRMED" } }); });
  return true;
});
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === "focurve-guest-session") GuestSession.tick().catch(error => console.error("Guest recovery failed:", error.message));
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url && /^https?:/.test(changeInfo.url)) GuestSession.tick().catch(error => console.error("Guest navigation recovery failed:", error.message));
});
chrome.runtime.onStartup.addListener(() => { GuestSession.tick().catch(error => console.error("Guest startup recovery failed:", error.message)); });
// 워커 재생성 시에도 durable journal과 실제 규칙을 우선 대조합니다.
GuestSession.tick().catch(error => console.error("Guest worker recovery failed:", error.message));

// callback에서 관찰 시각을 캡처합니다. WebNavigation timestamp와 시스템 시계 차이는 섞지 않습니다.
chrome.webNavigation.onBeforeNavigate.addListener(details => {
  if (safetyDocument(details)) return;
  GuestSession.observe("before", {...details, observed_at: Date.now()})
    .catch(error => console.error("Access capture failed:", error.message));
});
chrome.webNavigation.onCommitted.addListener(details => {
  if (safetyDocument(details)) return;
  GuestSession.observe("commit", {...details, observed_at: Date.now()})
    .catch(error => console.error("Access save failed:", error.message));
});
chrome.tabs.onRemoved.addListener(tabId => {
  if (safetyObservationTabs.has(tabId)) return;
  AccessStore.forget(tabId).catch(error => console.error("Access pending cleanup failed:", error.message));
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "DEV_ACCESS_LIST") return;
  if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL("popup/popup.html") ||
      (sender.frameId && sender.frameId !== 0)) return;
  if (typeof message.request_id !== "string" || !message.request_id.length || message.request_id.length > 64) return;
  GuestSession.records(message.payload).then(data => sendResponse({request_id:message.request_id,status:"OK",data,error:null}))
    .catch(() => sendResponse({request_id:message.request_id,status:"ERROR",data:null,error:{code:"ACCESS_QUERY_FAILED"}}));
  return true;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!["DEV_GUEST_SITE_UPDATE", "DEV_GUEST_SITE_DELETE"].includes(message?.type)) return;
  if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL("popup/popup.html") ||
      (sender.frameId && sender.frameId !== 0)) return;
  if (typeof message.request_id !== "string" || !message.request_id.length || message.request_id.length > 64) return;
  const input = message.payload;
  const operation = message.type === "DEV_GUEST_SITE_UPDATE"
    ? GuestSites.update(input?.site_id, input?.expected_version, input?.site, message.request_id)
    : GuestSites.remove(input?.site_id, input?.expected_version, message.request_id);
  operation.then(data => sendResponse({request_id:message.request_id,status:"OK",data,error:null}))
    .catch(error => sendResponse({request_id:message.request_id,status:"ERROR",data:null,error:{code:
      ["INVALID_REQUEST", "VERSION_REQUIRED", "INVALID_VERSION", "VERSION_CONFLICT", "SITE_NOT_FOUND",
       "INVALID_SITE", "INVALID_URL", "INVALID_POLICY", "SITE_SCOPE_CONFLICT", "IDEMPOTENCY_CONFLICT",
       "FEATURE_NOT_IMPLEMENTED", "LOCAL_DATA_INVALID", "LOCAL_STORAGE_BLOCKED"].includes(error.message)
       ? error.message : "LOCAL_STORAGE_UNAVAILABLE"}}));
  return true;
});

chrome.webNavigation.onErrorOccurred.addListener(details => {
  if (safetyDocument(details)) return;
  GuestSession.observe("error", {...details, observed_at: Date.now()})
    .catch(error => console.error("Access failure cleanup failed:", error.message));
});

// MEMBER A1 navigation capture is registered once by member-ui/access-runtime.js.
// Do not load the legacy execution actor alongside the current owner.

// A1 isolated trial runtime; disabled until a trusted Worker enables its private trial marker.
importScripts('additional-dnr-writer.bundle.js',"a1-core.bundle.js");

importScripts('../integration/member-adapter.bundle.js','member-a1-core.bundle.js','../integration/member-a1-adapter.bundle.js','../integration/member-a1-authority.bundle.js','../integration/member-a1-bootstrap.js','../integration/member-auth-bridge.js','../integration/same-owner-recovery.js','../integration/recovery-runtime.js','../member-ui/runtime.js','../member-ui/access-runtime.js');

importScripts(chrome.runtime.getURL('integration/member-web-bridge.js'));

importScripts('../member-ui/root-gate-events.js');

// Registered after product listeners: release only the observer's in-memory tab marker.
chrome.tabs.onRemoved.addListener(id => { if(safetyObservationTabs.has(id))setTimeout(()=>safetyObservationTabs.delete(id),0); });

importScripts('../integration/user-admission.js');

importScripts('../integration/product-runtime-admission.js');

importScripts("../integration/preserved-end-runtime.js");
