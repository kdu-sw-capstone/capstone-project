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

Backend 전체120/120·패키징 PASS, Frontend113/113·빌드 PASS. 격리 MySQL57490의 실제 HTTP/DB import8·execution7·note4·policy6 및 기존 Event1.2 HTTP2 시험 통과. 실제 Chrome/회원 Extension NOT RUN. 일반 session.version 극단 경계 계약은 조율 필요하므로 전체 D03/MVP/병합 완료로 바꾸지 않는다. 증거: C:\Users\dahun\capstone-project\.reviews\pr18-20261009\PR18_병합차단_로컬수정_검증보고서.md 및 merge-boundary 로그.
