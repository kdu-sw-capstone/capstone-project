# FOCURVE 기능 범위 및 설계 기준

## 1. 개발 범위

| 단계 | 구현 범위 | 완료 조건 |
|---|---|---|
| 기본 기능 | 회원·비회원, 사이트 등록·분류, 차단·기록·Shorts, 세션 시작·종료, 자동 기록·반복 판정, 기본 통계·설정 조정, 자료 가져오기, 화면 모드 | 실제 Web·Extension·Server 흐름 연결 및 기본 회귀 통과 |
| 추가 기능 | 아래 기능 목록 전체 | 정책·화면·데이터 계약 확정, 실제 기능 통합, 정상·실패·복구 검증 |
| 학기 완료 | 기본 기능 + 추가 기능 | 설계 검수·통합·회귀·사용성 테스트 및 결함 조치 완료 |
| PC 확장 | 데스크톱 애플리케이션 관리·연동 | 학기 완료 조건 충족 후 잔여 역량에 따라 착수 |
| 모바일 확장 | 모바일 이용 환경 | 후속 확장 검토 대상. PC 추가 여부만으로 범위에서 삭제하지 않음 |

추가 기능은 이번 학기 필수 완료 범위다. `OPTION`은 기존 기능 식별자를 유지하기 위한 접두어이며 선택적 구현을 뜻하지 않는다. 기능 범위 확정과 세부 구현 정책 확정은 구분한다.

## 2. 추가 기능과 화면

| 기능 ID | 기능 | 화면 ID | Figma | 구현 전 결정사항 |
|---|---|---|---|---|
| OPTION-01 | 추천 콘텐츠 제한 | FEATURE-01 | [화면](https://www.figma.com/design/TmEt1UQV5jIhrArfijGwQe?node-id=356-3348) | 대상 영역·변경 감지·지원 서비스별 동작 |
| OPTION-02 | 댓글 제한 | FEATURE-01 | [화면](https://www.figma.com/design/TmEt1UQV5jIhrArfijGwQe?node-id=356-3348) | 동적 댓글 로드와 해제 복원 |
| OPTION-03 | 자동재생 제한 | FEATURE-01 | [화면](https://www.figma.com/design/TmEt1UQV5jIhrArfijGwQe?node-id=356-3348) | 자동재생의 지원 범위·실패 감지 |
| OPTION-04 | 집중 예약 | SCHEDULE-01 | [화면](https://www.figma.com/design/TmEt1UQV5jIhrArfijGwQe?node-id=356-3449) | 시간대·충돌·놓친 예약·재시작·중복 실행 |
| OPTION-05 | 지원 서비스 확대 | FEATURE-01 | [화면](https://www.figma.com/design/TmEt1UQV5jIhrArfijGwQe?node-id=356-3348) | 지원 대상·감지 방식·전체 차단 우선순위 |
| OPTION-06 | 사이트 이용 시간 | ANALYSIS-01 | [화면](https://www.figma.com/design/TmEt1UQV5jIhrArfijGwQe?node-id=356-3606) | 활성 탭·브라우저 포커스·유휴·수집 구간 |
| OPTION-07 | 행동 기반 지표 | ANALYSIS-01 | [화면](https://www.figma.com/design/TmEt1UQV5jIhrArfijGwQe?node-id=356-3606) | 복합 지표의 입력·산식·표본 조건·해석 범위 |
| OPTION-08 | 시간대별 패턴·확장 분석 | STAT-01, ANALYSIS-01 | [화면](https://www.figma.com/design/TmEt1UQV5jIhrArfijGwQe?node-id=356-3606) | 기간 경계·시간대·지연 이벤트·세션 비교 기준 |
| OPTION-09 | 키워드 제한 | KEYWORD-01 | [화면](https://www.figma.com/design/TmEt1UQV5jIhrArfijGwQe?node-id=356-3531) | 제목·URL·본문 지원 범위, 일치·대소문자·예외 |
| OPTION-10 | 성인 사이트 제한 | SAFETY-01 | 전용 화면 설계 필요 | 도메인 자료 출처·업데이트·오탐·예외·오류 화면 |
| OPTION-11 | 민감 이미지 블러 | BLUR-01 | 전용 화면 설계 필요 | 분류 방식·성능·정보 처리·화면 상태 |
| OPTION-12 | 행동 기반 AI 피드백 | ANALYSIS-01 | [화면](https://www.figma.com/design/TmEt1UQV5jIhrArfijGwQe?node-id=356-3606) | 입력 최소화·생성 방식·표본 기준·실패 처리 |
| SESSION-05 | 일시정지·재개 | SESSION-01 | [화면](https://www.figma.com/design/TmEt1UQV5jIhrArfijGwQe?node-id=356-3240) | 정지 중 제어·수집·시간·종료·복구 규칙 |
| SESSION-06 | 세션 메모 | SESSION-01 | [화면](https://www.figma.com/design/TmEt1UQV5jIhrArfijGwQe?node-id=356-2103) | 입력 길이·수정 가능 시점·저장 위치·실패 처리 |

SCHEDULE-01·KEYWORD-01·ANALYSIS-01은 기존 추가 화면의 문서 식별자다. SAFETY-01·BLUR-01은 작성할 전용 화면의 식별자다. 현재 Figma 프레임 이름과 문서 ID가 반드시 일치하는 것은 아니다.

## 3. 화면 구성 기준

- 00 High-Fi의 기본·추가 화면을 학기 최종 통합 UI의 기준으로 사용한다.
- 01 High-Fi·02 Low-Fi는 기본 기능의 선행 구현과 회귀 검증 기준이다.
- 기본 MVP 화면에 없는 추가 기능은 추가 단계에서 연결한다. 기본·추가 구분은 최종 서비스의 기능 누락 근거가 아니다.
- 시간대별 차트는 대시보드에 배치할 수 있으며, 구현 분류는 추가 기능 OPTION-08로 관리한다.
- 성인 사이트 제한과 민감 이미지 블러는 설정·예외·처리 중·실패 상태까지 설계한 뒤 구현한다.
- Figma의 수치·정책 안내는 예시 또는 시안이다. 구현 계약이 미정인 항목은 설계 결정사항에서 먼저 확정한다.

## 4. 공통 동작 기준

사이트 설정 삭제 후에도 과거 기록·통계와 당시 정책은 유지한다. 접근은 설정된 수집 범위에서 자동 기록하며, 반복 접근은 동일 세션·동일 대상의 두 번째 이후 유효 접근으로 구분한다. 반복은 전체 접근에 포함되는 속성이므로 전체와 반복을 합산하지 않는다.

정책은 세션 시작 시 고정하고 설정 변경은 다음 세션부터 적용한다. 전체 차단과 내부 기능 제한이 겹치는 경우 전체 차단이 우선하며, 한 접근을 중복 기록하지 않는다. AI는 설명과 제안을 제공하고 실제 설정 변경은 사용자가 결정한다.

비회원 자료의 보관 기간과 가져오기 후 원본 처리처럼 상충하는 정책 후보는 설계 결정사항에서 관리한다. 정책이 미정인 상태를 구현 완료로 판정하지 않는다.
