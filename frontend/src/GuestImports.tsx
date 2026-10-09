import { useState } from "react";
import { request, UiError } from "./api";
import { dateTime, useWork } from "./FocusShared";

type Choice = { source_item_id: string; source_hash: string; type: "SITE" | "SESSION"; label: string };
type Manifest = { format_version: "1.0"; owner_user_id: string; executor_id: string; items: Choice[] };
type Batch = { batch_id: string; status: string; created_at: string; items: { source_item_id: string; item_type: string; status: string; error_code: string | null }[] };
type Runtime = { lastError?: { message?: string }; sendMessage: (id: string, body: unknown, callback: (reply: unknown) => void) => void };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function extensionImportMessage(body: unknown): Promise<unknown> {
  const id = import.meta.env.VITE_EXTENSION_ID ?? "";
  const runtime = (window as unknown as { chrome?: { runtime?: Runtime } }).chrome?.runtime;
  if (!/^[a-p]{32}$/.test(id) || !runtime?.sendMessage) throw new UiError("이 Chrome에 연결 가능한 확장 프로그램이 없습니다. 설치·회원 연결과 웹 연결 설정을 확인하세요.");
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new UiError("확장 프로그램 응답이 늦습니다. 팝업에서 처리 결과를 확인한 뒤 다시 조회하세요.")), 15000);
    try { runtime.sendMessage(id, body, reply => {
      clearTimeout(timer);
      if (runtime.lastError) reject(new UiError("확장 프로그램과 연결할 수 없습니다. 팝업을 열고 회원 연결을 확인하세요."));
      else resolve(reply);
    }); } catch { clearTimeout(timer); reject(new UiError("확장 프로그램 연결 설정을 확인하세요.")); }
  });
}
export function validateImportManifest(value: unknown, owner: string): Manifest {
  const v = value as Manifest;
  if (!v || v.format_version !== "1.0" || v.owner_user_id !== owner || !uuid.test(v.executor_id) || !Array.isArray(v.items) || v.items.length > 1000 ||
    v.items.some(i => !uuid.test(i.source_item_id) || !/^[a-f0-9]{64}$/.test(i.source_hash) || !["SITE", "SESSION"].includes(i.type) || typeof i.label !== "string" || i.label.length > 200) ||
    new Set(v.items.map(i => i.source_item_id)).size !== v.items.length) throw new UiError("확장 프로그램의 계정 또는 자료 형식이 일치하지 않습니다. 연결 상태를 다시 확인하세요.");
  return v;
}
const statusName: Record<string,string> = { COMPLETE: "가져오기 완료", PENDING: "대기", PARTIAL: "일부 처리 · 결과 확인 필요", SUCCEEDED: "저장 완료", SKIPPED_CONFLICT: "기존 회원 설정 보존", FAILED: "실패 · 재시도 가능" };

export default function GuestImports({ owner }: { owner?: string }) {
  const work = useWork();
  const [manifest, setManifest] = useState<Manifest | null>(null), [selected, setSelected] = useState<string[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]), [loaded, setLoaded] = useState(false), [cursor, setCursor] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  async function load(more = false) {
    const page = await request<{ items: Batch[]; next_cursor: string | null }>(`/guest-imports${more && cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
    setBatches(previous => more ? [...previous, ...page.items] : page.items); setCursor(page.next_cursor); setLoaded(true);
  }
  async function choose() {
    setNotice(""); setManifest(null); setSelected([]);
    if (!owner) throw new UiError("현재 계정 정보를 다시 확인하세요.");
    const reply = await extensionImportMessage({ type: "FOCURVE_GUEST_IMPORT_LIST", version: "1.0", owner_user_id: owner });
    setManifest(validateImportManifest(reply, owner));
  }
  async function submit() {
    if (!manifest || !selected.length) return;
    setNotice("");
    const reply = await extensionImportMessage({ type: "FOCURVE_GUEST_IMPORT_SUBMIT", version: "1.0", owner_user_id: owner,
      executor_id: manifest.executor_id, request_id: crypto.randomUUID(), items: manifest.items.filter(i => selected.includes(i.source_item_id)).map(({ label: _label, ...item }) => item) }) as { batch_id?: string };
    if (!reply?.batch_id || !uuid.test(reply.batch_id)) throw new UiError("전송 결과를 확인하지 못했습니다. 처리 결과를 조회한 뒤 미완료 항목만 다시 선택하세요.");
    // Only the owner-scoped Server response can confirm persistence; extension acknowledgements cannot.
    await request(`/guest-imports/${reply.batch_id}`); await load(); setSelected([]);
    setNotice("선택한 자료의 처리 결과를 확인하세요. 원본은 확장 프로그램에 보존됩니다.");
  }
  return <section className="settings-card" aria-label="비회원 자료 가져오기">
    <h4>비회원 자료 가져오기</h4><p>이 Chrome의 비회원 설정·종료 기록 중 선택한 항목만 가져옵니다. 로그인만으로 전송하지 않습니다. 이미 가져온 자료는 다른 계정으로 옮길 수 없습니다.</p>
    <p className="muted">확장 프로그램 설치 후 현재 계정으로 연결하세요. 원본 설정과 기록의 보관 기한은 가져오기로 바뀌지 않습니다. 회원 설정과 충돌하면 회원 설정을 유지합니다.</p>
    <div className="settings-actions"><button disabled={work.busy} onClick={() => { void work.run(choose); }}>가져올 자료 확인</button><button disabled={work.busy} onClick={() => { void work.run(() => load()); }}>처리 결과 새로고침</button></div>
    {manifest && <div className="settings-action-note"><p>선택 {selected.length}개 / {manifest.items.length}개 (한 번에 최대 100개)</p>
      {!manifest.items.length && <p>가져올 수 있는 설정이나 30일 이내 종료 기록이 없습니다.</p>}
      {manifest.items.map(item => <label className="settings-row" key={item.source_item_id}><input type="checkbox" checked={selected.includes(item.source_item_id)} disabled={work.busy || selected.length >= 100 && !selected.includes(item.source_item_id)} onChange={e => setSelected(old => e.target.checked ? [...old, item.source_item_id] : old.filter(id => id !== item.source_item_id))} />{item.type === "SITE" ? "사이트 설정" : "종료 기록"} · {item.label}</label>)}
      <button disabled={!selected.length || work.busy} onClick={() => { void work.run(submit); }}>선택한 자료 가져오기</button></div>}
    {loaded && !batches.length && <p>아직 가져오기 요청이 없습니다.</p>}
    {batches.map(batch => <details className="settings-details" key={batch.batch_id}><summary>{dateTime(batch.created_at)} · {statusName[batch.status] ?? batch.status}</summary><ul>{batch.items.map(item => <li key={item.source_item_id}>{item.item_type === "SITE" ? "사이트 설정" : "종료 기록"} · {statusName[item.status] ?? item.status}{item.error_code && <span> · 오류 {item.error_code}</span>}</li>)}</ul><p>실패한 항목은 확장 프로그램에서 원본을 확인한 뒤 ‘가져올 자료 확인’에서 다시 선택하세요. 같은 원본의 완료 항목은 중복 저장하지 않습니다.</p></details>)}
    {cursor && <button disabled={work.busy} onClick={() => { void work.run(() => load(true)); }}>이전 처리 결과 더 보기</button>}
    {work.busy && <p role="status">자료와 처리 결과를 확인하고 있습니다.</p>}{notice && <p role="status">{notice}</p>}{work.error && <p role="alert">{work.error}</p>}
  </section>;
}
