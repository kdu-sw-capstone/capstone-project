# EXT-02 — Server 명령 시각·목표 기간 검증과 영속 보존

2026-10-10 KST / 윤종민 Core / feature/extension-core-ext-02. 시작4e2f055, develop90ad32be5d282f3b44c917a29e156dffc5e29187을1de73ee에merge. 연동가이드충돌은양쪽내용보존해해결. Server/frontend제품코드는90ad32b와동일,새담당제품변경은extension/src뿐. Content브랜치/develop병합·자동병합없음.

기준: FOCURVE_APPLY_POLICY_기간전달_확정계약.md, API04 Command, 인증/복구11, D01D10. 새APPLY root.duration_minutes 필수정수1..180, RELEASE기간비필수, execute_before와목표기간별개,구형저장원문보존. Event1.2/Snapshot1.1/1.2/ServerJournal1.1 wire변경없음.

## 구현

- src/server-time.js: UTC Instant 0~9자리소수허용,유효calendar/시각검증,잘못된날짜rollover·10자리·비계약offset형식거절. 브라우저timer는ms이므로sub-ms는내림하여적용기한을늦추지않음(최대1ms미만보수적조기거절). 원본Server시각은journal에그대로보존.
- SiteController.guard: APPLY.duration_minutes를기본값없이1~180정수검증,created_at/execute_before를새파서로검증. malformed명령은기존journal/Chrome규칙에변경전거절.
- SiteController.apply: owner/executor/session/command/revision과duration/apply_created_at/apply_execute_before를같은entry에저장. 실제규칙/탭확인후applied_at와planned_end_at=start+duration을저장. 중복명령은같은기간·원본시각·Snapshot까지일치해야하고timer를다시시작하지않음. 새controller inspect는보존기간/시각을반환. RELEASE는기간부재로막지않고기존목표를보존.
- src/member-journal-store.js: 회원전용별도IndexedDB focurve-member-execution/journal,owner+session키,transaction완료후save성공. 비회원DB·회원eventoutbox분리. 설치DB삭제/계정migration없음.

**현재는내부SiteController adapter 단계다.** journal 구현은준비됐지만제품service-worker의회원명령loop에서호출하지않는다. 제품회원집중timer/ServerAPPLIED·RELEASED/reconcile·잔여시간자동복구는연결되지않음. 저장된planned_end_at는adapter실제관찰시각에서계산한내부목표이며ServerSession조회값을임의수정하지않는다. 자동재개를구현한것이아니다. 기존durations없는journal을기본25분으로재작성하거나재적용하지않는다. 기존release/안전cleanup경로는보존.

## 이번 검증

| 검사 | 환경과결과 | 한계 |
|---|---|---|
| Extension 전체 | Node24,124/124 PASS,fail0/skip0 | Chrome/storage/신규journal IDBFactory모의 |
| 새회귀 | precision0..9·잘못된calendar·1/25/180·누락/문자열/소수/범위거절·변조중복·같은세션재생성·해제기간미필수·만료기한·실제IDBAPI흐름 | 브라우저제품회원명령미실행 |
| JS문법·harness build | PASS | harness는검증용 |
| 네이티브Worker fetch회귀 | Linux Chromium151:수정전Illegal invocation/HTTP0,현재바인딩합성HTTP2건PASS | 이번기간명령HTTP통합아님 |
| Backend 전체 verify | JDK21/MySQL8.4.8,162/162,fail/error/skip0,packagePASS | 실제DB+HTTP합성fixture,제품회원Chrome아님 |
| Web test/build | Node24,121/121 및buildPASS | 화면/API모의 |

초기Backend는루트.env의Snapshot1.2발급OFF가test에주입되어162개중fail12/error45였다. 격리testprofile/focurve_test에한해with-env뒤env SNAPSHOT_1_2_ENABLED=true SNAPSHOT_1_2_VERIFIED_EXECUTORS='*'로재실행하여162/162통과. 운영.env는OFF유지·비밀값변경없음. 초기Web npm은기본홈cache쓰기실패로의존성설치실패,기존.local/cloud-env.sh의workspacecache로재실행하여install/test/build통과. checksum검증/lockfile유지,제품코드를회피수정하지않음.

실행명령:
```bash
npm --prefix extension test
npm --prefix extension run check
npm --prefix extension run build:harness
python3 extension/tests/ui/member_fetch_worker.py
source .local/cloud-env.sh
bash scripts/with-env.sh env SNAPSHOT_1_2_ENABLED=true SNAPSHOT_1_2_VERIFIED_EXECUTORS='*' bash backend/mvnw -f backend/pom.xml -B -ntp verify
```
Web은frontend에서같은cloud-env읽은후npm ci/test/run build. Windows사용자운영설정에test발급'*'를복사하지않는다.

Extension manifest+src/background/popup/blocked 경로정렬SHA256 `4815dbedaaaae1efd914d065c956166300eae9ff79b12fec4234d8bc2f7e9602`. 상대경로NUL+파일SHA256+LF산식. 이전증거의src제외제품hash와산식구분,Windows대조미실행.

## 미검증 / 실패 / 조율 / 다음 행동

- 미검증: 신규adapter/storage의실제Chrome회원명령·타이머종료·APPLIED/RELEASED보고·reconcile·저장공간부족/브라우저재시작·전체AC. 과거회원연결성공은기간실행검증이아님.
- 실패: 최종로컬검사0. 초기환경원인실패는위에기록. GitHub CI는최신head조회별도,검증전완료표시금지.
- 조율: 다훈의실제Command보고/시간경계·자동복구후속;지민D06메시지/freeze회신대기. 이번기간계약은이미확정되어이작업에새합의필요없음.
- 다음: 회원Worker명령조회→SiteController+MemberJournalStore연결→타이머/실제해제→보고outbox/Server대조를다음단위로개발·검증. 이번변경만다운로드해회원집중실행을시험하지않음. 기존비회원자료/인증/Server.env보존.
