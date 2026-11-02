# AMVP-TIME-05 — SITE_TIME 시간창 판정

윤종민 / `feature/additional-mvp-site-time-windows` / 기준 통합 `9ebec52dc533dd497e454815b53b654ab42ef4fa`. 보고서 PR76/78/80은 별도 검토 대상으로 보존한다. 이번 단위는 Core의 시간창 판정과 기존 주간 시각 helper의 중복 계산 개선이며 제품 Worker/DNR/Server를 활성화하지 않는다.

## 기준과 범위

- `docs/design/additional-mvp-contracts/04_정책_시간.md`: C06 모든 matching 정책, 정책 내부 ALLOW union·정책 간 AND, explicit BLOCK 우선, C07 gap SKIP/fold EARLIER_ONCE·자정/재시작 현재 membership.
- `contracts/additional-mvp/rc1/schema.json`: 기존 SiteTimePolicy/HostScope/Window/When 및 RuntimePackage 정책 최대200·정책당 windows 최대100을 그대로 참조한다. Server의 중복 window ID·0보다 크고24h 이하 duration 의미 검사도 유지한다.
- `extension/src/additional-schedule-plan.js`의 기존 weeklyStart/evaluateOccurrence 입출력·오류/고정 종료 의미는 유지한다. 새 shared Wire/API·DB migration·권한·epoch/예약 occurrence를 만들지 않는다.

## 함수와 결과

`extension/src/additional-site-time-windows.js`:

```js
const plan = evaluateSiteTimeWindows({
  policies, // 검증된 RuntimePackage의 완전한 runtime_policies 원문
  host,     // 실제 native URL에서 기존 규칙으로 얻은 canonical ASCII host
  nowAt     // 호출자가 제공한 millisecond UTC Z
});
```

이 함수는 순수 projection이다. 호출자가 owner/executor·issued package/revision·전체 정책 집합·native host와 clock/tzdb profile을 먼저 검증해야 한다. 최장 host만 골라 전달하면 부모 정책 누락을 이 함수가 복구할 수 없다. 함수의 입력 구조/날짜/호스트 ICU timezone 해석 검사는 권한 있는 package/clock/tzdb 검증을 대체하지 않는다. ICU 전용 단축명(CST 등)/numeric offset을 IANA zone으로 조용히 인정하지 않고 지원하지 않는 입력은 거절한다. 해석 성공이 승인된 tzdb profile 성공을 뜻하지 않는다.

결과는 내부용 `{local_only:true, evaluated_at, decision, reasons, policies, requires_quota_evaluation}`이다. 정책별 결과는 원래 policy_id/version, reasons, matched_window_ids, skipped_occurrences, daily_limit_ms를 보존한다. evaluated_at은 **caller 입력의 복사**이며 신뢰 시계 증거를 발급하지 않는다.

- decision은 WINDOW_BLOCK_REQUIRED 또는 NO_WINDOW_BLOCK이다. 후자는 **전체 ALLOW/정책 해제 허가/RELEASED가 아니다.** focus·quota·다른 runtime/global 제약은 별도 합성해야 한다.
- 활성 matching 정책을 모두 계산한다. parent scope의 제약을 child ALLOW_WINDOW로 제거하지 않는다. include_subdomains는 점 경계를 검사하여 evil-example.test에 매치하지 않는다. URL/Unicode/uppercase/trailing-dot host를 여기서 임의 정규화하지 않는다.
- 한 정책의 활성 ALLOW_WINDOW 중 하나라도 현재 포함이면 그 정책의 allow 제약을 만족한다. 다른 정책이 불만족하면 OUTSIDE_ALLOW_WINDOW는 남는다. BLOCK_WINDOW가 한 개라도 현재 매치하면 다른 allow와 무관하게 BLOCK_WINDOW가 남는다.
- daily_limit_ms=null이어도 시간창 제약은 유지한다. matching 정책에 일일 한도가 있으면 requires_quota_evaluation=true이며 잔여/사용량/한도 해제는 계산하지 않는다. 시간 계수·reservation·영속 원장을 쓰지 않는다.

ONCE는 정확한 UTC `[start,end)`다. WEEKLY는 시작 local date/요일과 end_day_offset으로 양 endpoint를 해석한다. 전날 시작한 overnight과 현재 날짜를 확인하고, 역사적 backward date-line fold에서 시작일 표기가 내일인 interval도 놓치지 않도록 다음 local date도 확인한다. 날짜를 UTC24h 차감해 local day라고 가정하지 않는다.

양 endpoint 중 하나라도 gap이면 해당 occurrence 전체를 SKIP하며 임의 시각으로 미루지 않는다. fold의 모호한 endpoint는 먼저 발생한 UTC를 한 번 선택한다. 두 endpoint 사이의 하나의 연속 interval은 반복된 시간을 포함할 수 있다. 활성 allow occurrence가 SKIP되어 현재 매치가 없으면 기존 OUTSIDE_ALLOW_WINDOW를 임의 해제하지 않는다. weekly duration은 **local wall duration**으로 검증하여 fall-back의24h wall/25h physical을 잘못 거절하지 않는다.

입력이 잘못되거나 calendar 경계를 표현/해석할 수 없으면 INVALID_SITE_TIME_WINDOW_INPUT을 던진다. caller가 이 오류를 빈 정책/허용/cleanup 성공으로 변환하면 안 된다. 기존 검증된 정책·복원 의무를 보존하고 재확인해야 한다.

## 기존 예약 helper의 계산 개선

기존 weeklyStart가 매 HH:MM마다 +/-26h minute 탐색을 반복해, 같은 timezone의 서로 다른 주간 창100개 표본에서 약3649ms가 관측됐다. `createWeeklyStartResolver({capacity:2048})`를 추가해 timezone+local date별 offsets를 한 번 탐색한다. midnight-26h부터+50h까지의 범위는 그 날짜 모든 HH:MM의 원래 탐색 범위를 포함한다. candidate는 실제 local parts round-trip으로 다시 검사하므로 단순 +/-1h 보정/offset 추정은 하지 않는다. 역사적 초 단위 offset도 유지한다.

캐시는 caller 소유·상한2048의 derived offsets뿐이며 eviction은 원장/claim/cleanup 삭제가 아니다. weeklyStart 기존 API는 매 호출 새 resolver를 사용해 stateless 의미를 유지한다. 새 판정기도 매 evaluation 새 resolver를 만들며 profile 사이에 cache를 공유하지 않는다. 별도 caller가 factory를 오래 보유한다면 검증된 tzdb profile 변경 시 재생성해야 한다. evaluateOccurrence의 예약 고정 종료/중복/재시작 판단은 수정하지 않았다.

같은 로컬 100-window 표본은 개선 후 약105ms였다. 단회 합성 CPU probe이고 병렬 부하/전 정책 조합/제품 SLA를 입증하지 않는다. 여러 zone·200정책·장시간·Worker 이벤트 loop·실제 차단 지연은 후속 검증이다.

## 검증·재현

Node24.19.0/Linux, Chromium151. 초기 Node 시험15/24 PASS·9FAIL에서 ISO formatter가 era를 생략하는 문제를 수정했다. browser 초기 import 실패는 harness가 a1/schema.json을 HTML로 반환한 원인이었으며 JSON route를 바로잡았다. 최종 결과는 다음과 같다.

| 범위 | 결과 |
|---|---|
| 새 시간창 판정 | 25/25 PASS |
| 기존 예약8 + cache 경계1 | 9/9 PASS |
| 위 두 집합 | 34/34 PASS, 전체1005에 포함 |
| Extension 전체 | 1005/1005 PASS, fail/skip0 |
| 기존 RC2 JS 계약 | 6/6 PASS |
| frozen Schema 양성 vector / Python zoneinfo 대조 | 같은14개 vector로 각각14/14 PASS, 중복 합산 금지 |
| Chromium 실제 module/JSON/Intl | 1/1 PASS |
| syntax / whitespace | PASS |

순번/시간 원장/Native DNR의 시험을 새로 실행한 것은 아니다. browser는 가상 정책·시각으로 계산하며 MV3/DNR/DOM·실제 owner/clock·Server/보고서 전송/제품 수용을 검증하지 않는다. Python probe도 승인된 제품 tzdb profile이나 전체 계약265건이 아니다. 미래 값·현재 시각 입력을 실제 관측으로 꾸미지 않는다.

```bash
cd extension
npm ci --ignore-scripts --no-audit --no-fund
node --test tests/additional-site-time-windows.test.mjs tests/additional-schedule-plan.test.mjs
npm test
npm run check
cd ..
node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs
python3 extension/tests/check-site-time-window-zones.py
```

Python probe는 기존 계약 의존성 jsonschema와 Python zoneinfo가 필요하다. 선택 browser는 설치된 Playwright/Chromium으로 `node --test extension/tests/additional-site-time-windows-browser.mjs`를 실행한다. 설치 경로는 PLAYWRIGHT_MODULE/CHROME_EXECUTABLE로 지정 가능하다. CI는 Ubuntu/Windows에서 Node34·계약6·syntax를 수행하며 Python14/browser1/전체1005 실행을 뜻하지 않는다.

## 리뷰·남은 작업

다훈: UTC/요일·overnight·DST endpoint·모든 matching 정책 합성과 Server 정책 원문 경계를 확인해 주세요. 지민: NO_WINDOW_BLOCK이 Content·focus·다른 owner 제약을 풀지 않는 경계와 기존 예약 helper 호환성을 확인해 주세요. 새 HEAD의 리뷰가 필요하며 병합은 통합 담당이 진행한다.

실제 verified package/clock/tzdb·native host 연결, 한도/이용시간·reservation, 전체 reason set 합성/owner claim 생성·DNR 적용·해제 증거, Worker/스케줄러·실제 성능/제품 수용은 미연결이다. PR76/78/80과 다른 담당 소스는 보존한다. 이번 순수 계산 단위 PASS로 SITE_TIME 실행이나 Core 전체 완료를 선언하지 않는다. MVP_FINAL_COMPLETE=false.
