# OPTION-12 · 행동 기반 AI 피드백

단계: 추가 MVP · 설계 담당 영역: Web·Server·Extension

## 작업 상태

- 상태: PARTIAL — 하루 목표 저장·확인량 조회·Web 연결 및 AI 조회/철회/안전 거절 구현. 제품 수용 NOT_RUN
- 실제 담당자: 김다훈 (Web·Server·DB·UI)
- 브랜치 / 시작 기준 커밋: feature/additional-mvp-daily-goal / 3569911dde9ec71d86c3b1e36f631c34e2411d53
- PR: [Draft #81](https://github.com/kdu-sw-capstone/capstone-project/pull/81). 게시 HEAD/CI는 PR 본문과 .local/goal-implementation-20261101/result.json. Approve/해제/Merge 제외.
- 선행 작업 / 차단 조건:

| 영역 | 담당 | 구현 상태 | 검증 상태 |
|---|---|---|---|
| Web | | 미확인 | 미실행 |
| Server | | 미확인 | 미실행 |
| Extension | | 미확인 | 미실행 |

해당하지 않는 영역은 관련 명세 근거와 함께 해당없음으로 표시한다.

## 설계 참조

- 화면: ANALYSIS-01
- 흐름: TF-A07
- API: API-AI-01, API-AI-02, API-AI-03, API-AI-04, API-STAT-04
- 데이터: analysis_jobs, analysis_results, analysis_consents
- 회원: 회원 Web·Extension
- 비회원: 계정 필요; 로컬 기본 분석은 별도
- 로컬: 계정 필요; 로컬 기본 분석은 별도

원문: [화면](../../design/01_UX_기능설계/02_IA_화면명세.md) · [동작](../../design/01_UX_기능설계/03_동작규칙.md) · [API](../../design/02_시스템_테크설계/04_API_연동.md) · [데이터](../../design/02_시스템_테크설계/05_데이터_복구.md) · [검증 기준](../../design/04_검수_예시데이터/07_검증기준.md)

## 설계와 구현 대응

| 기준 ID | 기대 결과(기존 설계) | 코드 위치 | 검증 명령·환경 | 결과 |
|---|---|---|---|---|
| AC-OPTION-12-01 | 사용자 집계의 근거를 표시하고 설정 제안 | | | 미실행 |
| AC-OPTION-12-02 | 부족·동의없음·provider 실패를 별도 표시 | | | 미실행 |
| AC-OPTION-12-03 | 재요청 캐시·기존 결과 보존; 자동 설정 변경 없음 | | | 미실행 |

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


## 2026-11-01 하루 목표·AI 동의/피드백 계약 및 구현 준비

**상태: 계약 대조·최소 구현 계획 정리 완료 / 제품 구현·Schema 적용·provider 전송 미실행.** 담당 김다훈(Web·Server·DB·UI). 아래는 승인된 기존 원칙과 미승인 제안을 구분한 준비 기록이며 RC2 개정·새 API/DDL 승인·제품 수용이 아니다. 초기 미착수 표를 구현완료로 소급하지 않는다.

- 기준: 원격 통합 `3569911dde9ec71d86c3b1e36f631c34e2411d53`, 현재 source HEAD `e9f42615c1720f1dfea889be28aca2c54891b5fc`. #73/#77/#79 HEAD·제품/시험/리뷰 상태 보존. 현재 채팅·기존 작업카드·병렬 트랙의 진행 요약에서 같은 목표/AI 구현 진행은 확인되지 않았으며 팀원 RuntimeReport 작업을 중복 시작하지 않았다.
- RC2 확정/병합 `e2b3fc318fe52acc45145a30def07b874b2255f6`의 `api.json`, 기존 동작 규칙·데이터 명세와 현재 파일의 동일성을 확인했다. AI를 전부 새 미정 계약으로 되돌리거나 RC2 전체 승인 절차를 재시작하지 않는다.
- 제품 코드·SQL·공용 Schema·Figma·DB·서비스·provider·GitHub 변경 없음. 이 기존 카드의 준비 기록만 추가하며 Commit/Push/신규 PR 없음. `MVP_FINAL_COMPLETE=false`.

### 1. 확인한 Figma 원본과 승인 범위

기존 [UI 매핑](../../design/additional-mvp-contracts/05_Content_Event_UI.md)의 파일 `BeixHumD7TSoo9xMVzJkhO`, Settings Light `3053:30010` 및 Dashboard Light `3053:10370`을 재사용했다. 이 매핑은 화면 참조 근거이며 하루 목표 API/DB·동의 고지·provider의 별도 승인 증거가 아니다.

| 노드 | 실제 확인 | 판단 |
|---|---|---|
| `3053:30096` 하루 집중 목표 | 상세 design context·이미지 확보, 목표 수정 동작 | 하루 목표 표시/편집 진입이 있음. 세션별 집중 시간과 구분 |
| `3053:30100` 편집 영역(숨김) | metadata에 시간/분 입력, 저장·취소·저장 오류 시 초안 유지. 저장 버튼 이름에 `API 미연동` | 입력 표시 단위는 시간·분. 저장 단위·상한·기본값을 여기서 확정할 수 없음. 숨김 편집 상태의 시각 수용 미확인 |
| `3053:10925` 오늘 누적/목표 | 상세 context·이미지, 예시125분/180분·69%·55분 남음 | 예시3시간은 저장 기본값/허용 범위가 아님. 현재 목표를 과거 날짜에 소급하지 않음은 검토 방향이며 날짜별 저장 계약은 미정 |
| `3053:30143` AI 분석 동의 | 상세 context·이미지, 동의 안 함·동의 관리 | 고지문 버전/provider/보존 조건의 구체값이나 동의 저장 성공 증거가 아님 |
| `3053:11464` AI 상세 패널(숨김) | metadata·반환 코드 확인, 이미지가 비어 시각 확인 불가 | 상세 패널 고해상도 시각 검수 NOT_VERIFIED. 추정 구현/레이아웃 변경 없음 |

Figma frame별 최신 담당 승인 SHA/개별 승인 기록을 새로 확인한 것은 아니다. 기존 프레임 매핑/원본을 재사용했으며 이번 조회를 새로운 승인으로 표시하지 않는다. Dark/나머지 화면의 이번 시각 검수는 NOT_RUN.

### 2. 하루 목표: 확정 근거와 결정이 필요한 부분

| 경계 | 기존 근거 | 구현 전 결정 |
|---|---|---|
| 단위 | Figma 시간·분, 기존 API 기간은 ms 정수 | UI↔API↔DB 단위, 최소/최대·0/미설정 의미. 세션1~180분 상한을 하루 목표에 가져오지 않음 |
| 날짜/시간대 | 기존 회원 집계 `MemberReadModel.range`는 Asia/Seoul, 날짜 양끝 포함·내부 구간 `[시작,다음날00시)` | 하루 목표도 KST 고정인지/별도 IANA인지, 자정·시간대 변경 규칙 |
| 소유·저장 | 회원 화면에 목표가 있으나 추적된 API·DDL·DTO에 하루 목표 자원 없음 | 회원 계정 공통/설치별/비회원 로컬, 현재 기본값만 보관/날짜별 이력, 수정 효력일·경합 version |
| 집계 원본 | `MemberMetrics.evidence/project`의 CONFIRMED RUN·조회기간 교차 절단·세션별 목표시간 cap, 기존 `/statistics/summary`의 `active_duration_ms` | 이 값을 목표 분자로 쓸지, 진행 중/종료/가져온 세션 포함 여부, 다중 설치·중첩/overrun 처리와 품질 표기 |
| 다른 시간 원장 | `AdditionalUsageStatistics`는 기기별 physical usage 합·기록 시간대·격리 분리 | browser_ms·사이트 사용량·carry·휴식을 집중 시간에 더하지 않음. 기존 confirmed 시간 자체도 제품 측정 수용과 별개 |
| 표시 | 오늘 누적·목표·비율·남은 시간 | 미설정/미수집을0으로 만들지 않음. 초과 목표 비율/진행막대, 과거 목표 없는 날짜 표시 규칙 |

**최소안(미승인 제안):** 회원의 현재 기본 목표만 별도 설정으로 저장하고 오늘 KST의 확인 집중량에만 연결한다. 과거 목표 이력이 없으면 과거 달성률을 표시하지 않는다. 과거 날짜별 목표/수정 이력이 필요하면 그 요구만 추가 합의한다. 경로·필드·테이블·범위·효력일은 아직 확정하지 않았다. 목표는 표시/자기관리 설정이며 세션 `duration_minutes`, SITE_TIME `daily_limit_ms`, CADENCE 기한·frozen Snapshot/Attachment를 변경하지 않는다.

### 3. AI: 이미 존재하는 계약(재사용)

- [기능/회원 범위](../../design/01_UX_기능설계/01_기능범위.md): 원격 AI는 회원 전용. 비회원 로컬 자료는 로그인만으로 보내지 않고 명시적으로 가져온 회원 기록만 사용한다.
- [동작 규칙](../../design/01_UX_기능설계/03_동작규칙.md) AI 입력·출력: 회원 요청 기간의 사이트별 접근/반복·확인 이용시간·시간대·확인 집중 구간·적용 설정 집계. 사이트는 가명 key로 치환한다. 페이지 원문·이미지·키워드 원문·세션 메모·이메일·전체 URL은 제외한다. 개인 모델 재학습 기능이 아니다.
- 생성 조건: 완료 세션3개 이상·확인 RUN 합30분 이상. 접근0도 유효하고 수집 한계를 표시한다. 관찰 최대5개/제안 최대3개, metric_id·수치·기간/화면 ID를 Server가 검증한다. 제안은 사용자가 설정 화면에서 편집·저장하며 자동 정책 변경은 금지한다.
- 기존 async [API-AI-01~04](../../design/02_시스템_테크설계/04_API_연동.md): `POST /api/v1/analysis-jobs`(from_date,to_date,consent_version), 단건/목록 GET, `PUT /api/v1/analysis-consent`(accepted,notice_version). W/E 소유·쿠키/Bearer·변경 CSRF/Origin·공통 멱등 계약 재사용. 동의 변경은 W 전용이며 소셜 연결 동의와 별개다.
- `AnalysisJob` 상태: QUEUED/RUNNING/SUCCEEDED/FAILED/INSUFFICIENT_DATA. 기존 거절: INSUFFICIENT_DATA422, CONSENT_REQUIRED403, PROVIDER_UNAVAILABLE503. provider interface `generate(집계 JSON,출력 JSON schema,request_id)`; 실패는 PROVIDER_FAILED. 임의 새 동기 feedback API/상태를 추가하지 않는다.
- 외부 adapter 전 provider/전송 항목 안내와 명시 동의, 철회 이후 신규 전송 금지. 타임아웃60초·자동 재시도1회·동일 데이터/기간/model_version의24시간 결과 재사용. 실패가 기존 결과·원본 집계를 삭제하지 않는다. 24시간 캐시는 결과/회원 자료 보존기한이 아니다.
- [데이터 명세](../../design/02_시스템_테크설계/05_데이터_복구.md): `analysis_jobs`(owner/date/input_hash/input_snapshot/status/consent_version/provider/model_version/시각/error), `analysis_results`(job_id/result/generated_at), `analysis_consents`(user_id/accepted/notice_version/updated_at), 회원 영속 보관. 자동30일 삭제로 바꾸지 않는다. 외부 provider의 보관·학습 정책이 이 회원 DB 보존 규칙으로 승인된 것은 아니다.
- [RC2 API adapter](../../../contracts/additional-mvp/rc1/api.json) `legacy_adapters.analysis`와 [02_API_DB](../../design/additional-mvp-contracts/02_API_DB.md): 위 async/동의 API를 재사용, 제안 전용·approved provider 부재503 유지. 기존 계약이 있다는 것과 route/DDL 구현이 있다는 것은 다르다.

### 4. 현재 구현과의 차이·필요 결정

추적된 `frontend/src`, `runtime-server/src/main`, `backend/src/main`과 migration/RC2 runtime candidate SQL을 검색했다. 현재 AI endpoint 전용 구현, 하루 목표·analysis 3테이블 DDL/실행 migration 및 AI용 JSON Schema 정의는 확인되지 않는다. 운영 DB를 조회해 테이블 부재를 단정한 것이 아니다. `analysis_group_id`는 접근 집계 group이며 analysis_jobs 구현이 아니다.

| 결정 | 빠진 경계 / 최소 해결 방향(아직 미승인) | 담당 |
|---|---|---|
| G1 목표 저장 | 계정/설치·단위/범위·KST/효력일·이력 여부·GET/PUT/ETag 계약. `User`/인증 DTO나 RuntimePackage에 임의 추가하지 않고 분리된 최소 자원 검토 | 김다훈(제품·Web·Server), 집계 원본은 윤종민 검토 |
| G2 목표 분자 | CONFIRMED RUN·현재/종료·가져오기·다중 설치·overrun/날짜 절단/quality 선택. 기존 일일 한도나 브라우저 시간을 대용하지 않음 | 김다훈·윤종민 |
| A1 현재 동의 조회/경합 | 현재 명세는 PUT뿐이라 새로고침 시 현재 동의를 읽는 GET 계약이 없음. 같은 resource의 GET 추가가 최소 후보이나 승인 전 미구현. notice_version↔consent_version exact binding·고지 갱신/재동의·동시 수정 검증도 명시 필요. 과거 job의 consent_version으로 현재 동의를 추정하지 않음 | 김다훈·API 계약 담당 |
| A2 철회/작업 경합 | 철회 ACK와 외부 전송 시작의 직렬화 기준, QUEUED/재시도 금지, 이미 전송한 RUNNING/늦은 응답·기존 GET/cache 처리 결정. 기본 '신규 전송 금지'는 완화하지 않음. 새 CANCELED 상태/오류 코드를 임의 추가하지 않음 | 김다훈·제품/공용 계약 담당 |
| A3 input/result/job 저장 | immutable input_snapshot의 JSON·metric_id/quality/as_of·가명화/수치 검증·input_hash 범위, resource version/멱등·중복 작업·부분자료/자료부족 상태 매핑 확정. DTO as_of를 DB JSON/별도 열 중 어디에 둘지 결정. 현재 single-row consent에 별도 이력/감사 테이블을 자동 추가하지 않음 | 김다훈, 집계 의미는 윤종민; Content는 원문 제외/기능 근거만 관련 검토 |
| A4 provider·고지·보존 | 실제 제공자/model/인증/호출 지역·전송 allowlist·처리/보관/학습·철회 한계·고지 본문과 버전, 캐시의 provider/고지 변경 결속. local 회원 영속 보관과 provider 보관을 분리. 비밀키는 환경 주입, UI/로그/PR에 넣지 않음 | 제품 책임자/김다훈 승인, provider 계약 담당 |
| A5 additive migration | 기존3테이블 설계에 맞는 실제 DDL·FK/인덱스/유일성·migration 번호/배포·원복 정책 검토 후 적용. 기존 schema/잠금 해시/과거 migration 변경 금지 | 김다훈 DB·Server/통합 검토 |

원래 통신 재시도 공통 규칙과 AI provider 자동 재시도1회를 구분한다. job 제출 응답 유실은 같은 멱등 키로 확인하고 새 provider 호출을 무한 생성하지 않는다. TTL/재시도값·오류를 새로 발명하지 않는다. 기존 결과 보존과 철회 후 외부 삭제 보장은 별개이며 provider 삭제가 지원된다고 가정하지 않는다.

### 5. 중복 없는 최소 구현 순서(이번에는 계획만)

1. G1/G2 및 A1~A5의 빠진 항목만 승인한다. 기존 async API·회원 범위·입력 제외·제안 전용·캐시/timeout·보존 규칙은 재검토로 되돌리지 않는다.
2. 승인된 additive 목표/AI 저장을 격리 MySQL에서 구현·검증한다. 목표/동의 저장·재조회는 Core·Content actor/외부 provider 없이 독립 가능하다. 현재 계획에서 SQL 파일이나 DB를 변경하지 않았다.
3. 김다훈 Server에서 기존 인증·소유권·멱등/transaction·회원 read model을 재사용하여 목표/동의 경계와 AnalysisJob 비동기 요청/조회·불변 집계를 연결한다. 실제 provider 없으면 기존503/차단을 유지하고 SUCCEEDED fixture를 제품 결과로 만들지 않는다.
4. Web 구현 지점: `frontend/src/Settings.tsx`(목표 편집/동의 상태), `MemberApp.tsx` Dashboard·Statistics(현재 목표/과거 분석 조회), 기존 `api.ts` request를 호출하는 별도 기능 adapter. api.ts 인증/legacy-lock·#73/#77/#79를 재작성하지 않는다. Figma 숨김 편집/AI 상세 화면의 시각 검수·상태 흐름은 해당 원본 확보 후에만 구현한다.
5. provider/고지 승인 후에만 외부 adapter를 활성화한다. 근거 ID/숫자 불일치·미설정 provider·동의 없음·철회 직후 queued/retry·current/old owner 응답·version/멱등·실패 rollback·기존 결과 보존·24시간 캐시 경계를 시험한다. 실제 전송 수용은 별도 유효 승인 범위에서 수행한다.

작업카드/PR이 진행 중인 #73/#77/#79, #76/#78 Core, #71 Content, 팝업/Shorts 트랙과 기능/파일을 섞지 않는다. RuntimeReport·Receipt·수신기를 AI 작업 원장으로 재구현/전용하지 않는다. 공유 API/owner/집계 의미가 바뀌는 부분은 실제 관련 담당과 기존 공동 승인 조건을 적용하며 일반 UI 문구까지 일괄3인 승인 대상으로 확대하지 않는다. 이번 턴에 팀원 메시지/승인/PR을 대신 발송하지 않았다.

### 6. 11월11일 시연 경계

- 현재 가능한 근거: Figma 목표/동의 표시 원본, 기존 계정·설정·통계 조회와 격리 HTTP/SQL 증거. 하루 목표 저장/AI 동의 저장/분석 완료는 아직 시연 PASS가 아니다.
- 위 저장 계약과 migration/API 승인이 조기에 끝나면 목표·동의의 저장→재진입→version 충돌/오류 유지·provider 미설정503까지 독립 시연 후보가 된다. 구현·격리/HTTP·Web 통합 시험이 실제 통과한 후에만 해당 완료를 보고한다.
- 실제 AI 피드백은 승인 provider/고지·명시 동의, 유효 집계/자격 조건·숫자 검증·철회 fence 및 실제 호출 수용이 모두 필요하다. 임의 예시 응답을 실제 AI 분석으로 표시하지 않는다. 완전한 SITE_TIME collector 연결 전에도 기존의 적격 CONFIRMED 회원 기록으로 분석 경계를 준비할 수 있으나 미확인 사용량을 채워 넣지 않는다.
- 새 시험·빌드·서비스·DB/provider 실행 없음(문서 준비). 기존 PASS/제품 수용 상태는 그대로며 전체 제품 `MVP_FINAL_COMPLETE=false`.


## 2026-11-01 구현 착수 범위 A~D 분리 및 승인용 최소안

이 절은 위 분석의 후속 실행 분류다. 기존 분석·기준 SHA·미커밋 문서를 보존했으며 **새 API/필드/DDL/provider/동의 의미를 확정하거나 구현한 것이 아니다.** A는 추가 공동 계약 결정 없이 개발 가능한 내부 로직, B/C/D는 해당 선행 조건만 분리 보류한다. 이번 요청은 준비·계획까지이므로 제품 코드/DB/서비스/외부 전송/Commit/Push/PR 변경은 없다.

### A. 현재 승인 계약만으로 바로 구현 가능한 코드

| 최소 단위 | 바로 구현 가능한 내용 | 여기서 구현하지 않을 내용 |
|---|---|---|
| 분석 자격의 순수 판정 | 이미 검증된 완료 세션 수·CONFIRMED RUN 합을 입력으로 받아 기존3개/30분 기준 및 부족 상태를 판정. 접근0은 부족 사유로 취급하지 않음 | 어떤 세션을 완료로 인정할지/새 시간 원장을 만드는 집계는 B/C. 미확인 시간을 채우지 않음 |
| 개인정보/결과 구조 검증 | 기존 제외 목록의 필드 유입 거절, 관찰≤5·제안≤3, 알려진 metric_id 및 화면 ID 참조·기존 Result 구조 검사 | 전송 JSON의 새 형식·가명 키·input_hash 규칙·자유문장 수치 검증 완료를 임의 확정하지 않음 |
| 기존 안전 정책 경계 | provider 미설정503·명시 동의 없는 전송 금지,60초/재시도1회/24시간 상수의 분리. 테스트에서 네트워크가 호출되지 않음을 검증 | 새로운 성공 provider·임의 동의 고지/동의 true·실제 외부 호출·작업저장/철회 scheduler 활성화 없음 |

파일 후보는 `runtime-server/src/main/java/kr/ac/kdu/focurve/AnalysisRules.java` 및 대응 `AnalysisRulesTest.java`의 내부 규칙 모듈이다(현재 미생성). 필요할 때 기존 명세의 provider interface만 추가하고 기본 비활성으로 둔다. **미사용 helper만 게시하는 PR을 만들지 않고 실제 첫 AI 요청/저장 경계 PR에 포함**한다. A의 구현에 RC2 전체 재승인이나 Core·Content actor 완성을 요구하지 않는다.

A 시험은3세션/30분 경계·미확인 입력·접근0·제외정보 유입·결과 개수/참조 ID·provider 없는 네트워크0을 중심으로 한다. 구조검증 PASS를 실제 집계/모델 정확성·제품 연결 PASS로 표시하지 않는다.

### B. Core·Content 확인 뒤 연결할 코드

- **윤종민 Core 확인:** 기존 `MemberMetrics`의 CONFIRMED RUN/confirmed_until과 세션 cap을 하루 목표/AI 자격의 원본으로 사용해도 되는지, 진행 중 확인 구간/종료/START_FAILED/UNKNOWN·overrun, 자정 절단·다중 설치 중첩·가져온 세션 provenance/중복 처리 및 quality를 확인한다. `AdditionalUsageStatistics`의 physical browser usage·사이트 attribution·carry·휴식은 목표 집중량에 더하지 않는다.
- 진행 중 세션은 경과 wall-clock을 추정 합산하지 않는다. 종료 세션도 종료 표시만으로 전체 목표 시간을 인정하지 않는다. 기존 확인 구간·기록 품질을 소비하며, 정확한 포함 규칙 승인 전에는 새 '오늘 달성량'을 확정 표시하지 않는다.
- **채지민 Content 확인:** 기존 기능별 이벤트/집계의 원문 제외·feature identity 의미가 필요한 부분만 확인한다. DOM 원문·이미지·댓글·키워드 원문을 AI 입력으로 제공하는 새 producer는 요구하지 않는다. 기존 제외 범위가 유지되는 목표·동의 CRUD 자체는 Content actor 대기 없이 진행 가능하다.
- B의 미완료는 목표 설정/동의 저장 전체를 막지 않는다. 설정 저장은 C 승인 뒤 독립 구현하고, 진행률/분석 입력 연결만 검증된 근거 제공 시 붙인다. 기존 세션 상태·집계 원장을 이 기능에서 다시 구현하지 않는다.

### C. 사용자/관련 담당 합의가 필요한 구체 계약

아래는 승인 가능한 **최소 후보**를 제시한 것이며, 현재 확정값이 아니다. 특히 숫자/경로/컬럼을 이 기록만으로 제품에 적용하지 않는다.

| 구분 | 최소 후보 / 필요한 확인 |
|---|---|
| 목표 단위·범위 | UI 시간·분 → API/DB `goal_ms` 정수,1분 단위60,000~86,400,000(1~1,440분) 후보. 미설정은 null,0·예시3시간 자동 기본값 없음.24시간 입력은24시0분만 허용. 하루 범위는 세션1~180분 상한에서 유추한 것이 아니며 사용자 승인 필요 |
| 목표 소유 | 회원 계정 공통1개, Web cookie 인증으로 조회/수정하는 안. 설치별 한도·비회원 로컬 목표는 이 안으로 자동 확정/삭제하지 않음. owner는 인증 주체로 결정하고 body user_id를 받지 않음 |
| 날짜·효력 | KST 고정 `[00:00,다음날00:00)`, 저장 성공한 오늘부터 기본값으로 적용·이후 날짜도 변경 전까지 사용. 기존 진행 세션의 Snapshot/시간/한도는 바꾸지 않음. v1은 현재 기본값만 보관하고 과거 목표/달성률을 소급 표시하지 않는 안. 과거 목표 이력이 필요하면 그 저장 범위만 별도 합의 |
| 목표 API/저장 | 신규 `GET/PUT /api/v1/daily-focus-goal` 후보(미승인·미구현). 회원 목표 row에 user_id/goal_ms/version/updated_at 후보. row 없는 GET404를 미설정으로, 첫 저장 If-None-Match:*·이후 If-Match/ETag·같은 멱등 키 재확인으로 처리하는 안. 수정 충돌412·재조회·초안 보존/재진입·계정 전환 지연응답 폐기는 기존 패턴 재사용 |
| 현재 동의 GET | 기존 `PUT /analysis-consent` body/응답과 async analysis-jobs는 유지. 같은 resource의 Web GET을 추가하는 안. 미저장404를 동의 없음으로 표시하고 과거 job consent_version으로 현재 승인을 추정하지 않음. 고지문은 실제 승인된 버전/내용을 별도로 확보해야 함 |
| 동의 version/동시 수정 | notice_version은 고지 버전, 자원 version/ETag는 경합 제어, job consent_version은 제출 시 고지 결속이다. 서로 대용하지 않음. 기존 동의 응답 body를 유지하면서 내부 row revision/ETag와 조건부 쓰기를 추가할지 합의. 기존 공통 If-Match/멱등 의미와 첫 row 생성 규칙을 명시하고, 지연된 과거 동의 ACK가 철회를 되돌리지 못하게 함 |
| 철회와 작업 | 철회 이후 queued/retry의 신규 전송 금지 원칙은 확정. 전송 시작/철회 ACK의 직렬화 지점, 이미 시작한 RUNNING 호출·늦은 응답/저장/조회 처리를 합의. 이미 전송된 자료를 되돌렸다고 표시하지 않음. 기존 상태 enum으로 표현할 범위를 먼저 정하고 새 CANCELED 상태/오류 코드를 임의 추가하지 않음 |
| 불변 Snapshot·as_of | 고정 기간·수치·quality·근거 ID/provenance·가명화·집계 기준시각·Schema 버전을 묶은 입력 형식을 확정. 기존 input_snapshot JSON과 input_hash를 재사용하고 DTO as_of를 그 JSON/별도 열 중 어디서 복원할지 결정. 새 조회 시각으로 과거 job의 as_of를 덮어쓰지 않음 |
| 캐시 결속 | 기존 user+기간+동일 데이터+model_version·24시간 유지. 조회할 때마다 변하는 `as_of=now`를 그대로 hash하면 동일 데이터 캐시가 깨지므로, query 시각과 실제 데이터 기준/변경 watermark를 구분하는 hash 규칙이 필요. cache hit는 원래 Snapshot/as_of를 반환하고 새 분석으로 가장하지 않음. provider/고지 변경 시 캐시의 허용 범위도 합의 |
| 실제 DDL | 기존 analysis_jobs/results/consents의 논리 필드를 기반으로 additive migration 작성. 목표 테이블, 동의 revision·FK/인덱스/멱등/캐시 경합 및 Snapshot 보관 형식만 필요한 만큼 검토. 기존 migration·Schema·원본 hash 수정 없음. 회원 영속 보관과24시간 결과 재사용을 별개로 유지 |

목표 저장·동의 GET/ETag·입력/캐시·DDL의 새 경계만 관련 담당 승인으로 확정한다. 이미 수락된 회원 집계/원문 제외/제안 전용/60초/1회/24시간/명시 동의/철회 원칙을 다시 승인 대기로 돌리지 않는다. 현재 실제 제공자 고지 없이 불특정 provider 전체에 동의한 것으로 저장해서는 안 된다.

### D. Provider·고지 승인 뒤에만 활성화할 기능

- 실제 provider/model·호출 환경·전송 allowlist·가명화·보관/학습·이미 전송한 요청의 철회 한계·고지 본문/notice_version을 제품 책임자가 확인한다. 인증 key는 환경 주입이며 Git/UI/로그에 포함하지 않는다.
- 승인된 고지에 대한 실제 사용자 명시 동의와 현재 버전 확인 뒤에만 외부 전송을 허용한다. 동의 DB/화면은 C 후 시험 가능하지만, 고지 미승인 상태의 실제 '동의함' 수집은 활성화하지 않는다. provider가 없어도 동의한 것처럼 채우거나 성공 피드백을 반환하지 않는다.
- 실제 provider가 없는 제품 상태는 기존 PROVIDER_UNAVAILABLE503/안전한 비활성이다. 분석 실패와 기존 저장 결과를 분리한다. 개인 데이터 전송·외부 호출·실제 모델 피드백 수용은 별도 유효 실행 범위에서만 진행한다. 이번에는 호출0·전송0이다.

### 최소 파일·시험·PR 계획

아래 파일은 **후보명이며 아직 생성하지 않았다.** 실제 착수 시 기존 구현 유무를 해당 범위에서 다시 확인하고 파일 수를 최소화한다.

| 단위 | 최소 변경 후보 | 직접 영향 시험·선행 조건 |
|---|---|---|
| 목표 저장/화면 PR | `DailyFocusGoalApi.java`, `DailyFocusGoalStore.java`, `dailyFocusGoalApi.ts`, 목표 편집 컴포넌트와 기존 Settings/Dashboard 연결, 승인된 additive migration | C의 목표 계약 승인 후 저장·GET·nullable/범위·권한·ETag412·멱등·동시 수정·rollback·재진입/구 응답 격리. B 미확인 분자는 미확인으로 유지. 숨김 편집 Figma 상태 확인 후 UI 구현 |
| AI 동의/작업 준비 PR | `AnalysisApi.java`, `AnalysisStore.java`, `AnalysisJobs.java`(비활성 provider 경계), A의 `AnalysisRules.java`, `analysisApi.ts`, 기존 Settings/분석 상태 UI 연결, 기존3테이블 additive migration | C의 동의/작업/DDL 결정 후 쿠키·CSRF/owner·현재 동의 GET·동시 수정/철회 fence·Snapshot 불변·응답유실 같은 키·캐시/as_of·provider 없는 호출0/503·기존 결과 보존. Synthetic 입력 시험을 실제 분석으로 표시하지 않음 |
| Provider 활성화 후속 PR | 승인된 provider adapter/환경 설정·고지/결과 UI 연결만 추가 | D 승인·유효 실제 호출 범위 확보 후 timeout/재시도1회·근거/수치 불일치·철회·실패/부분자료·실제 결과 검증. 자격/비밀/민감정보를 PR에 넣지 않음 |

기존 `api.ts`·인증·MemberMetrics·RuntimeReport/Receipt/수신기를 재작성하지 않는다. Web/Server 타입·관련 단위, 신규 DDL은 fresh 격리 MySQL/HTTP, UI는 기존 입력/미확정/계정 전환 회귀와 빌드를 실행한다. 같은 source의 기존 PASS를 재사용하고 전면 회귀/미사용 helper PR/중복 PR을 목표로 하지 않는다. #73/#77/#79와 팀원 PR은 이번 준비 범위로 변경하지 않는다.

### 착수 승인과 11월11일 시연 범위

- **A:** 기존 개발 권한으로 구현 가능하며 새 공동 계약 승인을 붙이지 않는다. 이번 요청은 준비까지여서 코드 작성은 하지 않았다. 독립 로직이 준비돼도 서비스/저장/UI 연결 완료로 집계하지 않는다.
- **B:** 윤종민의 집계 원본·quality/provenance 확인, 필요한 경우만 채지민의 이벤트/원문 제외 경계 확인. 목표/동의 저장 자체를 Core·Content 개발 전체 완료까지 묶어 기다리지 않는다.
- **C:** 사용자/제품 책임자의 목표 최소안 선택, 관련 API·DB 담당의 동의 GET·revision/철회/입력/캐시/DDL 승인. 공용 API/집계 의미를 바꾸는 부분에는 기존 관련 담당 공동 승인 조건을 적용한다.
- **D:** 승인 provider/model·고지·명시 동의·실제 전송 수용 범위가 필요하다. C 승인만으로 외부 전송을 허용하지 않는다.
- 11월11일 독립 시연 후보는 C 승인·구현·시험 뒤의 목표/동의 저장→재진입→충돌·오류 유지, provider 미설정503이다. 목표 진행률은 B 확인 후, 실제 AI 피드백은 D/실제 호출·근거 검증까지 통과한 경우에만 시연 완료로 판단한다. 예시125/180·69%나 합성 결과로 대체하지 않는다.
- 변경은 기존 OPTION-12 준비 문서에 한정. 제품/DB/Figma/서비스/외부 호출·Commit/Push/PR 변경 없음. 문서 diff/기존 내용 보존을 확인하고 기존 시험을 불필요하게 반복하지 않는다. `MVP_FINAL_COMPLETE=false`.


## 2026-11-01 하루 목표 집계 제품 정책 확정 반영

사용자의 이번 8개 결정이 이 카드의 이전 **미승인 후보보다 우선**한다. 기존 분석/검증 이력은 보존한다. 앞 절 C의 `goal_ms` 내부 저장 후보와 KST 고정 후보는 이 결정으로 **대체**됐으며 구현 기준으로 사용하지 않는다. 진행 중 확인 구간을 포함할지 여부도 더 이상 제품 정책 미결정이 아니다. 아래는 정책 확정/소스 대조 결과이며 새 API·DB Schema·외부 계약 승인이나 제품 구현 완료를 뜻하지 않는다.

### 확정된 8개 제품 정책

1. 집중 세션 진행 중에도 오늘의 목표 진행률과 집중 시간을 실시간 표시한다.
2. 날짜와 하루 경계는 사용자가 설정한 시간대를 따른다.
3. 단순 타이머 경과가 아닌 실제로 확인된 집중 시간만 인정한다.
4. 기존 CONFIRMED RUN 집계를 재사용하고 진행 중 세션의 검증된 집중 시간도 실시간 표시값에 반영한다.
5. 미확인·UNKNOWN 시간은 확정 집중 시간으로 저장하지 않는다.
6. 실시간 표시값과 영구 확정 통계를 구분하고 같은 구간을 중복 합산하지 않는다.
7. 자정을 넘는 세션은 사용자 시간대의 날짜별로 나눈다.
8. 목표는 시간·분으로 입력하고 내부 목표값은 정수 분 단위로 관리한다.

### 기존 계약·코드와의 정합성

검토 소스 HEAD: `e9f42615c1720f1dfea889be28aca2c54891b5fc`. RC2 확정 기준: `e2b3fc318fe52acc45145a30def07b874b2255f6`. 이번 분석은 이 checkout의 기존 세션/통계 경로를 확인한 것이며 새 원격 producer나 실제 실행 성공을 확인한 것이 아니다.

| 경계 | 확인한 기존 원문/구현 | 판정·필요한 연결 |
|---|---|---|
| 확인된 시간만 인정 | D-01/D-05 공용계약은 마지막 확인 시점까지만 인정. `MemberIntervals.validate/merge`는 CONFIRMED RUN·구간 신원·종료/기간을 검사하고 같은 interval_id의 confirmed_until을 갱신하며 세션 내 중첩을 거절 | 정책과 정합. UNKNOWN의 불확실한 뒷구간을 추가하지 않으며 이전에 정당하게 확정된 구간까지 일괄 삭제하지 않음 |
| 진행 중 원본 | `extension/member-a1/core.mjs`는 검증된 RUNNING 경계에서 confirmed_run_ms/last_trusted_at과 interval을 commitBundle로 저장. `extension/integration/member-a1-adapter.mjs`의 report는 APPLIED의 observed_at에 last_trusted_at을 사용하고 tickInnerBody에서 보고/flush | 코드 수준의 기존 생산·전달 경로가 있음. 새로운 actor 불필요. 이 경로가 목표 표시까지 실제로 최신 확인 구간을 전달한다는 제품 수용 증거는 없음 |
| 영구 통계 재사용 | `MemberExecution.intervals`가 MemberIntervals 병합 결과를 session_intervals에 저장. `MemberMetrics.evidence`는 CONFIRMED RUN start_at/confirmed_until을 요청 UTC 구간과 교차 절단하며 세션 cap 적용. 종료된 세션만 필터하지 않아 진행 중에 서버가 수락·저장한 구간도 포함 가능 | 저장된 확인 구간 기반을 재사용 가능. 단순 now-start를 집계하지 않음. query의 as_of=현재 시각은 확인 watermark가 아니며 데이터 최신성/완전성을 보증하지 않음 |
| 사용자 시간대 | 기존 API 공통 기본은 Asia/Seoul, `MemberReadModel.range` 구현은 Asia/Seoul 고정. RC2 TZ-01/02는 executor별 desired/applied timezone·version·effective_at 구분 | 비KST 사용자의 목표 날짜에 기존 KST 집계를 그대로 쓰면 충돌. 목표 집계의 zone/효력 연결 계약이 필요하며 기존 API나 전체 통계 의미를 조용히 바꾸지 않음 |
| 시간대 변경·일일 경계 | RC2 DEC-06/DAY/TZ는 설치별 applied timezone, 현재 day 종료 후 변경·원장/사용량 재작성 금지 및 한도 승계를 규정 | 목표를 사용자 시간대 기준으로 표시하는 원칙과 양립. 계정 목표에 어느 설치/사용자 설정을 연결할지, 변경 효력/과거 날짜 투영을 합의해야 함. 목표 변경으로 한도 day/예산/기존 시간 원본을 재설정하지 않음 |
| 내부 분 단위 | 기존 기간 원본·세션 통계는 ms 정밀도 | 목표 설정만 정수 분으로 관리하고 기존 확인 구간 ms는 보존. 비교 시 검증된 목표 분×60,000으로 변환 가능. 구간마다 분으로 버려 누적 오차를 만들지 않음. 표시 반올림/퍼센트 상한은 별도 UI 세부 기준 |
| 중복 방지 | interval_id별 누적 병합/세션 내 overlap 거절은 존재. MemberMetrics는 세션별 합산·cap이며 계정 전체의 구간 union이나 live+durable 합성기는 아님 | 기존 병합을 재사용하되 실시간 누적 전체를 기존 통계에 다시 더하지 않음. 다중 설치·명시 import 중복의 원본 신원/범위 결정은 아직 필요 |

대조 원문: `docs/design/02_시스템_테크설계/FOCURVE_D01_D10_최종공용계약.md`(확인 구간·cap·UNKNOWN), `04_API_연동.md`(기간 ms/기본 시간대), `docs/design/additional-mvp-contracts/02_API_DB.md`(DAY/TZ·설치별 TZ-01/02), `04_정책_시간.md`(DEC-06·자정/DST), `contracts/additional-mvp/rc1/schema.json`의 TimezoneWrite/TimezoneRecord. 목표 설정은 집중 세션 duration/Snapshot/Attachment·SITE_TIME daily_limit·CADENCE 고정 종료를 변경하는 실행 명령이 아니다.

### 실시간 표시와 영구 통계의 연결 경계

- **우선 재사용:** 서버 수락·저장된 CONFIRMED RUN을 사용자 날짜의 UTC 범위로 투영하고 최신 확인 구간이 도착할 때 표시를 갱신한다. 서버 저장 전의 별도 실시간 source를 쓰는 경우에만 그 source의 검증·신원·지속 저장 경계가 추가로 필요하다. 이 카드에서 별도 producer/새 Wire/임시 성공 값을 만들지 않는다.
- 기준 통계와 실시간 투영은 같은 원본 구간을 참조한다. 저장된 구간과 최신 검증 구간의 겹치는 부분은 한 번만 반영하고, 같은 interval_id의 새 confirmed cutoff는 교체/확장으로 처리한다. 실시간 구간이 영구 저장됐다는 ACK가 와도 다시 가산하지 않는다. 조회 버전/확인 watermark가 없는데 `통계 합계 + 현재 세션 누적`으로 합치면 안 된다.
- `frontend/src/sessionCountdown.ts`는 display estimate only이며 실행 판정/저장 원본이 아니다. countdown·wall-clock·예정 종료시각·UI polling 횟수만으로 확인 구간을 늘리지 않는다. 검증된 새 구간이 오지 않으면 마지막 확인 값/기준시각과 최신 상태 미확인을 구분한다. 이를 실시간 확인 완료로 표시하지 않는다.
- 마지막 확인 뒤 UNKNOWN/네트워크 지연/Worker 재생성이 생기면 불확실 구간은 확정하지 않는다. 기존 확정 prefix·원본·미전송 보고/Receipt·cleanup 의무는 보존한다. 과거 UNKNOWN의 누락 구간을 소급 생성하지 않는다.
- 하루 범위는 사용자 zone의 해당 local date 시작부터 다음 local date 시작까지 `[start,end)`를 UTC instant로 변환한다. 각 확인 구간을 그 범위와 교차 절단한다. 자정 걸친 한 interval_id도 날짜별 부분 합은 겹치지 않아야 한다. DST의 23/25시간 날은 고정86,400,000ms로 계산하지 않는다.
- SITE_TIME 물리 이용시간/clock day-carry·휴식·미확인 시간은 집중 목표 분자에 더하지 않는다. 기존 active_duration_ms cap/overrun을 임의 제거하지 않는다. overrun을 목표에 포함할지, 다중 설치 동시 집중·명시 import의 중복/시간대 이력을 어떻게 보일지는 남은 집계 세부 결정이다.

### 필요한 제공물·남은 합의와 담당

| 담당 | 필요한 최소 내용 | 현재 상태 |
|---|---|---|
| 윤종민 Core | 기존 confirmed RUN의 interval/session/executor·owner 결속, revision/generation 및 검증 범위, 마지막 신뢰 시각과 누적/종료 구간, 영속 commit/보고/ACK 경계. 진행 중 tick→보고→서버 저장에 실제 제공되는 형상·호출 시점과 재시작/오프라인/UNKNOWN 때의 최신 확인 경계를 확인 | 기존 코드 원본 있음. 목표 실시간 연결의 실제 전달/최신성 수용은 NOT_RUN. 목표용 새 actor/임의 초 단위 SLA를 요구하지 않음 |
| 김다훈 Web·Server | MemberIntervals/MemberExecution/MemberMetrics의 저장·조회 투영 재사용, 동일 구간 중복 방지, owner/설치 전환·이전 revision/지연 조회 폐기, 마지막 확인시각과 조회시각 구분 | 분석 완료. 목표 API/DDL·실시간 조회 응답 계약 미합의이므로 이번에 변경 없음 |
| 제품/API·DB 관련 담당 | 목표 허용 범위·미설정 표현, 회원/비회원·계정/설치 범위, 사용자 시간대 설정의 권위 원본 및 기존 executor timezone과의 관계, 변경 효력/이력, 목표 version/멱등·API/저장 형식, 다중 설치/import/overrun 포함 세부 기준 | 8개 제품 정책 외 항목은 미결정. 이전1~1,440분/null/계정공통/즉시효력/GET·PUT/테이블 후보가 이번 승인으로 확정된 것은 아님 |
| 채지민 Content | 기존 Core의 적용/복원 근거가 필요한 경로만 기존 계약으로 제공 | 하루 목표 계산을 위해 새 DOM 수집기나 별도 Content actor를 추가할 필요 없음 |

단순 표시 갱신 주기는 실제 제공 빈도/권한·서버 조회 경계 확인 후 정한다. 기존5초 재검증 기한·sender/owner/세대/ACK·UNKNOWN/HOLD/복원 의무는 유지한다. 사용자 시간대 제품 정책을 미결정으로 되돌리지 않으며, 그 설정을 기존 설치별 applied zone과 연결하는 계약만 별도로 남긴다.

### 구현 가능 범위·검증 종료 조건

- **분석 PASS:** 8개 정책 및 기존 원본/재사용 경계 확인. 기존 minute 목표·ms 구간 변환, 사용자 날짜별 UTC 투영·겹침 제거 설계를 준비 가능하다. 순수 투영 시험은 기존 interval Fixture로 준비할 수 있으나 이번 요청은 정책/가능 범위 분석이므로 코드/시험을 작성·실행하지 않았다.
- **구현 선행 조건:** 목표 저장 범위·zone/변경 효력·API/DDL 승인 후 목표 저장/조회/입력 UI를 구현한다. 실시간 확인 원본 연결은 기존 Core/report 경로의 결속·최신성 확인 뒤 붙인다. AI provider/동의 결정 때문에 목표의 독립 저장 구현까지 묶어 보류하지 않는다.
- **직접 영향 시험 계획(미실행):** 진행 중 confirmed cutoff 증가/중복/역순 보고, 영구 통계+live 겹침 및 종료 시 교체, UNKNOWN 뒤 미확인 tail 제외·기존 prefix 보존, 사용자 자정/DST23·25시간 분할, 시간대 변경·다중 설치/import 소유권, 계정 전환 지연 응답, 목표 분 변환과 구간 ms 정밀도 보존. 기존 cap/실행·ACK·정상 END/복원 회귀를 영향 범위에서 재사용/검증한다.
- **제품 수용 NOT_RUN:** 실제 Chrome/Native/Core→회원 보고→Server 저장→목표 UI 갱신·날짜 분리·정상 END/복원까지 확인하지 않았다. 코드 경로 존재와 기존 자동 PASS를 이 수용의 PASS로 승격하지 않는다.
- 변경은 이 카드의 추가 기록뿐이다. AI 기존 동의/회원 집계/원문 제외·제안 전용·60초/1회/24시간·철회 원칙 보존. 제품 코드·공동 계약 원문·API·DB Schema·서비스·외부 전송·Git Commit/Push/PR 변경 없음. `MVP_FINAL_COMPLETE=false`.


## 2026-11-01 목표 저장 정책 승인 및 AI 동의 최소 구현 준비 갱신

**현재 유효한 결정은 이 절과 앞선 8개 실시간 집계 정책이다.** 이전 A~D 분석·미승인 후보는 당시 이력으로 보존하되 아래에서 승인된 항목을 계속 미정으로 취급하지 않는다. 분석을 처음부터 반복하거나 기존 PR/producer 구현을 재작성하지 않았다. 소스 HEAD는 계속 `e9f42615c1720f1dfea889be28aca2c54891b5fc`이며 이 요청은 구현 준비 범위다.

### 1. 새로 승인된 목표 저장·표시 계약

| 항목 | 확정값 |
|---|---|
| 목표 입력/저장 | 시간·분 입력 → 정수 분,1~1,440분. 미설정 null. 예시3시간을 기본값으로 만들지 않음 |
| 회원 범위 | 계정 공통 목표. 임의로 특정 설치의 목표로 저장하지 않음. 비회원 목표의 저장 범위를 이번 승인으로 신설하지 않음 |
| 변경 효력 | 사용자 설정 시간대의 오늘부터 변경된 목표 적용. MVP는 현재 목표값 우선 보관 |
| 과거 날짜 | 해당 날짜의 목표 근거가 없으면 현재값을 소급하여 과거 달성률을 추정하지 않음. 과거 확인 집중량 조회와 목표 달성률 유무는 별개 |
| 진행 중 표시 | 기존 CONFIRMED RUN 중 실제 확인된 진행 구간도 필수 반영. 영구 통계와 실시간 표시를 구분하며 동일 구간은 한 번만 계산 |
| 날짜/불확실성 | 사용자 시간대의 자정 기준 분할. 미확인/UNKNOWN tail은 확정 통계에서 제외. 이미 확인된 prefix는 보존 |

이로써 앞 절의 범위/null/단위/회원 소유/오늘 효력/현재값 우선/과거 소급 금지는 **확정**이다. `goal_ms` 저장·KST 고정 제안은 채택하지 않는다. 반면 신규 API 경로/응답·DDL·자원 version/첫 저장 조건은 승인됐다고 추정하지 않는다.

### 2. 기존 계약과 남은 연결 차이만 확인

- **정합:** D-01/D-05의 확인 RUN·cap/overrun·UNKNOWN 제외, MemberIntervals/MemberExecution의 영속 구간, MemberMetrics의 구간별 교차 절단을 재사용한다. 목표 분×60,000과 확인 구간 ms를 비교하되 구간별 분 단위 절사/타이머 시간 저장은 하지 않는다. 목표를 세션 duration·frozen Snapshot/Attachment·SITE_TIME 한도·CADENCE 종료에 반영하지 않는다.
- **기존 KST 구현과의 차이:** `MemberReadModel.range` 및 기존 통계 원문은 KST 기준이다. 새 목표의 사용자 시간대 요구에 그대로 사용할 수 없다. 기존 통계를 전역 변경하지 않고 목표용 날짜→UTC 범위 투영을 재사용 경계에 연결하는 안을 준비한다. API의 zone 전달/권위·반환 형상은 별도 확인한다.
- **시간대 미설정:** 예약 명세의 기본 Asia/Seoul은 예약용이며 계정 공통 목표의 미설정 처리 승인으로 전용하지 않는다. 확인한 RC2는 설치별 timezone 자원이다. 계정 목표의 권위 있는 사용자 시간대/미설정 default는 해당 원문에서 확인되지 않았다. OS 시간대나 첫 설치 시간대를 조용히 채택하지 않고, 목표 저장과 별개로 날짜 집계 미확인을 표시할 수 있어야 한다(정확한 응답/문구는 구현 계약에서 확정).
- **시간대 변경:** RC2 TZ-01/02·DEC-06은 desired/applied zone·version·effective_at을 구분하고 현재 day 종료 후 적용한다. 원장/한도 재계산·reset 금지는 유지한다. 이를 계정 목표에 어떤 설정 원본으로 연결할지만 미결정이다. 목표값 변경의 '오늘부터'는 확정이며 이를 시간대 변경 대기 규칙과 혼동하지 않는다. DST local midnight→다음 local midnight 분할은 기존 규칙 재사용이다.
- **Core 호환 확인 범위:** 새 제품 정책 설계를 요청하지 않는다. 기존 member-a1 Core의 last_trusted_at/CONFIRMED interval → adapter report/APPLIED observed_at → MemberExecution 저장 → MemberMetrics 조회의 실제 사용 가능 형상/결속/마지막 확인 경계만 윤종민과 확인하면 된다. 별도 Core actor·Content 수집기를 추가하지 않는다.
- **갱신 주기 근거:** Core의 검증 성공 뒤 `focurve-member-a1-check` alarm은5초 뒤를 예약하고 adapter tick은 RUNNING일 때 확인 보고를 보낸다. 기존 API 원문도 활성 명령 조회5초 목표/비활성30초 이상 alarm을 구분한다. 이는 제품의5초 실시간 전달 보장이 아니다. 실제 Worker 실행→인증 전송→ACK/저장→조회 지연과 현재 UI의5초 조회/전환 중1초 조회도 별개다. 목표 UI 갱신 주기는 검증된 새 cutoff 수신/조회에 맞추며 미도착 동안 시간을 추정 증가시키지 않는다. 마지막 확인 시각·조회 as_of를 분리할 조회 경계가 필요하다.

### 3. 바로 준비 가능한 최소 Web·Server·DB·UI 범위

| 영역 | 확정 정책으로 준비 가능한 내용 | 활성 구현 전 남은 경계 |
|---|---|---|
| Web/UI |1~1,440분/null 검증·시간/분 변환, 계정 공통 목표 편집/현재값 표시, 저장 중/충돌/실패 초안 유지·계정 전환 지연 응답 폐기, 과거 목표 미상 표시 | 기존 Figma 편집 숨김 상태의 시각 검수·목표 API 형상. 실시간 값 없이 임의125/180 같은 예시를 제품 값으로 표시하지 않음 |
| Server | 인증된 회원 owner 유도·기존 멱등/조건부 수정·transaction 패턴 재사용, 기존 interval 기반 날짜 투영·중복 방지·원본/확인 cutoff 구분 | 목표 GET/PUT 경로·DTO·첫 저장/미설정 응답·version 계약, zone 권위/변경 효력 연결. 현재 미정 필드/오류 코드를 생성하지 않음 |
| DB | 현재 계정 목표값을 nullable minutes로 보관하고 범위 검증하는 additive 저장안, 기존 users 소유·동시 수정/rollback 검토 | 정확한 테이블/열·revision/효력일 표현·migration 승인. 기존 schema를 임의 수정하지 않으며 미보관 과거 목표를 복원하지 않음 |
| 집계/표시 | 기존 서버 수락 CONFIRMED RUN을 날짜별 재투영, 누적 보고 중복/역순·영구 저장 전후 한 번만 반영·UNKNOWN tail 제외 시험 준비 | 실제 확인 시간 공급의 호환/최신성·조회 기준점. 다중 설치/import provenance·기존 cap/overrun 포함 세부 해석은 기존 의미를 임의 변경하지 않음 |

파일/PR 후보는 앞 절의 DailyFocusGoalApi/Store·전용 Web adapter/목표 컴포넌트·승인 additive migration을 재사용한다. `api.ts`/legacy-lock·RuntimeReport/Receipt를 재작성하지 않는다. DB/API를 만들지 않고 준비만 하는 이번 작업에 미사용 검증 helper/새 PR을 만들지 않는다.

### 4. AI 동의·작업 저장의 안전한 최소 구현 경계

기존 API-AI-01~04와 논리3테이블을 유지한다. 회원 집계만 입력, 원문·메모·이메일·전체 URL 제외, 제안 전용,60초·자동 재시도1회·24시간 캐시, 명시 동의 전 전송 금지·철회 뒤 신규 전송 금지는 확정 상태다.

| 최소 단위 | 기존 재사용/구현 준비 | 아직 확정하지 않을 의미 |
|---|---|---|
| 현재 동의 조회 | 기존 PUT `accepted,notice_version` 의미를 유지하고 동일 동의 resource의 Web GET 추가안으로 준비. owner는 인증에서 얻음 | GET 경로/권한·미저장 응답·ETag 계약. 기존 PUT은 W이므로 E 접근을 자동 확대하지 않음 |
| 동의 version | notice_version은 고지, 저장 row의 수정 충돌 version/ETag는 자원 경합, job consent_version은 제출 동의 결속으로 분리 | 고지 버전 값을 수정 충돌 version으로 사용하지 않음. 논리 analysis_consents에 row revision이 없으므로 실제 추가 형식/조건부 첫 저장을 승인 없이 만들지 않음 |
| 철회 경합 | 전송 직전에도 현재 동의를 검사하고 queued/retry 신규 전송을 막는 경계 준비. 철회/dispatch의 계정 단위 직렬화·서버 작업 저장과의 원자성 시험 설계 | 이미 전송된 RUNNING 결과의 보관/표시·늦은 완료 처리·정확한 직렬화 지점은 공동 결정. 철회를 전송 취소/외부 삭제 성공으로 표시하거나 새 CANCELED 상태를 만들지 않음 |
| 불변 입력 | analysis_jobs.input_snapshot/input_hash에 회원 집계·기간·근거/quality·실제 집계 기준을 고정하는 안. job GET에 현재 조회 as_of를 새로 씌우지 않음 | as_of 저장 위치/정규화·가명 key·입력 schema/hash canonicalization은 미확정. 조회 now만 바뀌어 동일 데이터 캐시를 깨지 않게 함 |
| 캐시 | 기존 user+기간+동일 데이터/input_hash+model_version·24시간 의미 및 원래 Snapshot/as_of 유지 | provider/notice 변경 결속, 철회 후 기존 결과/캐시 조회는 신규 전송과 구분하여 합의.24시간을 보존기간으로 해석하지 않음 |
| 실제 저장 | 논리 analysis_jobs/results/consents 및 users FK를 토대로 불변 입력/결과·상태 전이·원자 저장/멱등/rollback을 준비 | 실제 DDL·revision·인덱스·캐시 경합 제약은 미작성. 기존 회원 영속 보관은 유지하되 provider의 보관/학습 정책은 미승인 |
| 기본 거절/검증 | 기존3개 완료 세션/CONFIRMED RUN30분 자격, 제외 필드·결과 구조/근거 검사, consent 없음403·provider 없음503 경계를 준비 가능 | 실제 producer/집계/정상 provider가 있다고 가정하지 않음. 오류 우선순위나 새 성공/상태 enum은 임의 확정하지 않음 |

provider 미설정은 안전한 비활성/거절이며 SUCCEEDED 결과·가짜 동의·모의 외부 provider를 제품에 넣지 않는다. 실제 고지/provider가 미승인인 상태에서 '동의함' 수집이나 외부 전송을 활성화하지 않는다. 기존 입력/거절 순수 규칙은 추가 공동 승인이 필요 없는 구현 가능 범위지만 첫 실제 요청/저장 단위와 함께 구현하는 기존 최소안을 유지한다.

### 5. 남은 결정·시험·11월11일 시연 경계

- **새로 결정할 제품 목표 정책 없음:** 이번 승인된8개 저장 정책과 앞선 실시간 정책은 완료 처리한다. 목표의 API/DDL·계정 timezone 권위/미설정/변경 연결, AI 동의 경합/불변 입력·hash/DDL 등 미승인 경계만 별도다. Core에는 기존 출력 호환성 확인만 필요하며 제품 목표 재설계를 요구하지 않는다.
- **관련 시험 준비(아직 미실행):** null/1/1,440·경계 밖·시간/분 변환, 계정 공통 저장/412/같은 키/rollback·초안 유지, 오늘 변경/과거 목표 미상, 자정/DST·시간대 미설정/변경, 중복/역순 cutoff와 종료/영구 저장 전후 한 번 반영, 계정 전환·UNKNOWN, 동의 GET/동시 철회·queued/retry/늦은 결과·불변 Snapshot·캐시 재사용·provider 미설정 호출0. source/계약이 같은 기존 유효 PASS는 재사용하며 이번 문서 변경 때문에 전면 시험을 반복하지 않는다.
- **시연 후보 PARTIAL:** 목표 API/DDL 및 시간대 연결을 확정하고 구현·Web/격리 HTTP/DB 시험을 통과하면 목표 편집→저장→재진입→오늘 확인 집중량 비교·오류 유지까지 가능하다. 실시간 진행률은 실제 확인 원본 갱신 연결 검증까지 필요하다. AI는 미설정 비활성/거절을 우선 시연 후보로 하고 실제 피드백/외부 전송 성공은 포함하지 않는다. 현재 이 기능의 저장/UI/실시간 제품 수용은 NOT_RUN이다.
- **실제 변경:** 이 기존 OPTION-12 카드만 갱신. 이전 미커밋 기록·#73/#77/#79·다른 Worktree/index 보존. 제품/시험/API/DDL·DB·서비스·메일·Core/Content·provider 호출 변경 없음. Commit/Push/신규 PR 없음. 문서 diff/기존 내용 보존만 확인한다. `MVP_FINAL_COMPLETE=false`.


## 2026-11-01 실제 구현 체크포인트 — OPTION-12

이 절이 위 준비 이력 이후 실제 구현/검증 상태다. 김다훈 담당, 독립 `feature/additional-mvp-daily-goal`, 기준 통합 `3569911dde9ec71d86c3b1e36f631c34e2411d53`. #73/#77/#79 HEAD를 수정/포함하지 않고 같은 checkout을 새 브랜치로 사용했다. 이전 미커밋 준비 문서를 보존하여 함께 기록한다.

### 구현한 경계

- `DailyFocusGoal.java`, `Option12Api.java`, `Option12Writes.java`: 계정 공통 nullable1~1,440분 목표/시간대 저장·조회, 사용자 owner/auth·CSRF·동일 계정 row lock·ETag/If-Match·멱등 재전송/충돌·rollback. 실행 actor/세션/한도 mutation 없음.
- `V10__daily_goal_and_analysis_safety.sql`: additive 목표 singleton 및 불변 계정 시간대 변경 이력, 기존 논리 analysis_consents/jobs/results. notice_version과 동의 row version 분리. 이전 migration/RC2/legacy-lock 원본은 그대로다. 설치별 RC2 budget timezone을 계정 목표 설정으로 덮어쓰지 않는다.
- 확인량은 기존 `MemberExecution.intervals`가 수락·저장한 `session_intervals` CONFIRMED RUN이다. 세션별 기존 cap을 적용한 후 UTC 구간 union으로 중복·다중 세션 중첩을 제거하고 날짜/기간으로 절단한다. UNKNOWN의 과거 확인 prefix만 포함하고 미확인 tail/타이머/사이트 사용량은 더하지 않는다.
- `DailyFocusGoal.tsx` 및 CSS: Settings 시간/분·계정 시간대 편집, Dashboard 확인량/진행률,5초 조회(타이머 추정 없음), null/미설정·오류·412 초안 보존·동일 미확정 요청 재확인·owner 수명/구401 격리·저장 ACK 값/버전 결속. `MemberApp.tsx`/`Settings.tsx`는 이 컴포넌트 연결만 추가한다.
- `AnalysisSafety.java`/`AnalysisConsent.tsx`: 동의 GET·기존 고지에 대한 철회 PUT·row version/멱등 보호, 미승인 accepted=true503, provider 없는 제출 거절, 불변 내부 집계 Snapshot/as_of/hash·24시간 동일 입력/모델 비교 규칙. 내부 Snapshot은 전송 Schema 승인/외부 provider가 아니다. 새 동의 수락/분석 worker/외부 HTTP dispatch는 구현·활성화하지 않았다.

### Web 전용 additive API 형상

기존 analysis PUT/body 및 async 성공 의미, 세션/RC2 API는 바꾸지 않는다. 아래 신규 goal/consent 조회 응답 확장은 본 Draft의 Web·Server 검토 대상이며 공동 계약 전체 승인을 대신하지 않는다.

| 경로 | 요청/결과 |
|---|---|
| GET /api/v1/daily-focus-goal | Web 계정 singleton. 미저장은 `{goal_minutes:null,timezone:null,version:0,goal_effective_date:null,updated_at:null}`. 과거 목표 이력으로 사용하지 않음 |
| PUT /api/v1/daily-focus-goal | `{goal_minutes:null 또는1..1440,timezone:null 또는IANA}`. If-Match 현재 숫자 version(초기0), UUID Idempotency-Key 필수. 값·timezone·새 version 결속 ACK. 다른 본문/같은 키409, 충돌412, 전제 없음428 |
| GET /api/v1/daily-focus-goal/today | 위 설정+date/day_start/day_end/period_start/partial_day/confirmed_ms/last_confirmed_at/has_unconfirmed_session/time_status/as_of. timezone 미설정은 confirmed_ms/date=null. as_of는 조회시각, last_confirmed_at은 원본 cutoff. 확인량은 하한이며 전체 측정 완료를 보장하지 않음 |
| GET /api/v1/analysis-consent | 실제 현재 accepted/notice_version/updated_at+독립 version, provider_configured=false. 미저장 accepted=false/notice=null/version0. 동의 없는 외부 전송0 |
| PUT /api/v1/analysis-consent | 기존 `{accepted,notice_version}` 유지, If-Match/Idempotency-Key로 철회만 저장. notice와 row revision 대용 금지. 미승인 수락은503. 신원은 body가 아닌 인증에서 유도 |
| /api/v1/analysis-jobs | provider 미설정으로 생성·전송·재시도 비활성. POST는 현재 동의 없으면403, 있더라도503이며202/SUCCEEDED를 만들지 않음. 실제 job 생성/상세·기간 목록·캐시 제공 연결은 미완료(현재 GET도503). 기존 완료 결과/진행 중 행을 철회로 삭제/성공 처리하지 않음 |

목표·동의 설정은 Web 쿠키 경로이며 Extension bearer로 계정 설정을 수정하지 못한다. recovery/preserved-END 채널에서 활성화하지 않는다. body 중복 키/추가 owner 필드/잘못된 zone/조회 query/초과 크기를 거절한다.

### 날짜·보존 동작

- 미설정 시간대는 OS/KST로 채우지 않는다. 목표값 저장은 가능하지만 일일 확인량은 TIMEZONE_NOT_SET이다. 사용자가 IANA 시간대를 명시 선택한다. 첫 선택은 이전 계정 목표 일일 원장이 없으므로 선택한 시간대의 오늘 구간을 표시한다.
- 이미 설정된 시간대를 변경하면 새 zone은 변경 instant 이후 구간에만 적용한다. 새 zone의 오늘 읽기는 `period_start=max(현지 자정,변경 instant)`이며 partial_day/안내를 표시한다. 이전 zone/원본 확인 구간·기존 KST 통계/과거 날짜는 재분류하지 않는다. 시간대 이력은 별도 불변 행으로 남긴다. 설정된 zone의 null 초기화는 안전한 과거 경계 유지 의미가 미정이므로422로 거절한다.
- 목표 변경은 오늘의 현재 목표에 적용하며 과거 목표 없는 날짜의 달성률을 제공하지 않는다. 일일 한도/예산 day·세션 cap·원본 overrun은 변하지 않는다. DST23/25시간과 자정의 `[start,end)`를 사용한다.

### 실제 실행 검증·근거

- Web 전체64파일419 PASS(`.local/goal-web-regression.log`): 마지막 ACK/동의 응답 검증 보강 전의 전체 근거. 이후 직접 영향 최신14/14 PASS(`goal-draft-version-final.log`)·TypeScript/Vite build PASS(`goal-build-final3.log`). 중복 합산하지 않는다. 원격 CI는 게시 HEAD/시험 merge tree를 별도 확인한다.
- 신규 Server 순수8/8 및 fresh MySQL/TCP8/8 =16/16 PASS. `verify/.local/amvp-mysql-e2605f2e35d5/`의 tests.log/ownership/shutdown와 surefire XML. 계정/null/범위/멱등/동시성/rollback·UNKNOWN prefix·중첩·자정/DST·zone 변경/원본 보존·철회/version·불변 Snapshot/DB 재연결·실제 TCP cookie/CSRF/API를 검증했다. 회원/집중 원본/기존 RUNNING 분석 행은 SYNTHETIC fixture이며 Core 효과·실제 AI 실행 성공이 아니다.
- 이전 설정 영향 fresh MySQL17/17·계약6/6 PASS: `verify/.local/amvp-mysql-783201dd0b26/`. 시험 DB는 각각 정상 종료를 확인했다. 먼저 실패한 fixture 삽입/JSON roundtrip 비교와 UI412 안내 로그 및 실패 DB도 정상 종료·보존했다. 제품 실패 기록을 삭제/소급 생성하지 않는다.
- Figma 참조3053:30096/30100/10925의 코드·이미지를 재사용했다. 목표 카드/진행 표시는 실제 원본 확보, 숨김 편집 이미지 자체는 여전히 시각 근거 부족이다. 기존 테마/디자인 요소를 사용하고 격리 headless Chromium Light/Dark·편집/저장 렌더3개를 확인했다(`.local/goal-preview-*.png`, 합성 fetch). 정적 자산 추가0·페이지 오류0·수평 overflow 없음. 전체 Figma/실제 제품 시각 수용으로 승격하지 않는다.
- RC2 영향: 기존 `test_contract.py`155개 실행에서 legacy 검사1개가 Core10파일 subtest FAIL, 나머지154개 PASS. 10개 모두 통합3569911의 동일 byte임을 대조했다(`goal-legacy-baseline.json`); 신규 실패로 단정하지 않고 잠금/소스 보존. CREATE 세 추가 지점 제한 검사 PASS, api.ts·Core/Content·기존 migration의 이번 변경0. 이 상태를 '전체 계약 PASS'로 보고하지 않는다. 기본 Python 의존성 부족은 별도 로컬 venv에 기존 requirements.lock을 설치한 뒤 실제 검사로 확인했다.

### 남은 범위·11월11일 시연

- 목표 설정→실제 Server/격리 MySQL 저장/재조회·확인 구간 집계·Web 상태 연결은 구현/자동·격리 검증 완료. 실제 Core→인증 보고→목표 UI의 최신성/정상 END·복원·Chrome/MV3/Native 수용은 NOT_RUN이다. 기존 Core 출력 호환성만 확인하면 되며 목표 정책 재설계/새 actor를 요구하지 않는다.
- AI는 현재 동의/철회/미설정 거절 및 불변 입력 저장 기반까지다. 승인 고지/provider·전송 입력 형상·철회 대 dispatch 선형화와 이미 전송한 결과/보존/캐시 제공 의미가 없으므로 실제 provider/worker/새 동의 수락·분석 완료는 BLOCKED다. queued/retry/RUNNING 행을 삭제/임의 상태 전환해 경합을 숨기지 않는다.
- 기존 Core10파일 legacy 불일치 조정은 담당/통합 트랙의 별도 결정이다. 해당 파일/해시를 이 PR에서 수정하지 않는다. 독립 리뷰·승인·통합 전이며 Draft 해제/Approve/Merge 없음.
- 11월11일에는 승인된 격리 환경의 목표 편집·저장·재진입·확인량 표시·UNKNOWN/충돌·AI 비활성/철회 흐름을 시연 후보로 제공한다. 실제 Chrome 정책 수용/AI 분석 완료는 별도다. 기존 HOLD·Credential·다른 Worktree/PR·공유 staged 삭제1,036개 보존. `MVP_FINAL_COMPLETE=false`.


### PR81 게시 후 편집 revision 반례 수정

첫 게시 HEAD `fe0df35d14b120dcd7b683d47d48ece305f546ed` 후 독립 확인에서, 편집 중5초 조회가 다른 writer의 version을 반영하면 기존 초안을 새 version으로 조용히 저장할 수 있음을 재현했다. 신규 반례1 FAIL/기존13 PASS → 편집 시작 version 고정 후14/14 PASS. 명시 재조회 뒤에는 초안을 유지한 채 최신 version으로 저장할 수 있음을 기존412 시험에 추가했다. 백그라운드 조회는 편집 기준을 갱신하지 않는다. 서버/API/DB/AI/소유권 의미는 그대로다. 실패 로그 `.local/goal-draft-version-before.log`, 수정 후 `goal-draft-version-final.log`, 타입/빌드 `goal-build-final3.log`. 첫 SHA의 승인/CI를 후속 SHA로 소급하지 않으며 후속 Commit/Push 뒤 최신 CI를 별도 확인한다.
