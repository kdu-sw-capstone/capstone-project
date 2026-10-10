# POLICY-03 · 유튜브 쇼츠 차단

단계: 필수 MVP · 설계 담당 영역: Web·Server·Extension

## 작업 상태

- 상태: 진행 중 (Content 독립 구현 검토 대기; 실제 연결·검증 미완료)
- 실제 담당자: 채지민 — Content Control 부분 (Web/Server/Core 기존 담당·이력 유지)
- 브랜치 / 시작 기준 커밋: feature/content-control / 90ad32be5d282f3b44c917a29e156dffc5e29187
- PR: 이번 중간 공유 요청은 기능 브랜치 Commit·Push까지; PR 생성·develop 병합 미수행
- 선행 작업 / 차단 조건:

| 영역 | 담당 | 구현 상태 | 검증 상태 |
|---|---|---|---|
| Web | | 미확인 | 미실행 |
| Server | | 미확인 | 미실행 |
| Extension | 채지민(Content Control 부분) / Core 별도 | 독립 부분 구현, 제품 연결 미완료 | 합성 부분 검증, 실제 미검증 |

해당하지 않는 영역은 관련 명세 근거와 함께 해당없음으로 표시한다.

## 설계 참조

- 화면: SITE-02
- 흐름: TF-04, TF-08, TF-A01
- API: API-SITE-04, API-SESSION-05, API-EXEC-01, API-EXEC-02
- 데이터: site_feature_policies, policy_snapshots, access_events
- 회원: 회원 Web·Extension
- 비회원: Extension 로컬
- 로컬: EXT 로컬 동일 검증/owner별 저장

원문: [화면](../../design/01_UX_기능설계/02_IA_화면명세.md) · [동작](../../design/01_UX_기능설계/03_동작규칙.md) · [API](../../design/02_시스템_테크설계/04_API_연동.md) · [데이터](../../design/02_시스템_테크설계/05_데이터_복구.md) · [검증 기준](../../design/04_검수_예시데이터/07_검증기준.md)

## 설계와 구현 대응

| 기준 ID | 기대 결과(기존 설계) | 코드 위치 | 검증 명령·환경 | 결과 |
|---|---|---|---|---|
| AC-POLICY-03-01 | 대상 기능만 제한하고 전체 차단 우선 | | | 미실행 |
| AC-POLICY-03-02 | 실제 제한 실패는 성공 접근 통계 제외 | | | 미실행 |
| AC-POLICY-03-03 | 정지·종료 시 변경분 복원, 중복 관찰은 한 접근 | | | 미실행 |

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


## 2026-10-10 결함 4건 로컬 수정·회귀 기록

- 담당: 김다훈 Web·Server·API·DB. 브랜치: fix/email-code-retry-after. 시작 기준: b45a680a9f2262bd9725619e9643df3bb9b91164.
- 상태: 관련 입력 경계 로컬 수정 검증, 작업카드 전체 완료 아님.
- 이번 근거: F3 JSON boolean true/false를 구분 저장하고 enabled 누락/null/잘못된 타입 거절. 실제 Content 감지·Shorts 차단/복원은 NOT RUN; 정책 저장 검증만으로 수용 기준 전체 통과 처리하지 않음.
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

## 2026-10-10 Content Control 시작 기록

- 담당: 채지민 / Content Control. 사용자 기존 역할 확인 + 원본보관_개정전.zip의 FOCURVE_개발계획_v1.3.md §5 + 현행 D-06 근거. 다른 영역 담당 기록 유지.
- 브랜치: feature/content-control / 시작: 90ad32be5d282f3b44c917a29e156dffc5e29187 (fetch로 확인한 origin/develop).
- 포함: 페이지 내부 감지·제어·해제·실패 관찰의 독립 모듈. 제외: Core 세션/저장/전송/DNR, Web/Server/DB.
- 상태: 진행 중(독립 구현). 실제 Core 연결: 차단(D-06 세부 메시지·navigation 식별/이벤트 확정 시점 미합의).
- 기존 구현: develop extension은 README만 존재. Core는 별도 PR17/9b063be에 있으며 임의 merge/대체하지 않음. Server 검증 기록은 Content 검증으로 전용하지 않음.
- 적용: 이 카드의 AC 원문 및 관련 BOUND. 자동 DOM fixture 검증과 실제 Windows/서비스 연동을 구분.
- 다음: 독립 구현·검증 후 결과/파일/미완료 갱신. D-06 연결안은 제안 문서로 작성(사용자 응답).

## 2026-10-10 Content Control 검증·재개 기록

- 코드: extension/content/features.mjs / entry.mjs / changes.mjs / controller.mjs. 테스트: extension/content-tests/*.test.mjs.
- 실행 주체·환경: Codex / Windows / Node24.19.0 / 설치 Chrome154.0.8037.98(headless), Playwright 합성 DOM/정책. 이미지 분류는 모의. 사용자 실행은 OPTION-09 합성 도구에 한정(아래 최신 기록 참조).
- 최종 자동 검증: 29/29 PASS, 실패/skip0. 독립 감지·제어·복원 부분만 검증. EVENT 집계·전송, 실제 서비스/Extension/Core/Server/학습 모델·브라우저 재시작은 미검증.
- AC·BOUND 대응/명령/초기 실패 및 수정: [상세 기록](../Content_Control_2026-10-10.md)의 기능별 표·코드 대응·실행 결과 참조. 이 카드의 기존 AC 표는 전체 기준이므로 미실행 상태를 전체 PASS로 올리지 않음.
- 남은 기능·의존: D-06 메시지/공통 탐색/이벤트 확정 시점, Core manifest·고정 정책 주입·소유검증·결과/전송 연결. OPTION-10 목록·OPTION-11 실제 고정 모델 자원 필요. Instagram 추천/모달 DOM 실증 필요.
- 다음 행동: [연결 제안](../Content_Core_D06_연결제안.md) 팀 검토, [Windows 절차](../Content_Control_Windows_검증.md) 실행 결과 반영. 실제 통합·팀 리뷰·develop 병합은 미완료.
- 완료 판정: Content 독립 부분 구현만 검토 가능. 기능 전체 검증완료 아님. Git/PR 최종 상태는 상세 기록의 게시 기록 참조.

- 이전 게시 시도의 Git 상태: Commit/Push 실행이 권한 요청에서 거부돼 프로세스 미시작. HEAD90ad32b·staged0, 변경은 로컬 보존. PR 생성/리뷰/통합 미수행. 상세 게시 보류·재개 기록 참조.

### 2026-10-10 중간 게시 완료

구현3d7bff718e756cedb0950858885edbb6f472ea68를 feature/content-control로 Push하고 원격SHA 일치를 확인했다. 이전 게시/작성자 차단 해소(사용자 지정 local Git 작성자 적용). PR/리뷰/develop병합 미수행. 자동29/29 PASS·사용자 OPTION-09 부분 확인은 상세 기록과 동일하며 실제 서비스/Core/Server·목록/모델·복구 미검증 유지. 오늘은 중간 공유로 종료, 다음은 D-06 연결 제안 팀 검토→세부계약 합의→Core 연결/실제 Chrome 검증. 최신 게시/재개 원본은 Content_Control_2026-10-10.md 참조.

## 2026-10-10 필수 Shorts 재개 시작

- 담당 채지민(Content Control), feature/content-control, 시작 HEAD0febe9838ebccdf269f5d3ad8e5b81363bc7f820. fetch 확인 origin/develop90ad32b·Core9b063be, 작업본 clean. 기존 추가MVP 코드/타담당 구현 보존.
- 이번 범위: Shorts 직접/SPA/새DOM/재생 재시도/새로고침·뒤로가기·해제 보강 및 시험전용 MV3 주입 도구. 제품 Core 메시지·규칙ID·Event1.2 발급/저장/세션 관리는 제외. AC-POLICY-03-01~03·BOUND-19 부분 검증.
- 기준: AGENTS/개발운영/통합현황/작업카드, 화면 SITE-02/FEATURE-01·TF-08/TF-A01, 동작규칙 제한/복원, D-06·API 로컬메시지·호스트정책우선순위60행. Core 선택 사이트만 사용, 상위정책 혼합 금지·설정 다음세션.
- Core 현 manifest에는 content_scripts 없음, worker에는 OBSERVE_ACCESS/FEATURE_RESULT receiver 없음. D-06은 메시지필드·DNR ID/priority·이벤트확정 미합의를 명시. 이 부분은 조율 대기, 고정 성공 응답/임의 계약 추가 금지.
- 사용자 최신 지시: 추가MVP 신규 작업 없이 필수 Shorts 우선. 명시 병합 요청 전 develop 병합/자동병합 금지. 기능브랜치 구현·검증·Commit/Push·Draft PR 범위만 진행.

### Shorts 보강 결과 · 독립 검토 대기

ShortsControl adapter와 시험 전용 MV3 도구 추가. 기존 구현 보존. Windows Chrome 엔진 합성/모의 자동33/33 PASS(21054.1217ms), 직접/SPA/뒤로·앞으로/동적 viewer/재생 재시도/해제 및 기존 기능 회귀 포함. 실제 서비스/MV3 로드/새로고침 자동 정책 재적용/Core·Event1.2·Snapshot·회원/비회원 통합은 미검증. D-06 schema·규칙 ID·navigation_id·이벤트 freeze 미합의이므로 제품 연결 보류. 명령·코드·AC 범위·Chrome 수동 절차는 ../Content_Shorts_2026-10-10.md 참조. 다음은 실제 Chrome 절차 기록과 윤종민의 연결안 검토. Draft PR 대상으로 공유하며 develop 병합/자동병합은 사용자 명시 요청 전 금지.
