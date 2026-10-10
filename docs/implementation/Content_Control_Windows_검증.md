# Content Control Windows 검증 절차

대상 브랜치 `feature/content-control`, 시작 기준 `90ad32b`. **테스트한 최종 커밋은 실행 시 `git rev-parse HEAD`로 기록**한다. 실행자·Windows 버전·Chrome 버전·SHA·관찰 결과·화면/콘솔 증거를 함께 전달하면 “사용자 실행 결과”로 작업카드에 반영한다. 사용자 키워드 합성 도구 실행 결과는 아래 2026-10-10 기록에 한정한다. 실제 Extension 시험은 여전히 미실행.

## 1. 현재 실행 가능한 독립 검증

설치된 Node24+Playwright+Chrome 사용. Server/DB/Core는 불필요하다. 실제 Chrome 엔진이지만 합성 페이지·정책·모델 입력 시험이며 실제 Extension 제품 검증이 아니다.

저장소 루트 PowerShell:

```powershell
git switch feature/content-control
git pull --ff-only
git rev-parse HEAD
# node/Playwright가 PATH·로컬 의존성에 없을 때 실제 설치 경로를 지정한다.
$env:PLAYWRIGHT_MODULE='C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright'
$env:CHROME_EXECUTABLE='C:\Program Files\Google\Chrome\Application\chrome.exe'
& 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test extension/content-tests/*.test.mjs
```

다른 PC에서는 실제 Node/Playwright 경로로 바꾼다. 위 번들 경로가 없으면 존재한다고 가정하지 말고 오류와 도구 설치 상태를 공유한다. 기존 변경이 있으면 switch/pull 전에 보존하고 강제 진행하지 않는다.

눈으로 확인하는 별도 합성 도구:

```powershell
& 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' extension/content-tools/serve.mjs
```

Chrome에서 `http://127.0.0.1:4178/content-tools/harness.html`을 연다. “키워드 제한 적용”→입력창의 검증대상 값은 무시되고 페이지 유지→“본문 변경”→500ms 뒤 안내와 페이지 가림→3초 뒤 검증 도구가 해제하여 원래 페이지/버튼 복귀. **3초 해제는 합성 도구 전용이며 제품 우회/자동 보기 타이머가 아니다.** 콘솔 오류와 결과 화면을 기록하고 종료할 때 터미널 Ctrl+C.

| 기능/기준 | 현재 독립 시험 | 기대·증거 | 현재 상태 |
|---|---|---|---|
| POLICY-03 AC-01~03 | browser.test Shorts/뷰어/새DOM/SPA/해제 | 일반 watch 보존, Shorts만 가림, 감지 실패 FAILED, 스타일 복원 | Codex 합성 PASS, 사용자 미실행 |
| EVENT-03 AC-02 | detection.test/렌더 결과 | 지원 경로 후보만, 자동렌더로 이벤트 미생성 | 후보 탐지만 PASS, 실제 기록 미검증 |
| OPTION-01/02 AC-01~03 | browser.test 추천·댓글 | video autoplay 속성·수동재생 보존, 해당 영역만 가림·해제 | 합성 PASS, 실제 서비스 미검증 |
| OPTION-03 AC-01~03 | 토글 정상/실패 fixture | false 확인·원래 true 복원, 실패 클릭 반복 금지 | 합성 PASS, 실제 자동전환 미검증 |
| OPTION-05 AC-01~03 | Reels/SPA following fixture | Reels만 가림, following 복원 | 합성 PASS, 실제 피드/모달 미검증 |
| OPTION-09 AC-01~03/BOUND-18 | 위 명령/합성 도구 | NFKC·범위·예외·입력제외·한계·재검사·복원 | 자동 합성 PASS, 사용자 미실행 |
| OPTION-10 AC-01/02 | detection.test | 독립 예외/경계/목록부재 실패 | 판정 함수만 PASS, 실제 목록/차단·AC-03 미검증 |
| OPTION-11 AC-01~03/BOUND-10 | blur fixture | 보기/재가림·교체 초기화·실패 가림·해제 뒤 늦은 결과 무시 | 모의 분류 표시 PASS, 실제 모델 미검증 |

## 2. 실제 Extension 검증 — 연결 선행 후 수행

**현재 브랜치의 extension 폴더에는 manifest가 없으므로 아직 unpacked Extension으로 로드할 수 없다.** 존재하지 않는 dist/빌드 명령을 사용하지 않는다. Core PR17의 manifest를 복사하거나 별도 브랜치를 임의 merge하여 검증 통과를 만들지 않는다.

선행 조건: D-06 세부 메시지/공통 탐색/이벤트 확정 계약 합의 → Core 담당자가 검토한 연결 코드·manifest/content script 주입 반영 → 확정된 통합 SHA/실제 로드 폴더/실행 명령 기록. Core 현재 원본의 로드 경로는 `extension/`이나 **이번 Content 연결이 반영된 로드 경로라는 뜻은 아니다**. 통합 코드가 달라지면 이 절차도 실제 경로로 갱신한다.

회원 시험은 해당 통합 README의 순서대로 DB→Server→Web→연결된 Core/Content Extension을 준비하고 회원/설치/권한을 확인한다. 비회원 독립 시험은 합의된 guest 정책 전달이 준비되면 Server/DB 없이 한다. 실제 회원·비회원 상태를 합성 입력으로 대신하지 않는다.

| 기능/AC·BOUND | 수행 동작 | 기대 결과·확인할 증거 |
|---|---|---|
| POLICY-03 AC-01~03 | YouTube 일반 watch/Shorts 직접 진입, 홈 Shorts 클릭, 뒤로·앞으로·SPA/동적 목록 이동 | 일반 영상 유지, Shorts 제한, 중복렌더 접근0추가, 세션정지/종료 뒤 스타일/속성 복원. 화면·Content 결과·Core event 원문 ID 비교 |
| EVENT-03 AC-01~03/BOUND-01/15 | 동일 세션 Shorts 명시 접근3번, 렌더 반복, 차단안내 새로고침, 같은ID 재전송·역순 도착 | 전체3/반복2, 같은ID 원문 불변·중복 없음, 계정/탭/프레임 불일치 거절. 서버/로컬 기록을 민감값 제거 후 증거화 |
| OPTION-01/02 AC-01~03 | YouTube 홈/관련추천/watch댓글 및 추가 렌더, 정지/종료 | 해당 영역만 제한·복원, 수동재생·일반 탐색 보존, 숨김 자체 접근0건 |
| OPTION-03 AC-01~03 | 다음영상 autoplay ON/OFF 각각 시작·영상종료 대기·수동 다음영상 클릭·정지/종료 | 자동전환 제한, 수동 재생 유지, 기존 사용자 토글 복원, 감지 실패를 성공 처리하지 않음 |
| OPTION-05 AC-01~03 | Instagram Reels 직접/웹내 이동/뷰어·추천피드/일반 following 비교 | Reels/합의한 추천 영역만 제한, 일반 following 보존. 미지원 모달/selector는 실패로 기록 |
| OPTION-09 AC-01~03/BOUND-18 | 제목/URL/BODY 각각, 입력창에만 키워드, SPA 교체, 200k초과·iframe/shadow | 선택 범위 일치·전용 예외, 입력/원문 미전송, 검사불가·부분검사 표시, 같은 탐색 중복0건 |
| OPTION-10 AC-01~03/BOUND-19 | 검증목록 host/전용예외/키워드만예외/siteBLOCK, 목록갱신실패·최초목록없음 | 전용 예외만 적용, USER_SITE 유지, 유효목록 없으면 불가, 마지막검증본 보존 |
| OPTION-11 AC-01~03/BOUND-10 | 고정 로컬 모델 포함 버전으로 정상/블러·보기/재클릭·src교체·CORS실패·이미지102개 | 로컬분류·가림/실패 표시, 새 이미지 보기상태 초기화, 1실행/100대기·초과미분석, 픽셀 외부전송0 |
| EXT-02/SESSION 연결 | 시작·실패 rollback·정지·같은Snapshot재개·종료·Worker중지·Chrome재시작 | 실제 적용/해제 확인 후 상태 전이. 실패/늦은 보고·미확인복구는 성공 금지. 고정 정책/기존 이벤트·자료 유지 |

위 실제 절차는 모두 **미실행·선행 대기**다. 실제 서비스 DOM/모델 정확도/속도·quota·Chrome 재시작/절전은 자동 합성 PASS로 대체하지 않는다. 어떤 시나리오가 막히면 ID/SHA/환경/동작/기대/실제/오류/증거를 전달하고 해당 범위만 미검증으로 유지한다.

## 2026-10-10 사용자 실행 결과 및 중간 공유 재개

- 사용자(채지민)가 localhost Content 검증 도구를 Chrome에서 실행했다. 제공한 화면에서 입력창에 검증대상이 있어도 blocked:false / SUPPORTED / limited:false이며 일반 페이지가 유지됨을 확인했다. 이어 본문 변경 시 FOCURVE 제한 안내만 표시된 화면을 확인했다.
- 자동 복원·수동 해제 후 본문 변경·재적용 절차를 안내한 뒤 사용자는 “다 된거 같은데”라고 보고했고 서버 종료도 보고했다. 이 세 항목은 **사용자 정상 추정 보고**로 기록한다. 세부 단계별 로그/추가 화면·버전·파일hash는 제공되지 않아 독립 확인 PASS로 확대하지 않는다.
- 실행 대상: feature/content-control의 미커밋 작업본(시작 HEAD90ad32b). 검증 당시 최종 Commit SHA/실제 로드 파일hash·Windows/Chrome 정확한 버전은 미확보. 이후 코드 변경 없이 중간 공유를 준비했다.
- 적용 범위: OPTION-09 키워드 합성 도구, AC-OPTION-09-01/02/03 및 BOUND-18의 일부(입력 제외·본문 감지·가림/해제). 실제 Extension/서비스 페이지/Core/Server·모델·재시작 검증으로 전용하지 않는다.
- 최신 사용자 지시: 확인한 결과와 미검증·Core 연결 대기를 기록하고 feature/content-control에 Commit·Push하여 중간 결과 공유. develop 병합 금지, 오늘 추가 구현은 진행하지 않음. 이전 게시 거부·보류는 당시 이력이며 이번 명시 허용으로 Git 게시를 재개한다.
- 다음: 윤종민이 D-06 연결 제안의 정책 주입/적용·해제 결과/공통 navigation_id/이벤트 확정·중복 방지를 검토. 세부 계약 합의 후 Core 연결 및 실제 회원·비회원 Chrome 검증. 현재 전체 기능 미완료.

## 필수 Shorts 후속 도구

2026-10-10 시험 전용 unpacked MV3 확장 생성 도구를 추가했다. 제품 Core 연결은 없으며 새로고침 시 모의 정책은 초기화된다. 빌드·로드·직접/SPA/뒤로·앞으로·해제 절차 및 기대값은 [Content_Shorts_2026-10-10.md](Content_Shorts_2026-10-10.md)를 따른다. 실제 Chrome UI/YouTube 검증은 아직 미실행이다.

### 사용자 후속 실행 보고 — 2026-10-10

사용자는 시험용 확장 빌드·Chrome 로드·YouTube Shorts 적용→해제 안내 후 “오 다 됐어”라고 정상 실행을 보고했다. 위의 ‘아직 미실행’은 당시 기록이며 사용자 실행 보고는 접수됐다. 단계별 화면·상태값·완료 범위·Chrome 버전/로드hash는 미확보이므로 실제 사이트 전체 검증완료로 표시하지 않는다. 자동33/33 합성/모의 시험과 분리한다. 실제 서비스 상세 시나리오 및 Core/Server·Snapshot·Event1.2·세션 통합은 미검증 유지. 상세 범위와 다음 행동은 Content_Shorts_2026-10-10.md의 사용자 실행 기록을 따른다.
