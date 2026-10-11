# FOCURVE Chrome Extension

Manifest V3 확장입니다. 별도 번들링·빌드 도구 없이 이 디렉터리를 unpacked extension으로 Chrome에 불러옵니다. 현재 Core에는 비회원 로컬 사이트 정책과 세션 적용 경로가 있습니다. 팝업의 세션·사이트 동작은 개발용 DEV_* 메시지 경로이며, 회원 API 실제 연결·이벤트 서버 전송은 검증되지 않았습니다.

## 필요한 도구

- Google Chrome 120 이상 (manifest의 minimum_chrome_version)
- 자동 테스트 실행용 Node.js 18 이상 (node:test 내장 runner)
- Extension 실행에 npm 패키지 설치는 필요하지 않습니다. 저장소에 Extension package.json과 잠금 파일은 없습니다.

## 명령과 실행 위치

저장소 루트에서 PowerShell 또는 터미널을 실행합니다.

~~~powershell
Set-Location 'C:\Users\명품온라인\Documents\GitHub\capstone-project'
node --test extension/tests/session-core.test.mjs
~~~

빌드 명령은 없습니다. Chrome에서 불러올 manifest 폴더는 다음과 같습니다.

~~~text
C:\Users\명품온라인\Documents\GitHub\capstone-project\extension
~~~

extension/manifest.json이 폴더 바로 아래에 있어야 합니다. dist 산출물은 사용하지 않습니다.

## Windows·Chrome 로드와 재검증

1. 저장소 루트에서 git rev-parse --show-toplevel, git branch --show-current, git rev-parse HEAD를 실행합니다. 표시 경로가 위 저장소인지, 브랜치가 작업 브랜치인지 확인합니다. 폴더 이름만으로 clone을 판별하지 않습니다.
2. 커밋·Push가 승인된 뒤 원격에서 전달받은 같은 브랜치인지 확인합니다. 미커밋 변경은 원격에서 받을 수 없습니다.
3. chrome://extensions에서 개발자 모드를 켜고 압축해제된 확장 프로그램을 로드하여 위 extension 폴더를 선택합니다.
4. 테스트 사이트를 BLOCK으로 등록하고 대상 사이트 탭을 연 뒤 팝업에서 집중 세션을 시작합니다.
5. BLOCK 사이트는 안내 페이지로 이동하고 host가 표시되어야 합니다. RECORD/ALLOW 사이트는 차단되지 않아야 합니다.
6. 팝업에서 세션 종료를 눌러 DNR 규칙 해제를 확인하고 대상 탭을 다시 로드합니다.
7. 소스를 수정하면 테스트를 다시 실행하고 chrome://extensions에서 FOCURVE 새로고침을 누른 뒤 기존 대상 탭도 새로고침합니다.

## 윤종민 수동 검증 절차

### 비회원·로컬 경로

| AC·BOUND | 사전 조건과 테스트 설정 | 실행 위치와 수행 동작 | 기대 결과 | 화면·로그 | 증거 수집 | 상태 |
|---|---|---|---|---|---|---|
| AC-EXT-02-01, AC-EXT-02-02 | 테스트 전용 Chrome 프로필, 확장 로드, 비회원, BLOCK 사이트 1개 | 팝업에서 세션 시작 후 등록 host, 포함 하위 도메인, 범위 밖 유사 host 접근 | 스냅샷의 BLOCK만 적용; suffix 유사 host는 차단되지 않음 | 차단 안내 탭, 팝업 상태, chrome://extensions 서비스 워커 콘솔 | host와 화면만 캡처; owner UUID는 일부 마스킹; 토큰 금지 | 미실행 |
| AC-EXT-02-02 | 위 세션이 적용된 상태 | 팝업에서 세션 종료 | Extension 소유 규칙 해제 확인 후 사이트 재접근 | 서비스 워커 오류, 대상 탭 | 종료 전후 화면 캡처; 민감 데이터 제외 | 미실행 |
| AC-EXT-02-03 | 테스트 세션 실행 | chrome://extensions의 서비스 워커 검사기에서 워커 종료 후 재기동 대기 | journal과 규칙 일치 시 RUNNING 유지; 불일치 시 성공으로 가장하지 않고 복구/해제 | 검사기 콘솔, 팝업 상태 | 상태 전이·오류 코드만 캡처 | 미실행 |
| BOUND-08 | 테스트 세션 종료 기록; 전용 데이터 사용 | 종료 +30일 경계 만료를 테스트 데이터로 검증 | 종료 기록과 하위 journal/events 만료, 설정 유지 | 저장 상태/오류 로그 | 테스트 데이터만 사용 | 미실행; Chrome에서 30일 대기하지 않음 |

### 회원 연동 경로

| AC | 사전 조건과 설정 | 실행 위치와 동작 | 기대 결과 | 화면·로그 | 증거 수집 | 상태 |
|---|---|---|---|---|---|---|
| AC-EXT-02-01~03 | AUTH 로그인 및 설치 연결/토큰 선행 구현, API-EXEC-01~03 사용 가능한 Server, 테스트 계정·설치 | Web에서 정책 저장·시작 요청 → Extension 명령 조회 → 적용·결과 보고·재접속 reconcile | 소유 executor의 최신 revision만 실행; 다른 executor/만료 APPLY 거절; journal 대조 후 상태 보고 | Web 세션 상태, Server API 로그, Extension 서비스 워커 콘솔 | 인증 헤더 제거 후 request ID/revision/오류 코드만 기록; 토큰·쿠키 금지 | 미실행; 현재 제품 API adapter 없음 |
| BOUND-14 | 테스트 환경에서 연결된 Extension을 오프라인으로 전환 | 로그아웃/원격 해제 요청 | 실제 해제 확인 전 완료 표시 금지; 미확인 상태 유지 | Web 상태 및 Server/Extension 오류 | 민감 정보 없는 상태 전이 캡처 | 미실행; 선행 연동 필요 |

회원 연동의 서버 실행 명령·주소·설정은 backend README와 비밀 없는 개발 설정 예시를 확인한 뒤 별도로 기록합니다. 이번 Extension 독립 검증에서 서버 주소나 인증 값을 추정하지 않습니다. 개발 계정·데이터만 사용합니다.

## 오류 확인 위치와 개인정보 보호

- chrome://extensions의 FOCURVE 오류와 서비스 워커 콘솔
- 팝업의 상태·저장 결과 및 차단 안내 탭
- 자동 테스트 실패 이름과 stack trace
- 인증 토큰·쿠키·실계정 정보·개인 사이트 기록은 증거로 수집하거나 공유하지 않습니다.

작업카드에 AC/BOUND, 실행 주체, Windows·Chrome 버전, 모의/실제 대상, 결과 및 화면·로그 증거를 기록합니다.

## 설계 참조

[기능·화면 설계](../docs/design/01_UX_기능설계/) · [시스템 설계](../docs/design/02_시스템_테크설계/) · [EXT-02 작업카드](../docs/implementation/tasks/EXT-02.md) · [개발 운영](../docs/implementation/개발운영.md)
