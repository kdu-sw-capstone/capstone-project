# AMVP-TIME-05 — 관측 원장 복구 검증 보강

- 담당: 윤종민. 날짜: 2026-11-02 (Asia/Seoul).
- 브랜치: `fix/additional-mvp-observation-recovery`.
- 시작 기준: integration `2201654e4ba3adbc1a4738bc14723b708d522c69`.
- 상태: 구현·로컬 자동 검증 완료, 담당 리뷰·통합 대기. 이용시간 전체 완료 아님.
- 기준: `docs/design/additional-mvp-contracts/04_정책_시간.md` C05/C11 및 Worker 재생성 durable cursor·미확인 구간 보존, `06_인계_승인.md` AMVP-TIME-05. 기존 local staging v1 제약을 복구 시에도 검증한다. 공유 Wire·DB migration·외부 API 변경 없음.

## 문제와 수정

기존 recover는 hash·순번·cursor를 검사하지만 최신 문맥/epoch 의무와 capture owner 결속, 관측 필드 의미는 충분히 검사하지 않았다. hash를 다시 계산한 잘못된 boundary도 통과했다. 또한 recover의 비동기 hash 검사 이후 transaction 전 내용이 바뀌어도 cursor만 같으면 start/append/중복 응답이 진행됐다.

`extension/src/additional-observation-journal.js`의 기존 `recover/start/append`를 보강했다.

- epoch별 RESTART_UNCONFIRMED 의무·boot/executor/owner 문맥·capture의 epoch/context 결속을 검사한다. 현재 v1에는 의무 삭제/완료/compaction API가 없으므로 epoch 전체를 보존해야 한다.
- append와 recover가 같은 boundary 검사 함수를 사용한다. 알 수 없는 추가 필드·잘못된 상태·대상·flag·epoch/같은 epoch 내 mono/revision 역행을 거절한다.
- 비동기 digest 이후 같은 IndexedDB transaction 안에서 전체 복구 snapshot을 비교한다. cursor가 같아도 내용이 바뀌면 기존 CURSOR_CONFLICT로 거절한다. start·append·중복 반환 모두 적용된다.
- 실패 시 원본·cursor·의무·다른 metadata를 삭제/대체하지 않는다. runtime은 observer 시작 전 복구 실패를 FAILED/UNKNOWN·hold로 유지한다. 읽기 실패를 이용량0 또는 정상 수집으로 바꾸지 않는다.
- 정상 기존 v1 기록·빈 epoch·다른 owner/boot 이력·동일 관측값은 복구 가능하다. capacity를 줄여도 기존 이력을 지우지 않는다.

이는 구조·문맥·동시성 검증이다. 모든 데이터와 hash를 함께 조작한 공격자를 인증하는 서명이나 실제 current owner 권한 증거는 아니다. 저장 형식/key/version은 그대로이며 자동 복구·migration은 수행하지 않는다. CURSOR_CONFLICT 이후에는 caller가 현재 원장을 다시 읽어야 하며 이전 검증 결과를 재사용하지 않는다.

## 검증

환경: Linux, Node 24.19.0/npm 11.9.0, fake-indexeddb 6.2.5, 별도 Chromium 151의 native IndexedDB.

| 실행 | 결과 | 범위 |
|---|---|---|
| 새 반례 최초 4건 | 수정 전 0/4, 모두 예상 거절 누락 | context·의무·foreign owner·관측 flag |
| transaction 경합 추가 3건 | snapshot fence 수정 전 새 3건 실패 | start·append·중복 반환 사이 저장값 변경 |
| `node --test extension/tests/additional-observation-recovery.test.mjs` | 24/24 PASS | 위 반례 포함·손상/정상 이력·runtime·원본 보존 |
| 아래 관련 시험 | 55/55 PASS | 새24 + 기존31, 중복 합산 금지 |
| `npm --prefix extension test` | 1003/1003 PASS | 전체 Extension; 관련55 포함 |
| `node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs` | 6/6 PASS | 기존 계약 경계 |
| `npm --prefix extension run check` / `git diff --check` | PASS | JavaScript syntax / whitespace |
| 선택 브라우저 시험 | 1/1 PASS | 실제 Chromium IndexedDB 정상 저장·손상 거절·다른 metadata 보존 |

관련 시험 명령:

```bash
node --test extension/tests/additional-idle-observer.test.mjs extension/tests/additional-foreground-observer.test.mjs extension/tests/additional-observation-journal.test.mjs extension/tests/additional-observation-recovery.test.mjs extension/tests/additional-time-runtime.test.mjs
```

브라우저 시험은 기존 설치를 지정한다. 패키지 다운로드/제품 Chrome 실행을 요구하지 않는다.

```bash
PLAYWRIGHT_MODULE=/path/to/playwright CHROME_EXECUTABLE=/path/to/chromium node --test extension/tests/additional-observation-recovery-browser.mjs
```

첫 브라우저 시험은 시험용 HTTP route에서 import되는 JSON MIME 처리 누락으로 모듈 로딩에 실패했다. JSON route를 추가한 뒤 1/1 PASS였으며 제품 코드를 완화하지 않았다. `.github/workflows/additional-core-time.yml`의 Ubuntu/Windows 관련 시험 목록에 새 Node 시험을 추가했다. 선택 브라우저 시험은 기존 설치가 필요한 별도 실행이며 CI 통과에 포함하지 않는다.

## 미완료·후속·리뷰 요청

실제 Worker 연결·권한/native authority·privileged clock anchor·확정/격리 시간 계수·raw/reservation/outbox 전체 원자 경로·한도 집행·장시간/Windows MV3 제품 수용은 별도 미완료다. 새 RESTART_UNCONFIRMED 의무 완료 프로토콜을 만들지 않았다. #86/#88 IG04 admission/lifetime와 실제 영속 ACK/proof 공동 계약 대기는 그대로 보존한다. 다른 PR 소스를 합치지 않았다.

다훈: 저장 실패/복구 거절이 usage0·성공으로 번역되지 않는 경계와 전체 snapshot CAS 검토. 지민: 다른 owner 기록·미해결 의무 보존 및 기존 Content 복원 의무와의 경계 확인. 기능 전체 승인이나 실제 Chrome 수용 승인을 요청하지 않는다. 통합 담당이 병합한다.
