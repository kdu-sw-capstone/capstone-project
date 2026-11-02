# OPTION-11 로컬 이미지 블러 · 독립 구현 인계

## 현재 범위

- `extension/content/blur-session.mjs`: DOM 이미지 가림·클릭 보기/재가림·해제·동적 이미지·교체 결과 폐기·실패/cleanup 추적. 원래 이미지 선언과 다른 owner의 효과를 수정하지 않는 별도 가림 레이어다.
- `extension/content/blur-classifier.mjs`: 패키지에 포함된 실제 두 모델 Worker의 준비·재사용·시간 제한·취소/종료 처리.
- `blur.html`: 모의 판정 시험. `blur-real.html`: 사용자 로컬 파일을 실제 모델로 분석하고 정답 라벨과 오탐/미탐을 비교하는 시험.
- `blur-site-harness`: 일반 HTTP·HTTPS 페이지에 사용자가 직접 적용하는 시험 전용 MV3 확장. 제품 Core·Server·권한·영속 예약과 연결되지 않았다.

현재 모델 후보는 **두 모델 각각의 Porn+Hentai+Sexy 합이 모두 0.75 이상일 때 가림**이다. 사용자가 지정한 독립 시험 후보이며 공유 제품 HIGH의 승인값이 아니다. 일부 일반 썸네일 오탐을 점수 재현으로 확인해 완화했으나 대표 정답셋 정확도·민감 이미지 누락률은 미검증이다. `product_activation:false`, `coreConnected:false`, `MVP_FINAL_COMPLETE=false`를 유지한다.

## 빌드·실행

저장소 루트에서 Node24와 pnpm11.25.0 사용:

```sh
pnpm --dir extension/content-tools/blur-model install --frozen-lockfile --ignore-scripts
node extension/content-tools/blur-model/build.mjs
node extension/content-tools/build-blur-site.mjs
node extension/content-tools/serve.mjs
```

- 모의 화면: http://127.0.0.1:4178/content-tools/blur.html
- 실제 로컬 파일: http://127.0.0.1:4178/content-tools/blur-real.html
- 실제 사이트: Chrome 개발자 모드 → 압축해제 확장 로드 → `extension/build/blur-site-harness/`. 기존 시험 확장은 끄고 대상 탭 새로고침 → 모델 준비 → 블러 적용. 팝업 재열기에서 준비된 모델은 재사용한다.

실제 사이트 시험은 탭마다 수동 적용한다. 문서/URL 변경·새로고침 후 자동 권한 부여나 자동 재적용을 하지 않는다. Chrome 내부 화면·웹스토어·iframe·닫힌 shadow DOM·영상 프레임·canvas·CSS 배경은 지원하지 않는다. 화면 안 80px 이상 정적 img부터 처리하며 처리 한도를 넘은 대상은 미분석 상태다. GIF는 정적 프레임만 검사한다.

## 모델·출처·무결성

- NSFWJS4.2.1 npm 내 InceptionV3(299) → MobileNetV2(224) 학습 가중치를 변경 없이 추출한다. RGB/255·resizeBilinear alignCorners=true·5개 class 순서를 재사용한다.
- NSFWJS: https://github.com/infinitered/nsfwjs/tree/v4.2.1 · MIT.
- TensorFlow.js4.22.0 · Apache-2.0, esbuild0.25.10. lockfile integrity를 보존한다.
- TensorFlow 라이선스 원문: https://raw.githubusercontent.com/tensorflow/tfjs/tfjs-v4.22.0/LICENSE (`TENSORFLOW-LICENSE.txt`). NSFWJS 라이선스는 설치 패키지에서 복사한다.
- 빌드는 모델 JSON/가중치·runtime·라이선스 SHA-256/크기/버전/분류 규칙을 manifest에 기록하고, 생성 profile에 manifest hash를 결속한다. Worker는 manifest와 모델 파일 hash/크기 확인 후 로드한다. runtime hash 기록은 실제 capability/서명을 대신하지 않는다.
- 모델 바이너리·node_modules·생성 확장은 ignored build/node_modules에만 있다. Git에는 소스·고정 lockfile·라이선스·재현 절차만 올린다. 모델은 실행 중 원격 다운로드하지 않는다.

## 데이터·실패·성능

이미지는 로컬 Worker에서만 분류하고 외부 분석 서버로 업로드하지 않는다. 사이트에서 읽을 수 있는 픽셀은 무손실 PNG로 확장 내부에 전달하며, CORS로 읽을 수 없으면 원본 HTTP(S) 주소에서 credentials omit·redirect error·15초/20MB 한도 아래 다시 받는다. 실패를 SAFE로 보정하지 않는다. 원본 URL·픽셀·파일명은 상태 복사나 로그/영속 저장에 넣지 않는다.

새 효과 권한 `canApply`는 기본 거절이며 이미지/profile/문서 수명에 묶인 결과만 표시한다. 해제는 늦은 효과를 차단하고 미정리/foreign 요소 의무를 유지한다. timeout 요청은 취소 신호를 보내되 underlying GPU kernel이 실제 종료됐다고 주장하지 않는다. 명시적 retry는 새 신호를 사용한다.

화면 우선·비활성 탭/스크롤 중 대기·120ms 묶음 검사·프레임당 위치 갱신·단일 추론·추론 사이150ms·픽셀/profile 결속 숫자 결과64개/5분 LRU를 사용한다. 실제 PC의 성능 목표 수용·대표 정확도 검증을 통과했다는 의미가 아니다.

## 확인 방법

- 일반/민감 로컬 이미지와 썸네일, 동적 추가·교체, 클릭 보기/재가림, 해제·실패 재시도를 확인한다.
- 로컬 파일 화면에서 사진별 정답을 지정하면 오탐/미탐·precision/recall을 메모리에서 비교한다. 미분석/실패는 별도 집계한다.
- 사이트 팝업의 이미지 하나 판정 확인 → 팝업을 닫고 해당 썸네일 클릭 → 선택된 이미지 결과만 복사. URL이나 실제 사진을 포함하지 않는다.
- 재현 명령: `node --test --test-concurrency=2 extension/content-tests/*.test.mjs`, `node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs`. Playwright 경로는 `PLAYWRIGHT_MODULE`, 설치 Chrome은 `CHROME_EXECUTABLE`로 지정할 수 있다. CI는 고정 dependency·모델·시험 확장을 먼저 빌드한다.
- 실제 모델 시험의 합성 픽셀·Chrome API stub·실제 DOM 검증을 실제 MV3·Core·Server 제품 수용으로 승격하지 않는다. 생성 모델이 없어서 skip된 실행은 실제 모델 PASS가 아니다.

## Core 인수 경계·미완료

실제 issued/frozen 정책·native/document 권한·효과 전 영속 의무·ACK·cleanup lease·결과 영속 기록과 보고는 미연결이다. 새 문서·SPA·BFCache에서 제품 정책을 재검증해 자동 재적용하는 경로 역시 미완료이며 공동 계약 전 구현하지 않는다. `BlurSession`의 classify/profile/canApply 연결점과 실제 모델 client는 재사용할 수 있지만 시험 caller의 `canApply:()=>true`를 생산 권한으로 사용하면 안 된다. 기존 IG04/#87·다른 owner·공용 Wire·Server를 변경하지 않았다.
