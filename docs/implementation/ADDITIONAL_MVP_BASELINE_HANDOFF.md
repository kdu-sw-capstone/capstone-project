# 추가 MVP 개발 기준 인계

기준일: 2026-10-29 KST. 사용자 계획: 추가 MVP 개발 2026-10-29 시작, 2026-11-15 완료 목표. 목표일은 실제 수용 통과 판정을 대신하지 않는다.

이 문서는 기존 코드 동결·Shorts/SPA 작업에 대한 **읽기 전용 확인과 인계 부록**이다. 제품 코드·기존 동결 Manifest/ZIP·다른 Worktree·설치·Credential·DB·UNKNOWN/HOLD를 변경하지 않는다. 새 공통 계약을 승인하거나 버전을 발급하지 않는다.

## 1. 가장 먼저 전달할 결론

- **최종 필수 MVP Git Commit SHA: 미확정**. 최신 통합 구현이 미커밋이고 게시 승인이 없으므로, 존재하지 않는 최종 SHA를 발급할 수 없다.
- 현재 브랜치는 `codex/mandatory-mvp-freeze-20261029`, HEAD는 `90ad32be5d282f3b44c917a29e156dffc5e29187`이다. 이 SHA는 **출발 develop**이지 최신 Shorts/SPA 구현 Commit이 아니다.
- 실제 구현의 식별자는 아래 동결 파일 Manifest/내용 집합 SHA다. ZIP SHA-256을 Git SHA나 공동 승인으로 쓰지 않는다.
- D06은 아래 **구현 버전별 계약**을 재사용한다. 추가 MVP용 단일 D06 최종 revision과 신규 Wire의 3인 공동 승인 완료는 확인하지 못했다.
- 공통 Wire·권한·원장·복원 계약에 영향을 주는 연결만 합의 대기한다. **독립 Web·Server 내부 로직·UI·fixture/모델 준비는 계속 진행할 수 있다.**
- `MVP_FINAL_COMPLETE=false`. 최신 후보 실제 Chrome 수용은 NOT_RUN, 이전 정책 수용은 FAIL/UNKNOWN이며 그대로 보존한다.

## 2. Git·패키지·검증 후보를 구분하는 표

| 식별 대상 | 값 | 의미 |
|---|---|---|
| 원격 develop / 로컬 통합 HEAD | `90ad32be5d282f3b44c917a29e156dffc5e29187` | Git Commit SHA. 최신 미커밋 구현은 포함하지 않음 |
| 통합 브랜치 | `codex/mandatory-mvp-freeze-20261029` | 로컬 전용. 원격 동일 브랜치는 조회되지 않음 |
| 신규 구현 Commit | 없음 | Commit·Push·PR 생성·Merge 미실행 |
| 동결 내용 집합 SHA-256 | `b773a5b336a33781e956cb771c185d75f8de31d2d9e4c7d94fc87d60d9bbe0e8` | 822개 소스 파일의 경로·SHA 목록으로 계산. Git Commit/Tree SHA가 아님 |
| 소스 검토 ZIP SHA-256 | `699bae762dda03536fc3a2913d658d40a82cec6ee39f6e1e9afdce2ad1fb6af7` | `FOCURVE-mandatory-mvp-source-freeze-20261029-final.zip`. 설치용이 아님 |
| 기존 최신 설치 후보 ZIP SHA-256 | `5bcdced239ead3fa458106c2683054cbd4a6e0d248aa04f538c8229112a6b662` | 0.1.25 Shorts/SPA 검토 후보. 실제 Chrome 미수용 |
| 미커밋 변경 | 동결 당시 516개 = 신규478/수정38, 삭제0 | Stage/Commit0. 이 인계 MD는 그 뒤 추가한 문서 부록1개이며 동결 ZIP에 소급 포함하지 않음 |

이번 확인에서 기존 Manifest의 **822개 파일 SHA가 모두 일치**했다. 앞선 동결 검증에서 제품 소스·생성 Extension·빌드 입력 317개가 설치 후보의 기록과 일치했으며, 핵심 변경11개도 일치했다. 따라서 최신 Shorts viewport/READY/진단 보존·문서 재결속·잔여 응답 기한 수정은 **작업 파일에 포함**되지만 Git HEAD에 들어갔다고 표시할 수 없다.

증거 위치(이 작업 폴더 상위의 출력 디렉터리):

- `../outputs/focurve-github-freeze-20261029/FREEZE-MANIFEST.json`
- `../outputs/focurve-github-freeze-20261029/FROZEN-PACKAGE-SOURCE-PARITY.json`
- `../outputs/focurve-github-freeze-20261029/RESULT-REPORT.txt`
- `../outputs/focurve-github-freeze-20261029/SOURCE-ARCHIVE-RESULT.json`

위 경로는 **저장소 루트에서의 로컬 작업 출력 경로**이며 Git에 게시된 문서라고 가정하지 않는다. 팀에 소스 ZIP을 전달할 때 Manifest도 함께 전달한다.

## 3. PR·develop 실제 반영 상태

2026-10-29 조회 시 다음 HEAD와 미병합 상태를 재확인했다.

| PR | Git head | 현재 상태 | 통합 후보에서의 처리 |
|---|---|---|---|
| [#17 Core](https://github.com/kdu-sw-capstone/capstone-project/pull/17) | `92691c55a7c39e810db567bda80445d3bd1a3806` | OPEN, 미병합 | 최신 후보와 의미 대조·원격 전용 파일 보존. Git ancestry merge 아님 |
| [#21 Content](https://github.com/kdu-sw-capstone/capstone-project/pull/21) | `86b0e9ed66e3ae89cb180920b121fbd96f581317` | OPEN/Draft, 미병합 | 최신 DOM/Shorts 후속 구현과 대조·합성. Git ancestry merge 아님 |
| [#22 추가 MVP 설계](https://github.com/kdu-sw-capstone/capstone-project/pull/22) | `a29d02c97724f437d6c059c6d49eca40bd37e197` | OPEN/Draft, 미병합 | Markdown7개를 별도 보존. 필수 제품 코드에 무단 합치지 않음 |

원격 develop에는 위 세 PR과 최신 미커밋 Shorts/SPA 코드가 병합되지 않았다. 로컬 `develop`이라는 이름이나 과거 PR의 녹색 CI만으로 최신 필수 MVP 포함을 판단하지 않는다. 기존 #17/#21을 나중에 기계적으로 추가 Merge하면 구 구현이 다시 들어올 수 있으므로, frozen successor 검토 후 담당자와 원 PR의 잔여 변경을 정리한다.

## 4. D06 현재 구현 버전 — 공동 최종 승인과 구분

JSON Schema 표준은 Draft 2020-12다. 이 표준 버전과 아래 제품 protocol version은 서로 다르다.

| 범위 | 현재 코드 식별자 | 실제 참조 |
|---|---|---|
| 비회원 A1 | `d06-guest-a1-candidate-2`, `urn:focurve:d06:guest-a1:candidate-2` | [contract](../../extension/a1/contract.mjs), [schema](../../extension/a1/schema.json) |
| 회원 A1 | `d06-member-a1-1`, `urn:focurve:member-a1:1` | [contract](../../extension/member-a1/contract.mjs), [schema](../../extension/member-a1/schema.json) |
| 기존 A0 호환/구현 기반 | `d06-shorts-a0-candidate-3` | [A0 contract](../../extension/a0/contract.mjs), [A0 schema](../../extension/a0/schema.json) |
| Native 문서 재검증 | `NR01_1` | [Core](../../extension/member-a1/core.mjs), [회원 보고](../../extension/member-a1/protocol.mjs), [Server](../../runtime-server/src/main/java/kr/ac/kdu/focurve/NativeTransition.java) |
| DOM 효과 재검증 | `DP01_1` | [Core](../../extension/member-a1/core.mjs), [Server](../../runtime-server/src/main/java/kr/ac/kdu/focurve/DomTransition.java) |
| 문서 집합 전이 | `ND01_1` | [document coordinator](../../extension/execution/document-coordinator.mjs), [lifecycle](../../extension/execution/document-lifecycle.mjs), 회원 protocol |
| 회원 확인 시간 모드 | `MEMBER_A1_CONFIRMED_1` | [protocol](../../extension/member-a1/protocol.mjs), [실행 Server](../../runtime-server/src/main/java/kr/ac/kdu/focurve/MemberExecution.java) |
| 같은 보고의 현재 서버 상태 확인 | `NR01_REPORT_CONFIRMATION_1` | [API 문서](../design/02_시스템_테크설계/04_API_연동.md), 회원 adapter 및 Server MemberExecution |

**합의 상태:**

1. [D-01~D-10 최종 공용계약](../design/02_시스템_테크설계/FOCURVE_D01_D10_최종공용계약.md)은 2026-10-09 사용자 확정 정책과 역할 경계를 기록한다. 같은 문서는 D06 기술 세부를 미확정/후속으로 구분한다. 이미 확정된 정책을 다시 미확정으로 돌리지 않는다.
2. [candidate-3 Core 최종 의견](FOCURVE_D06_candidate3_Core_최종의견.md)은 Core 담당 의견 수락이며, 본문에 3인 동일 해시 승인과 별도 sender 검증 전 제품 연결 BLOCKED 및 당시 0/3을 명시한다. 이를 3인 최종 승인서로 사용하지 않는다.
3. 현재 회원 schema 제목의 “independent approved 2026-10-16” 및 비회원 schema 제목의 “APPROVAL PENDING”은 각각 문서 이력이다. **제목·파일명·테스트의 approved 표기만으로 현재 3인 공동 승인/전체 실행 승인 여부를 결정하지 않는다.** 실제 실행의 과거 개별 사용자 승인을 신규 Wire 공동 승인으로 전용하지 않는다.
4. 조회한 Git·문서·PR 및 현재 추가 MVP 인계 입력에서 **새로운 단일 D06 최종 revision에 대한 3인 동일 소스/계약 해시 승인 receipt를 확인하지 못했다.** 구현 식별자와 독립 회귀는 확인됐고, 공동 최종본은 미확정이다.

## 5. D06 실행·원장·복원 계약 대조

다음은 **동결 구현이 검사하는 의미**다. 새 추가 MVP 프로토콜을 승인하는 표가 아니다.

| 항목 | 현재 의미·안전 경계 | 코드/문서 |
|---|---|---|
| 회원/비회원 소유권 | 회원은 인증된 회원·executor·명령·세션·Snapshot/revision 결속. 비회원은 로컬 owner/executor와 분리. 두 실행 계약을 문자열 치환으로 섞지 않음 | member-a1/protocol.mjs, authority.mjs, a1/core.mjs, member-a1/core.mjs |
| START/RUNNING/END | Core가 상태 결정. Content 제어는 QUERY/APPLY/RELEASE이며 Content용 START/END 메시지가 아님. 실제 적용/현재 확인 전 RUNNING 금지, END는 해제 증거·기존 의무 처리 뒤 확정 | [회원 Core](../../extension/member-a1/core.mjs), [비회원 Core](../../extension/a1/core.mjs), [adapter](../../extension/integration/member-a1-adapter.mjs) |
| Snapshot | schema는 format1.1/1.2와 ref의 ID/hash/source_version을 정의. 실제 신규 발급은 owner·기능·profile·명령별 preflight를 추가 확인. schema가 수용한다고 모든 1.2/추가 기능 실행이 허용되는 것은 아님 | 두 schema/contract, MemberExecution.java |
| A1 Aggregate | `A1_AGGREGATE`, schema_version은 각 A1 VERSION. session/generation/intent/phase/NR·DP·ND/의무 보존 | schema `$defs.aggregate`, domain.mjs, store.mjs |
| Operation | `A1_OPERATION`, operation_id·binding_id·scope_epoch·command/fingerprint·최초 응답 불변. 재전송과 새 시도를 구분 | schema `$defs.operation`, registry.mjs |
| Receipt | `A1_WRITE_RECEIPT`, write_id·fingerprint·committed_record_version·first_response. Server Event receipt와 다른 로컬 객체 | schema `$defs.receipt`, registry.mjs |
| Binding | 원래 문서/instance/epoch/등록·원장·권한·복원 증거 결속. 문서 미반환을 소멸이나 복원 성공으로 바꾸지 않음 | schema `$defs.binding/scope`, p1.mjs, d1.mjs |
| Journal | 현재 로컬 행은 owner/session/revision/action_seq/desired/observed/rules 등. `A1_AGGREGATE.schema_version`을 Journal 버전으로 쓰지 않음. 기존 문서의 Journal1.1 교환 계약은 별도 보존 | core.mjs, db.mjs/store.mjs, [공용 계약](../design/02_시스템_테크설계/FOCURVE_D01_D10_최종공용계약.md) |
| Outbox·보고 | 원 ID/본문·소유권 보존, 불명 ACK는 성공 처리하지 않음. 보고 저장 ACK와 현재 RUNNING 증거는 구분 | [member adapter](../../extension/integration/member-a1-adapter.mjs), [회원 protocol](../../extension/member-a1/protocol.mjs), [전송](../../extension/src/member-events.js) |
| DNR·DOM 해제 | 실제 소유 규칙 대조·소유 footprint 복원·release_evidence 필요. DNR0만으로 전체 해제 완료/Binding 삭제 금지 | core.release/finish, content.mjs, dom.mjs, content/changes.mjs |
| 재검증·ACK | NR 최대5초, DP 별도 최대3초; 현재 세대·전이·문서·증거를 대조. 늦은 ACK로 UNKNOWN 해제·기한 연장 금지 | contract.valid, protocol.validateReport, Server NativeTransition/DomTransition |
| UNKNOWN/HOLD | UNKNOWN은 미확인 실행/의무 보존. HOLD는 설치·Native 실행 제어 상태로 서로 같은 enum이 아님. 복구/재시도/END 권한을 자동 부여하지 않음 | Core, [설치 runtime](../../distribution/installer/product_runtime.py), product_hold_recovery.py |
| API·DB 정합성 | 기존 회원 보고/멱등/잠금·Event1.1/1.2 원문·Snapshot/Journal 의미 보존. runtime-server와 backend는 별도 모듈. 추가 runtime 상시 원장을 focus 세션 행으로 위장하지 않음 | [API](../design/02_시스템_테크설계/04_API_연동.md), [데이터](../design/02_시스템_테크설계/05_데이터_복구.md), runtime-server/src/main/resources/db/migration |

기존 검증을 재사용한다: Extension747/747, Web226/226, runtime-server56/56, 기존 Backend 비DB24/24 및 build, Python 설치67/67, C# 합성40개·pipe2경로. 이는 실제 최신 Chrome END/복원/재기동 통과나 신규 추가 MVP 계약의 합의 증거가 아니다. 이번 문서 확인에서 시험을 다시 실행하지 않았다.

## 6. 기존 실행 Wire의 정확한 필드·채널

| 범위 | 현재 식별자/구조 | 주의 |
|---|---|---|
| Core→Content | 비회원 `D06_A1_CONTROL`, 회원 `D06_MEMBER_A1_CONTROL` | 공통 envelope `{request_id,type,owner_context,payload}`; payload에 protocol_version·operation_id·scope·command_revision·operation 및 종류별 필수 필드 |
| Content↔원장 접근 | `D06_A1_STORAGE` / `D06_MEMBER_A1_STORAGE` | 저장 action별 strict schema. 임의 객체 쓰기 API로 쓰지 않음 |
| Native P1 challenge | `D06_P1_PROBE/ATTEST` / `D06_MEMBER_P1_PROBE/ATTEST` | 실제 sender/frame/document/lifecycle·등록·nonce·fingerprint 검증. credential/token을 공용 문서·새 Web 메시지에 노출하지 않음 |
| 제어 응답 | `{request_id,status,data,error}` | status OK여도 result_state FAILED일 수 있음. data에 protocol_version/family/operation_id/operation/scope/result_state/효과·coverage·release 증거/observed_at |
| 식별자 | request_id=전송 상관, operation_id=의미 작업, write_id=원장 write 영수증 | 서로 다른 UUID를 같은 값/개념으로 가정하지 않음. 최초 응답/원문 hash와 멱등성 보존 |
| 문서 scope | `document_id,execution_navigation_id,scope_epoch,content_instance_id,binding_id,tab_id,frame_id` | Chrome의 documentId와 wire의 document_id를 혼동하지 않음. 접근 이벤트의 navigation_id와 실행용 execution_navigation_id도 구분. 임의 navigationId 별칭을 추가하지 않음 |
| session/owner | `scope.session_id,owner_context,executor_id,snapshot_ref` 및 각 fence/generation | echo만으로 인증/소유권 확인하지 않음 |
| APPLY | control_seq·round_id·projection·rule_id·cleanup_authorization_id | 계획/영속 원장 밖 DOM 효과를 허용하지 않음 |
| RELEASE | release_mode NORMAL/CLEANUP_ONLY·applied_binding_id·cleanup_authorization_id, 종류별 control_seq | 새 APPLY 필드를 무조건 요구하지 않으며 원래 Binding의 해제 권한을 확인 |
| 효과·coverage | Shorts viewer/hidden/inert/media/paused·observer·scan/error_count; 일반 화면 candidate/hidden/inert·observer·scan/error_count | 실제 schema 및 effectConfirmed/coverage 판정 모두 필요. “화면이 가려짐”, schema 통과, callback 성공만으로 APPLIED 금지 |
| release 증거 | observer_stopped/timers_cleared/listeners_removed/notice_removed/owned_changes_restored/remaining_owned_changes/error_count | 일부 복원 실패나 문서 불명은 의무를 남김 |
| 대표 오류 | INVALID_SCHEMA, UNAUTHORIZED_SENDER, SCOPE_MISMATCH, OWNER_MISMATCH, OPERATION_CONFLICT, STORE_UNCONFIRMED, REVALIDATION_REQUIRED, INVALID_EFFECT_EVIDENCE, INVALID_RELEASE_EVIDENCE, CLEANUP_REQUIRED, RUNNING_GATE_DENIED | 전체 enum은 schema `$defs.error`가 기준. 새 오류 이름을 이 문서에서 발급하지 않음 |
| Server 명령/보고 | APPLY_POLICY/RELEASE_POLICY; report_id/command_id/session_id/executor_id/desired_revision/result/observed_at 등 | local operation_id와 Server command_id·report_id는 별도. APPLIED/RELEASED/FAILED/UNCONFIRMED/REVALIDATING/EFFECT_VERIFYING 판정은 protocol과 실제 Server 기준 |
| 이벤트·기록 | 기존 Event1.1/1.2 및 개별 event receipt/ACK·원문 중복 방지 | 추가 runtime usage stream에 이름만 바꾸어 재사용하지 않음. 집계 원장은 개별 APPLY first_response를 대신하지 않음 |

기계 판정은 [회원 schema](../../extension/member-a1/schema.json), [비회원 schema](../../extension/a1/schema.json), 각 domain.control·registry·content 및 member protocol을 직접 대조한다. 위 표는 새 wire schema를 정의하거나 exhaustive 필드 목록을 대체하지 않는다.

## 7. 추가 MVP 신규 Wire — 제안만 존재, 공동 합의 미확인

공개된 기준은 [PR22의 공통 계약 문서](https://github.com/kdu-sw-capstone/capstone-project/blob/a29d02c97724f437d6c059c6d49eca40bd37e197/docs/design/additional-mvp/02_공통계약_차이표.md)와 [Git 협업 문서](https://github.com/kdu-sw-capstone/capstone-project/blob/a29d02c97724f437d6c059c6d49eca40bd37e197/docs/design/additional-mvp/04_Git_협업.md)다. 후속 상세 RV/HC 문구는 **별도 설계 Worktree의 미커밋 수정안**이며 원격 PR22에 이미 반영됐다고 표시하지 않는다.

현재 로컬 후속 설계 참조:

`<LOCAL_PATH_REDACTED>

| 식별 | 후속 초안 내용 | 상태 |
|---|---|---|
| HANDOFF-RC1 | 문서 인계 묶음. Wire schema version이 아님 | REVIEW_PENDING |
| RV-D06-01~07 | focus/runtime authority 분리, owner 전환, Worker 재생성, namespace/footprint, 멱등/cleanup, Native sender 결속 | REVIEW_PENDING |
| RV-WIRE-01~07 | runtime 정책/usage/report 별도 stream, strict schema, collector epoch/seq, segment hash·원문, 개별 ACK/status, capability, 정책 교체 | REVIEW_PENDING |
| 후보 stream | RUNTIME_POLICY / RUNTIME_USAGE / RUNTIME_REPORT | 승인된 제품 메시지 타입 아님 |
| 후보 schema 명칭 | RUNTIME_POLICY_1 / BROWSER_USAGE_1 / RUNTIME_REPORT_1 | 공동 확정 버전 없음. 현행 제품 지원을 가정하지 않음 |
| 후보 endpoint | POST /runtime-capabilities/negotiations | 기존 API로 사용하거나 구현 완료로 표시하지 않음 |
| FIN-03 | 측정 정밀도·지연 수용 기준 | 실측/검토 필요. 기존 NR 5초와 사용량 측정 목표를 혼동하지 않음 |
| FIN-04 | D06 결속·복원 기술 확장 | 3인 공동 기술 합의 대기 |
| FIN-05 | 신규 Wire schema/capability/전송 증거 | 3인 공동 기술 합의 대기 |
| HC-01~09 | 후속 정책·권한·Wire·측정·호환 검토표 | 실제 reviewer·동일 revision/hash·최종 source SHA별 receipt 필요 |

확인한 `04_Git_협업.md`의 HANDOFF_INPUTS에는 `approved_contract_revision=CONTRACT_PENDING`, `contract_approval_receipts=[]`, `approved_shared_base_sha=BASELINE_PENDING`가 남아 있다. 서명 원문을 찾지 못한 항목을 공동 합의 완료로 채우지 않았다. 사람의 승인란을 AI 검증 PASS로 대체하지 않는다.

이미 사용자 확정된 DEC-01~07(상시 측정, 설치별 한도, 사용자 시간대 일 경계, 사이트만 차단, ALLOW 우회 금지, 일 종료 후 시간대 변경/잔여 승계, 선택한 완료 비회원 기록의 분석 전용 가져오기)은 유지한다. 정책 확정과 기술 wire/DDL/실측 수용 합의를 구분한다.

## 8. 공동 합의가 필요한 최소 항목과 기록 방식

김다훈·윤종민·채지민은 기존 공통 계약 문서 한 곳에서 같은 revision/hash를 검토한다. 병렬 “최종 계약”을 새로 늘리지 않는다.

1. focus와 상시 runtime의 authority·규칙 namespace·DOM footprint 및 END/RELEASE 대상 분리.
2. 정확한 메시지 타입·버전·required/optional 필드·단위·ID 종류, document/navigation/owner transfer·epoch 경계.
3. 적용·복원 증거와 Core 최종 판정/ACK 의미, 오류·응답 유실·중복·eviction·저장 실패·UNKNOWN 처리.
4. 상시 usage segment의 owner/executor/collector/seq/hash·중복/구간 검증, capability 선택·미지원 하위 호환.
5. Server API·DB migration/멱등키·상태 전이와 기존 Event/Snapshot/Journal 원문 보존.
6. 실제 측정/지연/저장·재시작 수용 기준과 fixture 및 실제 Chrome 미검증 표시.
7. reviewer 이름·시각·계약 revision/hash·검토한 **최종 소스 Git SHA**·범위·승인/보류·검증 근거를 3인 각각 기록.

최종 소스 SHA 발급 전에는 후보 Manifest hash로 사전 검토할 수 있지만, 이를 “최종 Git 기준 공동 승인 완료”로 올리지 않는다. 최종 SHA가 발급되면 같은 코드/계약인지 확인해 receipt를 결속한다.

## 9. 담당별 지금 진행 가능한 범위

| 담당 | 독립 진행 가능 | 합의 전 통합 보류 |
|---|---|---|
| 김다훈 | Web·최신 UI·접근성/화면 상태, 기존 확정 API 소비, Server 내부 순수 로직·단위시험, 새 기능 UI/서버 adapter의 명시적 모의 fixture | 공용 API/Wire·새 DB migration 적용·권한/보고 계약·focus/runtime owner 경계 변경 |
| 윤종민 | Core 추가 기능의 독립 계산/원장 모델·순수 fixture·기존 안전 회귀, 제안 namespace/plan의 격리 검증 | 현행 Core/공유 schema·Binding·DNR namespace·복구·실제 메시지 송수신 계약 변경 |
| 채지민 | Content 서비스별 탐지/DOM adapter·모델·키워드/이미지 독립 fixture·원래 값 복원 시험 | 공용 sender/scope/ACK·새 Wire·실행 권한·기존 Binding 밖 적용/복원 연결 |
| 공동 | 동일 후보/문서의 사전 리뷰와 실제 파일 소유권 조율 | 미확정 wire를 현재 제품에 보내거나 기존 실패 설치에 적용 |

현재 경로: 김다훈 `frontend/src`, `runtime-server/src/main`, `backend/src/main`; 윤종민 `extension/a1`, `member-a1`, `execution`, `background`, `src`; 채지민 `extension/content`, `a0/shorts-effect.mjs`, Content 시험 경로. 공용 contract/schema/manifest·생성 bundle은 공동 검토 대상이다. Generated bundle을 직접 고치지 않고 소스에서 재생성한다.

Shorts/SPA P0는 별도 안정화 트랙으로 유지한다. 같은 Core·Content·문서 생명주기 파일을 두 트랙에서 동시에 덮어쓰지 않는다. 신규 구현은 기존 실패 설치/운영 DB/다른 작업 공간에 적용하지 않는다. 새 공통 Git base가 없다고 기존 팀원 브랜치를 임의 reset/rebase하지 않는다.

## 10. 인계 확인과 다음 행동

- 이번 변경은 **이 MD 한 파일과 외부 확인 receipt**뿐이다. 기존 동결 822파일·Manifest/ZIP은 그대로 보존한다. 제품/브라우저/DB 시험을 반복하지 않는다.
- Git 최종 SHA: Commit·게시·리뷰가 명시 승인된 뒤 발급해야 한다. 현재 지시는 Git Commit·Push·Merge를 금지하므로 수행하지 않는다.
- 계약 공동 승인: 위 receipt가 실제로 모이기 전 `CONTRACT_PENDING/REVIEW_PENDING` 유지.
- 그동안 독립 Web·Server·UI·Content/Core fixture 개발을 계속하고 공통 계약 연결부만 명시적 모의/보류 상태로 관리한다.
- 실제 Chrome·서비스·START/END/Cleanup/복구는 별도 유효 승인과 현재 안전 조건이 필요하다.
