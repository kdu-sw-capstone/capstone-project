# EXT-03 · 최신 브라우저 검증 · 2026-10-11

담당 Core 종민, 브랜치 feature/extension-core-ext-02, 시작 커밋 32a02e770f99d20ec222e6bfcd22df938ef8180e, Extension 0.1.17, PR #17. 이번 목표는 최신 코드의 브라우저 복구 검증과 실제 설치형 확장 검증 범위를 구분하는 것이다. 개인 Core 진행률 약85~90% 추정은 유지한다. 전체 MVP·정식 AC·팀 통합 완료율이 아니다.

## 기준

AGENTS.md, 개발운영.md, 통합현황.md, tasks/EXT-03.md 및 설계 11_인증_실행복구_가져오기_연결계약.md 실행·복구·기록을 대조했다. 실제 APPLIED/RELEASED 확인만 진행/종료로 인정한다. AC-EXT-03-01~03 전체 완료 판정은 하지 않는다.

## 이번 실행 결과

- `python3 extension/tests/ui/member_execution_worker.py`: PASS. Chromium 151의 실제 Worker와 IndexedDB에서 Worker 재생성 후 같은 보고 원문을 재전송하고 DUPLICATE 수신 후 ACKED로 전환, 인증 자료가 저장되지 않음을 확인했다. HTTP 응답은 합성 서버이며 제품 MV3 확장/실제 Server 연동 검증이 아니다.
- `python3 extension/tests/ui/member_fetch_worker.py`: PASS. 실제 Worker fetch에서 과거 미바인딩 fetch 오류를 재현하고 현재 제품 요청 함수는 합성 HTTP 요청 2개를 성공했다. 과거 baseline의 실패는 의도된 재현이다. 실제 회원 인증 성공 판정은 아니다.
- 실제 설치형 확장 시도: Chromium persistent context에 0.1.17을 --load-extension으로 지정했다. 기본 실행, Playwright --disable-extensions 제외, 추가 확장 디버깅/명령행 옵션의 세 실행 모두 serviceworker 대기가 각각 20/15/10초에 timeout했다. 따라서 팝업·DNR·실제 회원 시작/종료 검사는 실행되지 않았다. 원인은 아직 확정하지 않았으며 제품 오류로 단정하지 않는다. 임시 프로필만 사용해 기존 사용자 저장소는 수정하지 않았다.
- 실제 Server 연동·저장 장애 주입·최신 Windows 검증은 이번에 미실행이다. 이전 자동220/220·모의UI42/42는 과거 근거이며 이번 재실행 결과로 표기하지 않는다.

## Windows에서 이어서 확인할 순서

1. 기존에 로드한 확장 폴더에 최신 파일을 적용하고 chrome://extensions에서 새로고침한다. 표시 버전 0.1.17을 확인한다. 재설치·저장소 초기화 없이 기존 자료를 보존한다.
2. 팝업 계정 연결 상태 확인 후 회원 실행 상태 확인을 누른다. Web의 실행 설치 ID가 현재 확장의 executor_id와 같은지 확인한다. 토큰·쿠키는 공유하지 않는다.
3. 실제 유효한 테스트 도메인을 전체 차단으로 저장하고 Web에서 1분 세션을 시작한다. 실제 페이지 차단과 RUNNING을 함께 확인한다. 임의 문자열 1234는 실제 도메인 검증 대상으로 사용하지 않는다.
4. 해당 도메인 접근 후 행동 기록과 팝업 전송 상태를 확인한다. 성공 접수 및 남은 대기 건수를 구분해 기록한다.
5. 직접 종료 후 페이지 재접근이 허용되는지, 실제 정책 해제와 Server 종료가 모두 확인되는지 확인한다. 별도 1분 세션은 예정 종료도 확인한다.
6. 미전송 원문이 있는 테스트 세션에서 서비스 워커를 종료하고 다시 팝업을 연다. 동일 이벤트 ID/원문으로 복구되고 중복 기록이 생성되지 않는지 확인한다. 저장 장애는 별도 안전한 테스트 프로필에서만 주입하고 수집 중단·자기 규칙 해제·원문 보존을 확인한다.

시작 지연 측정은 사용자 지시대로 보류한다. 저장 오류 자동 END 사유, Shorts/Core D06, lifecycle local_seq/watermark/완전 수집 경계는 팀 협업으로 남는다. 실제 통합 검증 전 개인 잔여 1단위를 완료 처리하지 않는다. develop 미병합.

## 후속 작업: 설치형 확장 실행 차단 원인 확인

시작 커밋 7b5c12b, 기능 EXT-03, 목표는 이전 serviceworker timeout 원인 확인이다. 제품 코드는 변경하지 않았다.

- Debian Chromium 실행 래퍼와 Playwright 기본 옵션을 확인하고, `/usr/lib/chromium/chromium` 직접 실행 및 `--disable-extensions` 제외로 재시도했으나 serviceworker 대기는 10초 timeout했다.
- 임시 프로필의 `chrome://extensions`에서 `chrome.developerPrivate.getExtensionsInfo` 결과는 빈 목록이었다. 확장이 로드되지 않은 단계임을 확인했다.
- Chromium CDP `Extensions.loadUnpacked`로 저장소 extension 폴더를 지정하자 `Loading of unpacked extensions is disabled by the administrator.` 오류가 발생했다.
- `/etc/chromium/policies/managed/extensions.json`의 `ExtensionInstallBlocklist`가 `["*"]`인 것을 읽기 전용으로 확인했다. 클라우드 관리 정책이 설치를 차단한다. 관리자 정책·강제 설치 항목은 변경하지 않았다.

따라서 이전 timeout을 제품 서비스 워커 결함으로 해석하지 않는다. 현재 환경의 설치형 MV3/DNR/회원 Server 통합은 차단 상태이며 앞선 Worker 검사는 별도의 대체 검증이다. Windows 실제 확인 결과를 받기 전 검증완료/진행률 상승으로 처리하지 않는다.

사용자 다음 행동: 기존 Windows 확장 폴더를 새로고침해 0.1.17인지 확인 → 현재 설치 ID와 Web 실행 설치 ID 대조 → 유효한 도메인의 1분 집중 시작 → 실제 차단/행동 기록/종료 후 허용을 확인한다. 이번 회신에 필요한 근거는 확장 버전, 차단·해제 결과, 전송 상태 및 오류 코드이며 토큰·쿠키·개인 기록은 공유하지 않는다. 저장 장애·Worker 종료 복구는 정상 경로 뒤 별도 확인한다. 시작 지연 측정은 계속 보류한다.
