# AMVP-CONTENT-06 · 추가 Content 연결

담당: 채지민. 브랜치: feature/additional-mvp-content.
시작 기준: e2b3fc318fe52acc45145a30def07b874b2255f6 (PR24 병합).
상태: 진행 중. 전체 16옵션/제품 연결 완료 아님.

## 기준과 경계

- 확정 AMVP-CONTRACT-20261029-RC2의 03_Wire_D06_복원.md, 05_Content_Event_UI.md, 06_인계_승인.md, feature-registry.json·Schema의 FEATURE/CONTENT_POLICY 증거 원문을 재사용한다.
- 기존 Shorts 안정화는 김다훈 담당을 유지한다. legacy Changes/Shorts/controller와 Core의 registry·DNR·sender 구현을 수정하지 않는다.
- 원래 작업 폴더 feature/content-control의 OPTION-11/통합현황 및 image-filter-demo 미커밋 작업을 유지하려고 별도 worktree에서 개발한다. 기존 시험판은 제품 모델/profile로 자동 채택하지 않는다.

## 2026-10-30 · 첫 단위: 공유 DOM claim 원장

- 코드: extension/content/claim-ledger.mjs. 같은 document에서 옵션/owner별 claim으로 display/inert 및 grayscale filter를 공유한다. 마지막 owner 해제 때만 복원하며 페이지의 후속 style/inert 변경과 다른 claim을 보존한다.
- 실패한 복원은 원장에서 지우지 않는다. detached node는 소멸 성공으로 간주하지 않는다. 문서 효과를 닫은 뒤 새 적용은 거절하고 원래 문서 cleanup은 허용한다.
- 문서 로컬 primitive이며 아직 제품 receiver/실제 owner 인증/영속 Journal/receipt/미디어 제어/observer/SPA·BFCache 연결은 없다. 함수의 verified/restored는 국소 DOM 결과이고 AMVP APPLIED/RUNNING 또는 RELEASED wire 성공 응답이 아니다.
- 도구: 기존 content-tools/serve.mjs에 claims.html/claims.mjs 및 기존 controller의 의존 UI 모듈 ui/restriction.mjs 제공 경로를 추가. 합성 DOM 검사이며 원래 키워드 harness도 유지한다. 별도 모델 다운로드/제품 권한 추가 없이 확인한다.
- 실행: bundled Node24 `--test extension/content-tests/claim-ledger.test.mjs extension/content-tests/changes.test.mjs extension/content-tests/detection.test.mjs`.
- 결과: 신규9 + 관련 기존4 = 13/13 PASS (Node 단위/합성 요소). 실제 CSS 엔진·제품 Chrome·16옵션·Core·Server·미디어/오디오·모델 검증과 구분한다.
- 전체 관련 회귀: 설치 Chrome headless + Playwright 합성 DOM으로 기존33 + 신규 단위9 + 신규 브라우저4 = 46/46 PASS, 실패/skip0. 명령은 아래 게시 범위 재현 절차 참조. 기존 테스트가 UI 의존 모듈을 HTML로 응답해 29개 import 실패했던 원인을 시험 라우팅의 정확한 UI 경로 추가로 수정한 뒤 통과했다. 제품 Shorts 코드는 변경하지 않았다.
- 사용자 실행 결과: 2026-10-30 claims.html의 체크 1~5 모두 문제없다고 보고. 다른 제한 유지, 마지막 제한 해제/일반 버튼 복원, 가리기·흑백 분리, 흑백 해제/밝기 복원, 페이지 flex 변경 보존을 정상 확인했다고 기록한다. 사용자 보고이며 영상/Chrome 버전/실행 hash를 별도 수집한 증거는 아니다. 실제 YouTube·Instagram·Core 제품 통합 PASS로 확대하지 않는다.

## 첫 PR 게시 범위

- 포함: claim-ledger.mjs, claim-ledger 단위/브라우저 시험, claims.html/mjs, 기존 시험의 UI 의존 경로 보완, serve 경로, 이 카드. 기존 16옵션/전체 Core 연결 완료가 아니라 내부 공통 부품의 조기 리뷰다.
- 제외: watch-panels.mjs, watch-panels-browser.test.mjs, 댓글·추천용 build-chrome-harness/bootstrap/popup/manifest 변경. 이들은 로컬 후속 작업이며 이번 Commit/Push/PR에 포함하지 않는다.
- 게시 대상: feature/additional-mvp-content → integration/additional-mvp-20261029. develop 병합·자동병합 없음. 공유 계약/API/Schema·기존 정책·제품 listener를 바꾸지 않는다.
- 상태: 사용자 시험 완료 후 공통 제한·복원 부품만 먼저 게시하라는 지시로 Commit/Push/PR 준비. 실제 게시 SHA·PR 링크는 GitHub 결과가 원본이다.

### 게시 부품만 재현

1. Node24와 Playwright 모듈·설치 Chrome 경로를 준비하고 PLAYWRIGHT_MODULE/CHROME_EXECUTABLE 환경변수를 설정한다. 별도 제품 설치/실제 계정·네트워크가 아닌 합성 DOM 시험이다.
2. `node --test extension/content-tests/changes.test.mjs extension/content-tests/detection.test.mjs extension/content-tests/browser.test.mjs extension/content-tests/claim-ledger.test.mjs extension/content-tests/claim-ledger-browser.test.mjs` → 46건. 아직 로컬인 watch-panels 시험은 이 명령에 포함하지 않는다.
3. `node extension/content-tools/serve.mjs` → http://127.0.0.1:4178/content-tools/claims.html. A/B는 시험용 claim 이름이며 제품 기능명이 아니다. 가리기/흑백/페이지 변경을 확인하고 5개 체크박스로 사용자 결과를 남긴다. 복원 실패 재시도는 자동 단위시험에서 검사한다.

### 미검증·통합 경계

실제 native sender/owner 인증, Core 영속 intent·receipt/QUERY·실제 세션 종료와 이 원장의 결속, 모든 16개 옵션, 실제 서비스 selector, 실제 BFCache/재시작·미디어/오디오/모델·Server 연동은 이 부품 PR에서 미검증이다. 이 클래스는 자체로 정책을 선택하거나 frozen Snapshot을 발급하지 않고, trusted caller의 document-local DOM 제어/복원만 제공한다. `suspend()`는 새 효과를 막는 내부 primitive이며 실제 lifecycle 승인이나 GONE 증거가 아니다.

## 다음 작은 연결

1. 같은 shared ledger에 별도 YT/IG option adapter와 per-option 관찰/해제 자원 연결.
2. issued registry·frozen attachment·native scope를 제공하는 Core simulator 경계에서 exact 결과 집합/실패/cleanup 연결. 공유 Wire를 임의 수정하지 않는다.
3. 실제 페이지별 selector/profile·동적 재등장·SPA/BFCache/미디어·실패 복원 검증. 운영 listener/주입·claim 영속화는 Core 담당과 승인 계약 기준으로 연결한다.
4. 검증 가능한 단위별 사용자 시험 후 feature/additional-mvp-content를 Push하고 integration/additional-mvp-20261029 대상 PR. develop 병합 없음.
