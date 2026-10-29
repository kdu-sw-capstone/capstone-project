# A0-G02 Windows sender 관측 결과와 후속 시험

2026-10-11 / EXT-02 / Core 종민 / feature/extension-core-ext-02 / 시작 ac39226bbb5edb4ff23edba9a7124d80d5f13ccd.
기준: candidate-3 §3 및 sender 선행검증 준비 문서, 관측 도구 observe.js·receiver.js·worker.js. 계약 공동 승인과 제품 구현은 별도다.

## 실행 근거

사용자가 별도 Chrome 프로필에 FOCURVE A0 Sender Probe 0.0.1을 로드하고 YouTube 탭에서 실행한 대화 내 JSON·스크린샷을 기준으로 기록한다. Codex가 Windows를 직접 실행한 결과가 아니다. Chrome/Windows 전체 버전과 Windows checkout SHA·파일 해시는 아직 수집하지 않았다. 준비 코드 기준 SHA는 위와 같지만 사용자 checkout 일치를 단정하지 않는다. 원본 URL·프로필 경로·토큰은 기록하지 않는다.

| 시험 | 관측 결과 | 판정 범위 |
|---|---|---|
| Worker → Content, 06:53:16.917Z | sameExtension true, exactWorkerURL true, exactPopupURL false, tab 부재 | 실제 송신원 필드 관측 완료 |
| Popup → 같은 Content, 06:54:03.469Z | 본문은 worker 주장이나 exactWorkerURL false, exactPopupURL true | 동일 수신점에서 Worker와 구분됨 |
| Content → Worker, 06:54:21.745Z | exactWorkerURL/PopupURL false, tab 존재, frameId 0, lifecycle active, 주입 문서 ID 일치 | 다른 수신점 관측; Content → Content 차단 대체 불가 |
| 중복 주입, 06:54:52.709Z → 06:54:56.801Z | 같은 문서 ID와 instance 유지, Worker URL 일치 | singleton 유지 확인 |
| Worker 중지 → 06:57:03.810Z 통신 | internals worker.js STOPPED 화면 후, 재주입 없이 같은 instance 응답 | 재기동 후 기존 receiver 통신 확인 |
| 새로고침 후 미주입, 06:57:40.370Z | Receiving end does not exist | 새 문서에 receiver 없음 확인; 오래된 ID 명령 거절 시험 아님 |
| 새 문서 주입, 06:58:03.181Z → 06:58:03.845Z | tab 유지, documentId 변경, instance 변경, Worker URL 일치 | 문서 교체 및 새 receiver 확인 |

기존 documentId: 8CC6BCE80F1DE612344D625BC1837B75; 새 documentId: FECABCC3BFBA35EF225FC95CD4C38B6D.
기존 instance: 3bad2bf0-c07d-476b-94cc-7113b6e854cd; 새 instance: 74212ce4-0c5b-4ffa-b718-f83c93fa22aa.
authorized:false/effects:0은 도구 고정값이다. 제품 인증 거절 또는 DOM 안전성 통과 증거가 아니다.

## 검증 규칙 제안 — 미승인·제품 미적용

Content 제어 수신에서 Chrome 제공 sender.id가 자신의 runtime.id와 같고 sender.url이 확정된 제품 Worker 리소스의 runtime.getURL 값과 정확히 일치해야 한다. 관측 도구 worker.js 경로를 제품에 그대로 사용하지 않는다. URL 없음·타입 오류·불일치는 거절하며 body claimedSource, origin 또는 tab 부재만으로 허용하지 않는다. 관측 불변 조건으로 extension origin 일치와 tab 부재도 확인하되, 이 조합의 전체 환경 유효성은 추가 시험·3인 확인이 필요하다.

Worker → Content sender에는 documentId/frameId가 없었다. 이 필드를 해당 방향의 필수 sender 필드로 요구하면 정상 Worker도 거절된다. 문서 결속은 Core가 Chrome에서 확인한 대상 tab/frame/documentId로 전송하고, 승인 계약의 document·instance·실행 범위를 receiver 상태와 대조하는 별도 규칙으로 검증해야 한다. 메시지 본문만으로 결속을 확정하지 않는다. Content → Worker에서는 Chrome 제공 tab/frame/documentId/lifecycle를 신뢰된 실행 레지스트리와 비교한다. Popup 요청을 무조건 제어 명령으로 중계하지 않는다.

## 남은 시험표 — 모두 미실행

| ID | 실행과 기대 결과 | 범위 |
|---|---|---|
| G02-R01 | 격리 receiver에 제안 판정 함수 적용 후 실제 Worker 허용·Popup 위조 거절; 판정 결과와 효과 0 각각 확인 | 제품과 분리한 규칙 실험, 지민 수신 규칙 확인 필요 |
| G02-R02 | 같은 확장의 다른 페이지·Content 발신/중계 시도; 정상 Worker로 승격되지 않음 | 동일 수신점 또는 실제 가능한 경로별 증거 필요 |
| G02-R03 | 두 YouTube 탭·iframe에서 대상 문서/instance 불일치 명령 거절 | 대상 문서 오염 없음 확인 |
| G02-R04 | 새로고침 전 documentId/instance 보존 후 교체 문서로 오래된 명령 전송; 거절 | 기존 새로고침 시험과 별개 |
| G02-R05 | sender 필드 누락/null/타입 오류/유사 URL/id 불일치 합성 입력 거절 | 자동 단위 시험; Chrome 발신 실증과 구분 |
| G02-R06 | 외부 웹/다른 확장 채널 및 BFCache 복귀 | 노출 채널 정책·수명 조건에 맞춰 시험 |

먼저 실행 환경 버전·checkout SHA·도구 파일 해시를 기록하고, 다훈·지민에게 규칙·격리 시험 범위를 확인받는다. 공유 계약 변경이 필요하면 재승인 전 제품 적용하지 않는다. 한 환경 관측만으로 모든 Chrome 버전을 지원한다고 판정하지 않는다.

## 다훈·지민 전달문

Windows 관측에서 동일 Content receiver가 Worker와 Popup을 정확한 sender.url 일치 여부로 구분했어. 본문 worker 주장만으로 송신원이 바뀌지 않았고, 중복 주입·Worker 재기동에서는 instance가 유지됐으며 새로고침 후에는 documentId/instance가 변경됐어. Content → Worker에서는 tab/frame/documentId/active 정보도 관측됐어.

다만 도구의 authorized:false는 고정값이므로 실제 권한 거절은 아직 검증하지 않았어. Content가 Worker를 검증할 때 sender.documentId/frameId는 실제로 없었으므로 이를 필수로 두면 정상 메시지가 거절돼. 정확한 제품 Worker URL + runtime.id 확인과 별도 대상 문서·instance 결속을 규칙 초안으로 제안해. 위 G02-R01~R06 격리 시험 범위와 규칙을 확인해 줘. 아직 sender 전체 안전성 통과·A0 연결 착수로 기록하지 말아 줘.

## 작업 종료 상태

이번 문서·규칙 초안·남은 시험표·전달문 준비 완료. 실제 권한 시험 미실행, 제품 코드 수정 없음, Server/DB 변경 없음, PR17·21 develop 미병합. Core 결함 독립 재리뷰와 A0 공동 승인 대기는 유지한다. 기능 회귀 테스트는 문서 변경으로 재실행하지 않았다.

## 후속 자동 시험 — 46/46 통과

사용자가 자동 권한 검증을 요청한 뒤 `tools/d06-sender-probe/tests/`에 제품에서 import하지 않는 규칙 후보와 자동 시험을 추가했다. 실행: `node --test tools/d06-sender-probe/tests/sender-policy.test.mjs`. Node 실제 실행 46/46, 실패/스킵 0. `git diff --check` 통과.

정확한 Worker/id 조건, Popup·Content 주장·유사 URL·필드 null/누락/타입 오류 거절, 신뢰된 문서/instance/tab/frame 결속, 비활성 문서 거절을 합성 입력으로 확인했다. 기존 worker.js는 Node VM의 모의 Chrome API에서 실행해 Content/다른 확장 중계 차단, 오래된 문서/iframe/외부 host 전송 전 거절, 응답 유실 오류 보존을 확인했다. receiver.js 중복 주입 단일 listener 및 manifest 외부 채널 비노출도 확인했다.

이는 G02-R05 자동 단위 범위 완료와 R01~R04/R06 일부 모의·정적 근거다. 실제 Chrome 권한 판정, 다른 탭/iframe/외부 발신, 오래된 명령 및 BFCache 실증은 미실행으로 유지한다. Linux Chromium 설치 여부 확인만 했으며 브라우저 권한 시험을 실행한 것으로 기록하지 않는다. sender origin은 extension URL의 URL.origin 비교 보조값이며 origin 단독 인증에 사용하지 않는다. 후보는 probe/product가 import하지 않으므로 규칙 변경 승인을 대신하지 않는다. 제품 변경·develop 병합 없음.

## 남은 sender 시험 확장 자동 실행

명령: `node --test tools/d06-sender-probe/tests/sender-policy.test.mjs` → 76/76, 실패/스킵0. `python3 tools/d06-sender-probe/tests/browser_policy.py` → 실제 Chromium151.0.7922.173 JavaScript에서 합성 sender/binding 30/30. 둘은 중복 조건이 있으므로 106개의 독립 수용 기준으로 합산하지 않는다. `git diff --check` PASS.

새 반례에서 프로토타입으로 상속한 sender의 id/url/origin을 후보 함수가 허용했다. 처음 확장 실행48개 중1개 실패,47개 통과. 자신의 필드인지와 문자열 타입을 검사하는 조건을 추가한 뒤 전체76개 재실행으로 통과했다. 이는 격리 규칙 초안의 결함이며 제품 Core/Content 결함으로 단정하지 않는다. 브라우저도 같은 반례 거절 확인. body 주장으로 권한 승격 없음, frozen 합성 binding은 재확인 전 거절, 이전 문서/instance·다른 tab/frame 거절도 검사했다.

| 후속 시험 | 현재 확보한 근거 | 아직 남은 실제 증거 |
|---|---|---|
| R01 | 후보 Worker 허용/Popup 거절, 실제 JS+합성 sender | 실제 MV3 receiver와 Chrome sender 조합으로 권한 판정 |
| R02 | 다른 extension page/Content 주장 거절, worker.js 중계 차단 모의 | 실제 가능한 발신/중계 경로에서 동일 수신점 거절 |
| R03 | 합성 다른 tab/frame/document/instance 거절 | 실제 두 탭/iframe의 Chrome routing·효과 확인 |
| R04 | 합성 교체 binding에 오래된 명령 거절 | 실제 교체 문서에 저장한 오래된 ID 명령 전송 |
| R05 | 누락/null/타입/유사URL/상속 필드 자동검사 통과 | 해당 자동 단위 범위 완료 |
| R06 | 외부 채널 비노출 정적 검사, 타 extension ID·합성 frozen/복귀 binding | 실제 외부 채널 시도·BFCache 이벤트와 재결속 |

관리정책 ExtensionInstallBlocklist=["*"]가 유지돼 실제 시험 확장 설치는 차단이다. 관리정책/브라우저를 변경·우회하지 않았으며 실제 MV3 자동 실행 성공으로 기록하지 않는다. 브라우저30개는 확장을 로드하지 않은 JS 실행 시험이다. DOM unchanged는 합성 거절 분기의 검사이며 YouTube 제한/복원 증거가 아니다.

결론: 실행 가능한 후보 규칙 자동검사는 완료; R01~R04/R06 실제 MV3는 차단/미검증. 전부 PASS로 처리하지 않는다. 세 명 규칙 승인·독립 재리뷰·제품 연결/병합 승인도 별개. 전체16묶음 확정완료0, 부분구현8, sender시험1, 후속7 유지. 이번 작업 제품 구현 변경없음·commit/push/develop병합 없음.
