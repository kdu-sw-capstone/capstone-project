# EXT-02 Worker 단독 복구 확인

시작 c5dae41, 윤종민 Core, AC-EXT-02-03 부분/데이터 복구 명세. 제품 코드 변경 없이 테스트 및 기록 보완.

## 모의 결과

`npm --prefix extension test`: 74/74, 실패·스킵0(Node24.19.0/Linux). 신규5건은 새 vm context에 실제 제품 classic scripts를 재평가하고 shared fake-indexeddb/storage.session/DNR mock을 유지한다. state queue/workerRecovered 등은 새로 생성한다.

1. child ALLOW/parent BLOCK 세션과 journal/rule IDs 유지, 중복 add 없음, 중단 사이 설정 변경도 기존 snapshot에 반영되지 않음. 다음 세션 변경 적용.
2. child allow 규칙 누락 시 정책 불일치로 INTERRUPTED/owned 잔여 규칙 제거, 오래된 APPLY 재설치 없음.
3. 해제 실패 후 Worker 재생성에서 persisted terminal_intent/확인된 시간/INTERRUPTED 보존.
4. 이전 Worker가 저장한 pending RECORD의 커밋·동일 onCommitted 중복시 이벤트1건 유지.
5. 계획 종료 시각 이후 재생성 시 ENDED/TIME_LIMIT/해제.

실제 service-worker.js 이벤트 등록/Chromium 수명 주기를 실행한 결과는 아니다. 제품 GuestSession 및 저장 코드에 대한 모의 검증이다. 기존 사용자 전체 Chrome 종료/재시작 성공과 Worker 단독 중단 결과를 혼동하지 않는다.

## 실제 Chrome 수동 절차 — 미실행

현재 Snapshot1.2 제품 코드로 확인한다. 최신 정책 코드는 9b6bace이며 이후 기록/테스트 변경은 제품 코드 변경이 아니다. OS/Chrome/실제 설치 경로·로드 SHA/시각을 기록한다.

1. naver.com BLOCK·하위 포함, chzzk.naver.com ALLOW·하위 포함으로 설정. 10분 이상 새 집중 시작. 세션 ID 및 진행 상태/차단·허용을 확인.
2. 확장 팝업과 Worker DevTools(Inspect)를 닫는다. DevTools가 열린 채로 있으면 정상 Worker 수명 검증이 되지 않는다. Chrome 전체 종료나 Extension 사용중지/제거/새로고침을 하지 않는다.
3. chrome://serviceworker-internals 에서 현재 FOCURVE ID의 background/service-worker.js scope를 찾는다. 해당 항목의 Stop이 표시될 때 눌러 Worker를 중단한다. 다른 확장/사이트 Worker를 중단하지 않는다. 페이지나 Stop을 찾지 못하면 아직 미검증이며 Chrome 화면 확인이 필요하다.
4. FOCURVE 팝업을 다시 연다. 계획 종료 전이면 같은 세션 ID/집중 진행 상태 유지. naver.com은 차단, chzzk.naver.com은 허용. 규칙 불일치가 있는 경우 정상 진행으로 표시하지 않는 것이 기준이다.
5. 집중 종료. 차단 해제 확인, naver.com/chzzk.naver.com 접근 가능.

빠른 단독 중단은 DNR 규칙과 storage.session을 유지하는 조건이다. Chrome 전체 재시작은 INTERRUPTED가 기대되며 다른 검증이다. 경과 시간에 따라 alarm이 Worker를 다시 깨울 수 있으므로 Stop 후 바로 팝업 확인하고 실행 시각을 기록한다.

미검증: 실제 Chrome Worker 단독 중단 및 위 UI/네트워크 절차, 실제 서버 연동/회원/전송/승인/Content/전역 제한/강제 저장오류.
실패: 최종 자동0, Codex Chromium unpacked 로드 환경 제한은 별도 유지.
조율 필요: 서버 계약 통합 및 Figma 실제 확장 프레임 접근. Figma 도구는 현재도 미노출이며 임의 디자인을 만들지 않음.
다음 행동: 사용자 Worker 단독 검증 → UI 원본 확보/적용 및 Server 실제대조 → 사용자 점검·팀 재검토. 팀 담당 병합, Codex 병합 없음.
