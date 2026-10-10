# EXT-02 / D09 — Worker fetch 호출 실패 수정

담당: 윤종민 / 브랜치 feature/extension-core-ext-02 / 시작 SHA 9b063be33635592cf48659ce07c0367930295e78.
기준: docs/design/02_시스템_테크설계/11_인증_실행복구_가져오기_연결계약.md (설치 등록·PKCE·토큰), 기존 Event 1.2 계약. API·저장 계약 변경 없음.

## 문제와 수정

사용자 Windows Chrome154.0.8037.98 / Windows11 25H2 Build26200.9457에서 회원 설치 등록이 REGISTRATION_UNCONFIRMED / AUTH_RESPONSE_UNCONFIRMED로 실패했다. catch 중단점의 원래 오류는 `Failed to execute 'fetch' on 'WorkerGlobalScope': Illegal invocation`. 로컬 DB extension_installations가 비어 있음, DB URL 일치, Worker health GET200·빈 등록 POST422를 사용자 화면에서 확인했다. 사용자 새로고침만으로 원인이라고 한 초기 진단은 철회한다. 일반 객체 fetch200 검사는 MemberAuth 인스턴스의 네이티브 receiver 문제를 배제하지 못했다.

MemberAuth와 MemberEventDelivery의 기본 fetch를 `globalThis.fetch.bind(globalThis)`로 바인딩한다. 주입된 테스트 fetch는 기존대로 사용한다. 미확인 상태 guard·데이터 보존·비밀 비노출·등록 멱등성/재발급 한계는 유지한다. 이번에 등록 결과 자동복구를 구현한 것은 아니다. Server/frontend 제품 코드 변경 없음. 최신 develop90ad32b 반영 및 시각9자리/duration_minutes/회원명령보고는 별도 후속 단위다.

## 이번 검증

- `npm --prefix extension test`: 116/116, 실패0·skip0. receiver를 검사하는 auth/event 모의 회귀2개 추가. 기존 실패·유실·보존 테스트 포함.
- `npm --prefix extension run check`: 문법 통과.
- `python3 extension/tests/ui/member_fetch_worker.py`: Linux Chromium151.0.7922.173의 실제 Dedicated Worker와 제품 request helper를 실행. 수정 전 소스를 런타임에서 재구성해 인증 오류·이벤트 Illegal invocation·HTTP0건을 재현. 수정본 인증·이벤트 모두 HTTP201/accepted 수신·총2건을 확인. 서버는 테스트용 합성HTTP이며 실제 제품 Extension Service Worker·회원Server·MySQL 통합이 아니다.
- 이전 Backend140/140·회원합성HTTP1/1·UI19는 과거 D09 검증이며 이번 변경으로 다시 실행하지 않았음. 이번 Windows 수정본 회원 연결 성공은 아직 미검증.
- 제품 파일 SHA256: `af2b633134a64f8dc3704f5916168529eedea8909a9252099aabb96468480314`. 경로순 manifest/background/popup/blocked의 상대경로+NUL+파일SHA256+LF 집계. Windows 로드hash 미대조.

## 실제 Chrome 재검증

1. 최신 feature/extension-core-ext-02 ZIP을 받아 압축해제. 기존 .env/DB/비회원자료는 보존. 전체폴더를 교체하면서 .env를 덮어쓰지 않는다. 확장의 기존 로드 폴더에서 member-auth.js/member-events.js의 기본fetch 바인딩 수정이 있는지 확인하거나 최신extension 폴더를 기존 로드경로에 반영한다.
2. 연결 요청이 실행중이 아닐 때만 확장 reload, 이전 진단 breakpoint는해제. 기존확장ID와callback 일치 확인. 새로드폴더로ID가바뀌면Server의callback허용등록재확인; 확장삭제/ID강제재생성 금지.
3. 현재 REGISTRATION_UNCONFIRMED는코드수정만으로자동해제되지않는다. 요청중단후 동일ServerDB의 설치행부재를 다시확인하고 proof/token/link없는상태일때만 담당안내에따라 UNREGISTERED로전환. Server에등록행있으면중단·담당조율. 저장소전체삭제금지.
4. Server/Web실행·로그인·callback설정 확인후 연결을한번클릭. 승인후상태조회. 요청중reload금지. proof/token/PKCE/응답본문전체 캡처금지. 회원집중시작은후속명령loop까지금지.

## 최종 상태

- 실패: 수정전 Windows 제품 인증 실패 확인. 이번 수정후 로컬 자동/Worker회귀 실패0.
- 미검증: 수정본 Windows 제품회원연결·토큰갱신·회원명령/APPLIED/RELEASED·reconcile·전체AC. CI는 PR 최신결과별도확인.
- 조율 필요: 설치행존재/응답유실시 Server 복구계약, 다훈의최신develop회원명령계약 후속반영. 현재버그해결에ServerAPI변경필요없음.
- 다음 행동: 수정본다운로드/기존자료보존로드 → 미등록재확인/제한된상태복구 → 회원연결Windows검증.
- Git: 사용자허용범위Commit·Push·PR17갱신. develop병합없음. EXT02전체완료로표시하지않음.
