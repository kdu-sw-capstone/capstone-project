# A0-G02 실제 MV3 자동 실행기 준비

EXT-02 / Core 종민 / 2026-10-11 / feature/extension-core-ext-02 / HEAD ac39226 및 기존 미커밋 변경 보존.
기준: candidate-3 sender 선행검증 및 G02-R01~R06 후속 시험표. 실제 제품 Core/Content 연결 아님.

## 구현

`tools/d06-sender-probe/tests/mv3_runner.py`는 임시 별도 확장·임시 프로필을 생성한다. 제품 확장과 기존 관측 도구는 변경하지 않는다. 기존 candidate 규칙을 시험 receiver에만 넣고 실제 runtime/tabs 메시지로 판단한다. 테스트용 sender/routing channel은 공용 A0 메시지 Schema나 제품 기능을 대체하지 않는다.

검사 예정10개: Worker 허용, 동일 receiver Popup 거절, instance 불일치, frame 불일치, 중복 주입 singleton, Content→Worker 중계 거절, 새 문서/instance, 오래된 documentId 전송 실패, 새 receiver에서 오래된 binding 거절, 새 binding 허용. 권한 판정 결과와 effects0을 각각 검사한다. 이번 작업에서 실제10개가 실행된 것은 아니다.

네트워크는 시험 프로필 안에서 YouTube origin 요청을 고정 HTML fixture로 응답한다. 실제 YouTube 영상·계정·Shorts DOM을 다루지 않는다. origin과 MV3 transport는 실제 브라우저지만 실제 서비스 DOM 검증은 아니다. Server/DB/인증/세션/Event 및 페이지 제한 효과 없다. 관리 정책을 읽어 차단 시 브라우저 실행 전 종료하며 정책을 변경하거나 우회하지 않는다.

## 이번 실행 결과

- `python3 .../mv3_runner.py --prepare-only`: PREPARED, mv3Executed:false. 생성 확장 worker/receiver/policy에 node --check 실행 통과.
- `python3 -m py_compile .../mv3_runner.py`: PASS.
- `node --test .../sender-policy.test.mjs`: 76/76 PASS.
- `python3 .../mv3_runner.py`: exit2 BLOCKED / managed extension install blocklist / passed0. 예상 환경 차단이며 actual MV3 PASS 아님.
- `git diff --check`: PASS.

## 허용된 Windows 자동 환경 실행 방법

이 파일은 아직 작업공간 미커밋이므로 Windows 저장소에 전달된 것으로 가정하지 않는다. 커밋/전달 후, Python/Node와 Playwright를 쓸 수 있고 확장 설치가 허용된 시험 환경에서 실행한다. 일상 Chrome 프로필을 지정하지 않는다.

저장소 루트에서:

```powershell
py -m pip install playwright
py -m playwright install chromium
py tools/d06-sender-probe/tests/mv3_runner.py
```

새 프로필은 프로그램이 임시 생성한다. Chromium 배포판은 확장 자동 로드를 지원해야 하며 설치/정책 오류 시 실패로 보고한다. 정책이 차단이면 변경하지 않고 승인된 시험 환경 확보로 넘긴다. 기본 Chrome 배포판에 무조건 --load-extension이 작동한다고 가정하지 않는다. 설치 명령은 여기서 Windows에 실행/검증하지 않았다.

PASS/FAILED/BLOCKED JSON 및 exit code를 확인한다. 코드가 prepared인 것은 runtime 동작 보장이 아니다. 실제 Chromium extension API 차이가 있으면 FAILED로 남기고 오류 원인을 조사한다. 오류 메시지/개인 경로는 JSON에 노출하지 않으며 errorType만 기록한다. 실제 시험 전후 저장소 SHA·OS·브라우저 버전을 함께 보존한다.

## 한계와 남은 범위

별도 확장 외부 발신, 실제 두 탭/iframe 전체 routing, BFCache, Worker 강제 중지 수명은 미구현/미실행인 추가 실증이다. payload frame 불일치 검사가 실제 iframe sender 시험을 대신하지 않는다. runtime acceptance는 격리 후보 규칙 판정이지 승인된 제품 receiver 판정이 아니다. G02-R01~R06 전체 PASS 또는 A0 착수 승인으로 사용하지 않는다.

작업 결과는 실행기 준비·정적검사 완료, 실제 MV3는 차단으로 중단이다. 전체 Core16묶음 완료0, 부분구현8, sender1, 후속7 유지. 기존 RELEASE 회귀 등 변경은 보존했다. 제품 구현 수정·Commit/Push·develop 병합 없음.
