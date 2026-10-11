# PR #17 오류 수정 재검토 기록

기능 EXT-02 / 담당 윤종민 Extension Core / 기준 b734971 / 기존 PR 브랜치 유지.
사용자 제공 4가지 증상을 제품 코드로 독립 재현했다. 팀 보고서/재현 원본은 미전달.

## 실행 결과

- 제품 코드 모의 테스트: 기존 42 + 신규 9 = 51/51. Node 24.19.0/npm 11.9.0. Chrome DNR/storage/tabs 모의, fake-indexeddb 6.2.5 사용.
- 명령: extension에서 `npm ci --cache /workspace/.npm`, `npm test`, `npm run check`, `npm run build:harness` 성공. 루트 `git diff --check` 성공.
- 기존 b734971 background 5개 scripts를 /tmp/ext-review-baseline/background에 git show로 추출, 신규 테스트 및 같은 devDependencies를 연결하여 `node --test /tmp/ext-review-baseline/tests/review-regressions.test.mjs` 실행: 9건 중 7 실패, 2 통과. 오류 1/2/3/4를 모두 포함. 이전 코드에 없는 오류 handler는 기존 제품처럼 오류 이벤트를 전달하지 않아 재현.
- 실제 제품: Chromium 151.0.7922.173 Playwright/CDP `Extensions.loadUnpacked`에 /workspace/capstone-project/extension을 지정. 관리자 unpacked 설치 제한 오류로 로드 실패, 모든 제품 Chrome 시나리오 미검증.
- 검증용 harness: 빌드만 통과, 브라우저 검증 미실행. 제품 화면 검증 근거로 사용하지 않음.
- Figma: 지정 URL HTTPS CONNECT 403; 플러그인 설치 승인됐으나 callable 도구 미노출. 실제 프레임/크기/색/라이트·다크 확인 불가, UI 수정 및 구현 화면 없음.
- 정책 1.2: 현재 branch 및 원격 develop 76df34e에서 실제 계약 원본 미확인. 공유 예정인 문서 대기, 정책 선택/차단 규칙 변경 미착수. 1.1만 1.2로 교체하지 않음.

## 최신 제품 Chrome 수동 검증 절차

먼저 최신 PR 브랜치를 pull하고 `git rev-parse HEAD`를 기록한다. 기존 설치/데이터를 삭제하지 말고 chrome://extensions에서 현재 설치 경로가 제품 extension인지 확인한 뒤 새로고침한다. .chrome-harness를 선택하지 않는다. OS/Chrome 버전/commit SHA/실행시각을 함께 기록한다.

| 항목 | 수행 | 기대 결과 / 결과 기록 |
|---|---|---|
| CRUD 및 복원 | example.com BLOCK 등록, RECORD 수정, 삭제, 같은 host 다시 등록. worker DevTools에서 각 목록 응답의 site_id/version을 확인 | 동일 site_id 및 created_at 유지, version 1→2→3→4, 중복 active 거절. 미검증 |
| 집중 및 이벤트 | BLOCK example.com / RECORD 별도 host로 시작. 정책 적용 후 RUNNING 여부, 차단 안내, RECORD 접근, example.com. 접근을 확인 | BLOCK 안내, target_host 마지막 점 없음, 반복 카운트 구분. 종료 후 DNR owned 규칙 제거 및 사이트 재접근 허용. 미검증 |
| 실패·취소 | BLOCK 대상 이동을 취소/탐색 오류로 종료한 뒤 안내 새로고침. 같은 탭 다음 정상 탐색과 비교 | 실패 임시 기록 없어 새로고침이 신규 접근이 되지 않음. 다음 정상 접근 기록은 유지. 미검증. 실제 Chrome 이벤트 순서도 기록 필요 |
| 스냅샷 | 실행 중 BLOCK→ALLOW 수정/사이트 삭제·등록, 현재 세션과 종료 후 다음 세션 비교 | 현재 정책 유지, 다음 세션만 새 설정 반영. 미검증 |
| Worker 복구 | 진행 중 worker DevTools 닫고 chrome://serviceworker-internals의 해당 worker stop 후 팝업 재열기 | journal/실제 규칙 일치 시 RUNNING 유지, 중복 규칙 없음. 미검증 |
| 브라우저 재시작 | 진행 중 브라우저 전체 종료/재시작, popup 상태 및 DNR 확인 | INTERRUPTED·해제 확인, 확인되지 않은 구간 제외. 미검증 |
| 해제 실패 | 자동 테스트의 모의 실패와 실제 제품 수동 실패 주입을 구분. 일반 정상 종료/재시작 먼저 확인 | 모의 반복 실패는 테스트 통과. 실제 Chrome 해제 실패·저장 실패 재현은 미검증, 제품 성공 보고로 대체 금지 |
| 상·하위 정책 | 1.2 구현 후 naver.com BLOCK/include=true + chzzk.naver.com ALLOW, 반대 조합, include=false, 더 깊은 host와 exact 중복 확인 | 더 구체적인 host 우선, 정확히 같은 normalized host만 중복 거절. 현재 구현 대기, 검증 미실행 |
| UI | Figma 실제 확장 프레임 확보·적용 후 팝업, 비회원 메인, 사이트 설정, 시작/진행/종료, 안내 버튼·라이트/다크·오류/로딩/빈 목록/복구 화면 대조 | 실제 적용 확인 전 RUNNING/성공 금지. 현재 디자인 적용 대기·미검증 |

미검증 / 실패 / 조율 필요 / 다음 행동은 작업카드 최신 기록과 함께 확인한다.
회원 연결·전송·승인·공유 복구 계약은 별도 통합 작업이며 이번 오류 수정의 완료 대상이 아니다.
병합하지 않았으며, 정책/UI 및 최신 Chrome 검증이 남아 있어 전체 재검토 준비 완료로 표시하지 않는다.

## 수정 후 사용자 Chrome 실행 보고

사용자가 위 채팅에서 안내한 Chrome 검증 1~9 전부 정상 작동이라고 보고하고, 수정 후 코드로 실행한 것임을 명시했다. 사이트 등록·수정·삭제·재등록/중복 거절, 차단/종료 해제, 세션 정책 유지·다음 세션 변경 반영, 안내 새로고침 카운트 유지, RECORD·반복 구분, 전체 브라우저 재시작 중단·해제·미확인 시간 제외는 사용자 실행 성공 보고다.

Codex 환경의 로드 실패와 별도로 기록한다. 실제 로드 SHA/OS/Chrome 버전/DB·로그는 미제공. 동일 ID/버전 복원, 강제 오류 재시도, Worker 단독 중단, MOST_SPECIFIC_HOST 및 Figma UI 성공 결과로 확대하지 않는다. 위 수동 표의 기존 미검증은 작성 당시 Codex 직접 검증 상태이며 사용자 보고 범위는 이 최신 항목을 참고한다.
