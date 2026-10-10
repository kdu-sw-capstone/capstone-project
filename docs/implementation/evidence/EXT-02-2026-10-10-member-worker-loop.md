# EXT-02 — 제품 회원 Worker 명령 loop 연결

윤종민 / feature/extension-core-ext-02 / 시작 3f77cad / 2026-10-10. 기존 단계별 구현·검증·Commit·Push·PR17 권한으로 진행하며 develop 병합은 하지 않는다. 확장 버전은 0.1.6이다.

기준: AGENTS.md, 개발운영.md, 통합현황.md, EXT-02, API04 commands/reports, 인증·실행복구 계약11, D01_D10 최종공용계약, APPLY 기간 전달 확정 계약, 현행 ExecutionService와 연동가이드. Server/frontend 제품 코드·API·DB 스키마 변경 없음. 지민의 Content D06 미합의 유지.

## 이번 제품 연결

- `src/member-execution-loop.js`: verified credentials·Server 현재 세션/executor/revision/Snapshot/기간·guest 종료 증거와 실제 규칙을 확인한다. 새 APPLY는 현재 STARTING/UNKNOWN에 결속하여 SiteController로 적용한다. fresh APPLY 전 POST reconcile에 RELEASED를 보내면 Server가 해당 APPLY를 해제 명령으로 바꾸므로, 새 실행은 authenticated GET session + 로컬 idle 대조로 승인하고 **저장된 실행의 복구에** POST reconcile을 사용한다. SiteController의 internal reconciled 플래그 의미를 주석에 명확히 했다. 공개 wire 변경은 없다.
- 현재 명시 지원은 `automatic_recovery_supported:false`, `time_accounting_mode:LEGACY_WALL_CLOCK`이다. 다른 시간 모드로 실행하지 않는다. frozen Snapshot의 사이트 전체 차단/기록/허용만 실행하며 활성 Content/feature 정책은 부분 적용 없이 FEATURE_NOT_IMPLEMENTED로 실패 보고한다. Shorts·추가 Content 기능은 연결하지 않았다.
- 별도 `focurve-member-control` IndexedDB에 세션 결속, interval ID, 준비 상태, 보고 원문, checkpoint, local END action을 저장한다. SiteController journal·member reports outbox·guest 원본은 분리 보존한다. 생성 중 중단된 APPLY는 재적용하지 않고 규칙을 확인·해제해 복구 확인 상태로 둔다.
- 실제 적용 뒤 journal의 실제 적용 관측 시각으로 APPLIED를 저장·전송한다. 보고 전송/저장 지연 시각을 적용 시각으로 대신하지 않는다. Worker가 다시 생성되면 먼저 기존 보고를 동일 원문으로 전달하고 journal·실제 DNR·Server session·reconcile 결과를 대조한다. 이미 적용된 정책을 새로 설치하거나 타이머를 다시 시작하지 않는다. 새로운 설정을 섞지 않는다.
- Server RELEASE는 실제 소유 규칙 해제 후 기존 RUN interval을 닫아 RELEASED로 보고한다. 종료 뒤 재생성/시간 만료가 추가 END를 만들지 않는다. 외부 Server 종료와 local END가 경합하면 현재 terminal 상태를 확인하며 미접수 local action 원문은 보존한다.
- 수동/시간 만료 local END는 **소유 규칙 해제 확인 → durable END 저장 → 현행 Journal1.1 reconcile** 순서다. local_action_seq는 이 구현의 독립 END sequence 1이며 SiteController.action_seq나 event.local_seq를 복사하지 않는다. 응답 유실/오프라인이면 동일 action ID·본문으로 재시도한다. 네트워크·토큰 갱신보다 만료 해제가 먼저 되도록, 검증 이력이 있는 로컬 identity는 규칙 제거에만 사용하고 새 APPLY는 실제 인증 credentials가 필요하다.
- 미확인 구간은 RUN에 포함하지 않는다. 종료는 마지막 확인 checkpoint와 목표 종료 시각을 넘지 않는 구간으로 보수적으로 닫는다. 기록은 PARTIAL이며 Event/watermark 전체 수집 완료를 주장하지 않는다.
- 규칙이 없거나 일부만 남은 재시작은 소유 규칙을 확인·해제해 RECOVERY_REQUIRED로 표시한다. 자동 재적용·즉시 END/BROWSER_RESTART를 보내지 않는다. 사용자의 종료 또는 기존 목표 만료로 명시 END를 처리한다. 신규 active-time 자동재개는 구현하지 않았다.
- `background/member-execution-runtime.js`: Worker 로드·startup·30초 alarm·정확한 own popup의 DEV_MEMBER_EXECUTION_STATE/END에서 coordinator 호출. Web/Content/다른 확장/하위 frame은 호출·credentials 접근 불가. popup은 별도 회원 실행 상태·종료 버튼을 표시하고 회원 시작은 현재 Web에서 요청한다. 비회원 시작 버튼을 회원 시작으로 바꾸지 않는다.
- `scripts/build-member-worker.js`: 기존 ESM adapters를 결정적으로 classic Worker bundle `background/member-execution.js`로 생성한다. source와 tracked bundle 일치 및 실제 VM 실행 회귀가 있다. 다운로드된 제품은 별도 build 없이 importScripts로 사용한다.

30초 alarm은 정상 실행에서 주기적으로 확인하는 장치이며 절전/브라우저 중지 중 정확한 밀리초 종료를 보장하지 않는다. 다음 Worker 실행에서 만료 cleanup을 네트워크보다 먼저 수행한다. 실제 Chrome alarm 지연·절전은 미검증이다.

## 검증 결과

Linux / Node24 / JDK21 / MySQL8.4.8 / Chromium151.0.7922.173. 기존 cloud helper 재사용, 환경 설정 초안 변경 없음. test profile/focurve_test에서만 Snapshot 발급 gate를 켰고 운영 .env는 변경하지 않았다.

| 검사 | 결과 | 실제/대체 경계 |
|---|---|---|
| Extension 전체 | 159/159, fail/skip0 | Node, 모의 Chrome/HTTP 및 IDBFactory |
| Backend 전체 verify/package | 165/165, fail/error/skip0 | 실제 HTTP/MySQL, 인증은 합성 fixture |
| 최종 변경 후 집중 HTTP 회귀 | 3/3 | 실제 commands/session/reports/reconcile/end; Chrome DNR/tabs/guest idle만 모의. 이전 fixture의 fake trusted context를 새 loop 시험에서는 실제 Server session 대조로 대체 |
| UI | Chromium 23/23 | 제품 HTML/JS + Chrome API 모의. 회원 미확인 응답·별도 실제 coordinator 응답 표시·종료 취소/해제 표시 |
| 기존 네이티브 Worker 회귀 | 보고 재생성/IndexedDB 1건 및 auth/event fetch 2건 통과 | 실제 Dedicated Worker/IndexedDB, 합성 HTTP. 이번 제품 확장 loop 또는 Chrome DNR 시험 아님 |
| JS 구문·harness build·bundle source 일치/실행 | PASS | harness·VM은 모의 검증 |

회귀: 중복·Worker 재생성 시 no reapply/같은 timer, stale revision, unsupported 시간/Content 정책, 소유권 충돌 보존, Server 종료, local END/EXPIRED, 오프라인 credential 실패 전 해제·원문 저장, 미확인 gap 제외, 미완료 preparation cleanup, 외부 종료 경합, trusted sender 제한, credential UI 비노출.

초기 전체 Extension 회귀에서 1개 실패: 새 실제 복구 경로의 reconcile 호출이 보고 재전송 사이에 들어오는데 테스트가 고정 호출 index를 보고라고 가정했다. report 결과만 골라 동일 ID/본문을 비교하도록 수정했다. 구현 성공을 가장하거나 assertion을 제거하지 않았고 최종 전체 통과했다.

재실행:
```bash
npm --prefix extension run build:member-worker
npm --prefix extension test
npm --prefix extension run check
npm --prefix extension run build:harness
python3 extension/tests/ui/popup_ui.py
python3 extension/tests/ui/member_execution_worker.py
python3 extension/tests/ui/member_fetch_worker.py
source .local/cloud-env.sh
bash scripts/with-env.sh env SNAPSHOT_1_2_ENABLED=true SNAPSHOT_1_2_VERIFIED_EXECUTORS='*' bash backend/mvnw -f backend/pom.xml -B -ntp verify
```

## 다음 실제 Chrome 검증

1. 기존 확장 로드 경로·ID·계정 storage를 유지하고 그 폴더의 확장 파일을 새 버전으로 업데이트한 뒤 확장을 새로고침한다. 확장 삭제/계정 초기화/새 위치 로드는 피하고 버전0.1.6과 callback ID를 확인한다. 기존 .env와 guest 원본을 보존한다.
2. 테스트 Server의 Snapshot1.2 신규 발급 gate·해당 executor 허용 조건을 다훈과 확인한다. 기본 gate OFF 상태에서 시작이 거절되는 것을 Core 오류로 오인하지 않는다. 문서의 test `'*'`를 일반 운영 설정에 복사하지 않는다.
3. 활성 Content 정책 없이 테스트 회원 사이트 1개 BLOCK/1개 RECORD를 설정하고 Web에서 1분 시작한다. Server 접수 STARTING과 확장 실제 적용 후 RUNNING/APPLIED를 구분해 DNR/journal/보고/DB 원본을 확인한다. 이번 회원 접근 이벤트 수집은 아직 미연결이다.
4. 수동 종료·자동 만료, Server/Web 종료, Worker 단독 Stop/재생성 시 규칙과 timer 유지, 전체 Chrome 재시작의 RECOVERY_REQUIRED/실제 해제, 보고 응답 유실·네트워크 단절 시 로컬 해제와 동일 END 재전송, 다른 설치/오래된 revision 거절을 분리해 확인한다.
5. Chrome/OS/로드 commit·rule/interval/report/action 원본 근거를 확보하고 실패·미검증을 남긴다. 시간·실제 Chrome 근거 없이 전체 AC를 올리지 않는다.

## 미검증 / 실패 / 조율 필요 / 다음 행동

- 미검증: 실제 Windows 제품 Chrome/DNR/alarms/브라우저 재시작·절전·실quota, 회원 접근 이벤트/watermark, 신규 자동재개, 전체 AC01/02/03 및 BOUND17. 과거 회원 계정 연결 성공은 이번 실행 성공 근거가 아니다.
- 실패: 최종 로컬 검사0. 초기 회귀 오류는 위에 기록. 최신 CI는 게시 후 확인한다.
- 조율 필요: 다훈의 실제 테스트 executor/Snapshot 발급 gate 및 자동복구 후속 계약, 지민 D06 회신. Content 정책 지원을 허위로 선언하지 않는다.
- 다음 행동: 위 실제 회원 Chrome 통합 시험. 이어서 회원 접근 관측→Event1.2 outbox/전송 연결, 합의한 Content Shorts 연결을 작은 단위로 진행한다. EXT-02 전체·팀 develop 병합 완료 아님.
