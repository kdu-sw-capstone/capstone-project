# IG04 admission 검증 대기 수명

## 기준과 범위

AMVP-CORE-04 / IG04 후속 단위, 담당 윤종민. branch `feature/additional-mvp-ig04-verification-lifetime`, 시작/선행 PR86 HEAD `fc36d5ba3c41a7aa73e064322e6878775dfe23ef`. 원래 PR86 branch/커밋/승인은 수정하지 않는다. 후속 PR은 PR86 branch를 base로 하며 실제 integration 병합은 담당자가 관리한다.

기준은 기존 `03_Wire_D06_복원.md`의 만료/old-scope 구분, `05_Content_Event_UI.md`의 신규 효과/복원 의무 분리 및 PR86의 local expiresAt/isCurrent/AbortSignal 의미다. 실제 native/issued 원본·영속 예약 ACK·completion proof·RPT-02 계약은 미확정으로 보존한다.

## 문제와 변경

기존 admission은 await 뒤 기한·권한을 검사하므로 발급/native provider 또는 문서 조회가 끝나지 않으면 호출 Promise가 남았다. 재현3개에서 issued open 만료, native await 중 abort, issued await 중 invalidate가 모두 정해진 관측시간 안에 종료되지 않았다. 잘못된 ACK/DOM 효과를 만드는 결함이라는 뜻은 아니다.

변경 API:

- `IG04PlanAdmission.open({...기존옵션, signal?})`: 선택 abort signal로 opening 대기를 끝낼 수 있다.
- `verifyPlan(plan,{signal})`: 기존 signal을 provider/read/hash를 포함한 전체 검증 수명에 적용한다.
- `verifyIssued(context,{signal})` / `verifyNative(context,{signal})`: 두 번째 선택 metadata를 전달한다. 기존 context 한 인수 provider도 그대로 작동한다. 이 metadata는 새 Wire/권한/proof가 아니다.
- `invalidate()`: authority를 닫고 이 admission의 모든 미완료 호출을 거절한다. 각 요청의 abort는 해당 요청만 종료하며 다른 요청이나 기존 권한을 닫지 않는다.

기존 expiresAt을 생성 시점 monotonic 잔여 예산으로도 고정한다. wall clock 역행·새 요청으로 예산을 늘리지 않고 잘못된 clock 값은 거절한다. 새 grant TTL/임의 5초 timeout/시간집계 규칙을 만들지 않았다. 큰 timer 값은 JS timer 최대치로 나눠 처리한다.

취소/만료/폐기 후의 늦은 provider 성공·거절은 소비하며 후속 native/Registry 조회·gate pin을 진행하지 않는다. gate/document pin은 최종 검증 성공을 반환하는 같은 동기 단계에서만 반영한다. native/문서/저장 오류로 닫힐 때 최초 오류 근거를 보존한다.

**한계:** JS provider/IDB 작업을 강제 종료하는 기능이 아니다. provider가 signal을 무시해도 caller의 대기는 끝내지만 underlying 작업은 끝날 수 있다. callback은 기존대로 읽기 검증이어야 하며 취소를 transaction rollback/미접수/cleanup 완료로 해석하지 않는다. 영속 예약·ACK/CleanupGrant·scoped RELEASE·terminal·Report를 만들지 않고 Registry에는 쓰지 않는다. 실제 lifecycle 변경 감지/생산 invalidation caller와 Worker 연결은 미완료다.

## 검증 결과/실행

```
cd extension
npm ci --no-audit --no-fund
node --test tests/additional-ig04-lifetime.test.mjs tests/additional-ig04-admission.test.mjs tests/document-control-registry.test.mjs
npm test
node --test ../contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs
```

- 최초 동일3반례: base PR86에서0PASS/3FAIL → 변경 후3PASS. 원본 로그 `/tmp/ig04-lifetime-before.log`(이번 실행환경의 임시 근거).
- 최종 신규 lifetime15 + 기존 admission32 + Registry15 = **62/62 PASS**, fail/skip0.
- 전체 Extension **1026/1026 PASS**, 계약 **6/6 PASS**, fail/skip0. 겹치는 집합을 합산하지 않는다.
- 검증 범위: 끝나지 않는 issued/native/문서조회, open/plan abort, 이미 취소된 signal, 늦은 성공/거절, 동시 요청 중 한 건 취소/전체 폐기, 기존 의무 불변, wall rollback/forward 관측, 잘못된 clock, 최종 read 뒤 microtask 경계 취소와 gate pin 격리. 기존32시험 원문/기대값은 변경하지 않았다.
- 중간 구현은 최초 native/문서/저장 오류를 일반 AUTHORITY_CLOSED로 가리는 회귀3건이 있었고 원래 오류를 보존하도록 수정했다. 추가 동시성 fixture는 후속 재검증까지 mock을 대기시켜10초 만료1FAIL이 있었으며 mock 응답 범위를 고쳤다. 둘 다 기존 assertion을 완화/skip하지 않고 최종62에 포함했다.
- 최종 source + 실제 Content PR87 `2704148b9d6036a16d1ba2083ffe43ae14580744` receiver 합성 호환1/1 PASS. 기존 PR86 호환 probe와 같은 계획/metadata 경계를 대조하며 ACK 없음→DOM효과0·Registry operation0·cleanup 의무 유지. Linux Chromium151 headless·실제 IndexedDB이나 issued/native/current/채널은 모의다. 제품 MV3/실제 Instagram·Server·START 수용 NOT_RUN.
- compatibility 재현은 PR86의 `extension/tests/additional-ig04-content-compat-browser.mjs`와 같은 방식이며 PR87 receiver 대조는 별도 검토환경 probe로 수행했다. exact 소스·로컬 hash 기반이고 새 제품 bootstrap을 넣지 않았다.
- workflow는 integration과 선행 PR86 branch target을 지원하며 Ubuntu/Windows의 관련62·계약6을 실행한다. 새 HEAD의 원격CI는 PR 결과로 별도 확인한다.

## 상태/리뷰/다음 작업

로컬 구현·회귀 완료, PR/담당 리뷰 대기. 다훈: 만료/취소의 의미·오류 근거/원장 보존과 실제 예약 전제조건. 지민: reserve signal 전달·늦은 callback 차단·요청별 취소 격리. 기존 provider 두 번째 metadata와 원래 한 인수 callback의 호환을 확인한다.

기존 #76/#78/#80/#84·Content #87·PR86 원래 branch·공유 계약/DB·제품 entry/bundle은 변경/병합하지 않는다. 영속 ACK/proof·발급/native provider 매핑은 요청한 공동 합의 대기다. 이 단위로 IG04 전체/Core 전체가 완료됐다고 표시하지 않는다.
