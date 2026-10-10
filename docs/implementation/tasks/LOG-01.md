# LOG-01 · 기록 목록 조회

단계: 필수 MVP · 설계 담당 영역: Web·Server

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

- 화면: LOG-01
- 흐름: TF-09
- API: API-LOG-01, API-LOG-02
- 데이터: access_events, policy_snapshots
- 회원: 회원 Web·Extension
- 비회원: Extension 로컬
- 로컬: EXT 로컬 동일 검증/owner별 저장

원문: [화면](../../design/01_UX_기능설계/02_IA_화면명세.md) · [동작](../../design/01_UX_기능설계/03_동작규칙.md) · [API](../../design/02_시스템_테크설계/04_API_연동.md) · [데이터](../../design/02_시스템_테크설계/05_데이터_복구.md) · [검증 기준](../../design/04_검수_예시데이터/07_검증기준.md)

## 설계와 구현 대응

| 기준 ID | 기대 결과(기존 설계) | 코드 위치 | 검증 명령·환경 | 결과 |
|---|---|---|---|---|
| AC-LOG-01-01 | 선택 기간과 당시 정책의 기록 조회 | | | 미실행 |
| AC-LOG-01-02 | 0건과 조회 실패·미수집 구분 | | | 미실행 |
| AC-LOG-01-03 | 삭제된 사이트도 과거 대상·정책 표시 | | | 미실행 |

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


## 2026-10-10 결함 4건 로컬 수정·회귀 기록

- 담당: 김다훈 Web·Server·API·DB. 브랜치: fix/email-code-retry-after. 시작 기준: b45a680a9f2262bd9725619e9643df3bb9b91164.
- 상태: 관련 입력 경계 로컬 수정 검증, 작업카드 전체 완료 아님.
- 이번 근거: F4 확장 연도/잘못된 날짜422, 0001/1000/윤일/9999 정상 조회200 확인. 합성 Event1.1/1.2 데이터 있는 목록·상세·종료 후 보존 확인. 실제 Extension 수집 아님.
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
