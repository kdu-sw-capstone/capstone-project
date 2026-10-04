# FOCURVE 설계 통합본

필수·추가 MVP · Web·Server·Chrome Extension

항목별 Markdown 명세를 한 문서로 모은 열람본이다. 내용 수정은 항목별 원문에 반영한 뒤 HTML과 이 통합본을 함께 갱신한다. 설계도와 미리보기는 같은 폴더의 파일을 참조한다.

## 목차

- [FOCURVE 구현 전 설계 명세](#focurve-구현-전-설계-명세)
- [기능 범위·권한](#기능-범위권한)
- [IA 및 화면 상세 명세](#ia-및-화면-상세-명세)
- [동작·상태·계산 규칙](#동작상태계산-규칙)
- [API 및 시스템 연동](#api-및-시스템-연동)
- [데이터·이벤트·복구 계약](#데이터이벤트복구-계약)
- [기능별 설계 연결표](#기능별-설계-연결표)
- [검증 기준 — 실행 전 명세](#검증-기준--실행-전-명세)
- [설계 결정과 배포 설정](#설계-결정과-배포-설정)
- [구성별 책임 원문 보존](#구성별-책임-원문-보존)
- [개정 및 문서 연결 검수](#개정-및-문서-연결-검수)
- [설계도 · 요약 8페이지 / 상세 63페이지](#설계도)


---

# FOCURVE 구현 전 설계 명세

기준일 2026-10-04 · 문서 개정 1.4 · 적용 범위: 필수 MVP 및 추가 MVP의 Web·Server·Chrome Extension.

## 적용 기준

본 개정은 기존 기능 ID, 화면 ID, IA의 Web·Extension 구분, 기본 Task Flow 13개 및 3인 역할 분담을 계승한다. 기능을 삭제하거나 Desktop 범위를 이번 완료 기준에 포함하지 않는다. 사용자 확정 정책은 유지하고 비어 있던 입력 한계·상태·연동·집계·복구 기준은 본 개정의 설계 선택으로 구체화한다. 설계 선택은 사용자가 과거에 승인한 사실로 기록하지 않는다.

현재 적용 기준은 이 폴더의 본문과 현행 도면이다. 개정 전 문서·엑셀·도면은 `이전자료/원본보관_개정전.zip`에 원형 보존한다. 해당 ZIP의 미정 문구·이전 계약은 현행 구현 기준이 아니다. 현행 상세 도면 63페이지와 요약 도면 8페이지를 함께 제공한다. 이전 개별 도면은 이전자료/통합개정본_이전도면.zip에 보존한다. Figma 원본의 시각 배치 및 담당자 배정은 변경하지 않는다.

## 문서 구성

1. [기능 범위·권한](01_UX_기능설계/01_기능범위.md)
2. [IA·화면 명세](01_UX_기능설계/02_IA_화면명세.md)
3. [동작·상태·계산 규칙](01_UX_기능설계/03_동작규칙.md)
4. [API·시스템 연동](02_시스템_테크설계/04_API_연동.md)
5. [데이터·이벤트·복구](02_시스템_테크설계/05_데이터_복구.md)
6. [기능별 설계 연결표](04_검수_예시데이터/06_기능별_연결표.md)
7. [검증 시나리오](04_검수_예시데이터/07_검증기준.md)
8. [설계 결정·외부 설정](02_시스템_테크설계/08_설계결정.md)
9. [개정·문서 검수](04_검수_예시데이터/09_문서검수.md)

[Figma 복제본](https://www.figma.com/design/BeixHumD7TSoo9xMVzJkhO/FOCURVE_UI?node-id=144-768) · [상세 도면 미리보기](#상세-설계도-미리보기)

## 완료의 의미

문서 연결 검수는 구현·서비스 동작 테스트가 아니다. 모든 기능에 화면·동작·API 또는 로컬 처리·저장 구조·기대 결과를 지정한다. 실제 모델 정확도·서비스별 DOM 지원·성능·장애 복구는 이후 시험 대상으로 남긴다. OAuth 앱 자격증명, 배포 주소, 메일·AI 제공자 자격증명, 모델/목록 배포 체크섬은 환경 설정값이며 이 문서에 비밀을 넣지 않는다.

일정: 2027년 2월까지 개발을 목표로 하고 이후 종합 테스트·안정화를 진행한다. 개발 중 기능별·통합 테스트를 병행한다. 매일 작업을 전제하지 않으며 필수·추가 단계 완료는 검증 결과로 판정한다. PC 데스크톱은 현재 범위 밖이다.

## 현행 도면

- [상세 통합 설계 · 63페이지](#상세-설계도-미리보기)
- [설계도 요약 · 8페이지](#요약-설계도-미리보기)
- [도면 페이지 목록](#현행-도면-페이지-목록)

요약 도면은 주요 구조와 흐름을 축약한다. 생략된 예외·필드·관계는 상세 도면과 본문 명세를 따른다. 상세 도면과 요약 도면은 제공된 파일을 변경 없이 반영했다.


---

# 기능 범위·권한

## 실행 환경과 책임

설계 대상은 데스크톱 Chrome의 일반 프로필, HTTPS Web, Spring Boot Server, MySQL, Manifest V3 Extension이다. 최소 Chrome 120을 설계 기준으로 하며 최신 안정판도 검증 대상으로 지정한다. 시크릿·다른 브라우저·모바일·OS 앱 차단은 이번 완료 범위 밖이다. 사이트 내부 기능의 지원 범위는 아래 기능별로 제한한다.

Web은 계정 설정·실행 요청·기록 조회, Server는 인증·소유권·영속 저장·집계·분석 작업, Extension Core는 실제 정책 적용·해제·예약·로컬 저장, Content Control은 페이지 기능 감지·제어를 담당한다. 기존 3인 담당 배정은 변경하지 않는다.

## 회원·비회원

회원의 설정·기록은 Server가 기준이며 실행은 연결된 Extension 한 곳에서 수행한다. 계정당 종료되지 않은 세션 1개, 설치당 세션 1개다. Web만 열어서는 사이트를 제어할 수 없다. 비회원은 Extension 내부의 동일한 로컬 기능 화면을 사용하고 계정용 Web 대시보드는 열지 않는다.

설계 선택: 비회원도 사이트·내부 기능·키워드·성인 사이트·블러·예약·메모·일시정지·로컬 이용 시간·지표를 사용할 수 있다. 원격 AI 피드백은 회원에게 제공하며 비회원에는 로그인·자료 가져오기 경로를 표시한다. 로컬 통계는 외부 AI 분석인 것처럼 표시하지 않는다. 이 권한 구분은 새로운 기능 추가가 아니라 기존 기능의 실행 위치를 명시한 것이다.

이메일 회원가입·로그인, Google·카카오 로그인을 지원한다. 소셜 최초 인증은 서비스 가입 확인 후 계정을 생성하고 이후 같은 provider+subject로 로그인한다. 이메일만 같은 계정은 자동 병합하지 않는다. 연결은 기존 계정 재인증과 새 제공자 인증을 모두 요구한다. 소셜 이메일 미제공도 provider+subject로 처리한다.

## 보존할 확정 동작

- 로그아웃: 현재 회원 집중 종료·해제 확인 후 회원 연결·웹 인증 종료, 비회원 전환. Extension은 계속 동작하고 회원 자료·전송 대기는 보존한다.
- 시작 확인 중: 별도 취소 버튼 없음. 실패는 부분 적용 정리와 상태 재확인으로 처리한다.
- 일시정지: 해당 세션 제한 해제·세션 수집 중단·정지 시간 제외. 재개는 같은 스냅샷 적용.
- 설정 변경: 진행 중 스냅샷은 고정, 다음 세션부터 반영.
- 예약: 기존 세션 우선, 고정 종료 시각, 남은 구간만 실행, 지난 구간 소급 실행 없음.
- 비회원: 종료 후 30×24시간 기록 보관. 설정 별도 유지. 가져오기 성공 원본도 원래 만료일까지 보존.
- 회원: 로그아웃·비회원 만료 규칙 때문에 회원 자료를 삭제하지 않음.
- AI: 집계에 기반한 설명·설정 제안, 사용자 확인 없는 변경 없음.
- 블러: 클릭하면 보기, 다시 클릭하면 가림. 자동 재가림 타이머 없음.

## 기능 목록

OPTION은 기존 식별자이며 선택 구현을 뜻하지 않는다. 역할 열은 원본 기능 목록의 배정을 유지한다. 비회원 실행을 포함한 영역별 세부 책임은 위 책임 정의와 연결표에 따른다.
| 기능 ID | 단계 | 기능 | 기존 화면 | 원본 담당 영역 |
|---|---|---|---|---|
| AUTH-01 | 필수 | 회원가입 | SIGNUP-01 | Web·Server |
| AUTH-02 | 필수 | 로그인 | LOGIN-01 | Web·Server |
| AUTH-03 | 필수 | 로그아웃 | SETTING-01 | Web·Server |
| DASH-01 | 필수 | 집중 현황 조회 | DASH-01 | Web·Server |
| SITE-01 | 필수 | 사이트 목록 조회 | SITE-01 | Web·Server |
| SITE-02 | 필수 | 사이트 등록 | SITE-02 | Web·Server |
| SITE-03 | 필수 | 사이트 수정 | SITE-02 | Web·Server |
| SITE-04 | 필수 | 사이트 삭제 | SITE-01 | Web·Server |
| SITE-05 | 필수 | 사이트 분류 | SITE-02 | Web·Server |
| POLICY-01 | 필수 | 차단 정책 설정 | SITE-02 | Web·Server·Extension |
| POLICY-02 | 필수 | 기록 정책 설정 | SITE-02 | Web·Server·Extension |
| POLICY-03 | 필수 | 유튜브 쇼츠 차단 | SITE-02 | Web·Server·Extension |
| SESSION-01 | 필수 | 세션 시작 | SESSION-01 | 전체 |
| SESSION-02 | 필수 | 세션 종료 | SESSION-01 | 전체 |
| SESSION-03 | 필수 | 세션 상태 확인 | SESSION-01 | Web·Extension |
| SESSION-04 | 필수 | 사이트 전체 차단 적용 | SESSION-01 | Server·Extension |
| EVENT-01 | 필수 | 차단 사이트 접근 기록 | LOG-01 | Extension·Server |
| EVENT-02 | 필수 | 기록 대상 접근 저장 | LOG-01 | Extension·Server |
| EVENT-03 | 필수 | 내부 기능 접근 기록 | LOG-01 | Extension·Server |
| EVENT-04 | 필수 | 반복 접근 구분 | LOG-01 | Server |
| LOG-01 | 필수 | 기록 목록 조회 | LOG-01 | Web·Server |
| LOG-02 | 필수 | 기록 상세 조회 | LOG-02 | Web·Server |
| STAT-01 | 필수 | 기본 통계 조회 | STAT-01 | Web·Server |
| STAT-02 | 필수 | 사이트별 통계 | STAT-01 | Web·Server |
| SETTING-01 | 필수 | 정책 조정 | SITE-02, STAT-01, LOG-02 | Web·Server |
| EXT-01 | 필수 | 정책 동기화 | EXT-01 | Server·Extension |
| EXT-02 | 필수 | 접근 제한 적용 | EXT-01 | Extension |
| EXT-03 | 필수 | 이벤트 전송 | EXT-01 | Extension·Server |
| OPTION-01 | 추가 | 추천 콘텐츠 제한 | FEATURE-01 | Web·Server·Extension |
| OPTION-02 | 추가 | 댓글 제한 | FEATURE-01 | Web·Server·Extension |
| OPTION-03 | 추가 | 자동재생 제한 | FEATURE-01 | Web·Server·Extension |
| OPTION-04 | 추가 | 집중 예약 | SCHEDULE-01 | Web·Server·Extension |
| SETTING-02 | 필수 | 화면 모드 전환 | SETTING-01 | Web |
| OPTION-05 | 추가 | 지원 서비스 확대 | FEATURE-01 | Web·Server·Extension |
| OPTION-06 | 추가 | 사이트 이용 시간 | ANALYSIS-01 | Web·Server·Extension |
| OPTION-07 | 추가 | 행동 기반 지표 | ANALYSIS-01 | Web·Server·Extension |
| OPTION-08 | 추가 | 시간대별 패턴·확장 분석 | STAT-01, ANALYSIS-01 | Web·Server·Extension |
| OPTION-09 | 추가 | 키워드 제한 | KEYWORD-01 | Web·Server·Extension |
| OPTION-10 | 추가 | 성인 사이트 제한 | SAFETY-01 | Web·Server·Extension |
| OPTION-11 | 추가 | 민감 이미지 블러 | BLUR-01 | Web·Server·Extension |
| OPTION-12 | 추가 | 행동 기반 AI 피드백 | ANALYSIS-01 | Web·Server·Extension |
| SESSION-05 | 추가 | 일시정지·재개 | SESSION-01 | Web·Server·Extension |
| SESSION-06 | 추가 | 세션 메모 | SESSION-01 | Web·Server·Extension |
| AUTH-04 | 필수 | 로그인 없이 시작 | EXT-01 | Extension |
| AUTH-05 | 필수 | 소셜 로그인 | LOGIN-01, SIGNUP-01, EXT-01 | Web·Server·Extension |
| IMPORT-01 | 필수 | 가져올 자료 선택 | EXT-01, SETTING-01 | Web·Extension·Server |
| IMPORT-02 | 필수 | 가져오기 처리·복구 | EXT-01 | Web·Extension·Server |


---

# IA 및 화면 상세 명세

## 화면 구조

기존 Web·인증 화면·로그인 후 메뉴·Extension 구조를 유지한다. 사이트 관리 아래 SITE-01/02 및 FEATURE-01·KEYWORD-01·SAFETY-01·BLUR-01, 통계 아래 ANALYSIS-01, 로그인 후 메뉴 아래 SCHEDULE-01을 통합한다. SESSION-05/06은 별도 페이지가 아니라 SESSION-01 내부 기능 ID다. EXT-01의 로컬 상세 화면도 같은 화면 명세를 재사용하되 소유 구분과 저장 경로를 달리한다.

## 공통 화면 계약

입력은 필드 라벨·검증 메시지·키보드 접근을 제공한다. 저장 중 제출을 잠그되 입력을 지우지 않는다. 서버 결과를 모르는 경우 '저장 확인 중'으로 표시하고 동일 요청 식별자로 조회한다. 결과 확인 전 새 성공 메시지를 만들지 않는다. 버전 충돌은 최신 값과 편집값을 보여주고 다시 저장 여부를 선택하게 한다. 오류 후 화면 이동은 사용자가 선택한다.

목록은 로딩/빈 상태/오류/부분 수집을 분리한다. API의 code로 분기하며 내부 오류·인증 비밀을 노출하지 않는다. 설정 저장 성공과 실행 정책 적용 성공은 별도 상태다. 현재 세션은 저장된 최신 설정 대신 시작 시 스냅샷을 표시한다. 테마 설정은 이 예외로 즉시 적용된다.

세션 종료·자료 삭제 확인은 해당 동작의 영향만 설명한다. 시작 전 별도 안내 팝업이나 취소 버튼을 신설하지 않는다. 입력/화면 배치는 기존 Figma를 유지하고 누락된 상태·전용 화면의 구조만 이 명세로 보완한다.

## 화면별 계약
| 화면 ID | 화면 | 입력·표시 | 버튼·이동·완료 | 오류·경계 | 저장·조회 |
|---|---|---|---|---|---|
| SIGNUP-01 | 회원가입 | 이메일(254자), 비밀번호(12~128자), 확인 입력, 표시명(1~40자), 필수 약관 버전 | 가입→이메일 확인; Google·카카오→인증·가입 확인 | 인증 메일 전송 대기·중복·만료; 비밀번호 로그 금지 | users/auth_identities/auth_challenges |
| LOGIN-01 | 로그인 | 이메일·비밀번호; Google·카카오; 비밀번호 재설정 | 인증 후 Web 직접 진입은 DASH-01, 확장 진입은 EXT-01 | 실패는 계정 유무를 노출하지 않는 문구; 취소 시 원래 화면 | auth_identities/web_sessions |
| DASH-01 | 대시보드 | 오늘·최근 세션·접근·반복·기록 상태 | 현재 세션→SESSION-01; 최근 기록→LOG-02; 분석→ANALYSIS-01 | 조회 실패와 0건 구분, 수신 기준 시각·누락 여부 표시 | focus_sessions/access_events |
| SITE-01 | 사이트 목록 | 이름·도메인·분류·정책, 추가·수정·삭제 | 추가/수정→SITE-02; 삭제 확인 후 목록 갱신 | 빈 목록에 추가 버튼; 삭제 실패 시 행 유지 | sites |
| SITE-02 | 사이트 등록·수정 | http/https URL 또는 host≤2048자; 이름1~100자; 하위도메인; 집중·방해·일반; 허용·차단·기록; Shorts | 검증→저장→SITE-01; 내부 기능→FEATURE-01 | 중복 범위→기존 수정 안내; 입력 보존; 현재 세션에 즉시 적용 안 함 | sites/site_feature_policies |
| SESSION-01 | 집중 세션 | 1~180분 정수; 실행 설치; 현재 정책; 시작·종료·일시정지·재개; 메모≤2000자 | 시작 확인→진행; 정지·재개는 실제 적용 결과 후 표시; 종료→결과 | 중복 요청 비활성; 시작 취소 없음; 연결 미확인·저장 대기 구분 | focus_sessions/session_intervals/session_notes |
| LOG-01 | 행동 기록 목록 | 기간·세션·사이트·유형 필터; 최신순 20건 | 행 선택→LOG-02; 필터 변경 시 커서 초기화 | 0건/미수집/동기화 대기/오류를 구별 | access_events |
| LOG-02 | 행동 기록 상세 | 시각·대상·원인·반복 여부·당시 정책 | 목록 복귀; 현재 설정으로 이동 | 삭제된 사이트도 당시 스냅샷 표시 | access_events/policy_snapshots |
| STAT-01 | 기본 통계 | 기간 기본 최근7일 최대366일; 접근·반복·확인된 집중 시간 | 대상→기록/설정; 확장 분석→ANALYSIS-01 | 분모0은 비율 없음; 추정 시간은 별도 | access_events/session_intervals |
| SETTING-01 | 설정 | 라이트/다크; 계정·연결 정보; 로그아웃; 가져오기 | 테마 즉시 적용·로컬 저장; 로그아웃은 확정 순서 실행 | 첫 방문 라이트; 저장 실패 안내; 회원 자료 삭제 동작으로 오인 금지 | 로컬 theme/web_sessions/extension_installations |
| EXT-01 | 확장 팝업 | 첫 진입/회원/비회원/가져오기; 세션·연결·전송 상태 | 상세 설정은 확장 내부 전체 페이지에서 같은 화면 ID 재사용; 회원 관리→Web | 소유자 전환 중 이전 계정 자료 숨김; 원격 AI는 회원 안내 | 로컬 stores/execution_commands |
| EXT-02 | 차단 안내 | 등록 대상·적용 이유·집중 상태; 돌아가기 | 이전 허용 페이지 또는 팝업으로 이동 | 안내 자체 새로고침을 새 접근으로 기록하지 않음 | policy_snapshots/access_events |
| FEATURE-01 | 내부 기능 설정 | YouTube Shorts·추천·댓글·자동재생; Instagram Reels·추천 피드 on/off | 사이트별 저장→다음 세션; 전체 차단 우선 표시 | 미지원 host 저장 차단; 기능 적용 실패는 성공으로 표시하지 않음 | site_feature_policies |
| KEYWORD-01 | 키워드 제한 | 키워드1~80자 최대200개; 제목/주소/본문 범위; 예외 host≤500 | 추가·수정·삭제→원자 저장 | 중복 정규화 오류; 입력 유지; 본문 전체가 서버로 전송되지 않음 | content_policies |
| SAFETY-01 | 성인 사이트 제한 | 활성화; 목록 버전·갱신 시각; 사용자 도메인·예외≤500 | 저장→다음 세션; 목록 실패 시 기존 버전 유지 | 유효 목록 없으면 해당 기능 사용 불가 안내; 오탐은 예외 편집 | content_policies/catalog_versions |
| BLUR-01 | 민감 이미지 블러 | 활성화; 민감도 낮음/보통/높음; 가림 강도 약/중/강; 로컬 처리 안내 | 저장→다음 세션; 페이지 이미지 클릭 보기/재클릭 가리기 | 판정 대기/실패 가림 표시; 미지원 안내; 보기 상태는 해당 이미지 수명만 | content_policies/model_profiles |
| SCHEDULE-01 | 집중 예약 | 이름1~80자; 요일1~7; 시작 HH:mm; 1~180분; 시간대; 설치; 활성화 | 목록→등록·수정·삭제; 실행 결과 펼침 | 충돌 예상 안내는 저장 금지 아님; 기존 세션 우선; 결과 이유 표시 | schedules/schedule_occurrences |
| ANALYSIS-01 | 확장 분석·AI 피드백 | 기간·사이트; 이용 시간·반복 비율·시간대; AI 분석 요청; 이용 시간 수집 on/off(다음 세션) | 근거→LOG-01; 제안→해당 설정 편집→사용자 저장 | 로딩·데이터 부족·부분 수집·AI실패; 기존 결과 보존 | usage_segments/analysis_jobs/analysis_results/content_policies |

## 추가 전용 화면의 구성

SAFETY-01: 상단 제목·활성화, 중앙 목록 버전/상태, 사용자 도메인 목록, 예외 목록, 하단 저장. BLUR-01: 상단 활성화, 민감도 선택, 가림 강도 미리보기, 처리 위치 설명, 하단 저장. SCHEDULE-01: 목록 카드에 요일·구간·시간대·실행 설치·활성화, 편집 패널에 동일 항목, 결과 패널에 실행/대기/건너뜀 이유. ANALYSIS-01: 기간 필터, 수집 상태, 이용 시간, 반복 비율, 시간대 차트, AI 피드백 순서. 새 화면 구조도는 와이어프레임 페이지에 제공한다.

## 추가 기능의 회원·비회원 표시

회원은 Web에서 관리하고 EXT-01에서 실행 상태를 본다. 비회원은 확장 내부 페이지에서 같은 입력과 로컬 결과를 본다. AI 패널만 계정 필요로 표시하며 로그인만으로 로컬 자료를 전송하지 않는다. 계정으로 가져온 기록만 회원 AI 집계에 사용한다.


---

# 동작·상태·계산 규칙

## 기본 흐름 유지와 추가 연결

TF-01 사이트 등록, TF-02 수정, TF-03 삭제, TF-04 분류·관리 정책, TF-05 회원 시작, TF-06 비회원 시작, TF-07 종료, TF-08 접근 제어·기록, TF-09 기록 조회, TF-10 통계·다음 설정, TF-11 가져오기, TF-12 인증·연결, TF-13 로그아웃을 유지한다. TF-04→TF-A01/04/05/06, TF-07→TF-A09, TF-08→TF-A01/04/05/06, TF-10→TF-A03/07, TF-11→추가 설정·완료 세션의 구간·메모·이용 시간 가져오기를 연결한다.

User Flow 집중 전에는 추가 설정·예약 경로, 집중 중에는 정지·재개와 제한·블러, 집중 후에는 메모·확장 분석·AI·다음 설정, 계정 연결에는 추가 자료 선택을 보완한다. 큰 흐름은 User Flow, 예외 분기는 Task Flow, 실제 실행 순서는 연동 도면이 담당한다.

## 세션 상태

STARTING→RUNNING은 실제 정책 적용 확인 후만 가능하다. 실패 시 RELEASE를 실행하고 해제 확인 후 START_FAILED, 확인 불가면 UNKNOWN이다. 사용자 CANCEL 상태나 API는 만들지 않는다.

RUNNING→PAUSING→PAUSED→RESUMING→RUNNING. PAUSING 해제 미확인은 PAUSING 또는 UNKNOWN을 유지한다. RESUMING 실패 후 잔여 정책 정리 확인 시 PAUSED. RUNNING/PAUSING/PAUSED/RESUMING→ENDING→ENDED. ENDING이 다른 동작보다 우선하며 뒤늦은 적용 보고는 종료를 되돌리지 않는다. 모든 미종료 상태는 활성 잠금을 유지한다. 서버 응답이 없더라도 로컬 종료·정지는 가능하고 결과를 원래 소유자 journal에 남긴다.

수동 세션 시간은 확인된 RUN 구간의 합이다. 일시정지 동안 남은 시간은 고정되고 재개 시 예정 종료=재개 확인 시각+남은 시간. 예약은 정지해도 원래 종료 시각을 유지한다. 해제 처리 중 시간은 실제 해제 확인까지 누적하되 목표 시간을 넘는 지연은 overrun_ms로 분리한다. 시스템 중단으로 끝을 알 수 없는 구간은 마지막 확인까지만 확정하고 미확인 구간은 집중 시간에서 제외하여 부분 기록으로 표시한다.

service worker만 재시작되면 저장 journal과 실제 정책을 대조해 이어간다. 브라우저 전체 재시작에서는 이전 수동 세션을 자동 재개하지 않고 잔여 규칙 정리 후 INTERRUPTED로 종료한다. 예약은 미실행 발생 건에 한해 잔여 구간을 평가한다. 이미 실행된 예약 발생 건을 재실행하지 않는다.

## 예약 규칙

시간대는 IANA 값, 기본 Asia/Seoul. 요일과 현지 시작 시각으로 발생 건을 만들며 duration 1~180분을 더해 종료를 계산한다. 저장된 예약 시간대는 OS 변경으로 바뀌지 않는다. DST로 없는 시각은 status=SKIPPED, reason=NONEXISTENT_TIME, 두 번 존재하는 시각은 첫 번째 시각 1회만 실행한다. 발생 키=(schedule_id, 예정 시작 UTC). 수정은 미시작 발생 건만 새 버전에 재계산하며 실행 중 스냅샷·종료 시각은 유지한다. 삭제도 이미 실행된 세션을 끝내지 않는다.

진행·정지 세션이 있으면 WAITING_CONFLICT. 세션 종료 또는 복구 후 현재 시각을 다시 판단한다. 여러 예약의 잔여 구간이 겹치면 예정 시작 오름차순→생성 시각→ID 순으로 하나 선택한다. [start,end)에서만 실행 가능, 만료하면 status=SKIPPED, reason=EXPIRED. 사용자가 직접 끝낸 예약은 같은 발생 건을 다시 시작하지 않는다. 브라우저 미실행·절전 중 정시 시작을 보장하지 않으며 다시 실행될 때 잔여 구간을 확인한다.

## 제한 우선순위·지원 범위

소유/세션 확인→직접 등록한 사이트 전체 BLOCK→성인 도메인 제한→키워드 페이지 제한→내부 기능 제한→RECORD→ALLOW 순서다. 한 navigation_id+target_key의 접근은 가장 우선한 차단 이유 한 건만 기록한다. 도메인 예외는 성인 목록에만, 키워드 예외는 키워드에만 적용한다. 이미지 블러는 허용된 페이지의 독립 표시 기능으로 동작하며 이미지 개수를 접근 횟수에 합산하지 않는다.

YouTube: 일반 웹의 Shorts 진입, 홈·관련 추천 영역, watch 댓글 영역, 다음 영상 자동재생. Instagram: 웹 Reels 경로·뷰어, 추천 게시물 영역. 사용자의 수동 영상 재생·일반 팔로잉 피드를 통째로 막지 않는다. 자동재생 제한은 다음 영상의 자동 전환을 뜻하며 모든 video autoplay 속성을 일괄 제거하지 않는다. 초기 로드·SPA 이동·새 DOM에서 재적용하고 정지/종료 시 해당 adapter가 변경한 스타일·속성만 복원한다. 서비스 변경으로 감지 불가면 capability=FAILED를 표시하며 동작했다고 기록하지 않는다.

키워드는 Unicode NFKC+대소문자 무시 부분 일치, 정규식 없음. URL은 디코딩 가능한 경로/쿼리를 로컬에서 1회 디코딩하며 실패 시 원문 비교; 비밀번호 입력·form 입력·contenteditable은 검사 제외. 본문은 표시 텍스트, 한 문서 200,000자와 변경 영역 단위, 500ms debounce. 제목·URL·본문을 각각 선택한다. 미지원 프레임·닫힌 shadow DOM·브라우저 내부 페이지는 검사 불가 상태이며 안전 판정하지 않는다. 매칭 원문·전체 URL·키워드 내용은 서버 접근 이벤트에 싣지 않는다.

블러는 학습된 NSFW 분류기 adapter를 로컬에서 실행한다. 모델/가중치는 확장 패키지에 고정 버전으로 포함하고 이미지 원본은 외부 전송하지 않는다. jpg/png/webp의 접근 가능한 정적 img를 1차 지원하고 GIF는 정지 프레임만 분석한다. 동영상·canvas·CSS 배경·읽을 수 없는 cross-origin 픽셀은 미지원 표시 대상이다. 이미지를 읽기 위한 서버 프록시는 두지 않는다. visible 영역 우선, 동시 분석 1개, 최대 대기 100개, 제한 초과는 미분석 상태로 남긴다.

분류 점수 max(Porn,Hentai)를 기준으로 낮음 0.85/보통0.70/높음0.50을 초기 설계값으로 사용한다. Sexy만 높은 경우에는 자동 가리지 않는다. 임시 가림 후 판단하며 실패는 가림+재시도/보기 안내를 유지한다. 강도는 CSS blur 8/16/24px(중 기본)이며 완전 차폐를 보장하는 값으로 설명하지 않는다. 클릭 보기는 요소+이미지 fingerprint 단위, 재클릭 즉시 가림, 내용 교체/새 페이지/새 세션은 초기화한다. 이 수치는 실측된 정확도·성능 결과가 아니다.

## 수집·집계

접근 이벤트는 RUNNING 중 명시적 새 탐색·지원 기능 진입만 수집한다. 차단 안내 새로고침·정책 최초 적용·단순 렌더·추천/댓글 영역 숨김 자체는 접근이 아니다. 동일 세션·대상에서 access_seq 순서의 첫 유효 접근을 제외한 나머지가 반복이다. 전체3/반복2이며 합산하지 않는다. 순번 공백은 잠정 집계로 표시한다.

이용 시간은 별도 usage segment다. 기본 수집 범위는 집중 RUNNING 중 등록된 사이트의 활성 탭이며, 포커스 있는 Chrome 창·유휴60초 미만·허용 페이지를 모두 만족해야 한다. 한 설치에서 동시에 하나만 수집한다. 정지·탭 전환·창 포커스 상실·유휴·종료에 구간을 닫는다. 5초마다 체크포인트, 불명 구간은 추정해 채우지 않는다. 집중 시간과 사이트 이용 시간은 다른 값이다.

반복 비율=반복/전체×100, 차단 비율=차단 접근/전체×100, 사이트 이용 비중=사이트 확인 시간/전체 확인 이용 시간×100. 분모0은 null+NO_DATA. 소수1자리 반올림은 표시에서만 수행한다. 시간대·일자 경계는 Asia/Seoul로 구간 분할하며 [from,to)로 집계한다. 지연 수신은 원래 발생 시각 구간을 갱신한다. 기본 기간 최근7일, 최대366일. 측정이 정상이고 접근이 없을 때만 0회, 미수집/전송대기는 null 또는 부분 표기다. 근거 없는 집중 점수·중독 판정은 만들지 않는다.

## AI 입력·출력

회원이 요청한 기간의 사이트별 접근·반복·확인 이용 시간·시간대 분포·확인 집중 구간·적용 설정을 집계해 제공한다. 사이트는 가명 key로 치환하고 결과를 Web에서 이름에 대응한다. 페이지 원문·이미지·키워드 원문·세션 메모·이메일·전체 URL은 제외한다. 개인 모델 재학습을 뜻하지 않는다.

기본 생성 조건은 완료 세션 3개 이상·확인 RUN 시간 합계30분 이상. 접근0도 유효한 자료이며 수집이 불완전하면 한계를 표시한다. AI는 metric_id·수치·기간을 근거로 최대5개 관찰/3개 제안과 설정 화면 ID를 반환한다. 서버가 근거 ID와 수치를 확인하고 불일치 출력은 실패 처리한다. 외부 adapter 사용 전 제공자·전송 항목 안내와 동의를 받는다. 동의 철회 이후 신규 전송 금지. 요청 타임아웃60초, 자동 재시도1회, 24시간 동일 데이터·기간·모델 버전의 결과 재사용. 기존 결과·원본 기록은 생성 실패로 삭제하지 않는다.

## 추가 Task Flow
| 흐름 | 기능 | 정상 처리 | 예외·복구 |
|---|---|---|---|
| TF-A01 | 내부 기능 제한 | 사이트·지원 기능 확인 → 토글 설정·저장 → 다음 세션 스냅샷 생성 → 페이지 기능 감지·제한 → 결과 표시·종료 시 복원 | 미지원 대상은 저장 거절. DOM 변경으로 실행 실패 시 해당 기능 실패 표시, 전체 차단 성공으로 대체하지 않음. |
| TF-A02 | 집중 예약 | 요일·시간·설치 저장 → 예약 발생 건 생성 → 구간·현재 세션 확인 → 남은 구간 정책 적용 → 고정 종료·결과 저장 | 기존 세션은 유지. 종료 전 잔여 구간이면 재평가, 종료 시각 이상이면 건너뜀. 중복 발생 건은 같은 결과 반환. |
| TF-A03 | 이용 시간·확장 분석 | 기간·사이트 선택 → 확인된 기록 조회 → 구간 분할·합산 → 지표·시간대 표시 → 관련 기록·설정 이동 | 분모0·미수집·부분 전송·오류 분리. 지연 이벤트 수신 시 재집계하며 기준 시각 표시. |
| TF-A04 | 키워드 제한 | 키워드·검사 범위 입력 → 예외·중복 검증 → 다음 세션에 적용 → 새 문서·변경 영역 검사 → 페이지 제한·사유 표시 | 예외는 키워드 판정에만 적용. 검사 불가·길이 상한은 미검사 표시. 원문을 서버에 전송하지 않음. |
| TF-A05 | 성인 사이트 제한 | 목록·예외 설정 → 유효 목록 확보 → 다음 세션에 적용 → 도메인 규칙 판정 → 제한 또는 허용 | 갱신 실패 시 마지막 검증 목록. 최초 목록 없음은 기능 불가. 예외가 사용자 직접 전체 차단을 해제하지 않음. |
| TF-A06 | 민감 이미지 블러 | 이미지 발견·임시 가림 → 로컬 모델 분석 → 임계값 비교 → 블러 또는 정상 표시 → 클릭 보기·재클릭 가림 | 분석 실패는 안전 판정 아님. 재시도 또는 보기 선택. 이미지 URL/내용 교체 시 이전 보기 상태 초기화. |
| TF-A07 | AI 피드백 | 기간·전송 항목 확인 → 동의·분석 요청 → 집계 스냅샷 생성 → 근거 포함 결과 표시 → 사용자 설정 편집·저장 | 자료 부족은 생성 안 함. 실패 시 기존 결과 유지. 모델 출력은 명령이 아니며 자동 적용 금지. |
| TF-A08 | 일시정지·재개 | 진행 중 정지 요청 → 제한 해제 확인 → 정지·시간 누적 중단 → 같은 정책 재적용 → 확인 후 진행 재개 | 해제 미확인은 정지 완료 아님. 재개 실패는 잔여 규칙 제거 후 정지 복귀. 종료 의도가 재개보다 우선. |
| TF-A09 | 세션 메모 | 소유 세션 선택 → 메모 입력·수정 → 저장 요청 → 저장 결과 확인 → 세션 결과에서 조회 | 실패 시 입력 유지. 버전 충돌은 최신 메모와 편집본 유지. 빈 문자열 저장은 메모 비우기. |


## 도면과 상태 계약의 대응

- TF-S는 설정 저장 결과의 공통 확인 흐름이다. 설정 저장 완료와 브라우저 정책 적용 완료를 구분한다.
- 13-R은 세션 실패·결과 미확인의 복구 흐름이다. UNKNOWN에서 실제 적용/해제를 대조하고 확인된 상태로 복구한다. 결과 미확인을 실패로 단정하지 않는다.
- 16 예약 상태의 SKIPPED는 실행을 시작하지 못한 발생 건이다. 만료는 status=SKIPPED, reason=EXPIRED로 기록한다. DST의 존재하지 않는 시각은 status=SKIPPED, reason=NONEXISTENT_TIME으로 구분한다.
- 예약 시작 적용이 미확인이면 같은 발생 건과 세션을 재확인한다. 새 발생 건이나 새 세션을 중복 생성하지 않는다. 시작한 세션의 실패·종료는 세션 복구 흐름을 따르며 해제 확인 전에 종결하지 않는다.
- 요약 도면에 없는 전이와 예외가 삭제된 것은 아니다. 상세 상태도와 본문의 동일 상태 정의를 적용한다.


---

# API 및 시스템 연동

## 공통 계약

기존 /api/v1 경로·기본 식별자 체계를 유지한다. 기능/화면 ID와 API ID는 별개다. 여기의 API- 접두어는 문서상의 구분이며 URL 일부가 아니다. JSON UTF-8, snake_case. 내부 bigint는 십진 문자열, 외부 세션·이벤트·설치·작업은 UUID. 시각은 UTC RFC3339, 기간은 ms 정수, 화면 집계 기본 Asia/Seoul이다.

W=Web HttpOnly Secure SameSite=Lax 쿠키, 변경 요청 CSRF+Origin 검증. E=소유 계정·설치에 결박된 Bearer. I=설치 증명, 회원 데이터 접근 불가. 소유자는 body user_id로 결정하지 않는다. 타 계정 자원은 404, 설치 불일치는403. 모든 자료 조회·변경은 계정과 설치 관계를 확인한다.

생성·명령·전송에는 Idempotency-Key UUID. 인증 로그인·OAuth 리다이렉트·단회 토큰 소비는 별도 challenge 식별자로 재사용을 막는다. 같은 주체+method+path+key/본문은 같은 결과, 다른 본문은409. 수정·삭제는 If-Match version, 누락428/불일치412. 같은 멱등 요청의 재전송은 version 검사보다 먼저 기존 결과를 반환한다. 멱등 캐시7일, 이벤트/원본/예약 고유 제약은 별도 영속 유지. POST 결과 미확인은 같은 키로 재요청하며 새 요청으로 간주하지 않는다.

목록 {items,next_cursor,has_more}, limit기본20/최대100. from_date/to_date 양 끝 날짜 포함 최대366일. 조회는 200, 생성201, 실행 요청202+operation_id, 삭제204. 202를 실제 적용 성공으로 표시하지 않는다. 자원 변경 응답에는 ETag를 포함한다. 오류={error:{code,message,field_errors:[{field,reason}],retryable},request_id}. 429/503은 Retry-After, 통신 재시도1/2/4/8/16/30초+지터. 422는 입력 수정 전 자동 재시도 금지.

## 객체 명세

표에서 ?는 선택/null, 그 외 필수다. 목록 응답의 시간·수치 null은 미확인이고 0과 다르다.
| 객체 | 필드·형식 |
|---|---|
| User | user_id:string, display_name:string, email:string?, email_verified:boolean, providers:[EMAIL,GOOGLE,KAKAO] |
| SiteWrite | url:string≤2048, display_name:1..100, include_subdomains:boolean=true, purpose:FOCUS/DISTRACTION/GENERAL, access_policy:ALLOW/BLOCK/RECORD, feature_policies:[{feature_code,enabled}] |
| Site | site_id:string, canonical_host:string, SiteWrite 중 url 제외, version:int≥1,created_at,updated_at,deleted_at? |
| ContentPolicyWrite | keywords:{enabled,rules:[{id UUID,text1..80,scopes:[TITLE/URL/BODY]}],exceptions:[Host]},adult_domains:{enabled,custom_hosts:[Host],exceptions:[Host]},image_blur:{enabled,sensitivity:LOW/MEDIUM/HIGH,strength:LOW/MEDIUM/HIGH},usage_tracking:{enabled} |
| Host | host:소문자 IDNA 정규화≤253,include_subdomains:boolean. 각 목록≤500. 키워드≤200. |
| ContentPolicy | ContentPolicyWrite + version:int,updated_at |
| Snapshot | policy_snapshot_id UUID,format_version=1.1,owner_user_id?,executor_id,created_at,sites:[Site],content_policy,catalog_version?,model_profile_version?,source_version |
| Session | session_id UUID,executor_id UUID,policy_snapshot_id UUID,origin:MEMBER/GUEST_IMPORT,source:MANUAL/SCHEDULE,execution_status,record_status:PENDING/PARTIAL/COMPLETE/REVIEW_REQUIRED,duration_minutes,active_duration_ms,overrun_ms,remaining_ms,started_at?,planned_end_at?,ended_at?,policy_released_at?,end_reason?,version,desired_revision,last_error_code? |
| Command | command_id UUID,session_id,executor_id,type:APPLY_POLICY/RELEASE_POLICY,desired_revision,snapshot?,reason,created_at,execute_before? |
| ExecutionReport | report_id UUID,command_id?,session_id,executor_id,desired_revision,result:APPLIED/RELEASED/FAILED/UNCONFIRMED,observed_at,error_code?,rollback_confirmed?,intervals:[Interval],local_action_seq? |
| Interval | interval_id UUID,kind:RUN/PAUSE,start_at,end_at?,duration_ms?,quality:CONFIRMED/UNCONFIRMED; RUN 종료는 실제 해제 시각 |
| Note | session_id,text:0..2000,version:int≥0,updated_at? |
| Access | event_id,session_id,executor_id,occurred_at,event_type,target_kind,target_host,feature_code?,target_key,access_seq,target_access_index,is_repeat,policy_snapshot_id,quality |
| Metrics | total_access,repeat_access,blocked_access,active_duration_ms,repeat_ratio?,quality:COMPLETE/PARTIAL/NO_DATA/NOT_COLLECTED,as_of; TargetMetrics는 host 추가 |
| ScheduleWrite | name:1..80,weekdays:서로다른1..7배열,start_local:HH:mm,duration_minutes:1..180,timezone:IANA,executor_id UUID,enabled:boolean |
| Schedule | schedule_id UUID,ScheduleWrite,version,created_at,updated_at,deleted_at? |
| Occurrence | occurrence_id UUID,schedule_id,scheduled_start_at,scheduled_end_at,status:PENDING/WAITING_CONFLICT/STARTING/RUNNING/FINISHED/SKIPPED,reason?,session_id?,schedule_version |
| AnalysisJob | job_id UUID,from_date,to_date,status:QUEUED/RUNNING/SUCCEEDED/FAILED/INSUFFICIENT_DATA,input_hash,as_of,model_version?,result?,error_code?,created_at |
| Result | observations:[{text,metric_ids[]}],suggestions:[{text,screen_id,metric_ids[]}],limitations:string[],metrics:[{metric_id,value,unit}],generated_at |
| ImportItem | type:SITE/CONTENT_POLICY/SCHEDULE/SESSION,source_item_id UUID,source_hash,payload. SESSION payload는 snapshot,session,events,intervals,usage_segments,note를 포함; 완료 세션만 |
| ImportBatch | batch_id UUID,status:PENDING/PROCESSING/SUCCEEDED/PARTIAL/FAILED,items:[{source_item_id,status,result_id?,error_code?}],created_at,completed_at? |
| Capability | feature_code,supported_hosts[],client_min_version,adapter_version,status:SUPPORTED/UNSUPPORTED/FAILED,limits |
| Catalog | version,sha256,generated_at,source_manifest:[{url,license,version}],hosts[]; 이전 검증본 유지 |
| Installation | executor_id,current_user_id?,last_seen_at,client_version,execution_status |

## 사이트·인증 검증

URL에서 host만 관리 범위로 사용하고 경로·query·fragment는 저장하지 않는다. 자격정보 URL·IP·localhost·명시적 port는 거절한다. www를 임의 제거하지 않는다. 동일하거나 포함관계인 등록 범위는409. 목적 FOCUS/GENERAL은 ALLOW, DISTRACTION은 BLOCK/RECORD다. feature_code는 YOUTUBE_SHORTS/YOUTUBE_RECOMMENDATIONS/YOUTUBE_COMMENTS/YOUTUBE_AUTOPLAY/INSTAGRAM_REELS/INSTAGRAM_RECOMMENDATIONS이며 host와 호환해야 한다.

이메일은 인증 주소를 계정 식별 수단으로 사용한다. 비밀번호는 단방향 해시(Argon2id)를 서버에 저장하고 원문은 로그/이벤트에 남기지 않는다. 이메일 인증24시간, 비밀번호 재설정30분, 단회 사용. 로그인 실패 제한은 계정+IP 각각5회/분, 메일 재발송1분 간격·5회/시간 설계값이다. 로그인 성공 시 세션 ID를 교체한다.

Google은 OIDC의 issuer/audience/expiry/nonce와 서명을 검증한다. 카카오는 서버 code 교환 후 공식 사용자 정보의 id로 식별한다. redirect는 사전 등록 정확 일치, state 단회 검증, client secret은 Server에만 둔다. 카카오 이메일은 제공되지 않을 수 있으므로 내부 사용자 ID와 provider subject를 기본키로 삼는다. 소셜 취소는 새 회원을 만들지 않는다. 제공자 인증만 끝난 최초 사용자는 가입 확인 전 서비스 계정이 생성되지 않는다.

확장 연결은 설치 증명+S256 code challenge, 서버 승인과 단회 code 교환을 사용한다. 연결 요청5분, code60초, access15분, 회전 refresh30일. refresh 해시 저장·재사용 탐지, executor 소유 확인. 사용자 로그아웃은 로컬 해제/기록 보존→연결 종료→Web 인증 종료다. 인증 자연 만료가 진행 중 세션을 임의로 비회원 소유로 바꾸지 않는다.

## API 목록
| API ID | 방식·경로 | 인증 | 입력 | 응답 | 주요 오류 |
|---|---|---|---|---|---|
| API-AUTH-01 | GET /api/v1/auth/csrf | 공개 | 없음 | 200 {csrf_token} | 503 |
| API-AUTH-02 | POST /api/v1/auth/signup | 공개+CSRF | email,password,display_name,terms_version | 201 {user_id,status:PENDING_VERIFICATION} | 422 VALIDATION_FAILED; 409 EMAIL_IN_USE |
| API-AUTH-03 | POST /api/v1/auth/login | 공개+CSRF | email,password | 200 User + Web 쿠키 | 401 INVALID_CREDENTIALS; 403 EMAIL_UNVERIFIED |
| API-AUTH-04 | GET /api/v1/auth/me | W/E | 없음 | 200 User | 401 |
| API-AUTH-05 | POST /api/v1/auth/logout | W | 없음 | 204 Web 인증 폐기; 제품 로그아웃의 마지막 단계 | 409 ACTIVE_EXECUTION_OR_LINK; 401 |
| API-AUTH-06 | GET /api/v1/auth/social/{provider}/authorize | 공개 | provider=google/kakao; mode=login/link; return_path 내부허용값 | 302 제공자; state/nonce 저장 | 422 INVALID_PROVIDER |
| API-AUTH-07 | GET /api/v1/auth/social/{provider}/callback | state 검증 | code,state 또는 error | 303 가입 확인/로그인 완료/연결 화면 | SOCIAL_CANCELED; INVALID_STATE; IDENTITY_CONFLICT |
| API-AUTH-08 | POST /api/v1/auth/social/complete | 단회 인증증명+CSRF | ticket,terms_version,display_name | 201 User + 쿠키; 최초 가입만 | 409 IDENTITY_CONFLICT |
| API-AUTH-09 | POST /api/v1/auth/identities/link | W+최근5분 재인증 | ticket | 200 User; 두 인증의 동일 사용자 결합 | 409 IDENTITY_ALREADY_LINKED |
| API-AUTH-10 | POST /api/v1/auth/email/verify | 단회 token | token | 200 verified | 410 TOKEN_EXPIRED; 409 USED_TOKEN |
| API-AUTH-11 | POST /api/v1/auth/password/reset-requests | 공개+CSRF | email | 202 동일 응답; 발송 여부 노출 안 함 | 429 |
| API-AUTH-12 | POST /api/v1/auth/password/reset | 단회 token | token,new_password | 204 비밀번호 교체·기존 Web/refresh 폐기 | 410 TOKEN_EXPIRED; 422 |
| API-AUTH-13 | POST /api/v1/auth/email/verification-requests | 공개+CSRF | email | 202 동일 응답 | 429 |
| API-AUTH-14 | POST /api/v1/auth/reauthenticate | W | password 또는 기존연결 provider의 단회 ticket | 204 현재 사용자 재인증 시각 갱신 | 401 INVALID_CREDENTIALS;409 IDENTITY_MISMATCH |
| API-EXT-01 | POST /api/v1/extension-installations | 공개 제한 | executor_id UUID,client_version | 201 {executor_id,installation_proof} 최초1회 | 409 INSTALLATION_EXISTS |
| API-EXT-02 | POST /api/v1/extension-link-requests | I | executor_id,code_challenge,state,callback_uri | 201 {link_request_id,verification_uri,expires_at} | 422 INVALID_CALLBACK |
| API-EXT-03 | POST /api/v1/extension-link-requests/{id}/approval | W | approve boolean | 200 승인 상태 | 409 GUEST_SESSION_ACTIVE |
| API-EXT-04 | POST /api/v1/extension-tokens | I | link_request_id,code,code_verifier | 200 {access_token,refresh_token,expires_in} | 401 INVALID_GRANT |
| API-EXT-05 | POST /api/v1/extension-tokens/refresh | refresh | refresh_token | 200 회전된 토큰 | 401 TOKEN_REUSE |
| API-EXT-06 | DELETE /api/v1/extension-installations/{executor_id}/connection | W/E | 없음; 실제 해제 증거 필수 | 204 회원 연결 종료 | 409 RELEASE_UNCONFIRMED |
| API-EXT-07 | GET /api/v1/extension-installations | W/E | 없음 | 200 Installation[] | 401 |
| API-SITE-01 | GET /api/v1/sites | W/E | purpose?,cursor?,limit? | 200 List<Site> | 400 INVALID_CURSOR |
| API-SITE-02 | GET /api/v1/sites/{site_id} | W/E | 없음 | 200 Site + ETag | 404 |
| API-SITE-03 | POST /api/v1/sites | W/E | SiteWrite | 201 Site | 409 SITE_SCOPE_CONFLICT;422 |
| API-SITE-04 | PATCH /api/v1/sites/{site_id} | W/E | SiteWrite의 변경 필드 + If-Match | 200 Site | 412 VERSION_CONFLICT;422 |
| API-SITE-05 | DELETE /api/v1/sites/{site_id} | W/E | If-Match | 204; 과거 스냅샷 유지 | 412 |
| API-POLICY-01 | GET /api/v1/content-policy | W/E | 없음 | 200 ContentPolicy + ETag | 401 |
| API-POLICY-02 | PUT /api/v1/content-policy | W/E | ContentPolicyWrite 전체 + If-Match | 200 ContentPolicy | 422 INVALID_SCOPE;412 |
| API-CAP-01 | GET /api/v1/capabilities | W/E/I | client_version | 200 Capability[] | 422 CLIENT_UNSUPPORTED |
| API-CAT-01 | GET /api/v1/catalogs/adult-domains | W/E/I | known_version? | 200 Catalog 또는304 | 503 NO_VALID_CATALOG |
| API-SESSION-01 | POST /api/v1/sessions | W/E | executor_id,duration_minutes | 202 Session STARTING + operation_id | 409 ACTIVE_SESSION_EXISTS; EXECUTOR_OFFLINE |
| API-SESSION-02 | GET /api/v1/sessions/current | W/E | executor_id? | 200 Session 또는 null | 401 |
| API-SESSION-03 | GET /api/v1/sessions | W/E | from_date,to_date,status?,cursor | 200 List<Session> | 422 |
| API-SESSION-04 | GET /api/v1/sessions/{session_id} | W/E | 없음 | 200 Session | 404 |
| API-SESSION-05 | GET /api/v1/sessions/{session_id}/policy | W/E | 없음 | 200 Snapshot | 404 |
| API-SESSION-06 | POST /api/v1/sessions/{session_id}/end | W/E | 없음 | 202 Session ENDING + operation_id | 409 INVALID_TRANSITION |
| API-SESSION-07 | POST /api/v1/sessions/{session_id}/pause | W/E | 없음 | 202 Session PAUSING + operation_id | 409 INVALID_TRANSITION |
| API-SESSION-08 | POST /api/v1/sessions/{session_id}/resume | W/E | 없음 | 202 Session RESUMING + operation_id | 409 INVALID_TRANSITION; EXECUTOR_OFFLINE |
| API-NOTE-01 | GET /api/v1/sessions/{session_id}/note | W/E | 없음 | 200 Note (없으면 text 빈값,version0) | 404 SESSION_NOT_FOUND |
| API-NOTE-02 | PUT /api/v1/sessions/{session_id}/note | W/E | text 0~2000자,If-Match | 200 Note | 412;422 |
| API-EXEC-01 | GET /api/v1/executors/{executor_id}/commands | E | cursor,known_revision | 200 {commands,next_cursor,server_time} | 403 EXECUTOR_MISMATCH |
| API-EXEC-02 | POST /api/v1/executors/{executor_id}/reports | E | ExecutionReport | 200 {result,desired_revision} | 409 REPORT_CONFLICT |
| API-EXEC-03 | POST /api/v1/executors/{executor_id}/reconcile | E | journal_summary,local_actions[] | 200 {desired_state,revision,acknowledged_actions} | 409 RECONCILE_REQUIRED |
| API-OP-01 | GET /api/v1/operations/{operation_id} | 원요청 주체 | 없음 | 200 {status,resource_id,error} | 404 |
| API-EVENT-01 | POST /api/v1/events/batch | E | events[] 최대100,1MiB | 200 {items:[event_id,status,error]} | 413;422 |
| API-EVENT-02 | POST /api/v1/events/status | E | event_ids[] 최대100 | 200 {items:[event_id,status]} | 422 |
| API-USAGE-01 | POST /api/v1/usage-segments/batch | E | segments[] 최대100 | 200 항목별 accepted/duplicate/rejected | 409 BODY_MISMATCH |
| API-LOG-01 | GET /api/v1/access-events | W/E | 기간,session_id?,host?,event_type?,cursor | 200 List<Access> | 422 |
| API-LOG-02 | GET /api/v1/access-events/{event_id} | W/E | 없음 | 200 Access + 당시 정책 | 404 |
| API-STAT-01 | GET /api/v1/statistics/summary | W/E | from_date,to_date | 200 Metrics | 422 |
| API-STAT-02 | GET /api/v1/statistics/targets | W/E | from_date,to_date,cursor | 200 List<TargetMetrics> | 422 |
| API-STAT-03 | GET /api/v1/statistics/hourly | W/E | from_date,to_date | 200 24개 시간대 Metrics | 422 |
| API-STAT-04 | GET /api/v1/statistics/usage | W/E | from_date,to_date,host? | 200 {total_ms,by_site,quality,as_of} | 422 |
| API-DASH-01 | GET /api/v1/dashboard | W/E | 없음 | 200 {current_session,recent_sessions,recent_access,summary} | 401 |
| API-SCHEDULE-01 | GET /api/v1/schedules | W/E | executor_id?,cursor | 200 List<Schedule> | 422 |
| API-SCHEDULE-02 | POST /api/v1/schedules | W/E | ScheduleWrite | 201 Schedule | 422 INVALID_TIMEZONE |
| API-SCHEDULE-03 | PATCH /api/v1/schedules/{id} | W/E | 변경 필드,If-Match | 200 Schedule | 412;422 |
| API-SCHEDULE-04 | DELETE /api/v1/schedules/{id} | W/E | If-Match | 204 미시작 건 취소; 실행 세션 유지 | 412 |
| API-SCHEDULE-05 | GET /api/v1/schedules/{id}/occurrences | W/E | 기간,cursor | 200 List<Occurrence> | 404 |
| API-SCHEDULE-06 | POST /api/v1/schedule-occurrences/claim | E | schedule_id,scheduled_start_at,version | 202 Session/기존 결과 또는200 대기·건너뜀 | 409 VERSION_CONFLICT |
| API-AI-01 | POST /api/v1/analysis-jobs | W/E | from_date,to_date,consent_version | 202 AnalysisJob | 422 INSUFFICIENT_DATA;403 CONSENT_REQUIRED;503 PROVIDER_UNAVAILABLE |
| API-AI-02 | GET /api/v1/analysis-jobs/{id} | W/E | 없음 | 200 AnalysisJob + Result? | 404 |
| API-AI-03 | GET /api/v1/analysis-jobs | W/E | 기간,cursor | 200 List<AnalysisJob> | 422 |
| API-AI-04 | PUT /api/v1/analysis-consent | W | accepted boolean,notice_version | 200 {accepted,notice_version,updated_at} | 422 |
| API-IMPORT-01 | POST /api/v1/guest-imports | E | manifest:설정·완료 세션 목록,source_installation_id | 202 ImportBatch | 409 SOURCE_BOUND_TO_OTHER_ACCOUNT |
| API-IMPORT-02 | PUT /api/v1/guest-imports/{batch_id}/items/{source_item_id} | E | ImportItem | 200 항목별 결과 | 409 SOURCE_CONFLICT;422 |
| API-IMPORT-03 | GET /api/v1/guest-imports/{batch_id} | W/E | 없음 | 200 ImportBatch | 404 |
| API-IMPORT-04 | GET /api/v1/guest-imports | E | cursor | 200 List<ImportBatch> | 401 |

## 실행 명령과 복구 순서

Server는 소유/활성 잠금을 확인하고 Snapshot·Session·Command·Operation을 한 트랜잭션으로 기록한다. Extension은 명령을 durable journal에 적은 후 실행하고 report를 로컬에 저장한 뒤 전송한다. Server는 desired_revision과 command_id를 대조해 상태를 확정한다. 보고 유실은 같은 report_id로 재전송한다. 늦은 APPLY 결과가 최신 ENDING을 RUNNING으로 바꾸지 않는다.

명령 조회는 활성 UI/세션에서5초 목표 long-poll, 비활성은30초 이상 alarm과 UI·탭 이벤트 재동기화를 사용한다. MV3가 워커를 중단할 수 있으므로 폴링만으로 정시 실행·해제를 보장하지 않는다. 예약·종료 기준시각과 규칙 소유 정보를 로컬에 저장하고 워커 시작/팝업/탐색 시 재평가한다. 모든 APPLY에는 execute_before가 있으며 기한 지난 적용은 해제 보고로 처리한다.

오프라인 중 회원 기존 세션은 고정 스냅샷으로 정지/재개/종료할 수 있으나 새 회원 세션·새 예약 claim은 연결 복구 후만 가능하다. 비회원 로컬 신규 시작은 가능하다. 재접속은 journal 대조가 먼저이고 오래된 서버 APPLY를 먼저 실행하지 않는다. 중복·타계정 실행을 막는 active lock은 실제 해제 보고 전 해제하지 않는다. 오래된 lock 정리는 heartbeat 만료만으로 수행하지 않는다.

## 로컬 메시지 계약

비회원은 API를 호출하지 않고 Extension 내부 메시지로 같은 검증을 수행한다. 공통 {request_id,type,owner_context,payload}; 응답 {request_id,status,data,error}. type=GET_STATE/SAVE_SITE/SAVE_CONTENT_POLICY/START/PAUSE/RESUME/END/SAVE_SCHEDULE/SAVE_NOTE/QUERY_RECORDS/IMPORT_PREVIEW. Core가 실제 발신 extension context·tab/frame·세션을 확인한다. 페이지에서 계정 ID·임의 명령을 보내 실행할 수 없게 한다. Content→Core 관찰은 OBSERVE_ACCESS/USAGE_BOUNDARY/FEATURE_RESULT/IMAGE_RESULT만 허용하고 크기·스키마·세션을 검증한다. 원격 AI·회원 API key는 Content에 전달하지 않는다.

## 외부 adapter 계약

AI provider 인터페이스 generate(집계 JSON,출력 JSON schema,request_id)→Result 또는 PROVIDER_FAILED. 인증·청구·모델 지정은 Server 환경 설정으로 주입한다. provider 미설정 시503, 정상 분석으로 대체 표시하지 않는다. 모델/도메인 목록은 버전·checksum·출처 manifest를 갖는 배포 자산이다. 성인 도메인 출처는 공개 porn 전용 목록만 검토하며 광고/추적/일반 사회관계망 목록 전체를 성인 목록으로 사용하지 않는다. 검증된 배포 목록이 없으면 기능 불가 상태가 명세된 동작이다.

## 공식 기술 근거

- [Chrome alarms](https://developer.chrome.com/docs/extensions/reference/api/alarms): 실행 지연·절전·재생성 조건 때문에 구간 재평가를 설계했다.
- [Extension worker 수명](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle): 메모리 변수만으로 세션을 보존하지 않는다.
- [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect), [카카오 로그인](https://developers.kakao.com/docs/ko/kakaologin/rest-api): 제공자별 인증 검증을 분리한다.
- [NSFWJS](https://nsfwjs.com/): 학습된 브라우저 분류기 adapter의 후보. FOCURVE 정확도·성능 검증 결과가 아니다.

## 기본값과 경계 보완

신규 ContentPolicy는 version1, keywords/adult_domains/image_blur/usage_tracking enabled=false, rules·예외·custom_hosts 빈 배열, 이미지 민감도/강도 MEDIUM이다. GET은 이 기본 객체를 반환한다. 저장 시 변경한 활성화만 다음 세션에 반영한다. 이용 시간 수집은 ANALYSIS-01에서 명시적으로 켤 수 있고 미활성 구간은 NOT_COLLECTED다.

삭제된 동일 host 재등록은 기존 sites 행을 복원하고 version 증가, 기존 세션 스냅샷은 변경하지 않는다. 비밀번호 재설정으로 인증을 폐기해도 기존 실제 세션 소유자·기록은 유지하고 복구 규칙을 적용한다. 소셜 계정 연결 전 재인증은 API-AUTH-14로 현재 계정임을 검증한다. 최초 가입 약관 동의는 users의 terms_version·terms_accepted_at으로 저장한다.

로그아웃의 연결 해제 대상은 사용자가 확인한 현재 실행 설치다. 다른 설치를 무조건 삭제하지 않는다. 활성 계정 세션의 실제 해제가 확인되어야 종료를 완료한다. AUTH-05가 별도 브라우저의 남은 연결까지 무조건 요구하는 의미는 아니다. 서버가 logout context의 대상 설치와 active lock을 확인한다.

## 예약 상태·사유 직렬화

Occurrence.status는 PENDING/WAITING_CONFLICT/STARTING/RUNNING/FINISHED/SKIPPED를 사용한다. 만료·존재하지 않는 현지 시각은 SKIPPED 상태와 reason=EXPIRED/NONEXISTENT_TIME으로 구분하며 합성 상태 문자열을 사용하지 않는다. 가져오기 항목의 SKIPPED_CONFLICT는 다른 도메인의 결과값이며 예약 상태가 아니다.


---

# 데이터·이벤트·복구 계약

## 데이터 사전

기존 12개 업무 테이블 이름과 관계를 유지하고 추가 기능·인증·실행 테이블을 확장한다. PK=기본키, FK=외래키, UQ=유일 제약. NULL 표시가 없는 속성은 NOT NULL이다. 날짜는 UTC DATETIME(3), 문자열은 utf8mb4, 정확 비교 식별자는 binary collation, 수량·시간은 음수 금지. 모든 FK 삭제는 RESTRICT를 기본으로 하여 회원/사이트 삭제가 과거 기록을 연쇄 삭제하지 않게 한다. 가변 JSON 내부는 API의 동일 schema로 검증한다.

기존 표에 생략됐던 실행·인증 테이블을 포함한다. 물리 DDL 작성 시 아래 PK/FK/UQ와 검증 조건을 그대로 적용한다. 이 개정은 DB 실행이나 migration을 수행하지 않는다.
| 테이블 | 필드 | FK 관계 | 고유·무결성 | 수명 |
|---|---|---|---|---|
| users | id BIGINT PK; display_name VARCHAR(40); email VARCHAR(254) NULL; email_verified BOOLEAN; status VARCHAR(24); created_at DATETIME(3); terms_version VARCHAR(40); terms_accepted_at DATETIME(3) | 없음 | email(정규화, NULL 허용) | 회원 영속 보관 |
| auth_identities | id BIGINT PK; user_id BIGINT; provider VARCHAR(16); subject VARCHAR(255); password_hash VARCHAR(255) NULL; updated_at DATETIME(3) | user_id→users.id | provider+subject | 회원 영속 보관 |
| extension_installations | id CHAR(36) PK; current_user_id BIGINT NULL; proof_hash VARCHAR(255); client_version VARCHAR(40); last_seen_at DATETIME(3) NULL | current_user_id→users.id | id | 회원 영속 보관 |
| sites | id BIGINT PK; user_id BIGINT; canonical_host VARCHAR(253); display_name VARCHAR(100); include_subdomains BOOLEAN; purpose VARCHAR(16); access_policy VARCHAR(16); version BIGINT; deleted_at DATETIME(3) NULL | user_id→users.id | user_id+canonical_host; 중첩범위는 계정 잠금 아래 검사 | 회원 영속 보관 |
| site_feature_policies | site_id BIGINT; feature_code VARCHAR(50); enabled BOOLEAN; PK(site_id,feature_code) | site_id→sites.id | site_id+feature_code | 회원 영속 보관 |
| content_policies | user_id BIGINT PK; version BIGINT; keywords JSON; adult_domains JSON; image_blur JSON; usage_tracking JSON; updated_at DATETIME(3) | user_id→users.id | user_id | 회원 영속 보관 |
| policy_snapshots | id CHAR(36) PK; user_id BIGINT; executor_id CHAR(36); format_version VARCHAR(8); payload JSON; source_version BIGINT; catalog_version VARCHAR(80) NULL; model_profile_version VARCHAR(80) NULL; created_at DATETIME(3) | user_id→users.id; executor_id→extension_installations.id | id+user_id+executor_id; 내용 불변 | 회원 영속 보관 |
| focus_sessions | id BIGINT PK; source_session_id CHAR(36); user_id BIGINT; executor_id CHAR(36); policy_snapshot_id CHAR(36); source VARCHAR(16); origin VARCHAR(16); execution_status VARCHAR(24); record_status VARCHAR(24); duration_minutes INT; active_duration_ms BIGINT; overrun_ms BIGINT; desired_revision BIGINT; version BIGINT; started_at DATETIME(3) NULL; planned_end_at DATETIME(3) NULL; ended_at DATETIME(3) NULL; policy_released_at DATETIME(3) NULL; end_reason VARCHAR(40) NULL; last_error_code VARCHAR(80) NULL | user_id→users.id; executor_id→extension_installations.id; policy_snapshot_id+user_id+executor_id→policy_snapshots(id,user_id,executor_id) | user_id+executor_id+source_session_id | 회원 영속 보관 |
| session_intervals | id CHAR(36) PK; session_id BIGINT; kind VARCHAR(8); start_at DATETIME(3); end_at DATETIME(3) NULL; duration_ms BIGINT NULL; quality VARCHAR(20) | session_id→focus_sessions.id | id; session별 구간 중첩 금지 | 회원 영속 보관 |
| session_notes | session_id BIGINT PK; text TEXT; version BIGINT; updated_at DATETIME(3) | session_id→focus_sessions.id | session_id; text≤2000자 | 회원 영속 보관 |
| active_execution_locks | user_id BIGINT PK; executor_id CHAR(36); session_id BIGINT; revision BIGINT | user_id→users.id; executor_id→extension_installations.id; session_id→focus_sessions.id | executor_id; session_id | 해제 확인 시 삭제; 기록은 sessions에 유지 |
| event_receipts | event_id CHAR(36) PK; owner_user_id BIGINT; executor_id CHAR(36); resolved_session_id BIGINT NULL; schema_version VARCHAR(8); event_type VARCHAR(40); payload_hash CHAR(64); payload JSON; status VARCHAR(24); received_at DATETIME(3) | owner_user_id→users.id; executor_id→extension_installations.id; resolved_session_id→focus_sessions.id | event_id | 회원 영속 보관 |
| access_events | event_id CHAR(36) PK; session_id BIGINT; occurred_at DATETIME(3); access_seq BIGINT; target_kind VARCHAR(16); target_host VARCHAR(253); target_key VARCHAR(320); feature_code VARCHAR(50) NULL; reason VARCHAR(40); navigation_id CHAR(36); policy_snapshot_id CHAR(36) | event_id→event_receipts.event_id; session_id→focus_sessions.id; policy_snapshot_id→policy_snapshots.id | session_id+access_seq; session_id+navigation_id+target_key | 회원 영속 보관 |
| session_lifecycle_events | event_id CHAR(36) PK; session_id BIGINT; occurred_at DATETIME(3); event_type VARCHAR(40); desired_revision BIGINT | event_id→event_receipts.event_id; session_id→focus_sessions.id | event_id | 회원 영속 보관 |
| usage_segments | id CHAR(36) PK; session_id BIGINT; target_host VARCHAR(253); start_at DATETIME(3); end_at DATETIME(3); duration_ms BIGINT; usage_seq BIGINT; quality VARCHAR(20); payload_hash CHAR(64) | session_id→focus_sessions.id | session_id+usage_seq; overlap는 reject/quarantine | 회원 영속 보관 |
| schedules | id CHAR(36) PK; user_id BIGINT; executor_id CHAR(36); name VARCHAR(80); weekdays JSON; start_local CHAR(5); timezone VARCHAR(80); duration_minutes INT; enabled BOOLEAN; version BIGINT; created_at DATETIME(3); deleted_at DATETIME(3) NULL | user_id→users.id; executor_id→extension_installations.id | id | 회원 영속 보관 |
| schedule_occurrences | id CHAR(36) PK; schedule_id CHAR(36); schedule_version BIGINT; scheduled_start_at DATETIME(3); scheduled_end_at DATETIME(3); status VARCHAR(24); reason VARCHAR(80) NULL; session_id BIGINT NULL | schedule_id→schedules.id; session_id→focus_sessions.id | schedule_id+scheduled_start_at; session_id NULL허용 | 회원 영속 보관 |
| analysis_jobs | id CHAR(36) PK; user_id BIGINT; from_date DATE; to_date DATE; input_hash CHAR(64); input_snapshot JSON; status VARCHAR(24); consent_version VARCHAR(40); provider VARCHAR(80); model_version VARCHAR(80); created_at DATETIME(3); completed_at DATETIME(3) NULL; error_code VARCHAR(80) NULL | user_id→users.id | id; 캐시키는 user+기간+input_hash+model_version | 회원 영속 보관 |
| analysis_results | job_id CHAR(36) PK; result JSON; generated_at DATETIME(3) | job_id→analysis_jobs.id | job_id | 회원 영속 보관 |
| analysis_consents | user_id BIGINT PK; accepted BOOLEAN; notice_version VARCHAR(40); updated_at DATETIME(3) | user_id→users.id | user_id | 회원 영속 보관 |
| guest_import_batches | id CHAR(36) PK; user_id BIGINT; executor_id CHAR(36); status VARCHAR(24); created_at DATETIME(3); completed_at DATETIME(3) NULL | user_id→users.id; executor_id→extension_installations.id | id | 회원 영속 보관 |
| guest_import_items | id CHAR(36) PK; batch_id CHAR(36); source_executor_id CHAR(36); source_item_id CHAR(36); source_hash CHAR(64); item_type VARCHAR(24); bound_user_id BIGINT; status VARCHAR(24); result_id VARCHAR(80) NULL; error_code VARCHAR(80) NULL | batch_id→guest_import_batches.id; bound_user_id→users.id | source_executor_id+source_item_id; polymorphic result_id는 item_type별 transaction검증 | 회원 영속 보관 |
| execution_commands | id CHAR(36) PK; session_id BIGINT; executor_id CHAR(36); desired_revision BIGINT; kind VARCHAR(24); payload JSON; status VARCHAR(20); created_at DATETIME(3); execute_before DATETIME(3) NULL | session_id→focus_sessions.id; executor_id→extension_installations.id | session_id+desired_revision+kind | 회원 영속 보관 |
| execution_reports | id CHAR(36) PK; session_id BIGINT; command_id CHAR(36) NULL; executor_id CHAR(36); desired_revision BIGINT; payload_hash CHAR(64); result VARCHAR(24); observed_at DATETIME(3); payload JSON | session_id→focus_sessions.id; command_id→execution_commands.id; executor_id→extension_installations.id | id | 회원 영속 보관 |
| operations | id CHAR(36) PK; user_id BIGINT; resource_id VARCHAR(80); status VARCHAR(20); error_code VARCHAR(80) NULL; created_at DATETIME(3) | user_id→users.id | id | 회원 영속 보관 |
| web_sessions | id_hash CHAR(64) PK; user_id BIGINT NULL; csrf_hash CHAR(64); expires_at DATETIME(3); reauthenticated_at DATETIME(3) NULL | user_id→users.id | id_hash | 인증 만료·로그아웃 시 폐기, 기록과 별개 |
| auth_challenges | id CHAR(36) PK; user_id BIGINT NULL; kind VARCHAR(24); token_hash CHAR(64); provider VARCHAR(16) NULL; state_hash CHAR(64) NULL; nonce_hash CHAR(64) NULL; payload JSON; expires_at DATETIME(3); consumed_at DATETIME(3) NULL | user_id→users.id | token_hash | 단회 소비·만료 후 삭제; 비밀번호/원문 token 미보관 |
| link_requests | id CHAR(36) PK; executor_id CHAR(36); approved_user_id BIGINT NULL; code_challenge VARCHAR(128); callback_uri VARCHAR(2048); state_hash CHAR(64); code_hash CHAR(64) NULL; expires_at DATETIME(3); consumed_at DATETIME(3) NULL | executor_id→extension_installations.id; approved_user_id→users.id | id | 만료 후 삭제 |
| extension_tokens | id CHAR(36) PK; executor_id CHAR(36); user_id BIGINT; refresh_hash CHAR(64); family_id CHAR(36); expires_at DATETIME(3); revoked_at DATETIME(3) NULL | executor_id→extension_installations.id; user_id→users.id | refresh_hash | 만료 후 회전/재사용 탐지용30일 보관 후 삭제 |
| catalog_versions | version VARCHAR(80) PK; sha256 CHAR(64); source_manifest JSON; artifact_uri VARCHAR(2048); published_at DATETIME(3) | 없음 | version | 참조 Snapshot이 있으면 버전 메타 보존 |
| model_profiles | version VARCHAR(80) PK; model_name VARCHAR(80); sha256 CHAR(64); thresholds JSON; license_manifest JSON | 없음 | version | 참조 Snapshot이 있으면 버전 메타 보존 |
| idempotency_keys | owner_key VARCHAR(120); method VARCHAR(10); path VARCHAR(255); request_key CHAR(36); body_hash CHAR(64); response JSON; expires_at DATETIME(3) | 없음 | owner_key+method+path+request_key | 7일; 영속 중복 제약과 분리 |

## 인덱스·트랜잭션

조회 인덱스: focus_sessions(user_id,started_at,id), access_events(session_id,access_seq), access_events(target_host,occurred_at), usage_segments(session_id,start_at), schedules(user_id,enabled), schedule_occurrences(schedule_id,scheduled_start_at), execution_commands(executor_id,status,created_at), analysis_jobs(user_id,created_at), guest_import_items(batch_id,status). 계정 필터는 반드시 session/user 소유 join과 함께 사용한다.

세션 시작은 계정·설치 잠금 확보→스냅샷/세션/명령/operation 삽입→commit. 예약 claim은 발생 UQ 확보와 동일 시작 트랜잭션을 사용한다. 사이트 등록 범위 중첩은 users 행 잠금 후 검사한다. 이벤트는 receipt 삽입과 파생 access/lifecycle를 같은 트랜잭션으로 처리하며 동일 ID 다른 payload hash는 충돌 격리한다. ACTIVE lock은 해제 보고 검증과 상태 종료를 같은 트랜잭션에서 수행한다.

event_receipts 하위 접근/생명주기는 해당 event_type에 맞는 하나만 생성한다. source_session_id와 executor_id로 계정 세션을 확인한다. import item은 데이터 저장과 성공 상태·bound_user_id를 원자 처리한다. 부분 성공은 성공 항목을 다시 만들지 않는다. result_id는 item_type에 따른 테이블과 소유권을 검증한다.

## 이벤트 v1.1

공통 필드: schema_version="1.1", event_id UUID, executor_id UUID, session_id UUID, policy_snapshot_id UUID, event_type, occurred_at UTC, local_seq 양의정수, payload. 회원의 user_id는 인증에서 결정하며 비회원은 서버로 직접 전송하지 않는다. 동일 event_id 재전송은 동일 내용이어야 한다. 수신 순서가 발생 순서가 아니다.

기존 BLOCKED_SITE_ACCESS, RECORDED_ACCESS, BLOCKED_FEATURE_ACCESS, SESSION_STARTED, SESSION_ENDED를 유지한다. SESSION_PAUSED/SESSION_RESUMED를 생명주기로 추가한다. PAUSED/RESUMED에는 command_id·desired_revision·interval_id가 포함된다. 접근에는 access_seq·navigation_id·target_kind SITE/FEATURE·target_host·feature_code?·target_key·reason을 포함한다. reason은 USER_SITE/ADULT_DOMAIN/KEYWORD/FEATURE/RECORD. 키워드 rule ID까지만 저장하고 매칭 텍스트는 제외한다.

순번 공백은 receipt=PENDING_DEPENDENCY, 잘못된 소유·서명·스키마는 REJECTED, 정상은 ACCEPTED. 재전송 status는 DUPLICATE. 세션 종료가 먼저 와도 이후 시작 보고가 상태를 되돌리지 않으며 gap이 해소될 때 기록 품질만 갱신한다. 반복은 별도 이벤트가 아니라 session_id+target_key에서 access_seq 순위를 재계산한다.

usage payload={id,session_id,policy_snapshot_id,target_host,start_at,end_at,duration_ms,usage_seq,quality}. duration은 end-start와 일치해야 하고 확인된 RUN 구간 내여야 한다. 겹치는 구간은 임의로 더하지 않고 REVIEW_REQUIRED로 격리한다. 모델 분류·추천 영역 숨김·댓글 숨김 횟수는 접근 이벤트에 포함하지 않고 기능 상태 진단으로만 남긴다.

## 로컬 저장 구조

IndexedDB stores: owner_settings(owner_key,version,payload), sessions(owner_key,session_id,snapshot,status,started_at,ended_at,expires_at), events(owner_key,event_id,payload,ack), intervals(owner_key,interval_id,...), usage(owner_key,id,...), notes(owner_key,session_id,text,version), schedules(owner_key,id,...), occurrences(owner_key,id,...), journal(owner_key,session_id,revision,action_seq,desired,observed), outbox(owner_key,item_id,payload_hash,status,retry_at), import_marks(source_id,bound_user_id,status), preferences(theme).

owner_key는 GUEST:installation_id 또는 MEMBER:user_id다. 실행 상태·원본·outbox는 같은 로컬 transaction으로 저장한다. 인증 secret과 기록 수명은 분리한다. 저장 공간 부족 시 새 세션·수집 성공을 가장하지 않고 오류 표시 후 신규 수집 중단/세션 해제 절차를 진행한다. 오래된 회원 대기 자료를 자동 삭제해 공간을 만들지 않는다. 저장소 마이그레이션은 version·backup·commit 후 전환, 실패 시 원본 유지한다.

## 보관·가져오기

비회원 종료 세션과 하위 이벤트·구간·이용 시간·메모는 ended_at+30×24시간에 함께 만료한다. 시작/종료 미확인 세션은 복구 전 삭제하지 않는다. 설정·예약은 삭제 전 유지한다. 가져오기 처리 중 세션은 lease로 보호하되 완료/중단 확인 후 원래 만료 규칙을 적용한다. 성공 원본에도 가져옴 표시만 하고 원래 만료일까지 유지한다.

설정은 새 사이트만 추가, 같은 사이트/전역 설정은 기존 회원값 우선, 충돌은 SKIPPED_CONFLICT로 표시한다. 비회원 예약을 가져오면 회원 설치로 매핑한 비활성 예약으로 저장하여 검토 없이 자동 실행하지 않는다. 완료 세션은 당시 시각·스냅샷·순서·메모·이용 구간을 함께 복사한다. source_executor_id+source_item_id는 최초 계정에 결박하고 다른 계정 재이전을 거절한다. 로그인 자체가 업로드를 의미하지 않는다.

회원 데이터는 기간 자동 만료가 없다. 운영 인증·일회용 challenge 정리는 회원 행동 기록 삭제와 별개다. 명시적 탈퇴/기록 삭제 UI는 이번 기능 목록 밖이며 자동 삭제로 대신하지 않는다. 서버 백업은 일별 암호화 전체 백업+binlog 보관30일을 운영 설계값으로 지정하고 목표 RPO15분/RTO4시간, 복원 후 소유권·행 수·event_id 중복 검증을 수용 기준으로 둔다. 무손실을 보장했다고 표현하지 않는다.

## 복구 상태 표
| 상황 | 복구 | 완료 기준 |
|---|---|---|
| 설정 저장 응답 유실 | 같은 request key로 조회/재요청 | 기존 결과 확인; 입력·회원 기록 유지 |
| APPLY 보고 유실 | journal·실제 규칙 대조 후 같은 report 재전송 | 중복 시작 없음; 확인 전 RUNNING 아님 |
| 해제 실패 | ENDING/PAUSING과 오류 유지; 해당 session rule 정리 재시도 | 해제 확인 전 완료·비회원 전환 표시 금지 |
| 워커 중단 | startup에서 alarm·journal·DNR·탭 상태 재확인 | 메모리 손실로 새 세션 생성 금지 |
| 브라우저 재시작 | 이전 수동 세션 잔여 규칙 정리·INTERRUPTED | 미확인 구간은 집중 시간 추정 합산 금지 |
| 오프라인 기록 | owner 고정 outbox, 같은 event_id로 재전송 | 회원A 자료가 비회원·회원B로 전송되지 않음 |
| 서버 신규 시작 불가 | 회원 신규 시작·예약 claim 실패 표시 | 오프라인 기존 세션 제어 및 비회원 로컬은 별도 유지 |
| 예약 중복·충돌 | 발생 UQ·active lock과 잔여 구간 평가 | 동일 발생 최대1회; 기존 세션 우선 |
| AI 실패 | job FAILED, 기존 결과·집계 보존 | 빈 응답을 정상 피드백으로 표시하지 않음 |
| 이미지 분류 실패 | 가림 유지·재시도/보기, FAILED 표시 | 안전 이미지로 분류하지 않음 |
| 모델/목록 자산 실패 | checksum·manifest 검증, 마지막 유효 버전 | 유효 자산 없으면 해당 기능 불가 |
| 가져오기 부분 실패 | 항목별 commit 상태 조회·미완료만 재시도 | 성공 중복 없음·원본 만료 정책 준수 |

## 도면 대응

현행 상세 도면 ERD-01~32는 이 데이터 사전의 엔터티에 대응한다. schedule_occurrences의 status와 reason은 별도 필드이며 만료는 SKIPPED / EXPIRED로 저장한다. 요약 ERD는 선택된 관계만 표시하며 전체 외래키나 복합 소유권 제약을 대체하지 않는다.


---

# 기능별 설계 연결표

원본 기능 목록에서 필수·추가 MVP를 추출해 동일 ID로 연결했다. EXCLUDE·DESKTOP은 이번 완료 판정에서 제외한다. 각 API·테이블·화면·흐름·검증 ID의 존재를 문서 검수로 확인한다. 이것은 동작 테스트 통과 표시가 아니다. API가 없는 비회원·화면 모드 기능은 로컬 계약을 적용한다.

| 기능 | 단계 | 화면 | 흐름 | API / 로컬 | 데이터 | 검증 |
|---|---|---|---|---|---|---|
| AUTH-01 회원가입 | 필수 | SIGNUP-01 | TF-12 | API-AUTH-01, API-AUTH-02, API-AUTH-03, API-AUTH-04, API-AUTH-06, API-AUTH-07, API-AUTH-08, API-AUTH-09, API-AUTH-10, API-AUTH-11, API-AUTH-12, API-AUTH-13, API-AUTH-14 | users, auth_identities, auth_challenges, web_sessions | AC-AUTH-01-01, AC-AUTH-01-02, AC-AUTH-01-03 |
| AUTH-02 로그인 | 필수 | LOGIN-01 | TF-12 | API-AUTH-01, API-AUTH-02, API-AUTH-03, API-AUTH-04, API-AUTH-06, API-AUTH-07, API-AUTH-08, API-AUTH-09, API-AUTH-10, API-AUTH-11, API-AUTH-12, API-AUTH-13, API-AUTH-14 | users, auth_identities, auth_challenges, web_sessions | AC-AUTH-02-01, AC-AUTH-02-02, AC-AUTH-02-03 |
| AUTH-03 로그아웃 | 필수 | SETTING-01 | TF-13 | API-SESSION-06, API-EXEC-02, API-EXT-06, API-AUTH-05 | focus_sessions, extension_installations, web_sessions | AC-AUTH-03-01, AC-AUTH-03-02, AC-AUTH-03-03 |
| DASH-01 집중 현황 조회 | 필수 | DASH-01 | TF-10 | API-STAT-01, API-STAT-02, API-DASH-01 | access_events, focus_sessions, session_intervals | AC-DASH-01-01, AC-DASH-01-02, AC-DASH-01-03 |
| SITE-01 사이트 목록 조회 | 필수 | SITE-01 | TF-01, TF-02, TF-03, TF-04 | API-SITE-01, API-SITE-02, API-SITE-03, API-SITE-04, API-SITE-05 | sites, site_feature_policies | AC-SITE-01-01, AC-SITE-01-02, AC-SITE-01-03 |
| SITE-02 사이트 등록 | 필수 | SITE-02 | TF-01, TF-02, TF-03, TF-04 | API-SITE-01, API-SITE-02, API-SITE-03, API-SITE-04, API-SITE-05 | sites, site_feature_policies | AC-SITE-02-01, AC-SITE-02-02, AC-SITE-02-03 |
| SITE-03 사이트 수정 | 필수 | SITE-02 | TF-01, TF-02, TF-03, TF-04 | API-SITE-01, API-SITE-02, API-SITE-03, API-SITE-04, API-SITE-05 | sites, site_feature_policies | AC-SITE-03-01, AC-SITE-03-02, AC-SITE-03-03 |
| SITE-04 사이트 삭제 | 필수 | SITE-01 | TF-01, TF-02, TF-03, TF-04 | API-SITE-01, API-SITE-02, API-SITE-03, API-SITE-04, API-SITE-05 | sites, site_feature_policies | AC-SITE-04-01, AC-SITE-04-02, AC-SITE-04-03 |
| SITE-05 사이트 분류 | 필수 | SITE-02 | TF-01, TF-02, TF-03, TF-04 | API-SITE-01, API-SITE-02, API-SITE-03, API-SITE-04, API-SITE-05 | sites, site_feature_policies | AC-SITE-05-01, AC-SITE-05-02, AC-SITE-05-03 |
| POLICY-01 차단 정책 설정 | 필수 | SITE-02 | TF-04, TF-08, TF-A01 | API-SITE-04, API-SESSION-05, API-EXEC-01, API-EXEC-02 | site_feature_policies, policy_snapshots, access_events | AC-POLICY-01-01, AC-POLICY-01-02, AC-POLICY-01-03 |
| POLICY-02 기록 정책 설정 | 필수 | SITE-02 | TF-04, TF-08, TF-A01 | API-SITE-04, API-SESSION-05, API-EXEC-01, API-EXEC-02 | site_feature_policies, policy_snapshots, access_events | AC-POLICY-02-01, AC-POLICY-02-02, AC-POLICY-02-03 |
| POLICY-03 유튜브 쇼츠 차단 | 필수 | SITE-02 | TF-04, TF-08, TF-A01 | API-SITE-04, API-SESSION-05, API-EXEC-01, API-EXEC-02 | site_feature_policies, policy_snapshots, access_events | AC-POLICY-03-01, AC-POLICY-03-02, AC-POLICY-03-03 |
| SESSION-01 세션 시작 | 필수 | SESSION-01 | TF-05, TF-06, TF-07 | API-SESSION-01, API-SESSION-02, API-SESSION-03, API-SESSION-04, API-SESSION-05, API-SESSION-06, API-EXEC-01, API-EXEC-02, API-EXEC-03 | focus_sessions, policy_snapshots, active_execution_locks, session_intervals | AC-SESSION-01-01, AC-SESSION-01-02, AC-SESSION-01-03 |
| SESSION-02 세션 종료 | 필수 | SESSION-01 | TF-05, TF-06, TF-07 | API-SESSION-01, API-SESSION-02, API-SESSION-03, API-SESSION-04, API-SESSION-05, API-SESSION-06, API-EXEC-01, API-EXEC-02, API-EXEC-03 | focus_sessions, policy_snapshots, active_execution_locks, session_intervals | AC-SESSION-02-01, AC-SESSION-02-02, AC-SESSION-02-03 |
| SESSION-03 세션 상태 확인 | 필수 | SESSION-01 | TF-05, TF-06, TF-07 | API-SESSION-01, API-SESSION-02, API-SESSION-03, API-SESSION-04, API-SESSION-05, API-SESSION-06, API-EXEC-01, API-EXEC-02, API-EXEC-03 | focus_sessions, policy_snapshots, active_execution_locks, session_intervals | AC-SESSION-03-01, AC-SESSION-03-02, AC-SESSION-03-03 |
| SESSION-04 사이트 전체 차단 적용 | 필수 | SESSION-01 | TF-05, TF-06, TF-07 | API-SESSION-01, API-SESSION-02, API-SESSION-03, API-SESSION-04, API-SESSION-05, API-SESSION-06, API-EXEC-01, API-EXEC-02, API-EXEC-03 | focus_sessions, policy_snapshots, active_execution_locks, session_intervals | AC-SESSION-04-01, AC-SESSION-04-02, AC-SESSION-04-03 |
| EVENT-01 차단 사이트 접근 기록 | 필수 | LOG-01 | TF-08, TF-09 | API-EVENT-01, API-EVENT-02, API-LOG-01, API-LOG-02 | event_receipts, access_events, session_lifecycle_events | AC-EVENT-01-01, AC-EVENT-01-02, AC-EVENT-01-03 |
| EVENT-02 기록 대상 접근 저장 | 필수 | LOG-01 | TF-08, TF-09 | API-EVENT-01, API-EVENT-02, API-LOG-01, API-LOG-02 | event_receipts, access_events, session_lifecycle_events | AC-EVENT-02-01, AC-EVENT-02-02, AC-EVENT-02-03 |
| EVENT-03 내부 기능 접근 기록 | 필수 | LOG-01 | TF-08, TF-09 | API-EVENT-01, API-EVENT-02, API-LOG-01, API-LOG-02 | event_receipts, access_events, session_lifecycle_events | AC-EVENT-03-01, AC-EVENT-03-02, AC-EVENT-03-03 |
| EVENT-04 반복 접근 구분 | 필수 | LOG-01 | TF-08, TF-09 | API-EVENT-01, API-EVENT-02, API-LOG-01, API-LOG-02 | event_receipts, access_events, session_lifecycle_events | AC-EVENT-04-01, AC-EVENT-04-02, AC-EVENT-04-03 |
| LOG-01 기록 목록 조회 | 필수 | LOG-01 | TF-09 | API-LOG-01, API-LOG-02 | access_events, policy_snapshots | AC-LOG-01-01, AC-LOG-01-02, AC-LOG-01-03 |
| LOG-02 기록 상세 조회 | 필수 | LOG-02 | TF-09 | API-LOG-01, API-LOG-02 | access_events, policy_snapshots | AC-LOG-02-01, AC-LOG-02-02, AC-LOG-02-03 |
| STAT-01 기본 통계 조회 | 필수 | STAT-01 | TF-10 | API-STAT-01, API-STAT-02, API-DASH-01 | access_events, focus_sessions, session_intervals | AC-STAT-01-01, AC-STAT-01-02, AC-STAT-01-03 |
| STAT-02 사이트별 통계 | 필수 | STAT-01 | TF-10 | API-STAT-01, API-STAT-02, API-DASH-01 | access_events, focus_sessions, session_intervals | AC-STAT-02-01, AC-STAT-02-02, AC-STAT-02-03 |
| SETTING-01 정책 조정 | 필수 | SITE-02, STAT-01, LOG-02 | TF-01, TF-02, TF-03, TF-04 | API-SITE-01, API-SITE-02, API-SITE-03, API-SITE-04, API-SITE-05 | sites, site_feature_policies | AC-SETTING-01-01, AC-SETTING-01-02, AC-SETTING-01-03 |
| EXT-01 정책 동기화 | 필수 | EXT-01 | TF-05, TF-08, TF-13 | API-EXT-01, API-EXT-02, API-EXT-03, API-EXT-04, API-EXT-05, API-EXT-06, API-EXT-07, API-EXEC-01, API-EXEC-02, API-EXEC-03, API-EVENT-01, API-EVENT-02 | extension_installations, execution_commands, execution_reports | AC-EXT-01-01, AC-EXT-01-02, AC-EXT-01-03 |
| EXT-02 접근 제한 적용 | 필수 | EXT-01 | TF-05, TF-08, TF-13 | API-EXT-01, API-EXT-02, API-EXT-03, API-EXT-04, API-EXT-05, API-EXT-06, API-EXT-07, API-EXEC-01, API-EXEC-02, API-EXEC-03, API-EVENT-01, API-EVENT-02 | extension_installations, execution_commands, execution_reports | AC-EXT-02-01, AC-EXT-02-02, AC-EXT-02-03 |
| EXT-03 이벤트 전송 | 필수 | EXT-01 | TF-05, TF-08, TF-13 | API-EXT-01, API-EXT-02, API-EXT-03, API-EXT-04, API-EXT-05, API-EXT-06, API-EXT-07, API-EXEC-01, API-EXEC-02, API-EXEC-03, API-EVENT-01, API-EVENT-02 | extension_installations, execution_commands, execution_reports | AC-EXT-03-01, AC-EXT-03-02, AC-EXT-03-03 |
| OPTION-01 추천 콘텐츠 제한 | 추가 | FEATURE-01 | TF-04, TF-08, TF-A01 | API-SITE-04, API-SESSION-05, API-EXEC-01, API-EXEC-02 | site_feature_policies, policy_snapshots, access_events | AC-OPTION-01-01, AC-OPTION-01-02, AC-OPTION-01-03 |
| OPTION-02 댓글 제한 | 추가 | FEATURE-01 | TF-04, TF-08, TF-A01 | API-SITE-04, API-SESSION-05, API-EXEC-01, API-EXEC-02 | site_feature_policies, policy_snapshots, access_events | AC-OPTION-02-01, AC-OPTION-02-02, AC-OPTION-02-03 |
| OPTION-03 자동재생 제한 | 추가 | FEATURE-01 | TF-04, TF-08, TF-A01 | API-SITE-04, API-SESSION-05, API-EXEC-01, API-EXEC-02 | site_feature_policies, policy_snapshots, access_events | AC-OPTION-03-01, AC-OPTION-03-02, AC-OPTION-03-03 |
| OPTION-04 집중 예약 | 추가 | SCHEDULE-01 | TF-A02 | API-SCHEDULE-01, API-SCHEDULE-02, API-SCHEDULE-03, API-SCHEDULE-04, API-SCHEDULE-05, API-SCHEDULE-06 | schedules, schedule_occurrences, focus_sessions | AC-OPTION-04-01, AC-OPTION-04-02, AC-OPTION-04-03 |
| SETTING-02 화면 모드 전환 | 필수 | SETTING-01 | TF-14 | Web 공통 테마만 | 로컬 preferences | AC-SETTING-02-01, AC-SETTING-02-02, AC-SETTING-02-03 |
| OPTION-05 지원 서비스 확대 | 추가 | FEATURE-01 | TF-04, TF-08, TF-A01 | API-SITE-04, API-SESSION-05, API-EXEC-01, API-EXEC-02 | site_feature_policies, policy_snapshots, access_events | AC-OPTION-05-01, AC-OPTION-05-02, AC-OPTION-05-03 |
| OPTION-06 사이트 이용 시간 | 추가 | ANALYSIS-01 | TF-A03 | API-USAGE-01, API-STAT-01, API-STAT-02, API-STAT-03, API-STAT-04, API-POLICY-01, API-POLICY-02 | usage_segments, session_intervals, access_events | AC-OPTION-06-01, AC-OPTION-06-02, AC-OPTION-06-03 |
| OPTION-07 행동 기반 지표 | 추가 | ANALYSIS-01 | TF-A03 | API-USAGE-01, API-STAT-01, API-STAT-02, API-STAT-03, API-STAT-04, API-POLICY-01, API-POLICY-02 | usage_segments, session_intervals, access_events | AC-OPTION-07-01, AC-OPTION-07-02, AC-OPTION-07-03 |
| OPTION-08 시간대별 패턴·확장 분석 | 추가 | STAT-01, ANALYSIS-01 | TF-A03 | API-USAGE-01, API-STAT-01, API-STAT-02, API-STAT-03, API-STAT-04, API-POLICY-01, API-POLICY-02 | usage_segments, session_intervals, access_events | AC-OPTION-08-01, AC-OPTION-08-02, AC-OPTION-08-03 |
| OPTION-09 키워드 제한 | 추가 | KEYWORD-01 | TF-A04 | API-POLICY-01, API-POLICY-02, API-CAP-01, API-EVENT-01 | content_policies, policy_snapshots, access_events | AC-OPTION-09-01, AC-OPTION-09-02, AC-OPTION-09-03 |
| OPTION-10 성인 사이트 제한 | 추가 | SAFETY-01 | TF-A05 | API-POLICY-01, API-POLICY-02, API-CAT-01, API-EVENT-01 | content_policies, catalog_versions, access_events | AC-OPTION-10-01, AC-OPTION-10-02, AC-OPTION-10-03 |
| OPTION-11 민감 이미지 블러 | 추가 | BLUR-01 | TF-A06 | API-POLICY-01, API-POLICY-02, API-CAP-01 | content_policies, model_profiles | AC-OPTION-11-01, AC-OPTION-11-02, AC-OPTION-11-03 |
| OPTION-12 행동 기반 AI 피드백 | 추가 | ANALYSIS-01 | TF-A07 | API-AI-01, API-AI-02, API-AI-03, API-AI-04, API-STAT-04 | analysis_jobs, analysis_results, analysis_consents | AC-OPTION-12-01, AC-OPTION-12-02, AC-OPTION-12-03 |
| SESSION-05 일시정지·재개 | 추가 | SESSION-01 | TF-A08, TF-07 | API-SESSION-07, API-SESSION-08, API-SESSION-06, API-EXEC-02 | focus_sessions, session_intervals, execution_commands | AC-SESSION-05-01, AC-SESSION-05-02, AC-SESSION-05-03 |
| SESSION-06 세션 메모 | 추가 | SESSION-01 | TF-A09 | API-NOTE-01, API-NOTE-02 | session_notes | AC-SESSION-06-01, AC-SESSION-06-02, AC-SESSION-06-03 |
| AUTH-04 로그인 없이 시작 | 필수 | EXT-01 | TF-06 | EXT 로컬 동일 검증/owner별 저장 | 로컬 sessions, 로컬 owner_settings | AC-AUTH-04-01, AC-AUTH-04-02, AC-AUTH-04-03 |
| AUTH-05 소셜 로그인 | 필수 | LOGIN-01, SIGNUP-01, EXT-01 | TF-12 | API-AUTH-01, API-AUTH-02, API-AUTH-03, API-AUTH-04, API-AUTH-06, API-AUTH-07, API-AUTH-08, API-AUTH-09, API-AUTH-10, API-AUTH-11, API-AUTH-12, API-AUTH-13, API-AUTH-14 | users, auth_identities, auth_challenges, web_sessions | AC-AUTH-05-01, AC-AUTH-05-02, AC-AUTH-05-03 |
| IMPORT-01 가져올 자료 선택 | 필수 | EXT-01, SETTING-01 | TF-11 | API-IMPORT-01, API-IMPORT-02, API-IMPORT-03, API-IMPORT-04 | guest_import_batches, guest_import_items, focus_sessions | AC-IMPORT-01-01, AC-IMPORT-01-02, AC-IMPORT-01-03 |
| IMPORT-02 가져오기 처리·복구 | 필수 | EXT-01 | TF-11 | API-IMPORT-01, API-IMPORT-02, API-IMPORT-03, API-IMPORT-04 | guest_import_batches, guest_import_items, focus_sessions | AC-IMPORT-02-01, AC-IMPORT-02-02, AC-IMPORT-02-03 |

## 이용 위치

| 기능 | 회원 | 비회원 |
|---|---|---|
| AUTH-01 | 회원 Web·Extension | 가입·로그인 진입만 |
| AUTH-02 | 회원 Web·Extension | 가입·로그인 진입만 |
| AUTH-03 | 회원 Web·Extension | 전환 결과 |
| DASH-01 | 회원 Web·Extension | Extension 로컬 |
| SITE-01 | 회원 Web·Extension | Extension 로컬 |
| SITE-02 | 회원 Web·Extension | Extension 로컬 |
| SITE-03 | 회원 Web·Extension | Extension 로컬 |
| SITE-04 | 회원 Web·Extension | Extension 로컬 |
| SITE-05 | 회원 Web·Extension | Extension 로컬 |
| POLICY-01 | 회원 Web·Extension | Extension 로컬 |
| POLICY-02 | 회원 Web·Extension | Extension 로컬 |
| POLICY-03 | 회원 Web·Extension | Extension 로컬 |
| SESSION-01 | 회원 Web·Extension | Extension 로컬 |
| SESSION-02 | 회원 Web·Extension | Extension 로컬 |
| SESSION-03 | 회원 Web·Extension | Extension 로컬 |
| SESSION-04 | 회원 Web·Extension | Extension 로컬 |
| EVENT-01 | 회원 Web·Extension | Extension 로컬 |
| EVENT-02 | 회원 Web·Extension | Extension 로컬 |
| EVENT-03 | 회원 Web·Extension | Extension 로컬 |
| EVENT-04 | 회원 Web·Extension | Extension 로컬 |
| LOG-01 | 회원 Web·Extension | Extension 로컬 |
| LOG-02 | 회원 Web·Extension | Extension 로컬 |
| STAT-01 | 회원 Web·Extension | Extension 로컬 |
| STAT-02 | 회원 Web·Extension | Extension 로컬 |
| SETTING-01 | 회원 Web·Extension | Extension 로컬 |
| EXT-01 | 회원 Web·Extension | Extension 로컬 |
| EXT-02 | 회원 Web·Extension | Extension 로컬 |
| EXT-03 | 회원 Web·Extension | Extension 로컬 |
| OPTION-01 | 회원 Web·Extension | Extension 로컬 |
| OPTION-02 | 회원 Web·Extension | Extension 로컬 |
| OPTION-03 | 회원 Web·Extension | Extension 로컬 |
| OPTION-04 | 회원 Web·Extension | Extension 로컬 |
| SETTING-02 | Web 로컬 | Web 공통 테마만 |
| OPTION-05 | 회원 Web·Extension | Extension 로컬 |
| OPTION-06 | 회원 Web·Extension | Extension 로컬 |
| OPTION-07 | 회원 Web·Extension | Extension 로컬 |
| OPTION-08 | 회원 Web·Extension | Extension 로컬 |
| OPTION-09 | 회원 Web·Extension | Extension 로컬 |
| OPTION-10 | 회원 Web·Extension | Extension 로컬 |
| OPTION-11 | 회원 Web·Extension | Extension 로컬 |
| OPTION-12 | 회원 Web·Extension | 계정 필요; 로컬 기본 분석은 별도 |
| SESSION-05 | 회원 Web·Extension | Extension 로컬 |
| SESSION-06 | 회원 Web·Extension | Extension 로컬 |
| AUTH-04 | 회원 Web·Extension | Extension 로컬 |
| AUTH-05 | 회원 Web·Extension | 가입·로그인 진입만 |
| IMPORT-01 | 회원 Web·Extension | Extension 로컬 |
| IMPORT-02 | 회원 Web·Extension | Extension 로컬 |


---

# 검증 기준 — 실행 전 명세

상태는 모두 미실행이다. 구현·API 호출·브라우저 기능·모델·성능 테스트를 수행한 결과가 아니다. 테스트 담당자는 각 조건을 재현하고 실제 결과·증거·결함 ID를 기록한다. 기능별 세 가지 수용 조건과 아래 공통 경계 사례를 모두 만족해야 한다.

| 검증 ID | 기능 | 구분 | 진입 조건 | 기대 결과 | 실행 상태 |
|---|---|---|---|---|---|
| AC-AUTH-01-01 | AUTH-01 | 정상 | 회원가입 화면/실행 경로에서 해당 조건 발생 | 인증 성공 후 동일 계정으로 진입하고 최초 소셜은 가입 확인 후 생성 | 미실행 |
| AC-AUTH-01-02 | AUTH-01 | 오류·경계 | 회원가입 화면/실행 경로에서 해당 조건 발생 | 인증 실패·취소·state 불일치 때 회원/세션 생성 안 함 | 미실행 |
| AC-AUTH-01-03 | AUTH-01 | 복구·중복 | 회원가입 화면/실행 경로에서 해당 조건 발생 | 중복 callback·인증 요청 재처리로 계정 중복 생성 안 함 | 미실행 |
| AC-AUTH-02-01 | AUTH-02 | 정상 | 로그인 화면/실행 경로에서 해당 조건 발생 | 인증 성공 후 동일 계정으로 진입하고 최초 소셜은 가입 확인 후 생성 | 미실행 |
| AC-AUTH-02-02 | AUTH-02 | 오류·경계 | 로그인 화면/실행 경로에서 해당 조건 발생 | 인증 실패·취소·state 불일치 때 회원/세션 생성 안 함 | 미실행 |
| AC-AUTH-02-03 | AUTH-02 | 복구·중복 | 로그인 화면/실행 경로에서 해당 조건 발생 | 중복 callback·인증 요청 재처리로 계정 중복 생성 안 함 | 미실행 |
| AC-AUTH-03-01 | AUTH-03 | 정상 | 로그아웃 화면/실행 경로에서 해당 조건 발생 | 회원 세션 해제 확인 후 비회원 전환, 회원 자료 보존 | 미실행 |
| AC-AUTH-03-02 | AUTH-03 | 오류·경계 | 로그아웃 화면/실행 경로에서 해당 조건 발생 | 해제 미확인 시 완료 표시하지 않음 | 미실행 |
| AC-AUTH-03-03 | AUTH-03 | 복구·중복 | 로그아웃 화면/실행 경로에서 해당 조건 발생 | A 로그아웃→B 로그인에도 A outbox 유지, A 재인증 후만 전송 | 미실행 |
| AC-DASH-01-01 | DASH-01 | 정상 | 집중 현황 조회 화면/실행 경로에서 해당 조건 발생 | 확인된 RUN 시간·접근·반복 표시 | 미실행 |
| AC-DASH-01-02 | DASH-01 | 오류·경계 | 집중 현황 조회 화면/실행 경로에서 해당 조건 발생 | 분모0은 비율null, 미확인은0으로 채우지 않음 | 미실행 |
| AC-DASH-01-03 | DASH-01 | 복구·중복 | 집중 현황 조회 화면/실행 경로에서 해당 조건 발생 | 지연 이벤트를 발생 날짜에 반영 | 미실행 |
| AC-SITE-01-01 | SITE-01 | 정상 | 사이트 목록 조회 화면/실행 경로에서 해당 조건 발생 | 설정 저장 후 목록 반영, 현 세션 스냅샷 유지 | 미실행 |
| AC-SITE-01-02 | SITE-01 | 오류·경계 | 사이트 목록 조회 화면/실행 경로에서 해당 조건 발생 | 중복 도메인·잘못된 정책 조합 거절 | 미실행 |
| AC-SITE-01-03 | SITE-01 | 복구·중복 | 사이트 목록 조회 화면/실행 경로에서 해당 조건 발생 | 응답 유실 재시도는 같은 결과; 삭제 후 과거 기록 유지 | 미실행 |
| AC-SITE-02-01 | SITE-02 | 정상 | 사이트 등록 화면/실행 경로에서 해당 조건 발생 | 설정 저장 후 목록 반영, 현 세션 스냅샷 유지 | 미실행 |
| AC-SITE-02-02 | SITE-02 | 오류·경계 | 사이트 등록 화면/실행 경로에서 해당 조건 발생 | 중복 도메인·잘못된 정책 조합 거절 | 미실행 |
| AC-SITE-02-03 | SITE-02 | 복구·중복 | 사이트 등록 화면/실행 경로에서 해당 조건 발생 | 응답 유실 재시도는 같은 결과; 삭제 후 과거 기록 유지 | 미실행 |
| AC-SITE-03-01 | SITE-03 | 정상 | 사이트 수정 화면/실행 경로에서 해당 조건 발생 | 설정 저장 후 목록 반영, 현 세션 스냅샷 유지 | 미실행 |
| AC-SITE-03-02 | SITE-03 | 오류·경계 | 사이트 수정 화면/실행 경로에서 해당 조건 발생 | 중복 도메인·잘못된 정책 조합 거절 | 미실행 |
| AC-SITE-03-03 | SITE-03 | 복구·중복 | 사이트 수정 화면/실행 경로에서 해당 조건 발생 | 응답 유실 재시도는 같은 결과; 삭제 후 과거 기록 유지 | 미실행 |
| AC-SITE-04-01 | SITE-04 | 정상 | 사이트 삭제 화면/실행 경로에서 해당 조건 발생 | 설정 저장 후 목록 반영, 현 세션 스냅샷 유지 | 미실행 |
| AC-SITE-04-02 | SITE-04 | 오류·경계 | 사이트 삭제 화면/실행 경로에서 해당 조건 발생 | 중복 도메인·잘못된 정책 조합 거절 | 미실행 |
| AC-SITE-04-03 | SITE-04 | 복구·중복 | 사이트 삭제 화면/실행 경로에서 해당 조건 발생 | 응답 유실 재시도는 같은 결과; 삭제 후 과거 기록 유지 | 미실행 |
| AC-SITE-05-01 | SITE-05 | 정상 | 사이트 분류 화면/실행 경로에서 해당 조건 발생 | 설정 저장 후 목록 반영, 현 세션 스냅샷 유지 | 미실행 |
| AC-SITE-05-02 | SITE-05 | 오류·경계 | 사이트 분류 화면/실행 경로에서 해당 조건 발생 | 중복 도메인·잘못된 정책 조합 거절 | 미실행 |
| AC-SITE-05-03 | SITE-05 | 복구·중복 | 사이트 분류 화면/실행 경로에서 해당 조건 발생 | 응답 유실 재시도는 같은 결과; 삭제 후 과거 기록 유지 | 미실행 |
| AC-POLICY-01-01 | POLICY-01 | 정상 | 차단 정책 설정 화면/실행 경로에서 해당 조건 발생 | 대상 기능만 제한하고 전체 차단 우선 | 미실행 |
| AC-POLICY-01-02 | POLICY-01 | 오류·경계 | 차단 정책 설정 화면/실행 경로에서 해당 조건 발생 | 실제 제한 실패는 성공 접근 통계 제외 | 미실행 |
| AC-POLICY-01-03 | POLICY-01 | 복구·중복 | 차단 정책 설정 화면/실행 경로에서 해당 조건 발생 | 정지·종료 시 변경분 복원, 중복 관찰은 한 접근 | 미실행 |
| AC-POLICY-02-01 | POLICY-02 | 정상 | 기록 정책 설정 화면/실행 경로에서 해당 조건 발생 | 대상 기능만 제한하고 전체 차단 우선 | 미실행 |
| AC-POLICY-02-02 | POLICY-02 | 오류·경계 | 기록 정책 설정 화면/실행 경로에서 해당 조건 발생 | 실제 제한 실패는 성공 접근 통계 제외 | 미실행 |
| AC-POLICY-02-03 | POLICY-02 | 복구·중복 | 기록 정책 설정 화면/실행 경로에서 해당 조건 발생 | 정지·종료 시 변경분 복원, 중복 관찰은 한 접근 | 미실행 |
| AC-POLICY-03-01 | POLICY-03 | 정상 | 유튜브 쇼츠 차단 화면/실행 경로에서 해당 조건 발생 | 대상 기능만 제한하고 전체 차단 우선 | 미실행 |
| AC-POLICY-03-02 | POLICY-03 | 오류·경계 | 유튜브 쇼츠 차단 화면/실행 경로에서 해당 조건 발생 | 실제 제한 실패는 성공 접근 통계 제외 | 미실행 |
| AC-POLICY-03-03 | POLICY-03 | 복구·중복 | 유튜브 쇼츠 차단 화면/실행 경로에서 해당 조건 발생 | 정지·종료 시 변경분 복원, 중복 관찰은 한 접근 | 미실행 |
| AC-SESSION-01-01 | SESSION-01 | 정상 | 세션 시작 화면/실행 경로에서 해당 조건 발생 | 실제 적용 후 진행, 해제 후 종료 | 미실행 |
| AC-SESSION-01-02 | SESSION-01 | 오류·경계 | 세션 시작 화면/실행 경로에서 해당 조건 발생 | 중복 시작·미연결 실행 거절, 시작 취소 버튼 없음 | 미실행 |
| AC-SESSION-01-03 | SESSION-01 | 복구·중복 | 세션 시작 화면/실행 경로에서 해당 조건 발생 | 늦은 적용 보고가 종료 의도를 되돌리지 않음 | 미실행 |
| AC-SESSION-02-01 | SESSION-02 | 정상 | 세션 종료 화면/실행 경로에서 해당 조건 발생 | 실제 적용 후 진행, 해제 후 종료 | 미실행 |
| AC-SESSION-02-02 | SESSION-02 | 오류·경계 | 세션 종료 화면/실행 경로에서 해당 조건 발생 | 중복 시작·미연결 실행 거절, 시작 취소 버튼 없음 | 미실행 |
| AC-SESSION-02-03 | SESSION-02 | 복구·중복 | 세션 종료 화면/실행 경로에서 해당 조건 발생 | 늦은 적용 보고가 종료 의도를 되돌리지 않음 | 미실행 |
| AC-SESSION-03-01 | SESSION-03 | 정상 | 세션 상태 확인 화면/실행 경로에서 해당 조건 발생 | 실제 적용 후 진행, 해제 후 종료 | 미실행 |
| AC-SESSION-03-02 | SESSION-03 | 오류·경계 | 세션 상태 확인 화면/실행 경로에서 해당 조건 발생 | 중복 시작·미연결 실행 거절, 시작 취소 버튼 없음 | 미실행 |
| AC-SESSION-03-03 | SESSION-03 | 복구·중복 | 세션 상태 확인 화면/실행 경로에서 해당 조건 발생 | 늦은 적용 보고가 종료 의도를 되돌리지 않음 | 미실행 |
| AC-SESSION-04-01 | SESSION-04 | 정상 | 사이트 전체 차단 적용 화면/실행 경로에서 해당 조건 발생 | 실제 적용 후 진행, 해제 후 종료 | 미실행 |
| AC-SESSION-04-02 | SESSION-04 | 오류·경계 | 사이트 전체 차단 적용 화면/실행 경로에서 해당 조건 발생 | 중복 시작·미연결 실행 거절, 시작 취소 버튼 없음 | 미실행 |
| AC-SESSION-04-03 | SESSION-04 | 복구·중복 | 사이트 전체 차단 적용 화면/실행 경로에서 해당 조건 발생 | 늦은 적용 보고가 종료 의도를 되돌리지 않음 | 미실행 |
| AC-EVENT-01-01 | EVENT-01 | 정상 | 차단 사이트 접근 기록 화면/실행 경로에서 해당 조건 발생 | 전체3·반복2, 반복은 별도 합산하지 않음 | 미실행 |
| AC-EVENT-01-02 | EVENT-01 | 오류·경계 | 차단 사이트 접근 기록 화면/실행 경로에서 해당 조건 발생 | 차단 안내·자동 렌더·다른 계정 이벤트 제외 | 미실행 |
| AC-EVENT-01-03 | EVENT-01 | 복구·중복 | 차단 사이트 접근 기록 화면/실행 경로에서 해당 조건 발생 | 같은 ID 재전송 및 역순 도착 후 동일 집계 | 미실행 |
| AC-EVENT-02-01 | EVENT-02 | 정상 | 기록 대상 접근 저장 화면/실행 경로에서 해당 조건 발생 | 전체3·반복2, 반복은 별도 합산하지 않음 | 미실행 |
| AC-EVENT-02-02 | EVENT-02 | 오류·경계 | 기록 대상 접근 저장 화면/실행 경로에서 해당 조건 발생 | 차단 안내·자동 렌더·다른 계정 이벤트 제외 | 미실행 |
| AC-EVENT-02-03 | EVENT-02 | 복구·중복 | 기록 대상 접근 저장 화면/실행 경로에서 해당 조건 발생 | 같은 ID 재전송 및 역순 도착 후 동일 집계 | 미실행 |
| AC-EVENT-03-01 | EVENT-03 | 정상 | 내부 기능 접근 기록 화면/실행 경로에서 해당 조건 발생 | 전체3·반복2, 반복은 별도 합산하지 않음 | 미실행 |
| AC-EVENT-03-02 | EVENT-03 | 오류·경계 | 내부 기능 접근 기록 화면/실행 경로에서 해당 조건 발생 | 차단 안내·자동 렌더·다른 계정 이벤트 제외 | 미실행 |
| AC-EVENT-03-03 | EVENT-03 | 복구·중복 | 내부 기능 접근 기록 화면/실행 경로에서 해당 조건 발생 | 같은 ID 재전송 및 역순 도착 후 동일 집계 | 미실행 |
| AC-EVENT-04-01 | EVENT-04 | 정상 | 반복 접근 구분 화면/실행 경로에서 해당 조건 발생 | 전체3·반복2, 반복은 별도 합산하지 않음 | 미실행 |
| AC-EVENT-04-02 | EVENT-04 | 오류·경계 | 반복 접근 구분 화면/실행 경로에서 해당 조건 발생 | 차단 안내·자동 렌더·다른 계정 이벤트 제외 | 미실행 |
| AC-EVENT-04-03 | EVENT-04 | 복구·중복 | 반복 접근 구분 화면/실행 경로에서 해당 조건 발생 | 같은 ID 재전송 및 역순 도착 후 동일 집계 | 미실행 |
| AC-LOG-01-01 | LOG-01 | 정상 | 기록 목록 조회 화면/실행 경로에서 해당 조건 발생 | 선택 기간과 당시 정책의 기록 조회 | 미실행 |
| AC-LOG-01-02 | LOG-01 | 오류·경계 | 기록 목록 조회 화면/실행 경로에서 해당 조건 발생 | 0건과 조회 실패·미수집 구분 | 미실행 |
| AC-LOG-01-03 | LOG-01 | 복구·중복 | 기록 목록 조회 화면/실행 경로에서 해당 조건 발생 | 삭제된 사이트도 과거 대상·정책 표시 | 미실행 |
| AC-LOG-02-01 | LOG-02 | 정상 | 기록 상세 조회 화면/실행 경로에서 해당 조건 발생 | 선택 기간과 당시 정책의 기록 조회 | 미실행 |
| AC-LOG-02-02 | LOG-02 | 오류·경계 | 기록 상세 조회 화면/실행 경로에서 해당 조건 발생 | 0건과 조회 실패·미수집 구분 | 미실행 |
| AC-LOG-02-03 | LOG-02 | 복구·중복 | 기록 상세 조회 화면/실행 경로에서 해당 조건 발생 | 삭제된 사이트도 과거 대상·정책 표시 | 미실행 |
| AC-STAT-01-01 | STAT-01 | 정상 | 기본 통계 조회 화면/실행 경로에서 해당 조건 발생 | 확인된 RUN 시간·접근·반복 표시 | 미실행 |
| AC-STAT-01-02 | STAT-01 | 오류·경계 | 기본 통계 조회 화면/실행 경로에서 해당 조건 발생 | 분모0은 비율null, 미확인은0으로 채우지 않음 | 미실행 |
| AC-STAT-01-03 | STAT-01 | 복구·중복 | 기본 통계 조회 화면/실행 경로에서 해당 조건 발생 | 지연 이벤트를 발생 날짜에 반영 | 미실행 |
| AC-STAT-02-01 | STAT-02 | 정상 | 사이트별 통계 화면/실행 경로에서 해당 조건 발생 | 확인된 RUN 시간·접근·반복 표시 | 미실행 |
| AC-STAT-02-02 | STAT-02 | 오류·경계 | 사이트별 통계 화면/실행 경로에서 해당 조건 발생 | 분모0은 비율null, 미확인은0으로 채우지 않음 | 미실행 |
| AC-STAT-02-03 | STAT-02 | 복구·중복 | 사이트별 통계 화면/실행 경로에서 해당 조건 발생 | 지연 이벤트를 발생 날짜에 반영 | 미실행 |
| AC-SETTING-01-01 | SETTING-01 | 정상 | 정책 조정 화면/실행 경로에서 해당 조건 발생 | 설정 저장 후 목록 반영, 현 세션 스냅샷 유지 | 미실행 |
| AC-SETTING-01-02 | SETTING-01 | 오류·경계 | 정책 조정 화면/실행 경로에서 해당 조건 발생 | 중복 도메인·잘못된 정책 조합 거절 | 미실행 |
| AC-SETTING-01-03 | SETTING-01 | 복구·중복 | 정책 조정 화면/실행 경로에서 해당 조건 발생 | 응답 유실 재시도는 같은 결과; 삭제 후 과거 기록 유지 | 미실행 |
| AC-EXT-01-01 | EXT-01 | 정상 | 정책 동기화 화면/실행 경로에서 해당 조건 발생 | 현재 소유자·최신 revision의 명령만 실행 | 미실행 |
| AC-EXT-01-02 | EXT-01 | 오류·경계 | 정책 동기화 화면/실행 경로에서 해당 조건 발생 | 다른 설치 토큰·만료 APPLY 거절 | 미실행 |
| AC-EXT-01-03 | EXT-01 | 복구·중복 | 정책 동기화 화면/실행 경로에서 해당 조건 발생 | 재접속은 journal 대조 후 명령 실행 | 미실행 |
| AC-EXT-02-01 | EXT-02 | 정상 | 접근 제한 적용 화면/실행 경로에서 해당 조건 발생 | 현재 소유자·최신 revision의 명령만 실행 | 미실행 |
| AC-EXT-02-02 | EXT-02 | 오류·경계 | 접근 제한 적용 화면/실행 경로에서 해당 조건 발생 | 다른 설치 토큰·만료 APPLY 거절 | 미실행 |
| AC-EXT-02-03 | EXT-02 | 복구·중복 | 접근 제한 적용 화면/실행 경로에서 해당 조건 발생 | 재접속은 journal 대조 후 명령 실행 | 미실행 |
| AC-EXT-03-01 | EXT-03 | 정상 | 이벤트 전송 화면/실행 경로에서 해당 조건 발생 | 현재 소유자·최신 revision의 명령만 실행 | 미실행 |
| AC-EXT-03-02 | EXT-03 | 오류·경계 | 이벤트 전송 화면/실행 경로에서 해당 조건 발생 | 다른 설치 토큰·만료 APPLY 거절 | 미실행 |
| AC-EXT-03-03 | EXT-03 | 복구·중복 | 이벤트 전송 화면/실행 경로에서 해당 조건 발생 | 재접속은 journal 대조 후 명령 실행 | 미실행 |
| AC-OPTION-01-01 | OPTION-01 | 정상 | 추천 콘텐츠 제한 화면/실행 경로에서 해당 조건 발생 | 대상 기능만 제한하고 전체 차단 우선 | 미실행 |
| AC-OPTION-01-02 | OPTION-01 | 오류·경계 | 추천 콘텐츠 제한 화면/실행 경로에서 해당 조건 발생 | 실제 제한 실패는 성공 접근 통계 제외 | 미실행 |
| AC-OPTION-01-03 | OPTION-01 | 복구·중복 | 추천 콘텐츠 제한 화면/실행 경로에서 해당 조건 발생 | 정지·종료 시 변경분 복원, 중복 관찰은 한 접근 | 미실행 |
| AC-OPTION-02-01 | OPTION-02 | 정상 | 댓글 제한 화면/실행 경로에서 해당 조건 발생 | 대상 기능만 제한하고 전체 차단 우선 | 미실행 |
| AC-OPTION-02-02 | OPTION-02 | 오류·경계 | 댓글 제한 화면/실행 경로에서 해당 조건 발생 | 실제 제한 실패는 성공 접근 통계 제외 | 미실행 |
| AC-OPTION-02-03 | OPTION-02 | 복구·중복 | 댓글 제한 화면/실행 경로에서 해당 조건 발생 | 정지·종료 시 변경분 복원, 중복 관찰은 한 접근 | 미실행 |
| AC-OPTION-03-01 | OPTION-03 | 정상 | 자동재생 제한 화면/실행 경로에서 해당 조건 발생 | 대상 기능만 제한하고 전체 차단 우선 | 미실행 |
| AC-OPTION-03-02 | OPTION-03 | 오류·경계 | 자동재생 제한 화면/실행 경로에서 해당 조건 발생 | 실제 제한 실패는 성공 접근 통계 제외 | 미실행 |
| AC-OPTION-03-03 | OPTION-03 | 복구·중복 | 자동재생 제한 화면/실행 경로에서 해당 조건 발생 | 정지·종료 시 변경분 복원, 중복 관찰은 한 접근 | 미실행 |
| AC-OPTION-04-01 | OPTION-04 | 정상 | 집중 예약 화면/실행 경로에서 해당 조건 발생 | 14~15시 예약을14:20 열면15시까지만 실행 | 미실행 |
| AC-OPTION-04-02 | OPTION-04 | 오류·경계 | 집중 예약 화면/실행 경로에서 해당 조건 발생 | 기존 세션이면 대기,15시 이상이면 건너뜀 | 미실행 |
| AC-OPTION-04-03 | OPTION-04 | 복구·중복 | 집중 예약 화면/실행 경로에서 해당 조건 발생 | 중복 claim·재시작에도 발생당 세션1개 | 미실행 |
| AC-SETTING-02-01 | SETTING-02 | 정상 | 화면 모드 전환 화면/실행 경로에서 해당 조건 발생 | 라이트 기본, 변경 즉시 웹 전체 적용 | 미실행 |
| AC-SETTING-02-02 | SETTING-02 | 오류·경계 | 화면 모드 전환 화면/실행 경로에서 해당 조건 발생 | 저장 불가 시 현 화면 적용·지속 저장 실패 안내 | 미실행 |
| AC-SETTING-02-03 | SETTING-02 | 복구·중복 | 화면 모드 전환 화면/실행 경로에서 해당 조건 발생 | 새로고침 후 저장 테마 복구, 계정 자료 영향 없음 | 미실행 |
| AC-OPTION-05-01 | OPTION-05 | 정상 | 지원 서비스 확대 화면/실행 경로에서 해당 조건 발생 | 대상 기능만 제한하고 전체 차단 우선 | 미실행 |
| AC-OPTION-05-02 | OPTION-05 | 오류·경계 | 지원 서비스 확대 화면/실행 경로에서 해당 조건 발생 | 실제 제한 실패는 성공 접근 통계 제외 | 미실행 |
| AC-OPTION-05-03 | OPTION-05 | 복구·중복 | 지원 서비스 확대 화면/실행 경로에서 해당 조건 발생 | 정지·종료 시 변경분 복원, 중복 관찰은 한 접근 | 미실행 |
| AC-OPTION-06-01 | OPTION-06 | 정상 | 사이트 이용 시간 화면/실행 경로에서 해당 조건 발생 | 활성 탭·포커스·비유휴 RUN 구간만 합산 | 미실행 |
| AC-OPTION-06-02 | OPTION-06 | 오류·경계 | 사이트 이용 시간 화면/실행 경로에서 해당 조건 발생 | 겹친 구간·미수집을 시간이나0으로 합산 안 함 | 미실행 |
| AC-OPTION-06-03 | OPTION-06 | 복구·중복 | 사이트 이용 시간 화면/실행 경로에서 해당 조건 발생 | 자정·시간대 경계 분할 후 총합 보존 | 미실행 |
| AC-OPTION-07-01 | OPTION-07 | 정상 | 행동 기반 지표 화면/실행 경로에서 해당 조건 발생 | 활성 탭·포커스·비유휴 RUN 구간만 합산 | 미실행 |
| AC-OPTION-07-02 | OPTION-07 | 오류·경계 | 행동 기반 지표 화면/실행 경로에서 해당 조건 발생 | 겹친 구간·미수집을 시간이나0으로 합산 안 함 | 미실행 |
| AC-OPTION-07-03 | OPTION-07 | 복구·중복 | 행동 기반 지표 화면/실행 경로에서 해당 조건 발생 | 자정·시간대 경계 분할 후 총합 보존 | 미실행 |
| AC-OPTION-08-01 | OPTION-08 | 정상 | 시간대별 패턴·확장 분석 화면/실행 경로에서 해당 조건 발생 | 활성 탭·포커스·비유휴 RUN 구간만 합산 | 미실행 |
| AC-OPTION-08-02 | OPTION-08 | 오류·경계 | 시간대별 패턴·확장 분석 화면/실행 경로에서 해당 조건 발생 | 겹친 구간·미수집을 시간이나0으로 합산 안 함 | 미실행 |
| AC-OPTION-08-03 | OPTION-08 | 복구·중복 | 시간대별 패턴·확장 분석 화면/실행 경로에서 해당 조건 발생 | 자정·시간대 경계 분할 후 총합 보존 | 미실행 |
| AC-OPTION-09-01 | OPTION-09 | 정상 | 키워드 제한 화면/실행 경로에서 해당 조건 발생 | 선택한 범위 NFKC 부분 일치, 예외 host 허용 | 미실행 |
| AC-OPTION-09-02 | OPTION-09 | 오류·경계 | 키워드 제한 화면/실행 경로에서 해당 조건 발생 | 입력 필드·미지원 프레임은 검사 대상 제외/미지원 표시 | 미실행 |
| AC-OPTION-09-03 | OPTION-09 | 복구·중복 | 키워드 제한 화면/실행 경로에서 해당 조건 발생 | SPA 변경 시 검사, 같은 탐색 중복 접근 없음 | 미실행 |
| AC-OPTION-10-01 | OPTION-10 | 정상 | 성인 사이트 제한 화면/실행 경로에서 해당 조건 발생 | 해당 도메인 제한, 전용 예외만 적용 | 미실행 |
| AC-OPTION-10-02 | OPTION-10 | 오류·경계 | 성인 사이트 제한 화면/실행 경로에서 해당 조건 발생 | 유효 목록 없으면 사용 불가, 다른 BLOCK은 예외로 해제 안 함 | 미실행 |
| AC-OPTION-10-03 | OPTION-10 | 복구·중복 | 성인 사이트 제한 화면/실행 경로에서 해당 조건 발생 | 갱신 실패 시 마지막 검증 목록 유지 | 미실행 |
| AC-OPTION-11-01 | OPTION-11 | 정상 | 민감 이미지 블러 화면/실행 경로에서 해당 조건 발생 | 분류에 따라 블러, 클릭 보기·재클릭 가림 | 미실행 |
| AC-OPTION-11-02 | OPTION-11 | 오류·경계 | 민감 이미지 블러 화면/실행 경로에서 해당 조건 발생 | 분석 실패는 실패 가림 상태, 안전 판정 아님 | 미실행 |
| AC-OPTION-11-03 | OPTION-11 | 복구·중복 | 민감 이미지 블러 화면/실행 경로에서 해당 조건 발생 | 이미지 교체 시 보기 상태 초기화, 원본 외부 전송 없음 | 미실행 |
| AC-OPTION-12-01 | OPTION-12 | 정상 | 행동 기반 AI 피드백 화면/실행 경로에서 해당 조건 발생 | 사용자 집계의 근거를 표시하고 설정 제안 | 미실행 |
| AC-OPTION-12-02 | OPTION-12 | 오류·경계 | 행동 기반 AI 피드백 화면/실행 경로에서 해당 조건 발생 | 부족·동의없음·provider 실패를 별도 표시 | 미실행 |
| AC-OPTION-12-03 | OPTION-12 | 복구·중복 | 행동 기반 AI 피드백 화면/실행 경로에서 해당 조건 발생 | 재요청 캐시·기존 결과 보존; 자동 설정 변경 없음 | 미실행 |
| AC-SESSION-05-01 | SESSION-05 | 정상 | 일시정지·재개 화면/실행 경로에서 해당 조건 발생 | 해제 확인 후 정지, 같은 정책 재개, 정지시간 제외 | 미실행 |
| AC-SESSION-05-02 | SESSION-05 | 오류·경계 | 일시정지·재개 화면/실행 경로에서 해당 조건 발생 | 해제/재적용 실패를 완료로 표시 안 함 | 미실행 |
| AC-SESSION-05-03 | SESSION-05 | 복구·중복 | 일시정지·재개 화면/실행 경로에서 해당 조건 발생 | 재개·종료 경합 시 종료 우선, 수동/예약 종료시간 구분 | 미실행 |
| AC-SESSION-06-01 | SESSION-06 | 정상 | 세션 메모 화면/실행 경로에서 해당 조건 발생 | 세션별2000자 이내 메모 저장·조회 | 미실행 |
| AC-SESSION-06-02 | SESSION-06 | 오류·경계 | 세션 메모 화면/실행 경로에서 해당 조건 발생 | 다른 계정·초과 입력 거절, 실패 입력 유지 | 미실행 |
| AC-SESSION-06-03 | SESSION-06 | 복구·중복 | 세션 메모 화면/실행 경로에서 해당 조건 발생 | 412에서 최신값과 편집값 보존 | 미실행 |
| AC-AUTH-04-01 | AUTH-04 | 정상 | 로그인 없이 시작 화면/실행 경로에서 해당 조건 발생 | 계정 없이 로컬 세션·결과 사용 | 미실행 |
| AC-AUTH-04-02 | AUTH-04 | 오류·경계 | 로그인 없이 시작 화면/실행 경로에서 해당 조건 발생 | 로컬 저장 불가 시 성공 표시 안 함 | 미실행 |
| AC-AUTH-04-03 | AUTH-04 | 복구·중복 | 로그인 없이 시작 화면/실행 경로에서 해당 조건 발생 | 재시작 후 소유별 journal 복구; 회원 자료 혼입 없음 | 미실행 |
| AC-AUTH-05-01 | AUTH-05 | 정상 | 소셜 로그인 화면/실행 경로에서 해당 조건 발생 | 인증 성공 후 동일 계정으로 진입하고 최초 소셜은 가입 확인 후 생성 | 미실행 |
| AC-AUTH-05-02 | AUTH-05 | 오류·경계 | 소셜 로그인 화면/실행 경로에서 해당 조건 발생 | 인증 실패·취소·state 불일치 때 회원/세션 생성 안 함 | 미실행 |
| AC-AUTH-05-03 | AUTH-05 | 복구·중복 | 소셜 로그인 화면/실행 경로에서 해당 조건 발생 | 중복 callback·인증 요청 재처리로 계정 중복 생성 안 함 | 미실행 |
| AC-IMPORT-01-01 | IMPORT-01 | 정상 | 가져올 자료 선택 화면/실행 경로에서 해당 조건 발생 | 선택 자료만 가져오고 원본은 원래 만료일까지 유지 | 미실행 |
| AC-IMPORT-01-02 | IMPORT-01 | 오류·경계 | 가져올 자료 선택 화면/실행 경로에서 해당 조건 발생 | 로그인만으로 전송 없음, 타계정 재이전 거절 | 미실행 |
| AC-IMPORT-01-03 | IMPORT-01 | 복구·중복 | 가져올 자료 선택 화면/실행 경로에서 해당 조건 발생 | 부분 성공/응답 유실 후 미완료만 재시도·중복 없음 | 미실행 |
| AC-IMPORT-02-01 | IMPORT-02 | 정상 | 가져오기 처리·복구 화면/실행 경로에서 해당 조건 발생 | 선택 자료만 가져오고 원본은 원래 만료일까지 유지 | 미실행 |
| AC-IMPORT-02-02 | IMPORT-02 | 오류·경계 | 가져오기 처리·복구 화면/실행 경로에서 해당 조건 발생 | 로그인만으로 전송 없음, 타계정 재이전 거절 | 미실행 |
| AC-IMPORT-02-03 | IMPORT-02 | 복구·중복 | 가져오기 처리·복구 화면/실행 경로에서 해당 조건 발생 | 부분 성공/응답 유실 후 미완료만 재시도·중복 없음 | 미실행 |

## 통합 경계 사례

| ID | 조건 | 기대 결과 |
|---|---|---|
| BOUND-01 | 세션 접근3건, 같은 대상 | 전체3, 반복2, 합계5로 표시 금지 |
| BOUND-02 | 기간 안 첫 건이나 세션 전체로는 두 번째 | 반복으로 집계; 기간 필터 전에 세션 순서 계산 |
| BOUND-03 | 14~15시 예약,14:20실행 | 15시 고정 종료,40분 초과 배정 금지 |
| BOUND-04 | 같은 예약,기존 정지 세션15:01종료 | 기존 세션 우선,예약 status=SKIPPED, reason=EXPIRED |
| BOUND-05 | 30분 수동,10분 진행/5분 정지/20분 재개 | 확인 집중30분,정지5분 제외 |
| BOUND-06 | 예약14~15시,14:20~14:30정지 | 15시 종료,정지구간 제외 |
| BOUND-07 | 회원A 대기자료 존재,로그아웃 후B 로그인 | A 자료 유지·B에 미노출·미전송 |
| BOUND-08 | 비회원 종료시각+30일 정각 | 해당 세션·하위 자료 만료,설정·회원 자료 유지 |
| BOUND-09 | 가져오기 성공·응답만 유실 | 재시도 같은 결과,원본 유지,중복 없음 |
| BOUND-10 | 블러 보기 후같은요소 src 변경 | 새 이미지 다시 분석·가림,이전 보기 상태 미승계 |
| BOUND-11 | 23:59:50~00:00:10 이용 구간 | 각 날짜10초,전체20초 |
| BOUND-12 | AI 모델이존재하지않는 metric_id 반환 | 결과 실패,원본과기존결과 유지 |
| BOUND-13 | Google·카카오 같은 이메일,다른 subject | 자동 병합 없음,기존계정 재인증 후 연결 |
| BOUND-14 | 원격 로그아웃 요청 시 실행확장 미접속 | 해제 미확인 표시,실행 완료라고 주장하지 않음 |
| BOUND-15 | 같은 event_id 다른 payload | 409/격리,기존 정본 덮어쓰기 금지 |
| BOUND-16 | DST 없는 시각/두 번 있는 시각 | 없는 시각 건너뜀/첫 시각1회 |
| BOUND-17 | 저장 공간 부족·서버 실패 | 자료 자동 제거 금지,입력·대기 보존과 실패 표시 |
| BOUND-18 | 본문 키워드가 입력창에만 있음 | 입력 내용 검사·업로드 하지 않음 |
| BOUND-19 | 사이트 BLOCK+Shorts+성인목록 동시에 해당 | 같은 탐색은 가장 우선 이유1건 |
| BOUND-20 | 비회원 원격 AI 버튼 | 계정 안내,로컬 자료 자동 전송 없음 |

## 비기능 수용 목표

문서상의 초기 목표이며 측정값이 아니다. 기준 PC는 Windows11/메모리8GB/일반 네트워크로 기록하고 브라우저·모델 버전을 결과에 남긴다. API 일반 조회 p95 500ms 이하(100 동시 사용자,단일 사용자1만 접근 기록), 추가 화면 첫 조회2초 이하, 세션 명령 전달 정상 온라인 p95 10초 이하. 예약·종료는 브라우저 지연 특성을 별도로 표시하고 정시보장 합격으로 해석하지 않는다.

이미지 visible 정적20개 기준 모델 warm p95 500ms/이미지, Extension 추가 메모리200MiB 목표, 메인 스레드50ms 초과 작업을 관찰한다. 목표 미달은 민감도를 임의 바꾸지 않고 모델·큐·지원범위를 재검토한다. 정답 라벨을 가진 별도 검증셋으로 오탐·미탐을 클래스별 보고하며 검증 전 정확도를 홍보하지 않는다.

접근성은 키보드만으로 입력·저장·오류 복귀, 명시적 라벨, focus 보존, 색상 외 상태 표시, 라이트/다크 본문 대비를 확인한다. 인증은 타 계정·타 설치·재사용 code/refresh·CSRF·소셜 state 위변조 거절을 확인한다. 백업 복원은 원본 event_id·계정별 행 수·FK·미전송/중복 상태를 대조한다.


---

# 설계 결정과 배포 설정

## 출처 구분

사용자 확정: 기존 기능 전체, 기존 IA·3인 담당 유지, 일정, 비회원30일·회원 보존, 로그아웃 후 비회원, 시작 취소 없음, 일시정지·재개, 예약 잔여 구간, AI 제안만 수행, 이미지 클릭 토글. 이번 응답에서 Google·카카오와 이메일 가입을 요청해 세 방식을 포함했다.

설계 작성자가 보완한 기준: 비회원 로컬 추가 기능 지원·원격 AI 회원 전용, 수동 세션 정지시간 제외 방식, 예약 간 순서/DST, 키워드 정규화/한계, 집계 산식, 입력 상한, API·동시성·복구, 분류 임계값·큐·성능 목표. 이들은 실험에서 입증된 값이나 사용자의 과거 발언이 아니다. 변경할 경우 연결표의 관련 화면/API/데이터/검증을 함께 갱신한다.

## 기존 미정 항목 처리

| 기존 ID | 이번 설계 기준 | 명세 위치 |
|---|---|---|
| DEC-01·02 보관/가져오기 | 종료 후30일,성공원본 유지,계정별 원본 결박 | 데이터·복구 |
| DEC-03 인증 | 이메일+Google+카카오,Web쿠키/Extension토큰,PKCE 설치 연결 | API·연동 |
| DEC-04 세션 경계 | 실제 적용·해제 기준,종료 우선,UNKNOWN 잠금 | 동작 규칙 |
| DEC-05 입력/실행 상한 | 1~180분,계정·설치당 활성1개,회원 오프라인 신규 시작 불가 | 동작·API |
| DEC-06 예약 | 저장 시간대,발생 UQ,고정 종료,기존 세션 우선 | 동작·데이터 |
| DEC-07 이용 시간 | RUNNING·등록사이트·활성탭·포커스·유휴60초 제외 | 동작·이벤트 |
| DEC-08 지표 | 반복/차단 비율,이용 비중,시간대 분할,null품질 | 동작 규칙 |
| DEC-09 키워드 | 선택범위 NFKC·부분일치·대소문자 무시·범위별예외 | 동작 규칙 |
| DEC-10 이미지 | 로컬 adapter·초기 임계값·클릭토글·실패 가림 | 동작·API |
| DEC-11 AI | 회원 집계·외부전송 동의·근거검증·자동변경금지 | 동작·API |
| DEC-12 정지 | 해제/재적용 확인·구간 저장·종료경합 | 동작·데이터 |
| DEC-13 메모 | 2000자,소유 세션,빈값 비우기,version충돌 | 화면·API |
| DEC-14 계약 | 추가 API·필드·FK·이벤트1.1·로컬 메시지 | API·데이터 |
| DEC-15 환경/성능 | Chrome120+,정적이미지/서비스별범위,측정목표 | 기능·검증 |

## 환경 설정 — 기능 정책 미정과 구분

| 설정 | 배포 전 채울 값 | 미설정 시 동작 |
|---|---|---|
| PUBLIC_WEB_ORIGIN / API_ORIGIN | 실제 HTTPS 주소·허용 redirect | 인증 설정 오류로 구동 실패 |
| GOOGLE / KAKAO 자격 | 앱 ID·server secret·허용 callback | 해당 로그인 버튼 비활성·준비중 안내 |
| EMAIL adapter | 발신주소·전송 자격 | 신규 이메일 가입/복구 메일503,성공 가장 금지 |
| AI adapter | 제공자·model ID·key·전송/보관 고지 버전 | AI503,기존 분석 유지 |
| MODEL manifest | 패키지 내 모델/가중치 버전·hash·license | 블러 사용불가 |
| ADULT catalog manifest | porn전용 목록 출처·license·검증버전·hash | 성인목록 기능불가 |
| 백업 | 암호화키·저장위치·보존·복원절차 | 운영 출시 전 설정 누락으로 관리 |

이 값의 구매·가입·실제 배포·다운로드·모델 정확도 시험은 이번 작업에서 수행하지 않는다. 모델과 데이터의 이용 조건은 채택할 정확한 배포본에 대해 확인해야 하며 기능 명세만으로 재배포 허가를 얻은 것으로 보지 않는다.

## 기술적 한계의 처리

브라우저 권한·페이지 구조·이미지 접근·모델 오탐에 따라 실행 결과는 달라질 수 있다. 설계는 미지원/실패/부분 수집을 표시하는 계약까지 작성한다. Figma 최종 UI 교체는10월23일 계획을 유지하며 현재 복제본의 실제 프레임을 이번에 편집하거나 새 시안을 확정하지 않는다.


---

# 구성별 책임 원문 보존

기존 역할 경계를 보존한 발췌다. 추가 기능의 상세 책임은 현행 범위·연동 명세에 연결한다. 3인 배정 원본 전체는 원본보관 ZIP에 유지한다.



| 구성 | 담당하는 일 | 다른 구성에 맡기는 일 |
|---|---|---|
| Web / React | 로그인·회원가입 화면, 사이트 설정, 세션 요청과 상태 표시, 행동 기록·통계 조회 | 실제 브라우저 차단은 Extension, 회원 데이터 검증·저장은 Server |
| Chrome Extension | 회원·비회원 진입, 사이트 설정 UI, 집중 실행, 사이트·Shorts 제한, 접근 이벤트 생성, 로컬 상태·미전송 자료 관리 | 회원 인증 검증과 계정 데이터 관리·집계는 Server |
| Server / Spring Boot | 인증·권한 확인, 회원 설정 검증, 세션 요청 관리, 적용 정책 확정, 실행 결과 수신, 이벤트 중복 제거·반복 계산, 조회 데이터 제공 | 실제 브라우저 제어는 Extension, 영속 보관은 DB |
| DB / MySQL | 회원·사이트·정책·세션·접근 이벤트의 영속 저장 | 비즈니스 판단·권한 확인·브라우저 차단은 수행하지 않음 |

Web과 Extension은 회원 데이터를 Server에 요청한다. MySQL에는 Server만 접근한다. Server에서 시작 요청을 받았다는 사실만으로 차단이 실행되었다고 표시하지 않는다.


---

# 개정 및 문서 연결 검수

기준일: 2026-10-04 · 개정 1.4

## 반영 범위

- 제공된 상세 도면 63페이지와 요약 도면 8페이지를 변경 없이 반영.
- 수정 전 도면·미리보기는 현행 열람 경로에서 분리하고 이전자료에 보관.
- 예약 만료 표기를 API·동작 규칙·데이터·검증 기준·설계연결 JSON에서 status=SKIPPED, reason=EXPIRED로 일치시킴.
- 설정 저장 TF-S, 실패 복구 13-R 및 예약 상태 페이지의 본문 대응을 추가.
- 기능 47개, 화면 18개, API 68개, 엔터티 32개와 기존 담당 분담 유지.
- 기능별 수용 기준 141개, 경계 사례 20개는 미실행 상태 유지.

## 검사 범위

기능 연결표의 화면·흐름·API·데이터·검증 ID 참조를 검사했다. 제공된 두 도면과 배포 사본의 SHA-256 일치를 확인했다. 도면 미리보기와 통합 HTML은 현행 도면에서 다시 생성한다. 파일·링크 검수 결과는 검수결과.json에 기록한다.

이는 문서 반영·참조 검사다. 전체 기술 명세의 타당성이나 실행 결과를 보증하지 않는다. 구현·모델 정확도·DOM 지원·성능·장애 복구 테스트는 수행하지 않았다. 기존 수치·기술 선택은 설계결정 문서의 구분을 유지한다.


---

# 설계도

[상세 통합 설계도](#상세-설계도-미리보기) · [요약 설계도](#요약-설계도-미리보기)

# 현행 도면 페이지 목록

| 구분 | 페이지 | 이름 | 미리보기 |
|---|---|---|---|
| 상세 | 1 | 01 통합 IA | [SVG](07_설계도/미리보기/상세_01.svg) |
| 상세 | 2 | 02 추가 기능 상세 구조 | [SVG](07_설계도/미리보기/상세_02.svg) |
| 상세 | 3 | 03 User Flow 전체 · 기존 상세 유지 | [SVG](07_설계도/미리보기/상세_03.svg) |
| 상세 | 4 | 03-1 01 집중 전 · 진입과 준비 | [SVG](07_설계도/미리보기/상세_04.svg) |
| 상세 | 5 | 03-2 02 집중 중 · 정책 적용 | [SVG](07_설계도/미리보기/상세_05.svg) |
| 상세 | 6 | 03-3 03 집중 후 · 확인과 다음 세션 | [SVG](07_설계도/미리보기/상세_06.svg) |
| 상세 | 7 | 03-4 04 계정 연결·데이터 이전 | [SVG](07_설계도/미리보기/상세_07.svg) |
| 상세 | 8 | UF-A 집중 전 추가 흐름 | [SVG](07_설계도/미리보기/상세_08.svg) |
| 상세 | 9 | UF-B 집중 중 추가 흐름 | [SVG](07_설계도/미리보기/상세_09.svg) |
| 상세 | 10 | UF-C 집중 후 추가 흐름 | [SVG](07_설계도/미리보기/상세_10.svg) |
| 상세 | 11 | UF-D 계정 전환 흐름 | [SVG](07_설계도/미리보기/상세_11.svg) |
| 상세 | 12 | TF-A01 내부 기능 제한 | [SVG](07_설계도/미리보기/상세_12.svg) |
| 상세 | 13 | TF-A02 집중 예약 | [SVG](07_설계도/미리보기/상세_13.svg) |
| 상세 | 14 | TF-A03 이용 시간·확장 분석 | [SVG](07_설계도/미리보기/상세_14.svg) |
| 상세 | 15 | TF-A04 키워드 제한 | [SVG](07_설계도/미리보기/상세_15.svg) |
| 상세 | 16 | TF-A05 성인 사이트 제한 | [SVG](07_설계도/미리보기/상세_16.svg) |
| 상세 | 17 | TF-A06 민감 이미지 블러 | [SVG](07_설계도/미리보기/상세_17.svg) |
| 상세 | 18 | TF-A07 AI 피드백 | [SVG](07_설계도/미리보기/상세_18.svg) |
| 상세 | 19 | TF-A08 일시정지·재개 | [SVG](07_설계도/미리보기/상세_19.svg) |
| 상세 | 20 | TF-A09 세션 메모 | [SVG](07_설계도/미리보기/상세_20.svg) |
| 상세 | 21 | TF-14 화면 모드 | [SVG](07_설계도/미리보기/상세_21.svg) |
| 상세 | 22 | 13 세션 상태 | [SVG](07_설계도/미리보기/상세_22.svg) |
| 상세 | 23 | 13-R 세션 실패·복구 | [SVG](07_설계도/미리보기/상세_23.svg) |
| 상세 | 24 | 16 예약 상태 | [SVG](07_설계도/미리보기/상세_24.svg) |
| 상세 | 25 | TF-S 설정 저장·결과 확인 | [SVG](07_설계도/미리보기/상세_25.svg) |
| 상세 | 26 | 14 시스템 연동 | [SVG](07_설계도/미리보기/상세_26.svg) |
| 상세 | 27 | 15 실행 순서 | [SVG](07_설계도/미리보기/상세_27.svg) |
| 상세 | 28 | 화면 SAFETY-01 | [SVG](07_설계도/미리보기/상세_28.svg) |
| 상세 | 29 | 화면 BLUR-01 | [SVG](07_설계도/미리보기/상세_29.svg) |
| 상세 | 30 | 화면 SCHEDULE-01 | [SVG](07_설계도/미리보기/상세_30.svg) |
| 상세 | 31 | 화면 ANALYSIS-01 | [SVG](07_설계도/미리보기/상세_31.svg) |
| 상세 | 32 | ERD-01 users | [SVG](07_설계도/미리보기/상세_32.svg) |
| 상세 | 33 | ERD-02 auth_identities | [SVG](07_설계도/미리보기/상세_33.svg) |
| 상세 | 34 | ERD-03 extension_installations | [SVG](07_설계도/미리보기/상세_34.svg) |
| 상세 | 35 | ERD-04 sites | [SVG](07_설계도/미리보기/상세_35.svg) |
| 상세 | 36 | ERD-05 site_feature_policies | [SVG](07_설계도/미리보기/상세_36.svg) |
| 상세 | 37 | ERD-06 content_policies | [SVG](07_설계도/미리보기/상세_37.svg) |
| 상세 | 38 | ERD-07 policy_snapshots | [SVG](07_설계도/미리보기/상세_38.svg) |
| 상세 | 39 | ERD-08 focus_sessions | [SVG](07_설계도/미리보기/상세_39.svg) |
| 상세 | 40 | ERD-09 session_intervals | [SVG](07_설계도/미리보기/상세_40.svg) |
| 상세 | 41 | ERD-10 session_notes | [SVG](07_설계도/미리보기/상세_41.svg) |
| 상세 | 42 | ERD-11 active_execution_locks | [SVG](07_설계도/미리보기/상세_42.svg) |
| 상세 | 43 | ERD-12 event_receipts | [SVG](07_설계도/미리보기/상세_43.svg) |
| 상세 | 44 | ERD-13 access_events | [SVG](07_설계도/미리보기/상세_44.svg) |
| 상세 | 45 | ERD-14 session_lifecycle_events | [SVG](07_설계도/미리보기/상세_45.svg) |
| 상세 | 46 | ERD-15 usage_segments | [SVG](07_설계도/미리보기/상세_46.svg) |
| 상세 | 47 | ERD-16 schedules | [SVG](07_설계도/미리보기/상세_47.svg) |
| 상세 | 48 | ERD-17 schedule_occurrences | [SVG](07_설계도/미리보기/상세_48.svg) |
| 상세 | 49 | ERD-18 analysis_jobs | [SVG](07_설계도/미리보기/상세_49.svg) |
| 상세 | 50 | ERD-19 analysis_results | [SVG](07_설계도/미리보기/상세_50.svg) |
| 상세 | 51 | ERD-20 analysis_consents | [SVG](07_설계도/미리보기/상세_51.svg) |
| 상세 | 52 | ERD-21 guest_import_batches | [SVG](07_설계도/미리보기/상세_52.svg) |
| 상세 | 53 | ERD-22 guest_import_items | [SVG](07_설계도/미리보기/상세_53.svg) |
| 상세 | 54 | ERD-23 execution_commands | [SVG](07_설계도/미리보기/상세_54.svg) |
| 상세 | 55 | ERD-24 execution_reports | [SVG](07_설계도/미리보기/상세_55.svg) |
| 상세 | 56 | ERD-25 operations | [SVG](07_설계도/미리보기/상세_56.svg) |
| 상세 | 57 | ERD-26 web_sessions | [SVG](07_설계도/미리보기/상세_57.svg) |
| 상세 | 58 | ERD-27 auth_challenges | [SVG](07_설계도/미리보기/상세_58.svg) |
| 상세 | 59 | ERD-28 link_requests | [SVG](07_설계도/미리보기/상세_59.svg) |
| 상세 | 60 | ERD-29 extension_tokens | [SVG](07_설계도/미리보기/상세_60.svg) |
| 상세 | 61 | ERD-30 catalog_versions | [SVG](07_설계도/미리보기/상세_61.svg) |
| 상세 | 62 | ERD-31 model_profiles | [SVG](07_설계도/미리보기/상세_62.svg) |
| 상세 | 63 | ERD-32 idempotency_keys | [SVG](07_설계도/미리보기/상세_63.svg) |
| 요약 | 1 | 01 IA 요약 | [SVG](07_설계도/미리보기/요약_01.svg) |
| 요약 | 2 | 02 User Flow 요약 | [SVG](07_설계도/미리보기/요약_02.svg) |
| 요약 | 3 | 03 Task Flow 요약 · 기본 동작 | [SVG](07_설계도/미리보기/요약_03.svg) |
| 요약 | 4 | 04 Task Flow 요약 · 콘텐츠 제어 | [SVG](07_설계도/미리보기/요약_04.svg) |
| 요약 | 5 | 05 Task Flow 요약 · 예약·분석 | [SVG](07_설계도/미리보기/요약_05.svg) |
| 요약 | 6 | 06 세션 상태 요약 | [SVG](07_설계도/미리보기/요약_06.svg) |
| 요약 | 7 | 07 ERD 요약 | [SVG](07_설계도/미리보기/요약_07.svg) |
| 요약 | 8 | 08 시스템 연동 요약 | [SVG](07_설계도/미리보기/요약_08.svg) |


## 요약 설계도 미리보기


### 요약 1 · 01 IA 요약

![01 IA 요약](07_설계도/미리보기/요약_01.svg)

[미리보기 열기](07_설계도/미리보기/요약_01.svg)


### 요약 2 · 02 User Flow 요약

![02 User Flow 요약](07_설계도/미리보기/요약_02.svg)

[미리보기 열기](07_설계도/미리보기/요약_02.svg)


### 요약 3 · 03 Task Flow 요약 · 기본 동작

![03 Task Flow 요약 · 기본 동작](07_설계도/미리보기/요약_03.svg)

[미리보기 열기](07_설계도/미리보기/요약_03.svg)


### 요약 4 · 04 Task Flow 요약 · 콘텐츠 제어

![04 Task Flow 요약 · 콘텐츠 제어](07_설계도/미리보기/요약_04.svg)

[미리보기 열기](07_설계도/미리보기/요약_04.svg)


### 요약 5 · 05 Task Flow 요약 · 예약·분석

![05 Task Flow 요약 · 예약·분석](07_설계도/미리보기/요약_05.svg)

[미리보기 열기](07_설계도/미리보기/요약_05.svg)


### 요약 6 · 06 세션 상태 요약

![06 세션 상태 요약](07_설계도/미리보기/요약_06.svg)

[미리보기 열기](07_설계도/미리보기/요약_06.svg)


### 요약 7 · 07 ERD 요약

![07 ERD 요약](07_설계도/미리보기/요약_07.svg)

[미리보기 열기](07_설계도/미리보기/요약_07.svg)


### 요약 8 · 08 시스템 연동 요약

![08 시스템 연동 요약](07_설계도/미리보기/요약_08.svg)

[미리보기 열기](07_설계도/미리보기/요약_08.svg)


## 상세 설계도 미리보기


### 상세 1 · 01 통합 IA

![01 통합 IA](07_설계도/미리보기/상세_01.svg)

[미리보기 열기](07_설계도/미리보기/상세_01.svg)


### 상세 2 · 02 추가 기능 상세 구조

![02 추가 기능 상세 구조](07_설계도/미리보기/상세_02.svg)

[미리보기 열기](07_설계도/미리보기/상세_02.svg)


### 상세 3 · 03 User Flow 전체 · 기존 상세 유지

![03 User Flow 전체 · 기존 상세 유지](07_설계도/미리보기/상세_03.svg)

[미리보기 열기](07_설계도/미리보기/상세_03.svg)


### 상세 4 · 03-1 01 집중 전 · 진입과 준비

![03-1 01 집중 전 · 진입과 준비](07_설계도/미리보기/상세_04.svg)

[미리보기 열기](07_설계도/미리보기/상세_04.svg)


### 상세 5 · 03-2 02 집중 중 · 정책 적용

![03-2 02 집중 중 · 정책 적용](07_설계도/미리보기/상세_05.svg)

[미리보기 열기](07_설계도/미리보기/상세_05.svg)


### 상세 6 · 03-3 03 집중 후 · 확인과 다음 세션

![03-3 03 집중 후 · 확인과 다음 세션](07_설계도/미리보기/상세_06.svg)

[미리보기 열기](07_설계도/미리보기/상세_06.svg)


### 상세 7 · 03-4 04 계정 연결·데이터 이전

![03-4 04 계정 연결·데이터 이전](07_설계도/미리보기/상세_07.svg)

[미리보기 열기](07_설계도/미리보기/상세_07.svg)


### 상세 8 · UF-A 집중 전 추가 흐름

![UF-A 집중 전 추가 흐름](07_설계도/미리보기/상세_08.svg)

[미리보기 열기](07_설계도/미리보기/상세_08.svg)


### 상세 9 · UF-B 집중 중 추가 흐름

![UF-B 집중 중 추가 흐름](07_설계도/미리보기/상세_09.svg)

[미리보기 열기](07_설계도/미리보기/상세_09.svg)


### 상세 10 · UF-C 집중 후 추가 흐름

![UF-C 집중 후 추가 흐름](07_설계도/미리보기/상세_10.svg)

[미리보기 열기](07_설계도/미리보기/상세_10.svg)


### 상세 11 · UF-D 계정 전환 흐름

![UF-D 계정 전환 흐름](07_설계도/미리보기/상세_11.svg)

[미리보기 열기](07_설계도/미리보기/상세_11.svg)


### 상세 12 · TF-A01 내부 기능 제한

![TF-A01 내부 기능 제한](07_설계도/미리보기/상세_12.svg)

[미리보기 열기](07_설계도/미리보기/상세_12.svg)


### 상세 13 · TF-A02 집중 예약

![TF-A02 집중 예약](07_설계도/미리보기/상세_13.svg)

[미리보기 열기](07_설계도/미리보기/상세_13.svg)


### 상세 14 · TF-A03 이용 시간·확장 분석

![TF-A03 이용 시간·확장 분석](07_설계도/미리보기/상세_14.svg)

[미리보기 열기](07_설계도/미리보기/상세_14.svg)


### 상세 15 · TF-A04 키워드 제한

![TF-A04 키워드 제한](07_설계도/미리보기/상세_15.svg)

[미리보기 열기](07_설계도/미리보기/상세_15.svg)


### 상세 16 · TF-A05 성인 사이트 제한

![TF-A05 성인 사이트 제한](07_설계도/미리보기/상세_16.svg)

[미리보기 열기](07_설계도/미리보기/상세_16.svg)


### 상세 17 · TF-A06 민감 이미지 블러

![TF-A06 민감 이미지 블러](07_설계도/미리보기/상세_17.svg)

[미리보기 열기](07_설계도/미리보기/상세_17.svg)


### 상세 18 · TF-A07 AI 피드백

![TF-A07 AI 피드백](07_설계도/미리보기/상세_18.svg)

[미리보기 열기](07_설계도/미리보기/상세_18.svg)


### 상세 19 · TF-A08 일시정지·재개

![TF-A08 일시정지·재개](07_설계도/미리보기/상세_19.svg)

[미리보기 열기](07_설계도/미리보기/상세_19.svg)


### 상세 20 · TF-A09 세션 메모

![TF-A09 세션 메모](07_설계도/미리보기/상세_20.svg)

[미리보기 열기](07_설계도/미리보기/상세_20.svg)


### 상세 21 · TF-14 화면 모드

![TF-14 화면 모드](07_설계도/미리보기/상세_21.svg)

[미리보기 열기](07_설계도/미리보기/상세_21.svg)


### 상세 22 · 13 세션 상태

![13 세션 상태](07_설계도/미리보기/상세_22.svg)

[미리보기 열기](07_설계도/미리보기/상세_22.svg)


### 상세 23 · 13-R 세션 실패·복구

![13-R 세션 실패·복구](07_설계도/미리보기/상세_23.svg)

[미리보기 열기](07_설계도/미리보기/상세_23.svg)


### 상세 24 · 16 예약 상태

![16 예약 상태](07_설계도/미리보기/상세_24.svg)

[미리보기 열기](07_설계도/미리보기/상세_24.svg)


### 상세 25 · TF-S 설정 저장·결과 확인

![TF-S 설정 저장·결과 확인](07_설계도/미리보기/상세_25.svg)

[미리보기 열기](07_설계도/미리보기/상세_25.svg)


### 상세 26 · 14 시스템 연동

![14 시스템 연동](07_설계도/미리보기/상세_26.svg)

[미리보기 열기](07_설계도/미리보기/상세_26.svg)


### 상세 27 · 15 실행 순서

![15 실행 순서](07_설계도/미리보기/상세_27.svg)

[미리보기 열기](07_설계도/미리보기/상세_27.svg)


### 상세 28 · 화면 SAFETY-01

![화면 SAFETY-01](07_설계도/미리보기/상세_28.svg)

[미리보기 열기](07_설계도/미리보기/상세_28.svg)


### 상세 29 · 화면 BLUR-01

![화면 BLUR-01](07_설계도/미리보기/상세_29.svg)

[미리보기 열기](07_설계도/미리보기/상세_29.svg)


### 상세 30 · 화면 SCHEDULE-01

![화면 SCHEDULE-01](07_설계도/미리보기/상세_30.svg)

[미리보기 열기](07_설계도/미리보기/상세_30.svg)


### 상세 31 · 화면 ANALYSIS-01

![화면 ANALYSIS-01](07_설계도/미리보기/상세_31.svg)

[미리보기 열기](07_설계도/미리보기/상세_31.svg)


### 상세 32 · ERD-01 users

![ERD-01 users](07_설계도/미리보기/상세_32.svg)

[미리보기 열기](07_설계도/미리보기/상세_32.svg)


### 상세 33 · ERD-02 auth_identities

![ERD-02 auth_identities](07_설계도/미리보기/상세_33.svg)

[미리보기 열기](07_설계도/미리보기/상세_33.svg)


### 상세 34 · ERD-03 extension_installations

![ERD-03 extension_installations](07_설계도/미리보기/상세_34.svg)

[미리보기 열기](07_설계도/미리보기/상세_34.svg)


### 상세 35 · ERD-04 sites

![ERD-04 sites](07_설계도/미리보기/상세_35.svg)

[미리보기 열기](07_설계도/미리보기/상세_35.svg)


### 상세 36 · ERD-05 site_feature_policies

![ERD-05 site_feature_policies](07_설계도/미리보기/상세_36.svg)

[미리보기 열기](07_설계도/미리보기/상세_36.svg)


### 상세 37 · ERD-06 content_policies

![ERD-06 content_policies](07_설계도/미리보기/상세_37.svg)

[미리보기 열기](07_설계도/미리보기/상세_37.svg)


### 상세 38 · ERD-07 policy_snapshots

![ERD-07 policy_snapshots](07_설계도/미리보기/상세_38.svg)

[미리보기 열기](07_설계도/미리보기/상세_38.svg)


### 상세 39 · ERD-08 focus_sessions

![ERD-08 focus_sessions](07_설계도/미리보기/상세_39.svg)

[미리보기 열기](07_설계도/미리보기/상세_39.svg)


### 상세 40 · ERD-09 session_intervals

![ERD-09 session_intervals](07_설계도/미리보기/상세_40.svg)

[미리보기 열기](07_설계도/미리보기/상세_40.svg)


### 상세 41 · ERD-10 session_notes

![ERD-10 session_notes](07_설계도/미리보기/상세_41.svg)

[미리보기 열기](07_설계도/미리보기/상세_41.svg)


### 상세 42 · ERD-11 active_execution_locks

![ERD-11 active_execution_locks](07_설계도/미리보기/상세_42.svg)

[미리보기 열기](07_설계도/미리보기/상세_42.svg)


### 상세 43 · ERD-12 event_receipts

![ERD-12 event_receipts](07_설계도/미리보기/상세_43.svg)

[미리보기 열기](07_설계도/미리보기/상세_43.svg)


### 상세 44 · ERD-13 access_events

![ERD-13 access_events](07_설계도/미리보기/상세_44.svg)

[미리보기 열기](07_설계도/미리보기/상세_44.svg)


### 상세 45 · ERD-14 session_lifecycle_events

![ERD-14 session_lifecycle_events](07_설계도/미리보기/상세_45.svg)

[미리보기 열기](07_설계도/미리보기/상세_45.svg)


### 상세 46 · ERD-15 usage_segments

![ERD-15 usage_segments](07_설계도/미리보기/상세_46.svg)

[미리보기 열기](07_설계도/미리보기/상세_46.svg)


### 상세 47 · ERD-16 schedules

![ERD-16 schedules](07_설계도/미리보기/상세_47.svg)

[미리보기 열기](07_설계도/미리보기/상세_47.svg)


### 상세 48 · ERD-17 schedule_occurrences

![ERD-17 schedule_occurrences](07_설계도/미리보기/상세_48.svg)

[미리보기 열기](07_설계도/미리보기/상세_48.svg)


### 상세 49 · ERD-18 analysis_jobs

![ERD-18 analysis_jobs](07_설계도/미리보기/상세_49.svg)

[미리보기 열기](07_설계도/미리보기/상세_49.svg)


### 상세 50 · ERD-19 analysis_results

![ERD-19 analysis_results](07_설계도/미리보기/상세_50.svg)

[미리보기 열기](07_설계도/미리보기/상세_50.svg)


### 상세 51 · ERD-20 analysis_consents

![ERD-20 analysis_consents](07_설계도/미리보기/상세_51.svg)

[미리보기 열기](07_설계도/미리보기/상세_51.svg)


### 상세 52 · ERD-21 guest_import_batches

![ERD-21 guest_import_batches](07_설계도/미리보기/상세_52.svg)

[미리보기 열기](07_설계도/미리보기/상세_52.svg)


### 상세 53 · ERD-22 guest_import_items

![ERD-22 guest_import_items](07_설계도/미리보기/상세_53.svg)

[미리보기 열기](07_설계도/미리보기/상세_53.svg)


### 상세 54 · ERD-23 execution_commands

![ERD-23 execution_commands](07_설계도/미리보기/상세_54.svg)

[미리보기 열기](07_설계도/미리보기/상세_54.svg)


### 상세 55 · ERD-24 execution_reports

![ERD-24 execution_reports](07_설계도/미리보기/상세_55.svg)

[미리보기 열기](07_설계도/미리보기/상세_55.svg)


### 상세 56 · ERD-25 operations

![ERD-25 operations](07_설계도/미리보기/상세_56.svg)

[미리보기 열기](07_설계도/미리보기/상세_56.svg)


### 상세 57 · ERD-26 web_sessions

![ERD-26 web_sessions](07_설계도/미리보기/상세_57.svg)

[미리보기 열기](07_설계도/미리보기/상세_57.svg)


### 상세 58 · ERD-27 auth_challenges

![ERD-27 auth_challenges](07_설계도/미리보기/상세_58.svg)

[미리보기 열기](07_설계도/미리보기/상세_58.svg)


### 상세 59 · ERD-28 link_requests

![ERD-28 link_requests](07_설계도/미리보기/상세_59.svg)

[미리보기 열기](07_설계도/미리보기/상세_59.svg)


### 상세 60 · ERD-29 extension_tokens

![ERD-29 extension_tokens](07_설계도/미리보기/상세_60.svg)

[미리보기 열기](07_설계도/미리보기/상세_60.svg)


### 상세 61 · ERD-30 catalog_versions

![ERD-30 catalog_versions](07_설계도/미리보기/상세_61.svg)

[미리보기 열기](07_설계도/미리보기/상세_61.svg)


### 상세 62 · ERD-31 model_profiles

![ERD-31 model_profiles](07_설계도/미리보기/상세_62.svg)

[미리보기 열기](07_설계도/미리보기/상세_62.svg)


### 상세 63 · ERD-32 idempotency_keys

![ERD-32 idempotency_keys](07_설계도/미리보기/상세_63.svg)

[미리보기 열기](07_설계도/미리보기/상세_63.svg)

