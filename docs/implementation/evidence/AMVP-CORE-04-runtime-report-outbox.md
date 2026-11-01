# AMVP-CORE-04 — RuntimeReport 영속 발신함·항목별 ACK 준비

담당 윤종민. 시작 통합 `79409240e65ec6b92fa12f3422c3e67bea0308f0`, 브랜치 `feature/additional-mvp-runtime-report-outbox`. 구현·로컬 검증 완료, PR 리뷰/통합 대기. 전체 Core나 RuntimeReport 실제 생산·전송 완료를 뜻하지 않는다.

## 기준과 변경 범위

- `docs/design/additional-mvp-contracts/02_API_DB.md`: RPT-01, 동일 원문 재전송, 항목별 ACK, PENDING_DEPENDENCY 보존·REJECTED 격리·HTTP 성공과 실제 효과 분리.
- `docs/design/additional-mvp-contracts/03_Wire_D06_복원.md`: 기존 owner/issued operation/복원 의무 경계 유지.
- `contracts/additional-mvp/rc1/schema.json`: 기존 RC2 RuntimeReport/ReportBatch/BatchAck/ItemAck를 직접 참조한다. 필드·상태·공개 API·DB migration·계약 manifest는 변경하지 않는다.
- 제품 Worker, 기존 DNR writer·이용시간 관측·Server/Content 및 대기 중 PR59/68은 변경하지 않았다. 새 모듈은 아직 Worker에서 import/활성화하지 않는다.

## 구현 파일·함수·데이터 형식

`extension/src/additional-runtime-report-outbox.js`의 `RuntimeReportOutbox(db, options)`를 신뢰된 background adapter만 사용한다. 기존 Member DB transaction/metadata store를 재사용한다. 여기서 `db`는 영속 원장 adapter이며 Content에 노출할 endpoint가 아니다.

| 함수/옵션 | 의미 |
|---|---|
| `enqueue(report)` | 기존 RuntimeReport의 Schema·canonical payload hash와 외부 증거 검증을 통과한 동일 원문을 영속 보관. 같은 ID/원문은 멱등, 다른 원문은 거절 |
| `batch({owner_binding_id, executor_id})` | 해당 scope의 최대 100개 pending 원문으로 기존 ReportBatch를 영속 저장한 뒤 반환. 응답 유실/DB 다시 열기 후 미완료 배치의 ID·본문을 그대로 반환 |
| `acknowledge(scope, batchAck)` | 배치·scope·각 item ID/hash와 인증된 응답 adapter를 검증한 뒤 포함 항목만 원자 반영 |
| `recover()` | 내부 영속 상태·순번·report/batch hash를 검증한 복사본 조회. 증거·현재 권한을 발급하는 함수가 아님 |
| `authorizeScope(scope)` | 현재 로컬 owner/executor의 발신함 접근 권한 확인. 기본 false. HTTP 전송 권한을 대신하지 않음 |
| `verifyReport(report)` | 실제 issued operation/package/epoch·관측·증거와의 결속을 producer adapter가 검증. 기본 false |
| `verifyAck(scope, batch, ack)` | 실제 인증된 transport 응답과 해당 batch/scope의 결속 검증. 기본 false. body의 성공 필드로 대체 금지 |

내부 metadata key는 `amvp_journal_v1:runtime-report-outbox`다. 값은 `{key, version:1, rows, batches}`이며, 각 row는 `{report, delivery, ack}`, 각 batch record는 `{body:ReportBatch, sha256}`다. 이 형식은 공개 Wire가 아닌 Core 내부 sidecar다. `delivery`는 PENDING/ACKED/REJECTED이며 report 본문의 정책 state와 별개다. `ack`는 null 또는 기존 ItemAck다.

순번 stream은 기존 RPT-01 수신기/DB 유일 키와 같은 `(owner_binding_id, report_epoch)`다. 첫 report_seq는 1, 이후 빈틈 없이 증가해야 한다. executor/runtime_execution_id는 별도 권한·실행/증거 결속 필드이며 새 순번 namespace가 아니다. 실행이 바뀌어도 같은 binding/epoch의 다음 순번을 사용해야 하고, 새 epoch는 별도로1부터 시작한다. 발신함은 ID·epoch·seq·report state·observed_at을 생성하지 않는다. producer는 enqueue commit까지 동일 ID/본문/순번을 보존해야 하며 발신함과 producer의 원자적 생산·checkpoint 연결은 후속이다. 기존 중간 순번으로 시작하는 stream의 checkpoint import도 제공하지 않는다.

ACCEPTED/DUPLICATE만 ACKED, REJECTED는 원문·오류를 보존한 격리 상태다. PENDING_DEPENDENCY/NOT_RECEIVED 및 ACK에서 빠진 항목은 pending으로 남는다. 일부만 완료된 배치는 완료 항목까지 포함한 동일 본문으로 재전송하며 Server의 기존 멱등 처리를 사용한다. terminal 항목은 늦은 응답으로 pending으로 되돌리지 않는다. ACK 자체로 APPLIED/RELEASED·cleanup 완료나 Server projection 성공을 만들지 않는다.

해시/비동기 검증 후 마지막 IDB transaction에서 원장 snapshot CAS를 확인한다. 경쟁 시 `REPORT_OUTBOX_CHANGED`로 원문을 보존하고 호출자가 같은 입력으로 재시도한다. 저장 실패는 성공 반환하지 않는다. 다른 metadata/claim/cleanup 원장은 쓰지 않는다.

## 검증 결과와 재현

Node24.19.0, Linux. P2 수정 후 기존21건+추가7건인 발신함28건은 전체989건에 포함되므로 합산하지 않는다. 통합 기준도 달라졌으므로 과거 전체908건과 단순 증감 비교하지 않는다.

| 범위 | 결과 |
|---|---|
| 발신함 Node/fake-indexeddb | 28/28 PASS, fail/skip0 |
| Extension 전체 회귀 | 989/989 PASS, fail/skip0 |
| 기존 RC2 JS 계약 회귀 | 6/6 PASS |
| Chromium151 실제 IndexedDB | 1/1 PASS, 실행 변경 시 중복 seq1 거절/다음 seq2 접수·새 DB wrapper의 같은 배치 복원·항목 ACK·다른 metadata 보존 |
| syntax/whitespace | PASS |

주요 반례는 기본 권한·증거·ACK 거절, 원문 충돌/변조, 순번 누락/overflow, 잘못된 Schema/date/hash, caller/callback 입력 변조, 다른 owner/executor, 잘못된 batch/item/hash·중복 ACK의 전체 거절, 부분 ACK/응답 유실/지연 ACK, 검증 대기 중 권한 변경, quota 오류, 동시 instance CAS, capacity·100건 배치 분할이다.

```bash
cd extension
npm ci --ignore-scripts --no-audit --no-fund
node --test tests/additional-runtime-report-outbox.test.mjs
npm test
npm run check
cd ..
node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs
git diff --check
```

선택 브라우저 재현은 설치된 Playwright Node module과 Chromium을 사용한다. `PLAYWRIGHT_MODULE`은 require 가능한 package 경로, `CHROME_EXECUTABLE`은 실행 파일 경로다. 기본값은 설치된 `playwright`와 해당 browser다.

```bash
node --test extension/tests/additional-runtime-report-outbox-browser.mjs
```

브라우저 시험도 owner/evidence/ACK는 모의다. 실제 IndexedDB만 검증하며 Chrome/Worker process kill·실제 MV3 DNR·Server 인증/HTTP를 검증한 것이 아니다. 새 CI는 Ubuntu/Windows에서 신규 Node·계약 회귀와 syntax만 수행한다.

## 2026-11-01 P2 순번 scope 수정

리뷰에서 같은 binding/executor/epoch의 실행 A seq1 후 B seq1이 허용되고 B seq2는 거절되는 두 반례를 전달받았다. 수정 전 실제 모듈/fake-IDB로 두 시험 모두 FAIL을 재현했다. 기존 Server `AmvpReportReceiver`의 RPT01 route/position/last 및 `mysql-runtime-candidate.sql`의 `uq_amvp_report_seq`와 맞춰 순번 key만 binding+epoch로 수정했다. enqueue와 recover가 같은 검사를 사용한다. Server/Schema/DB 저장 형식/ACK·권한 adapter는 변경하지 않았다.

추가7건은 두 반례, executor 변경 시 위치 재사용 차단과 배치 격리, 다른 binding의 독립 seq1, 새 epoch/이전 ACK 격리, 저장된 잘못된 중복 위치의 복구 거절·원문 보존, 저장된 정상 실행 전환/연속 순번 복구다. executor 변경 시험은 trusted fixture의 sequence namespace 검사이며 실제 executor 변경 권한을 승인하는 시험이 아니다.

이전 결함으로 이미 충돌하는 원장이 있으면 `REPORT_SEQUENCE_GAP`으로 거절하고 그대로 보존한다. ID/hash/seq를 자동 수정·삭제하거나 새 epoch로 세탁하지 않는다. 해당 원장의 권한 있는 source 대조/복구는 후속이며 자동 migration을 추가하지 않았다. 기본 verifier 거절과 delivery/효과/cleanup 분리는 유지한다.

## 남은 연결·검토 요청

1. 실제 발급 operation/package와 SITE_TIME 원본 증거를 report에 결속하는 producer/verifier, durable epoch/seq/생산 원자성.
2. 실제 Worker current owner 검증·인증된 HTTP/ACK adapter·스케줄링·서버 Receipt 상태조회. 발신함 반환 뒤 전송 직전 권한은 transport가 다시 확인해야 한다.
3. 기본 capacity1024의 bounded 준비 구현이다. ACK/격리 원문도 자동 삭제하지 않아 한도에 닿으면 신규 enqueue를 거절한다. 생산 운용의 보존/압축·격리 복구·처리량은 미구현/미검증이며 조용한 eviction은 하지 않는다.
4. 실제 Chrome 제품 적용·해제/cleanup·owner 전환·재시작/장시간 및 Server 전체 통합 수용. 기존 capability/writer coverage를 활성화하지 않는다.

다훈: 기존 RPT-01/항목 ACK·재전송·owner/executor 및 실제 증거 검증 adapter 경계를 확인해 주세요. 지민: report 전달 ACK가 Content 효과·복원 의무를 해소하지 않는지 확인해 주세요. 수정 필요 시 해당 파일/반례를 남기고, 문제없으면 최신 HEAD를 기준으로 리뷰해 주세요. 병합은 통합 담당이 결정한다.
