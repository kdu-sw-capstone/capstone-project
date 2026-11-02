# AMVP-CORE-04 — 문서 Registry 복구 무결성 검증

- 담당: 윤종민. 날짜: 2026-11-02 (Asia/Seoul).
- 브랜치: `fix/additional-mvp-document-registry-recovery`.
- 시작 기준: integration `2201654e4ba3adbc1a4738bc14723b708d522c69`.
- 상태: 구현·로컬 자동 검증 완료, 담당 리뷰·통합 대기. IG04 실제 연결/제품 수용 완료 아님.
- 기준: `docs/design/additional-mvp-contracts/03_Wire_D06_복원.md` owner/document/미해결 복원 의무와 Worker 복구 원칙, `06_인계_승인.md` Core 소유권/복원 경계 및 기존 [문서 Registry 정의](EXT-02-2026-10-10-document-registry.md).

## 문제와 기존 반례

기존 DocumentControlRegistry는 외부 reference/scope 입력은 검사하지만 저장된 row·slot·operation/의무의 연결 관계를 충분히 검사하지 않았다. 별도 IndexedDB v1의 손상 내용을 raw transaction으로 주입했을 때 다음4건에서 예상 거절이 누락됐다.

1. APPLY operation은 남아 있는데 obligations가 지워지면 pending이 빈 성공으로 반환.
2. CONFIRMED RELEASE 없이 state를 RESTORED로 바꾸면 미해결 의무가 숨겨짐.
3. ticket의 controlScope가 원래 intent/binding과 달라도 load가 반환.
4. 슬롯이 다른 executor의 문서를 가리키면 observe가 그 다른 문서를 INACTIVE로 변경할 수 있음.

이는 저장 손상을 주입한 합성 반례다. 실제 제품/Chrome에서 발생했다고 주장하지 않는다. 기존 source에 보정된4개 반례를 다시 실행해0/4 PASS를 확인한 뒤 최종 수정에서 거절을 확인했다.

## 코드와 동작

제품 변경은 `extension/src/document-control-registry.js` 하나다.

- 기존 v1 문서의 key/ref·lifecycle·epoch·연속 sequence, operation ID·intent/ticket/ref/scope·원래 binding 의무를 검사한다. scope 구조는 기존 검증 함수를 그대로 재사용한다.
- 각 binding의 APPLY와 저장된 완료 결과 이력에서 내부 의무 상태를 대조한다. 근거 없는 RESTORED/APPLY_CONFIRMED/DOCUMENT_GONE 등은 거절한다. GONE에서도 기존 RESTORED 또는 DOCUMENT_GONE과 과거 결과는 보존한다.
- slot의 key 및 documentKey의 executor/tab/frame 결속을 검사하고, 참조한 이전 문서가 실제 존재하는지 확인한다. 다른 executor/tab으로의 저장 pointer를 관측 근거로 사용하지 않는다.
- load/pending 및 observe/stage/complete/confirmGone의 대상 row를 읽기/변경 전에 검사하고, 생성/갱신된 row도 저장 전에 검사한다. 실패는 transaction abort + INVALID_DOCUMENT_REGISTRY이며 원본을 재구성·삭제하지 않는다.
- 관측 epoch 증가가 safe integer를 넘어 저장되는 것도 거절한다. 교체 중 이전 문서의 INACTIVE put 뒤 대상 손상을 발견해도 같은 transaction의 변경을 모두 rollback한다.
- pending은 식별 가능한 다른 executor의 손상 row 때문에 정상 executor의 의무를 거절하지 않는다. key/ref 중 하나가 대상 executor를 가리키면 해당 row를 검사한다. executor를 분류할 수 없는 저장 key는 빈 성공으로 숨기지 않고 오류로 남긴다.

public 메서드 입력/응답, DB 이름 `focurve-core-documents`·버전1·documents/slots·필드 형식은 불변이다. migration·의무 GC·과거 operation eviction은 하지 않는다. 정상 v1/비활성/BFCache/재활성/저장 실패/정상 과거 duplicate·cleanup 재시도와 capacity 이후 RELEASE는 유지한다.

**검증 한계:** 이는 저장된 연결 관계의 구조/일관성 검사다. 내용과 전체 결과 이력을 함께 일관되게 바꾼 데이터를 서명·실제 DOM/native 증거로 인증하지 않는다. observe/confirmGone/complete에 필요한 신뢰된 Chrome 관측·실제 효과 검증은 원래 caller 책임이며 기본 source 검증을 대체하지 않는다. 기존 ticket을 IG04 예약 ACK·CleanupGrant·완료 proof로 승격하지 않는다.

## 검증

환경: Linux Node24.19.0/npm11.9.0, fake-indexeddb6.2.5. Chromium151 native IndexedDB 및 기존 Dedicated Worker probe. 문서/native lifecycle·effect outcome은 모의다.

| 검증 | 결과 |
|---|---|
| 기존 source의 보정된 최초 반례 | 0/4 PASS, 예상 거절 누락4건 |
| 신규 Node 회귀 | 21/21 PASS |
| 기존 Registry15 + 신규21 | 36/36 PASS |
| 전체 Extension | 1000/1000 PASS, integration979+신규21 |
| 기존 계약 legacy-boundary | 6/6 PASS |
| 실제 #86/#88 admission·수명 모듈과 별도 복사본 호환 | 83/83 PASS: admission32+lifetime15+Registry36 |
| 새 Chromium native IDB probe | 1/1 PASS: 원본 의무/foreign slot 손상 거절·원본/타 executor 보존 |
| 기존 Dedicated Worker 종료/재생성 probe | PASS: 원래 ticket·재확인 guard·stale 거절·cleanup 실패/재시도 |
| JavaScript syntax·diff whitespace | PASS |

신규21은 관련36/전체1000 및 호환83에 포함되며 중복 합산하지 않는다. 호환 복사본은 #88 ed8755a597973922d02bd675e80b00c410dfdaf4의 admission·시험을 사용하고 Registry만 이번 소스로 대조했다. #86/#88 원본 worktree와 HEAD는 변경하지 않았다. 이전 독립 PR별 전체 시험 수 차이는 같은 integration의 신규 시험 수 차이이며 기존 시험 삭제가 아니다.

추가 반례: ref/sequence/epoch/intent/result/의무 graph의 손상을 모든 대상 경로에서 거절·원본 보존, 슬롯의 원래 문서 누락, 교체 transaction rollback, 다른 executor 손상 격리, epoch 상한, 정상 실패 cleanup 재시도·GONE의 과거 duplicate 확인.

처음 ticket.controlScope 불일치 주입은 저장 객체가 공유 참조를 유지해 intent/의무까지 같이 바뀌었으므로 구조 검사에서 거절되지 않았다(관련18PASS/1FAIL). ticket scope 객체만 새 객체로 교체하도록 주입을 수정해 정확한 불일치를 만들고 기존 source의4건 실패를 다시 확인했다. 기대 거절/원본 보존 assertion을 완화하지 않았다. 전체를 일관되게 재작성한 데이터를 인증한다고 주장하지 않는다.

```bash
npm --prefix extension ci --ignore-scripts --no-audit --no-fund
node --test extension/tests/document-control-registry.test.mjs extension/tests/document-control-registry-recovery.test.mjs
npm --prefix extension test
node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs
npm --prefix extension run check
# 기존 Playwright·Chromium 설치의 선택 probe
PLAYWRIGHT_MODULE=/path/to/playwright CHROME_EXECUTABLE=/path/to/chromium node --test extension/tests/document-control-registry-recovery-browser.mjs
# Python Playwright·Chromium이 있는 환경의 기존 Worker probe
python3 extension/tests/ui/document_registry_worker.py
```

새 Ubuntu/Windows CI는 관련36·계약6·syntax를 실행한다. 선택 browser/Worker 및 별도 IG04 호환 시험은 해당 Node CI 수에 포함하지 않는다.

## 리뷰·미완료

다훈: 저장 row/slot/operation/의무 결속과 오류가 빈 성공으로 바뀌지 않는 경계 검토. 지민: BFCache·문서 교체·과거 ticket·타 executor/owner와 기존 cleanup 재시도 보존 검토.

실제 issued/native provider·IG04 예약 commit ACK/CleanupGrant·완료 proof·재시작 인계, 실제 Worker→Content caller·DNR/DOM/Report·Chrome MV3/Windows/Server 제품 수용은 별도 미완료다. 목적/접근 정책 분리·공유 계약도 변경하지 않는다. 본 수정에 actual START/정책 활성화·다른 PR 병합을 포함하지 않는다. 공유 CORE-04·통합현황 통합 시 양측 기록을 보존하고 통합 담당이 최종 병합한다.
