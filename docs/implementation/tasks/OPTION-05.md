# OPTION-05 · 지원 서비스 확대

단계: 추가 MVP · 설계 담당 영역: Web·Server·Extension

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

- 화면: FEATURE-01
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
| AC-OPTION-05-01 | 대상 기능만 제한하고 전체 차단 우선 | | | 미실행 |
| AC-OPTION-05-02 | 실제 제한 실패는 성공 접근 통계 제외 | | | 미실행 |
| AC-OPTION-05-03 | 정지·종료 시 변경분 복원, 중복 관찰은 한 접근 | | | 미실행 |

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

## Feature 설정 사전 구현 — 2026-10-10

- 담당: 김다훈 Web·Server·DB 범위. 브랜치 feature/additional-feature-settings, 시작 SHA 90ad32be5d282f3b44c917a29e156dffc5e29187.
- 상태: Web·Server 설정 저장 범위 검토 대기 / 실제 Core·Content 통합 대기. 기존 Extension 담당 배정/상태는 변경하지 않음.
- 범위: 기존 Site API와 site_feature_policies의 6개 코드 저장·조회·Web 설정. 추가 enabled 정책은 SNAPSHOT_COMPATIBILITY_REQUIRED로 발급 거절, 비활성 추가 항목만 새 Snapshot에서 생략. 저장 설정과 기존 frozen Snapshot 보존.
- 전체 AC 통과가 아님: 실제 DOM 제한/복원/중복 접근은 Core·Content 통합 후 검증. 실제 Chrome NOT RUN, Snapshot1.2 기본OFF 유지.
- 실행 결과와 코드 위치: 로컬 FOCURVE_추가MVP_Feature설정_구현검증보고서.md 참조. Commit/Push/PR 없음.

- 최종 실행: Backend166/166, Frontend125/125 및 package/build PASS; 격리 HTTP·MySQL·Mailpit 검증179/179 PASS. 실제 Chrome NOT RUN. 전체 AC는 부분/미검증 유지.


## Feature URL 기본포트 Low 수정 — 2026-10-10

- 김다훈, feature/additional-feature-settings, 기준90ad32be5d282f3b44c917a29e156dffc5e29187. API의 명시적port 금지 유지, Frontend 원본authority 검사로 기본443/80 정규화 누락만 수정.
- FeatureSettings.tsx 및 FeatureSettings.test.tsx, 수정전실패 재현→Frontend126/126·빌드, Backend166/166·패키징, 격리 HTTP/MySQL/Mailpit209/209 PASS. 보고서 FOCURVE_추가MVP_Feature설정_기본포트_수정검증보고서.md 참조.
- 기존6코드·frozen·기본Snapshot1.2OFF·미지원발급거절 유지. 실제Chrome/Core/Content는 NOT RUN, 전체AC/MVP완료로 변경하지 않음. 좁은 독립재리뷰 권장. Commit/Push/PR/병합 없음.
