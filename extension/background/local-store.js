// 설치 메타데이터와 소유자 설정을 같은 IndexedDB에 보관합니다.
// metadata는 내부 저장소 메타데이터이며 서버 계약이 아닙니다.
const LocalStore = (() => {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  function open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("focurve-local", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore("metadata", { keyPath: "key" });
        db.createObjectStore("owner_settings", { keyPath: "owner_key" });
      };
      request.onerror = () => reject(new Error("LOCAL_STORAGE_UNAVAILABLE"));
      request.onblocked = () => reject(new Error("LOCAL_STORAGE_BLOCKED"));
      request.onsuccess = () => resolve(request.result);
    });
  }
  async function guestContext() {
    const db = await open();
    // readwrite transaction을 사용하여 동시에 요청해도 설치 ID는 하나만 생성합니다.
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(["metadata", "owner_settings"], "readwrite");
        let result;
        let failure = "LOCAL_STORAGE_UNAVAILABLE";
        tx.oncomplete = () => resolve(result);
        tx.onabort = () => reject(new Error(failure));
        const metadata = tx.objectStore("metadata");
        const settings = tx.objectStore("owner_settings");
        const request = metadata.get("installation_id");
        request.onsuccess = () => {
          const existing = request.result;
          const installationId = existing ? existing.value : crypto.randomUUID();
          if (!uuid.test(installationId)) {
            failure = "LOCAL_DATA_INVALID";
            tx.abort();
            return;
          }
          if (!existing) metadata.add({ key: "installation_id", value: installationId });
          const ownerKey = `GUEST:${installationId}`;
          const lookup = settings.get(ownerKey);
          lookup.onsuccess = () => {
            const record = lookup.result;
            if (record && (!Number.isSafeInteger(record.version) || record.version < 0 ||
                !record.payload || typeof record.payload !== "object" || Array.isArray(record.payload))) {
              failure = "LOCAL_DATA_INVALID";
              tx.abort();
              return;
            }
            // 빈 payload는 아직 정책을 설정하지 않았다는 뜻입니다.
            if (!record) settings.add({ owner_key: ownerKey, version: 0, payload: {} });
            result = { installation_id: installationId, owner_key: ownerKey,
              settings_version: record ? record.version : 0 };
          };
        };
      });
    } finally {
      db.close();
    }
  }
  return Object.freeze({ guestContext });
})();
