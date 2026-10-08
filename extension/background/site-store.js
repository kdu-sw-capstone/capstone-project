// 비회원 사이트 관리 기반. 회원 API와 제품 메시지 adapter는 후속 연동합니다.
const GuestSites = (() => {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  function validate(input) {
    if (!input || typeof input !== "object" || Array.isArray(input) ||
        Object.keys(input).some(key => !["url", "display_name", "include_subdomains", "purpose", "access_policy", "feature_policies"].includes(key))) throw new Error("INVALID_SITE");
    if (typeof input.url !== "string" || !input.url.trim() || input.url.length > 2048 ||
        /[\s\\]/u.test(input.url.trim())) throw new Error("INVALID_URL");
    const raw = input.url.trim();
    const full = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    const authority = full.match(/^https?:\/\/([^/?#]+)/i)?.[1];
    // URL.port는 기본 포트를 제거하므로 변환 전에도 명시적 포트를 검사합니다.
    if (!authority || /[:@%]/.test(authority)) throw new Error("INVALID_URL");
    let url;
    try { url = new URL(full); } catch { throw new Error("INVALID_URL"); }
    const host = url.hostname.toLowerCase();
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password ||
        url.port || host.length > 253 || host === "localhost" || host.endsWith(".localhost") ||
        /^[0-9.]+$/.test(host) || !host.includes(".") ||
        host.split(".").some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) throw new Error("INVALID_URL");
    if (typeof input.display_name !== "string" || !input.display_name.trim() ||
        [...input.display_name].length > 100 || typeof input.include_subdomains !== "boolean") throw new Error("INVALID_SITE");
    if (!((input.purpose === "DISTRACTION" && ["BLOCK", "RECORD"].includes(input.access_policy)) ||
        (["FOCUS", "GENERAL"].includes(input.purpose) && input.access_policy === "ALLOW"))) throw new Error("INVALID_POLICY");
    if (!Array.isArray(input.feature_policies) || input.feature_policies.length) throw new Error("FEATURE_NOT_IMPLEMENTED");
    return { canonical_host: host, display_name: input.display_name.trim(),
      include_subdomains: input.include_subdomains, purpose: input.purpose,
      access_policy: input.access_policy, feature_policies: [] };
  }
  function overlaps(a, b) {
    return a.canonical_host === b.canonical_host ||
      (a.include_subdomains && b.canonical_host.endsWith(`.${a.canonical_host}`)) ||
      (b.include_subdomains && a.canonical_host.endsWith(`.${b.canonical_host}`));
  }
  function open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("focurve-local", 1);
      request.onerror = () => reject(new Error("LOCAL_STORAGE_UNAVAILABLE"));
      request.onblocked = () => reject(new Error("LOCAL_STORAGE_BLOCKED"));
      request.onsuccess = () => resolve(request.result);
    });
  }
  async function operate(input, requestId) {
    const normalized = input ? validate(input) : null;
    if (input && !uuid.test(requestId)) throw new Error("INVALID_REQUEST");
    // 원문 URL 대신 재시도 비교용 해시만 저장합니다.
    const hash = input ? Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",
      new TextEncoder().encode(JSON.stringify(input))))).map(n => n.toString(16).padStart(2, "0")).join("") : null;
    const owner = await LocalStore.guestContext();
    const db = await open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(["owner_settings", "metadata"], input ? "readwrite" : "readonly");
        let result, failure = "LOCAL_STORAGE_UNAVAILABLE";
        tx.oncomplete = () => resolve(result);
        tx.onabort = () => reject(new Error(failure));
        const settings = tx.objectStore("owner_settings");
        const metadata = tx.objectStore("metadata");
        const receiptKey = `site_create:${owner.owner_key}:${requestId}`;
        function fail(code) { failure = code; tx.abort(); }
        function process(receipt) {
          if (receipt && receipt.expires_at > Date.now()) {
            if (receipt.hash !== hash) { fail("IDEMPOTENCY_CONFLICT"); return; }
            result = receipt.site;
            return;
          }
          const lookup = settings.get(owner.owner_key);
          lookup.onsuccess = () => {
            const record = lookup.result;
            const sites = record?.payload?.sites ?? [];
            if (!record || !Array.isArray(sites) || sites.some(s => !s || typeof s.canonical_host !== "string" || typeof s.include_subdomains !== "boolean")) { fail("LOCAL_DATA_INVALID"); return; }
            if (!input) { result = { items: sites.filter(site => !site.deleted_at), next_cursor: null, has_more: false, settings_version: record.version }; return; }
            if (sites.some(site => !site.deleted_at && overlaps(site, normalized))) { fail("SITE_SCOPE_CONFLICT"); return; }
            if (!Number.isSafeInteger(record.version + 1)) { fail("LOCAL_DATA_INVALID"); return; }
            const now = new Date().toISOString();
            const site = { ...normalized, site_id: crypto.randomUUID(), version: 1, created_at: now, updated_at: now };
            settings.put({ ...record, version: record.version + 1, payload: { ...record.payload, sites: [...sites, site] } });
            metadata.put({ key: receiptKey, hash, site, expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000 });
            result = site;
          };
        }
        if (input) {
          const receipt = metadata.get(receiptKey);
          receipt.onsuccess = () => process(receipt.result);
        } else process(null);
      });
    } finally { db.close(); }
  }
  async function change(kind, siteId, expectedVersion, input, requestId) {
    if (!uuid.test(siteId) || !uuid.test(requestId)) throw new Error("INVALID_REQUEST");
    if (expectedVersion === undefined || expectedVersion === null) throw new Error("VERSION_REQUIRED");
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw new Error("INVALID_VERSION");
    const normalized = kind === "UPDATE" ? validate(input) : null;
    const body = { kind, site_id: siteId, expected_version: expectedVersion, input: input ?? null };
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",
      new TextEncoder().encode(JSON.stringify(body))))).map(n => n.toString(16).padStart(2, "0")).join("");
    const owner = await LocalStore.guestContext();
    const db = await open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(["owner_settings", "metadata"], "readwrite");
        let result, failure = "LOCAL_STORAGE_UNAVAILABLE";
        tx.oncomplete = () => resolve(result);
        tx.onabort = () => reject(new Error(failure));
        const settings = tx.objectStore("owner_settings");
        const metadata = tx.objectStore("metadata");
        const receiptKey = `site_change:${owner.owner_key}:${requestId}`;
        const receipt = metadata.get(receiptKey);
        function fail(code) { failure = code; tx.abort(); }
        receipt.onsuccess = () => {
          // 동일 요청 재시도는 변경된 최신 version 검사보다 먼저 원래 결과를 반환합니다.
          if (receipt.result && receipt.result.expires_at > Date.now()) {
            if (receipt.result.hash !== hash) { fail("IDEMPOTENCY_CONFLICT"); return; }
            result = receipt.result.site; return;
          }
          const lookup = settings.get(owner.owner_key);
          lookup.onsuccess = () => {
            const record = lookup.result;
            const sites = record?.payload?.sites;
            if (!record || !Array.isArray(sites) || !Number.isSafeInteger(record.version)) { fail("LOCAL_DATA_INVALID"); return; }
            const index = sites.findIndex(site => site.site_id === siteId && !site.deleted_at);
            if (index === -1) { fail("SITE_NOT_FOUND"); return; }
            const original = sites[index];
            if (original.version !== expectedVersion) { fail("VERSION_CONFLICT"); return; }
            if (!Number.isSafeInteger(original.version + 1) || !Number.isSafeInteger(record.version + 1)) { fail("LOCAL_DATA_INVALID"); return; }
            if (normalized && sites.some(site => !site.deleted_at && site.site_id !== siteId && overlaps(site, normalized))) { fail("SITE_SCOPE_CONFLICT"); return; }
            const time = new Date().toISOString();
            const site = kind === "UPDATE" ? { ...original, ...normalized, version: original.version + 1, updated_at: time }
              : { ...original, version: original.version + 1, updated_at: time, deleted_at: time };
            const updated = [...sites]; updated[index] = site;
            settings.put({ ...record, version: record.version + 1, payload: { ...record.payload, sites: updated } });
            metadata.put({ key: receiptKey, hash, site, expires_at: Date.now() + 7 * 86400000 });
            result = site;
          };
        };
      });
    } finally { db.close(); }
  }
  return Object.freeze({ validate, overlaps, list: () => operate(null),
    create: (input, requestId) => { if (!input) return Promise.reject(new Error("INVALID_SITE")); return operate(input, requestId); },
    update: (siteId, version, input, requestId) => change("UPDATE", siteId, version, input, requestId),
    remove: (siteId, version, requestId) => change("DELETE", siteId, version, null, requestId)
  });
})();
