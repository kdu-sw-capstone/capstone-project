# EXT-02 — 회원 명령 조회·영속 실행 보고 통신 단위

담당 윤종민 / `feature/extension-core-ext-02` / 시작 `b67469355d30082e4dbe4863f22da4590b0191c0` / 2026-10-10. 사용자 다음 작업 착수 지시에 따라 회원 실행 연결의 첫 통신 단위를 구현했다. 단계별 Commit·Push·PR17 갱신 권한은 기존 작업카드 기준이며 develop 병합은 하지 않는다.

기준: AGENTS.md, 개발운영.md, 통합현황.md, EXT-02 카드, 인증·실행복구 연결계약11, APPLY 기간 전달 확정 계약, Extension_Server_연동가이드, 현행 ExecutionController/ExecutionService.commands/report/reconcile. Server 제품 코드·API·Snapshot·Journal wire 변경 없음. Content D06 회신은 아직 없으며 미확정 Content 메시지 구현 없음.

## 구현 결과와 경계

- `extension/src/member-execution-client.js`: 인증된 설치의 기존 commands API 조회, 응답·설치·회원·기간·UTC 시각 검증. 조회 도중 계정이 바뀌면 Core에 전달하지 않는다. 명령 조회 성공은 실행 승인이나 정책 적용 성공이 아니다. 만료·최신 revision·전체 정책 지원·실제 브라우저 관측은 호출하는 Core의 책임이다.
- 같은 모듈의 MemberReportStore: 별도 `focurve-member-reports/reports` IndexedDB, owner/executor/report 키. 네트워크 전 원문 저장·transaction commit, 동일 ID의 다른 본문 거절, 중복 enqueue로 ACK를 초기화하지 않는다. 인증 정보는 저장하지 않으며 기존 비회원 자료·실행 journal·이벤트 outbox는 변경하지 않는다.
- 보고 전 wire·interval·duration·저장 원문 결속 검증. 실제 관측은 이 모듈이 만들어내지 않는다. APPLIED에는 열린 RUN, RELEASED에는 닫힌 RUN 또는 실행 없는 빈 배열만 받는다. 기존 command_id 없는 local END는 이 보고 endpoint로 보내지 않고 후속 reconcile 경로로 남긴다.
- reports 접수 유실 시 같은 report_id·원문으로 재전송. ACCEPTED/DUPLICATE와 유효 revision만 ACK, 잘못된 응답은 미확인. 403/409/422 등 확정 거절은 격리, 401/408/429/5xx/네트워크 실패는 30초 후 같은 원문 재시도 대상. 서버·계정·설치가 다른 곳으로 보내지 않는다. ACK의 최신 revision은 보관할 뿐 RUNNING 확정이나 구 명령 재적용에 사용하지 않는다.
- 기본 fetch는 Worker 전역에 바인딩한다. 내부 adapter이며 팝업/페이지에서 보고를 주입하는 메시지 endpoint는 추가하지 않았다.

**제품 service-worker는 이 모듈을 아직 호출하지 않는다.** 사용자 최신 ZIP에서 회원 세션을 시작하면 자동 적용·종료된다고 안내하면 안 된다. 실제 회원 명령 loop, 안전한 context 대조, 타이머, offline END/reconcile, 접근 이벤트 연결, 제품 Chrome 통합은 후속이다. 이번 단위는 EXT-02 전체 완료가 아니다.

## 실행 검증

Linux / Node24.19.0 / JDK21 / MySQL8.4.8 / Chromium151.0.7922.173. 운영 설정은 그대로 두고 격리 test profile/focurve_test에서만 Snapshot 발급 gate를 켰다.

| 검사 | 최종 결과 | 대체 및 미검증 |
|---|---|---|
| Extension 전체 | 139/139, 실패·skip 0; 새 회귀 15개 | Node IDBFactory·합성 HTTP/인증 |
| JS 구문 | PASS | lint 또는 제품 Chrome 실행 아님 |
| Backend verify·package | 163/163, 실패·error·skip 0 | 실제 HTTP/MySQL, 인증은 합성 fixture |
| 새 실제 HTTP 시험 1건 | Server 명령 → SiteController 모의 DNR 적용 → APPLIED 보고 유실 → 새 client 동일 원문 재전송/DUPLICATE → 실제 종료 API → 모의 해제 → RELEASED → DB ENDED·reports2행·닫힌 RUN1행·lock0 | DNR/탭/trusted context 모의, IndexedDB는 IDBFactory. 실제 Server reconcile 또는 제품 Worker 통합 아님 |
| 실제 Chromium Worker 시험 1건 | 기본 fetch·네이티브 IndexedDB 저장 → 합성 HTTP 응답 유실 → Worker 종료·재생성 → 같은 원문 재전송·DUPLICATE ACK, 인증 미저장 | Dedicated Worker이며 제품 확장 service-worker·Chrome DNR·실제 Server 아님 |

첫 실제 HTTP 실행은 최종 DB assertion에서 `session_intervals.ended_at`라는 잘못된 테스트 컬럼명을 써 실패했다. 실제 스키마 `end_at`으로 수정한 뒤 전체 Backend verify를 재실행해 통과했다. 제품 DB 스키마·Server 동작을 수정하거나 assertion을 제거하지 않았다. Frontend 제품/테스트 변경이 없어 이번 로컬 Web 재실행은 하지 않았다.

재실행:
```bash
npm --prefix extension test
npm --prefix extension run check
python3 extension/tests/ui/member_execution_worker.py
source .local/cloud-env.sh
bash scripts/with-env.sh env SNAPSHOT_1_2_ENABLED=true SNAPSHOT_1_2_VERIFIED_EXECUTORS='*' bash backend/mvnw -f backend/pom.xml -B -ntp verify
```

## 미검증 / 실패 / 조율 필요 / 다음 행동

- 미검증: 제품 Worker 회원 명령 적용·수동/자동 종료·offline END/reconcile·재시작/절전·접근 이벤트, 실제 Windows Chrome, 실제 quota·전체 AC-EXT-02 및 BOUND17. 과거 사용자 회원 연결·비회원 실행 성공을 이번 통합 근거로 전용하지 않는다.
- 실패: 최종 로컬 검사 0. 초기 테스트 SQL 오류는 위에 기록. CI는 게시 후 해당 head로 따로 확인한다.
- 조율 필요: 지민의 D06 회신, 다훈과 자동복구 후속 계약. 현재 commands/reports wire와 기간 계약은 이미 존재하며 이번 단위에 새 메시지 합의를 요구하지 않는다.
- 다음 행동: 제품 Worker에 verified auth·guest 종료 증거·현재 Server session/revision을 대조하는 회원 context와 순차 loop 연결. 새 실행과 journal 복구를 구분하고 unsupported Content 정책은 부분 적용 없이 거절한다. 실제 적용 후 보고 저장, 타이머/수동 종료·실제 해제, offline local END는 현행 Journal1.1 reconcile로 연결한다. 사용자 Windows에서 새 코드로 실제 Chrome·Server·DB 동시 검증 후 AC 상태를 올린다.
