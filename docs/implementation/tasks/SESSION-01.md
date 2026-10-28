# SESSION-01 · 세션 시작

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
| AC-SESSION-01-01 | 실제 적용 후 진행, 해제 후 종료 | | | 미실행 |
| AC-SESSION-01-02 | 중복 시작·미연결 실행 거절, 시작 취소 버튼 없음 | | | 미실행 |
| AC-SESSION-01-03 | 늦은 적용 보고가 종료 의도를 되돌리지 않음 | | | 미실행 |

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

## 2026-10-09 PR18 리뷰 지적 로컬 수정·재검증

담당 김다훈(Server/API/DB·연결Frontend), codex/server-event12-integration, 시작HEAD7dd7abce2bdb7f2d3dfda99c9874c4efb9cd041d. 상태: 리뷰지적 수정·자동/합성 HTTP/MySQL 재검증 통과, 독립 재리뷰·실제Extension 통합 대기. F1복수FEATURE사유·F2버전정수검사·F3실제사유 표시를 수정. Backend109/109, Frontend112/112, 양쪽build PASS. MySQL3308repair_test/HTTP실행; APPLIED·전역정책은합성, Web표시는jsdom HTTP모의. [수정 위치·검증·남은 조건](../PR18_리뷰수정_재검증_2026-10-09.md). 신규1.2발급OFF 유지, 외부/Chrome/전체AC 상태를 통과·완료로 올리지 않음. 코드/계약/테스트/기록은미커밋로컬, Commit/Push/PR변경 없음. 기존 이력 유지.

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

## 2026-10-10 APPLY 기간 전달 게시용 선별

김다훈 Server/API/DB, fix/apply-policy-duration, 기준develop b45a680a9f2262bd9725619e9643df3bb9b91164. 새APPLY root duration_minutes는 DB 목표값1~180분을 사용하며 command/revision/Snapshot/멱등/보고는 유지한다. 제품 기간 변경7줄·기간6테스트·기간계약 문서만 선별했다. 기존 F1~F4 변경은 이 브랜치/PR에 포함하지 않는다. 기존 통합작업본의160/121/HTTP156 PASS는 F1~F4 포함 환경의 과거 근거이며 게시용 선별본의 새검증과 구분한다. 독립재리뷰 REVIEW PASS(기간 Server 범위), 공통Command표 정적검수 PASS. 실제 게시용 검증/Commit/PR 근거는 .reviews/apply-duration-20261010/publish/FOCURVE_APPLY_POLICY_게시결과_보고서.md에 기록한다.

High Core9자리시각 파싱, Medium Core기간검증·영속결속은 후속. 실제Chrome/회원Core NOT RUN, D01/D05자동복구 미구현, 신규Snapshot1.2발급 기본OFF. 전체AC/필수MVP완료로 표시하지 않으며 develop병합은 별도지시 전 금지.


## 2026-10-10 결함 4건 로컬 수정·회귀 기록

- 담당: 김다훈 Web·Server·API·DB. 브랜치: fix/email-code-retry-after. 시작 기준: b45a680a9f2262bd9725619e9643df3bb9b91164.
- 상태: 관련 입력 경계 로컬 수정 검증, 작업카드 전체 완료 아님.
- 이번 근거: F2 이모지 51개 등록 후 정상 Snapshot 생성·시작202 확인. 합성 APPLIED 후에만 RUNNING, 종료·RELEASED 및 중복 이벤트 회귀 PASS. 기본 신규 Snapshot1.2 OFF 유지. 실제 Chrome 적용·기간 전달 계약·자동 복구는 미완료.
- 실행: Backend mvnw.cmd -B -ntp verify(154/154), Frontend npm test(121/121) 및 npm run build, 새 tmpfs MySQL8.4.8·Mailpit1.27의 HTTP(131 PASS/1 BLOCKED).
- 검증 주체: Codex 자동/HTTP/격리DB·Mailpit 및 합성 실행 보고. 실제 Chrome·Edge·외부 OAuth·Extension은 NOT RUN.
- 보고서: .reviews/stage1-fixes-20261010/FOCURVE_1단계_결함4건_수정검증보고서.md 및 검증매트릭스_갱신본. 과거 이력·사용자 직접 확인은 유지하며 이번 자동 검증과 구분.
- 다음 행동: 독립 재리뷰, 실제 UI·Core/Content 통합 검증. Commit·Push·PR·병합 수행 안 함.


## 2026-10-10 F1~F4 게시용 최신 develop 재검증

- 담당 김다훈 Web·Server·API·DB. 브랜치 `fix/stage1-boundary-regressions`, 기준 develop `3d105b05753844ceff28a235751ede4e959b3ef6`(PR #19 병합). 기존 로컬 수정/사용자 확인 이력은 당시 근거로 보존한다.
- 독립 재리뷰 통과 F1~F4만 선별했다. 제품 코드·테스트 12파일은 리뷰 해시와 일치하며 원본 20파일을 보존했다. PR #19의 APPLY_POLICY.duration_minutes 및 공통 Command 표·기간 계약을 유지한다.
- 게시용 작업본 재실행: Backend160/160(실패·오류·스킵0) 및 패키징, Frontend121/121 및 빌드, 실제 HTTP·격리 MySQL8.4.8·Mailpit1.27 156개 검사 PASS. Backend verify 확인까지 합한 harness 검사 157개 PASS.
- 검증 주체는 Codex 자동·HTTP·실제 임시 DB/메일 수신·합성 설치/실행 보고다. 시간 제한 경계는 격리 DB 시각을 조절한 재현이며 실제 한 시간 대기가 아니다. 실제 Chrome·Edge·외부 OAuth·외부 SMTP·회원 Core/Content 통합은 이번 검증 NOT RUN이다.
- 과거 기간 미전달 BLOCKED는 당시 Server 상태이며 PR #19로 Server 전달은 해결됐다. Core의 소수점9자리 시각 파싱·기간 검증/영속 결속 및 실제 회원 실행은 후속 통합 대기다. D-01·D-05 자동복구 전체는 미구현, Snapshot1.2 신규 발급 기본 OFF를 유지한다.
- 상태: 검증된 결함 수정본 Draft PR 게시 준비/팀 리뷰·통합 대기. 전체 작업카드·93개 수용 기준·필수 MVP를 완료로 변경하지 않는다. 실행 로그와 게시 결과는 `FOCURVE_1단계_F1_F4_게시검증보고서.md`에 남긴다. develop 병합은 수행하지 않는다.


## 2026-10-27 통합 수용 재개

통합 검증: Codex, 기존 팀 배정 유지. 브랜치 codex/mandatory-mvp-integration-20261025, 시작 SHA 90ad32be5d282f3b44c917a29e156dffc5e29187. 기존 구현·자동 검증은 재사용하며 현재 실제 회원 집중 수용은 차단 상태다. A0(동일 회원 재인증 전용)·A(PRODUCT HOLD 전이)만 새 승인됐고 정상 서비스·집중 START/END·Git 게시는 승인되지 않았다. 현재 비회원 로컬 조회 UNKNOWN을 보존한다. 복구 전용 관측·현재 독립 DB·회원/설치 신원 확인 전에는 인증·HOLD 전이를 진행하지 않는다.

적용 사전 검사와 잠금 사이 임시 파일 변경으로 부분 적용 후 오류가 발생할 수 있는 결함을 격리 파일 시험으로 재현했다. 잠금 안에서 원본·후보 해시를 재검증하고 검사한 바이트만 쓰도록 기존 두 적용 함수를 수정했다. 실행기·배포 244/244 PASS이며 실제 설치 전이 성공을 뜻하지 않는다. 상세 실행·원본 보존·결과는 작업공간 outputs/focurve-mvp-integration-20261025/acceptance-ready-20261027/CHECKPOINT.json을 따른다.


### 실제 A0·A 결과

A0 동일 회원 재인증과 종료·업무 해시 보존은 성공했다. A 총26경로 적용·재로드1회 이후 HOLD 전이 버튼은 복구 미확정으로 응답했다. 전이·DB 기동 기록은 없고 HOLD·CLOSED를 유지한다. 직접 Native 코드 미확정, 같은 조작 재시도 없음. 거절 코드 영속 기록의 누락만 독립 소스에서 보완하고248/248 회귀PASS. 이 추가 소스는 설치 미적용이며 실제 집중 START/END는 미승인·미실행이다. 최신 TEAM-HANDOFF 및 acceptance-ready-20261027/RESULT.json을 따른다.


## 2026-10-27 Native HOLD 실제 거절 확정 및 최소 수정

승인된 진단 적용은 product_runtime_entry.py 오류 기록 1소스와 기존 결속 메타데이터 총26경로이며 확장 재로드는 하지 않았다. 동일 회원 재인증 후 현재 로컬 CLEAR_LOCAL_ONLY를 받았고 A0 Server·MySQL은 정상 종료했다. 정식 HOLD 요청 1회는 02:49:45 KST PRODUCT_HOLD_CONFLICTING_PROCESS / INITIAL / PREFLIGHT로 거절됐다. 요청·응답 SHA가 결속된 실행별 첫 거절을 보존했고 전이·DB 기동은 없었다.

사용자 Windows 연결 확인(HELLO) 1회로 실제 Chrome41828 → system cmd47116 → NativeHost34868 계보를 읽기 전용 관측했다. 이 PID는 원래 HOLD 거절 순간의 PID가 아니다. 기존 Python 소유권 검사가 정상 cmd 중간 실행자를 충돌로 거절하는 조건을 독립 재현했다. 통합 소스 product_hold_recovery.py는 system cmd 경로·Native 경로·고정 Chrome PID/생성 시각·SID·Extension Origin을 모두 검증한 계보만 인정하도록 수정했다. product_hold_patch.py는 검토된 정확한 사전 거절 해시가 있는 무효과 코드 결함만 별도 승인 후 수정 적용 준비가 가능하도록 제한했다. 자동 범위 갱신·실패 전이 재시도는 계속 거절한다.

제품 관련106건 및 배포 전체262건 PASS. 위 원인 수정 2소스는 실제 설치에 미적용이다. 기존 실제 진단 소스는 적용 상태이며 실제 HOLD PASS 아님. 03:07:22 KST 승인 기한 만료, 요청1회 소진, 추가 적용·재시도·재인증·START/END 없음. Server/MySQL 대상 프로세스 및29511/29512 리스너0, HOLD/CLOSED, 원본 실패·비밀 저장·DB 설정·Git index 해시 보존. 현재 로컬·DB 안전 PASS로 과거 결과를 승격하지 않는다.

근거: outputs/focurve-mvp-integration-20261025/native-rejection-20261027/RESULT.json, ROOT-FIX-MANIFEST.json, D/ACTUAL-first-rejection.json, D/ACTUAL-NATIVE-ANCESTRY.json. 다음 작업은 새 승인 후 동일 설치 원본 해시 재대조·2소스 수정 적용·현재 로컬/독립DB 안전·HOLD1회이며 필요시 같은 회원 재인증을 별도20분 범위로 수행한다. 정상 서비스·집중·Git 게시는 제외한다. MVP_FINAL_COMPLETE=false.


### 2026-10-27 03:20 KST PRODUCT HOLD 실제 전이 PASS

새 승인에 따라 같은 설치의 인증 만료를 DB로 확인 후 동일 회원 재인증을 수행했다. 사용자 현재 로컬 CLEAR_LOCAL_ONLY(18:17:53.313Z), 같은 회원 토큰 발급·업무 데이터 해시 보존과 A1 Server/MySQL 정상 종료를 확인했다. 원본 해시 재대조·백업 후 원인 수정2소스와 결속/무결성 총26경로를 적용했다. UI/Worker 코드 변경·확장 재로드 없음. 새 HOLD 범위는03:18:33~03:38:33 KST, 요청 최대1회.

사용자 버튼1회 후 operation8ae58946d6964f28a481de5b9b11ec6d가03:20:38 KST 정식 전이 성공. 실제 로컬/독립DB 안전 검사와 동일 회원 확인을 통과한 receipt 및 committed 해시를 검증했다. 상태 PRODUCT_RECOVERED_FOCUS_LOCKED, admission CLOSED, startAuthorized=false. 원본 실패·빈 잠금은 해시 그대로 보존/정식 보관됐고 비밀 저장·SMTP·DB 설정·Git index도 불변이다. 기존 설치 메타데이터는 예상된 상태/영수증 참조만 변경됐다. hold-mysql 및 재인증 Server/MySQL 소유 프로세스 종료,29511/29512 포트 해제 확인. START/END·정상 서비스 실행·Git 게시 없음.

이전 RESULT의 HOLD 미성공은 과거 진단 결과이며 최신 실제 결과는 native-rejection-20261027/F/ACTUAL-RESULT.json. ROOT-FIX-MANIFEST는 적용 전후 검토 SHA, F/patch-plan/PATCH-PREVIEW.json은 실제 적용26경로/백업 SHA. 다음은 별도 정상 사용 범위 승인 및 현재 안전 재확인 후 회원 START→RUNNING→END이며, HOLD 승인만으로 진행하지 않는다. MVP_FINAL_COMPLETE=false.


### 2026-10-27 03:32 KST 정상 사용 시험 중단·전용 backend 정상 종료

동일 설치 정상 사용 최대60분 새 승인에 따라 설치 소스는 그대로 유지하고 기존 installed-source 정식 갱신을 적용했다. 기한03:23:39~04:23:39 KST, 새 START 마감04:13:39.03:26:38 Server Health UP·READY 일치·DB 세션/잠금/Receipt0 확인. 사용자가 집중 팝업을 열며 서비스 제어 탭의 주소를 바꿨다고 확인했다. 문서가 소유한 Native 연결이 종료되어 제품이 다시 HOLD/CLOSED로 보존됐다. Codex의 새 탭 안내가 명확하지 않았던 실행 안내 오류다. 이후에는 제어 화면의 target=_blank ‘집중 팝업 열기’를 사용한다. 실제 Native 종료 코드는 새 실행별로 남지 않아 미확정이며 오래된 원본 첫 실패를 이번 원인으로 재사용하지 않는다.

사용자 로컬 조회 R4_UI_HOLD_1 UNKNOWN / USER_OPERATION_UNCONFIRMED, counts null. 현재 안전 PASS 아님. 회원·비회원 실제 START→END 미완료, DB 세션 생성0. 별도 backend-only 종료 승인을 받은 후 정확한 PID/경로/설치 신원·DB 세션/활성세션/잠금/Receipt/대기메일0 재확인, Server quiesce→정상 shutdown→MySQL 정상 shutdown 및29511/29512 포트 해제 확인. Chrome·설치메타데이터·HOLD·READY·원본 실패/잠금·비밀 저장·DB설정 해시 보존. END·Cleanup·복구·재로드·재기동·재시도 없음.

이전 PRODUCT HOLD 전이 PASS는 유효한 과거 결과다. 새 post-READY 채널 단절 HOLD를 과거 pre-service 원인으로 재분류하거나 같은 복구를 재생하지 않는다. 이번 실행 종료, 자동 계속 실행 아님. 최신 증거 native-rejection-20261027/G/INTERRUPTION-RESULT.json 및 APPROVED-BACKEND-STOP-RESULT.json. MVP_FINAL_COMPLETE=false.


### 2026-10-27 제어 탭 단절 재발 방지 (독립 소스만)

SESSION-01/03, 통합 브랜치/HEAD 유지. 새 실행기·설치 없이 native-link session.js·index.html에서 제어 탭 역할과 별도 팝업 링크를 명확히 했다. 단절 후 늦은 READY/COMPLETE가 실패 표시를 되돌리는 UI 결함을 독립 재현(수정 전5실패) 후 terminal failure 및 비동기 응답 차단으로 수정했다. 준비 전/종료 중/실패 후 사용 링크 숨김, 자동 재기동·END·복구 없음. tab-owned Native 구조 유지, 주소 변경·닫기·새로고침을 견딘다고 보장하지 않는다.

관련 Node VM/jsdom40/40, Windows 실행 계약 fixture16/16, JS 구문 검사PASS. 실제 Chrome 미실행. USER-RUNBOOK-CURRENT에 정확한 화면/버튼/순서와 단절시 중단 절차 추가. 설치 HOLD/UNKNOWN·원본 기록·Credential·Git index 해시 불변. 서비스 기동·재로드·START/END·복구 없음. 이전 cmd 계보 충돌 및 실제 HOLD 전이 PASS는 이번 post-READY 주소 변경 사건과 구분한다. 현재 UNKNOWN에서 START 불가. 원인에 맞는 정식 HOLD 처리·현재 로컬/DB 안전·수정 적용과 새 승인 필요. 변경 파일 SHA 및 근거: outputs/focurve-mvp-integration-20261025/native-rejection-20261027/TAB-LIFECYCLE-RESULT.json. MVP_FINAL_COMPLETE=false.


### 2026-10-27 탭 수정 실제 적용 준비 및 새 HOLD 적합성 확인

기존40+16 PASS 재사용. 탭 UI2파일의 검토 SHA/설치 원본 SHA 일치, public source·설치 결속·원본 실패/잠금/READY/CLOSED 백업과 해시 검증 완료. 실제 설치 변경/DB기동/재로드 없음. 현재 로컬 UNKNOWN의 직접 gate는 focurve_user_ui_hold 표식이며 기존 안전 UI는 marker 존재 시 의무 집계 전에 UNKNOWN을 반환한다. 실제 표식의 action/requestId/시각은 아직 미관측. STATE 조회 실패도 onHold를 기록할 수 있어 START라고 추정하지 않는다. 기존 정식 HOLD경로는 pre-service 실패만 지원하므로 이번 post-READY 단절에는 부적합. old cause/gate 우회하지 않음.

불필요한 재인증/새설치 없이 원인 관측을 위해 safety/ui.js에 화이트리스트 요청 메타데이터만 노출하는 독립 보완을 작성했다. UNKNOWN/counts null/의무 관측 차단 유지, write/remove 없음, 비밀값 비출력5/5 PASS. 실제 적용 미승인/미적용. 제안 최소 범위는 diagnostic1파일 임시10분/조회1회/정확한 원복 및 현재 독립DB 읽기 조회20분·정상 종료. Server/인증/HOLD전이/START/END 제외. 상세 target/candidate/original SHA: native-rejection-20261027/TAB-APPLY-READINESS.json.


### 2026-10-27 04:09 KST 승인된 읽기 전용 진단·DB 조회 완료

safety/ui.js1파일 임시 진단은04:07:29~04:17:29 범위로 적용, 사용자 조회1회 후04:08:45 KST 정확한 원본 SHA9775ce2376e837994aa5a17e3066d500083ba793c9e3b34bf0266d46756c5487로 원복/설치무결성 확인. 관측된 UI HOLD는 START/MUTATION_REQUEST/unconfirmed=true, requestId13ddd97b-7f5b-4dd6-a69d-7b274140b1c0, atUTC2026-10-26T18:27:56.359Z. 단순 조회 실패로 분류하지 않는다. gate UNKNOWN/counts null 유지, 표식 삭제/인증/START/END/복구 없음.

별도20분 승인 범위로 독립MySQL만 ui-review-mysql 역할로 기동, 현재 설치·포트·datadir·listener 계보 확인 후04:09:35 KST 읽기 전용 일관 스냅샷 조회. 회원1/동일 executor 소유결속1/사이트3, 세션rows/활성세션/잠금/미처리Receipt/Receiptrows/대기메일 모두0. 정상MySQL종료·29511/29512해제·소유프로세스부재 확인. 설치/기존실패/잠금/READY/CLOSED/비밀저장/설정/Git index SHA 보존. 과거 재인증Server PID19956은 다른 생성시각의Edge로 재사용됐음을 읽기 전용 분류했으며 해당프로세스/소유권기록 변경 없음.

탭 UI수정2파일 미적용, HOLD전이 미실행. 로컬START결과 미확정이며 DB0만으로 로컬의무없음 또는START실패확정이 되지 않는다. 기존pre-service 전이는 current post-READY 원인에 부적합. 새 실행/재인증/전이/집중승인은 요청하지 않았으며 승인된 진단·DB작업은 종료됐다. 근거 native-rejection-20261027/READONLY-DIAGNOSTIC-DB-RESULT.json. MVP_FINAL_COMPLETE=false.


### 2026-10-27 04:20 KST 미확인 START 원장 추적 (실제 설치 변경 없음)

요청13ddd97b-7f5b-4dd6-a69d-7b274140b1c0의 마지막 실제 근거는03:27:56 KST 팝업 onHold START표식이다. 이는 Worker 실제 수신/ACK를 증명하지 않는다. 설치 코드 경로에서 UIrequest_id가 adapter.start(minutes) 호출 시 버려지고, 어댑터가 독립 UUID member:start-intent를HTTP Idempotency-Key로 쓰는 결속 누락을 확인했다. 전용private log8개에서 해당UI ID0회(원문 출력 없음); 미수신 근거로 승격하지 않는다. Native는서비스수명주기전용이며 집중 START ACK가 기대되지 않는다. Journal/Outbox/Lease/Binding/DNR의 이번 사건 실제값은 미관측이다. 설치JSON HOLD mtime03:27:36은 파일메타데이터일 뿐 단절 eventtimestamp가 아니다.

기존 통합 후보에서 Worker가 requestId를 어댑터에 넘기고 새 START intent에ui_request_id를 보존하도록 최소 수정했다. 기존Server멱등키는 유지하며 같은완료/미확정UI요청 중복POST, 다른요청 결속, 레거시intent 소급귀속을 거절한다. 생성bundle sourceclass일치. 수정전재현6실패→관련회귀44PASS. 실제Chrome미실행/미적용. source3개+test1개 SHA는 native-rejection-20261027/START-REQUEST-RECONCILIATION.json.

현존 요청 판정은 REQUEST_RESPONSE_UNCONFIRMED 유지. DB04:09시점0건은 로컬START미적용 근거가 아니며 DB현재정지. 실제HOLD전이/재로드/DB/Server기동/START/END 없음. 새 post-READY 전이는 로컬원장/DNR 및 늦은실행없음이 입증되기 전 구현완료/허용으로 판정하지 않는다. 다음 최소관측은 같은설치 read-only 원장/start-intent/DNR double snapshot1회이며 기존UNKNOWN·인증·원장·ACK는 변경하지 않아야 한다. 설치·Gitindex불변, MVP_FINAL_COMPLETE=false.


### 2026-10-27 04:30 KST 기존START 실제 원장 관측 준비·실행 차단

기존44건PASS재사용. 최신 지시대로 새UI START의 UIrequestId를 intent.id/ui_request_id/HTTP멱등키 동일값으로 유지하도록 독립source/bundle 수정. 레거시ID소급귀속·완료/미확정요청 재사용 거절 유지. 기존 safety reader의 readonly double snapshot/schema/timeout/resource 정리를 재사용한 auditPendingStart를 추가, 같은START marker신원 결속 후 원장/start-intent/실제DNR을 비밀값 없이 보고한다. 감사결과는 항상UNKNOWN, token만료는저장소유자관측용일뿐인증판정아님. 일반safety의만료인증거절유지. 변경관련22/22PASS, 실제설치미적용.

실제관측 전OS신원검사에서 저장Chrome41828부재 및 정확한 전용profile Chrome 실행없음을 확인했다. 기존프로필 일반기동은 Worker 초기화/auth.status/GuestSession.tick 경로를 실행할 수 있어 현재 no-storage-write/no-auth-refresh/no-reload 조건을 보장하지 못한다. 새Chrome기동·Worker변경·파일임시적용·재로드·원장관측을 강행하지 않았다. DB/Server정지·기존HOLD/UNKNOWN/실패원장/설정/Gitindex불변. 실제STARTintent/Journal/Outbox/Lease/Binding/DNR미관측, 사건판정UNKNOWN. 관측진단후보는safety2파일이며새15분임시적용/query1/원복승인이필요하나, 현재Chrome없어우선읽기전용기동경로확보가선행. 추가실행승인요청/실제실행없음. 변경SHA/대상/부족증거는 native-rejection-20261027/PENDING-START-LEDGER-READINESS.json.


### 2026-10-27 독립 Chrome 관측 시험 및 수용 준비

기존 프로필이 아닌 빈 합성 전용 Chrome 1개를 13:18:10~13:33:10 KST 승인 범위로 실행했다. 실제 확장 ID dahfaencobbnlbbmeaekeaidmhkppijp, 사용자 확인 URL /safety/index.html. 합성 준비 1회가 FIXTURE_PREPARE_UNCONFIRMED로 실패해 원장/DNR 조회와 전후 비교는 미실행이다. 상세 오류를 숨긴 기존 진단 UI 때문에 실제 실패 원인은 아직 미확정이다. 반복하지 않고 13:26:14 KST 정상 종료, 정확한 시험 프로필 프로세스 잔여 0. 실패 프로필/원본 fixture 파일 보존. 실제 Chrome 읽기 전용 PASS가 아니며 ADDITIONAL_EVIDENCE_REQUIRED 유지.

Chrome 종료 뒤 동일 fixture의 오류 표시만 단계/허용 오류 종류/재시도 금지 JSON으로 보완했다. 독립 Node의 DNR 실패 주입으로 원문 오류 비노출·조회 비활성 유지 확인, 실제 Chrome 재시도 없음. 제품 소스 추가 변경/기존 설치 적용/DB·Server·START/END 없음.

별도 수용 준비: 현재 소스에 요청 ID 결속 3파일·탭 단절 UI 2파일·회원 재인증이 존재한다. 최신 검토 ZIP SHA 970491991f1a853d6c258c9fd052df99116303bb9ba2de7baf32bfe3dbad0a0e는 과거 증거와 일치하지만 최신 ID/탭 수정 5파일이 미반영이다. 기존 통합 Manifest 대비 41경로 변경. Web 계약 현재 해시 일치·서버 JAR 복구/실행 클래스 존재, 실제 수용으로 확대하지 않음. 소스 544파일 제한 패턴 검사 발견 0건(전수 비밀 부재 보증 아님). 원격 PR17/21 open; 현재 중첩 경로 충돌 미리보기 24/3경로 검토 필요. Git index 기준 SHA 동일, 게시/병합/PR22/다른 Worktree 변경 없음.

근거: outputs/focurve-mvp-integration-20261025/native-rejection-20261027/READONLY-CHROME-AND-ACCEPTANCE-RESULT.json, ACCEPTANCE-PREPARATION-CURRENT.json, CURRENT-CONFLICT-REVIEW.json. 기존 b3d6 설치 HOLD/UNKNOWN 미변경·기존 START 결과 미확정. 다음은 실패 세부 단계의 제한 관측과 최신 소스가 포함된 수용 패키지 준비이며, 기존 프로필 관측·새 설치·서비스·집중 실행은 별도 승인/안전 게이트가 필요하다. MVP_FINAL_COMPLETE=false.


### 2026-10-27 최신 수용 패키지·실제 설치 후속 차단

누락5파일 및 회원재인증을 포함해 소스/생성bundle/설치Manifest/ZIP을 대조했다. 실제 신규 d835 설치·DB초기화는 완료했지만 Native import가 -I에서 product_hold_patch를 찾지 못해 중단. 고정경로/파일SHA를검증하는 모듈로드로 최소수정, 독립3·Native19회귀PASS. 실패Native잠금/프로필/기록보존·Chrome정상종료.

r2 135d, r3 5297 새설치에서는 인증서 My생성/export후 Root요청이 각각30초/180초로 중단됐다. r3 원본 first-install-failure는 REQUEST_CURRENT_USER_ROOT_TRUST를 확정한다. 정상 별도프로세스로 동일 공개CER만 Root등록해 각각실제PASS, 설치실패상태는변경하지않음. 이에 기존certificate.ps1을 Create/Trust/Inspect 단계로분리, 지문/사용자My키/유효기간/Root확인, 비밀번호신뢰프로세스미전달, WindowsPS5 UTF8BOM 및오류단계기록을적용했다. 기한확대나보안자동승인으로해결했다고주장하지않음.

활성후보 acceptance-current/FOCURVE-0.1.25-integrated-acceptance-20261027-r4.zip SHA cf94a6edcbd2de0132ba0ad8531b68ec17bbb1c6814b7bc9ed1c4c49d5161ea6. 패키지4404/ZIP4405·source952/buildInputs140 대조PASS. 실제회원/비회원집중수용미완료.

현재5297 설치는DB/profile/Native/회원자료가없는INSTALL_FAILED_PRESERVED. 알려진Root요청실패만기존정상설치마지막루틴으로완료하는좁은기능을통합후보에구현했다. HOLD/원인불명/기존DB나profile/변조/기한/중복거절 및정상init-stop공유11PASS, certificate5PASS, controlCLI6PASS. 원본실패/SMTP비밀파일보존·현재Root읽기확인필수. preview에서기존4398복사파일일치, 설치코드2+provenance/controlManifest=4경로후보/원본해시와백업준비. 기존설치에는미적용·실행대기, 사용자의한정예외+새60분승인을요청했다. 새설치/인증서/비밀번호재입력불필요.

별도합성Chrome2 실제 indexedDB.databases UnknownError/STORAGE_BACKING_ERROR 확인, Storage/SessionDNR/DynamicDNR 읽기0정상. 준비쓰기는발생전실패·조회전후비교미실행, 정상종료. 하위OS/Chrome원인은미확정이며readonlyChromePASS아님. 원래b3d6HOLD/UNKNOWN/Default/Profile2/운영DB/원본R3/팀원Worktree/Gitindex보존. Git게시없음, PR17/21 검토충돌24/3경로해결전. MVP_FINAL_COMPLETE=false.


## 2026-10-27 ROOT_UNCONFIRMED실행 증거 대조 (UNKNOWN preserved)

설치5297/Extension ejeg의 실제 세션 cecf2b03-2a51-42cc-87c1-e4032b1d5e98은 34,030ms 확정 구간 뒤 NR01 재검증에서 UNKNOWN. 재검증 시작07:44:30.130Z, 기한35.130Z, APPLIED 관측35.064Z, 보고HTTP 시작35.111789Z/49ms 및 후속GET35.1708439Z/9ms, 부정보고37.124Z 후 서버37.151Z ROOT_UNCONFIRMED. 서버 직접분기는 CONFIRMED된 전이에 같은 UNCONFIRMED 보고가 온 경우로 Java 실제분기 시험3PASS. 서버의 단순기한초과 SERVER_DEADLINE과 구분했다. 원래 Core 최초거절코드는 서버에 전달되지 않아 실제 필드불일치/정확한Core최초예외까지 확정하지 않는다. Adapter가 원본 오류를 생략하는 확인된 기록결함만 allowlist로 수정하고 번들을 재생성했다. 기한/소유권/안전검사 변경0.

기존 Core END의 same-owner/native해제 성공, 다른owner거절, RELEASE 응답유실 시 ENDING/의무보존을 독립 fixture로 확인. Core/보고8PASS 및 결속/번들 영향16PASS(중복 포함, 합산금지). 실제설치 적용/END/Cleanup/HOLD수정/서비스기동0. DB최종 UNKNOWN1·잠금1·Receipt0, 승인된 Server/MySQL만정상종료·포트해제. 현재 DB는정지로과거0안전승격금지, 현재로컬원장/DNR/인증과 재기동Chrome Native신원은미관측. 현재인증복구는잠금0을요구하므로이번사건에무조건재사용불가. 세부파일SHA·경로·최소조건 ROOT-CAUSE-AND-UNKNOWN-PLAN.json, 실제수용미완료/MVP_FINAL_COMPLETE=false.


## 2026-10-27 실제 로컬 최초 실패 원장 대조

사용자 DevTools 수동 조회에서 aggregate diagnostic_codes=REVALIDATION_REQUIRED, nr_first_failure=RESPONSE_UNCONFIRMED/2026-10-27T07:44:35.197Z를 확인했다. 같은 전이 deadline=07:44:35.130Z보다 67ms 늦다. 서버 APPLIED 보고와 후속 GET 완료(~35.180Z) 뒤 기존 pending 전이의 기한 검사에서 거절되는 코드 흐름과 일치한다. 정확한 최초 호출 스택·rejected_fields는 당시 저장되지 않아 post-callback nrCheck(old) 호출 위치는 추론으로 구분한다. 이후 PROCESS_STATE_LOST는 재기동 관측이며 최초 원인으로 소급하지 않는다.

동일 상대 시각 4934ms + awaited 133ms를 독립 Core fixture로 재현해 deadline_at 거절·UNKNOWN·첫 실패 보존을 확인했다. 관련 Core/오류전달 12/12 PASS. 5초 기한·신원·소유권·정책 검사는 변경하지 않았다. 원문 내부 자격값은 재출력/보고서 복사하지 않았다. 보이는 첫50행은 전체 원장 조회가 아니며 aggregate DNR ID는 실제 현재 DNR 조회가 아니다. 현재 UNKNOWN/잠금·설치 원본 보존, 실제 적용·서비스/DB기동·END/Cleanup·재로드0. MVP_FINAL_COMPLETE=false. 증거: LOCAL-FIRST-FAILURE-SANITIZED.json 및 ROOT-CAUSE-AND-UNKNOWN-PLAN.json.


## 2026-10-27 NR01 재검증 직렬 대기 최소 수정

기존 코드는 nrBegin→REVALIDATING보고/flush→50ms coalesced requestCheck→reconcile/실제증명→CONFIRMED commit→APPLIED보고/flush→POST ACK→별도GET세션→nrCheck(old) 순서다. sender/소유권/NR01 5초 검사 및 실제 적용 증거는 보존했다. NR 시작 후 확인만 즉시 예약으로 우선하고 dirty/직렬 큐/UI 보류를 유지하며 반복 알림이 즉시 타이머를 재예약하지 않게 했다. API-EXEC-02는 같은 보고 트랜잭션의 결속된 실행 상태만 선택적으로 반환하고, Adapter는 report/command envelope 및 기존 GET의 모든 범위 검증을 수행한다. 구 서버는 기존 GET 경로, 잘못된 신규 응답은 거절한다. 보고 원문·Event/Snapshot·Outbox ID/멱등성은 변경하지 않았다.

기록된 상대시간을 주입한 결정적 모델은 기존50ms예약+GET에서 기한67ms초과, 수정 조합에서 기한2ms전 완료를 재현했다. 당시 호출 스택·50ms기여분·로컬확인 전4.884초 비용은 로그가 없으므로 역사적 인과/실제Chrome 안정성으로 승격하지 않는다. 보고응답 자체의 기한초과는 계속 UNKNOWN, 응답유실 재전송은 동일report_id, 늦은 ACK/세대/revision/소유권불일치는 RUNNING승격불가, 미확인 정책은 APPLIED발행불가다.

변경 영향 Extension109PASS·Server실제보고분기/Native11PASS·Server JAR 빌드PASS, 마지막즉시타이머중복예약보완후 해당15PASS·생성번들/요청결속11PASS 재확인(중복합산금지). 현재소스/생성번들/JAR를 원본SHA와 대조한 검토delta ZIP8경로로 묶고 CRC/SHA대조PASS. 기존r4 full ZIP은 그대로이며 최신으로 재표시하지 않았다. PATCH는 설치용무결성/Native결속 재생성이 필요한 검토자료이고 자동실행코드가 없다. 상세 SHA/적용선행조건은 REVALIDATION-PATCH-MANIFEST.json.

실제설치 적용·재로드·Chrome/Server/MySQL기동·START/END/Cleanup·HOLD해제0. UNKNOWN세션/잠금1·기존회원/실패증거 보존, 현재DNR/의무/인증/Native신원 및 승인된 현재DB 조회 후 동일세션 정식해제 계약이 필요하다. 기존잠금0 전용재인증·기동전HOLD복구를 우회로 사용하지 않는다. Git index hash b35f20479bcfd84494fec6cf5114c1c773cd2dd7ba5643df712679f1e0fdf565 유지. MVP_FINAL_COMPLETE=false.


## 2026-10-27 NR01 무응답 대기 안정성 보완·실제 재개 선행조건

기존8경로를 재사용했다. NR 보고 ACK/구형서버 GET/REVALIDATING보고/Worker재생성 보고가 반환되지 않으면 Core가 기존5초가 지나도 기다리는 누락을 독립재현했다. 보관된 이전 Core(a5a7c6ed…)에 최종 같은 무응답4시험을 실행해4FAIL을 보존했다. 기존 Core의 waitNativePublication으로 동일 NR deadline까지만 기다리며 기한후 REVALIDATION_REQUIRED·UNKNOWN·첫실패·DNR의무를 유지한다. 네트워크의 늦은 ACK는 기존 Outbox 행만 처리할 수 있고 이미 거절된 reconcile을 재개하거나 UNKNOWN을 해제하지 않는다. 5초 연장·재시작·정책변경·토큰재전송·자동Cleanup은 없다.

변경영향90PASS, 추가 같은세션 CoreEND/Worker재생성의 fresh native 해제1PASS, 이전Server11PASS는변경없어재사용. 생성번들/SHA/ZIP대조PASS. 이번 보완제품경로는 Core소스+번들2개이고 총8경로 목록은유지. 이전review ZIP은해시별백업보존, 현재검토ZIP/Manifest갱신. 기존full수용ZIP은변경/최신표시하지않음. 시간모델2ms는여전히Chrome실행근거아님; 최초Worker오류확정은과거REVALIDATION_REQUIRED이며이번무응답누락이그사건직접원인이었다고소급하지않는다.

현재설치원본8SHA일치·PRODUCT_HOLD·admission.closed·전용schema/datadir/포트30176을공개파일읽기로확인. OS관측상대상Server/MySQL프로세스·30175/30176리스너없음. 현재DB/DNR/인증안전조회로승격하지않음. 독립MySQL최대20분읽기전용조회/정상종료승인만사용자에게요청했고응답대기; 승인없이기동하지않음.

정식해제는같은세션/회원/설치·현재Native/DNR/원장·DB결속과실행승인이필요. Core END의독립성공은실제복구아님. 현재popup UNKNOWN은END비활성, runtime END는Server경로이며offlineEnd는현재제품메시지에미노출. 잠금0전용재인증으로잠금1을우회할수없고예전Chrome PID결속도수동변경금지. 따라서DB조회승인만으로실제END/복구/START가능하다고판정하지않는다. 실제적용/재로드/Chrome/Server/MySQL기동/END/Cleanup/START0, 기존UNKNOWN·실패·회원자료·Gitindex보존. MVP_FINAL_COMPLETE=false.


## 2026-10-27 승인된 독립 MySQL 현재 읽기전용 조회·정상종료

사용자가설치5297전용MySQL최대20분조회/정상종료만승인했다. 실행범위19:15:38.566~19:35:38.566KST를외부SCOPE에등록하고19:15:49.986KST정상종료로폐쇄했으며재사용하지않는다. 기존설치/HOLD/기한파일은변경하지않고프로세스등록원본은별도보존했다. 정확한binary/설치mysql.ini/datadir/schema/30176·실제수신PID계보를대조했다. Server·Chrome·다른DB기동0.

START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY 안에서같은회원1/executor995a…/세션cecf…·잠금revision결속확인, UNKNOWN세션1·잠금1·Receipt0/미해결Receipt0을실제관측했다. 두독립읽기결과와session bodySHA일치. END/Cleanup/복구/HOLD전이/SQL변경/패치적용/확장재로드/집중START0이다. mysqladmin정상종료·대상PID종료·30175/30176포트해제확인, 설치기록/실패/lock/SMTP보호파일해시모두동일. 데이터디렉터리의정상MySQL기동/종료내부기록과mysql프로세스등록·로그외제품코드변경없음.

DB관측은안전CLEAR가아니라미해소UNKNOWN/잠금1의소유권확인이다. MySQL은다시정지했으며현재로컬원장/DNR·인증/Native신원과실제정식해제경로는미확정이다. 이전잠금0용재인증·기동전HOLD복구로우회하지않는다. 증거 db-readonly-approved-20261027T101538Z/RESULT.json, MVP_FINAL_COMPLETE=false.


## 2026-10-28 비회원 첫 빈 설정 START 회귀

- 브랜치 codex/mandatory-mvp-integration-20261025 / 기준90ad32be5d282f3b44c917a29e156dffc5e29187 / Codex독립소스수정, 기존팀배정변경없음.
- 실제 새 비회원sessions0행과설정version0관측. 소스경로초기버전0→snapshot최소1불일치재현. 새설정만버전1로생성하도록수정, 기존0자동마이그레이션/스냅샷검증완화없음.
- popup기존오류코드누락·첫요청ID유실·후속조회덮어쓰기를수정. 미확인자료소급귀속·자동해제없음. 소스3파일과테스트2개추가, review-regressions 초기버전전제갱신.
- Extension전체602 PASS. 실제설치미적용, 실제비회원START→END는BLOCKED. 전용Server·MySQL정상종료/Native연결종료증거보존, r7보존. 검토ZIP/전체SHA/실제상태는저장소상위outputs/focurve-mvp-integration-20261025/guest-start-fix-20261028/REPORT.md 참조.
- 다음선행조건: 비회원미확인START표식과기존0버전·비회원HOLD의정식처리계약. 해당조건검증과별도실행승인전실제재시도금지. MVP_FINAL_COMPLETE=false.

## 2026-10-28 빈 비회원 설정 Core 연결 확인
실제 LocalStore/GuestSites/SessionDB와 Guest A1Core를 연결한 독립 시험 PASS. 새 version1 빈 설정 → 같은 START 요청 ID → RUNNING → 모의 2분 유지 → ENDED/Journal RELEASED/Binding0/DNR0, Core 재생성 후 종료 데이터 내용 동일. Chrome API와 시계는 모의 환경이며 실제 Chrome PASS가 아님. 기존 설정 관련4건과 신규 연결1건 총5건 PASS, 기존 Extension602건 재사용. 제품3파일/검토ZIP 변경 없음. 기존 실패 설치의 version0/미확인 START/HOLD는 보존하며 그 복구는 새 독립 수용의 선행조건이 아니다. 실제 신규 설치·START/END는 새 승인 전 NOT_RUN. MVP_FINAL_COMPLETE=false.


## 2026-10-28 실행 엔진 분리 실험

- 브랜치: `codex/execution-engine-review-20261028` / 기준 HEAD `90ad32be5d282f3b44c917a29e156dffc5e29187` + SHA 기준 최신 소스 복사
- 상태: 실험 구현, 기존 제품 대체 금지. 담당: Codex(검토·독립 검증).
- 기준: TF-05/06/07, AC-SESSION-02-01~03 및 기존 원장/소유권/ACK 계약 유지.
- 공통 문서 이벤트 계층 1차 구현. 최종 회귀 656건: 655 PASS / 1 FAIL.
- SPA URL·sender URL 변경 통합 반례가 기존 Core/실험 모두 CLEANUP_REQUIRED→UNKNOWN. 실제 Chrome NOT_RUN.
- 상세: [선택적 재구축 검토](../실행엔진_선택적재구축_검토_20261028.md). 다음 작업은 동일 문서 경로 변경의 정식 권한 인계 설계·구현.
