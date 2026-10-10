# EXT-02 회원 시작·종료 지연 개선 (0.1.7)

윤종민 / feature/extension-core-ext-02 / 시작1165dc197a191f531b8382014f4acd76282244cd / 2026-10-10. 사용자 실제 시험의 시작 지연 보고와 ‘다음 작업 시작’ 지시 기준. AGENTS/개발운영/통합현황/EXT-02, 공용 D06/D09, API-EXEC-01~03·AC-EXT-02-01/03 및 실제 Windows 기록을 대조했다. develop 병합 없음.

## 변경과 신뢰 경계

- 기존 Worker는 startup/popup/30초 alarm에서 명령을 조회한다. 주기 사이에 접수된 Web 시작/종료는 다음 조회를 기다릴 수 있다. 사용자의 딜레이 정량 측정은 아직 없으며 기존43초 집계까지 이 원인으로 확정하지 않는다.
- Web FocusSessions에서 **기존 Server POST 성공 뒤에만** 실행 설치로 wake hint를 보낸다. 실패 요청에서는 알림 없음. 알림 Promise를 실행 처리/상태 조회의 선행 조건으로 기다리지 않는다. 성공 알림은 APPLIED/RUNNING/RELEASED 증거가 아니다.
- `frontend/src/executionWake.ts`: 기존 VITE_EXTENSION_ID(Chrome 확장 ID)를 사용해 FOCURVE_EXECUTION_WAKE 전달. API 부재/ID 부재/Chrome lastError/2초 응답 유실이면 false로 끝나고 기존 주기 조회 유지. token/정책/세션 명령을 전송하지 않는다.
- `extension/background/member-execution-runtime.js`: onMessageExternal에서 정확한 설정 web_origin·top-frame/탭·LINKED·해당 executor·허용 필드만 확인한다. 다른 origin/port/설치/확장/subframe·추가 policy payload는 거절한다. 반환은 받은 알림 여부뿐, 계정/토큰/실행 상태를 노출하지 않는다. 모든 실제 명령/context/revision/Snapshot은 기존 인증된 Server API와 coordinator에서 재검증한다.
- 반복 hint는1초 내 병합해 무제한 tick queue를 만들지 않는다. 기존 30초 backup alarm은 이미 있으면 재생성하지 않는다. 기존 매 tick 생성은 주기 시작점을 이동시킬 수 있었으므로 get으로 존재를 확인한다.
- RUNNING의 검증된 planned_end_at에 **일회성 deadline alarm**을 예약하고 만료 때 coordinator를 호출한다. 기존 actual rules 제거→durable END→reconcile 경로를 재사용한다. 반복 조회는 같은 deadline을 밀지 않는다. 완료 뒤 alarm 제거. 주기 alarm은 알림 유실/Worker 복구에 유지한다.
- manifest **0.1.7**, externally_connectable은 개발 localhost/127.0.0.1 HTTP 페이지만 허용한다. 실제 포트·설정 origin은 receiver에서 추가 확인한다. 운영 HTTPS origin은 자동 허용하지 않으며 배포 때 별도 설정/검토가 필요하다.
- Server API/DB/실행 보고·D06 Content 메시지 변경 없음. Shorts 연결/회원 collector/정상 refresh·인증 복구 UI는 이번 범위 아님.

## 로컬 알림 계약

이번 사용자 지연 개선 범위의 별도 Web→Core hint이며 D06 Content 제품 계약을 대신하지 않는다. 공통 요청/응답 envelope 유지, owner_context=null은 실행 권한을 주장하지 않는 이 hint에만 허용한다. 신규 GET_STATE/토큰/command API 없음.

요청: `{request_id,type:'FOCURVE_EXECUTION_WAKE',owner_context:null,payload:{executor_id}}`.
응답: `{request_id,status:'OK',data:{received:boolean},error:null}`. 내부 실패는 status ERROR/WAKE_UNAVAILABLE, 개인정보·stack 없음. received는 알림 수용이지 명령 성공/Server ACK가 아니다. 무효 sender/필드에는 receiver가 응답하지 않을 수 있고 Web은2초 이내 실패로 끝낸다. 요청 request_id1~64문자, executor UUID. 새 적용/종료를 만드는 권한이 아니므로 외부 알림만으로 정책/세션을 바꾸지 않는다.

## 검증

- `npm --prefix extension test`: **178/178 PASS**, fail/skip0. 신규4개 VM/모의 Chrome: 즉시 tick·origin/port/executor/복구상태 거절·반복 hint 병합/backup·deadline 고정·종료 alarm 정리.
- `npm --prefix frontend test`: **125/125 PASS**. 알림 필드/유실/Chrome error/fallback 및 실제 컴포넌트 POST 성공→hint 순서·STARTING 유지 검사. Chrome·HTTP는 모의다.
- `npm --prefix frontend run build`: TypeScript/Vite PASS.
- `npm --prefix extension run check`, staged diff 검사 PASS. 신규 테스트 실패 없음.
- Backend 변경 없어 이번 재실행 없음. 실제 Windows MV3 외부 메시지 연결·지연 측정·Chrome deadline/절전/오프라인·Server/DB 원문은 **미검증**. Chrome alarms는 OS 절전 중 정확한 시각 실행을 보장하지 않는다.43초 집계 미확정 유지.

## 사용자 업데이트·실제 확인

1. 기존 확장 로드 폴더/ID/storage 유지, extension 파일을0.1.7로 교체하고 Chrome에서 확장 새로고침. 활성 집중 중에는 업데이트하지 않는다. 확장 삭제/새 폴더 로드/기록 초기화 없음.
2. Web도 최신 frontend 코드로 교체한다. `frontend/.env.local`에 **현재 Chrome 확장 ID**를 VITE_EXTENSION_ID로 지정(기존 다른 항목 유지). executor UUID와 다르다. 비밀·토큰 아님. frontend npm run dev 프로세스를 재시작해야 반영된다. 기존 .env/DB/MySQL/Server/JAR은 이번 Web 알림 수정 때문에 교체할 필요 없음.
3. 회원 연결 유지 확인, 현재 executor 선택·사이트 한 개 BLOCK/활성 Content 없음. Web1분 시작→실제 차단/실행 결과 시각을 확인. 자동 종료의 실제 접속 복원 시각도 예정시각과 비교. 두 번째 시험에서 수동 종료→바로 복원 확인.
4. VITE_EXTENSION_ID 미설정/다른 설치/외부 bridge 유실이면 backup으로 실행할 수 있으나 즉시 알림 시험 PASS 아님. 실제 성공은 Web·규칙·HTTP/interval 근거로 구분한다. 실제 Windows 완료 후에만 지연 개선 검증완료로 갱신한다.
