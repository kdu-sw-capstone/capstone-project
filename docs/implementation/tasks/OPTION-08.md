# OPTION-08 · 시간대별 패턴·확장 분석

단계: 추가 MVP · 설계 담당 영역: Web·Server·Extension

## 작업 상태

- 상태: 검토 대기 — API-STAT-03 시간대별 접근 건수 범위; 이용 시간·AI 및 실제 Extension 통합은 미완료
- 실제 담당자: 김다훈 (이번 Web·Server 시간대 접근 범위만; 기존 Extension 배정 유지)
- 브랜치 / 시작 기준 커밋: `codex/hourly-access-statistics` / `90ad32be5d282f3b44c917a29e156dffc5e29187`
- PR:
- 선행 작업 / 차단 조건:

| 영역 | 담당 | 구현 상태 | 검증 상태 |
|---|---|---|---|
| Web | 김다훈 (시간대 접근) | 해당 부분 구현 | 자동 PASS; 실제 브라우저 NOT RUN |
| Server | 김다훈 (시간대 접근) | 해당 부분 구현 | 자동·격리 HTTP/MySQL PASS |
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


## 2026-10-10 · 김다훈 Web·Server 시간대 접근 분석 부분 구현

- 상태: **검토 대기 (API-STAT-03 부분 범위)**. 전체 OPTION-08 및 추가 MVP 완료가 아니다.
- 독립 작업본: `.repairs/hourly-access-20261010`, 브랜치 `codex/hourly-access-statistics`, 시작 develop `90ad32be5d282f3b44c917a29e156dffc5e29187`. Feature 브랜치 `c3e91ca308fe3cf8d03afd33753ddf652e15593a`와 원래 작업 디렉터리를 보존했다.
- 기준: STAT-01/ANALYSIS-01, TF-A03, API-STAT-03, 동작규칙 수집·집계, Event 1.2의 실제 host 및 Event 1.1 target_key 보존, D-01~D-10. 이번 구현은 접근 건수이며 usage segment·AI·ContentPolicy 저장/발급을 구현하지 않는다.
- 코드: RecordQueries.hourly/RecordController.hourly, HourlyAccessPattern, MemberApp. DB 변경·마이그레이션 없음. 세션 frozen Snapshot·Event·Journal·집중 시간 집계 경로를 변경하지 않는다.
- 실제 검증: Backend 166/166 및 패키징, Frontend 127/127 및 빌드, HTTP·신규 임시 MySQL 8.4.8·Mailpit 181/181. HTTP Event는 합성 executor, 대량 10,000행은 비식별 DB fixture다. 실제 Chrome/Core/Content 수집은 NOT RUN.
- 시간대 추가 기준: 24버킷·UTC/KST 자정·날짜 포함/제외·역순 수신·중복·소유자 분리·구형 키·복수 사유 단일 접근·부분/빈 상태·10000행·목록 합계·Frontend 기간 전환/취소/재진입/동일 기간 갱신을 확인했다.
- AC-OPTION-08-01: 활성 탭 이용시간 범위는 NOT RUN/미구현. AC-OPTION-08-02: 접근 건수 부분 수집 null 표시만 확인, 이용시간 중복/미수집은 미검증. AC-OPTION-08-03: 접근 시각 자정·시간대 버킷 총합은 확인, 이용시간 구간 분할은 미검증. 기존 AC 전체를 통과로 올리지 않는다.
- Snapshot 1.2 신규 발급 기본 OFF. 격리 회귀에서만 기존 검증용 executor gate를 일시 ON→OFF했으며 실제 환경은 수정하지 않았다.
- 보고서: 기존 저장소 `.reviews/hourly-access-20261010/FOCURVE_추가MVP_시간대별접근분석_구현검증보고서.md`. 실행 로그·하네스·파일 해시는 같은 폴더.
- 다음 행동: 독립 재리뷰 후 별도 게시 지시 대기. 실제 Chrome 이벤트/브라우저 차트 검증, Core Event 1.2 키·기간·시각 파싱 후속 통합은 미검증. 자동 복구 전체 미구현. Commit·Push·PR·병합 없음.

## 2026-10-10 · PARTIAL 세션 겹침 경계 F-R1 수정

- 담당/브랜치/기준: 김다훈 Server·통계 / `codex/hourly-access-statistics` / `90ad32be5d282f3b44c917a29e156dffc5e29187`. 상태: 경계 수정·로컬 검증 완료, 독립 재리뷰 대기. 전체 OPTION-08 검증완료 아님.
- 이전 독립 재리뷰의 Medium F-R1: 조회 시작에 정확히 종료된 PARTIAL 세션 때문에 빈 날짜가 PARTIAL/null로 표시됨. 이전 실패 기록은 보존한다.
- RecordQueries.summary:146 및 hourly:224의 종료 비교를 `>= range.from`에서 `> range.from`으로 변경. 열린 세션·실제 겹침·기존 소유권/기간/Event 계약 유지. DB·마이그레이션·Frontend 제품 코드 변경 없음.
- HourlyAccessIntegrationTest에 4개 테스트 추가: 종료 전/동일/직후, 시작 상한 경계/내부, 열린 PARTIAL/PENDING/REVIEW_REQUIRED, COMPLETE/다른 회원. 기존 6개 포함 대상 10/10 통과.
- 이번 실행: Backend 170/170·패키징 PASS, Frontend 127/127·빌드 PASS. 신규 tmpfs MySQL 8.4.8·Mailpit에서 HTTP/DB 226/226 PASS(하네스 파일은 Backend 실행 1개를 포함해 227/227). 11개 경계 조합에서 hourly·summary·조회 전후 자료 보존·다른 회원 영향 없음 확인.
- 원래 11개 검토 대상 중 제품/테스트 2개 및 이 카드 기록만 변경; Feature 설정 브랜치와 나머지 파일 보존. 기존 사용자 DB/볼륨/환경 미변경. Snapshot 1.2 기본 OFF, 실제 Chrome/Core/Content NOT RUN. 자동 복구 전체 미구현, 이용시간 관련 AC 미검증 유지.
- 근거: `.reviews/hourly-access-20261010/FOCURVE_추가MVP_시간대별접근분석_경계결함_수정검증보고서.md`, `boundary-fix/backend.log`, `frontend-test.log`, `frontend-build.log`, `http-results.json`, `boundary-matrix.json`.
- 다음 행동: 변경 2개 파일과 기본 통계 영향의 독립 재리뷰 후 별도 게시 지시 대기. Commit·Push·PR·병합 없음. 다음 추가 기능 착수 없음.
