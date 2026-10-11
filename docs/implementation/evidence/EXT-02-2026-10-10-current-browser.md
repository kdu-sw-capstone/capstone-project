# EXT-02 현재 브라우저 설치 자동 선택·즉시 요청 (0.1.8)

담당 윤종민 / 브랜치 feature/extension-core-ext-02 / 시작 a4fe6bd74dff3a5a52225daaab0183fe8cbfb7e6. 사용자 지시: 현재 설치 자동 확인 및 시작·종료 즉시 연결. 기존 setup 도구·환경을 재사용했으며 Server/API/DB/gate·Content D06은 변경하지 않는다. develop 병합 없음.

## 문제와 결과

사용자 Windows 화면에서 Web은 이전 설치 A를 선택했지만 실제 확장 storage는 새로운 설치 B·LINKED였다. Server의 EXECUTOR_OFFLINE은 선택 설치 last_seen_at+60초를 검사한다. 계정 연결 정상과 현재 브라우저 실행 가능은 별개였다. 설치 변경 원인은 이번 근거로 확정하지 않는다. 이전 0.1.7의 1초 wake 제한은 시작 직후 종료 알림까지 버릴 수 있었다.

- Web 첫 조회 및 명시적인 연결 재확인에서 현재 확장을 조회한다. 시작 클릭 시 다시 인증 연결을 확인한다. 현재 설치를 Server의 현재 Web 계정 연결 목록과 대조하고 일치해야 자동 선택·POST한다. 다른 계정·없어진 bridge는 예전 설치로 자동 시작하지 않고 조치 문구를 표시한다.
- CONNECT는 인증된 기존 coordinator tick/commands 조회(heartbeat)를 완료한 뒤 설치 ID만 반환한다. tick 실패·auth/owner/executor/server/origin 변경·RECOVERY_REQUIRED는 성공 응답 금지. token·회원 ID·정책·세션 상태를 Web에 반환하지 않는다.
- 시작/종료 POST 성공 뒤 WAKE로 기존 commands 처리. 실행 중인 wake가 있으면 후속 조회 하나를 보존한다. 1초 이내 종료도 버리지 않으며 backup/deadline alarm을 미루지 않는다.
- 클릭 즉시 연결 확인/시작 요청/종료 요청 문구와 중복 요청 잠금. 입력도 처리 중 잠근다. 사용자 최신 지시에 따라 종료 추가 확인 단계를 제거하고 한 번 클릭으로 기존 end API 호출. 서버 접수나 bridge 응답만으로 RUNNING/ENDED 표시 금지.
- STARTING/ENDING 중 조회 1초, 안정 상태 5초 backup. 실제 적용/해제 여부는 기존 인증 Server 상태와 실제 DNR 보고가 확정한다. 즉각적인 화면 피드백과 0ms 실제 제어를 동일시하지 않는다.
- VITE_EXTENSION_ID 미설정 환경은 기존 수동 설치 선택/Server 주기 실행을 유지한다. 설정된 환경에서 bridge 불가면 시작을 차단하고 명확한 조치를 안내한다. 운영 HTTPS 및 자동 설치 ID 탐색(Chrome 확장 ID 자체)은 이번 범위 밖.

## 로컬 Web 계약

사용자의 Web↔Core 즉시 연결 지시에 따른 개발용 계약이며 D06 Content 계약과 분리한다. manifest 외부 연결은 기존 localhost/127.0.0.1 HTTP만 허용하고 Core는 auth.web_origin의 정확한 포트와 top-frame/tab를 검증한다.

```json
{"request_id":"example-connect","type":"FOCURVE_EXECUTION_CONNECT","owner_context":null,"payload":{}}
```

성공 data는 `{executor_id: UUID}` 하나. 실패는 ERROR/WAKE_UNAVAILABLE 또는 받은 설치 없음. 요청 허용 필드는 위 네 개와 빈 payload만. CONNECT 최대 Web 대기 12초, WAKE 2초. timeout은 성공이 아니며 실제 요청 취소나 정책 적용 명령도 아니다. Web은 현재 로그인 계정의 `/extension-installations`와 반드시 교차 대조한다. 서버의 현재 소유권·잠금·Snapshot 호환성 gate가 최종 권한을 유지한다.

WAKE의 기존 envelope/payload/received 의미 유지. 명령 성공·실행 상태는 응답에 포함하지 않는다. 직접 APPLY/END, 임의 snapshot 또는 owner 전송 금지.

## 기준·코드·검증

읽은 기준: AGENTS.md, 개발운영.md, 통합현황.md, EXT-02 작업카드, 화면명세 SESSION-01/EXT-01, 동작규칙 TF-05/TF-07 및 세션 상태, API-SESSION-01/02·API-EXEC commands, 검증기준 AC-SESSION-01/02-01~03·AC-EXT-02-01~03. owner/revision/실제 확인 불변 조건은 변경하지 않는다. 화면 종료 확인 제거는 사용자 최신 지시를 적용한 UI 변경이며 API/상태 enum은 유지한다.

코드: frontend/src/FocusSessions.tsx·executionWake.ts, extension/background/member-execution-runtime.js·manifest.json(0.1.8).

| 실행 | 결과·범위 |
|---|---|
| extension `npm test` | 180/180 PASS, Chrome/Server 모의. 설치 반환 전 인증 조회 완료, 실패/계정 변경/출처/명령 주입 거절, 실행 중 후속 END 보존 포함 |
| frontend `npm test` | 130/130 PASS, HTTP/Chrome bridge 모의. 오래된 첫 설치 대신 실제 현재 설치 선택, 다른 계정·bridge 부재 시작 차단, 즉시 처리 문구·중복 잠금, 한 번 클릭 END·확인 전 완료 금지, 1초 적용/해제 조회 포함 |
| frontend `npm run build` | TypeScript/Vite PASS |
| extension `npm run check`, `git diff --check` | 문법/diff PASS |

실패 이력: 첫 수정 스크립트의 cwd 경로 오류와 JSX 중괄호 오류는 수정 후 build 성공. Web 첫 테스트 127/128에서 로컬 오류 안내가 일반 Error→통신 실패로 변환되어 실패; 기존 UiError 사용으로 수정 후 최종 130/130 PASS. 실패를 감추거나 테스트를 삭제하지 않았다.

Backend 코드는 변경 없어 이번 Backend 검사 재실행 없음. 실제 Windows 제품 MV3 외부 sender/알림·절전·APPLY/RELEASE latency·자동 만료/시간 집계·회원 Event1.2·D06 Shorts·전체 AC는 미검증. 이전 사용자 성공 보고를 이번 버전 성공으로 승격하지 않는다.

## Windows 적용·다음 확인

1. 진행 중 집중이 없는 상태에서 기존 Chrome 로드 경로의 extension 내용만 수정본으로 덮어쓴다. 새 위치 로드/확장 삭제/저장 자료 초기화 없음. Chrome 확장 ↻ 후 0.1.8 확인.
2. 기존 Web의 frontend/src만 수정본으로 갱신. frontend/.env.local의 VITE_EXTENSION_ID는 Chrome 확장 ID 그대로, executor UUID 입력 금지. frontend 디렉터리에서 Web 재시작. Server JAR 재빌드 필요 없음.
3. Server의 로컬 테스트 Snapshot 허용 executor는 실제 현재 설치와 일치해야 한다. 자동 선택이 호환성 gate를 우회하지 않는다. 이전 설치 허용만 있는 경우 환경의 정확한 현재 ID로 Server 재시작. '*'·전체 운영 gate 승인 금지.
4. Web 새로고침 후 '현재 브라우저의 확장을 자동 선택했습니다.' 확인. 1분 시작 클릭→실제 차단 시작 시각/진행 표시 시각을 각각 측정. 종료 한 번 클릭→실제 차단 해제 시각/완료 표시 시각 측정. 요청 전 설치 ID 콘솔 수동 변경은 필요 없음.
5. 빠른 종료·자동 만료·새로고침·연결 오류도 별도 확인. 네트워크와 Chrome 처리 시간이 있어 0ms 보장은 하지 않는다. 약 30초 주기 대기가 제거됐는지 실제 측정 근거를 확보한다.
