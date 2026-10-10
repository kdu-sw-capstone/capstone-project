# AUTH-01 · 회원가입

## 2026-10-10 이메일 인증 제한 안내 로컬 수정

담당 김다훈(Web·Server), 별도 브랜치 `fix/email-code-retry-after`, 시작 기준 develop `b45a680a9f2262bd9725619e9643df3bb9b91164`. 범위: 고정 Retry-After60과 실제 시간당 한도의 불일치 수정. 기존 한도·시도 소비·쿠키·CSRF·인증번호/증명 일회용·SMTP 롤백 유지. 원본 develop·기존 실행본은 변경하지 않음.

Server는 IP·이메일 bucket 해제 시각의 최댓값을 오류 Retry-After와 발송 성공 resend_after_seconds에 반영. Web은 최초 발송 거절과 재발송 대기를 분·초로 표시하고 번호 확인 제한과 분리. 기준: API 명세의 가입 인증번호 및 2026-10-10 제한 안내 항목. 코드: AuthRateLimits.checkAll/retryAt/secondsUntil, ApiFailure/ApiErrors, EmailSignupCodes.request, EmailSignup.run/sendCode.

최종 제품 코드 자동 검증: Backend146/146·verify/package, Frontend121/121·build PASS. 실제HTTP·격리MySQL·Mailpit28/28 PASS(복합제한·만료직전2초·실제만료뒤재요청 포함). 내장브라우저5176에서 최초 제한 안내/번호 입력 미표시, 정상 발송/입력창, 새로고침 복원, 이탈 후 요청 전 재진입을 직접 확인. 외부SMTP/실제Chrome/OAuth는 이번에 미검증. 자세한 근거는 로컬 `C:\Users\dahun\capstone-project\.reviews\email-auth-20261010\FOCURVE_이메일인증_제한안내_수정검증보고서.md` 참조. 보고서는 수정 clone 밖 로컬 검토 산출물이며 게시하지 않음.

상태: 로컬 수정 검토 대기. 독립 재리뷰 전 Commit·Push·PR 생성 안 함. AC-AUTH-01-01~03 전체 완료 승격 안 함. 기존 계정 실패 원인/입력창 누락은 재현되지 않은 미확정으로 유지. 기존 사용자 직접 확인은 자동/직접 브라우저 검증과 구분.

단계: 필수 MVP · 설계 담당 영역: Web·Server

## 작업 상태

- 상태: 검토 대기 (이번 제한 안내 수정 범위; AUTH-01 전체 미완료)
- 실제 담당자: 김다훈 (이번 Web·Server 수정 범위, 기존 담당 배정 유지)
- 브랜치 / 시작 기준 커밋: fix/email-code-retry-after / b45a680a9f2262bd9725619e9643df3bb9b91164
- PR: 이번 변경 미게시
- 선행 작업 / 차단 조건: 독립 재리뷰; 전체 수용 기준의 미검증은 유지

| 영역 | 담당 | 구현 상태 | 검증 상태 |
|---|---|---|---|
| Web | | 미확인 | 미실행 |
| Server | | 미확인 | 미실행 |
| Extension | | 미확인 | 미실행 |

해당하지 않는 영역은 관련 명세 근거와 함께 해당없음으로 표시한다.

## 설계 참조

- 화면: SIGNUP-01
- 흐름: TF-12
- API: API-AUTH-01, API-AUTH-02, API-AUTH-03, API-AUTH-04, API-AUTH-06, API-AUTH-07, API-AUTH-08, API-AUTH-09, API-AUTH-10, API-AUTH-11, API-AUTH-12, API-AUTH-13, API-AUTH-14
- 데이터: users, auth_identities, auth_challenges, web_sessions
- 회원: 회원 Web·Extension
- 비회원: 가입·로그인 진입만
- 로컬: 가입·로그인 진입만

원문: [화면](../../design/01_UX_기능설계/02_IA_화면명세.md) · [동작](../../design/01_UX_기능설계/03_동작규칙.md) · [API](../../design/02_시스템_테크설계/04_API_연동.md) · [데이터](../../design/02_시스템_테크설계/05_데이터_복구.md) · [검증 기준](../../design/04_검수_예시데이터/07_검증기준.md)

## 설계와 구현 대응

| 기준 ID | 기대 결과(기존 설계) | 코드 위치 | 검증 명령·환경 | 결과 |
|---|---|---|---|---|
| AC-AUTH-01-01 | 인증 성공 후 동일 계정으로 진입하고 최초 소셜은 가입 확인 후 생성 | | | 미실행 |
| AC-AUTH-01-02 | 인증 실패·취소·state 불일치 때 회원/세션 생성 안 함 | | | 미실행 |
| AC-AUTH-01-03 | 중복 callback·인증 요청 재처리로 계정 중복 생성 안 함 | | | 미실행 |

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
- 이번 근거: F1 기존 발송 제한 수정본 재사용. 실제 Mailpit·HTTP에서 시간당/단기/이메일/IP 동시 제한, 경계 전후 재요청, 신규·기존·가입 미완료 계정 및 발송 장애 롤백을 확인. 외부 OAuth 및 실제 Gmail 표시 검증을 자동 검증으로 승격하지 않음.
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
