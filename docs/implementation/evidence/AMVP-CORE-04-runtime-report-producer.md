# AMVP-CORE-04 — RuntimeReport 생산 원장

윤종민 / `feature/additional-mvp-runtime-report-producer` / 시작 통합 `3f31f75e8be65996af3b1fb94a846b0df2d7c085`. 이번 단위는 승인 RuntimeReport의 고정 epoch·연속 seq·원문과 generation을 영속 보존하는 내부 생산 원장이다. 실제 issued/effect source·제품 Worker·발신함·HTTP는 활성화하지 않는다. PR76의 발신함 코드/HEAD는 변경하지 않았다.

## 기준

- `docs/design/additional-mvp-contracts/02_API_DB.md`: RPT-01, owner/executor 결속, immutable item/hash·순번, 저장 실패·원문 재전송, 접수와 실제 효과 분리.
- `docs/design/additional-mvp-contracts/03_Wire_D06_복원.md`: 실제 effect footprint/증거 뒤 report, 원문/복원 의무 보존.
- `contracts/additional-mvp/rc1/schema.json`의 기존 RuntimeReport 정의, 기존 `extension/a1/contract.mjs` canonical/digest, `extension/member-a1/db.mjs` metadata transaction 재사용. 공개 Wire/API·Server/DB migration·기존 source는 변경하지 않는다.

## 함수와 저장 형식

`extension/src/additional-runtime-report-producer.js`:

```js
const producer = new RuntimeReportProducer(executionDb, {
  authorizeScope, // async ({owner_binding_id, executor_id, runtime_execution_id, generation}) => true
  verifyEvidence, // async ({generation, report, predecessor}) => true
  capacity: 1024
});
const report = await producer.produce({generation, report: sourceReportFields});
const journal = await producer.recover();
```

두 callback의 기본값은 false다. 주석의 true는 adapter의 엄격한 반환 형식이며 제품용 true 상수 주입 예제가 아니다. `authorizeScope`는 실제 owner/executor/runtime execution 및 issued generation을, `verifyEvidence`는 실제 발급 operation/package/revision·관측·현재 report epoch·합법 상태 전이·원본 효과 증거를 검증해야 한다. 메시지 body의 성공 값·hash·앞선 로컬 관측만으로 대체하면 안 된다. 검증 adapter 구현/승인은 이 PR에 포함되지 않는다.

`sourceReportFields`는 RuntimeReport에서 report_epoch/report_seq/payload_sha256만 뺀 기존 필드다. source는 자기 영속 observation에 결속한 **동일 report_id**를 제공해야 한다. producer는 이를 임의 재발급하지 않는다. `generation`은 내부 원장용이며 RuntimeReport에 새 필드를 추가하지 않는다. `predecessor`는 같은 stream의 이전 `{generation, report}` 또는 null이다.

메타데이터 key는 `amvp_journal_v1:runtime-report-producer`, 값은 `{key, version:1, streams, rows}`다.

- stream: `{owner_binding_id, executor_id, runtime_execution_id, report_epoch, last_seq}`. 최초 승인/저장 시 UUID epoch와 seq1을 만들고 이후 같은 runtime stream은 epoch를 유지한다. DB wrapper/Worker 객체를 다시 만든다는 이유로 epoch를 바꾸거나 seq를 초기화하지 않는다.
- row: `{generation, report, row_sha256}`. report 자체의 payload hash와 generation을 포함한 전체 row hash를 각각 검사한다. 다른 stream은 별도 epoch/cursor이며 전체 원장에서도 epoch와 report_id 중복을 거절한다.
- 보고서와 stream cursor는 **하나의 IDB transaction**에서 함께 저장한다. async hash/증거 검증 후 최종 transaction은 producer 원장 snapshot CAS를 확인한다. 경쟁은 `REPORT_PRODUCER_CHANGED`, 저장 실패는 원문/순번 모두 rollback이며 성공을 반환하지 않는다.
- 같은 report_id/동일 원문·generation은 기존 영속 보고서를 반환한다. 이는 과거 receipt 재조회이며 새 관측이나 현재 실제 효과 성공을 뜻하지 않는다. 현재 scope는 재검증하고, 다른 body/generation으로 ID를 재사용하면 거절한다.

`recover()`는 background 내부 복구 조회다. Content/Popup endpoint가 아니고 권한이나 효과 증명서를 발급하지 않는다. 해시는 무결성 검사이며 악의적인 저장소 변조에 대한 서명이 아니다.

## 발신함과의 경계

PR76은 **이미 생성된 report**를 받아 같은 원문으로 전달을 준비한다. 이 생산 원장은 그 전 단계이며, 발신함에 보내기 전 원본/cursor를 영속 보존한다. 발신함 enqueue 실패·미연결 시에도 생산 원문을 삭제/ACK 처리하지 않는다. 후속 adapter는 저장된 순서대로 같은 report를 전달하고 실제 증거를 다시 검증해야 한다.

생산 원장과 발신함을 연결하는 replay/checkpoint/원자 저장 경로, 실제 인증 HTTP·ACK·Receipt 상태조회는 **아직 구현하지 않았다**. producer 반환으로 APPLIED/RELEASED·전송 성공·cleanup 완료를 인정하지 않는다. Native/Content 효과를 실행하거나 기존 claim/cleanup 원장을 변경하지 않는다.

## 검증

Node24.19.0, Linux. 신규19건은 전체925건에 포함되므로 합산하지 않는다.

| 범위 | 실제 결과 |
|---|---|
| 신규 Node/fake-indexeddb | 19/19 PASS |
| Extension 전체 | 925/925 PASS, fail/skip0 |
| 기존 RC2 JS 계약 | 6/6 PASS |
| Chromium151 실제 IndexedDB | 1/1 PASS |
| JS syntax / whitespace | PASS |

scope/evidence 기본 거절, 동일 ID 충돌·다른 owner/executor/execution 분리, generated field 주입·잘못된 상태/date/hash형식, 검증 중 scope 변경, caller/callback 입력 변조, 과거 receipt replay, 첫 저장/이후 저장 quota 실패와 cursor rollback, 두 instance CAS, capacity 원문 보존, cursor/hash/epoch/generation 변조, 다른 cleanup metadata 보존을 확인했다.

```bash
cd extension
npm ci --ignore-scripts --no-audit --no-fund
node --test tests/additional-runtime-report-producer.test.mjs
npm test
npm run check
cd ..
node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs
git diff --check
```

선택 브라우저 시험은 설치된 Playwright Node package/Chromium으로 `node --test extension/tests/additional-runtime-report-producer-browser.mjs`를 실행한다. 비표준 설치 경로는 PLAYWRIGHT_MODULE/CHROME_EXECUTABLE로 지정한다. 실제 IDB에서 새 DB connection의 epoch/원문 복원·다음 seq/cursor·무관한 cleanup 보존을 확인했으며 **owner/effect verifier는 모의**다. Chrome process/Worker 강제 종료·실제 MV3 DNR·Server/Content/HTTP 제품 수용은 검증하지 않았다. CI는 Ubuntu/Windows의 신규 Node·계약 회귀·syntax를 수행한다.

## 남은 작업·리뷰 요청

실제 durable source observation의 ID·issued binding/effect/clock verifier 연결, 현재 epoch의 권한 있는 등록·검증, 생산 원장→발신함 replay/checkpoint, 실제 Worker/인증 전송·제품 수용이 남아 있다. 새 발급/정책을 활성화하지 않는다. source가 commit 이전에 ID를 잃으면 원장을 같은 ID로 재조회할 수 없으므로 source의 영속 복구 연결도 필요하다.

bounded capacity1024이며 terminal/미전송 원문도 삭제하지 않는다. 가득 차면 새 report를 거절한다. 운영 보존/압축·처리량/장시간 성능·기존 중간 stream의 import/migration은 미구현/미검증이다. 기존 cursor/epoch를 지워 용량이나 검증 실패를 우회하지 않는다.

다훈: 기존 RPT-01 epoch/seq·중복/응답 유실·owner/executor 및 verifier 책임 분리가 적절한지 확인해 주세요. 지민: report 생산/재조회가 Content의 실제 효과·복원/cleanup 증명을 대신하지 않는지 확인해 주세요. 문제없으면 최신 HEAD로 리뷰하고, 병합은 통합 담당이 결정합니다. 전체 Core/RuntimeReport 제품 완료를 선언하지 않습니다.
