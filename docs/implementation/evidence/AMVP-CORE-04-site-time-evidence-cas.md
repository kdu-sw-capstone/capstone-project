# AMVP-CORE-04 — SITE_TIME 증거 등록 snapshot CAS

- 담당: 윤종민. 날짜: 2026-11-02 (Asia/Seoul).
- 브랜치: `fix/additional-mvp-site-time-evidence-cas`.
- 시작 기준: integration `2201654e4ba3adbc1a4738bc14723b708d522c69`.
- 상태: 구현·로컬 검증 완료, 담당 리뷰·통합 대기. 실제 SITE_TIME/Report 제품 연결 완료 아님.
- 기준: `docs/design/additional-mvp-contracts/04_정책_시간.md` owner별 claim/복원, source hash/동일 정책 버전 보존, `06_인계_승인.md` Core 소유권·증거 경계 및 기존 [증거 API/수용 조건](AMVP-CORE-04-site-time-evidence.md).

## 재현과 영향

기존 `register()`는 정책/증거/DNR 원장을 비동기로 확인한 뒤 최종 쓰기에서 기존 증거 개수만 대조했다. 같은 개수의 내용 변경이나 관측 이후 DNR 원장 변경을 충분히 거절하지 못했다. 중복 경로는 checkedEntry/hash 검사 뒤 바로 성공을 반환했다.

기존 source에서 다음 세 반례가 모두 예상 거절 없이 성공했다(0/3 PASS).

1. 첫 증거의 정책 원문을 같은 policy_id/version의 다른 내용으로 바꾸고 hash도 유효하게 재계산한 뒤, 두 번째 operation을 commit하면 같은 버전의 서로 다른 정책이 공존한다.
2. snapshot 이후 최종 transaction 전에 DNR writer_epoch가 바뀌어도 이전 원장의 관측을 새 등록에 commit한다.
3. 중복 검사 뒤 원본이 변경돼도 이전 원본 기준 duplicate:true를 반환한다.

시험은 공통 Lock을 우회하는 metadata 변경을 의도적으로 주입한다. 실제 제품 writer에서 이런 경합이 재현됐다고 주장하지 않는다. 기존 guarded writer 전제와 #70 CAS를 제거/대체하지 않고 경계의 예상치 못한 변경을 추가 검출한다.

## 수정 코드와 동작

`extension/src/additional-dnr-site-time-evidence.js`만 제품 코드로 수정했다.

- 내부 `transaction(mode, reduce, expected)`에서 기존 증거 row의 전체 canonical snapshot을 비교한다.
- 새 등록은 같은 metadata readwrite transaction 안에서 기존 AdditionalDnrStore의 `amvp_journal_v1:dnr` row도 읽어 관측한 전체 journal snapshot과 비교한다. hash/Chrome 조회는 transaction 밖에서 그대로 수행하며 transaction 안에 await를 넣지 않는다.
- 둘 중 하나라도 바뀌거나 DNR row가 없어지면 기존 `SITE_TIME_EVIDENCE_STATE_CHANGED`로 거절한다. 변경된 원본을 덮어쓰거나 cleanup을 수행하지 않는다.
- 중복 응답도 최종 readonly transaction에서 검증했던 증거 snapshot이 유지되는지 확인한다. 이 경로는 DNR epoch 자체를 새 발급 조건으로 사용하지 않아 새 writer 뒤에도 정확한 과거 등록 재시도를 보존한다.
- 다른 metadata 변경/동일 내용의 property 순서 변경은 충돌로 취급하지 않는다. 비교는 기존 canonical 의미 비교다.

공개 `register({context,policy,claims})`·`read(context)` 입력/응답, DB key/version/형식, shared Wire/Receipt/RuntimeReport는 불변이다. DNR metadata는 읽어서 대조하며 쓰지 않는다. 실제 DNR add/remove, rule 채택, owner 이관, cleanup 권한/의무 해소를 수행하지 않는다.

권한 검증은 기존 verifyBinding 및 guarded writer 전제를 유지한다. 이 CAS는 현재 owner 인증이나 마지막 권한 fence를 새로 제공하는 것이 아니며, 실제 DNR getter가 브라우저 전체의 원자 관측이라는 증거도 아니다. 반환 관측은 읽은 시점의 snapshot이며 이후 영원히 유지된다는 보장이 아니다. 후속 sender/issued/native/clock·전송 권한 검증은 계속 필요하다.

## 검증

환경: Linux Node24.19.0/npm11.9.0, fake-indexeddb6.2.5. 선택 Chromium151 probe는 실제 IndexedDB/Web Lock이며 DNR·issued policy verifier/coverage는 모의다.

| 검증 | 결과 |
|---|---|
| 기존 source 최초 반례 | 0/3 PASS, 모두 예상 거절 누락 |
| 신규 CAS 회귀 | 12/12 PASS |
| 기존 SITE_TIME 증거+신규 | 37/37 PASS (기존25+신규12) |
| 전체 Extension | 991/991 PASS (integration979+신규12) |
| 기존 계약 legacy-boundary | 6/6 PASS |
| Chromium native IndexedDB/Web Lock | 1/1 PASS, Root 변경/동일 개수 증거 변경 거절·원본 보존·DNR 쓰기0 |
| JavaScript syntax·diff whitespace | PASS |

신규12는 관련37/전체991에 포함되므로 중복 합산하지 않는다. #89/#90/#91이 미포함인 같은 integration의 독립 PR이며 이전 PR별 전체 시험 수와의 차이는 시험 삭제가 아니다.

추가 시험은 동일 epoch의 APPLIED cleanup 의무 변경, DNR row 누락, 기존 writer 뒤 정상 중복, 충돌 후 재검증/새 epoch 재시도, 재시도에서 동일 버전 정책 충돌 명시, 중복 검사 뒤 원본 제거, property 순서/다른 metadata 보존, 중복 최종 readonly 저장 abort의 UNCONFIRMED를 검증한다. 모든 새 경합 시험에서 DNR 쓰기는0이다.

```bash
npm --prefix extension ci --ignore-scripts --no-audit --no-fund
node --test extension/tests/additional-dnr-site-time-evidence-cas.test.mjs extension/tests/additional-dnr-site-time-evidence.test.mjs
npm --prefix extension test
node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs
npm --prefix extension run check
# 기존 설치를 지정하는 선택 probe
PLAYWRIGHT_MODULE=/path/to/playwright CHROME_EXECUTABLE=/path/to/chromium node --test extension/tests/additional-dnr-site-time-evidence-cas-browser.mjs
```

CI는 기존 Ubuntu/Windows DNR 명령을 보존하고 신규12를 별도 step으로 추가한다. 선택 브라우저는 기본 npm test/Node CI에 포함하지 않는다.

## 리뷰·후속

다훈: 최종 증거/DNR snapshot 결속, 동일 policy/version 불변 및 duplicate의 durable 의미 검토. 지민: 다른 owner/claim·기존 cleanup/복원 의무를 수정하지 않는지 검토. 충돌은 재조회·권한/정책/epoch 재검증 후 처리해야 하며 이전 proof로 자동 성공/재적용하지 않는다.

실제 issued/native authority provider, 정책 전달/적용·해제 caller, RuntimeReport/RPT-01/02, budget/clock/collector 통합, Windows MV3/Chrome START·제품 수용은 별도 미완료다. #76/#78/#80/#84/#86/#88/#89/#90/#91은 재구현/변경/병합하지 않는다. 공유 CORE-04·통합현황 문서 통합 시 양쪽 작업·실패·미완료 이력을 보존한다. 통합 담당이 최종 병합한다.
