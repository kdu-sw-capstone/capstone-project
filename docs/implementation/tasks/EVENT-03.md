# EVENT-03 · 내부 기능 접근 기록

단계: 필수 MVP · 설계 담당 영역: Extension·Server

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

- 화면: LOG-01
- 흐름: TF-08, TF-09
- API: API-EVENT-01, API-EVENT-02, API-LOG-01, API-LOG-02
- 데이터: event_receipts, access_events, session_lifecycle_events
- 회원: 회원 Web·Extension
- 비회원: Extension 로컬
- 로컬: EXT 로컬 동일 검증/owner별 저장

원문: [화면](../../design/01_UX_기능설계/02_IA_화면명세.md) · [동작](../../design/01_UX_기능설계/03_동작규칙.md) · [API](../../design/02_시스템_테크설계/04_API_연동.md) · [데이터](../../design/02_시스템_테크설계/05_데이터_복구.md) · [검증 기준](../../design/04_검수_예시데이터/07_검증기준.md)

## 설계와 구현 대응

| 기준 ID | 기대 결과(기존 설계) | 코드 위치 | 검증 명령·환경 | 결과 |
|---|---|---|---|---|
| AC-EVENT-03-01 | 전체3·반복2, 반복은 별도 합산하지 않음 | | | 미실행 |
| AC-EVENT-03-02 | 차단 안내·자동 렌더·다른 계정 이벤트 제외 | | | 미실행 |
| AC-EVENT-03-03 | 같은 ID 재전송 및 역순 도착 후 동일 집계 | | | 미실행 |

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

## 2026-10-10 Content Control 시작 기록

- 담당: 채지민 / Content Control. 사용자 기존 역할 확인 + 원본보관_개정전.zip의 FOCURVE_개발계획_v1.3.md §5 + 현행 D-06 근거. 다른 영역 담당 기록 유지.
- 브랜치: feature/content-control / 시작: 90ad32be5d282f3b44c917a29e156dffc5e29187 (fetch로 확인한 origin/develop).
- 포함: 페이지 내부 감지·제어·해제·실패 관찰의 독립 모듈. 제외: Core 세션/저장/전송/DNR, Web/Server/DB.
- 상태: 진행 중(독립 구현). 실제 Core 연결: 차단(D-06 세부 메시지·navigation 식별/이벤트 확정 시점 미합의).
- 기존 구현: develop extension은 README만 존재. Core는 별도 PR17/9b063be에 있으며 임의 merge/대체하지 않음. Server 검증 기록은 Content 검증으로 전용하지 않음.
- 적용: 이 카드의 AC 원문 및 관련 BOUND. 자동 DOM fixture 검증과 실제 Windows/서비스 연동을 구분.
- 다음: 독립 구현·검증 후 결과/파일/미완료 갱신. D-06 연결안은 제안 문서로 작성(사용자 응답).

## 2026-10-10 Content Control 검증·재개 기록

- 코드: extension/content/entry.mjs (진입 후보만; 실제 이벤트 생성/전달 미연결). 테스트: extension/content-tests/*.test.mjs.
- 실행 주체·환경: Codex / Windows / Node24.19.0 / 설치 Chrome154.0.8037.98(headless), Playwright 합성 DOM/정책. 이미지 분류는 모의. 사용자 실행은 OPTION-09 합성 도구에 한정(아래 최신 기록 참조).
- 최종 자동 검증: 29/29 PASS, 실패/skip0. 독립 감지·제어·복원 부분만 검증. EVENT 집계·전송, 실제 서비스/Extension/Core/Server/학습 모델·브라우저 재시작은 미검증.
- AC·BOUND 대응/명령/초기 실패 및 수정: [상세 기록](../Content_Control_2026-10-10.md)의 기능별 표·코드 대응·실행 결과 참조. 이 카드의 기존 AC 표는 전체 기준이므로 미실행 상태를 전체 PASS로 올리지 않음.
- 남은 기능·의존: D-06 메시지/공통 탐색/이벤트 확정 시점, Core manifest·고정 정책 주입·소유검증·결과/전송 연결. OPTION-10 목록·OPTION-11 실제 고정 모델 자원 필요. Instagram 추천/모달 DOM 실증 필요.
- 다음 행동: [연결 제안](../Content_Core_D06_연결제안.md) 팀 검토, [Windows 절차](../Content_Control_Windows_검증.md) 실행 결과 반영. 실제 통합·팀 리뷰·develop 병합은 미완료.
- 완료 판정: Content 독립 부분 구현만 검토 가능. 기능 전체 검증완료 아님. Git/PR 최종 상태는 상세 기록의 게시 기록 참조.

- 이전 게시 시도의 Git 상태: Commit/Push 실행이 권한 요청에서 거부돼 프로세스 미시작. HEAD90ad32b·staged0, 변경은 로컬 보존. PR 생성/리뷰/통합 미수행. 상세 게시 보류·재개 기록 참조.
