# POLICY-03 필수 Shorts 보강 기록

담당 채지민 / feature/content-control / 시작 0febe9838ebccdf269f5d3ad8e5b81363bc7f820. develop 기준 90ad32be5d282f3b44c917a29e156dffc5e29187, Core 별도 브랜치 9b063be33635592cf48659ce07c0367930295e78. 기존 독립 구현은 보존했다. 사용자 명시 요청 전 develop 병합·자동병합 금지.

## 기준과 구현

- AGENTS.md, 개발운영.md, 통합현황.md, tasks/POLICY-03.md, 설계 문서안내 및 PC 후속확장계획을 확인했다. 필수 Shorts 우선이며 추가 MVP 보강과 PC 구현은 이번 범위에서 진행하지 않았다.
- 현행 동작·API·데이터·검증 기준 및 D-01~D-10 공용계약 D-06, API 연동 로컬 메시지, 호스트 정책우선순위를 적용했다. POLICY-03-01~03과 BOUND-19는 독립 DOM 부분만 검증했다.
- `extension/content/shorts.mjs`: 상대·절대 Shorts 링크/선반, 직접 진입 플레이어 제한, 재생 중지 및 재생 재시도 방어, 안내, 스타일·이벤트 리스너 복원. 실제 viewer가 없으면 FAILED이며 늦게 등장하면 재검사한다.
- `features.mjs`는 Shorts adapter를 호출한다. `controller.mjs`의 기존 동적 DOM·YouTube 이동 이벤트·Navigation API·뒤로/앞으로 감지 및 frozen 입력을 재사용했다. Content가 탐색 ID·접근 이벤트·DNR 규칙을 발급하지 않는다.
- Core가 선택한 가장 구체적인 호스트의 전체 정책만 전달받는 기존 경계를 유지했다. 부모 정책 혼합 금지, 세션 중 변경은 다음 세션 적용이다. 실제 Snapshot 선택/세션 상태는 Core 책임이며 여기서는 연결하지 않았다.

## 실행한 검증

환경: Windows, Node 번들 런타임, Playwright 및 설치된 Chrome 154.0.8037.98 headless. 페이지/정책/Chrome runtime은 합성 또는 모의이며 실제 YouTube 네트워크·실제 MV3 주입 시험이 아니다.

```powershell
$env:PLAYWRIGHT_MODULE='C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright'
$env:CHROME_EXECUTABLE='C:\Program Files\Google\Chrome\Application\chrome.exe'
& 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test extension/content-tests/*.test.mjs
```

결과: **33/33 PASS, 실패/생략 0, 21054.1217ms**. 기존 29개 회귀 + 절대 URL/쿼리 오탐/중복 scan, 지연 viewer/재생 재시도/해제 후 리스너 제거, history 뒤로·앞으로, 시험 popup sender 검증/중복 적용/해제 4개 추가. 초기 32개도 통과했고 시험 transport 검증 추가 후 전체 재실행했다. 기존 autoplay·키워드·이미지 등 회귀를 포함하지만 추가 MVP 완료로 판정하지 않는다.

검증용 확장 생성 명령도 정상 종료했다. 문법 및 diff 검사는 게시 전 점검한다. 실제 페이지 새로고침·Core 재주입·정책 자동 재적용은 자동 시험 범위에 포함하지 않는다.

## Windows Chrome에서 확인하는 방법 — 아직 미실행

시험 전용 확장이다. 제품 확장·Core 계약을 대신하지 않는다. 실제 계정·세션·Server 전송·저장·통계·정책 조회 기능이 없다. 메시지 TEST_SHORTS_*는 이 도구의 popup 전용이며 제품 type으로 사용하면 안 된다.

1. 저장소 PowerShell에서 다음 명령을 실행한다. PowerShell의 `&`도 포함한다.

```powershell
& 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' extension/content-tools/build-chrome-harness.mjs
```

2. Chrome `chrome://extensions` → 개발자 모드 → 압축해제된 확장 프로그램 로드 → `C:\Users\user\Documents\capstone-project\extension\build\content-harness` 선택. 생성 폴더는 Git 제외이며 소스 변경 후 재빌드·확장 새로고침·YouTube 탭 새로고침이 필요하다.
3. YouTube 일반 영상에서 확장 popup의 **제한 적용**. Shorts 링크/선반만 숨고 일반 영상은 유지되는지 확인한다. 대상이 전혀 없으면 FAILED가 나올 수 있으며 성공으로 해석하지 않는다.
4. 주소창에서 `/shorts/영상ID`로 직접 이동한 후 **제한 적용**. 플레이어가 숨고 소리가 멈추며 안내가 나와야 한다. 상태 확인 결과 shorts SUPPORTED인지 확인한다. FAILED면 실제 DOM 지원 실패이며 오류를 남긴다.
5. 적용한 문서 안에서 YouTube 일반 영상↔Shorts 이동·뒤로/앞으로를 시험한다. 일반 영상은 보이고 Shorts viewer는 제한돼야 한다. YouTube가 문서 자체를 새로 로드하면 아래 6번을 따른다.
6. 새로고침하면 시험 정책은 초기화된다. **제한 적용**을 다시 눌러 주입/동작을 확인한다. 이는 세션 유지 검증이 아니며 Core의 새 문서 자동 정책 전달은 미검증이다.
7. **제한 해제** → released:true, 플레이어·링크 복원, 안내 제거 확인. 재적용/중복 적용 후 해제도 확인한다. released:false면 복원 실패이며 세션 종료 성공으로 취급할 수 없다. 이 도구는 해제 시 자동 재생을 시작하지 않는다.
8. Chrome 버전·페이지 종류·각 단계 실제 결과와 FAILED/오류를 기록한다. 완료 후 시험 확장을 제거한다. 개인 URL·계정 자료는 공유 기록에 넣지 않는다.

## 미검증과 연결 대기

- 실제 Windows Chrome UI의 unpacked 확장 로드/실제 YouTube DOM·음성·SPA/새로고침·로그인/실험별 차이. 위 절차는 준비됐으나 사용자가 수행한 증거는 아직 없다. 과거 localhost 키워드 확인은 이 Shorts 시험의 증거가 아니다.
- Core manifest에는 Content 주입이 없고 수신 메시지 세부 스키마·규칙 ID·navigation_id 전달/중복 명령·Event 1.2 확정 시점은 D-06에 미합의로 남아 있다. 임의 제품 schema와 모의 성공을 넣지 않았다.
- 실제 회원/비회원 세션 적용·종료·정책 해제 확인, Snapshot 일치, 실제 방문 호스트/정책 호스트/복수 차단 사유 통합, 재시작·오프라인 복구, Server 전송은 미검증이다. siteBlocked 억제와 frozen 입력 시험은 실제 연동을 대신하지 않는다.
- 윤종민 검토 문서: [Content_Core_D06_연결제안.md](Content_Core_D06_연결제안.md). 먼저 주입 위치·최소 frozen 정책·적용/해제 결과 schema·sender 검증·탐색 ID·전송 freeze를 합의한 뒤 별도 연결 단위로 구현한다.
- 상태: 독립 구현 검토 대기 / 실제 Chrome 및 통합 검증 대기. Draft PR을 생성하여 리뷰받고, CI와 공식 승인 이후에도 사용자 명시 요청 전 develop에는 병합하지 않는다.
