## 기능과 변경

비회원 확장의 `example.com.` 탐색이 등록된 BLOCK 범위를 우회하고, APPLY 기한 정각·누락/비정상 기한으로 시작 성공이 확정되는 문제를 보완합니다. 기존 v0.1.5의 로컬 세션·설정·팝업을 재사용하며 실행 확인 후 RUNNING, 해제 확인 후 종료하는 흐름과 현재 세션 스냅샷을 유지합니다.

- 기능 ID: EXT-02 (비회원 사이트 실행/기한/도메인 경계 보완 단위; 전체 기능 완료 아님)
- 담당: 윤종민, 기존 Extension Core 배정 원문 기준. Content Control·공유 API·LOG-01 v0.1.6 구현은 제외.
- 작업카드: docs/implementation/tasks/EXT-02.md
- 기준: 현행 기능·동작·API·데이터·검증 명세. 이번 도메인 단위 시작 2931b38.
- 브랜치 전체 변경에는 기존 사이트 실행 adapter/Chrome fixture와 사용자 제공 백업 복원도 포함됩니다. 복원 내용을 신규 작성한 기능으로 주장하지 않습니다.
- 주요 파일: extension/background/session-core.js, tests/session-core.test.mjs, src/site-controller.js, src/site-rules.js, 기존 비회원 background/popup/blocked/manifest, README 및 작업 기록.

## 설계 대응 및 검증

| 기준 | 구현/검증 | 결과와 범위 |
|---|---|---|
| AC-EXT-02-01 부분 | site-controller guard/recheck, guest session 적용 확인·도메인 판별 | 모의 최신 owner/revision 확인; 사용자 사이트 적용·도메인·스냅샷 성공 보고. 회원 명령 실연동 미검증 |
| AC-EXT-02-02 부분 | APPLY 기한 정각 및 누락/비정상 기한 거절, executor/snapshot 검사 | 자동 모의 통과. 실제 설치 토큰 인증 미구현·미검증 |
| AC-EXT-02-03 부분 | journal/규칙 대조 및 과거 APPLY 재설치 금지 | 자동 모의 통과, 사용자 기본 브라우저 재시작 성공 보고. 서버 reconcile 실연동 미검증 |
| BOUND-17 부분 | 저장·규칙 적용/정리 실패 주입 | 별도 site-controller 모의 통과. 실제 IndexedDB quota/서버 실패 전체 미검증 |
| 추가 도메인 경계 (새 AC ID를 만들지 않음) | exact/subdomain·마지막 점·유사 host·www/IDNA/userinfo·BLOCK만 열린 탭 이동·다른 규칙 보존·종료·다음 세션 변경 | 자동 통과. 사용자 D1~D6는 안내된 기본 도메인 범위만 성공 보고 |

- 이번 최종 재실행: extension/에서 npm test **42/42**, 실패/스킵 0; npm run check 및 npm run build:harness 성공 (Codex Linux Node 24.19.0/npm 11.9.0).
- check는 JavaScript 문법 검사이며 ESLint가 아닙니다. build:harness는 검증 전용 확장 생성이며 제품 번들이 아닙니다.
- Chrome API·storage는 자동 테스트의 모의 객체입니다. regex는 JS RegExp 확인이며 실브라우저 DNR 지원 여부는 실행 시 isRegexSupported 확인입니다.
- 사용자 실행 결과: b60396d 안내 후 기본 1~6 성공 보고; 9a6cc7d 최신 ZIP 안내 후 D1~D6 성공 보고. 실제 로드 SHA·Windows/Chrome 버전·화면/로그는 별도 미제공. Codex 직접 관찰 결과로 표현하지 않습니다.
- 상세 증거: docs/implementation/evidence/EXT-02-domain-boundaries.txt 및 EXT-02-2026-10-08-backup-resume.txt, 작업카드의 사용자 결과.

## 통합 영향·미완료

- 공용 API/DB/이벤트/상태 계약 변경 없음. 사용자 제공 백업의 기존 DEV_* 경로·DB 및 개발용 최근 접근 조회는 보존했으며 제품 메시지 계약 전체와 LOG-01 완료를 의미하지 않습니다.
- 비회원 background 세션과 별도 src 실행 adapter는 아직 연결되지 않았습니다. 별도 .chrome-harness의 이전 사용자 오류는 fixture 수정 후 별도 재검증 대기이며 비회원 팝업 성공 보고로 대체하지 않습니다.
- 회원 설치 인증, API-EXT-01~07/API-EXEC-01~03, 신뢰된 Core 문맥·보고/outbox와 Server/Content 통합은 선행 구현/담당 조율이 필요합니다. 회원 기능 및 EXT-02 전체 완료·병합 준비 완료로 표시하지 않습니다.
- Linux Chromium 확장 검증은 관리자 정책의 unpacked extension 로드 거절로 미실행. 사용자 Chrome 결과와 분리합니다.
- IDNA/userinfo/규칙 보존 등 자동 사례 전부의 실제 Chrome 검증, 저장 실패/30일 보관 경계 전체도 미검증입니다.
- 리뷰 요청: 기존 백업 복원 경계, matcher와 DNR의 host 범위 일치, 기한 실패 해제, 두 실행 경로 병존, 기존 담당/공용 계약 보존, 후속 통합 선행 조건을 확인해주세요.
- PR 생성 후 팀 리뷰 대기. develop/main 병합은 별도 명시 요청 없이는 수행하지 않습니다.
