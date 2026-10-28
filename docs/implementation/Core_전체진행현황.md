# Core 전체 진행 현황 — 2026-10-11

EXT-02 관리 작업 / 종민 / feature/extension-core-ext-02 / 시작 ac39226. 실제 코드·작업카드·통합현황·D01~D10 영향표·담당분담 원문·TEAM_GUIDE 대조. 기존 미커밋 sender 문서/시험은 보존했다.

## 범위와 계산

기존 90%는 독립 SITE 구현/안정화 추정치로 전체 Core 진행률이 아니었다. 해당 수치를 전체 기준으로 사용하지 않는다. 아래 16개는 현재 확인된 Core 책임 및 연동 의무를 중복 없이 묶은 **추적 기준안**이다. 공식 47개 제품 기능이나 공수 단위와 같지 않다. A0/A1/B/C/D는 C10~12에 묶어 이중 계산하지 않는다. sender·독립 결함의 결과는 관련 묶음의 근거로 쓴다.

전체 완료율은 관련 구현·자동 검증·필수 실제 연동/경계 검증·필요한 독립 재리뷰가 모두 확인된 묶음 / 16으로 계산한다. 현재 그 조건을 전부 충족했다고 확인할 수 있는 묶음은 **0/16 = 0%**다. 구현 진척이 0이라는 의미가 아니다. **8/16 묶음에 제품 코드 구현 근거가 있으며 모두 부분 구현/검증 대기**이고, sender 1개는 관측/규칙 시험 단계, 나머지 7개는 미연결/후속/배정 확인이다. 코드가 일부 존재하는 8/16 = 50%는 구현 착수 범위일 뿐 완성률이 아니다.

개인별 47개 기능 상세 배정 원본 전체는 저장소 본문에서 확인되지 않았다. Core 외의 Web·Server·Content 작업을 종민에게 배정하지 않는다. C14/15의 상세 배정과 추가 기능의 정확한 Core 범위를 기존 합의로 확인하면 분모를 버전 변경 기록과 함께 갱신한다. 이 기준안으로 개인 전체 범위가 최종 확정됐다고 주장하지 않는다. PC 확장은 이 분모 밖의 후속 단계다.

| 추적 ID | Core 작업 묶음 | 기능 연결 | 상태 | 코드/근거 | 남은 완료 조건 |
|---|---|---|---|---|---|
| C01 | 비회원 로컬 세션·사이트 설정 | AUTH-04·POLICY-01/02·SESSION | 부분 구현 | extension/background/session-core.js·site-store.js | 자동·사용자 정상 경로 근거 있음; 전체 경계 미검증 |
| C02 | Snapshot 검증·사이트 규칙 적용/해제 | EXT-02·SESSION-04 | 부분 구현 | extension/src/site-controller.js; background/host-policy.js | 238 자동 기록; 최신 독립 재리뷰·전체 실제 장애 미완료 |
| C03 | 회원 연결·PKCE·토큰 복구 | EXT-01·AUTH | 부분 구현 | extension/src/member-auth.js | 모의/HTTP 근거; 실제 오류·계정 전환 전체 미검증 |
| C04 | 회원 명령·보고·실행 루프 | EXT-01/02 | 부분 구현 | extension/src/member-execution-loop.js·member-execution-client.js | 정상 Chrome 근거; 변조 복구·최신 RELEASE 독립 재리뷰 대기 |
| C05 | SITE 접근 수집·원문 저장 | EVENT-01/02 | 부분 구현 | extension/src/member-access.js; background/access-store.js | SITE-only; 실제 Chrome·복수 사유/완전 수집 경계 미완료 |
| C06 | 미전송 자료·재전송·저장 장애 | EXT-03 | 부분 구현 | extension/src/member-events.js·member-journal-store.js | 자동/IDB 근거; 실제 MV3 장애·Server 자동 END 계약 대기 |
| C07 | 문서 registry·seq·복원 의무 | EXT-02·D06 | 부분 구현 | extension/src/document-control-registry.js | 독립 자동/Worker 근거; 제품 연결 미착수 |
| C08 | 팝업·차단 안내·Figma 일치 | EXT·SETTING | 부분 구현 | extension/popup/; blocked 화면 | 기능 UI 존재; Figma 원본과 시각 대조·반영 미완료 |
| C09 | sender 실제 권한 차단·수명 검증 | A0-G02 | 관측/시험 초안 | tools/d06-sender-probe/ | 46 자동은 합성/모의; 제품 권한 규칙 미적용 |
| C10 | A0→A1 비회원 Shorts 제어 연결 | POLICY-03·D06 | 미연결 | 승인 candidate-3·착수 준비 문서 | 3인 승인·sender 확인 후 Core 송신/정책/상태 연결 |
| C11 | B 내부 기능 Event 연결 | EVENT-03·D06 | 미연결 | D06 후속 단계 | 이벤트 합의 후 Core 수집/전송 연결; Content 탐지 구현은 지민 |
| C12 | C 회원 Content 연결·D 장애 복구 | EXT-01/02·D06 | 미연결 | D06 후속 단계 | 회원 SITE 기존 코드 보존; Content 통합은 미착수 |
| C13 | 잔여 시간·다중 구간·일시정지/재개 | SESSION-05·D01/05 | 후속 | 기존 session core·Server 미지원 경계 | 공유 계약/API 합의 필요; 고정 타이머를 완료로 대체하지 않음 |
| C14 | 예약 실행·발생 중복 방지 | OPTION-04 | 미확인/후속 | 작업카드·API-SCHEDULE 참조 | Core 실행 역할만; Server/Web 구현 재배정 없음 |
| C15 | 가져오기·이용시간의 Core 로컬 처리 | IMPORT-01/02·OPTION-06 | 미확인/후속 | 작업카드·데이터 복구 명세 | 선택/로컬 자료 전달·시간 관측 범위; 개인 상세 배정 확인 필요 |
| C16 | 추가 Content 정책 제어 연결 | OPTION-01/02/03/05/09/10/11 | 미연결 | 작업카드·D06 후속 | Core 전달/소유권/해제만; DOM·분류기·모델은 지민 범위 |

## 지금 가능한 다음 작업

EXT-02 / A0-G02 실제 격리 권한 판정 시험 준비와 실행. 46개 합성/모의 단위 시험으로 실제 Chrome 차단을 대신하지 않는다. 현재 Linux Chromium 확장 설치는 과거 관리 정책에 막힌 기록이 있으므로 정책/실행 가능 여부를 먼저 확인하고 우회하지 않는다. 불가하면 Windows 관측 도구에 격리 규칙 시험을 준비한 뒤 사용자 실행으로 증거를 받는다. 제품 Content 수정은 지민 영역이므로 실험 결과·규칙을 전달하고 공동 확정 뒤 제품 연결한다.

병행 요청: 다훈에게 최신 RELEASE 수정 독립 재리뷰 및 격리 HTTP/DB 검증 요청. 사용자 개인 Chrome/계정 자료를 변조해 장애 시험하지 않는다.

## 이번 관리 작업 결과

목록·코드/근거 대조·미완료 조건 기록 완료. 제품 구현/새 기능 완료 추가 없음. 기능 테스트 재실행 없음, 문서 diff 검사 수행. 기존 카드의 오래된 미착수 표시는 최신 구현 근거와 다를 수 있어 일괄 완료로 덮어쓰지 않았다. 앞으로 시작/종료 때 전체 기준안 0/16 확정완료, 8/16 부분구현 등 상태 수를 함께 보고하고 해당 작업 변화만 기록한다. commit/push/develop 병합 없음.

## 최신 자동 검증 갱신

[전체 실행 결과](evidence/EXT-02-current-automatic-verification.md): Core238·sender46·팝업42·Web130·Server167 및 CRLF모사238 통과, 네이티브 브라우저 Worker/IDB 시험 통과. 새 오염 RELEASE 실제 HTTP/테스트DB 회귀 2건 추가 통과. C04 자동/HTTP 근거를 보완했으나 실제 MV3 변이·독립 재리뷰 미완료라 전체 완료수는0/16 유지. 정책 차단과 미구현을 사용자만 할 수 있는 작업으로 단정하지 않음.

## RELEASE 독립 재리뷰 갱신

[다훈 REVIEW PASS 접수](evidence/EXT-02-independent-release-review-pass.md)로 C04 수정본 독립 재리뷰 대기는 해결. 실제 Chrome 실패검증이 남으므로 묶음 완료는0/16 유지. 전달된 독립 결과와 자체 자동 결과는 별개. 기존90%추정 사용하지 않음.
