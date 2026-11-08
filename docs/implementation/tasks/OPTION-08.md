# OPTION-08 · 시간대별 패턴·확장 분석

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

- 화면: STAT-01, ANALYSIS-01
- 흐름: TF-A03
- API: API-USAGE-01, API-STAT-01, API-STAT-02, API-STAT-03, API-STAT-04, API-POLICY-01, API-POLICY-02
- 데이터: usage_segments, session_intervals, access_events
- 회원: 회원 Web·Extension
- 비회원: Extension 로컬
- 로컬: EXT 로컬 동일 검증/owner별 저장

원문: [화면](../../design/01_UX_기능설계/02_IA_화면명세.md) · [동작](../../design/01_UX_기능설계/03_동작규칙.md) · [API](../../design/02_시스템_테크설계/04_API_연동.md) · [데이터](../../design/02_시스템_테크설계/05_데이터_복구.md) · [검증 기준](../../design/04_검수_예시데이터/07_검증기준.md)

## 설계와 구현 대응

| 기준 ID | 기대 결과(기존 설계) | 코드 위치 | 검증 명령·환경 | 결과 |
|---|---|---|---|---|
| AC-OPTION-08-01 | 활성 탭·포커스·비유휴 RUN 구간만 합산 | | | 미실행 |
| AC-OPTION-08-02 | 겹친 구간·미수집을 시간이나0으로 합산 안 함 | | | 미실행 |
| AC-OPTION-08-03 | 자정·시간대 경계 분할 후 총합 보존 | | | 미실행 |

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

## 2026-11-02 Web 공백 결함 및 목적별 시간 데이터 연결 점검

- 담당 김다훈, 기존 managed Worktree 재사용, 독립 브랜치 `codex/hourly-eof-whitespace`, 시작 통합 `2201654e4ba3adbc1a4738bc14723b708d522c69`. PR81/85/93·Figma UI 및 팝업 작업·다른 Worktree/index 보존. UI 구현 채팅의 최신 확인에서는 파일 수정이 없었고, 열린 PR 목록에 동일 공백 수정은 없었다.
- `HourlyAccessPattern.tsx`의 통합 blob `b2c8e54c2afd3a96433148f60509abc384221230`은 끝의 빈 줄을 포함한다. 도입 Commit `3f069ed`의 `git show --check`에서 **29행 new blank line at EOF FAIL** 재현. 최신 통합의 마지막 Merge 한 건만 diff 검사하면 이 이전 결함을 찾지 못하므로 구분한다.
- 파일 끝 빈 줄 1개만 제거했다. `git diff --ignore-blank-lines --exit-code`와 수정 diff 공백 검사 PASS. 함수·JSX·정책·API·DB·Core/Content 변경 없음. 직접 영향 HourlyAccessPattern **4/4 PASS**, TypeScript·Vite 빌드 PASS. 원격 CI는 제출 기록/원본 로그 기준으로 별도 확인한다. 전체 시험·HTTP/MySQL·제품 Chrome 수용을 새로 실행한 것으로 표시하지 않는다.
- 로그: `.local/hourly-whitespace-20261102/tests.log`, `build.log`. 기존 목적별 분류 점검/렌더링/시험은 [STAT-02의 2026-11-02 기록](STAT-02.md)을 재사용한다. 이번에는 Figma 차트·팝업·카드 레이아웃을 수정하지 않는다.

### Figma UI 담당이 재사용할 현재 데이터 계약

| 현재 생산 경계 | 실제 필드·기간·단위·상태 | 목적별 시간 연결 여부 |
|---|---|---|
| `GET /api/v1/sites` / MemberSites.list | 현재 회원의 site_id·purpose·version, cursor/limit 전체 페이지. FOCUS/DISTRACTION/GENERAL 개수·비율은 단위 '사이트 수', 날짜별 관측 아님 | 도넛의 **사이트 수** 모드에 사용 가능. 과거 시간에 현재 분류를 join하면 안 됨 |
| `GET /api/v1/amvp/statistics/browser-usage` / AdditionalUsageStatistics | `scope=INSTALLATION/ACCOUNT_TOTAL`, 설치 조회 executor_id, from_date/to_date 필수·양 끝 포함·최대366일. `browser_ms` 밀리초/null, `focus_ms=null`, quality PARTIAL/UNKNOWN/NO_DATA, as_of. 계정 모드는 SUM_OF_DEVICE_USAGE | 전체 확인 브라우저 이용시간만 있음. 목적별 합계·사이트별 시간·7일의 날짜별 목적 배열 없음 |
| `/statistics/summary`, `/statistics/targets` / MemberMetrics | 접수 접근·반복과 CONFIRMED RUN. 사이트별 active_duration_ms는 null | 접근 횟수나 확인 집중량으로 목적별 이용시간을 대체할 수 없음 |
| `/statistics/hourly` / MemberHourlyStatisticsApi | 날짜 범위의 KST 24시간대 접근 횟수·품질 | 7일 목적별 이용시간 그래프의 데이터가 아님 |
| RC2 ClockedUsageSegment / amvp_usage_segments | owner_binding_id/executor·segment ID/seq/hash, actual_host·runtime package/revision, clock/day·confirmed_ms/uncertain_ms, policy_attributions | 원본/멱등 수신·COUNTED 검증 재사용 가능. 회원 sites의 당시 purpose/version으로 귀속하는 계약은 없음 |

- 집계 조회는 과거 binding의 user_id와 executor를 유지하고 admission을 검사한다. UNKNOWN/격리/미검증 clock은 확인 시간에 포함하지 않는다. COUNTED가 있어도 coverage를 발급하지 않아 현재 응답은 PARTIAL이다. `browser_ms=null`은 0분이 아니며 NO_DATA는 관측 완료·사용 없음의 증거가 아니다. 실제 producer의 신뢰 clock/capability가 준비되지 않았다면 기존 fail-closed 거절을 유지한다.
- 기존 access detail의 frozen Snapshot은 **접근 사건 당시 목적**을 보존하지만, 모든 ALLOW 사이트의 관측 구간을 포괄하는 시간 원장은 아니다. 원본 시간 집계와 이 사건 목록을 임의 결합하지 않는다.

### 최소 추가 합의 — 미승인 제안, 구현/DDL 없음

1. 관측 구간→당시 site ID/version 또는 불변 Snapshot의 목적 귀속 및 효력 시점. 분류 변경·삭제/재등록·하위 도메인 중첩·미등록을 결정하고 과거 기록 재분류는 하지 않는다.
2. 기간 합계와 날짜별 FOCUS/DISTRACTION/GENERAL의 **밀리초**, 확인됐으나 목적 미정인 시간, 측정 미확인 상태를 구분하는 최소 응답. 목적 비율의 분모와 수집 coverage·as_of를 명시한다. 추정 UNKNOWN 시간량/가짜 0은 만들지 않는다.
3. 날짜/timezone·반개구간 분할 및 일별 합=기간 합, 설치/동일 회원 계정 기기합 범위, segment 원본 ID 기준 중복 제거를 확정한다. Guest는 로컬 owner이며 로그인만으로 합산하지 않는다.
4. 김다훈(Server/API·DB·Web)과 윤종민(collector/clock·불변 구간 원본)이 좁은 계약을 합의한 뒤 기존 조회 확장/별도 경계 및 저장 필요성을 정한다. SITE_TIME 목적 귀속에 Content 작업을 임의 추가하지 않는다. 응답 필드명·새 API·migration은 이번에 확정하지 않는다.

**결과: 공백 최소 수정 및 직접 영향 시험 PASS. 목적별 이용시간 도넛·7일 그룹 막대그래프 데이터 연결 BLOCKED(신규 집계/귀속 계약 필요). 실제 HTTP/MySQL·Core/Content·Chrome/Native 제품 수용 NOT_RUN. MVP_FINAL_COMPLETE=false.**
