# STAT-02 · 사이트별 통계

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

- 화면: STAT-01
- 흐름: TF-10
- API: API-STAT-01, API-STAT-02, API-DASH-01
- 데이터: access_events, focus_sessions, session_intervals
- 회원: 회원 Web·Extension
- 비회원: Extension 로컬
- 로컬: EXT 로컬 동일 검증/owner별 저장

원문: [화면](../../design/01_UX_기능설계/02_IA_화면명세.md) · [동작](../../design/01_UX_기능설계/03_동작규칙.md) · [API](../../design/02_시스템_테크설계/04_API_연동.md) · [데이터](../../design/02_시스템_테크설계/05_데이터_복구.md) · [검증 기준](../../design/04_검수_예시데이터/07_검증기준.md)

## 설계와 구현 대응

| 기준 ID | 기대 결과(기존 설계) | 코드 위치 | 검증 명령·환경 | 결과 |
|---|---|---|---|---|
| AC-STAT-02-01 | 확인된 RUN 시간·접근·반복 표시 | | | 미실행 |
| AC-STAT-02-02 | 분모0은 비율null, 미확인은0으로 채우지 않음 | | | 미실행 |
| AC-STAT-02-03 | 지연 이벤트를 발생 날짜에 반영 | | | 미실행 |

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

## 2026-11-02 이용 목적별 기록·통계 점검 / 현재 분류 카드의 응답 검증 보완

- 담당 김다훈. 기존 managed Worktree 재사용, 독립 `codex/site-purpose-summary-integrity`, 실제 통합 기준 **2201654e4ba3adbc1a4738bc14723b708d522c69**. #73/#77/#79 정식 병합 결과, #81 HEAD1f253931·#85 HEAD7b91275 및 타 Worktree/index·공유 staged 삭제1,036개 보존. 열린 목적별 시간 집계/분류 UI 중복 PR은 확인되지 않았다. 아래 초기 미착수 표는 당시 이력이며 이 절도 목적별 이용시간 제품 완료 판정은 아니다.

### 실제 데이터/계약 경계

| 확인 항목 | 현재 구현과 근거 | 판정 |
|---|---|---|
| 현재 목적 저장 | MemberSites.write/site/list, sites.purpose/access_policy/version·회원 row lock/CAS. FOCUS/GENERAL→ALLOW, DISTRACTION→BLOCK/RECORD 검사 | 기존 생산 코드·Git 통합. 이번 API/SQL 변경 없음 |
| 기록의 당시 목적 | MemberExecution.snapshot에 site_id/host/subdomain/purpose/policy/version/name 동결. event→session/policy_snapshot_id, MemberReadModel.accessDetail은 회원 소유 불변 snapshot 반환. BehaviorRecords는 당시 host에 일치하는 snapshot 분류를 상세 표시 | 기존 구현. 현재 사이트 분류를 과거 상세에 덮어쓰지 않음. 목록의 처리 결과/접근 횟수와 당시 목적은 별개 |
| 목적별 이용시간/일별 비율/사이트 시간 목록 | MemberMetrics는 CONFIRMED RUN/접근·반복, 사이트별 duration은 null. AdditionalUsageStatistics는 COUNTED/trusted 원장 browser_ms와 품질만 반환, focus_ms null. purpose별 필드/일별 목적 데이터 없음 | **미구현/BLOCKED**, count/타이머/ACK로 대체 금지 |
| 현재 대시보드 도넛 | GET /sites 전체 페이지의 현재 등록 FOCUS/DISTRACTION/GENERAL 개수·구성비. 기간별 관측시간/접근 기록 차트 아님 | 기존 구현, 이번 검증/명시 문구 보완. 기간 선택과 독립인 현재 설정 수 |
| 과거 기록/미등록 | access detail은 기존 frozen snapshot 기준. 일치 정책이 없으면 당시 정책 미확인. ALLOW 목적의 접근 이벤트가 없다고 이용시간0/GENERAL로 추정하지 않음 | 기존 의미 보존. 사용량의 목적 귀속/분류 변경 효력은 별도 계약 필요 |
| 소유권/재전송 | MemberSites user_id, ReadModel session user/executor, usage owner binding·원본 segment ID/seq/hash. BrowserUsageStatistics의 ACCOUNT_TOTAL은 같은 계정의 기기별 합이며 다른 owner/guest 자료 자동 합산 없음 | 기존 구현/검증 재사용. DOM 카드 계정 이탈 후 늦은 callback 폐기 추가 검증 |

CONFIRMED RUN은 **확인 집중량**, COUNTED 브라우저 구간은 **관측 이용시간**, FOCUS로 분류된 사이트의 시간은 **목적별 이용시간**이다. 서로 같지 않다. usage segment의 actual_host/package/revision·policy_attributions는 SITE_TIME 제약 결속이며 회원 sites의 목적/불변 분류 시점과 자동으로 연결되지 않는다. 다중 제약으로 같은 segment를 반복 합산해서도 안 된다. UNKNOWN/QUARANTINED/관측 실패·분류 미확정을 0이나 GENERAL로 채우지 않는다.

### 실제 수정 — 새 집계/API 없이 현재 등록 분류를 정확히 표시

- MemberApp 안 기존 SiteClassification을 같은 호출 위치의 별도 컴포넌트로 분리해 직접 경계 시험을 가능하게 했다. 데이터 원본은 계속 실제 request GET /sites이며 로컬 예시 배열로 교체하지 않았다. 카드/도넛/반응형·기존 CSS와 Light/Dark 토큰은 재사용한다.
- 중복 site_id(동일/교차 페이지), 알 수 없는 purpose, 누락·모순 has_more/cursor, 불완전 페이지를 정상 분포/빈 계정으로 표시하던 경계를 거절한다. 실패하면 차트를 만들지 않고 명시 재조회한다. 정상 전체 페이지·실제 빈 목록·cursor cycle 거절은 유지한다. 합산 중 subset을 확정 표시하지 않는다.
- 제목을 Figma의 '등록한 사이트 분류'와 맞추고 **사이트 수 기준이며 이용시간 비율이 아님**을 표시했다. 각 범례에 기존 도넛과 같은 색상 표식을 추가하고 텍스트·개수·백분율을 함께 유지했다. 접근성 이름에도 세 목적의 개수를 제공한다. 세션/정책 실행 성공·사용시간을 생성하지 않는다.
- 신규11 시험 중 수정 전 **8 FAIL/3 PASS → 수정 후11 PASS**, MemberApp22 포함33 PASS. 신규 실패 중 응답 무결성 결함과 범례/명시 재조회 개선 기대를 구분하며8개의 제품 결함을 발견했다고 세지 않는다. BrowserUsageStatistics/RecordSnapshot/RecordReasons 포함 직접 영향 **54/54(5파일)** PASS. 날짜/분류변경/소유권·clock/중복 segment의 Server 생산 코드는 unchanged이므로 기존 검증을 재사용한다. 새 HTTP/MySQL·collector/실제 Chrome 확장 시험을 수행했다고 하지 않는다.

### Figma·실제 렌더링 결과

- 현재 연결된 Figma 파일 BeixHumD7TSoo9xMVzJkhO / Dashboard3053:10370은 sparse이므로 상세 **3053:11310**의 고해상도 context+스크린샷을 확인했다. 원본도 시간 차트가 아닌 **등록 사이트3/4/1개** 도넛이다. 조회 세션 c4974670-7cf3-40a7-bf62-94478d9740b5. 현재 원본 확인과 '최신 승인 revision' 증거는 별개이며 승인 이력을 추정하지 않는다.
- 기존 Web은 도넛170px(원본132px), 색상 blue/cyan/light-blue(원본 blue/orange/gray), 카드 크기/본문·범례 배치에 차이가 있었다. 이번에는 새 디자인 시스템/화면·픽셀 이식을 하지 않고 기존 반응형/색을 보존했다. 제목/5px 범례 표식·수치/명시 의미를 보완했다. **Figma 전체 일치 PARTIAL**, 원본과 기존 차이 전체를 승인된 의도 변경으로 표시하지 않는다. 목적별 시간 그래프의 승인 원본/데이터 계약을 새로 추정하지 않았다.
- 실제 headless Chromium에서 기존 MemberApp/생산 component·CSS를 렌더했다. API는 page.route의 **SYNTHETIC 응답**이며 실제 DB/사용자 기록이 아니다. preview에는 이를 명시하는 표식을 넣었다. desktop1920/light·mobile390/light·desktop1280/dark·empty/error/loading **6상태 캡처**, 페이지 오류0·카드 및 문서 가로 overflow0. 관리 버튼 Tab 접근→Enter로 실제 사이트 관리 화면 이동 PASS. 기간 선택 시 시간대 조회만 기간 변경되고 현재 등록수는 유지됨을 확인했다. 전송은 GET만 허용, 설치/START/END/Native 없음.
- 대표 본문 전경/카드 배경의 계산 대비는 light14.64:1, dark17.06:1(실제 계산 원본은 render-result.json을 따름). 숫자/텍스트/ARIA로 색상만 의존하지 않는다. 전체 WCAG 감사나 전체 모바일 제품 수용은 아니다.
- `.local/purpose-summary-20261102/`: before.log/after.log/impact.log/build.log, render.cjs/render-result.json, desktop-light.png/mobile-light.png/desktop-dark.png/empty.png/error.png/loading.png/dashboard-light.png. 최초 preview의 CSRF fixture 누락 로그도 보존했으며 fixture 보완 후 최종6상태를 확인했다. Figma/실제 화면 차이와 합성 API 렌더 결과를 실제 데이터 연결 완료로 승격하지 않는다.

### 목적별 시간 A/B/C를 활성화하기 전 필요한 결정

1. **불변 목적 귀속:** 관측 구간을 어떤 sites ID/version·Snapshot 및 효력 시점으로 결속할지, 분류 변경·삭제/재등록·subdomain 중첩의 당시 분류 규칙. 현재 sites를 과거 사용량에 join하지 않는다. 기록 상세의 기존 frozen 목적은 그대로 유지한다.
2. **품질·분모:** 확인된 관측시간 중 목적 미확정/미등록과 미확인 측정시간을 별도로 표현하는 계약. FOCUS/DISTRACTION/GENERAL로 확인된 시간만 해당 범주에 포함하며 확인 집중량과 분리한다. 없는 시간량을 추정하지 않는다.
3. **기간/소유권:** 기존 KST 기록통계와 ledger timezone/day, 사용자 목표 시간대의 차이·설치별/계정 기기합 기준을 명시해야 한다. overlap/Receipt 재전송으로 segment가 두 번 포함되지 않아야 한다. guest는 로컬 owner, 회원은 허용된 동일 user/executor/binding만 사용하며 자동 import 없음.
4. 김다훈(Server/API·UI)·윤종민(collector/clock/immutable interval 원본)이 위 의미와 기존 API의 최소 확장을 좁게 합의해야 한다. DOM 원본이 실제로 필요한 기능만 채지민과 확인한다. 새 API/DDL/RC2 변경이 필요하면 별도 승인·합의 전 구현하지 않는다.

**현재 목적별 시간 A/B/C와 실제 collector/DB 제품 데이터 수용 BLOCKED/NOT_RUN. 현재 등록 분류 표시·응답 거절/재조회·격리 UI 검증은 PASS. 11월11일에는 이 등록 분류/기존 기록 상세/미확인·오류 표현을 시연 후보로 제공할 수 있으나 목적별 관측시간 그래프 완료를 약속하지 않는다. MVP_FINAL_COMPLETE=false.**
