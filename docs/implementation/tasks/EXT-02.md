# EXT-02 · 접근 제한 적용

단계: 필수 MVP · 설계 담당 영역: Extension

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

- 화면: EXT-01
- 흐름: TF-05, TF-08, TF-13
- API: API-EXT-01, API-EXT-02, API-EXT-03, API-EXT-04, API-EXT-05, API-EXT-06, API-EXT-07, API-EXEC-01, API-EXEC-02, API-EXEC-03, API-EVENT-01, API-EVENT-02
- 데이터: extension_installations, execution_commands, execution_reports
- 회원: 회원 Web·Extension
- 비회원: Extension 로컬
- 로컬: EXT 로컬 동일 검증/owner별 저장

원문: [화면](../../design/01_UX_기능설계/02_IA_화면명세.md) · [동작](../../design/01_UX_기능설계/03_동작규칙.md) · [API](../../design/02_시스템_테크설계/04_API_연동.md) · [데이터](../../design/02_시스템_테크설계/05_데이터_복구.md) · [검증 기준](../../design/04_검수_예시데이터/07_검증기준.md)

## 설계와 구현 대응

| 기준 ID | 기대 결과(기존 설계) | 코드 위치 | 검증 명령·환경 | 결과 |
|---|---|---|---|---|
| AC-EXT-02-01 | 현재 소유자·최신 revision의 명령만 실행 | | | 미실행 |
| AC-EXT-02-02 | 다른 설치 토큰·만료 APPLY 거절 | | | 미실행 |
| AC-EXT-02-03 | 재접속은 journal 대조 후 명령 실행 | | | 미실행 |

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

## 2026-10-28 비회원 YouTube 문서 준비 연결 수정
Codex / codex/mandatory-mvp-integration-20261025 / 기준 90ad32be5d282f3b44c917a29e156dffc5e29187. 신규 독립 설치31b26의 비회원 빈 설정2분은 실제 ENDED/버전1/의무0 PASS. 정책 세션96058은 REVALIDATION_REQUIRED 후 UNKNOWN: 전이시작10:20:00.321KST, 최초미확정10:20:05.348KST(5027ms). 당시 최초 census 사유와 대기 구간은 원장에 없어 미확정이며 LOADING으로 소급 확정하지 않음.
회원에 존재하는 Root webNavigation DOMContentLoaded 기반의 정확한 boot/tab/document/url 준비 확인이 비회원에 누락됨을 소스 확인. 실제 비회원 census 독립 재현 전 11PASS/1FAIL(LOADING), 후12PASS. 동일 준비 처리와 Root COMPLETE 재확인 신호만 a1/core.mjs/entry.mjs에 연결하고 a1-core.bundle.js 재생성. 5초 기한·P1/ACK·소유권·pending URL 거절 유지. 전체 Extension615PASS. 실제 설치 적용/재로드/END/Cleanup/추가START 없음. 기존 Server/MySQL은 승인된 owner-only 정상종료, DB세션/잠금0·로컬UNKNOWN분리보존. 현재 ZIP2bcfd4는 실제 설치 원본이며 이번 소스 수정은 아직 새 ZIP에 포함되지 않음. 증거 actual-current-guest-v1-20261028/GUEST-NATIVE-FAILURE-ANALYSIS.json. 실제 재검증/정식 의무해소는 별도 승인·현재 안전조건 필요. MVP_FINAL_COMPLETE=false.

### 2026-10-28 last_seen_at 확정 관측 분석
사용자 실제 IndexedDB 관측 재사용: started/last_seen=1793150400321, deadline=1793150405321, first_failure=1793150405348. 5초 fence와 실패기록27ms 후는 확정이나 실제 작업지연27ms를 의미하지 않음. nrStage(FRESH_ATTEST/FRESH_APPLY)는 같은 원자 저장 안에서 last_seen_at=this.now()를 항상 기입하고, nrReplan/최종CONFIRMED도 갱신. 입력조회/census/P1전환/cleanup/큐대기에는 연속 heartbeat가 없으므로 현재 필드는 총 진행 이력이 아님. 같은 ms에 단계2개가 진행돼도 시작시각과 같은 사례, 첫 저장 전 지연, 늦은 저장 거절, 저장미확정을 독립4건 재현 PASS. 관련21PASS/0FAIL, 제품소스변경없어 전체615 이전결과재사용. FAILED 전이가 이전단계 phase를 덮어써 원장만으로 역사적 대기구간은 확정불가. 시각갱신누락 결함/LOADING 사건원인 확정없음, 추가제품수정 없음. 앞선 Root DOMContentLoaded 누락 수정은 독립검증된 후보이며 실제 사건원인확정과 구분. 실제설치변경·조회반복·기동·END/Cleanup·기한완화·UNKNOWN해제 없음. evidence CHECKPOINT-TIMESTAMP-ANALYSIS.json. MVP_FINAL_COMPLETE=false.

### 2026-10-28 REVALIDATION原장 조사 종료·정책 수용 후보 확정
사용자 지시에 따라 동일 원장 재분석 종료. 검증된 Root DOMContentLoaded 문서 준비 처리와 COMPLETE 재확인만 비회원에 연결. 재발시 기존 Worker 콘솔에 bounded FOCURVE_GUEST_NATIVE_TRACE를 추가: 동일 시작요청/세션/전이ID, BEGIN_COMMITTED/CHECK_ENTER/CENSUS_WAIT/FRESH_ATTEST 및 FRESH_APPLY 진입/저장/LOCAL_CONFIRMED/FAILURE의 시각·허용코드만 출력. 추가 DB조회·저장소·기한·성공권한 없음, 개인정보/URL/오류원문 제외, 반복로그 bounded/dedup, console실패 원래실행결과에 영향없음. 관련 테스트 포함 전체Extension622PASS. 제품변경3경로(core/entry/generated bundle), Web/Server/Native/Installer는 이전후보와 동일. 새 검토ZIP SHA50a76e671b58ff3d4d14d98975b24c84cbc8c49606fcc7ef11dbfc2d90b581ef: Manifest4409/ZIP4410/source957/buildInputs144 검증PASS, known secret-pattern204text+server config4검사PASS. 후보증거 guest-native-ready-20261028. 새 실제설치/Chrome/START/END 미실행. 기존31b26 UNKNOWN 및 모든실패환경보존, 새포트30187/30188 현재수신/설치충돌없음. 다음은 별도 신규독립1개·정책세션1회·정상종료/재기동 내용보존 승인 필요; 이미PASS인빈2분 반복안함. Git게시/병합/index변경없음, 최종릴리스미확정, MVP_FINAL_COMPLETE=false.

### 2026-10-28 最新 후보 실제 로그: 적용증거 실패로 원인 분리
승인ZIP50a76e...의 별도설치fcd0c050c8dd4ae68e801a522a564334, 포트30187/30188. 요청c190fd74-ac84-4539-9ce4-ca9e1f55b018/세션4b71d352-f56b-4151-b8ba-fdf98a4ed4e4 실제콘솔24행 수신. 재검증b3c292는LOADING/PENDING_URL이후3755ms에LOCAL_CONFIRMED, 32b4d6은1236ms에LOCAL_CONFIRMED. 세번째8c37d9는시작1793152318272/기한1793152323272/FRESH_APPLY저장1793152318860/실패1793152319091 INVALID_EFFECT_EVIDENCE. 이번실패는819ms후로기한4181ms남아있어5초초과와구분. Content반환result_state와effect/coverage evidence 미확보여서정확한거절분기미확정. 추측추가수정없음. 사용자UI STATE미확정요청6f170f30은원START요청과소급동일시하지않음. 전용Server/MySQL01:54:49UTC정상종료·포트해제·DB세션/잠금/Receipt0·로컬UNKNOWN별도보존. END/Cleanup/재시도없음. 최초2분PASS는기존설치증거재사용, 이번정책END/복원/재기동NOT_RUN. ACTUAL-NATIVE-TRACE.json/TRACE-FAILURE-CLASSIFICATION.json참조. MVP_FINAL_COMPLETE=false.

### 2026-10-28 승인된 APPLY 자동 추출·원복 완료
Chrome metadata 도구는 Default DevToolsActivePort 부재로 연결 불가를 확인했으며 별도프로필/CDP/도구정책 우회 없음. 기존 guest-reader 읽기전용 2중 snapshot 및 신원 검증을 재사용하는 임시2파일(guest-reader/ui) 후보14건PASS. 사용자10분 승인 후 설치fcd0 및 실제Chrome12860 현재identity/프로필/원본·후보·백업fullSHA 대조,11:22:52.994KST적용/11:32:52기한. 안전조회화면 새로고침1/자동추출버튼1로 대상4b71d352 APPLY3건 자동추출성공,20ms/신원4true/doubleReadStable/자원0, gateUNKNOWN유지. 최신759f4731-7562-4597-b430-96c6bfe95a82 COMPLETED/statusOK/resultFAILED,SHORTS viewer/hidden/inert/media/paused각1,error_count1,observer/scantrue. 이전APPLY2건 GENERAL/NOT_APPLICABLE/error0. statusOK는처리응답이지효과성공이아니며Core INVALID_EFFECT_EVIDENCE 거절은실제FAILED와정합. A0 effect.errors 정상증가 분기는ShortsControl.apply FAILED+viewer/media존재. 정확한style/media/notice 검사항목은응답에없어미확정;5초시간초과로환원하지않음. 실제 evidence를confirmedEffect에대입해false, error0가정때만true 독립확인(실제값변경없음). 실제쓰기/START/END/Cleanup/재시도0. 결과수신즉시11:24:17.581KST 정확한원본2파일복원, 원본SHA783212.../10d59f...일치. installation/secrets/context/release-config 보호SHA동일. UNKNOWN·원장보존, 추가수동객체조회요청중단. 증거 actual-policy-ready-20261028/apply-audit-candidate/ACTUAL-EXTRACTION.json,FINAL-RESULT.json,RESTORE-SHA-VERIFICATION.json. 실제제품코드추가적용없음. MVP_FINAL_COMPLETE=false.

### 2026-10-28 Shorts APPLY viewport 판정 최소 수정 후보
실제 최신APPLY FAILED/error_count1과가림/inert/paused각1확인. error 증가 모든경로분리: evidence읽기예외는scanfalse, scan예외는stopEpoch/observerfalse, 정상controlFAILED 분기와pending scan rejection은현재증거와양립. 과거문서의정확한DOM검사값/stack미보존으로특정실제검사항목은소급확정하지않음. 독립적으로확정한결함은 content/shorts.mjs 안내창rect와innerWidth/Height(스크롤바포함)의비교. CSSOM root client viewport(스크롤바제외)크기로정정, BackCompat은body측정. 실제전체가림에도폭15px차이로실패/error1인동일Fixture 전APPLY_FAILED/후APPLIED/error0재현. 크기0·가림부족·opacity0·pointer차단·재생정지실패는여전히실패/error1, source 에러무시/리셋/기한완화없음. 첫DOM판정위치를특정할고정failure code/측정숫자만기존Content console에추가, wire effect_evidence/ACK/snapshot schema불변.
제품소스 content/shorts.mjs,a0/shorts-effect.mjs 2개와 guest/member content.bundle.js2개갱신. 기존fixture geometry를nativeclient크기로보완하고신규viewport/search/SPA/노드제거/복원/실패/실제Content-Core ACK-END 독립회귀 추가. 원래9개시험 전6PASS3FAIL/후9PASS0FAIL, 관련13PASS, 전체Extension634PASS. Core/Worker/5초재검증/소유권/멱등schema 이전50a후보동일. 새검토ZIP ae1d95ddebf2d2f66289dec3c2ee6bc00d132dcb9e1052dc18edfed340951841, Manifest4409/ZIP4410/source957/buildInputs144 검증PASS, 비밀known-pattern204text/serverconfig4 PASS. 실제Chrome/설치/START/END/복구없음. 기존UNKNOWN보존. 실제재검증·정책END·내용보존여전히필요, Git게시없음. 증거 shorts-viewport-fix-20261028/FINAL-RESULT.json 및 SAME-FIXTURE.json/전체로그/SOURCE-CHANGES/PACKAGE-DELTA참조. MVP_FINAL_COMPLETE=false.


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


## 2026-10-28 재검증 최초 실패 단계 독립 검증

- 실제 최신 세션 af7def49…08eb의 최초 로컬 단계는 미확정. 서버 REVALIDATING 보고 phase는 VERIFYING으로 정규화되므로 원래 로컬 단계를 의미하지 않음. 기존 설치·UNKNOWN·잠금·원장 보존.
- 기존 member fixture/Core/Content/adapter로 8조건(정상·READY 대기·SPA·응답 유실·전이 중 Worker 재생성·보고 지연·서버 확인 지연·기한 만료) 관측. 각 request/session/operation 및 단계 시각은 독립 증거에만 저장. DNR 3조건 선행 재현은 재사용.
- 재현된 진단 결함만 수정: 진행 중 Content 응답 유실이 START_APPLY로 오표시되던 문제. core.mjs의 Content/보고 wait 경계와 시각을 진단에 추가하고 모르는 단계는 UNCLASSIFIED_STAGE. 원래 오류/cause·5초·소유권·sender·세대·ACK·실행 결과 유지. 회원 Core 번들 재생성.
- 신규 진단 4건 및 전체 Extension 708/708 PASS. 전후 8조건 결과 동일. 기존 Web/Server/Native 계약 증거 재사용, 실제 Chrome/Windows Native/DB 수용 미실행. 지속 저장 진단 스키마·새 설치·기존 설치 변경·START/END/Cleanup/복구·Git 작업 없음.
- 증거: 작업 루트 outputs/focurve-ready-final-candidate-20261028/revalidation-stage-analysis-20261028/. 최초 실제 원인과 UNKNOWN 반복 차단은 미완료이며 MVP_FINAL_COMPLETE=false.


## 2026-10-28 최초 실패 영속 보존 — 종료 조건 확정

- 기존 세션 DB metadata에 member:first-failure:<session_id> 관측 1행만 추가. 기존 atomic 저장·safety 이중 readonly 조회·조회 버튼 재사용. 새 DB/진단 화면/Worker 메시지/인증 갱신 없음.
- 회원·설치·세션·START 요청·세대 결속과 현재 tuple/fence 확인 후 최초 기록만 add. 후속 오류·Worker 부트·동시 쓰기로 교체하지 않음. 기존 UNKNOWN에 행이 없으면 ABSENT 유지하며 소급 생성 금지. 저장 실패가 원래 UNKNOWN 처리를 막지 않음.
- 독립 fixture에서 새 Core/Worker boot 인스턴스 생성·메모리 진단 소멸 뒤 기존 readonly 조회기로 최초 code/stage/request_id 자동 재추출 확인. 실제 Chrome Service Worker 종료/재기동 시험과 구분.
- 소유권·요청 불일치/비밀 필드 거절/저장 실패/동시 최초 쓰기/다음 세션 분리·원본 보존, UI HOLD→CLEAR 거절 포함. 전체 Extension 717/717 PASS. 기존 5초·sender·세대·ACK·복원 계약 유지.
- 종료 조건 충족: 진단 기능 개발 종료. 추가 관측 확장 없이 단일 검토 후보의 Manifest/ZIP 정합성 확인 후 별도 승인된 실제 Chrome 수용으로 이동. 과거 사건 최초 단계·Shorts 전체 경로·실제 END/재기동·MVP 최종 완료는 여전히 미확정/미완료.
- 기존 설치/Chrome/DB/UNKNOWN/HOLD/실패 증거/Credential/Git index 변경 없음. 증거: 작업 루트 outputs/focurve-durable-first-failure-20261028/.


## 2026-10-28 고정 후보 실제 수용 — UNKNOWN 중단

- a57195a3…031ac73로 신규 설치63739697…9b24(30195/30196). 핵심9파일 SHA 일치·최초DB0·회원 연결/정책3건/로컬CLEAR 확인. 사용자의 선행 짧은 회원1회 ENDED·추가승인 회원정책1회 RUNNING/APPLIED22 후 STORE_UNCONFIRMED/UNKNOWN. 재시도 없음.
- 실제 안전 조회의 firstFailure=ABSENT: 진단 보존 실제 수용 FAIL. 자동 조회 자체는 readonly·신원일치이나 최초 로컬 단계는 미확정. Worker 재생성/비회원/END·복원·재기동은 NOT_RUN. 직접 Shorts URL 차단 관측만으로 전체 PASS 판정하지 않음.
- 실제/원장 DNR2건 일치, Binding/Journal/잠금 각1·미ACK0 보존. Server/MySQL 정상 종료·포트 해제, 서비스 정지 전후DB해시 유지. 제어탭닫음후 PRODUCT_CHANNEL_CLOSED/HOLD는 후속 기록.
- 독립 fixture에서 Core.invalidate→UNKNOWN→markUnknown 경로가 최초 진단 저장을 우회하여 ABSENT를 유지함을 재현. 이번 사건의 호출 경로 확정은 아니며 실제 설치/제품 추가 수정 없음. 진단 기능 확장 없이 기존 UNKNOWN 전이와 최초 저장의 누락 경계를 다음 최소 검토 대상으로 기록.
- 근거: 작업 루트 outputs/focurve-durable-first-failure-20261028/actual-acceptance-20261028/. MVP_FINAL_COMPLETE=false.


## 2026-10-29 Shorts·SPA 독립 연속 개발 — 실제 실패 설치 보존

- 담당 Codex, 브랜치 codex/execution-engine-review-20261028, 기준90ad32be5d282f3b44c917a29e156dffc5e29187. 기존 변경·실제 설치63739697…9b24·UNKNOWN/DNR/Binding/Journal/잠금 보존. 과거 최초 로컬 원인은 미확정.
- 독립 재현된 Core/Registry invalidate 최초 진단 누락, P1 proof commit 뒤 응답 유실 시 재진입, Content/P1 잔여 NR 시간 초과 대기, 안내창 크기만 맞고 위치가 벗어난 false-positive를 최소 수정. 기존5초·소유권·sender·세대·ACK·원본 proof/복원 의무 유지. 실제 설치 적용/START/END/Cleanup/복구 없음.
- 8영역 영향 회귀 및 DOM-before-HISTORY/역순3회·END 복원, 회원/비회원 fresh challenge·기한 검증. 최종 Extension747/747, 구문/번들 PASS. 모의 시계 정합화 전 실패 로그도 보존. 실제 Chrome PASS와 구분.
- 변경 소스7/생성번들4 및 테스트8 SHA는 작업루트 outputs/focurve-shorts-spa-continuation-20261029/CHANGES-SHA256.json. Web/Server/Native 미변경·기존 회귀 재사용. Manifest4412/ZIP4413/source960/build144 일치. 새 검토ZIP SHA5bcdced239ead3fa458106c2683054cbd4a6e0d248aa04f538c8229112a6b662. 설치 CLI 취소 확인만 수행.
- 실제 STORE_UNCONFIRMED 경계, Shorts 전체 실제 경로·회원/비회원 END·Native 재연결·제품 재기동/보존은 BLOCKED/NOT_RUN. 추가 진단 확대·추측 패치 없이 검토 후보 확정. 다음 실제 수용은 새 유효 승인 필요. MVP_FINAL_COMPLETE=false. 상세 RESULT-REPORT.txt 참조.
