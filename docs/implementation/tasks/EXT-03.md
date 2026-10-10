# EXT-03 · 이벤트 전송

단계: 필수 MVP · 설계 담당 영역: Extension·Server

## 작업 상태

- 상태: 진행 중 · 회원 접근 기록 전송 상태 UI 구현 / 실제 Chrome 연동 검증 대기
- 실제 담당자: Core 종민 · 기존 Server 담당 배정 유지
- 브랜치 / 시작 기준 커밋: `feature/extension-core-ext-02` / `b52681bd4088be3f64722c30d5072632b8e9515e`
- PR: https://github.com/kdu-sw-capstone/capstone-project/pull/17
- 선행 작업 / 차단 조건:

| 영역 | 담당 | 구현 상태 | 검증 상태 |
|---|---|---|---|
| Web | | 미확인 | 미실행 |
| Server | | 미확인 | 미실행 |
| Extension | Core 종민 | 회원 SITE 전송 상태 UI 부분 구현 | 자동 195/195 · 모의 UI 27/27 · 실제 연동 대기 |

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
| AC-EXT-03-01 | 현재 소유자·최신 revision의 명령만 실행 | | | 미실행 |
| AC-EXT-03-02 | 다른 설치 토큰·만료 APPLY 거절 | | | 미실행 |
| AC-EXT-03-03 | 재접속은 journal 대조 후 명령 실행 | | | 미실행 |

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

## 2026-10-10 · 이번 목표: 회원 접근 기록 전송 상태 표시

- Extension 0.1.10 팝업에서 현재 계정·설치·Server의 로컬 기록 전송 상태만 집계한다.
- 전송 대기 / 전송 중 / 응답 미확인 / 적용 확인 대기 / 인증 확인 필요 / 전송 거절 / 서버 수신 확인을 구분한다.
- 원문 임시 저장과 전송함의 동일 event_id는 중복 집계하지 않는다. 서로 다른 원문은 조회 오류로 처리한다.
- 재확인은 기존 전송기의 상태 조회·동일 ID 재시도·서버 대기 시간 규칙을 그대로 따른다. 거절 기록을 자동 재전송하거나 새 ID로 바꾸지 않는다.
- 계정 전환 중 조회 결과는 거절하며, 팝업의 이전 계정 표시도 지운다. 본문·URL·토큰·계정 ID를 UI 응답에 넣지 않는다.
- 구현 근거 및 검증: [EXT-03 evidence](../evidence/EXT-03-2026-10-10-delivery-status.md).
- 미완료: 실제 Chrome + Server 전송/오프라인/계정 전환 검증, FEATURE/Shorts 통합, 수집 완료 watermark. 전체 EXT-03 완료로 표시하지 않는다.
