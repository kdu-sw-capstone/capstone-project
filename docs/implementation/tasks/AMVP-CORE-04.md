# AMVP-CORE-04 — Core DNR 소유권·복원

- 담당: 윤종민 / 브랜치: feature/additional-mvp-core
- 시작 기준: da1c70b2b2052dece581353f81cd5eb6c604e4b1 (PR24 병합 및 Web/Server 통합 포함)
- 계약: AMVP-CONTRACT-20261029-RC2, PR24 승인 a10fcb02927eec49561c62417b6a0d7a63e64cde
- 기준 명세: docs/design/additional-mvp-contracts/03_Wire_D06_복원.md의 C-04 Session/Dynamic DNR, 06_인계_승인.md의 AMVP-CORE-04.
- 상태: 진행 중. inventory에 이어 durable sidecar·writer epoch·own-claim RELEASE/복구 모듈 구현. 제품 Worker 연결은 대기.
- 이유: 기존 Guest/Member는 SESSION만 직접 제어하고 계약 참조 모델은 Python fake banks다. 둘을 복제하지 않고 신규 coordinator의 양 저장소 관측 경계를 먼저 구현한다.
- 제품 코드: extension/src/additional-dnr-inventory.js. 기존 canonical digest 재사용, 승인 DnrClaim 필드와 결속.
- 이번 완료 조건: store+id 분리, 전체 rule hash 대조, 공유 owner/세대 의무 보존, 유실/조회실패/변조 구분, 미관리 규칙 자동 채택 금지, 읽기 중 입력 변조 방지.
- 안전 경계: 관측은 두 store의 원자 snapshot이 아니며 삭제 허가·RELEASED·SESSION_STORE_RESET 증거가 아니다. 기존 Worker에는 아직 연결하지 않으며 DNR 쓰기/서비스/설치를 변경하지 않는다.
- 다음 단위: 기존 Guest/Member 등 모든 DNR writer를 동일 guard에 결속하고 제품 Worker 연결. 이후 실제 확장 Chrome 수용 시험.
- 미검증: 실제 Chrome, writer 경쟁/원자 저장, quota·실제 해제, DOM/Content, 제품 전체 통합. 이 카드의 테스트 통과로 기능 완료를 선언하지 않는다.

## 2026-10-30 이번 단위 종료

- 읽기 전용 inventory 구현 및 API 모의 회귀 9/9 PASS (Node v24.19.0, `cd extension && node --test tests/additional-dnr-inventory.test.mjs`). 기존 Python fake coordinator 복제가 아닌 실제 JS 모듈의 두 Chrome getter 호출 경계 시험이다. 브라우저는 모의 객체다.
- 승인 계약의 legacy 경계·canonical hash 시험 6/6 PASS (`node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs`). 신규 모듈이 재사용하는 digest 및 구 actor 거절 경계를 확인했다.
- 승인 manifest 52/52 불변, 새 모듈 syntax·git diff whitespace 검사 PASS. 계약 전체265/SQL54는 변경하지 않아 재실행하지 않았고 이번 실행 수로 보고하지 않는다.
- 원래 /workspace/capstone-project의 지침 미커밋 변경과 index 보존. 작업 경로 /workspace/focurve-core, 기존 원격 Core 브랜치에서 시작해 최신 통합 기준으로 ff-only 반영.
- Commit/Push 및 실제 Worker 활성화는 하지 않았다. 이번 단위 완료이며 AMVP-CORE-04 전체는 진행 중이다.

## 2026-10-30 저장·해제·복구 단위 종료

- `extension/src/additional-dnr-store.js`: 기존 실행 DB의 metadata transaction을 재사용해 `amvp_journal_v1:dnr` sidecar 저장. 기존 Journal1.1 변경 없음. 원장 구조/claim/operation 상태 불일치 시 거절.
- `extension/src/additional-dnr-coordinator.js`: Web Lock 직렬화와 영속 writer epoch, 검증된 기존 규칙의 claim 예약, 해제 intent 선저장, SESSION/DYNAMIC 별 자기 claim 해제, 사후 재조회와 receipt 저장, 동일 operation 재시도 구현. 다른 owner·generation 및 미관리 규칙을 보존한다.
- 저장 실패나 양 저장소 부분 실패 시 PREPARED/IN_DOUBT 의무를 남긴다. receipt 저장 실패 후 새 store/coordinator로 복구하며 이전 writer를 거절한다. 종료 generation의 재채택과 진행 중 규칙의 타 owner 채택도 거절한다.
- 활성화 조건: `assertWritersGuarded`와 `verifyAdoption`은 내부 신뢰 경계이며 기본 거절. 시험의 true callback은 제품 안전성 증거가 아니다. 기존 writer 전체 결속이 아직 없으므로 제품 Worker에 연결하거나 신규 정책을 활성화하지 않았다.
- 자동 시험: inventory 9 + coordinator/store 15 = **24/24 PASS**. `cd extension && node --test tests/additional-dnr-*.test.mjs`. fake-indexeddb + Chrome DNR 모의 객체, Node 실제 Web Lock으로 저장 장애·부분 실패·공유 소유권·중복/충돌·epoch 경쟁·손상 원장을 검사했다.
- 기존 계약 Node **6/6 PASS**: `node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs`. `cd extension && npm run check` 및 `git diff --check` PASS.
- 추가 실제 기반 검사: 격리된 Linux Chromium 151 페이지에서 실제 IndexedDB 재열기 후 epoch 유지, reducer 오류 시 rollback, 실제 Web Lock을 통한 startWriter 성공 확인. 실제 확장 DNR/API·Windows·Worker 강제 종료 시험은 아니다.
- 환경: npm 기본 cache 쓰기 실패 후 `/tmp/focurve-core-npm-cache`로 `npm ci --ignore-scripts --no-audit --no-fund` 성공. package/lock 변경 없음.
- 남은 범위: 기존 writer guard 결속, 제품 Worker 연동, 신규 정책 APPLY/예약 연계, 실제 DNR quota·브라우저 재시작·Windows 통합 검증. DOM/Content 구현은 이번 범위 밖이다.
- 종료 현황: 이번 저장·해제·복구 모듈 단위 완료, **AMVP-CORE-04 전체는 부분 구현**. 전체 추가 MVP 완료율은 산정하지 않는다. Commit/Push 미실행.

## 첫 기능 PR 준비

- DNR 모듈3개·시험2개·본 작업카드·전용 CI만 첫 PR에 포함. TIME-05 및 통합현황 로컬 수정은 후속 변경으로 보존.
- 대상 브랜치: integration/additional-mvp-20261029. 자동 병합/제품 활성화 요청이 아니라 기반 모듈 리뷰 범위다.
- 제출 전 DNR24/24·기존 계약6/6·npm run check 재실행 PASS. GitHub CI는 Ubuntu/Windows Node24에서 동일 모의 시험 수행; Windows 실제 Chrome 수용 시험을 뜻하지 않는다.
- 미완료: legacy writer guard 전체 결속, Worker 진입점 연결, 실제 DNR·quota·브라우저 재시작 수용. 기존 API·DB·Content 구현은 이번 PR에 포함하지 않는다.
