# AMVP-CORE-04 — C06 정책 제한 사유 합성

- 담당: 윤종민. 날짜: 2026-11-02 (Asia/Seoul).
- 브랜치: `feature/additional-mvp-policy-reasons`.
- 시작 기준: integration `2201654e4ba3adbc1a4738bc14723b708d522c69`.
- 상태: 내부 합성 함수 구현·로컬 검증 완료, 담당 리뷰·통합 대기. 실제 정책 compiler/집행 전체 완료 아님.
- 기준: `docs/design/additional-mvp-contracts/04_정책_시간.md` 판정 순서·충돌 벡터 및 최종 선택 C06(모든 matching 제약/예외는 해당 reason만 제거), C05 미확인 hold 보존; `06_인계_승인.md` Core 정책·DNR 경계. 기존 `contracts/additional-mvp/rc1/tests/reference_model.py`의 reasons와 대조했다.

## 구현과 범위

`extension/src/additional-policy-reasons.js`의 동기 순수 함수 `composePolicyReasons(input)`를 추가했다. 기존 legacy host 선택, 목적 분류, Snapshot/Attachment, actor·DNR·DOM·Report를 변경하지 않는다. Worker/manifest/제품 caller에 자동 연결하지 않는다.

입력은 정확히 세 필드다.

| 입력 | 의미 |
|---|---|
| focusAccess | 기존 검증된 frozen Snapshot의 MOST_SPECIFIC_HOST 선택 등 기존 host 규칙으로 이미 결정한 ALLOW/BLOCK/RECORD. purpose 값을 받거나 정책으로 변환하지 않음 |
| runtimeReasons | 동일한 검증된 현재 대상/owner/scope에서 **모든 matching 정책**을 평가한 제한 사유 배열. 중복 허용, 합성 시 제거 |
| exceptions | 검증된 해당 feature 예외 매치. 정확한 boolean adultDomain/keyword 두 필드 |

허용 runtime 사유는 DAILY_LIMIT/BLOCK_WINDOW/OUTSIDE_ALLOW_WINDOW/ADULT_DOMAIN/KEYWORD 및 기존 C05의 로컬 MEASUREMENT_UNCONFIRMED다. USER_SITE는 focusAccess BLOCK에서만 생성한다. 알 수 없는 reason/누락/비배열/sparse array/잘못된 예외를 묵시적 빈 목록/ALLOW로 바꾸지 않고 INVALID_POLICY_REASONS_INPUT으로 거절한다.

- adultDomain 예외는 ADULT_DOMAIN만 제거한다.
- keyword 예외는 KEYWORD만 제거한다.
- DAILY_LIMIT·시간창·MEASUREMENT_UNCONFIRMED·USER_SITE는 위 예외로 제거하지 않는다.
- 모든 남은 사유를 합집합으로 보존한다. 사유가 있으면 candidateAccess BLOCK, 없으면 원래 focusAccess 유지한다.
- 동일 사유가 여러 matching 정책에 있어도 결과에는 한 번만 포함한다. 이는 시간 계수/차감량의 중복 제거를 구현한 것이 아니다.
- 결과와 이유 배열을 동결하며 입력을 바꾸지 않는다.

결과: `{localOnly:true, candidateAccess, requiresRestriction, localReasons}`. candidateAccess의 ALLOW/RECORD도 실행 권한이 아니며 BLOCK도 실제 적용 완료가 아니다. operation·Receipt·confirmed_ms·session status·cleanup terminal을 생성하지 않는다. localReasons를 shared Receipt/RuntimeReport enum으로 바로 전송하지 않는다. 특히 MEASUREMENT_UNCONFIRMED를 신규 Wire enum으로 추가하지 않았다.

## 호출 전제와 기존 부품 연결

원본 issued policy/package·owner·host·binding/document/generation·source/profile/hash·권한·신선도 및 검증 결과의 완전성은 신뢰된 caller가 먼저 확인해야 한다. source 조회 실패나 미확인을 빈 배열로 넘기면 안 된다. 이 함수는 source 검증기/host matcher/clock/model/profile verifier가 아니다. C08/C09/C10 artifact/profile 활성화 조건도 기존대로 필요하다.

#84 evaluateSiteTimeWindows의 reasons와 #91 calculateConservativeBudget의 localReasons를 합칠 수 있는 내부 형태다. 실제 caller는 단일 최장 host 정책만 고르지 말고 모든 matching budget 결과를 포함해야 하며, 다른 검증된 feature 사유도 보존해야 한다. #84 내 정책별 허용창 union/정책 간 AND를 다시 작성하지 않는다. 같은 physical interval의 계수/차감은 기존 원장 멱등 경로의 책임이다.

실제 #84/#91 모듈과 네 가지 호환 벡터를 확인했다: 허용창+소진 한도, 부모 block+자식 allow, 밖의 허용창+미확인 hold+feature 예외, 제한 없음에서 RECORD 유지/독립 focus BLOCK 유지. 모듈 연결 시험은 별도 `/workspace/reviews/policy-reasons-compat.mjs`로 실행했으며 합성 시각/정책 입력이다. 제품 caller·DNR/DOM·native/Server 연결 완료를 뜻하지 않는다.

기존 목적/정책 분리 제안은 별도 공동 변경 범위다. 현행 FOCUS/GENERAL→ALLOW, DISTRACTION→BLOCK/RECORD 검증을 완화하지 않았다. 실행 중 frozen Snapshot/Attachment 재해석·설정 자동 변경은 수행하지 않는다.

## 검증

환경: Linux Node24.19.0/npm11.9.0. Node 시험은 built-in만 사용한다. Python 대조는 기존 계약 requirements.lock 의존성을 사용한다.

| 검증 | 결과 |
|---|---|
| 신규 Node | 18/18 PASS |
| 기존 RC2 reasons oracle | 384/384 PASS: ALLOW/BLOCK/RECORD × 기존7 boolean 전 조합 |
| 실제 #84/#91 모듈과 별도 합성 호환 | 4/4 PASS, 시각/정책·권한 입력은 합성 |
| 전체 Extension | 997/997 PASS: integration979+신규18. 신규18 포함 |
| 기존 계약 legacy-boundary | 6/6 PASS |
| JavaScript syntax·diff whitespace | PASS |

미확인 hold는 C05 내부 사유로 Node에서 별도 검증했으며, 기존 Python reasons 함수에 그 사유를 새로 추가해 대조를 맞추지 않았다. 신규/기존 계약 source·assertion을 완화하지 않았다. 이번은 신규 합성 함수 구현이며 기존 제품 결함을 발견/수정했다고 주장하지 않는다.

```bash
npm --prefix extension ci --ignore-scripts --no-audit --no-fund
node --test extension/tests/additional-policy-reasons.test.mjs
npm --prefix extension test
node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs
npm --prefix extension run check
# 기존 계약 dependencies 환경의 선택 대조
python3 extension/tests/additional-policy-reasons-oracle.py
```

전용 Ubuntu/Windows CI는 신규18/계약6/syntax를 실행한다. Python384·별도 호환4는 로컬 대조이며 해당 Node CI 수에 포함하지 않는다. 기존 PR source를 변경하지 않았다. 과거 전체 시험 수와 차이는 동일 integration에서의 독립 PR별 신규 시험 수 차이이며 기존 시험 삭제가 아니다.

## 리뷰·미완료·후속

다훈은 RC2/C05/C06의 독립 제한 우선순위·예외 범위·미확인 결과 처리와 Report 승격 금지 경계를, 지민은 feature 예외가 다른 제한/owner/복원 의무를 제거하지 않는지 확인한다. 원본 Snapshot/정책/예외·claim·cleanup을 수정하지 않는 순수 계산이다. 공유 CORE-04·통합현황을 합칠 때 기존 이력을 보존한다. 병합은 통합 담당이 진행한다.

미완료: 실제 검증된 전체 matching source provider, issued/native·scope/freshness 검증, immutable package/claim compiler와 실제 DNR/DOM 적용·조회·해제, clock/budget/collector/Report 연결 및 Windows MV3/Chrome START·장시간 제품 수용. IG04 예약 ACK/완료 proof 및 목적/정책 분리 합의는 기존 대기 상태다. 합의 없는 형식/신뢰 플래그를 새로 만들거나 기존 provider 기본 거절을 제거하지 않는다.
