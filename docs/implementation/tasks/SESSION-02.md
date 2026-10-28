# SESSION-02 · 세션 종료

단계: 필수 MVP · 설계 담당 영역: 전체

## 작업 상태

- 상태: 미착수
- 실제 담당자: 미지정 (기존 배정 기준)
- 브랜치 / 시작 기준 커밋:
- PR:
- 선행 작업 / 차단 조건:

| 영역 | 담당 | 구현 상태 | 검증 상태 |
|---|---|---|---|
| Web | | 미확인 | 미실행 |
| Server | | 미확인 | 미실행 |
| Extension | | 미확인 | 미실행 |

해당하지 않는 영역은 관련 명세 근거와 함께 해당없음으로 표시한다.

## 설계 참조

- 화면: SESSION-01
- 흐름: TF-05, TF-06, TF-07
- API: API-SESSION-01, API-SESSION-02, API-SESSION-03, API-SESSION-04, API-SESSION-05, API-SESSION-06, API-EXEC-01, API-EXEC-02, API-EXEC-03
- 데이터: focus_sessions, policy_snapshots, active_execution_locks, session_intervals
- 회원: 회원 Web·Extension
- 비회원: Extension 로컬
- 로컬: EXT 로컬 동일 검증/owner별 저장

원문: [화면](../../design/01_UX_기능설계/02_IA_화면명세.md) · [동작](../../design/01_UX_기능설계/03_동작규칙.md) · [API](../../design/02_시스템_테크설계/04_API_연동.md) · [데이터](../../design/02_시스템_테크설계/05_데이터_복구.md) · [검증 기준](../../design/04_검수_예시데이터/07_검증기준.md)

## 설계와 구현 대응

| 기준 ID | 기대 결과(기존 설계) | 코드 위치 | 검증 명령·환경 | 결과 |
|---|---|---|---|---|
| AC-SESSION-02-01 | 실제 적용 후 진행, 해제 후 종료 | | | 미실행 |
| AC-SESSION-02-02 | 중복 시작·미연결 실행 거절, 시작 취소 버튼 없음 | | | 미실행 |
| AC-SESSION-02-03 | 늦은 적용 보고가 종료 의도를 되돌리지 않음 | | | 미실행 |

기존 수용 기준은 출발점이다. 상세 명세의 실제 입력·출력·오류를 검증하며 이 표의 존재만으로 충분한 테스트라고 판단하지 않는다. 관련 BOUND 사례도 선택하여 아래에 기록한다.

## 추가·통합 검증

| BOUND 또는 추가 기준 | 실행 방법 | 결과 | 증거 |
|---|---|---|---|
| | | 미실행 | |

## 중단·재개 기록

- 마지막 작업:
- 완료한 부분:
- 변경 파일 / 실행 방법:
- 미완료·오류·설계 충돌:
- 다음 행동:

## 완료 판정

- 관련 설계 항목 구현:
- 수용 기준 및 관련 경계 사례 검증:
- 실제 연동 확인 (모의 응답 제외):
- 검토·통합 근거:
- 남은 문제:

## 2026-10-09 최신 Server 전달·통합 준비

담당 김다훈(Server/API/DB·연결Frontend), 브랜치 codex/server-event12-integration, 시작develop76df34ea6be1c591be33c29606c24fc654f61932. 기존 담당 배정 유지. 상태: 담당 구현 검토 대기 / 실제Extension통합 미검증. 최신 사용자 지시로 담당 코드 전달용Commit·Push·develop PR을 진행하며 전체MVP완료나 병합으로 처리하지 않는다.

[게시 검증·실행환경·주체·남은 조건](../Server_최신수정본_게시검증_2026-10-09.md) · [실제 API·Event1.2·구형 호환·Core 절차](../Extension_Server_연동가이드.md). Backend 최종107/107(기존106+실제HTTP합성1), Frontend104/104·build PASS. 설치/APPLIED는합성, 실제Chrome/회원Core통합/Content감지는미검증. Snapshot1.2 신규발급OFF. 전체AC를 통과로 승격하지 않는다.

## 2026-10-09 D-01~D-10 정책 확정·문서 반영 기록

담당 배정/기존 상태/과거 검증 이력 유지. 기준 Server b05d9a095b229efe310d5c791189eefb0d30300b / Core e79ef3034e3951a20c735de714debab830006284. [최종공용계약](../../design/02_시스템_테크설계/FOCURVE_D01_D10_최종공용계약.md) 및 [검증 체크리스트](../FOCURVE_D01_D10_검증체크리스트.md) 참조. 정책은 확정됐으나 신규 자동복구/기간·Journal adapter/실제 회원 통합은 미구현 또는 미검증. 기존 AC 통과 상태를 올리지 않는다. 후속: 담당별 구현 영향 문서에 따라 계약 세부 합의·코드 변경·R-T01~12/기능 AC 실제 검증. 이번 제품 코드/DB 변경 없음. 문서 working tree 변경만 있으며 Commit·Push·PR 변경·병합 없음.

## 2026-10-09 로컬 경계 수정 검증

Snapshot/가져오기 safe 상한과 사이트·메모 증가 방어, API 자동복구 미지원/legacy시간 metadata·Web 안내를 반영했다. 기존 시작/종료/구간 집계·Event1.1/1.2·역사 Snapshot 무변환·미지원 RESUME 무변경 회귀를 격리 MySQL로 검증한다. 전체 자동복구/회원 Core실제통합은 후속·미검증이며 기존 AC를 전체 통과/완료로 올리지 않는다. 일반 session.version 극단 경계의 교환 정책은 조율 필요. 최종 실제 실행 결과는 PR18_병합차단_로컬수정_검증보고서.md 참조. Commit/Push/PR변경/병합 없음.

### 최종 로컬 실행 결과 — 2026-10-09

Backend 전체120/120·패키징 PASS, Frontend113/113·빌드 PASS. 격리 MySQL57490의 실제 HTTP/DB import8·execution7·note4·policy6 및 기존 Event1.2 HTTP2 시험 통과. 실제 Chrome/회원 Extension NOT RUN. 일반 session.version 극단 경계 계약은 조율 필요하므로 전체 D03/MVP/병합 완료로 바꾸지 않는다. 증거: <LOCAL_PATH_REDACTED> 및 merge-boundary 로그.

## 2026-10-09 D-03 session.version 최종 호환 처리

사용자 확정 정책에 따른 로컬 구현. 기준 HEAD b05d9a095b229efe310d5c791189eefb0d30300b, 김다훈 담당 Server/API/DB·연결 Web, codex/server-event12-integration. 기존 이력의 session.version 조율 필요/B-01은 당시 판정이며 아래 결과로 갱신한다.

- 생성(start/guest import)은 version1. 새 APPLY→RUNNING 증가는 양의 안전 정수만 가능하고 MAX−1→MAX까지 허용한다. MAX/초과/잘못된 버전의 실제 APPLIED 보고는 사실 접수하되 RUNNING으로 확정하지 않고 UNKNOWN/VERSION_LIMIT 및 RELEASE_POLICY를 발행한다. 보고 HTTP ACCEPTED는 실행 성공이 아니다. 실제 해제 확인 전 잠금을 유지한다.
- 종료/RELEASED/FAILED/UNCONFIRMED/reconcile END 등 안전 처리에서 기존 version이 1..MAX−1이면 정상 증가, MAX 또는 역사 초과이면 값을 그대로 보존하고 증가하지 않는다. 새 초과 값을 생성하거나 기존 값을 clamp/초기화하지 않는다. MAX는 9007199254740991. Session version은 이 예외에서 상태 변경 감지용 단독 validator로 사용할 수 없다.
- Session 응답의 version은 정상 범위 number, 역사 초과는 정확한 십진 string(number|string). version_increment_blocked:boolean은 증가 불가 여부이며 종료 금지나 해제 완료를 뜻하지 않는다. get/current/list/start/end/멱등 재전송에 적용한다. 과거 응답 캐시의 DB 원문도 보존하고 응답 표현만 정규화한다. Web은 Number/parseInt로 변환하지 않는다.
- session resource version과 desired_revision/known_revision/local_action_seq는 별개다. 현재 Session 종료 API는 If-Match session.version에 의존하지 않으며 소유권/설치 인증/행 잠금/명령 revision/보고 hash·중복/행동 sequence 검사를 그대로 사용한다. Event1.1/1.2, Snapshot1.1/1.2, Journal1.1 및 frozen payload는 변경하지 않는다. 독립 revision/seq 극단값의 별도 확대 변경은 이번 범위가 아니다.
- 실제 HTTP/격리 MySQL에서 1/MAX−1/MAX/MAX+1/Long.MAX_VALUE의 명령 종료·UNCONFIRMED·RELEASED와 오프라인 Journal END/reconcile, 중복·잘못된 revision·다른 소유자 거절을 확인한다. 역사 version/Snapshot 불변, 잠금 해제 및 확인된 500ms 집계 유지. Backend 최종127/127·패키징(21:01:59 KST), Frontend114/114·빌드 PASS. mail/OAuth/실제 Chrome·회원 Core·Content는 NOT RUN. 상세 증거는 PR18_D03_session버전_최종호환_수정검증보고서.md.
- Snapshot1.2 신규 발급 기본 OFF, 테스트 profile만 합성 검증 gate 사용. 전체 자동복구는 후속이며 전체 AC/MVP 완료로 승격하지 않는다. 이번 로컬 수정은 독립 재리뷰가 필요하다. Commit/Push/PR 변경/병합 없음.

최종 추가 경합 검증: 미전달 APPLY는 상한 검사 후 해제 명령으로 전환한다. 이미 적용된 APPLY가 상한 감지/해제 명령과 경합하면 유효 실행 구간 증거만 보존하며 현재 revision·UNKNOWN을 되돌리지 않는다. 실제 RELEASED 뒤 구간을 닫고 잠금을 해제한다. 최신 보고서와 session-version-backend.log 참조.


## 2026-10-09 RELEASED 보고 순서 의존성 로컬 수정·검증

독립 재리뷰의 High R-D03-01(당시 RELEASED 선행 409/잠금 유지)을 후속 로컬 수정했다. 과거 판정·이력은 보존한다. 기준 HEAD b05d9a095b229efe310d5c791189eefb0d30300b, codex/server-event12-integration, 김다훈 Server/API/DB 담당. 제품 변경은 ExecutionService의 RELEASED 구간 복구 및 실제 HTTP 회귀 테스트이며 새 상태/API/마이그레이션은 없다.

- 인증된 설치·소유자·세션·현재 명령/revision 검증을 통과한 RELEASED의 닫힌 RUN 증거를, 선행 APPLY 보고가 없고 DB 구간도 없을 때 원래 APPLY 명령·frozen Snapshot에 결속해 복구한다. APPLY 발급 시각(기존 60초 허용)·실행 기한·시작/종료/관측 시각·duration·interval ID를 검증한다. 기존 구간은 덮어쓰지 않고 알려진 RUN의 누락/열린 증거·잘못된 원문은 거절한다. 해제 확인은 인증된 Core의 RELEASED/observed_at 보고 계약이며 Server가 Chrome DNR을 직접 관측한 의미가 아니다.
- 동일 트랜잭션에서 구간 종료·확인된 시간 집계·ENDED 또는 START_FAILED·명령 ACK·잠금 해제를 수행한다. 늦은 구 revision APPLY는 감사 기록만 남기며 종료 상태/시간/버전을 되돌리지 않는다. 동일 report_id/동일 원문은 DUPLICATE, 다른 원문은 REPORT_CONFLICT이다.
- Codex 실행: Backend138/138·패키징, Frontend114/114·빌드 PASS. 추가 HTTP/MySQL 테스트10개(복수 하위 사례 포함), 별도 독립 HTTP 재현 probe PASS. 격리 MySQL8.4.8 127.0.0.1:60046/focurve_contract_test, 합성 회원/설치/보고 사용. 실제 Chrome·회원 Core/Content 통합 NOT RUN. 응답 유실은 클라이언트가 첫 결과를 무시하고 재전송한 모의 사례이며 Server 프로세스 강제 중단은 NOT RUN.
- MAX/MAX+1/Long.MAX_VALUE 버전 원본·frozen Snapshot 보존 및 잠금 해제 확인. 운영 Snapshot1.2 기본 OFF 유지(테스트 프로필만 ON). D01/D05 자동복구 전체 미구현 경계 유지. AC-SESSION-02/03/04의 -01/-03 중 Server 합성 보고 부분만 검증했으며 실제 적용/해제·전체 AC·MVP 완료로 승격하지 않는다.
- 증거: <LOCAL_PATH_REDACTED> 및 released-order 로그. 후속: 독립 재리뷰, 실제 Core 해제 증거·역순/재전송 통합. 이번 Commit/Push/PR 업데이트/병합 없음.


## 2026-10-28 r7 실제 수용·후속 실행 증거 보존

- 담당 영역: Codex 통합 검증 / 브랜치 `codex/mandatory-mvp-integration-20261025` / 기준 `90ad32be5d282f3b44c917a29e156dffc5e29187`. 기존 팀 배정은 변경하지 않음.
- 실제 회원 2분 세션과 정책 세션의 ENDED·잠금 해제 확인, BLOCK·RECORD·일반 영상·직접 Shorts 제한 및 검색 결과 Shorts 숨김 확인. 클릭으로 진입하는 SPA Shorts는 별도 실제 미검증.
- 대시보드·통계 실제 표시: 접근 7, 차단 5, 반복 4. YouTube 기록 품질은 PARTIAL이며 완전 수집으로 승격하지 않음.
- `extension/safety/guest-reader.js`의 연결 해제 후 보존 회원 자료 ACK 대조 범위 누락 수정. 명시 승인 후 같은 r7에 1파일+무결성만 적용, 실제 조회 BLOCKED/pendingOutbox10 → CLEAR_LOCAL_ONLY/모든 의무0. 자료·DNR 변경 없이 읽기만 검증.
- 현재 r7은 HOLD이며 Server·MySQL 정상 종료 및 포트 해제. 비회원 START와 재기동 데이터 보존 실제 수용은 미실행.
- `distribution/installer/product_runtime_entry.py`: 기존 최초 실패를 덮어쓰지 않으면서 실행별 최초 실패도 불변 보존하는 수정은 독립 소스에만 반영. 기존 실행의 누락된 실패를 소급 생성하지 않음. HOLD·END·Cleanup·START 허용 계약은 변경하지 않음.
- 현재 차단 근거: 원래 실패 08:04:42 KST, 후속 READY 08:57:15 KST. 이전 실패를 후속 실행 원인으로 사용하면 정식 타임라인 검증 위반. 이전 성공 HOLD 작업의 재사용도 금지. 미래 기록 보완만으로 현재 HOLD가 해소되지는 않음.
- 검증: Extension 전체591 PASS, 배포/실행 계약 전체364 PASS. 자동 결과는 실제 비회원 수용을 대체하지 않음.
- 증거 위치: 저장소 상위 `outputs/focurve-mvp-integration-20261025/actual-current-r7-20261028/resume-reader-fix-60min/guest-reader-fix/`, 릴리스 준비 `outputs/focurve-mvp-integration-20261025/release-preparation-20261028/`.
- 다음 행동: 현재 실행의 신뢰 가능한 Native 실패 증거 또는 이를 대신할 정식 처리 계약의 설계·검증 근거를 확보한 후 별도 실제 적용·재개 승인을 확인. 현재 안전 판정을 정상 실행 권한으로 간주하지 않음. `MVP_FINAL_COMPLETE=false`. Git index·Commit·Push·Merge 변경 없음.


## 2026-10-28 실행 엔진 분리 실험

- 브랜치: `codex/execution-engine-review-20261028` / 기준 HEAD `90ad32be5d282f3b44c917a29e156dffc5e29187` + SHA 기준 최신 소스 복사
- 상태: 실험 구현, 기존 제품 대체 금지. 담당: Codex(검토·독립 검증).
- 기준: TF-05/06/07, AC-SESSION-02-01~03 및 기존 원장/소유권/ACK 계약 유지.
- 공통 문서 이벤트 계층 1차 구현. 최종 회귀 656건: 655 PASS / 1 FAIL.
- SPA URL·sender URL 변경 통합 반례가 기존 Core/실험 모두 CLEANUP_REQUIRED→UNKNOWN. 실제 Chrome NOT_RUN.
- 상세: [선택적 재구축 검토](../실행엔진_선택적재구축_검토_20261028.md). 다음 작업은 동일 문서 경로 변경의 정식 권한 인계 설계·구현.


## 2026-10-28 Shorts 8영역 동등 P0 통합

사용자 최신 기준으로 진입·DOM/재생·Core/Worker·SPA URL·문서 생명주기·권한/Binding·반복/복원·END/재기동을 모두 P0로 관리한다. 브랜치 `codex/execution-engine-review-20261028`, 기준 HEAD `90ad32be5d282f3b44c917a29e156dffc5e29187`와 독립 후보 소스를 사용한다. 기존 설치·통합 작업 공간은 변경하지 않았다.

전체 Extension 회귀 690/690 PASS. 신뢰된 실험 모드의 제한적 문서 인계, 비회원 D1 문서 retirement 연결, 같은 시각의 이전 COMMITTED 오인과 pending/ready 조정 결함을 수정했다. 원본 proof·복원 원장·5초 기한·소유권 검사는 유지한다. 실제 Chrome 8영역은 모두 NOT_RUN이며 BFCache 정상 복원·실제 Native 재연결·Server/DB 수용은 미확인이다. 전체 완료로 판정하지 않는다.

검토 ZIP SHA-256: `3335acea5823435e04e1da9dcd2591406a1412001fbce8d49db923338d6c865d`. 실제 설치/서비스/START·END 승인은 별도로 요청했으며 승인 전 실행하지 않는다. 상세: [8영역 P0 통합 기록](../Shorts_8영역_P0_통합_20261028.md). `SHORTS_STABILIZATION_COMPLETE=false`, `MVP_FINAL_COMPLETE=false`.


## 2026-10-28 서비스 시작 전 승인 만료 설치의 정식 재개

- 브랜치: codex/execution-engine-review-20261028; 기준 90ad32be5d282f3b44c917a29e156dffc5e29187. 기존 미커밋 변경 보존.
- 기존 INSTALLED + nativeLink 상태는 최초 등록/정상 STOPPED 갱신 양쪽에서 거절됨을 같은 합성 설치로 재현. native_setup.py / session_update.py만 수정. 동일 신원·만료된 기존 승인·미실행·실패/HOLD 없음·Native 등록 검증 후 기존 prepare/apply 경로 재사용. 설치 상태 변경 없음.
- 관련 독립 회귀 67/67, 격리 Python의 원본→2파일 적용·미실행 갱신·정상 종료 갱신 Native 실컴파일 3경로 PASS. 실제 설치 적용/서비스/Chrome 수용은 승인 전 NOT_RUN.
- 기존 5초·소유권·실제 로컬/DB 기동 게이트 유지. 증거: outputs/focurve-shorts-p0-integrated-20261028/pre-service-renewal-20261028/ (작업 루트 기준).


## 2026-10-28 READY 큐 대기 인과 재현·최소 수정

- 독립 브랜치 codex/execution-engine-review-20261028, 기준 90ad32be5d282f3b44c917a29e156dffc5e29187. 기존 변경 보존.
- 기존 실제 세션 354c1411-aec9-45ac-a22e-959de7b129db는 읽기 전용 로그에서 최초 로컬 실패 코드/이벤트 처리 로그를 확보하지 못함. 이번 독립 재현을 실제 사건 원인으로 확정하지 않음.
- 같은 탐색 지연·Root READY 입력과 실제 Core/원장/5초 검사에서 이전 경로 RUNNING, 수정 전 조정기 UNKNOWN(REVALIDATION_REQUIRED), 수정 후 RUNNING→정상 END 재현. Chrome 전송·탐색 지연·IndexedDB·clock은 fixture.
- 문서 수신 순서/observer epoch를 정책 큐와 분리하고 READY/COMMITTED hint만 별도 전달. 전달 시 문서·URL·탐색 epoch 확인, 중복/구문/비활성/이전 문서 거절. Core·P1·D1·5초·소유권·적용 ACK 변경 없음.
- 관련 68/68 및 전체 Extension 704/704 PASS, 회원·비회원 Core 번들 재생성·구문 PASS. 기존 승인 ZIP 미변경, 새 릴리스 ZIP 미생성. 실제 설치/Chrome/DB/START/END/Cleanup/복구/Git 게시 없음.
- 증거: outputs/focurve-shorts-p0-integrated-20261028/ready-queue-fix-20261028/ (작업 루트 기준). 실제 Chrome 수용은 별도 승인·현재 안전 조건을 충족해야 함.


## 2026-10-28 READY 큐 수정 통합 후보 확정

- 기존 704/704 회귀·관련 68건·정식 갱신 67건은 SHA 대조로 재사용. 추가 제품 코드 변경 없이 패키징·정합성·취소 CLI만 검사.
- 후보 ZIP SHA-256: 47505bd3313293350fda304903844c978d2feb4b63c9e511fd5caf97f85317ae. Manifest 4412/ZIP4413, source parity960/build input144 PASS. READY 소스2/번들2 및 viewport 수정 포함 확인.
- 보존된 UNKNOWN 설치는 현재 새 START 대상 재사용 불가. 독립 설치1/최대60분/회원·비회원 정책 각1/30193·30194의 승인안을 준비했으며 실제 실행 승인·기동 없음. BFCache·Native 재연결·END·재기동은 실제 미검증.
- 근거: outputs/focurve-ready-final-candidate-20261028/ (작업 루트 기준). MVP_FINAL_COMPLETE=false.
