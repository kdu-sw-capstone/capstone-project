# D-06 Core↔Content 연결 제안 — 미확정

2026-10-10 사용자 선택: **기존 Core 구현의 연결안을 먼저 문서로 제안**. 이 문서는 승인된 wire 계약이 아니며 제품에 메시지 listener/발신 코드를 추가하지 않는다.

## 확인한 현재 코드

- Core PR17 / `9b063be33635592cf48659ce07c0367930295e78`.
- `extension/background/service-worker.js`: webNavigation.onBeforeNavigate/onCommitted/onErrorOccurred→GuestSession.observe. 팝업 DEV 메시지만 처리, OBSERVE_ACCESS/FEATURE_RESULT 수신 없음.
- `background/access-store.js`: pending/commit/fail/list 및 owner/session/RUNNING/revision 확인. pending에 event_id/navigation_id를 묶고 commit에서 Event1.2 SITE 원문·access_seq/local_seq를 저장한다. 이미 저장한 ID/원문을 새로 쓰지 않는다.
- `background/host-policy.js`/session-core: Core가 most-specific 사이트를 선택하며 Content의 부모 정책 재선택은 금지. 실제 Core 변경·실행 시험은 이번 범위가 아니다.
- Content 모듈: `extension/content/controller.mjs`, `features.mjs`, `entry.mjs`, `keyword.mjs`, `adult-domain.mjs`, `image-blur.mjs`. 현재 내부 호출/상태 콜백만 있고 세션·owner 인증·저장·전송은 없다.

## 권장 연결 방향

| 처리 단계 | 제안 | 책임·합의가 필요한 내용 |
|---|---|---|
| 정책 주입 | Core가 검증한 frozen Snapshot과 선택 사이트 행에서 필요한 flags·전역 정책만 Content에 전달 | Core 윤종민, Content 채지민. 타입/버전/최대크기 및 탭 문서 식별 확정 필요 |
| 문맥 결박 | session/snapshot/executor/owner/revision과 tab/frame/document를 Core가 유지 | 페이지 body의 owner/계정 주장은 인증으로 사용 금지. stale 문서/끝난 세션 보고 거절 |
| 탐색 식별 | 기존 Core pending의 navigation_id를 Content까지 바인딩. SPA에도 Core가 새 명시 탐색 여부/ID를 결정 | webNavigation history/fragment와 서비스 내부 진입의 경계·중복 병합 필요. Content 렌더마다 UUID 만들지 않음 |
| 즉시 제한 | Content가 유효한 제한을 관찰하면 다른 분류 결과를 기다리지 않고 DOM 제한 | 적용 결과를 실제 확인. 실패/미지원 결과를 정상 APPLIED로 올리지 않음 |
| 적용 보고 | 현행 허용 종류 FEATURE_RESULT/IMAGE_RESULT 및 응답 envelope를 토대로 최소 데이터 전달 | 실제 feature_code/result 필드·실행명령과 연결·오류 enum·release 확인 스키마 미확정 |
| 접근 증거 | OBSERVE_ACCESS는 명시 새 탐색/지원 기능 진입+RUNNING 검증 후에만 수용 | featureEntry 반환값만으로 이벤트 발행 금지. 최초 적용/자동렌더/추천·댓글 숨김/차단안내 새로고침 제외 |
| 사유 통합 | Core가 이미 확인된 이유를 freeze 이전 한 Event1.2에 통합 | USER_SITE→ADULT_DOMAIN→KEYWORD→FEATURE 대표 순서 및 confirmed 복수 사유 유지. FEATURE는 당시 선택 사이트에 enabled 필요 |
| 늦은 결과 | 전송 확정 뒤 동일 event_id 원문 수정/새 접근 추가 금지 | 늦은 사유의 진단 보관 또는 후속 annotation을 선택해야 함. 현행 annotation API가 없어 자동 신설 불가 |
| 해제·정지·종료 | Core의 명시 해제 지시에 Content observer/작업 취소·원상복구 후 결과 전달 | false/미확인 시 Core 상태를 PAUSED/ENDED로 확정하지 않음. 늦은 분석 결과로 재가림 금지 |
| 목록·모델 | Core가 검증된 frozen 목록과 패키지 내 학습 모델 adapter를 제공 | artifact version/checksum/license, 다운로드·갱신·이전 검증본 보관 경계 확인. 원격 이미지 분류 금지 |

## 검토할 결정

1. **메시지 세부 schema와 버전**: 공통 envelope는 현행 문서를 유지하고 APPLY/RELEASE를 어느 기존 Core 실행 요청과 묶을지 결정한다. 새 type을 임의 추가하지 않는다. Core가 runtime sender.id/tab/frame/document/세션을 검증해야 한다.
2. **navigation_id와 이벤트 확정 시점**: 기존 Core commit 직후 SITE 원문 생성 방식은 뒤늦은 Content 증거와 사유 결합이 어렵다. 제한 동작은 즉시 수행하되 전송 freeze 시점·동기 관찰 경계를 Core/Content/Server가 합의해야 한다. 임의 timeout 값을 문서로 확정하지 않는다.
3. **성공 기준**: 대상 없는 페이지의 불해당/미지원/감지 실패 구분, 토글 UI와 실제 autoplay 효과, iframe/shadow·이미지 부분 수집을 capability/실행 보고에 어떻게 반영할지 확정한다.
4. **규칙 ID·priority**: 현재 Core 사이트 규칙 값은 타 영역 예약 범위가 아니다. Content는 DNR을 직접 만들지 않는 방향을 권장한다. 전역 도메인/키워드 페이지 차단은 Core 집행으로 연결하고 ALLOW/독립 예외가 site BLOCK을 깨지 않게 검증한다.

권장안: 기존 Core가 소유/세션/탐색/전송 단일 권한을 유지하고, Content는 필요한 정책만 받는 DOM 제어 adapter와 최소 증거 제공자로 연결한다. wire 필드를 먼저 리뷰한 뒤 별도 연결 커밋과 회원/비회원 실제 Chrome 시험으로 진행한다. 본 문서를 근거로 Core PR17·Server API·이벤트 계약을 수정하지 않았다.

## 통합 검증 조건

- 정확한 source commit과 로드한 확장 파일 hash 대조, Core/Content 설치·빌드·manifest 주입 확인.
- start 실제 적용/실패 rollback, pause/end 해제 확인, resume 동일 snapshot, 설정 변경 다음 세션, stale 보고·다른 owner/frame 거절.
- Shorts 직접/SPA/중복 렌더, SITE+FEATURE+global 사유 1접근, 초기 적용/차단안내 0추가, 전송 후 원문 불변.
- Worker/브라우저/오프라인·모델 지연·실패·복원 미확인에서 자료/실제 제한 상태 대조.
- Server 신규1.2 발급 gate는 검증된 설치만 허용, 기본 OFF 유지.
