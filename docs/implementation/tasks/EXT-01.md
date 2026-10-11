# EXT-01 · 정책 동기화

단계: 필수 MVP · 설계 담당 영역: Server·Extension

## 작업 상태

- 상태: 진행 중 · 회원 팝업 안내 부분 구현
- 실제 담당자: Core 종민 · 기존 Server 담당 배정 유지
- 브랜치 / 시작 기준 커밋: feature/extension-core-ext-02 / 4e4c44e81947021fe10063ab511904ecc4d84558
- PR: https://github.com/kdu-sw-capstone/capstone-project/pull/17
- 선행 작업 / 차단 조건:

| 영역 | 담당 | 구현 상태 | 검증 상태 |
|---|---|---|---|
| Web | | 미확인 | 미실행 |
| Server | | 미확인 | 미실행 |
| Extension | Core 종민 | 회원/비회원 팝업 안내 부분 구현 | 모의 UI 39/39 · 실제 새 Chrome 검증 대기 |

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
| AC-EXT-01-01 | 현재 소유자·최신 revision의 명령만 실행 | | | 미실행 |
| AC-EXT-01-02 | 다른 설치 토큰·만료 APPLY 거절 | | | 미실행 |
| AC-EXT-01-03 | 재접속은 journal 대조 후 명령 실행 | | | 미실행 |

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

## 2026-10-10 · 이번 작업: EXT-01 화면의 회원/비회원 안내

목표: 회원 연결 시 Web 시작·설정 안내를 표시하고, 보존 비회원 자료 및 실제 실행 확인을 명확히 구분한다. 기능 카드 EXT-01 정책 동기화 전체 완료가 아닌 EXT-01 화면 개선이다. 담당 Core 종민. 기준은 IA EXT-01의 회원 관리→Web 및 소유 구분이다. API/정책/Server 계약은 바꾸지 않는다.

작업 시작 개인 Core 진행률 추정 75~80%. 정식 수용 기준 완료율이나 전체 프로젝트 비율이 아니다. 남은 개인 큰 단위: 화면 정리(이번), 저장 장애 수집 중단·해제 경계, 최신 실제 검증. 팀원 Shorts/lifecycle/watermark 연결은 별도다.

### 이번 작업 결과

Extension 0.1.16: 회원 연결 시 Web 시작/설정 안내와 실제 실행 확인을 제공하며 비회원 시작 양식을 숨긴다. 보존 비회원 자료는 명시적으로 접근 가능하고 실제 비회원 실행 해제 UI는 유지한다. 안전한 Web origin만 링크한다. 모의 팝업 39/39·JS 구문 PASS. 실제 새 Chrome 검증은 미실행이다. [검증 기록](../evidence/EXT-01-2026-10-10-member-popup.md).

개인 Core 진행률 추정: 시작75~80% → 이번 완료 후80~85%. 현재 합의된 개인 구현/안정화 범위의 판단치이며 정식 AC 완료율·전체MVP·팀원 연결율이 아니다. 남은 큰 개인 단위는 저장 장애 수집 중단·해제 경계와 최신 실제 검증 2개이며, 결함 발견 시 늘어날 수 있다. Shorts/lifecycle/watermark 공동 작업은 별도다. 이후 작업 시작 시 이 기준·남은 일을 함께 알린다.
