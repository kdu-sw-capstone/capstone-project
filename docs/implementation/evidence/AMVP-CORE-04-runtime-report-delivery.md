# AMVP-CORE-04 — RuntimeReport 단일 전달 호출부

담당 윤종민. `feature/additional-mvp-report-delivery`, 선행 #76 HEAD `cc9d108d4cd8377f8985e113b1e7805a5b4c9b89` 위 후속 단위. 다른 원본 PR/브랜치와 사용자 미커밋 변경 보존. #76 제품 소스·시험·기존 DB 형식은 수정하지 않는다.

## 기준·범위

RC2 `contracts/additional-mvp/rc1/api.json`의 RPT-01 POST `/api/v1/amvp/reports/batch`, ReportBatch/BatchAck, `docs/design/additional-mvp-contracts/02_API_DB.md`의 동일 원문·부분 ACK·격리 규칙을 재사용한다. 새 endpoint/Schema/인증 규칙/DB migration은 없다. RPT-02·IG04 ACK/terminal 계약에 의존하지 않는다.

`extension/src/additional-runtime-report-delivery.js`의 `RuntimeReportDelivery`는 **신뢰된 background 내부 단일 시도 caller**다. Worker/RPC/Content에 등록하지 않으며 HTTP 권한·효과 증거를 발급하지 않는다. producer(#78)/replay(#80)/outbox(#76)를 다시 구현하지 않는다.

## 함수·입출력

| 항목 | 의미 |
|---|---|
| `new RuntimeReportDelivery({outbox,send,authorizeScope,isCurrent,timeoutMs})` | 기존 outbox와 실제 권한/전송 provider 주입. 두 권한 검사는 기본 거절. timeout 기본10초는 시도 대기 한도이며 정책 기한·재시도 허가가 아님 |
| `deliver({owner_binding_id,executor_id})` | 입력을 복사·동결하고 현재 권한 확인→기존 durable batch 조회→최종 권한 재검사→한 번 전송→현재 권한/실제 ACK 검증 및 저장 |
| `send(body,{signal,isCurrent})` | 기존 ReportBatch의 canonical JSON UTF-8 문자열을 **그대로** 전송하는 신뢰된 adapter. 실제 인증·capability·owner binding/epoch 결속 및 응답 provenance 검증이 필요. credentials 조회 등 await 이후 **실제 IO 직전에** `isCurrent()===true`를 다시 확인하고 signal을 처리해야 함 |
| `authorizeScope(scope)` | 비동기 현재 발신 권한 검사. scope 문자열의 모양만 검사하는 provider로 활성화 금지 |
| `isCurrent(scope)` | 동기 strict boolean 검사. 현재 owner/executor뿐 아니라 시도에 고정된 권한 세대·fence·capability 수명을 실제 provider가 확인해야 함. Promise/throw는 거절 |
| `stop()` | 현재 시도를 취소. 미전송이면 전송 차단, 이미 보낸 요청의 Server 저장이나 handoff된 ACK transaction이 rollback됐다는 의미는 아님 |

성공 반환은 `{local_only:true,batch_id,submitted_count,ack_persisted}`다. 빈 발신함이면 batch_id=null/count0/ack_persisted=false. 그 외 ack_persisted=true는 검증된 응답의 포함 항목을 outbox에 저장했다는 뜻이며, 전체 항목 ACKED나 실제 APPLIED/RELEASED를 뜻하지 않는다. 부분·PENDING_DEPENDENCY·REJECTED/비포함 항목의 상태는 기존 outbox 원장으로 확인한다.

중첩 호출은 같은 caller 인스턴스에서 REPORT_DELIVERY_BUSY로 거절한다. 서로 다른 Worker/인스턴스의 전역 잠금은 새로 구현하지 않는다. 실제 단일 background actor 선택·기존 Server 멱등 처리와 outbox CAS를 유지해야 한다.

## 저장·실패 경계

- caller는 별도 원장을 만들지 않는다. batch 저장·item ID/hash·auth ACK 검증·원자 commit은 기존 outbox가 수행한다.
- body 최대1MiB·최대100개 및 요청 scope를 확인하고, 전송에 쓴 body/ID/hash를 재작성하지 않는다. body 문자열은 신뢰된 transport로만 전달하고 로그에 기록하지 않는다.
- send 성공이나 HTTP200 자체를 ACK로 만들지 않는다. 실제 transport의 인증된 BatchAck만 `outbox.acknowledge`로 넘긴다. 기본 verifyAck=false는 그대로다. reply body의 ACCEPTED 문자열이나 canonical hash만으로 인증 provenance를 인정하지 않는다.
- timeout·취소·HTTP401/403/429/503·권한 변경·잘못된 ACK·저장 실패에서 자동 재시도/새 batch ID/삭제/일괄 완료 없음. explicit 다음 호출이 기존 미완료 배치를 그대로 재사용한다. 재전송 허가는 실제 권한 provider가 다시 확인한다.
- stop/timeout은 무응답 provider의 대기를 끝내지만 이미 시작된 DB/네트워크 동작을 되돌리지 않는다. 늦은 send 응답은 ACK에 새로 handoff하지 않는다. 이미 `acknowledge`에 넘긴 동작은 기존 outbox의 권한·CAS 아래 나중에 commit할 수 있으므로 재조회로 확인한다.
- REPORT_DELIVERY_INCOMPLETE는 local phase(AUTHORIZE/BATCH/SEND/ACK)와 cause를 가진다. phase는 추적 위치이며 저장/미접수 확정이 아니다. 외부 UI/로그로 raw cause·credential·본문을 노출하지 않도록 기존 오류 경계를 사용해야 한다.
- frozen body·local abort·true 시험 callback은 actual owner/Server receipt/cleanup 증거를 대신하지 않는다.

## 검증

Node24.19.0 Linux. 새 단위24개(실제 loopback HTTP1개 포함), 기존 outbox28개: **52/52 PASS**. 전체 Extension **1031/1031 PASS**, 기존 계약 **6/6 PASS**, syntax/whitespace PASS. 전체는 #76 기반이며 최근 다른 7 PR 결합 후보1111과 다른 tree다. 수를 합산하거나 최신 통합 전체 회귀라고 표현하지 않는다.

Chromium151의 실제 IndexedDB 재열기 **1/1 PASS**: lost response→동일 body/ID 재사용→부분 ACK→DUPLICATE ACK→UNKNOWN 정책 상태·unrelated cleanup 보존. owner/evidence/transport는 SYNTHETIC이다. 실제 loopback HTTP도 시험 수신기를 사용하며 제품 Server/auth/DB 검증이 아니다.

시간 초과 시험은 Node mock timer로 send 진입 후 만료시켜 CI 부하에 따른 짧은 실시간 deadline 의존을 피한다. stop 후 동일 caller 재시작의 old response 격리를 검사한다. 최종 source 기준으로 관련52개와 전체 회귀를 실행했다.

```bash
npm --prefix extension ci --ignore-scripts --no-audit --no-fund
node --test extension/tests/additional-runtime-report-outbox.test.mjs extension/tests/additional-runtime-report-delivery.test.mjs
npm --prefix extension test
node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs
npm --prefix extension run check
# 기존 Playwright·Chromium 설치 시:
PLAYWRIGHT_MODULE=/path/to/playwright CHROME_EXECUTABLE=/path/to/chromium node --test extension/tests/additional-runtime-report-delivery-browser.mjs
```

CI는 Ubuntu/Windows Node24.19.0에서 관련52·기존 계약6·syntax를 수행한다. CI의 Windows Node 시험은 실제 Windows Chrome 제품 수용이 아니다.

## 리뷰·남은 연결

새 내부 caller 코드가 추가됐으므로 **담당 리뷰 필요**. 다훈에게 RPT-01 동일 원문·부분 ACK·인증/owner·Server 멱등 경계 검토를 요청한다. Content DOM/복원 코드를 바꾸지 않았으므로 별도 Content 기능 구현을 요구하지 않는다. 지민에게는 ACK 저장이 cleanup 완료로 해석되지 않는 경계 확인만 필요 시 요청한다.

Core 후속은 실제 `send/authorizeScope/isCurrent/verifyAck` provider·Worker actor 및 기존 #78→#80→#76의 생산/전달 연결이다. 다훈에게 확인받을 사항은 기존 E 인증·capability와 owner binding/epoch를 검증할 수 있는 현재 carrier/원문 경로 및 RPT-01 응답 결속 조건이다. Core provider 구현을 Server 담당에게 대신 맡기는 요청이 아니다.

미완료: 실제 issued/evidence provider, 인증 HTTP·capability 검증·Worker bootstrap, 실제 Server/DB·Windows MV3·장시간 수용. IG04 계약 합의/실제 연결과는 별개이며 이번 코드로 활성화하지 않는다. 기능 전체는 부분 구현, 이번 caller 단위는 검토 대기다. 병합/실제 START는 통합 담당의 기존 절차를 따른다.
