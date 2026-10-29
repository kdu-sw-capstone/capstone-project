# EXT-03 · 수집 저장 장애 대응 · 2026-10-10

목표: 수집 저장 오류 후 신규 수집을 중단하고 자기 차단 규칙 해제를 확인한다. 장애 표시를 제어 저장소에 남겨 Worker 재생성 후 자동 수집 재개를 막는다.

담당 Core 종민, 시작 e11bcb4229a497259fc7b0409d30e8ab09684dcf, feature/extension-core-ext-02, Extension 0.1.17, PR #17.

## 설계 및 계약 경계

`docs/design/02_시스템_테크설계/05_데이터_복구.md` 로컬 저장은 공간 부족 시 성공을 가장하지 않고 신규 수집 중단/세션 해제 절차를 요구하며 대기 원문을 삭제하지 않는다. Event1.2 계약은 동일 원문/ID 보존을 요구한다.

실제 Server `ExecutionService` local_actions.reason은 MANUAL/EXPIRED/BROWSER_RESTART/APPLY_FAILED만 허용한다. 저장 오류 자동 종료를 MANUAL이나 BROWSER_RESTART로 위장하지 않는다. 이번 구현은 수집 중단·실제 로컬 해제 확인까지이며, Server 세션 종료는 기존 사용자 MANUAL 확인/Web RELEASE/예정 EXPIRED 경로를 제공한다. 저장 오류 전용 자동 END 사유는 Server 공동 합의/구현이 남아 있다.

## 구현

- `member-execution-loop.js`는 ACCESS_STORAGE_UNAVAILABLE 발생 시 해당 세션을 메모리에서 즉시 중단한다. 이미 대기 중인 후속 관찰도 성공 이벤트를 생성하지 않는다.
- 제어 행에 capture_storage_fault 및 RECOVERY_REQUIRED를 저장하고, 마지막 checkpoint까지의 run_end_ms를 고정한다. 새로운 스키마 버전/API enum이나 이벤트 ID를 만들지 않는다.
- 기존 owner/executor/Server 확인과 journal 저장→자기 DNR 규칙 제거·확인 경로를 사용한다. capture_release_confirmed는 실제 해제 확인 후에만 true다. 다른 규칙은 유지한다.
- 다음 tick/Worker 재생성은 fault를 읽어 다시 수집하거나 APPLY를 재생하지 않고 해제를 재확인한다. 제어 저장 실패나 DNR 실패는 해제 완료로 위장하지 않는다. 저장 정상화 후 같은 Worker의 후속 tick은 fault 영속화/해제를 다시 시도한다.
- 기존 Web RELEASE 및 예정 EXPIRED, 이미 저장한 local END 재확인은 계속 처리한다. 명령 조회/인증 실패는 로컬 해제 확인과 Server 종료 미확인을 구분한다.
- 팝업은 수집 중단·해제 확인 여부·Server 종료 확인 필요를 안내한다. 실제 Server 종료 후에는 일부 기록 누락 경고를 유지하되 다시 종료를 요구하지 않는다.
- `member-execution-runtime.js`는 실패 응답에서도 수집 오류/해제 확인 여부를 보존한다. 별도 전송 복구는 기존 원문/ID를 따른다.

## 검증

- `npm --prefix extension run build:member-worker`: classic Worker bundle 재생성.
- `npm --prefix extension test`: 220/220 PASS. 새 4개는 durable fault·수집 중단·외부 규칙 보존·재생성·사용자 END, 해제 실패 및 대기 관찰 차단/재시도, control 저장 실패 후 중단 유지/재시도, Web RELEASE와 예정 EXPIRED 보존을 검사한다.
- `npm --prefix extension run check`: JavaScript 구문 PASS.
- `python3 extension/tests/ui/popup_ui.py`: 42/42 PASS. 새 3개는 실제 해제 확인/실패 구분 및 종료 확정 뒤 중복 END 요구 방지다.
- fake-indexeddb/오류 주입/mock Chrome/API 기반 검증이다. 실제 디스크 부족·MV3 Worker 종료·Server 공유 종료 계약 검증은 미실행이다. 이번 Backend 테스트는 재실행하지 않았다.

## 남은 위험·진행률

제어 저장소와 journal까지 동시에 저장할 수 없으면 장애 표시의 영속화/해제도 확인되지 않을 수 있다. 이때 수집 성공/해제 완료를 주장하지 않으며 해당 Worker는 수집을 중단한다. 저장소 정상화 후 재확인이 필요하다. 저장 전에 잃은 기록을 재구성하지 않는다. 전체 세션 자동복구/정확한 잔여 시간 계약을 완료하지 않는다.

개인 Core 진행률은 현재 개인 구현/안정화 범위에서 약85~90% 추정, 큰 개인 잔여는 최신 실제 검증이다. 전체MVP/정식AC/팀원 통합 비율이 아니다. 저장 오류 자동 END 사유, Shorts/lifecycle/watermark는 팀원 협업에 남아 있다. 결함 발견 시 범위/추정치를 갱신한다.

기존 로드 폴더 extension을 덮어쓰고 새로고침하여 0.1.17을 확인한다. 자료 초기화/새 설치 ID는 필요하지 않다. develop 병합/자동 병합 없음, 시작 지연 검증 보류 유지.
