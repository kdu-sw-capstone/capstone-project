# FOCURVE Chrome Extension

Manifest V3 기반으로 브라우저 정책 적용·해제, 내부 기능 제한, 접근 이벤트 수집과 비회원 로컬 이용을 구현합니다.

현재 EXT-02의 **사이트 전체 차단 실행 모듈**과 백업에서 복원한 **v0.1.5 비회원 로컬 확장**이 함께 있습니다. 두 구현은 아직 연결하지 않았고 회원 연결도 미구현입니다. `background/`·`popup/`·`blocked/`·`manifest.json`은 기존 비회원 구현입니다. `src/`는 실제 DNR·탭 API를 주입받는 실행 코드이고, `tests/chrome/`과 `.chrome-harness/`는 모의 Core 문맥을 사용하는 검증 전용 확장입니다. 검증용 패키지를 제품 완성본으로 사용하지 않습니다.

[기능·화면 설계](../docs/design/01_UX_기능설계/) · [시스템 설계](../docs/design/02_시스템_테크설계/) · [개발 계획](../docs/implementation/개발운영.md)

## 개발·자동 검증

실행 위치: 현재 작업공간 기준 `C:\FOCURVE\capstone-project\extension` (다른 PC에서는 해당 저장소의 `extension` 디렉터리).

- Node 24.x와 npm 필요. 이번 Codex 자동 검증 환경: Node 24.21.0, npm 11.19.0. Chrome 설치 파일 버전 154.0.8037.98을 확인했지만 Chrome UI 동작은 실행하지 않았으며, 사용자 재검증 대기.
- 외부 npm 의존성 없음. `package-lock.json`을 사용하며 기존 Web 의존성·버전을 변경하지 않습니다.
- 환경변수·Web·Server·DB 없이 모듈 자동 테스트와 검증용 확장 실행 가능.
- `npm run check`는 JavaScript 문법 검사입니다. ESLint는 구성하지 않았습니다.

```powershell
$repoRoot = 'C:\FOCURVE\capstone-project'
Set-Location (Join-Path $repoRoot 'extension')
node --version
npm --version
npm ci --ignore-scripts --audit=false --fund=false
npm test
npm run check
npm run build:harness
```

PowerShell 실행 정책으로 `npm.ps1`이 차단되면 보안 정책을 바꾸지 말고 위 명령의 `npm` 대신 `npm.cmd`를 사용합니다. 예: `npm.cmd run build:harness`.

Node가 PATH에 없으면 공식 Node.js 배포본으로 Node 24.x를 설치하고 위 명령의 `node --version`, `npm --version` 결과를 확인한 뒤 진행합니다. Web 의존성은 설치할 필요가 없습니다.

제품 모듈은 별도 번들 빌드가 없는 ES module입니다. 검증용 패키지 생성 명령은 실제로 존재하는 `npm run build:harness`이며, 생성된 manifest 경로는 `extension/.chrome-harness/manifest.json`입니다. 산출물은 Git 제외입니다. 별도 실행 모듈 검증에는 `.chrome-harness/`를, 복원한 비회원 확장 검증에는 `extension/manifest.json`이 있는 `extension/`을 로드합니다.

## 이번 실행 모듈의 경계

- `src/site-rules.js`: 정규화된 Snapshot의 BLOCK 사이트만 main_frame redirect 규칙으로 변환합니다. ALLOW/RECORD 사이트·서브리소스에는 차단 규칙을 만들지 않습니다. 하위 도메인 경계·www 보존·IDNA ASCII host·탐색 주소의 마지막 점을 처리합니다.
- `src/site-controller.js`: `apply(Command)`, `release(Command)`, `inspect(ownerKey, sessionId)`는 **Core 내부 호출**입니다. API 경로·공용 이벤트·runtime 메시지를 새로 만들지 않습니다.
- `getContext`는 신뢰된 Core가 소유자·설치·세션·최신 revision·원하는 실행 상태를 확인하고 journal/Server 대조를 마친 뒤 제공해야 합니다. 페이지 또는 Command의 사용자 주장으로 구성하면 안 됩니다. `reconciled`는 내부 선행 확인값이며 서버 reconcile 응답의 새 필드가 아닙니다.
- `journal.load/save`는 내부 저장소 adapter입니다. `save`는 IndexedDB transaction commit 이후 resolve해야 합니다. journal의 기존 owner/session/revision/action_seq/desired/observed와 함께 해당 모듈의 규칙 소유 정보·스냅샷·명령 식별자를 로컬에 보존합니다. 실제 제품 저장 transaction·outbox·ExecutionReport 연결은 이번 단위에서 제외했습니다.
- APPLY 전에 durable journal을 저장하고 실제 규칙 및 기존 열린 탭의 이동을 확인합니다. 실패 시 소유 규칙만 정리하며 정리·저장 확인 불가를 성공으로 반환하지 않습니다. 반환값은 사이트 계층의 관찰 결과이며 제품 RUNNING 상태 또는 ExecutionReport 자체가 아닙니다.
- 중복 APPLY는 재설치하지 않습니다. 누락·부분 규칙은 `inspect`로 확인하고 상위 Core 복구를 요구합니다. 브라우저 재시작 후 자동 재적용하지 않습니다. 수동 세션 INTERRUPTED 확정과 시간 계산은 세션 담당 구현에 연결해야 합니다.
- 새 세션에는 새 `session_id`가 필요합니다. 동일 세션의 추가 MVP 일시정지/재개, 내부 기능 제한, 이벤트 수집·전송, 정책 동기화·인증은 이번 범위에서 구현하지 않았습니다.

Chrome의 session 규칙은 브라우저 종료 시 제거됩니다. 세션 규칙 API·권한·제한 기준은 [공식 DNR 문서](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)를 확인했습니다. `isRegexSupported`를 실행해 미지원 패턴을 성공으로 처리하지 않습니다.

## Windows·Chrome 실제 검증 — 현재 미검증

관련 기능: EXT-02. AC-EXT-02-01/02/03의 **사이트 실행 계층 부분 검증**과 BOUND-17의 저장 실패 자동 검증에 대응합니다. 설치 토큰 인증·Server reconcile을 검증하는 절차가 아닙니다.

대상 브랜치: `feature/extension-core-ext-02`. 이 문서를 포함하는 최신 Push 커밋을 사용하고 작업카드의 결과 기록에 `git rev-parse HEAD`를 남깁니다. 다른 브랜치·다른 파일로 수행한 결과는 해당 커밋 결과로 구분합니다.

사전 조건: 일반 Chrome 프로필, Chrome 120 이상, Node 24, Git. 기존 확장은 제거하지 말고 다른 **검증용 Chrome 프로필**을 권장합니다. Web·Server·DB·회원 로그인·실제 계정 자료는 필요 없습니다. 검증용 확장은 테스트 도메인 example.com만 차단합니다.

1. 자기 작업 브랜치를 최신으로 맞추되 미커밋 변경을 먼저 확인합니다. 깨끗한 작업공간에서만 `git switch feature/extension-core-ext-02`, `git pull --ff-only origin feature/extension-core-ext-02`, `git rev-parse HEAD`를 실행합니다. 다른 변경이 있으면 초기화하지 말고 보존합니다.
2. 위 자동 검증·`npm run build:harness`를 `extension`에서 실행합니다.
3. `chrome://extensions` → 개발자 모드 → **압축해제된 확장 프로그램을 로드합니다** → `C:\FOCURVE\capstone-project\extension\.chrome-harness`를 선택합니다.
4. 이름 `FOCURVE EXT-02 검증 전용`을 확인합니다. 확장 아이콘 → 검증 페이지 열기. page runner와 DevTools Console을 확인합니다. Service Worker는 이 fixture에 없습니다.

| 순서 / AC | 설정·수행 동작 | 기대 결과·확인 화면 / 로그 | 현재 상태 |
|---|---|---|---|
| 1 / AC-01 부분 | 적용 전 별도 탭에서 `https://example.com` 열기 → runner의 규칙 적용 | 열린 대상 탭도 차단 안내로 이동. runner `observed: APPLIED`. DevTools에서 DNR 규칙 실제 조회 | 미검증 |
| 2 / AC-01 부분 | 적용 후 `https://example.com/`, `https://www.example.com/`, `https://example.com./` 새 탭 탐색 | 직접 등록 전체 차단 안내·host·USER_SITE 이유. 전체 URL/query를 출력하지 않음 | 미검증 |
| 3 / 사이트 경계 | `https://example.org`, `https://example.net`, `https://example.com.evil.test` 탐색 | FOCURVE 차단 안내로 이동하지 않음. 마지막 도메인의 DNS 오류는 네트워크 결과이며 FOCURVE 차단과 구분 | 미검증 |
| 4 / 중복 | runner 규칙 적용 재클릭, 차단 안내 새로고침 | duplicate true, 규칙 추가 없음. 안내 새로고침으로 이벤트 생성 안 함(수집 기능 자체 미구현) | 미검증 |
| 5 / AC-02 부분 | 적용 중 만료 APPLY 확인·타 설치 APPLY 확인 | REJECTED / rules_unchanged true. 실제 인증 토큰 거절을 검증한 것은 아님 | 미검증 |
| 6 / AC-03 부분 | runner 페이지 새로고침 → journal / 실제 규칙 대조 | IndexedDB journal 유지, desired/observed APPLIED. controller 재생성 검증이며 실제 worker 중단 검증은 아님 | 미검증 |
| 7 / 해제 | 소유 규칙 해제 → example.com 탭 재탐색·새로고침 | observed RELEASED. 해당 session 규칙 제거, example.com 방문 가능. 기존 차단 안내 페이지는 자동 원복하지 않음 | 미검증 |
| 8 / AC-03 부분 | 규칙 적용 상태에서 Chrome 완전 종료·재실행 → runner 열기·대조 | journal desired APPLIED / actual RELEASED; 이전 APPLY를 자동 재적용하지 않음. INTERRUPTED 제품 상태는 미연결 | 미검증 |

브라우저 재시작(8)은 별도 테스트 실행에서 수행합니다. 한 테스트 실행을 해제하면 같은 session의 재시작은 차단됩니다. 새 검증은 다른 runner 탭을 닫고 **새 검증 실행 준비**를 눌러 `result: READY` 확인 후 **규칙 적용**을 누릅니다. 버튼은 이전 소유 규칙의 해제를 확인한 뒤 새 테스트 session을 만들고 이전 journal은 보존합니다. DB를 직접 삭제할 필요가 없습니다. 해제 오류가 나면 새 실행을 준비하지 않으며 오류를 전달합니다. `TEST_PAGE_STALE_RELOAD`는 다른 탭에서 새 실행을 준비한 경우이므로 현재 runner를 새로고침합니다.

코드 수정 후: `npm test`, `npm run check`, `npm run build:harness` → `chrome://extensions`에서 검증용 확장 새로고침 → runner·대상 탭도 새로고침. 확장 새로고침 후 규칙·journal을 대조하고 신규 테스트 실행 여부를 판단합니다.

확인용 runner DevTools Console 명령:

```javascript
await chrome.declarativeNetRequest.getSessionRules()
```

오류 위치: `chrome://extensions`의 검증 확장 오류 표시, runner DevTools Console, Application → IndexedDB → `focurve-ext02-test-only` → journal. 규칙 조회 결과에는 검증용 host만 사용합니다. 증거는 커밋 SHA·Windows/Chrome 버전·절차 번호·runner 결과·가려진 화면으로 수집합니다. 개인 URL, 전체 탭 목록, 쿠키, .env, 토큰은 공유하지 않습니다.

사용자가 결과를 보내면 작업카드에 **사용자 실행 결과**로 기록합니다. Codex 자동 테스트와 합쳐 실제 Chrome 검증 완료로 표시하지 않습니다.

## 회원·Server 실제 연동 — 미검증 / 선행 구현 필요

현재 Server는 health·DB 개발 기반만 있으며 제품 인증·API-EXT-01~07·API-EXEC-01~03이 없습니다. 이 fixture는 Server 응답을 정상으로 가장하거나 회원 API를 호출하지 않습니다. 제품 manifest·신뢰된 Core 문맥·IndexedDB 원자 저장·ExecutionReport/outbox·세션 상태 연결도 필요합니다. 따라서 현재 실행 가능한 회원 연동 명령·순서를 만들지 않습니다.

선행 준비 후 DB → Server → Web → 연결된 제품 Extension 순으로 실행하고 API-EXEC-03 journal 대조 → 명령 조회 → 로컬 journal 저장 → 실제 적용 확인 → 동일 report 저장/전송을 검증해야 합니다. 서비스의 구체 실행 명령과 인증 설정은 해당 담당의 구현·README 확정 후 추가합니다. 기존 개발 기반 README의 health 성공은 제품 API 성공 근거가 아닙니다.


## 백업 v0.1.5 재개 — 2026-10-08

사용자 제공 `extension.zip`의 기존 구현을 추가 복원했습니다. 원격 브랜치의 기존 코드·검증 fixture는 보존했습니다. 백업 README 원문은 [README-guest-backup.md](README-guest-backup.md)에 보존하며, 그 문서의 개인 PC 절대 경로는 현재 환경의 경로가 아닙니다.

- 비회원 확장 로드 경로: 현재 저장소의 `extension/` (manifest 버전 0.1.5, 이번 로컬 수정 포함). 기존 팝업·설정 DB·실행 DB 형식을 유지합니다.
- 자동 검증: `extension/`에서 `npm test`, `npm run check`. 기존 실행 모듈 26건 + 백업 세션 7건 + 기한 회귀 4건 = 37건입니다. Chrome API와 저장소는 모의이며 실제 IndexedDB·Chrome 검증을 대체하지 않습니다.
- 수정: APPLY 실행 전·실제 적용 확인 후·워커 STARTING 복구에서 기한 누락/비정상 값과 `now >= execute_before`를 거절하고 기존 해제 경로로 정리합니다. 기존 `APPLY_EXPIRED` 오류를 재사용합니다.
- 비회원 확장은 별도 빌드 없이 로드합니다. `.chrome-harness/`는 별도 모듈의 검증용이며 두 확장을 같은 것으로 해석하지 않습니다.
- 백업에 이미 있던 `DEV_ACCESS_LIST` 최근 20건 개발용 조회는 보존했습니다. LOG-01 v0.1.6 필터·기간·페이지네이션을 추가하지 않았고 LOG-01 완료로 표시하지 않습니다.

Windows 재검증은 별도 테스트 프로필에서 현재 `extension/`을 로드한 뒤 BLOCK/RECORD/ALLOW 사이트 등록 → 집중 시작 → BLOCK 차단·RECORD/ALLOW 방문 → 실행 중 설정 수정/삭제 → 현재 스냅샷 유지 → 종료·해제 → 다음 시작에 변경 반영 순서로 수행합니다. 워커 중단 후에는 같은 세션의 journal/규칙 대조, Chrome 완전 종료 후에는 이전 세션 INTERRUPTED·규칙 해제와 사이트 설정 보존을 확인합니다. 각 결과에 코드 기준(`git rev-parse HEAD` 및 미커밋 변경 여부)·Windows/Chrome 버전을 남깁니다. 이번 수정의 기한 경계·잘못된 journal 검증은 자동 모의 결과이며 실사용 DB를 조작해 재현하지 않습니다.

이전 버전의 사용자 Chrome 성공 보고와 이번 Linux Node 24.19.0 자동 결과는 구분합니다. 현재 수정본의 Windows/Chrome·회원/Server 실제 연동은 미검증입니다.
