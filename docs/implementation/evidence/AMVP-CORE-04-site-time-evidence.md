# SITE_TIME DNR 원본 증거 조회 — Core 내부 첫 연결 단위

기능 ID `AMVP-CORE-04`, 담당 윤종민. 기준 통합 `467fe18b176ccd571813d04229e8ee69f19a00d2`와 확정 RC2의 `SiteTimePolicy`, `DnrClaim`, Wire/원장·복원 원칙을 따른다. 이 문서는 **Core 로컬 구현 API** 설명이며 새로운 공용 Wire/Server 계약 승인안이 아니다.

## 구현과 범위

- `extension/src/additional-dnr-site-time-evidence.js`의 `SiteTimeDnrEvidence`.
- 기존 `AdditionalDnrCoordinator.exclusive`, `AdditionalDnrStore`, `inspectAdditionalDnr`, canonical `digest`를 재사용한다. 원래 DNR 관리·해제, 관측 collector, Core/Content/Server 생산 코드는 수정하지 않는다.
- 한 operation은 SITE_TIME 정책 **하나**에 결속한다. 여러 정책을 같은 operation으로 한꺼번에 발행하는 연결은 이번 범위에 포함하지 않는다.
- `register()`는 정책 원문/버전·operation·owner/executor/execution/package/revision/generation·기대 claim을 영속 결속한다. **규칙 설치/자동 채택/cleanup 권한 발급은 하지 않는다.** 기존 writer의 효과 전 또는 효과 후에 호출할 수 있다.
- `read()`는 등록 당시 관측과 현재 실제 DNR getter/원장 관측을 반환한다. 등록이 효과 후였다면 등록 당시 관측도 효과 후 관측이며 이를 적용 전 상태로 소급하지 않는다.
- 실제 규칙 생성·적용은 기존/후속 writer 책임이다. 기존 `releaseOwner()`는 owner/generation 전체를 해제하는 API이며 이 모듈이 정책 단독 해제 API로 바꿔 호출하지 않는다.

## 생성 조건

```js
const source = new SiteTimeDnrEvidence({
  coordinator,                 // 기존 실제 DNR coordinator/store/db
  verifyBinding,               // 아래 실제 issued source/현재 owner 검증 주입점
});
await source.register({context, policy, claims});
const evidence = await source.read(context);
```

`verifyBinding({context,policy,claims})`은 신뢰된 Core 경로에서 원래 발급 operation/package·완전한 SiteTimePolicy 유효성·현재 owner/executor/execution/generation과 기대 claim/rule hash 관계를 검증하고 strict `true`를 반환해야 한다. 이것은 이미 구현된 제품 provider라고 가정하지 않는다. **기본값은 false**이며, 시험의 true callback은 SYNTHETIC이다. Web/Content가 보낸 본문이나 임의 ID가 이 검증을 대신할 수 없다.

또한 기존 coordinator의 `assertWritersGuarded`가 실제 legacy writer 전체의 동일 Web Lock/미해결 의무 존중을 보장해야 한다. 기본 거절을 제거하거나 이번 PR에서 Worker/manifest를 활성화하지 않는다. `read`도 동일 검증을 반복한다. 후속 전송자는 현재 권한·증거 시점/신뢰 clock을 별도로 검증해야 한다.

## 입력 형식

```js
context = {
  operation_id, owner_binding_id, executor_id,
  runtime_execution_id, package_id, // 모두 기존 lowercase UUID
  runtime_revision: 1, generation: 1 // 양의 safe integer
};
policy = /* 기존 RC2 SiteTimePolicy 원문: kind, policy_id, version 등 */;
claims = /* 기존 RC2 DnrClaim[]: store+id+전체 rule hash+owner/generation/epoch */;
```

등록은 claim의 변경 가능한 `restore_state`를 제외한 원본을 고정한다. 같은 operation/의미는 중복 결과를 반환하고, 같은 operation의 다른 문맥/내용은 거절한다. 동일 owner의 같은 policy_id/version을 다른 정책 원문으로 다시 등록하는 것도 거절한다. 최초 등록 epoch가 현재 writer epoch와 다르면 거절한다. 기존 등록의 읽기는 새 writer에서도 원래 claim epoch/문맥을 유지하여 가능하지만 자동 소유권 이전은 없다.

실제 RELEASE 원장의 operation ID는 등록 operation과 다를 수 있다. 읽기 결과의 `current.operations[].operation_id`가 기존 coordinator의 cleanup operation이며, 원래 등록 operation이나 정책 삭제 버전으로 바꿔 쓰지 않는다. `policy_version`은 등록한 원문의 버전이다. Server의 tombstone 버전/삭제 operation에 자동 맞추는 기능은 없다. 다훈의 후속 연결은 원래 적용 문맥과 실제 삭제/해제 문맥 관계를 검증해야 한다.

## 반환 형식

```js
{
  local_only: true,
  evidence_kind: 'SITE_TIME_DNR_OBSERVATION',
  runtime_report: false,
  context, policy_id, policy_version, policy_sha256, intent_sha256,
  registration: snapshot, // 최초 등록 시 관측, 이후 덮어쓰지 않음
  current: snapshot       // 이번 읽기의 getter/원장 관측
}
```

`snapshot`:

| 필드 | 의미 |
|---|---|
| `writer_epoch`, `journal_sha256` | 관측한 기존 DNR 원장의 epoch/내용 hash |
| `stores.SESSION/DYNAMIC` | `OBSERVED` 또는 `UNKNOWN`, 정제된 오류 코드 |
| `claims[]` | 기대 claim의 immutable 참조와 아래 관측/의무 |
| `operations[]` | 관련 기존 RELEASE intent/Receipt의 ID·semantic hash·state·claim IDs·`scope_verified` |
| `unmanaged_rule_keys` | 원장 밖 물리 store+id. 자동 채택/삭제하지 않음 |
| `snapshot_sha256` | 이 snapshot 내용의 canonical hash |

각 claim에는 `registered`, `identity_matches`, `restore_state`, `comparison`(`MATCH/MISSING/MISMATCH/UNKNOWN`), `actual_rule_sha256`, `other_live_claim_ids`가 있다.

- `live_footprint_matches`: 정확한 등록 claim이 APPLIED이고 관련 release가 대기 중이 아니며 실제 전체 rule hash가 일치하는 **DNR 범위 관측**. 전체 SITE_TIME/Content/세션 성공을 의미하지 않는다.
- `release_footprint_verified`: 등록 claim이 RELEASED이고 owner/generation·전체 claim set·RELEASE semantic hash가 맞는 기존 RELEASED Receipt가 있으며, 실제 규칙 부재 또는 다른 live claim이 유지하는 동일 규칙을 확인한 경우다. 단순 getter 부재/ACK/함수 반환만으로 true가 되지 않는다.
- `cleanup_pending`: 등록된 claim이 미해제이거나 현재 해제 footprint를 검증하지 못했음을 뜻한다. 이 읽기는 원장의 의무를 삭제하거나 상태를 고치지 않는다. 미등록은 미등록으로 표시하며 규칙 존재만으로 원장 소유권을 만들지 않는다.

원시 rule URL과 브라우저 예외 원문은 반환하지 않는다. 두 Chrome store는 원자 snapshot이라고 주장하지 않는다. 기존 writer Lock 안에서 읽고, 관측 전후 원장 hash가 바뀌면 실패한다. hash는 무결성/대조용이며 서명·sender·capability 증명이 아니다. 이 결과에는 신뢰 clock/`observed_at`이 없다. RuntimeReport/전체 APPLIED·RELEASED/Server ACK로 그대로 승격하지 않는다.

## 저장과 실패

기존 실행 DB `metadata`의 `amvp_journal_v1:site-time-dnr-evidence` sidecar만 추가한다. DB version/migration, 기존 DNR journal/Journal1.1은 변경하지 않는다. intent/등록 관측을 한 transaction에 저장하고 hash를 재확인한다. 기본 1024개 등록 상한이며 미해결 기록을 LRU로 지우지 않는다. 상한 후 새 등록은 거절하고 동일 등록 재시도는 가능하다. 이는 제품 장기 보존/성능 수용 완료가 아니다.

권한·storage/hash·stale epoch·동일 ID 충돌은 오류로 거절한다. Chrome getter 실패는 UNKNOWN으로 남기고, 효과 후 Receipt 저장 실패는 기존 PREPARED/IN_DOUBT를 그대로 관측한다. 조회 결과를 빈 성공/새 APPLY 허가로 사용하지 않는다.

## 재현과 검증 경계

저장소 루트:

```sh
npm --prefix extension ci --ignore-scripts --no-audit --no-fund
node --test extension/tests/additional-dnr-inventory.test.mjs extension/tests/additional-dnr-coordinator.test.mjs extension/tests/additional-dnr-site-time-evidence.test.mjs
node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs
npm --prefix extension test
npm --prefix extension run check
```

별도 브라우저 저장 시험: 설치된 Playwright 경로를 `PLAYWRIGHT_MODULE`, Chromium 실행 파일을 `CHROME_EXECUTABLE`로 지정하고 `node --test extension/tests/additional-dnr-site-time-evidence-browser.mjs` 실행. 이 시험은 **실제 Chromium IndexedDB/Web Lock + SYNTHETIC DNR/issued source**이며 실제 확장 DNR 시험이 아니다. Node 전용 CI는 이를 실행하지 않는다.

실제 MV3 DNR 시도는 현 환경의 관리 정책에 따른 임의 확장 로드 차단으로 worker 생성 timeout이었다. 정책은 변경하지 않았으며 실패 로그를 보존했다. 실제 확장 DNR·Windows Chrome·네트워크 차단·Worker 강제 종료/제품 owner 전환은 미검증이다. 기존 writer 전체 결속·실제 issued binding provider·정책 실행/Worker 연결·RuntimeReport/전송·capability/collector/clock은 후속 범위다.
