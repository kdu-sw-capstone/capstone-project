# EXT-02 Snapshot 1.2 정책 변경 검증

기준: 시작 HEAD 2812def, 사용자 Windows ZIP의 10_호스트_정책우선순위.md 및 04_API_연동.md. 사용자 요청에 따라 문서 기준과 Extension을 같은 PR에 반영한다. 팀 담당이 병합하며 Codex는 병합하지 않는다.

## 변경·계약

- 동일 normalized canonical_host만 SITE_SCOPE_CONFLICT. naver.com/chzzk.naver.com 동시 등록 가능. 삭제된 host로 다른 항목 PATCH는 거절, POST는 기존 ID 복원.
- 소문자 IDNA/마지막 점 제거, www 유지. 자격정보/IP/localhost/명시적 port 거절 유지.
- 호스트 레이블 수가 가장 많은 행 전체를 선택. 부모 기능/강도를 합치지 않음. include_subdomains=false는 exact host만 적용.
- 새 비회원 세션 format_version=1.2/site_match_strategy=MOST_SPECIFIC_HOST, sites는 레이블 수 내림차순/ASCII 오름차순. Server adapter도 같은 1.2 전략과 공용 선택/규칙을 사용.
- 기존 1.1 session/snapshot/journal/rule IDs 원문 복구 보존, 1.1은 기존 범위 검증으로 지원. 이벤트 schema_version은 1.1 유지. 미지원 전략은 신규 adapter 적용 전에 거절하고 기존 제품 활성 상태에서는 소유 규칙 해제/INTERRUPTED/오류로 처리.
- DNR BLOCK redirect와 부모 BLOCK에 대한 child ALLOW/RECORD main_frame allow 예외에 호스트 specificity priority 부여. exact 자식 예외가 그 자식의 하위 호스트까지 허용하지 않음. 열린 탭과 접근 기록도 공용 selector를 사용.
- 모든 owned redirect/allow 규칙은 journal에 저장·실제 적용 확인·소유 확인 후 해제. 시작 시 설정 snapshot 고정, 실행 중 변경은 다음 세션부터 적용.

## 검증 구분

Node 24.19.0/npm 11.9.0 Linux 모의 자동 테스트 69/69, 실패·스킵 0. `npm --prefix extension test`, `npm --prefix extension run check`, `npm --prefix extension run build:harness`, `git diff --check`.
제품 classic scripts 및 실제 저장 처리 코드를 fake-indexeddb 모의 구현에서 실행. DNR/Chrome APIs도 모의이며 실제 Chrome 결과가 아니다. .chrome-harness 생성은 성공, 브라우저 실행은 미검증.

신규 검증: 부모BLOCK/자식ALLOW, 부모ALLOW/자식BLOCK, 자식RECORD, 더 깊은ALLOW/BLOCK, include=false의 자식 하위 호스트, 등록 순서 역전, lookalike·마지막 점, exact 중복/삭제hostPATCH, snapshot 정렬/불변/다음세션, 이벤트 child target 및 이벤트1.1, 기존1.1복구, 미지원전략, 열린탭최종정책 및 allow해제. 기존 오류4건 회귀도 유지.

모의 global priority1000 BLOCK이 사이트 allow보다 우선함도 검증. 실제 전역 성인/키워드/Content 기능은 아직 연결하지 않았으며 이 테스트는 제품 global 동작 성공을 뜻하지 않는다. 전역 규칙은 사이트 규칙 priority보다 높아야 하므로 통합 담당과 우선순위 분리 조율 필요. allowAllRequests 사용 없음.

기존 사용자의 Chrome 1~9 성공 보고는 이전 오류 수정 코드 대상으로 보존. 이번 정책 수정의 실제 Chrome 결과로 확대하지 않음. 클라우드 Chromium의 unpacked 로드 관리자 제한이 있어 새 제품 Chrome 실행·화면은 미검증.

## 사용자 Chrome 추가 검증

최신 feature/extension-core-ext-02 ZIP을 다시 내려받아 product extension 폴더를 로드/새로고침한다. ZIP을 새 폴더에 풀었다면 현재 Extension이 이전 폴더를 가리키지 않게 확인한다. 중복 FOCURVE 활성 설치는 피하고 기존 자료는 보존한다. 실행 SHA/OS/Chrome 버전을 기록한다. 개발 확인 화면은 유지되며 Figma 디자인 적용은 아니다.

1. naver.com BLOCK, 하위 도메인 포함 / chzzk.naver.com ALLOW, 하위 도메인 포함으로 각각 등록. 중복되지 않고 두 항목 표시. naver.com. 재등록은 중복 거절.
2. 새 집중 시작. www.naver.com은 차단, chzzk.naver.com은 허용. 미리 열어둔 치지직 탭도 차단 안내로 옮겨지지 않음.
3. 실행 중 치지직 BLOCK 변경. 현재 세션은 계속 허용, 종료 후 다음 세션에서는 차단. 이어서 naver.com ALLOW + 치지직 BLOCK의 반대 조합도 다음 세션에서 확인.
4. naver.com BLOCK, 치지직 RECORD로 다음 세션 시작. 치지직은 열리고 접근 기록은 RECORD. 안내 새로고침/반복 구분 회귀 확인.
5. 치지직 ALLOW의 하위 도메인 포함을 끄고 부모 BLOCK. 치지직 exact는 허용, live.chzzk.naver.com은 부모 차단 안내. 해당 주소의 서비스 응답/존재 여부와 정책 판단은 구분. 더 깊은 호스트 exact ALLOW/BLOCK 및 형제 host도 같은 방식으로 확인.
6. 종료 후 모든 owned 규칙 해제·사이트 접근 확인. Worker 단독 중단/Chrome 전체 재시작 복구 및 앞선 1~9 기본 시나리오 재확인.

미검증: 위 최신 Chrome 전 항목, 실제 Server 전체 Snapshot/API/회원 연결·보고·승인·공유복구·Content 통합, 실제 전역 정책, 실제 IndexedDB quota 및 강제 실패.
실패: 최종 자동 실패0; 실제 Chromium 로드 환경 제한은 남아 있음.
조율 필요: 서버 실제 JSON/버전 협상·미지원 응답, global/Content 규칙 우선순위, Figma 원본 접근 및 팀 재현 원본.
다음 행동: 사용자 최신 Chrome 검증 → 코드/결과 점검 → 팀 재검토. 회원 연동/EXT-02 전체 완료 및 병합 준비 완료로 표시하지 않음.
