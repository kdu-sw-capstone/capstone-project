# OPTION-06 · 사이트 이용 시간

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

- 화면: ANALYSIS-01
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
| AC-OPTION-06-01 | 활성 탭·포커스·비유휴 RUN 구간만 합산 | | | 미실행 |
| AC-OPTION-06-02 | 겹친 구간·미수집을 시간이나0으로 합산 안 함 | | | 미실행 |
| AC-OPTION-06-03 | 자정·시간대 경계 분할 후 총합 보존 | | | 미실행 |

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


## 2026-10-29 김다훈 Web·Server 설정 연결

- RC2 e2b3fc3 기준 담당 feature 브랜치. 저장·조회·버전·소유권·멱등 transaction과 기존 UI 연결의 상세/검증/미완료는 [담당 작업카드](ADDITIONAL-WEB-SERVER-20261029.md)를 따른다.
- 자동/격리 DB 검증과 실제 Core·Content 실행을 구분한다. Extension 실행 완료·운영 migration·실제 Chrome 수용으로 판정하지 않는다. 기존 담당 배정은 유지한다.

## 2026-11-03 시연 Web UI 최소 정합성 수정

- 담당 김다훈, 기존 managed Worktree 재사용, `codex/web-daily-limit-demo-alignment`, 시작 통합 **e3a3760d43ef0f410beda5b296eb4cd85241638f**. PR93의 대시보드/통계, PR95 공백 수정, 팝업/Core/Content 및 다른 Worktree/index와 공유 staged 삭제1,036개를 보존한다. 두 UI 차이만 다루며 새 API/DB/actor를 만들지 않는다.
- 근거: 사용자 제공 `figma-source-baseline-20261103/screen-baseline.csv` 및 `source-comparison.txt`의 관측 한도 frame3053:66352/69018. 파일은 OBSERVED_NOT_APPROVED이고 공식 version/승인된12개는 UNKNOWN이다. 화면의 사이트별 하루 이용 한도/제한 없음 기준을 사용하며 전체 픽셀 일치나 승인으로 표시하지 않는다.
- AdditionalSettings의 SITE_TIME 이름을 **사이트별 하루 이용 한도**로 정리하고, 독립 사용 토글과 TimeRuleEditor 입력을 이 편집 화면에서 제거했다. 한도 분/null 및 적용된 설치 timezone/day 경계의 초기화 설명을 유지한다. 새 timezone 입력·고정24시간·원장 삭제·한도 초기화를 추가하지 않는다.
- **보존 경계:** `enabled`, `windows`, scope, policy ID/version, tracking_scope 원본은 그대로 저장 요청에 유지한다. 이전 시간창 수와 저장된 사용 상태를 읽기 전용으로 알린다. 비활성 정책을 한도 입력만으로 활성화하지 않으며 새 정책도 기존 disabled 기본값을 유지한다. 한도 null은 다른 이유의 해제/cleanup 완료가 아니다. 기존 시간창의 실제 집행 중단·이관/삭제는 이번 UI 수정으로 완료되지 않는다.
- MemberApp의 반복 설정 callback이 `settings`(실제 분기 없음→대시보드 fallback)로 가던 것을 실제 `account` 분기로 교정했다. 일반 일시정지·CADENCE 휴식·AI 피드백·목적별 시간을 성공 처리하지 않는다. 기존 CONTENT 저장/적용 상태 분리·모든16옵션도 유지한다.
- 변경 전 신규 UI 확인 중 시간창/토글 노출 반례와 실제 MemberApp 경로 반례가 FAIL. 변경 후 직접 영향 **61/61(9파일) PASS**, TypeScript/Vite build PASS. 시험은 요청 모의 및 routing child fixture를 사용한다. 신규 실패 시험의 저장 실패 버튼/메시지 기대가 기존 재확인 UX와 달라 시험만 보정했으며, 초기 before/after/impact 로그도 보존한다. 실패5개를 제품 결함5개로 세지 않는다.
- 실제 headless Chromium에서 생산 MemberApp/FocusSessions/Settings/AdditionalSettings를 렌더했다. 실제 FocusSessions의 반복 설정 버튼→account 설정 이동, Light/Dark1440 및 Light390에서 편집·제한 없음 저장·재진입·저장503/입력 보존을 확인했다. 편집 캡처12개·오류 포함 전체 화면3개, 페이지 오류0·문서/편집 가로 overflow0. API는 **격리 합성 route**, 실제 HTTP/MySQL 저장·Core/Chrome 확장/Native 수용이 아니다. 단위에서는 enabled true/false 양쪽과 원본 windows 보존을 확인했다.
- 증거 `.local/web-demo-alignment-20261103/`: before.log, after.log, impact.log, impact-final.log, build.log, render.cjs/render-result.json 및 Light/Dark/390px 캡처. 최초 social/schedules fixture 누락 및 locator 진단 로그도 보존했고 제품 오류로 집계하지 않는다. 기존 시험 전체/DB를 반복하지 않았다. 게시 HEAD/원격 CI는 PR 본문의 정확한 SHA를 따른다.
- 11/11 반영 가능: 검토·병합 후 하루 한도 **설정 편집/저장/오류/재진입 및 올바른 설정 이동**. 실제 한도 집행·원본 시간창 전환·측정/재기동·정상 END/복원은 별도 BLOCKED/NOT_RUN. `MVP_FINAL_COMPLETE=false`.
