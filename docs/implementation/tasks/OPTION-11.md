# OPTION-11 · 민감 이미지 블러

단계: 추가 MVP · 설계 담당 영역: Web·Server·Extension

## 작업 상태

- 상태: 진행 중 (Content 독립 구현 검토 대기; 실제 연결·검증 미완료)
- 실제 담당자: 채지민 — Content Control 부분 (Web/Server/Core 기존 담당·이력 유지)
- 브랜치 / 시작 기준 커밋: feature/content-control / 90ad32be5d282f3b44c917a29e156dffc5e29187
- PR: 이번 중간 공유 요청은 기능 브랜치 Commit·Push까지; PR 생성·develop 병합 미수행
- 선행 작업 / 차단 조건:

| 영역 | 담당 | 구현 상태 | 검증 상태 |
|---|---|---|---|
| Web | | 미확인 | 미실행 |
| Server | | 미확인 | 미실행 |
| Extension | 채지민(Content Control 부분) / Core 별도 | 독립 부분 구현, 제품 연결 미완료 | 합성 부분 검증, 실제 미검증 |

해당하지 않는 영역은 관련 명세 근거와 함께 해당없음으로 표시한다.

## 설계 참조

- 화면: BLUR-01
- 흐름: TF-A06
- API: API-POLICY-01, API-POLICY-02, API-CAP-01
- 데이터: content_policies, model_profiles
- 회원: 회원 Web·Extension
- 비회원: Extension 로컬
- 로컬: EXT 로컬 동일 검증/owner별 저장

원문: [화면](../../design/01_UX_기능설계/02_IA_화면명세.md) · [동작](../../design/01_UX_기능설계/03_동작규칙.md) · [API](../../design/02_시스템_테크설계/04_API_연동.md) · [데이터](../../design/02_시스템_테크설계/05_데이터_복구.md) · [검증 기준](../../design/04_검수_예시데이터/07_검증기준.md)

## 설계와 구현 대응

| 기준 ID | 기대 결과(기존 설계) | 코드 위치 | 검증 명령·환경 | 결과 |
|---|---|---|---|---|
| AC-OPTION-11-01 | 분류에 따라 블러, 클릭 보기·재클릭 가림 | | | 미실행 |
| AC-OPTION-11-02 | 분석 실패는 실패 가림 상태, 안전 판정 아님 | | | 미실행 |
| AC-OPTION-11-03 | 이미지 교체 시 보기 상태 초기화, 원본 외부 전송 없음 | | | 미실행 |

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

## 2026-10-10 Content Control 경계 확인

채지민(Content Control), feature/content-control, 기준 90ad32be5d282f3b44c917a29e156dffc5e29187. 사용자 기존 역할 확인·현행 D-06 근거. Core의 목록 확보/검증/보관·DNR·세션·전송은 제외한다.

현재 차단: OPTION-10은 검증된 Catalog 공급/보관 경로와 Content 연결 세부 계약이 필요하다. OPTION-11은 확장에 고정 포함할 버전·체크섬·라이선스가 있는 실제 학습 모델/가중치가 없다. 임의 목록·모의 분류기를 제품에 넣지 않는다. 독립 감지/표시 코드도 실제 자원과의 결합 검증 전에는 지원완료로 표시할 수 없다.

현재 상태: Content 부분 선행 대기. 다른 담당 상태는 유지. 다음 행동: 목록/모델 제공 경로·아티팩트 및 D-06 계약 확인 후 이 카드의 AC·BOUND로 구현/검증 재개. Windows/실제 서비스/Core/Server/리뷰/develop 통합 모두 이번 Content 기준 미검증.

### 독립 표시 처리 착수

위 모델 선행 대기는 실제 분류/제품 활성화에 적용한다. 가림·보기/재가림·교체·해제·비동기 취소는 모델과 분리해 구현한다. classify 함수 주입은 테스트에만 모의 분류기로 사용하며 제품 모델을 대체하지 않는다. AC-OPTION-11-01~03/BOUND-10 부분 검증 대상. 채지민 Content Control 시작 기록(기준/브랜치 동일).

## 2026-10-10 Content Control 검증·재개 기록

- 코드: extension/content/image-blur.mjs (표시 파이프라인; 학습 모델 없음). 테스트: extension/content-tests/*.test.mjs.
- 실행 주체·환경: Codex / Windows / Node24.19.0 / 설치 Chrome154.0.8037.98(headless), Playwright 합성 DOM/정책. 이미지 분류는 모의. 사용자 실행은 OPTION-09 합성 도구에 한정(아래 최신 기록 참조).
- 최종 자동 검증: 29/29 PASS, 실패/skip0. 독립 감지·제어·복원 부분만 검증. EVENT 집계·전송, 실제 서비스/Extension/Core/Server/학습 모델·브라우저 재시작은 미검증.
- AC·BOUND 대응/명령/초기 실패 및 수정: [상세 기록](../Content_Control_2026-10-10.md)의 기능별 표·코드 대응·실행 결과 참조. 이 카드의 기존 AC 표는 전체 기준이므로 미실행 상태를 전체 PASS로 올리지 않음.
- 남은 기능·의존: D-06 메시지/공통 탐색/이벤트 확정 시점, Core manifest·고정 정책 주입·소유검증·결과/전송 연결. OPTION-10 목록·OPTION-11 실제 고정 모델 자원 필요. Instagram 추천/모달 DOM 실증 필요.
- 다음 행동: [연결 제안](../Content_Core_D06_연결제안.md) 팀 검토, [Windows 절차](../Content_Control_Windows_검증.md) 실행 결과 반영. 실제 통합·팀 리뷰·develop 병합은 미완료.
- 완료 판정: Content 독립 부분 구현만 검토 가능. 기능 전체 검증완료 아님. Git/PR 최종 상태는 상세 기록의 게시 기록 참조.

- 이전 게시 시도의 Git 상태: Commit/Push 실행이 권한 요청에서 거부돼 프로세스 미시작. HEAD90ad32b·staged0, 변경은 로컬 보존. PR 생성/리뷰/통합 미수행. 상세 게시 보류·재개 기록 참조.

### 2026-10-10 중간 게시 완료

구현3d7bff718e756cedb0950858885edbb6f472ea68를 feature/content-control로 Push하고 원격SHA 일치를 확인했다. 이전 게시/작성자 차단 해소(사용자 지정 local Git 작성자 적용). PR/리뷰/develop병합 미수행. 자동29/29 PASS·사용자 OPTION-09 부분 확인은 상세 기록과 동일하며 실제 서비스/Core/Server·목록/모델·복구 미검증 유지. 오늘은 중간 공유로 종료, 다음은 D-06 연결 제안 팀 검토→세부계약 합의→Core 연결/실제 Chrome 검증. 최신 게시/재개 원본은 Content_Control_2026-10-10.md 참조.
