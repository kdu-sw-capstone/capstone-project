# EXT-02 사용자 Windows CRLF·Chrome 정상 복구 검증

기능 EXT-02 / 기록 담당 종민 / feature/extension-core-ext-02 / 기록 시작 c7461ef3965a63bbec8d1f88052761166e199077.

사용자가 이 대화에서 직접 실행하고 제공한 화면·확인 답변을 기록한다. Codex가 Windows를 원격 조작하거나 새 기능 테스트를 실행한 결과가 아니다. 화면 원본은 대화 첨부에 있으며 저장소에는 복사하지 않았다. 원본에 사용자 경로/계정 화면이 있어 개인정보를 포함한 캡처를 공개하지 않는다. 각 캡처의 상세 시각·Chrome/Node 전체 버전은 미수집이고, 기록 작성 시각을 사용자 실행 시각으로 대체하지 않는다.

## 기준·환경

- 코드 기준: c7461ef3965a63bbec8d1f88052761166e199077. Windows 터미널의 git rev-parse HEAD 화면으로 확인.
- Windows Git Bash, 별도 Git clone 폴더 focurve-crlf-check/extension, 확장 manifest 0.1.20. Chrome fullversion은 미수집.
- 사용자 Windows에서 Server/Web을 실행하고 새 확장을 회원 연결한 로컬 시험. 신규 설치만 Snapshot1.2 검증 allowlist에 포함해 시작 오류를 해결한 뒤 정상 실행했다. 이 로컬 설정은 공용 gate 기본값 변경이나 모든 설치 cohort 승인 아님.
- Chrome 시험은 사용자가 해당 검증용 확장을 로드했다고 보고한 연속 절차다. 실행 도중 bundle hash/파일 변경 여부의 별도 독립 검증은 없음.
- 설계 대응: docs/design/04_검수_예시데이터/07_검증기준.md의 AC-EXT-02-01~03·AC-SESSION-01/02 및 실행복구 연결계약. 아래 증거는 정상 경로 부분 근거이며 공식 AC 전체 판정을 변경하지 않는다.

## 확인한 결과

| 항목 | 사용자 실행·관찰 | 결과/범위 |
|---|---|---|
| W-01 CRLF 실파일 | background/member-execution.js와 src/member-execution-loop.js 모두 CRLF:true, bareLF:false | 사용자 실제 Windows 파일 상태 확인 |
| W-02 자동 회귀 | bundle 재생성 없이 npm test, tests234/pass234/fail0/skipped0 | PASS, 자동 모의 회귀의 Windows 실행. 실제 DOM 효과 증거와 구분 |
| W-03 구문 | npm run check → JavaScript syntax checks passed (not ESLint) | PASS |
| C-01 SITE 적용/해제 | 집중 중 규칙1개(ID1), 종료 후0개, example.com 접속 복원. 후속 시험에서 차단 화면도 사용자 확인 | 정상 SITE 부분 회귀 PASS |
| C-02 Worker 정상 복구 | example.com 전체차단·5분 회원 실행, 확장 popup/DevTools 닫기→해당 Worker Stop→popup 열기·회원 실행 확인→Web 상태 확인 절차를 사용자 수행했다고 보고 | 아래 시각/적용/차단 확인 범위 PASS. Stop 자체의 상태 로그/프로세스ID는 미수집 |
| C-03 시각 유지 | Stop 전·후 화면 모두 14:37:47 시작, 14:42:47 종료 예정 | 예정 시각 유지 PASS. 서버 저장 RUN 구간·회계 수치 전체 검증 아님 |
| C-04 복구 후 효과 | popup 회원 집중 정책 적용 확인 완료, Web 진행 중, example.com 계속 차단됨 사용자 답변 | 정상 복구 후 SITE 효과 유지 PASS |
| C-05 복구 후 종료 | 종료 후 remaining_rule_count:0/rule_ids:[], example.com 정상 페이지 화면 | 세션 규칙 잔존0 및 접속 복원 PASS |

C-02의 Stop 후 재개는 정상 Worker 프로세스 재시작 확인이다. 새로운 APPLY 횟수/operation ID/전체 journal 원문을 따로 캡처하지 않아 ‘모든 내부 원문·명령 불변’까지 입증한 것으로 기록하지 않는다. Chrome 전체 종료/절전·D01/D05 자동복구·D06 A0와도 구분한다.

## 재현에 사용한 조회

```javascript
chrome.declarativeNetRequest.getSessionRules().then(rules => {
  console.log({
    remaining_rule_count: rules.length,
    rule_ids: rules.map(rule => rule.id)
  });
});
```

기대 전환: 종료 상태0 → SITE BLOCK 집중 중1 → Worker 복구 후 차단 유지 → 종료 후0 및 실제 사이트 정상 접속. 조회는 session rules만 대상으로 하며 static/dynamic DNR나 다른 확장의 규칙 전체를 조회한 것이 아니다.

## 남은 검증 및 다음 행동

- 실제 Chrome의 잘못된 Snapshot/executor 변조 복구 시험 NOT RUN. 자동 변이 회귀 통과와 구분. 다훈 보고서 원문/정확한 저장소·필드·값·복구 시점·기대 규칙 처리·정리 절차 수신 후 격리 시험 준비.
- c746 수정본 독립 재리뷰 최종 판정 대기. 과거 e23 FIX REQUIRED를 지우거나 사용자 정상 검증으로 독립 판정을 대체하지 않는다.
- Server HTTP/격리 MySQL 회귀를 이번 기록 작업에서 재실행하지 않음. 현재 자료로 DB interval·Event 저장·전체 AC PASS를 선언하지 않는다.
- D06 A0는 최종 승인 전, 제품 wiring 미구현. candidate1의 projection 버전/eviction 규칙/sender 실험 범위는 별도 수정 요청이며 이번 정상 시험으로 해소되지 않는다.
- 기록 외 제품·설정·DB 변경 없음. PR17만 문서 갱신; PR21·기존 Guest/회원·추가 MVP 보존, develop 병합/자동병합 없음. 기존 Core 약90% 추정 유지, 전체 MVP/A0 완료율 아님.

[수정본 자체 검증과 한계](EXT-02-2026-10-11-rereview-two-fixes.md)
