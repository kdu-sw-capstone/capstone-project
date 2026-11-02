## 2026-11-02 실제 로컬 모델 연결·중단 후 재개
- 담당 채지민 / codex/content-image-blur / #87 2704148b 기준과 미커밋 표시 부품을 이어서 구현. 사용자 모의 시험 정상 보고 후 실제 모델 연결 요청. root/다른 worktree/검토 PR 보존. Git 게시·제품 활성화 미수행.
- 기존 모의 화면/15시험과 표시·복원 부품 유지. 신규 blur-classifier.mjs + content-tools/blur-model/worker.mjs, 고정 dependency package.json/pnpm-lock.yaml·build.mjs·공식 TensorFlow LICENSE, blur-real.html/mjs 및 기존 serve 허용 경로 추가. actual source: NSFWJS v4.2.1 npm의 InceptionV3/MobileNetV2 JSON·가중치, TensorFlow.js4.22.0/esbuild0.25.10. pnpm11.25.0 --ignore-scripts, user 승인 다운로드. TensorFlow LICENSE는 사용자가 설명 후 재승인하여 공식 tfjs-v4.22.0/LICENSE 원문을 보관했다.
- build는 package 내 base64 가중치를 binary로 추출하고 모델 JSON/spec·runtime·라이선스 파일 SHA256/byte수·출처를 manifest에 기록. 현재 산출물26,308,518 bytes, manifest digest 4d766c05e629fbeecfe531d2325d89b597b74aa6f33fa2ba9e788b19f597e1e8. worker는 manifest+모델 file digest/길이 확인 후 로딩. runtime hash는 빌드 기록으로만 쓰며 생산 capability/서명 검증을 대신하지 않는다. binaries/node_modules/store는 ignored build/node_modules에만 존재. tracked lockfile과 빌드 스크립트로 재현한다.
- actual pipeline: 로컬 img→최대512 canvas→동일 컴퓨터 Worker로 픽셀 transfer→InceptionV3(299)→MobileNetV2(224). pinned NSFWJS의 RGB/255·bilinear alignCorners 및 class순서 재사용. HIGH .50 초기 설계값·각 모델의 Porn+Hentai+Sexy 합이 .50 이상이면 가리는 OR는 독립 시험 후보다. 2026-11-02 사용자 요청으로 Sexy도 .50 기준에 포함. 정확도/성능/합성 최종승인 전 product_activation:false. 모델준비120초/추론30초·표시35초는 로컬 실험값. abort는 해당 결과를 버리고 underlying commit/kernel 종료를 추정하지 않음. 사용자 화면 최대20파일/파일20MB, 로컬 objectURL만 사용·업로드/픽셀 로그 없음.
- 중단 직전 smoke 로그는 비어 있어 실행 완료로 재사용하지 않았다. 재개 후 worker까지 context route로 격리해 실행. 최초 actual 모델 준비 후 추론 FAIL(blur-real-smoke-resume.log/diagnostic.log): Uint8ClampedArray가 TFJS worker PixelData의 Uint8Array 검사와 맞지 않음. pinned TFJS 실제 소스 대조 뒤 Uint8Array로 수정. Node 단위1FAIL은 Worker 없는 환경의 기본 인수 평가였고 globalThis.Worker 경계로 수정했다.
- 수정 후 실제 가중치+합성 단색 픽셀 inference 1/1 PASS, client수명6/6 PASS. 양쪽 model 5score/sum·두 회차num_tensors648 동일·release 후overlay0·허용 origin GET만 관측/업로드0. 첫 추론 stage합약955ms, 재실행약220ms는 격리 소표본이며 실제20개 p95/추가200MiB 목표 PASS나 정확도 근거가 아니다. smoke 안의 manifest/weight corruption은 hash mismatch로 모델준비 거절을 확인했다.
- 최종 직접 관련28/28 PASS(실제가중치1+client6+표시15+계약6), fail/skip0. log extension/build/blur-final-validation.log. Node24.22.1·설치WindowsChrome headless/Playwright. full Content·실제 MV3/사이트·Core/Server·정답라벨 정확도/CORS제품지원·성능목표 수용 NOT_RUN. build·신규구문·git diff --check PASS. 앞선 기존 browser29는 source불변 회귀 근거로 재사용, 이번28과 중복 합산하지 않는다.
- 실행: 기존 runtime Node로 content-tools/blur-model/build.mjs, 기존 PLAYWRIGHT_MODULE/CHROME_EXECUTABLE 환경에서 node --test extension/content-tests/blur-real-browser.test.mjs extension/content-tests/blur-classifier.test.mjs extension/content-tests/blur-session-browser.test.mjs contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs. 사용자: 기존 serve 중지/재시작→http://127.0.0.1:4178/content-tools/blur-real.html→실제모델준비→로컬사진선택→분석/가림·보기/재가림·해제. 새 사용자 실제모델 시험 결과는 아직 없음.
- 남은 범위: 실제 사진 정답셋 오탐/미탐·두단계결합 기준/라이선스 및 artifact 제품승인·20개 성능/메모리, extension/bootstrap·issued/native/영속의무/ACK·cleanup lease·사이트/CORS 지원/실제통합. Core·공용계약/기존16옵션/legacy ImageBlur 변경 없음. Commit/Push/PR/Approve/Merge 미수행. MVP_FINAL_COMPLETE=false.

## 2026-11-02 독립 블러 표시·복원 부품
- 담당 채지민 / codex/content-image-blur / 시작 #87 2704148b9d6036a16d1ba2083ffe43ae14580744. #97과 분리, root OPTION-11/통합현황·image-filter-demo 및 다른 worktree 보존. 기존 ImageBlur/ClaimLedger/IG04·16옵션·Core/Server/Wire는 변경하지 않는다.
- 기준: AGENTS.md·개발운영·통합현황·본 카드·docs/design/00_문서안내.md, additional-mvp-contracts/05_Content_Event_UI.md C08·schema BlurConfig, AC-OPTION-11-01~03/BOUND-10. HIGH 고정·이미지/profile 결속·stale 폐기·실패 가림·외부 전송 없음. 실제 모델의 InceptionV3→MobileNetV2 방향과 검증 전 profile 활성화 금지는 유지한다. 미게시 demo의 가변 민감도/단일 모델을 현행 계약으로 승격하지 않는다.
- extension/content/blur-session.mjs: 독립 backdrop 레이어로 img 원래 filter/display/inert와 다른 owner 원장을 수정하지 않는다. canvas 픽셀 최대512·동시1·대상128·timeout3000ms는 내부 시험 후보이며 제품 profile 승인값이 아니다. canApply 기본false·HIGH profile 복사·hash 응답 대조, 현재문서/URL·이미지별 비동기 결과 검사, 실패 가림/retry·보기/재가림·src/srcset/sizes 및 치수 변경 초기화·스크롤/리사이즈 위치 갱신. 해제 재진입/foreign cover/제거 실패 의무를 보존하고 자기 레이어만 회수한다. legacy ImageBlur의 표시·canvas 원칙 참고, 기존 MEDIUM 동작 불변.
- SAFE/SENSITIVE는 내부 provider 시험 분기이며 ContentResult/EffectEvidence·모델검증/권한·영속 ACK가 아니다. 잘못된 hash/timeout/CORS·픽셀 접근 실패는 FAILED 가림. 실제 모델 provider·버전/체크섬/라이선스/정확도 검증은 미완료다. 영상/canvas/CSS배경/closed shadow/이미지 proxy 확대 없음. backdrop 레이어 겹침·클리핑·top-layer dialog·실제 사이트는 제품 검증 대상이다. SAFE의 원래 클릭은 유지하고 민감 이미지는 보기/재가림 클릭으로 사용한다.
- 기존 serve.mjs 허용 경로에 blur.html/mjs 추가. http://127.0.0.1:4178/content-tools/blur.html 은 canvas 생성 이미지·고정 fixture 분류를 쓰며 실제 AI/확장/Core/Server 시험이 아니다. 외부 모델 다운로드·이미지 업로드 없음. 기존 시험 확장 대신 로컬 화면에서 확인한다.
- 설치 Windows Chrome headless/Node24/Playwright 합성 DOM: 신규15+기존 browser29+계약6=50/50 PASS(최종 종료 flag 보완 전), 최종 영향 회귀 재실행 예정. 원래 흑백filter/보기재가림·SAFE클릭·wrong/missing profile·이미지교체/old결과·late완료·다중owner·create 권한회수/release·append 재진입/제거실패retry·foreign cover·timeout/capacity·동적이미지·기본거절·retry·pagehide·시험화면 모의분기를 포함한다. 전체 Content·제품 수용 NOT_RUN.
- 최종 종료 flag 보완 후 신규15/15 재실행 PASS. 기존29/계약6 소스 불변으로 직전 근거 재사용. build·신규module/시험화면 구문·diff PASS. 서버 기동 로그 확인했으나 로컬 HTTP 점검은 샌드박스 소켓 차단 및 외부 실행 timeout으로 미확인이다. 명령: 기존 PLAYWRIGHT_MODULE/CHROME_EXECUTABLE 환경에서 node --test extension/content-tests/blur-session-browser.test.mjs extension/content-tests/browser.test.mjs contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs. 사용자 시험 대기. Commit/Push/PR/Approve/Merge 미수행. 실제 issued/native/frozen·영속의무/ACK·cleanup lease·Core/Server·모델 활성화 미연결. MVP_FINAL_COMPLETE=false.

# OPTION-11 · 민감 이미지 블러

단계: 추가 MVP · 설계 담당 영역: Web·Server·Extension

## 작업 상태

- 상태: 진행 중 (Content 독립 구현 검토 대기; 실제 연결·검증 미완료)
- 실제 담당자: 채지민 — Content Control 부분 (Web/Server/Core 기존 담당·이력 유지)
- 브랜치 / 시작 기준 커밋: feature/content-control / 90ad32be5d282f3b44c917a29e156dffc5e29187
- PR: 이번 중간 공유 요청은 기능 브랜치 Commit·Push까지; PR 생성·develop 병합 미수행
- 선행 작업 / 차단 조건:

| 영역 | 담당 | 구현 상태 | 검증 상태 |
|---|---|---|---|
| Web | | 미확인 | 미실행 |
| Server | | 미확인 | 미실행 |
| Extension | 채지민(Content Control 부분) / Core 별도 | 독립 부분 구현, 제품 연결 미완료 | 합성 부분 검증, 실제 미검증 |

해당하지 않는 영역은 관련 명세 근거와 함께 해당없음으로 표시한다.

## 설계 참조

- 화면: BLUR-01
- 흐름: TF-A06
- API: API-POLICY-01, API-POLICY-02, API-CAP-01
- 데이터: content_policies, model_profiles
- 회원: 회원 Web·Extension
- 비회원: Extension 로컬
- 로컬: EXT 로컬 동일 검증/owner별 저장

원문: [화면](../../design/01_UX_기능설계/02_IA_화면명세.md) · [동작](../../design/01_UX_기능설계/03_동작규칙.md) · [API](../../design/02_시스템_테크설계/04_API_연동.md) · [데이터](../../design/02_시스템_테크설계/05_데이터_복구.md) · [검증 기준](../../design/04_검수_예시데이터/07_검증기준.md)

## 설계와 구현 대응

| 기준 ID | 기대 결과(기존 설계) | 코드 위치 | 검증 명령·환경 | 결과 |
|---|---|---|---|---|
| AC-OPTION-11-01 | 분류에 따라 블러, 클릭 보기·재클릭 가림 | | | 미실행 |
| AC-OPTION-11-02 | 분석 실패는 실패 가림 상태, 안전 판정 아님 | | | 미실행 |
| AC-OPTION-11-03 | 이미지 교체 시 보기 상태 초기화, 원본 외부 전송 없음 | | | 미실행 |

기존 수용 기준은 출발점이다. 상세 명세의 실제 입력·출력·오류를 검증하며 이 표의 존재만으로 충분한 테스트라고 판단하지 않는다. 관련 BOUND 사례도 선택하여 아래에 기록한다.

## 추가·통합 검증

| BOUND 또는 추가 기준 | 실행 방법 | 결과 | 증거 |
|---|---|---|---|
| | | 미실행 | |

## 중단·재개 기록

- 마지막 작업:
- 완료한 부분:
- 변경 파일 / 실행 방법:
- 미완료·오류·설계 충돌:
- 다음 행동:

## 완료 판정

- 관련 설계 항목 구현:
- 수용 기준 및 관련 경계 사례 검증:
- 실제 연동 확인 (모의 응답 제외):
- 검토·통합 근거:
- 남은 문제:

## 2026-10-10 Content Control 경계 확인

채지민(Content Control), feature/content-control, 기준 90ad32be5d282f3b44c917a29e156dffc5e29187. 사용자 기존 역할 확인·현행 D-06 근거. Core의 목록 확보/검증/보관·DNR·세션·전송은 제외한다.

현재 차단: OPTION-10은 검증된 Catalog 공급/보관 경로와 Content 연결 세부 계약이 필요하다. OPTION-11은 확장에 고정 포함할 버전·체크섬·라이선스가 있는 실제 학습 모델/가중치가 없다. 임의 목록·모의 분류기를 제품에 넣지 않는다. 독립 감지/표시 코드도 실제 자원과의 결합 검증 전에는 지원완료로 표시할 수 없다.

현재 상태: Content 부분 선행 대기. 다른 담당 상태는 유지. 다음 행동: 목록/모델 제공 경로·아티팩트 및 D-06 계약 확인 후 이 카드의 AC·BOUND로 구현/검증 재개. Windows/실제 서비스/Core/Server/리뷰/develop 통합 모두 이번 Content 기준 미검증.

### 독립 표시 처리 착수

위 모델 선행 대기는 실제 분류/제품 활성화에 적용한다. 가림·보기/재가림·교체·해제·비동기 취소는 모델과 분리해 구현한다. classify 함수 주입은 테스트에만 모의 분류기로 사용하며 제품 모델을 대체하지 않는다. AC-OPTION-11-01~03/BOUND-10 부분 검증 대상. 채지민 Content Control 시작 기록(기준/브랜치 동일).

## 2026-10-10 Content Control 검증·재개 기록

- 코드: extension/content/image-blur.mjs (표시 파이프라인; 학습 모델 없음). 테스트: extension/content-tests/*.test.mjs.
- 실행 주체·환경: Codex / Windows / Node24.19.0 / 설치 Chrome154.0.8037.98(headless), Playwright 합성 DOM/정책. 이미지 분류는 모의. 사용자 실행은 OPTION-09 합성 도구에 한정(아래 최신 기록 참조).
- 최종 자동 검증: 29/29 PASS, 실패/skip0. 독립 감지·제어·복원 부분만 검증. EVENT 집계·전송, 실제 서비스/Extension/Core/Server/학습 모델·브라우저 재시작은 미검증.
- AC·BOUND 대응/명령/초기 실패 및 수정: [상세 기록](../Content_Control_2026-10-10.md)의 기능별 표·코드 대응·실행 결과 참조. 이 카드의 기존 AC 표는 전체 기준이므로 미실행 상태를 전체 PASS로 올리지 않음.
- 남은 기능·의존: D-06 메시지/공통 탐색/이벤트 확정 시점, Core manifest·고정 정책 주입·소유검증·결과/전송 연결. OPTION-10 목록·OPTION-11 실제 고정 모델 자원 필요. Instagram 추천/모달 DOM 실증 필요.
- 다음 행동: [연결 제안](../Content_Core_D06_연결제안.md) 팀 검토, [Windows 절차](../Content_Control_Windows_검증.md) 실행 결과 반영. 실제 통합·팀 리뷰·develop 병합은 미완료.
- 완료 판정: Content 독립 부분 구현만 검토 가능. 기능 전체 검증완료 아님. Git/PR 최종 상태는 상세 기록의 게시 기록 참조.

- 이전 게시 시도의 Git 상태: Commit/Push 실행이 권한 요청에서 거부돼 프로세스 미시작. HEAD90ad32b·staged0, 변경은 로컬 보존. PR 생성/리뷰/통합 미수행. 상세 게시 보류·재개 기록 참조.

### 2026-10-10 중간 게시 완료

구현3d7bff718e756cedb0950858885edbb6f472ea68를 feature/content-control로 Push하고 원격SHA 일치를 확인했다. 이전 게시/작성자 차단 해소(사용자 지정 local Git 작성자 적용). PR/리뷰/develop병합 미수행. 자동29/29 PASS·사용자 OPTION-09 부분 확인은 상세 기록과 동일하며 실제 서비스/Core/Server·목록/모델·복구 미검증 유지. 오늘은 중간 공유로 종료, 다음은 D-06 연결 제안 팀 검토→세부계약 합의→Core 연결/실제 Chrome 검증. 최신 게시/재개 원본은 Content_Control_2026-10-10.md 참조.

## 2026-11-02 Sexy 판정 보완
- 사용자 실사진 점수에서 Sexy 0.96/0.999인데 SAFE로 풀린 사례 확인. 사용자 요청으로 로컬 실험 판정에 Sexy >= .50 포함, Porn/Hentai 기존 경계 유지. 일반 Neutral 예제는 SAFE 유지. 모델 가중치·클릭 보기/재가림·해제·Core 연결 상태 불변. 공유 제품 활성화/정확도 검증 완료 아님.
- 판정 helper를 실제 Worker에서 재사용하고 보고 점수 재현·threshold·잘못된 출력 거절 시험 추가. 실제 개인 사진 파일은 저장하지 않음.
- 검증: 변경 후 판정3·client6·session15·실제 모델 합성픽셀 smoke1 = 25/25 PASS, fail/skip0. 모델 파일 무결성 거절·실제 두 모델 추론·해제·반복 tensor 보존 포함. 로그 extension/build/blur-sexy-validation.log. 모델 정확도·실사진 재확인은 별도 사용자 시험 대기. Commit/Push/CI 없음.

## 2026-11-02 실제 사이트 독립 확장 시험 경로
- 채지민 / codex/content-image-blur / 시작 #87 2704148b, 기존 미커밋 블러 작업에서 계속. 실제 사이트 검증 전 게시하지 않겠다는 사용자 지시로 별도 TEST 전용 MV3 확장 구성. 기존 chrome-harness/제품 Core/다른 옵션 미변경.
- content-tools/blur-site/ + build-blur-site.mjs: YouTube·Instagram top-frame isolated content caller → 자체 runtime message → Worker → offscreen document → packaged 실제 두 모델. 모델 가중치 CDN 다운로드 없음. 이미지는 ytimg/ggpht/cdninstagram/fbcdn HTTPS allowlist에서 credentials:omit·redirect:error·15초·20MB로 추가 다운로드, 이미지 원본 업로드/URL·사진·계정 로그 저장 없음. 모델 결과는 로컬 메모리 숫자만 유지.
- blur-session은 선택적 classifyImage/selectImage seam 추가, 기존 canvas 경로 보존. 80px 이상·화면 근처 정지 이미지, 최대128개. 스크롤·동적 이미지 관찰, source·권한·해제 후 늦은 응답 거절. 영상 프레임·작은 아이콘·지원 밖 CDN은 수용 범위 아님. 실패는 FAILED 가림 유지, SAFE로 보정 안 함. SPA 문서 범위 변경/새로고침 후 자동 재승인 없음; 해제→재적용. Core/Server 연결·영속 ACK·제품 활성화 미수행.
- 초기 bridge 시험은 IMAGE_ANALYSIS_FAILED로 실패. 합성 입력 PNG를 canvas 생성의 유효 PNG로 교체 후 실제 모델 2개 추론 성공; 테스트 HTTP 환경에는 CDN CORS 응답 명시. 이는 실제 사이트/네트워크 권한 성공으로 확대하지 않음.
- 직접 영향 검증: source allowlist·확장 offscreen 모듈/실제 모델을 브라우저 HTTP fixture에서 조합 2, 표시17(새 download-failure/선택/late release 2 포함), 판정3, classifier6, 기존 계약6 = 34/34 PASS fail/skip0. chrome.runtime 송수신은 시험 stub이므로 실제 MV3·offscreen 생명주기·사이트 CORS·서비스 DOM/속도는 사용자 Chrome 설치 시험 대기. 로그 extension/build/blur-site-validation-fixed.log. 모델 정확도/성능 목표 NOT_RUN.
- 빌드: node extension/content-tools/build-blur-site.mjs → extension/build/blur-site-harness/. Chrome 압축해제 로드, 이름 FOCURVE 실제 사이트 블러 시험 — Core 미연결 0.2.0. 기존 시험 확장 끄고 탭 새로고침 후 모델준비→적용. 원격 Commit/Push/CI 없음, MVP_FINAL_COMPLETE=false.

## 2026-11-02 전체 일반 웹페이지·분산 점수 누락 보완
- 사용자 요청으로 독립 시험 확장 0.3.0의 host/content match를 http://*/*·https://*/*로 확장. 자동 제품 정책 활성화가 아니며 탭마다 직접 적용. Chrome 내부/웹스토어·다른 frame·영상/canvas/CSS배경은 미지원. 이미지 출처는 일반 HTTP(S), 인증정보 포함 URL·특권 scheme 거절. 읽기 가능한 same-origin/data/blob 이미지는 현재 픽셀을 확장 내부로만 전달; CORS로 읽기 불가 시 원본 HTTP(S)를 credentials omit·redirect error·시간/크기 한도하에 다시 받는다. 실패는 FAILED 유지, SAFE 보정 없음.
- 모델 가중치 그대로, Porn/Hentai/Sexy 중 최고값만 비교하던 판정에서 동일 모델의 세 상호 배타적 분류 점수 합으로 변경. HIGH .50 유지·두 모델 중 하나가 넘으면 가림. 예 .26 Sexy+.25 Porn는 이전 SAFE→후보 SENSITIVE. 개별 점수 .50 이상은 모두 기존대로 차단. 실사진 precision/recall 향상 입증 아님; 민감도 보완 실험 후보, productActivated/coreConnected=false 유지.
- blur-real 로컬 화면 사진별 정답 선택과 메모리 내 TP/TN/FP/FN·precision/recall/accuracy 비교 추가. 정답 없는 표본의 지표 null, 실패/미분석은 SAFE로 계산하지 않고 labeled_pending_or_failed 구분. 같은 파일 retry는 결과 중복 집계 안 함, 이전 실행/해제 뒤 늦은 결과는 집계 차단. 이미지·정답·URL 영속 저장·외부 업로드 없음.
- 새 산출물 manifest 4d766c05e629fbeecfe531d2325d89b597b74aa6f33fa2ba9e788b19f597e1e8, 26,308,518 bytes. 기존 manifest c07de256은 이전 최고값 판정 후보 이력이며 서로 섞어서 검증하지 않는다.
- 확인 방법: 기존 압축해제 시험 확장 새로고침→이름 전체 웹 이미지 블러 시험 0.3.0 확인→일반 사이트 탭 새로고침→모델 준비·적용→일반/민감·다른 도메인 이미지·data/blob·스크롤·교체·보기재가림·해제 확인. 로컬 blur-real 화면 Ctrl+F5 후 대표 정답 셋 비교. 모델 정확도/오탐·미탐 최종 목표·실제 MV3 다사이트 수용은 대기. Git 게시 없음, MVP_FINAL_COMPLETE=false.
- 검증 완료: 전체 직접 영향 38/38 PASS(fail/skip0, 계약6 포함), 최종 로컬 평가 UI·늦은 결과 차단/미분석 집계 보완 후 해당 평가2+실제모델 UI1 재실행 3/3 PASS. 중복 합산하지 않음. 실제 모델 manifest/가중치 무결성·실제 두 모델 추론·픽셀/HTTP원본 경로·반복 tensor648·해제·숫자 정답 집계 확인. 로그 blur-all-web-validation.log·blur-all-web-evaluation-final.log. Chrome API는 stub이므로 실제 확장 설치/일반 사이트 사용자 수용 대기. build·구문·diff PASS. Commit/Push/CI 미수행.

## 2026-11-02 사용자 실제 사이트 지연 보고·부하 완화 0.3.1
- 사용자 일반 웹 동작 정상 및 로컬 실행 심한 지연 보고로 성능 경로 보완. 판정/모델 가중치/profile hash·실제 Core/Server 연결 불변, root·타 worktree·다른 옵션 보존. 모델 준비 자체와 실제 PC GPU 자원 경쟁이 모두 해결됐다고 판정하지 않음.
- BlurSession: DOM 감시120ms 묶음·scroll/resize 위치 갱신rAF1회·같은 style값 재쓰기 방지·자체cover 변경 감시 제외·뷰포트 밖 cover 비표시·불투명 대기/실패에 backdrop blur 비활성화. 해제 시 timer/rAF 취소. canAnalyze로 비활성 탭/스크롤 중 새 분석 대기; 기존 PENDING은 SAFE가 아님. 스크롤 정지200ms 이후 재개, 다른 추론 중 다시 보인 기존 PENDING이 누락되지 않게 후속 scan 예약.
- 실제 사이트 caller는 화면 안 img만 처리, 기존1MB급 RGBA JS 숫자 배열 대신 canvas.toBlob 무손실 PNG 비동기 인코딩→extension 내부 전달. 원본픽셀 변화/외부 업로드 없음. 기존 URL/readable-pixel 실패 규칙 유지. offscreen은 같은 profile+실제 resize 픽셀 SHA256+치수의 성공 숫자 결과만64개/5분 LRU로 재사용. 원본사진·URL 캐시/영속 저장 없음. 실패는 cache 안 함, 두 모델/임계값 불변, cache miss 추론 사이 최소150ms 여유.
- 수정 전 ignored snapshot blur-session-before-performance.mjs와 동일40이미지/100 scroll event 합성비교: 전체 img scan10→2회. 이는 렉/CPU가80% 개선됐다는 제품 수치가 아님. style mutation은 전후0(Chrome이 동일선언 변화 억제), 호출·scan 작업 감소와 구분 기록. 실제 PC GPU/frame 성능·속도/메모리 수용 NOT_RUN.
- 최종 영향 시험23/23(표시20+DOM성능1+cache단위2), 실제 두 모델 bridge·PNG/원본pixel 동일결과/cache hit·부정입력·기존판정/client/계약18/18 = 독립41/41 PASS fail/skip0. Chrome runtime은 fixture stub, 실제 모델/브라우저 DOM 실행. 로그 blur-performance-final.log·blur-performance-model.log, 초기22시험 로그는 후속 PENDING 보강 전 이력. build·구문/diff PASS, 정확HEAD CI 없음. 0.3.1 시험확장 새로고침·사이트 탭 새로고침 후 실제 사용자 체감 재확인 대기. Commit/Push 없음, MVP_FINAL_COMPLETE=false.

## 2026-11-02 일반 썸네일 오탐 보고·개별 이미지 진단 0.3.2
- 사용자: 성능 완화 체감 확인, 일반 YouTube 썸네일 오차단/분류 정확도 불만. 전체 결과에서 특정 썸네일을 찾아 상태 복사하는 방식은 사용자가 대응 불가하다고 지적. 판정 기준을 또 임의로 바꾸지 않고 개별 대상-결과 결속 경로를 먼저 보완.
- popup 이미지 하나 판정 확인→팝업 닫고 해당 썸네일 클릭→그 이미지 결과창/복사. WeakMap으로 실제 Element+src/currentSrc/srcset/sizes/자연치수와 model결과 결속, source변경/abort 시 stale결과 기록 차단. 선택 클릭은 보기/링크로 전파하지 않음. pagehide/release 후 대기 선택callback 차단, 진단 안내창도 해제·실패 의무 추적.
- 현재 실제 두 모델 점수·민감 합·cache/backend와 local_state 제공. FAILED 가림을 민감 판정으로 오인하지 않도록 이유 별도 표시. 모델2개 합의 후보의 비교값만 추가하고 candidate_activated:false; 실제 OR/.50 판정/모델/profile/성능부품 불변. 이미지 URL·token·본문·실제사진은 진단 복사에 포함하지 않음. 전체 계약·Core 연결 변경 없음.
- 집중 진단3(개별모델불일치/URL비노출·실패/미완료/stale·실제covered이미지2개 클릭 매핑 및 blur유지/해제) + 표시20 + 계약6 = 29/29 PASS fail/skip0, 로그 blur-diagnostics-validation.log. Chrome runtime/분류응답은 모의, 실제 DOM/선택/복사화면 조립 검증. 모델·실제사이트 정답셋 정확도 상승 근거 아님. 0.3.2 build·구문/diff PASS. 사용자 개별 일반 썸네일 결과 대기. Commit/Push/CI 없음, MVP_FINAL_COMPLETE=false.

## 2026-11-02 일반 썸네일 실제 오탐 점수 반영·0.3.3 후보
- 사용자 제공 일반 썸네일2건: 민감합 .7037165/.5158083, .7028641/.4560528. 마지막 점수 반복은 같은 사례로 구분하고 독립3건으로 세지 않음. 이미지/URL/계정/제목은 저장하지 않고 회귀에 민감 분류 점수만 사용. 실패 가림이 아닌 실제 SENSITIVE 오탐임을 local_state/status로 확인.
- 기존 OR/.50에서는 둘 다 차단. 양 모델 .50 합의만으로는 첫 사례가 남음. 독립 실험 후보를 양 모델 모두 Porn+Hentai+Sexy >= .80으로 변경. 두 사용자 오탐 점수는 비차단, 이전 강한 Sexy 예시 양모델 .99는 차단, Neutral .99는 비차단. 이는 작은 보고 표본의 재현이지 대표 정확도 상승/제품 수용 아님. .80은 학습된/보정된 수치가 아니며 실제 민감 이미지 미탐 가능성 존재.
- manifest/worker/helper/profile/선택진단/로컬화면 규칙을 함께 갱신. 새 profile LOCAL_NSFWJS_421_PRECISION_CANDIDATE, hash 04540d4740236df6e739e1f4643a9d6e5bfb0020854fe66b21588858fdc09b51. old 4d766c05 profile의 오탐 결과와 구분, cache key는 profile hash 포함하여 이전 판정 혼용하지 않음. 가중치/두 모델/로컬 처리/실패 가림/성능 최적화/기존 표시복원 불변. 공유 제품 HIGH 기준·Core 연결/활성화 변경 없음.
- 진단은 현재 BOTH_MODELS/.80 및 previous_rule_verdict를 구분, experimental_profile:true. 실제 사이트 재시험은 0.3.3 확장+탭 새로고침 후 기존 두 썸네일·새 일반/민감 이미지·보기재가림/해제 확인. Commit/Push 없음, MVP_FINAL_COMPLETE=false.
- 최종 검증: 판정5(사용자 오탐2건·이전 민감/일반 점수·양모델/경계/오류 포함)·진단3·실제 모델 bridge2·계약6 = 16/16 PASS fail/skip0. 로그 blur-precision-validation.log. 실제 가중치·PNG/픽셀/원본URL 경로·profile 캐시 격리·부정입력 거절 및 선택 매핑 확인, runtime 권한은 fixture stub. 표시·성능 부품 소스 동일이므로 기존 회귀 근거 재사용. 사용자 실사이트 정확도·정답셋 평가는 대기. build·diff PASS, CI 미실행.

## 2026-11-02 모델 준비 UI 재사용 및 사용자 75% 지정·0.3.5
- 사용자가 매 페이지 모델 준비 버튼을 눌러야 한다고 보고. 실제 LocalBlurClassifier.load는 이미 ready면 재사용하므로 반복 추론 실패/재다운로드로 오해하지 않음. 팝업이 새로 열릴 때 apply.disabled가 초기화되는 UI 문제를 수정: MODEL_STATE는 현재 offscreen/client 실제 ready/loading/closed를 읽기만 하며 offscreen 없는 조회로 모델을 생성하지 않는다. 준비 중 재개 polling, 늦은 상태 응답이 직접 준비 결과를 덮지 않도록 epoch 분리. closed client 준비 재시도만 새 Worker 생성. 팝업 재열기 때 준비 재호출0 추가시험, 최초준비/실제비준비/종료 상태 구분8/8 PASS.
- 제품 자동 재적용은 Core·Content 공동 경계이며 M1 BLOCKED/합의 전 착수 금지 유지. 사용자는 논의 필요한 실제 연결 작업은 일단 보류 요청. 시험판은 기존 수동 적용을 그대로 유지, 자동 권한/정책 재적용 구현하지 않음.
- 사용자 명시 요청으로 양 모델 모두 민감합 >= .80에서 >= .75로 변경. 서로의 평균이나 한 모델 기준 아님. manifest/Worker검증/helper/profile/진단/로컬 설명/회귀 기대값 동시 갱신. 두 일반 썸네일 보고 점수는 계속 비차단, 기존 강한 Sexy는 차단 유지. 모델·weights/성능부품/실패가림 불변, 대표정확도 상승 미확인.
- 새 profile hash 6c38690b0643619b657d6bca6df7bb0ca96a00a431135f931fbf299bbcdb244c, artifact 26,308,526 bytes. 기존 .80 hash04540d47은 이전 후보로 보존. profile hash가 cache key에 포함되어 이전 판정 혼용하지 않음. 0.3.5 빌드 확인.
- 직접 관련 판정5·진단3·popup상태1·client7 =16/16 PASS fail/skip0, 로그 blur-threshold75-validation.log. 모델 weights 불변, 이번 실제모델/사이트 재실행 NOT_RUN(이전 .80 실제 bridge16시험 근거와 구분). build·diff PASS. Commit/Push/CI 없음. MVP_FINAL_COMPLETE=false.

## 2026-11-02 게시 전 버그 검토·최종 독립 제출 단위
- 사용자: 75% 후보와 현재 체감 성능 수준을 유지하고 마무리, 버그 검토 후 게시 지시. 담당 채지민 / codex/content-image-blur / base #87 2704148b9d6036a16d1ba2083ffe43ae14580744. GitHub #87 head와 로컬 기준 일치 확인. 타 worktree·root 미커밋 및 기존 PR/제품 Core·Server·계약 보존.
- 게시 전 신규 반례2: timeout 후 provider signal 미취소, 페이지가 cover를 삭제하면 실제 표시가 노출되는데 상태는 SENSITIVE 유지. 수정 전 동일2 FAIL 기록 blur-review-before.log. timeout의 분석별 controller를 캡처·abort하고 retry는 새 controller로 실행, 늦은 결과/해제 이후 효과 차단 유지. 자기 document의 삭제된 cover만 재부착·재검사하고 foreign cover는 FAILED/cleanup 의무로 보존. 성공/재시도 시 이전 오류 코드 제거. 판정 .75·모델 weights/profile hash 불변.
- Content 전체 최종469/469 PASS fail/skip0(실제 모델2개/합성픽셀·사이트 relay/Chrome API stub·표시/DOM·기존 옵션·IG04 회귀 포함), 로그 blur-publication-content.log. 기존 계약6/6 별도 PASS, 기존 harness 및 model/site harness 빌드·전체관련MJS 구문·diff PASS. 이전41/16 등과 중복 합산하지 않는다.
- 기존 content-sessions workflow에 pnpm11.25.0 frozen lock/ignore scripts 모델 재현·site harness 빌드 선행단계 추가. CI가 생성물 없는 checkout에서 bridge 시험 실패하거나 실제 모델 시험을 skip하는 상태로 제출하지 않음. 원격 CI는 Push 이후 정확HEAD에서 별도 확인.
- 사용자 기본 로컬 모델/실사이트 기능 및 부하 완화 확인 보고를 기록하되, 새 .75 후보 전체 정확도/대표정답셋·모든 사이트 수용을 완료로 확대하지 않는다. 두 사용자 일반 썸네일 점수 재현/기존 강한 민감 예시는 자동회귀이며 실제 사진을 저장하지 않음.
- 제출 범위: 독립 blur 부품·고정 모델 dependency/build/license·로컬/실사이트 TEST 확장·진단·성능/오류 회귀·기존 Content CI·본카드/통합현황. 모델 binary/node_modules/build/개인사진/원본URL 제외. README는 최종 .75/현재 실행·한계·Core 인수 경계로 정리. PR은 #87 위의 Draft로 올리고 의존성을 명시, 병합은 다훈 담당. 사용자 Git 게시 승인에 따라 Commit/Push 진행, 실제 SHA/원격CI는 PR 제출 결과를 따른다.
- 제품 미완료: 실제 issued/native/frozen 정책·효과 전 영속의무/ACK·cleanup lease·결과 영속/Report·새 문서/SPA/BFCache 자동 재적용·Web 체크박스 연결·대표정확도/성능 목표. M1 BLOCKED/공동 합의 전 실제 연결 보류. 독립 제출은 완료 단위, OPTION-11 전체 제품 수용은 미완료. MVP_FINAL_COMPLETE=false.
