# ADDITIONAL-CONTRACT-20261029

## 현재 작업 — 3인 방향 동의 최종 후보 반영

- AMVP-CON-01, 동일 브랜치/Worktree, 시작06cebf484ffc2a94aa1c0049f4ae25d50f197b50. 담당 변경 없음, 신규 전면 검토 없음.
- 사용자 전달3인 A~D 방향 동의와 김다훈 C05/C11 명시 회신을 decision-consent.json에 출처 구분해 기록. GitHub Approve 대행 아님.
- 변경: 독립 읽기 QUERY·방향별 proof/Port·동일 frozen Attachment·provisional 예산/idle60·singleton DDL·verified source/Server mapping. 제품 소스/legacy 원문 변경0.
- 실제 package source는 runtime-server, migration V1~9 확인→V10 후보. 최신 제품 PR에서 번호 충돌 재확인 후 예약, 이번에는 numbered migration/운영 적용 없음.
- 상태: 필요한 변경 계약 시험 후 동일 SHA의 변경 부분 재확인 대기. Revision RC2 유지·REVIEW_PENDING. Merge/공유 계약 활성화 금지.
- 실행 결과: docs/design/additional-mvp-contracts/07_검증결과.md 및 decision-verification.json. 새로운 SQL54 PASS(port33337), 초기 환경 실패도 .local 보존. Chrome/Native/HTTP/장시간은NOT_RUN.
- 다음 최소 행동: 게시된 같은 SHA에서 윤종민·채지민이 QUERY/Port/frozen/C05/C11 변경 영향만 확인, 김다훈은 Server/DB/source/집계 연결 확인. 기존 수락 영역은 재사용하고 실제3인 승인 이후 계약 단계 종료 판단.
- 기존 로컬 결정 초안은 미추적 상태 그대로 보존하며 Commit 대상에서 제외. 다른 Worktree/index/Shorts/PR17·21·22 변경 없음.

- 기능: 추가 MVP 공통 계약 F01~F18, YT-01~10/IG-01~06. 기존 개인별 담당 유지.
- 계약 작성·통합 조정: 김다훈 작업 요청에 따른 Codex 기술 검토. 인간 공동 승인 대행 아님.
- 브랜치: codex/additional-mvp-contracts-20261029
- Worktree: additional-mvp-contract-review-20261029/capstone-project (기존 다른 작업본 보존용 독립 계약 검토)
- 시작 기준:9868a0f5914d7a173c102fc198a9a908b043381f / integration/additional-mvp-20261029
- Revision: AMVP-CONTRACT-20261029-RC2 후보 / REVIEW_PENDING
- 기준 설계: D01~D10, 기존 Member/Guest D06 실제 Schema, 기존 추가 설계6문서/작업카드, Figma UI_BINDINGS13구조.
- 코드/산출물: contracts/additional-mvp/rc1/, docs/design/additional-mvp-contracts/, 전용CI. 제품 코드 변경0.
- 검증: Python227(원본135/초기RC2 210 포함)/Node5/격리MySQL18 PASS. 실제Chrome/API통합/장시간 측정은NOT_RUN. 최종 수치는 실행 결과문서/PR을 따른다.
- 미해결: C01~11, FOCUS_CONTROL/coordinated actor, liveowner chain, runtime allmatching, idle 권한·URLprofile·DST·수치범위·blurprofile, 실제성능. 모두 승인대기.
- 담당별 AMVP-CON-01~AMVP-INT-10과 수용 기준: docs/design/additional-mvp-contracts/06_인계_승인.md.
- 다음 행동: 동일 head·manifest를 김다훈/윤종민/채지민이 검토하고 PR에 실제결정 기록. 승인 전 신규계약 제품활성화 금지. Codex는 자동Approve/Merge하지 않는다.
- 보존: PR17/21/22, 기존설계WT 미커밋, Shorts P0,0.1.25환경,Default/Profile2/운영DB를 건드리지 않는다.

## RC2 리뷰 수정 인계

- 시작 검토 SHA: bf62f1520ac06e5d507c54b8f06d93fdd4553ef3. 기존 Core 수정 유지, Content 추가 통합.
- Core C-01~04 + Content T-01~04 = 7개 원인. C-01/T-04 Cleanup은 null-seq 하나의 공유 lane이다.
- before11=10FAIL+1ERROR, after58=Core37+Content21 PASS. before C-03/04는 문서 규칙 모델이며 제품 실행 실패 아님.
- 변경: 계약 docs/Schema/API/예시/후보SQL/참조모델/반례/Node/Manifest, 제품0. 검증 상세는07_검증결과.md.
- 게시: 동일 RC2 head를 PR24에 정상 Commit/Push하고 윤종민·채지민 재검토 요청. 새 SHA는 PR 본문 원본, 자동Approve/Merge/제품활성화 금지.
- 미해결: 기존 C01~C11 및3인 승인, 실제 Chrome·Native·HTTP·서버 경쟁·장시간 측정. 김다훈 Web/Server/DB 검토 대기.
- 종료 인계: Core/Content 공동 수정 검증 후보 완성, 동일 SHA 재검토 대기. 다른 Worktree·미커밋·index·실패 증거·PR22 보존.

## RC2 최종 교차 검증

- 기능/기준: F01~18·원본 리뷰 Core4/Content4, 시작 SHA4309b2674a26782f4fc318477b38ce10fa2c4bc7, 동일 계약 브랜치/검토 Worktree.
- 실행: 기존210/원본135ID/Node5/격리MySQL18 재실행 PASS 후 독립9반례 실패 재현. 최소 수정 후 신규17/전체227 PASS를 확인한다. 부분집합 중복 합산 금지.
- 수정: Schema action/result·viewer 조건, 모델 Receipt/순번/boot/resolution/DNR 예산/sender, 새 반례·유효/무효 fixture·재생 도구, 문서/API 메타데이터/Manifest.
- 남음: QUERY_OPEN(target/hash/seq/응답 계약), C01~11·3인 재검토, 실제 Chrome/Native/HTTP/동시성/장시간. 기존 HUMAN APPROVAL 없음.
- 상태: 교차 검증 후보 게시·동일 SHA 재검토 대기. 새 Git SHA·CI·전체파일은 PR24 본문이 원본. 자동Approve/Merge/제품활성화 금지.

## 김다훈 Web·Server·DB 독립 검토

- 기준 SHA8f48c3b8454c74bb1f998a8f4cdacfe65785d037, 같은 계약 브랜치/검토 Worktree. Core/Content 리뷰 대기와 독립 진행, 담당 재배정 없음.
- 실제 source: backend API/auth/import/records, runtime MemberApi, 기존 추가 WT의 opt-in ConfigurationDrafts/Store/SQL·frontend API. 다른 WT는 읽기만 했고 제품 수정0.
- K01~04 P1 및 K05 P2를 반례 후 후보에서 수정. API25개·DB19개·Schema77·기존 D01~10/D06/Event/Snapshot/Journal 보존.
- 실행: Python Server11/전체238·Node5 PASS, 새 격리 MySQL46 PASS(port33334, 정상 종료). before API3 FAIL 및 SQL18 FAIL/26 PASS 보존. 수치는 부분집합 중복 합산 금지.
- 미검증: 실제 HTTP/auth/Server transaction·운영 migration·Chrome/Native·장시간. QUERY/C01~11·Content cardinality·import source adapter 합의 대기.
- 다음: 최소 변경 정상 Commit/Push 후 동일 SHA의 김다훈·윤종민·채지민 재검토. 실제 인간 승인 생성/자동Merge/활성화 금지. 최종 SHA·CI는 PR 본문 원본.
