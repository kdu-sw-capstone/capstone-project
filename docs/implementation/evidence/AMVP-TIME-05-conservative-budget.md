# AMVP-TIME-05 — C05 보수적 잔여 한도 계산부

- 담당: 윤종민. 날짜: 2026-11-02 (Asia/Seoul).
- 브랜치: `feature/additional-mvp-conservative-budget`.
- 시작 기준: integration `2201654e4ba3adbc1a4738bc14723b708d522c69`.
- 상태: 순수 계산 구현·로컬 검증 완료, 담당 리뷰·통합 대기. 실제 한도 집행 완료 아님.
- 기준: `docs/design/additional-mvp-contracts/04_정책_시간.md` C05 1~5의 기존 차감 보존·미해소 예약 반영·미정 gap hold·표시와 집행 분리, `06_인계_승인.md` AMVP-TIME-05. limit 범위는 현행 `contracts/additional-mvp/rc1/schema.json`의 SiteTimePolicy.daily_limit_ms를 따른다.

## 코드와 호출 전제

`extension/src/additional-conservative-budget.js`의 `calculateConservativeBudget(input)`는 동기 순수 계산 함수다. 입력·출력은 Core 내부 함수 값이며 신규 공용 Wire·DailyUsage/Receipt 형식이나 DB 저장 형식이 아니다. Worker entrypoint/manifest·DNR·Report·Content·Server에서 자동 호출하도록 연결하지 않았다.

입력은 정확히 네 필드다.

| 입력 | 의미 |
|---|---|
| limitMs | 검증된 해당 SITE_TIME 정책의 daily_limit_ms. null 또는60000~86400000 정수. UI 분 단위라는 이유로 승인 Schema의 유효한60001을 반올림하지 않음 |
| debitMs | 동일 설치/정책/집행 날짜 chain의 기존 확정·이월·집행 차감 합. 각 항목은 한 번만 포함 |
| provisionalMs | 길이/day가 검증된 미해결 provisional 예약의 중복 제거된 합. debitMs에 포함된 양은 다시 넣지 않음 |
| hasUnconfirmedGap | 길이/day/chain 연속성을 확인하지 못한 미해결 구간이 하나라도 있는지. 명시적 boolean 필수 |

차감·예약 합은 각각 비음수 safe integer다. 둘의 합이 JS safe integer를 넘어도 BigInt로 정확히 비교하고 잔여를0으로 포화한다. 입력 누락/추가 필드·문자열·NaN/Infinity·음수·소수·unsafe integer를0으로 치환하지 않고 거절한다.

**호출 전제:** current owner·설치·정책 버전·날짜 chain·원본/hash·중복 제거·신선도는 기존 검증 경로가 보장해야 한다. Server 조회 잔여만으로 미보고 로컬 debit/reservation이 없다고 가정하면 안 된다. 이 함수는 임의 숫자/false를 인증하지 않는다. false 입력은 gap 해소 proof가 아니며, 메모리 합산은 원장 원자 저장/멱등·resolution 검증을 대신하지 않는다. 실제 연결 전에 이 검증된 로컬 집계 provider를 확정해야 한다.

## 결과

- localOnly: 항상true.
- knownRemainingMs: 미확인 gap이 있거나 무제한이면null. 그 외 max(0,limit−debit−provisional)의 계산 결과. 이는 최신 DailyUsage/통계/Server 확인량이 아니다.
- enforcementRemainingMs: 한도가 있는 미확인 gap이면0, 확인된 경우 같은 산술 잔여, 무제한이면null.
- measurementUnconfirmed: 입력 gap을 그대로 보존하며0 사용/정상 완료로 바꾸지 않는다.
- requiresLimitedSiteHold: 한도가 있는 정책의 미확인 gap일 때만true.
- limitExhausted: 확인된 debit+provisional이 limit 이상이면true. 미확인 gap이 함께 있어도 기존 소진 이유 유지.
- requiresBudgetRestriction: 한도 소진 또는 해당 정책의 미확인 hold 필요. ALLOW/APPLIED/해제 완료·DNR 결과가 아니다.
- localReasons: 위 두 경우의 DAILY_LIMIT/MEASUREMENT_UNCONFIRMED 내부 원인 목록. shared Receipt/Report/DailyUsage enum에 이 배열을 그대로 보내지 않는다.

출력과 이유 배열은 동결하며 입력을 바꾸지 않는다. Focus·다른 owner 정책을 읽거나 변경하지 않는다. 무제한 정책에는 미확인 gap만으로 budget 제한을 요구하지 않는다. ALLOW_WINDOW·성인/키워드·Focus BLOCK 같은 다른 이유는 이 결과와 별도로 보존·합성해야 한다. NO budget restriction을 전역 ALLOW로 해석하면 안 된다.

## 검증

환경: Linux, Node24.19.0/npm11.9.0. Node 시험은 built-in만 사용한다. 기존 RC2 ConservativeBudget Python oracle은 계약용 fixture 모델이며 제품 권한/실제 저장·Chrome 증거가 아니다.

| 검증 | 결과 |
|---|---|
| 신규 Node 시험 | 17/17 PASS |
| 기존 RC2 Python ConservativeBudget 대조 | 96/96 PASS. limit 최소·비분단위·최대, 차감/예약0·소진·최대safe, gap 유무 조합 |
| 전체 Extension | 996/996 PASS. integration 기존979+신규17, 신규17 포함 |
| 기존 계약 legacy-boundary | 6/6 PASS |
| JavaScript syntax·diff whitespace | PASS |

음수/소수/NaN/Infinity/unsafe/missing 입력 거절, 정확1ms 잔여·경계 소진·미확인+소진 이유 동시 보존, 무제한, known reservation을 같은 검증 duration의 확정 debit으로 대체할 때의 산술 잔여 불변, debit/reservation 증가에 따른 잔여 비증가를 확인했다. 대체 시험은 산술만 확인하며 proof 검증 구현을 주장하지 않는다.

```bash
npm --prefix extension ci --ignore-scripts --no-audit --no-fund
node --test extension/tests/additional-conservative-budget.test.mjs
npm --prefix extension test
node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs
npm --prefix extension run check
# 기존 계약 requirements.lock 의존성이 있는 환경에서 선택 대조
python3 extension/tests/additional-conservative-budget-oracle.py
```

신규 Ubuntu/Windows CI는 Node17·계약6·syntax를 실행한다. Python96 대조는 선택 로컬 검증이며 Node CI 성공에 포함하지 않는다. 이번 작업에서 제품 실패 반례를 발견/수정했다고 주장하지 않는다. 기존에 없던 계산부의 구현과 계약 대조다.

## 미완료·선행·리뷰

검증된 로컬 집계 provider·authority/freshness·source/정책/day 멱등 결속, raw/cursor/reservation/outbox 원자 저장, proof 기반 gap 해소/예약 대체, 자정/시간대/회원전환 carry 생성, 한도/시간창 등 정책 합성·실제 DNR 적용/해제 증거·Report/Server 연결은 후속이다. carry가 필요한 전환에서 단순 새 limit 입력만으로 잔여 floor 보존을 보장하지 않는다. 검증된 carry debit을 먼저 계산·보존해야 한다.

실제 Worker·Chrome START·장시간 계수/차단 수용은 미실행. #84/#89/#90·IG04 #86/#88·영속 ACK/완료 proof·RPT-02 공동 계약은 변경하지 않는다. 같은 integration base의 독립 PR이므로 이전 PR별 전체 시험 수와 단순 증감 비교하지 않는다. 공유 TIME-05·통합현황 기록을 합칠 때 양쪽 기록을 보존한다.

다훈은 C05 산술/Server 미보고 로컬 예약 선행 조건/UNKNOWN 표시 경계를, 지민은 무제한·Focus/다른 owner 정책 및 Content 복원 책임과의 경계를 검토한다. 실제 연결을 위한 로컬 집계 provider와 scope/신선도/미확인 해소 증거 경계는 후속 합의가 필요하며 임의 활성화하지 않는다. 병합은 통합 담당이 진행한다.
