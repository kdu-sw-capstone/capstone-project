# AMVP-CORE-04 — 생산 원장→발신함 재전달

윤종민 / `feature/additional-mvp-runtime-report-replay` / 시작 통합 `3569911dde9ec71d86c3b1e36f631c34e2411d53`. PR76 발신함046bac0와 PR78 생산 원장4a2065a는 별도 리뷰 대기로 보존한다. 이 PR은 해당 모듈을 복사/변경/병합하지 않고 내부 service interface를 주입받는 연결부와 시험을 추가한다.

## 기준과 목적

- `docs/design/additional-mvp-contracts/02_API_DB.md`: 원문 ID/hash·순번 보존, 저장 실패·응답 유실의 동일 원문 재시도, 전달 ACK와 실제 효과 분리.
- `docs/design/additional-mvp-contracts/03_Wire_D06_복원.md`: 실제 증거/권한·복원 의무 경계 유지. 공개 RuntimeReport/Schema/Server API는 변경하지 않는다.
- production source의 보고서가 이미 영속 생성됐다는 전제에서, 발신함 저장 전/후 실패에 원본을 잃지 않는 **로컬 handoff**를 제공한다. source 자체의 실제 증거·ID 발급이나 HTTP 전송을 구현한 것이 아니다.

## 함수·입출력

`extension/src/additional-runtime-report-replay.js`:

```js
const replay = new RuntimeReportReplay({
  producer,       // recover(): complete immutable producer journal snapshot
  outbox,         // recover(): validated durable rows; enqueue(report): durable row
  authorizeScope,// async ({owner_binding_id, executor_id}) => strict boolean
  capacity: 1024
});
const result = await replay.replay({owner_binding_id, executor_id});
```

authorizeScope는 기본 false다. 제품의 현재 owner/executor 검증 경로를 주입해야 한다. producer/outbox는 신뢰된 background service이며 메시지 body/Content 함수/미검증 원장 adapter가 아니다. outbox.enqueue는 자체 현재 권한·issued/effect 증거 검증과 영속 commit을 완료한 뒤 반환해야 한다. 기존 outbox.recover의 hash/Schema/ACK 검증 책임을 replay의 진단 코드로 대체하지 않는다.

source는 PR78의 전체 rows `{generation,report,row_sha256}`다. 모든 row hash/report hash·ID 유일성·binding+epoch 연속 순번을 쓰기 전에 검사하고, 지정 binding/executor의 원문만 원래 저장 순서로 전달한다. 시간순 정렬·번호 변경·ID/epoch 재발행은 하지 않는다. paginated/부분 원본을 complete snapshot이라고 주입하면 안 된다.

현재 PR78은 새 execution에 새 epoch를 발급한다. replay는 이를 그대로 유지하며, PR76이 같은 epoch의 execution 전환/다음 seq를 접수할 수 있다는 사실을 PR78의 추가 handoff 지원으로 확대하지 않는다.

target의 이미 영속 저장된 같은 ID/원문은 재사용한다. ACKED/REJECTED도 과거 로컬 접수 기록이며 새로운 실제 관측을 요구하거나 정책 state를 바꾸지 않는다. 같은 ID 다른 원문은 전체 handoff를 중단한다. 없는 항목만 enqueue하며 저장 직후 응답이 유실됐어도 다음 실행은 target.recover에서 그 원문을 찾아 재사용한다. 새 enqueue는 항상 target의 현재 권한/증거 검사를 거친다.

**별도 성공 cursor나 새 metadata key를 만들지 않는다.** source를 삭제/ACK 처리하지 않고, 기존 source 원문과 target의 durable ID/hash 멱등 기록을 재시도 경계로 사용한다. enqueue와 두 원장의 읽기 전체를 하나의 transaction이라고 주장하지 않는다. target 소실/손상 시 과거 cached record를 전송 성공으로 간주하지 않으며 실제 recover/enqueue 검증이 실패하면 중단한다.

성공 결과는 내부 진단용 `{local_only:true, snapshot_count, staged_count, reused_count, enqueued_count, last_staged_report_id, at_report_id:null, deliveries:{PENDING,ACKED,REJECTED}, snapshot_complete:true}`다. staged는 **로컬 target에서 확인한 원문 수**이며 Server 접수·HTTP 성공·전송 가능 상태·실제 APPLIED/RELEASED가 아니다. REJECTED는 격리된 원문으로 계속 보존된다. snapshot_complete는 이 호출에서 읽은 해당 scope의 snapshot만 의미한다. 실행 중 추가된 source는 다음 호출 대상이며 전역 원장이 비었다는 의미가 아니다.

실패는 `REPORT_REPLAY_INCOMPLETE`와 원인 cause, `.progress`를 반환하는 대신 **throw**한다. progress는 메모리 진단이며 durable receipt/cursor가 아니다. staged_count는 확인된 로컬 접수만 세고, target commit 후 응답 유실은 실제 row가 있어도 아직0일 수 있다. 권한이 commit 직후 사라졌다면 count1일 수 있다. 따라서 `at_report_id`를 '저장되지 않은 ID'로 해석하면 안 된다. 재시도는 항상 현재 source/target 원장 조회부터 수행한다.

같은 instance의 동시 호출은 BUSY로 거절한다. 다른 Worker/instance 전체의 lock은 아니며 실제 target의 기존 CAS가 경쟁을 거절하고 원문을 보존한다. capacity를 넘으면 잘라 성공하거나 원문을 삭제하지 않고 거절한다. 처리량·장시간 성능/예약 실행 주기는 미검증이다.

## 검증과 재현

Node24.19.0, Linux. 아래 수는 중복 합산하지 않는다. 전체981건은 통합3569911 + 이 PR이며 pending76/78 시험 전체를 포함하지 않는다.

| 범위 | 결과 |
|---|---|
| 신규 replay 단위 — service I/O 모의 | 20/20 PASS, 전체981에 포함 |
| Extension 전체 회귀 | 981/981 PASS, fail/skip0 |
| 실제 PR76/78 클래스 조합 — fake-IDB·권한/증거/ACK 모의 | 6/6 PASS, 별도 실행 |
| Chromium151 실제 IndexedDB + 실제 세 클래스 | 1/1 PASS, 권한/증거/ACK 모의 |
| 기존 RC2 JS 계약 / syntax / whitespace | 6/6 PASS / PASS / PASS |

단위 반례: 기본 권한 거절, scope 필터, 부분 저장 실패/재실행, 기존 ACKED/REJECTED 재사용, 검증 중 권한 회수, 저장 뒤 권한 소실, 같은 instance 경쟁·실패 뒤 run guard 해제, hash/generation/순번/중복 ID 변조, 잘못된 target 응답·ID 충돌, 입력 변조, capacity, 잘못된 snapshot, 실행 중 새 source 유입이다.

실제 모듈 조합6건: 반복 실행/동일 원문, commit 직후 reply 유실과 과거 live evidence 만료 뒤 receipt 재사용, 실제 put quota rollback/나머지 재전달, 실제 outbox 증거 검증 중 권한 회수, 두 replay instance의 실제 outbox CAS/재시도, ACK 뒤 source UNKNOWN·다른 cleanup bytes 보존. browser1건은 reply 유실→새 DB connection→나머지 전달→ACK/격리→source/cleanup 보존을 실제 IDB로 수행한다. Chrome process/Worker 강제 종료나 MV3/Server 제품 수용 시험은 아니다.

```bash
cd extension
npm ci --ignore-scripts --no-audit --no-fund
node --test tests/additional-runtime-report-replay.test.mjs
npm test
npm run check
cd ..
node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs
```

아직 미병합인 producer/outbox 조합은 각 검토 HEAD의 worktree를 준비한 뒤 실행한다. REPORT_PRODUCER_MODULE은 PR78 `4a2065a7f65c403307d9b17e6fd8a4ceae260f5d`의 `extension/src/additional-runtime-report-producer.js`, REPORT_OUTBOX_MODULE은 PR76 `046bac0f5a5a3906b6fcb066efc7df4158460d54`의 `extension/src/additional-runtime-report-outbox.js` 절대 경로다. 환경 변수 두 개를 지정해 다음을 실행한다. 미지정이면 현재 저장소의 해당 파일을 사용하며, 파일이 없을 때 성공/skip으로 숨기지 않고 실패한다.

```bash
node --test extension/tests/additional-runtime-report-replay-integration.mjs
node --test extension/tests/additional-runtime-report-replay-browser.mjs
```

browser는 설치된 Playwright Node package/Chromium을 사용하며 필요 시 PLAYWRIGHT_MODULE/CHROME_EXECUTABLE을 실제 경로로 지정한다. 시험 서버는 검토된 모듈 원문만 alias 경로에 제공하며 제품에 복사/배포하지 않는다. CI는 신규20건·계약6건·syntax를 Ubuntu/Windows에서 실행한다. pending PR 소스가 base에 없으므로 조합6건/browser1건은 CI에 포함하지 않는다.

## 리뷰·남은 연결

다훈: source/target 멱등 접수·partial failure와 RPT-01 실제 증거/인증 전송 경계를, 지민: cached delivery/ACK와 실제 Content 효과·복원/cleanup 분리를 확인해 주세요. 최신 HEAD의 리뷰가 필요하며 병합은 통합 담당이 결정한다.

PR76/78 승인·최종 통합, 실제 source/issued operation·epoch/effect verifier, production Worker/bundle 주입과 replay 호출/재시도 스케줄링, 인증 HTTP/ACK·Server EvidenceVerifier 결속은 미연결이다. source generation·현재 문서/실제 효과 검증은 target adapter의 책임을 유지한다. 기존 writer/Content/Server·모델·collector/clock 및 정책 활성화를 바꾸지 않는다. `MVP_FINAL_COMPLETE=false`이며 전체 Core 완료율을 변경하지 않는다.

통합 시에는76→78→본 연결부 순서가 적절하다. 같은 CORE-04/통합현황을 추가한 PR끼리는 선행 병합 후 기록 충돌을 재동기화하고 새 HEAD/CI/담당 승인 효력을 확인해야 한다. 이 PR 제출 자체로 선행 PR 승인·통합을 대신하지 않는다.
