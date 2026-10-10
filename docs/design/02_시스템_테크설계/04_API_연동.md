# API 및 시스템 연동

> 2026-10-09 D-01~D-10 사용자 확정 정책 반영: [최종 공용계약](FOCURVE_D01_D10_최종공용계약.md). 정책과 현재 제품 구현/검증을 구분한다. 아래 역사 JSON·현행 API는 보존하며 신규 복구 API가 구현된 것으로 해석하지 않는다.

## 공통 계약

기존 /api/v1 경로·기본 식별자 체계를 유지한다. 기능/화면 ID와 API ID는 별개다. 여기의 API- 접두어는 문서상의 구분이며 URL 일부가 아니다. JSON UTF-8, snake_case. 내부 bigint는 십진 문자열, 외부 세션·이벤트·설치·작업은 UUID. 시각은 UTC RFC3339, 기간은 ms 정수, 화면 집계 기본 Asia/Seoul이다.

W=Web HttpOnly Secure SameSite=Lax 쿠키, 변경 요청 CSRF+Origin 검증. E=소유 계정·설치에 결박된 Bearer. I=설치 증명, 회원 데이터 접근 불가. 소유자는 body user_id로 결정하지 않는다. 타 계정 자원은 404, 설치 불일치는403. 모든 자료 조회·변경은 계정과 설치 관계를 확인한다.

생성·명령·전송에는 Idempotency-Key UUID. 인증 로그인·OAuth 리다이렉트·단회 토큰 소비는 별도 challenge 식별자로 재사용을 막는다. 같은 주체+method+path+key/본문은 같은 결과, 다른 본문은409. 수정·삭제는 If-Match version, 누락428/불일치412. 같은 멱등 요청의 재전송은 version 검사보다 먼저 기존 결과를 반환한다. 멱등 캐시7일, 이벤트/원본/예약 고유 제약은 별도 영속 유지. POST 결과 미확인은 같은 키로 재요청하며 새 요청으로 간주하지 않는다.

목록 {items,next_cursor,has_more}, limit기본20/최대100. from_date/to_date 양 끝 날짜 포함 최대366일. 조회는 200, 생성201, 실행 요청202+operation_id, 삭제204. 202를 실제 적용 성공으로 표시하지 않는다. 자원 변경 응답에는 ETag를 포함한다. 오류={error:{code,message,field_errors:[{field,reason}],retryable},request_id}. 429/503은 Retry-After, 통신 재시도1/2/4/8/16/30초+지터. 422는 입력 수정 전 자동 재시도 금지.

## 객체 명세

표에서 ?는 선택/null, 그 외 필수다. 목록 응답의 시간·수치 null은 미확인이고 0과 다르다.
| 객체 | 필드·형식 |
|---|---|
| User | user_id:string, display_name:string, email:string?, email_verified:boolean, providers:[EMAIL,GOOGLE,KAKAO] |
| SiteWrite | url:string≤2048, display_name:1..100, include_subdomains:boolean=true, purpose:FOCUS/DISTRACTION/GENERAL, access_policy:ALLOW/BLOCK/RECORD, feature_policies:[{feature_code,enabled}] |
| Site | site_id:string, canonical_host:string, SiteWrite 중 url 제외, version:int≥1,created_at,updated_at,deleted_at? |
| ContentPolicyWrite | keywords:{enabled,rules:[{id UUID,text1..80,scopes:[TITLE/URL/BODY]}],exceptions:[Host]},adult_domains:{enabled,custom_hosts:[Host],exceptions:[Host]},image_blur:{enabled,sensitivity:LOW/MEDIUM/HIGH,strength:LOW/MEDIUM/HIGH},usage_tracking:{enabled} |
| Host | host:소문자 IDNA 정규화≤253,include_subdomains:boolean. 각 목록≤500. 키워드≤200. |
| ContentPolicy | ContentPolicyWrite + version:int,updated_at |
| Snapshot | policy_snapshot_id UUID,format_version=1.2,site_match_strategy=MOST_SPECIFIC_HOST,owner_user_id?,executor_id,created_at,sites:[Site],content_policy,catalog_version?,model_profile_version?,source_version |
| Session | session_id UUID,executor_id UUID,policy_snapshot_id UUID,origin:MEMBER/GUEST_IMPORT,source:MANUAL/SCHEDULE,automatic_recovery_supported:boolean=false,time_accounting_mode:LEGACY_WALL_CLOCK,execution_status,record_status:PENDING/PARTIAL/COMPLETE/REVIEW_REQUIRED,duration_minutes,active_duration_ms,overrun_ms,remaining_ms,started_at?,planned_end_at?,ended_at?,policy_released_at?,end_reason?,version,desired_revision,last_error_code? |
| Command | command_id UUID,session_id,executor_id,type:APPLY_POLICY/RELEASE_POLICY,desired_revision,duration_minutes:APPLY_POLICY 전용 필수 JSON 정수 1..180(분),snapshot?,reason,created_at,execute_before? |
| ExecutionReport | report_id UUID,command_id?,session_id,executor_id,desired_revision,result:APPLIED/RELEASED/FAILED/UNCONFIRMED,observed_at,error_code?,rollback_confirmed?,intervals:[Interval],local_action_seq? |
| Interval | interval_id UUID,kind:RUN/PAUSE,start_at,end_at?,duration_ms?,quality:CONFIRMED/UNCONFIRMED; RUN 끝은 마지막 신뢰 가능한 실행 경계; 실제 해제 시각은 policy_released_at 별도 |
| Note | session_id,text:0..2000,version:int≥0,updated_at? |
| Access | event_id,session_id,executor_id,occurred_at,event_type,target_kind,target_host,feature_code?,target_key,access_seq,target_access_index,is_repeat,policy_snapshot_id,quality |
| Metrics | total_access,repeat_access,blocked_access,active_duration_ms,repeat_ratio?,quality:COMPLETE/PARTIAL/NO_DATA/NOT_COLLECTED,as_of; TargetMetrics는 host 추가 |
| ScheduleWrite | name:1..80,weekdays:서로다른1..7배열,start_local:HH:mm,duration_minutes:1..180,timezone:IANA,executor_id UUID,enabled:boolean |
| Schedule | schedule_id UUID,ScheduleWrite,version,created_at,updated_at,deleted_at? |
| Occurrence | occurrence_id UUID,schedule_id,scheduled_start_at,scheduled_end_at,status:PENDING/WAITING_CONFLICT/STARTING/RUNNING/FINISHED/SKIPPED,reason?,session_id?,schedule_version |
| AnalysisJob | job_id UUID,from_date,to_date,status:QUEUED/RUNNING/SUCCEEDED/FAILED/INSUFFICIENT_DATA,input_hash,as_of,model_version?,result?,error_code?,created_at |
| Result | observations:[{text,metric_ids[]}],suggestions:[{text,screen_id,metric_ids[]}],limitations:string[],metrics:[{metric_id,value,unit}],generated_at |
| ImportItem | type:SITE/CONTENT_POLICY/SCHEDULE/SESSION,source_item_id UUID,source_hash,payload. SESSION payload는 snapshot,session,events,intervals,usage_segments,note를 포함; 완료 세션만 |
| ImportBatch | batch_id UUID,status:PENDING/PROCESSING/SUCCEEDED/PARTIAL/FAILED,items:[{source_item_id,status,result_id?,error_code?}],created_at,completed_at? |
| Capability | feature_code,supported_hosts[],client_min_version,adapter_version,status:SUPPORTED/UNSUPPORTED/FAILED,limits |
| Catalog | version,sha256,generated_at,source_manifest:[{url,license,version}],hosts[]; 이전 검증본 유지 |
| Installation | executor_id,current_user_id?,last_seen_at,client_version,execution_status |

Command의 `duration_minutes`는 분 단위 목표 시간이며 위 공통 ms 기간 규칙의 명시적 예외다. 새 회원 `APPLY_POLICY`에서는 `focus_sessions.duration_minutes`의 저장값을 사용한다. 누락·null·문자열·소수·범위 밖 값은 유효한 새 APPLY가 아니며 Core는 임의 기본 시간 또는 APPLIED 성공으로 처리하지 않는다. `RELEASE_POLICY`에는 이 필드를 요구하지 않는다. 기존 저장 명령은 backfill 없이 원문 조회를 유지하되 기간 없는 구형 APPLY를 신규 적용하지 않는다. 세션 조회의 기간 정보·session_id·Snapshot·revision·명령 멱등성 및 보고 계약은 유지한다. [기간 전달 확정 계약](FOCURVE_APPLY_POLICY_기간전달_확정계약.md)의 호환 경계를 따른다. 실제 Core 호환 검증 전 Snapshot 1.2 신규 발급은 기본 OFF이며 D-01·D-05 자동 복구는 후속 구현이다.

## 사이트·인증 검증

URL에서 host만 관리 범위로 사용하고 경로·query·fragment는 저장하지 않는다. 자격정보 URL·IP·localhost·명시적 port는 거절한다. www를 임의 제거하지 않는다. 같은 계정의 정규화된 canonical_host가 정확히 같은 경우만409이며 상위·하위 등록 범위의 겹침은 허용한다. 여러 행이 매칭되면 가장 구체적인 호스트의 정책 전체를 선택한다. include_subdomains는 적용 범위만 결정하고 도메인 경계를 확인한다. 목적 FOCUS/GENERAL은 ALLOW, DISTRACTION은 BLOCK/RECORD다. feature_code는 YOUTUBE_SHORTS/YOUTUBE_RECOMMENDATIONS/YOUTUBE_COMMENTS/YOUTUBE_AUTOPLAY/INSTAGRAM_REELS/INSTAGRAM_RECOMMENDATIONS이며 host와 호환해야 한다.

이메일은 인증 주소를 계정 식별 수단으로 사용한다. 비밀번호는 단방향 해시(Argon2id)를 서버에 저장하고 원문은 로그/이벤트에 남기지 않는다. 이메일 인증24시간, 비밀번호 재설정30분, 단회 사용. 로그인 실패 제한은 계정+IP 각각5회/분, 메일 재발송1분 간격·5회/시간 설계값이다. 로그인 성공 시 세션 ID를 교체한다.

Google은 OIDC의 issuer/audience/expiry/nonce와 서명을 검증한다. 카카오는 서버 code 교환 후 공식 사용자 정보의 id로 식별한다. redirect는 사전 등록 정확 일치, state 단회 검증, client secret은 Server에만 둔다. 카카오 이메일은 제공되지 않을 수 있으므로 내부 사용자 ID와 provider subject를 기본키로 삼는다. 소셜 취소는 새 회원을 만들지 않는다. 제공자 인증만 끝난 최초 사용자는 가입 확인 전 서비스 계정이 생성되지 않는다.

확장 연결은 설치 증명+S256 code challenge, 서버 승인과 단회 code 교환을 사용한다. 연결 요청5분, code60초, access15분, 회전 refresh30일. refresh 해시 저장·재사용 탐지, executor 소유 확인. 사용자 로그아웃은 로컬 해제/기록 보존→연결 종료→Web 인증 종료다. 인증 자연 만료가 진행 중 세션을 임의로 비회원 소유로 바꾸지 않는다.

## API 목록
| API ID | 방식·경로 | 인증 | 입력 | 응답 | 주요 오류 |
|---|---|---|---|---|---|
| API-AUTH-01 | GET /api/v1/auth/csrf | 공개 | 없음 | 200 {csrf_token} | 503 |
| API-AUTH-02 | POST /api/v1/auth/signup | 공개+CSRF | email,password,display_name,terms_version | 201 {user_id,status:PENDING_VERIFICATION} | 422 VALIDATION_FAILED; 409 EMAIL_IN_USE |
| API-AUTH-03 | POST /api/v1/auth/login | 공개+CSRF | email,password | 200 User + Web 쿠키 | 401 INVALID_CREDENTIALS; 403 EMAIL_UNVERIFIED |
| API-AUTH-04 | GET /api/v1/auth/me | W/E | 없음 | 200 User | 401 |
| API-AUTH-05 | POST /api/v1/auth/logout | W | 없음 | 204 Web 인증 폐기; 제품 로그아웃의 마지막 단계 | 409 ACTIVE_EXECUTION_OR_LINK; 401 |
| API-AUTH-06 | GET /api/v1/auth/social/{provider}/authorize | 공개 | provider=google/kakao; mode=login/link; return_path 내부허용값 | 302 제공자; state/nonce 저장 | 422 INVALID_PROVIDER |
| API-AUTH-07 | GET /api/v1/auth/social/{provider}/callback | state 검증 | code,state 또는 error | 303 가입 확인/로그인 완료/연결 화면 | SOCIAL_CANCELED; INVALID_STATE; IDENTITY_CONFLICT |
| API-AUTH-08 | POST /api/v1/auth/social/complete | 단회 인증증명+CSRF | ticket,terms_version,display_name | 201 User + 쿠키; 최초 가입만 | 409 IDENTITY_CONFLICT |
| API-AUTH-09 | POST /api/v1/auth/identities/link | W+최근5분 재인증 | ticket | 200 User; 두 인증의 동일 사용자 결합 | 409 IDENTITY_ALREADY_LINKED |
| API-AUTH-10 | POST /api/v1/auth/email/verify | 단회 token | token | 200 verified | 410 TOKEN_EXPIRED; 409 USED_TOKEN |
| API-AUTH-11 | POST /api/v1/auth/password/reset-requests | 공개+CSRF | email | 202 동일 응답; 발송 여부 노출 안 함 | 429 |
| API-AUTH-12 | POST /api/v1/auth/password/reset | 단회 token | token,new_password | 204 비밀번호 교체·기존 Web/refresh 폐기 | 410 TOKEN_EXPIRED; 422 |
| API-AUTH-13 | POST /api/v1/auth/email/verification-requests | 공개+CSRF | email | 202 동일 응답 | 429 |
| API-AUTH-14 | POST /api/v1/auth/reauthenticate | W | password 또는 기존연결 provider의 단회 ticket | 204 현재 사용자 재인증 시각 갱신 | 401 INVALID_CREDENTIALS;409 IDENTITY_MISMATCH |
| API-EXT-01 | POST /api/v1/extension-installations | 공개 제한 | executor_id UUID,client_version | 201 {executor_id,installation_proof} 최초1회 | 409 INSTALLATION_EXISTS |
| API-EXT-02 | POST /api/v1/extension-link-requests | I | executor_id,code_challenge,state,callback_uri | 201 {link_request_id,verification_uri,expires_at} | 422 INVALID_CALLBACK |
| API-EXT-03 | POST /api/v1/extension-link-requests/{id}/approval | W | approve boolean | 200 승인 상태 | 409 GUEST_SESSION_ACTIVE |
| API-EXT-04 | POST /api/v1/extension-tokens | I | link_request_id,code,code_verifier | 200 {access_token,refresh_token,expires_in} | 401 INVALID_GRANT |
| API-EXT-05 | POST /api/v1/extension-tokens/refresh | refresh | refresh_token | 200 회전된 토큰 | 401 TOKEN_REUSE |
| API-EXT-06 | DELETE /api/v1/extension-installations/{executor_id}/connection | W/E | 없음; 실제 해제 증거 필수 | 204 회원 연결 종료 | 409 RELEASE_UNCONFIRMED |
| API-EXT-07 | GET /api/v1/extension-installations | W/E | 없음 | 200 Installation[] | 401 |
| API-SITE-01 | GET /api/v1/sites | W/E | purpose?,cursor?,limit? | 200 List<Site> | 400 INVALID_CURSOR |
| API-SITE-02 | GET /api/v1/sites/{site_id} | W/E | 없음 | 200 Site + ETag | 404 |
| API-SITE-03 | POST /api/v1/sites | W/E | SiteWrite | 201 Site | 409 SITE_SCOPE_CONFLICT(정확한 호스트 중복);422 |
| API-SITE-04 | PATCH /api/v1/sites/{site_id} | W/E | SiteWrite의 변경 필드 + If-Match | 200 Site | 409 SITE_SCOPE_CONFLICT(정확한 호스트 중복);412 VERSION_CONFLICT;422 |
| API-SITE-05 | DELETE /api/v1/sites/{site_id} | W/E | If-Match | 204; 과거 스냅샷 유지 | 412 |
| API-POLICY-01 | GET /api/v1/content-policy | W/E | 없음 | 200 ContentPolicy + ETag | 401 |
| API-POLICY-02 | PUT /api/v1/content-policy | W/E | ContentPolicyWrite 전체 + If-Match | 200 ContentPolicy | 422 INVALID_SCOPE;412 |
| API-CAP-01 | GET /api/v1/capabilities | W/E/I | client_version | 200 Capability[] | 422 CLIENT_UNSUPPORTED |
| API-CAT-01 | GET /api/v1/catalogs/adult-domains | W/E/I | known_version? | 200 Catalog 또는304 | 503 NO_VALID_CATALOG |
| API-SESSION-01 | POST /api/v1/sessions | W/E | executor_id,duration_minutes | 202 Session STARTING + operation_id | 409 ACTIVE_SESSION_EXISTS; EXECUTOR_OFFLINE |
| API-SESSION-02 | GET /api/v1/sessions/current | W/E | executor_id? | 200 Session 또는 null | 401 |
| API-SESSION-03 | GET /api/v1/sessions | W/E | from_date,to_date,status?,cursor | 200 List<Session> | 422 |
| API-SESSION-04 | GET /api/v1/sessions/{session_id} | W/E | 없음 | 200 Session | 404 |
| API-SESSION-05 | GET /api/v1/sessions/{session_id}/policy | W/E | 없음 | 200 Snapshot | 404 |
| API-SESSION-06 | POST /api/v1/sessions/{session_id}/end | W/E | 없음 | 202 Session ENDING + operation_id | 409 INVALID_TRANSITION |
| API-SESSION-07 | POST /api/v1/sessions/{session_id}/pause | W/E | 없음 | 202 Session PAUSING + operation_id | 409 INVALID_TRANSITION |
| API-SESSION-08 | POST /api/v1/sessions/{session_id}/resume | W/E | 없음 | 202 Session RESUMING + operation_id | 409 INVALID_TRANSITION; EXECUTOR_OFFLINE |
| API-NOTE-01 | GET /api/v1/sessions/{session_id}/note | W/E | 없음 | 200 Note (없으면 text 빈값,version0) | 404 SESSION_NOT_FOUND |
| API-NOTE-02 | PUT /api/v1/sessions/{session_id}/note | W/E | text 0~2000자,If-Match | 200 Note | 412;422 |
| API-EXEC-01 | GET /api/v1/executors/{executor_id}/commands | E | cursor,known_revision | 200 {commands,next_cursor,server_time} | 403 EXECUTOR_MISMATCH |
| API-EXEC-02 | POST /api/v1/executors/{executor_id}/reports | E | ExecutionReport | 200 {result,desired_revision} | 409 REPORT_CONFLICT |
| API-EXEC-03 | POST /api/v1/executors/{executor_id}/reconcile | E | journal_summary,local_actions[] | 200 {desired_state,revision,acknowledged_actions} | 409 RECONCILE_REQUIRED |
| API-OP-01 | GET /api/v1/operations/{operation_id} | 원요청 주체 | 없음 | 200 {status,resource_id,error} | 404 |
| API-EVENT-01 | POST /api/v1/events/batch | E | events[] 최대100,1MiB | 200 {items:[event_id,status,error]} | 413;422 |
| API-EVENT-02 | POST /api/v1/events/status | E | event_ids[] 최대100 | 200 {items:[event_id,status]} | 422 |
| API-USAGE-01 | POST /api/v1/usage-segments/batch | E | segments[] 최대100 | 200 항목별 accepted/duplicate/rejected | 409 BODY_MISMATCH |
| API-LOG-01 | GET /api/v1/access-events | W/E | 기간,session_id?,host?,event_type?,cursor | 200 List<Access> | 422 |
| API-LOG-02 | GET /api/v1/access-events/{event_id} | W/E | 없음 | 200 Access + 당시 정책 | 404 |
| API-STAT-01 | GET /api/v1/statistics/summary | W/E | from_date,to_date | 200 Metrics | 422 |
| API-STAT-02 | GET /api/v1/statistics/targets | W/E | from_date,to_date,cursor | 200 List<TargetMetrics> | 422 |
| API-STAT-03 | GET /api/v1/statistics/hourly | W/E | from_date,to_date | 200 24개 시간대 Metrics | 422 |
| API-STAT-04 | GET /api/v1/statistics/usage | W/E | from_date,to_date,host? | 200 {total_ms,by_site,quality,as_of} | 422 |
| API-DASH-01 | GET /api/v1/dashboard | W/E | 없음 | 200 {current_session,recent_sessions,recent_access,summary} | 401 |
| API-SCHEDULE-01 | GET /api/v1/schedules | W/E | executor_id?,cursor | 200 List<Schedule> | 422 |
| API-SCHEDULE-02 | POST /api/v1/schedules | W/E | ScheduleWrite | 201 Schedule | 422 INVALID_TIMEZONE |
| API-SCHEDULE-03 | PATCH /api/v1/schedules/{id} | W/E | 변경 필드,If-Match | 200 Schedule | 412;422 |
| API-SCHEDULE-04 | DELETE /api/v1/schedules/{id} | W/E | If-Match | 204 미시작 건 취소; 실행 세션 유지 | 412 |
| API-SCHEDULE-05 | GET /api/v1/schedules/{id}/occurrences | W/E | 기간,cursor | 200 List<Occurrence> | 404 |
| API-SCHEDULE-06 | POST /api/v1/schedule-occurrences/claim | E | schedule_id,scheduled_start_at,version | 202 Session/기존 결과 또는200 대기·건너뜀 | 409 VERSION_CONFLICT |
| API-AI-01 | POST /api/v1/analysis-jobs | W/E | from_date,to_date,consent_version | 202 AnalysisJob | 422 INSUFFICIENT_DATA;403 CONSENT_REQUIRED;503 PROVIDER_UNAVAILABLE |
| API-AI-02 | GET /api/v1/analysis-jobs/{id} | W/E | 없음 | 200 AnalysisJob + Result? | 404 |
| API-AI-03 | GET /api/v1/analysis-jobs | W/E | 기간,cursor | 200 List<AnalysisJob> | 422 |
| API-AI-04 | PUT /api/v1/analysis-consent | W | accepted boolean,notice_version | 200 {accepted,notice_version,updated_at} | 422 |
| API-IMPORT-01 | POST /api/v1/guest-imports | E | manifest:설정·완료 세션 목록,source_installation_id | 202 ImportBatch | 409 SOURCE_BOUND_TO_OTHER_ACCOUNT |
| API-IMPORT-02 | PUT /api/v1/guest-imports/{batch_id}/items/{source_item_id} | E | ImportItem | 200 항목별 결과 | 409 SOURCE_CONFLICT;422 |
| API-IMPORT-03 | GET /api/v1/guest-imports/{batch_id} | W/E | 없음 | 200 ImportBatch | 404 |
| API-IMPORT-04 | GET /api/v1/guest-imports | E | cursor | 200 List<ImportBatch> | 401 |

## 실행 명령과 복구 순서

Server는 소유/활성 잠금을 확인하고 Snapshot·Session·Command·Operation을 한 트랜잭션으로 기록한다. Extension은 명령을 durable journal에 적은 후 실행하고 report를 로컬에 저장한 뒤 전송한다. Server는 desired_revision과 command_id를 대조해 상태를 확정한다. 보고 유실은 같은 report_id로 재전송한다. 늦은 APPLY 결과가 최신 ENDING을 RUNNING으로 바꾸지 않는다.

명령 조회는 활성 UI/세션에서5초 목표 long-poll, 비활성은30초 이상 alarm과 UI·탭 이벤트 재동기화를 사용한다. MV3가 워커를 중단할 수 있으므로 폴링만으로 정시 실행·해제를 보장하지 않는다. 예약·종료 기준시각과 규칙 소유 정보를 로컬에 저장하고 워커 시작/팝업/탐색 시 재평가한다. 모든 APPLY에는 execute_before가 있으며 기한 지난 적용은 해제 보고로 처리한다.

오프라인 중 회원 기존 세션은 고정 스냅샷으로 정지/재개/종료할 수 있으나 새 회원 세션·새 예약 claim은 연결 복구 후만 가능하다. 비회원 로컬 신규 시작은 가능하다. 재접속은 journal 대조가 먼저이고 오래된 서버 APPLY를 먼저 실행하지 않는다. 중복·타계정 실행을 막는 active lock은 실제 해제 보고 전 해제하지 않는다. 오래된 lock 정리는 heartbeat 만료만으로 수행하지 않는다.

## 로컬 메시지 계약

비회원은 API를 호출하지 않고 Extension 내부 메시지로 같은 검증을 수행한다. 공통 {request_id,type,owner_context,payload}; 응답 {request_id,status,data,error}. type=GET_STATE/SAVE_SITE/SAVE_CONTENT_POLICY/START/PAUSE/RESUME/END/SAVE_SCHEDULE/SAVE_NOTE/QUERY_RECORDS/IMPORT_PREVIEW. Core가 실제 발신 extension context·tab/frame·세션을 확인한다. 페이지에서 계정 ID·임의 명령을 보내 실행할 수 없게 한다. Content→Core 관찰은 OBSERVE_ACCESS/USAGE_BOUNDARY/FEATURE_RESULT/IMAGE_RESULT만 허용하고 크기·스키마·세션을 검증한다. 원격 AI·회원 API key는 Content에 전달하지 않는다.

## 외부 adapter 계약

AI provider 인터페이스 generate(집계 JSON,출력 JSON schema,request_id)→Result 또는 PROVIDER_FAILED. 인증·청구·모델 지정은 Server 환경 설정으로 주입한다. provider 미설정 시503, 정상 분석으로 대체 표시하지 않는다. 모델/도메인 목록은 버전·checksum·출처 manifest를 갖는 배포 자산이다. 성인 도메인 출처는 공개 porn 전용 목록만 검토하며 광고/추적/일반 사회관계망 목록 전체를 성인 목록으로 사용하지 않는다. 검증된 배포 목록이 없으면 기능 불가 상태가 명세된 동작이다.

## 공식 기술 근거

- [Chrome alarms](https://developer.chrome.com/docs/extensions/reference/api/alarms): 실행 지연·절전·재생성 조건 때문에 구간 재평가를 설계했다.
- [Extension worker 수명](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle): 메모리 변수만으로 세션을 보존하지 않는다.
- [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect), [카카오 로그인](https://developers.kakao.com/docs/ko/kakaologin/rest-api): 제공자별 인증 검증을 분리한다.
- [NSFWJS](https://nsfwjs.com/): 학습된 브라우저 분류기 adapter의 후보. FOCURVE 정확도·성능 검증 결과가 아니다.

## 기본값과 경계 보완

신규 ContentPolicy는 version1, keywords/adult_domains/image_blur/usage_tracking enabled=false, rules·예외·custom_hosts 빈 배열, 이미지 민감도/강도 MEDIUM이다. GET은 이 기본 객체를 반환한다. 저장 시 변경한 활성화만 다음 세션에 반영한다. 이용 시간 수집은 ANALYSIS-01에서 명시적으로 켤 수 있고 미활성 구간은 NOT_COLLECTED다.

삭제된 동일 host 재등록은 기존 sites 행을 복원하고 version 증가, 기존 세션 스냅샷은 변경하지 않는다. 비밀번호 재설정으로 인증을 폐기해도 기존 실제 세션 소유자·기록은 유지하고 복구 규칙을 적용한다. 소셜 계정 연결 전 재인증은 API-AUTH-14로 현재 계정임을 검증한다. 최초 가입 약관 동의는 users의 terms_version·terms_accepted_at으로 저장한다.

로그아웃의 연결 해제 대상은 사용자가 확인한 현재 실행 설치다. 다른 설치를 무조건 삭제하지 않는다. 활성 계정 세션의 실제 해제가 확인되어야 종료를 완료한다. AUTH-05가 별도 브라우저의 남은 연결까지 무조건 요구하는 의미는 아니다. 서버가 logout context의 대상 설치와 active lock을 확인한다.

## 예약 상태·사유 직렬화

Occurrence.status는 PENDING/WAITING_CONFLICT/STARTING/RUNNING/FINISHED/SKIPPED를 사용한다. 만료·존재하지 않는 현지 시각은 SKIPPED 상태와 reason=EXPIRED/NONEXISTENT_TIME으로 구분하며 합성 상태 문자열을 사용하지 않는다. 가져오기 항목의 SKIPPED_CONFLICT는 다른 도메인의 결과값이며 예약 상태가 아니다.


## 2026-10-08 사용자 명시 변경

[호스트별 정책 우선순위](../02_시스템_테크설계/10_호스트_정책우선순위.md)를 적용한다. 부모·자식 동시 등록을 허용하며 정확한 호스트만 중복 거절한다. 새 snapshot1.2, 가장 구체적인 행 선택, 기존 snapshot1.1/기존 사용자 자료 보존. 실제 Extension 연동은 미검증이다.


## 2026-10-08 인증·복구·가져오기 구체화
사용자 지시에 따른 인증 연락처·명시 연결·메일 환경, link proof polling, reconcile END/watermark, ImportItem 및 Web 조회 확장은 [연결 계약](11_인증_실행복구_가져오기_연결계약.md)을 따른다. Server 구현 기준이며 Extension 팀 합의·실제 통합 완료가 아니다. V7 인증 버전, V8 link_evidence/execution_reconciliations/session_watermarks, V9 batch-item 연결/검증 payload 보존은 기존 자료를 삭제하지 않는 추가 migration이다. API-IMPORT-04 GET list는 W/E로 확장한다. 기존 자료와 snapshot1.1을 일괄 변환하지 않는다.

## 2026-10-09 사용자 확정: 일반 이메일 가입 인증번호
일반 이메일 가입은 가입 화면에서 6자리 번호를 확인한 후 계정을 생성한다. Google·카카오 가입/연결 및 소셜 이메일 보완 흐름은 유지한다. 기존 PENDING 회원의 링크 인증은 호환 경로로 유지한다. 사용자 화면에 Mailpit 링크를 표시하지 않는다.

- POST `/api/v1/auth/email/signup-code-requests`: `{email}` → 202 `{request_id, expires_at, resend_after_seconds:60, max_attempts:5}`. 유효 익명 세션 쿠키·Origin·CSRF 필수. 번호는 응답에 반환하지 않는다.
- POST `/api/v1/auth/email/signup-code-verifications`: `{request_id,email,code}` → 200 `{verified:true,verification_proof,proof_expires_at}`. 현재 세션과 이메일에 바인딩한다.
- POST `/api/v1/auth/signup`: 기존 필드에 `verification_proof` 필수. 성공 ACTIVE·email_verified=true. 동일 멱등 키 재요청은 동일 결과, 새 요청으로 증명 재사용은 거절. 기존 입력·약관·CSRF 검증 유지.
- 번호 6자리(앞자리 0 포함), 10분 만료. 이메일당 60초 간격·시간당 5회, IP 발송 시간당 20회·번호 확인 분당 30회. 오입력 5회 후 번호 잠금. 번호 및 검증 증명 일회용, 증명 10분 유효. 같은 세션·이메일 재발송 성공 시 이전 번호/증명 무효. SMTP 실패 시 새 번호 저장 롤백·기존 번호 보존, 시도 제한 유지.
- 오류: 422 CODE_FORMAT_INVALID/CODE_INVALID; 410 CODE_EXPIRED; 409 CODE_SUPERSEDED/CODE_USED; 429 RATE_LIMITED/CODE_ATTEMPTS_EXCEEDED; 403 EMAIL_CODE_REQUIRED; 503 MAIL_UNAVAILABLE.
- 저장 V10 email_signup_codes: 원문 저장 금지, 세션 쿠키를 키로 한 코드 HMAC·증명 SHA-256. 회원·인증 ID·증명 소비·멱등 결과 동일 트랜잭션.
- 새로고침은 탭 sessionStorage에 이메일·요청·증명 유지, 비밀번호·입력 번호 미저장.
- 실제 외부 발송: MAIL_MODE=external + 암호화 SMTP. 현재 인증정보 미제공: Gmail·네이버 실제 수신 미검증. 로컬 SMTP/모의 발송과 구분.

### 2026-10-09 메일 표시 계약 보완
SIGNUP_CODE 메일 제목 FOCURVE 회원가입 이메일 인증. multipart HTML + 일반 텍스트, 로고/번호/안내는 외부 이미지에 의존하지 않음. 본문 표시만 변경, API·번호 6자리·10분·일회용·재발송/오입력 제한·증명/계정 규칙 유지. Gmail 실제 수신/PC 라이트 HTML 정상 사용자 확인; 네이버/모바일/다크/가입흐름 미검증. html-mail-report.md에 구분 기록.

## 2026-10-09 확정 정책 우선 적용
이 문서의 기존 Event1.1·단일사유·Snapshot1.2 무조건발급 설명과 다른 최신사용자 정책은 [정책 계약·이벤트1.2·호환성 게이트](12_정책계약_이벤트12_호환성게이트.md)를 적용한다. 기존1.1 원문/이력은 보존한다. Server 구현·자동 통과와 실제Core/Content/Chrome 통합은 별도 상태다.

## 2026-10-09 PR18 리뷰 수정의 Event/조회 형식

Event1.2의 FEATURE 포함 복수사유는 BLOCKED_FEATURE_ACCESS/FEATURE + feature_code=YOUTUBE_SHORTS로 보내고 대표 reason은 사유 우선순위로 정한다. TYPE와 대표 reason을 동일값으로 강제하지 않는다. FEATURE가 없는 차단은 BLOCKED_SITE_ACCESS/SITE이며 feature_code를 포함하지 않는다. 잘못된 조합은 INVALID_SCHEMA, 미설정 기능·비활성 전역정책·예외와 충돌하는 사유는 POLICY_MISMATCH다. 1.1은 기존 타입·대표 사유 검사 유지. 세부 조건은 [정책 계약](12_정책계약_이벤트12_호환성게이트.md)의 PR18 리뷰 수정 절을 따른다.

기록 목록/상세의 추가 응답 blocked_reasons:string[], matched_policy_host:string|null, repeat_count:number를 Web에서 사용한다. 구형 응답에 메타데이터가 없으면 실제 사유를 추측하지 않고 미확인으로 표시한다. RECORDED_ACCESS의 legacy RECORD는 차단 사유가 아니다. API 경로·인증·소유권·페이지네이션 변경 없음.

## D-01~D-10 정책 개정과 현행 API 한계

신규 교환 숫자 version은 1..9007199254740991 정수이며 0/음수/소수/string/null/bool 거절. UUID·문자열 catalog/model metadata와 구분. 현재 Server signed64 검사 강화는 후속 구현이다. Note 부재 version0는 충돌 검토 대상이며 값 재작성 금지.

duration은 확인 누적 RUN 목표, remaining은 목표−확인 누적. 복구 대기에서 고정 planned_end_at−현재시각으로 남은 시간을 차감하지 않는다. 현행 최초 APPLY/END/reconcile은 비종료 중단·재개를 지원하지 않으며 새로운 API/상태는 별도 설계·구현 대상이다. Journal1.1 END-only는 유지한다.

HTTP200≠이벤트 전체성공. PENDING_DEPENDENCY는 저장·최종처리 추적, REJECTED는 원문/오류 격리,503·응답유실은 상태조회/동일원문 재전송. D06 메시지와 D09 token 응답유실 절차는 최종계약의 미확정 기술안을 따른다.

## 2026-10-09 로컬 병합 차단 수정 — 현재 지원 경계

로컬 제품 코드만 수정했으며 원격 PR18 HEAD b05d9a0은 변경되지 않았다. 신규 Snapshot source_version/sites[].version/content_policy.version에 SafeVersion(1..9007199254740991)을 공통 적용했다. 가져오기 canonical JSON은 이전에도 safe 정수 초과를 INVALID_SCHEMA로 거절했으며, 새 Snapshot/ImportedSession 공통 guard로 직접 경로도 보완했다. 사이트 생성1·수정/복원/삭제와 메모 저장의 버전 증가는 VERSION_LIMIT으로 상한 초과를 원자 거절한다. 미작성 Note version0는 그대로다. 역사 Snapshot 원문을 무조건 재검증/재작성하지 않는다.

Session 조회는 automatic_recovery_supported=false, time_accounting_mode=LEGACY_WALL_CLOCK을 추가 반환한다. 현재 고정 planned_end_at·기존 END/RELEASED·Journal1.1은 유지하며, 비종료 RESUME action은 기존처럼 거절한다. Web은 자동복구·중단 중 잔여 보존이 미지원임을 명확히 안내한다. D01/D05의 승인 정책은 유지하고 전체 구현은 후속 Server/Core 공동 작업으로 분리한다. 이 필드가 새로운 recovery API나 capability handshake는 아니다.

남은 기술 경계: 일반 focus_sessions.version의 극단 상한에서는 신규 교환 숫자 상한과 필수 종료/해제 가능성이 충돌한다. 종료/보고에 무조건 VERSION_LIMIT을 적용하면 잠금을 유지하게 되므로 기존 종료 경로를 보존했다. 일반 세션 version의 legacy/교환 표현·상한 처리 정책은 후속 합의·독립 리뷰 필요이며 D03 전체 구현 완료로 표시하지 않는다. revision/seq 의미·범위도 자동 재정의하지 않는다.

D06 메시지·규칙 ID/priority/freeze 및 D09 응답유실 추가 API는 계속 미확정/미검증이다. 실제 Chrome·회원 Extension 통합 NOT RUN, 신규 Snapshot1.2 운영 발급 OFF 유지. 새 migration/기존 DB·환경 변경 없음.

## 2026-10-09 D-03 session.version 최종 호환 처리

사용자 확정 정책에 따른 로컬 구현. 기준 HEAD b05d9a095b229efe310d5c791189eefb0d30300b, 김다훈 담당 Server/API/DB·연결 Web, codex/server-event12-integration. 기존 이력의 session.version 조율 필요/B-01은 당시 판정이며 아래 결과로 갱신한다.

- 생성(start/guest import)은 version1. 새 APPLY→RUNNING 증가는 양의 안전 정수만 가능하고 MAX−1→MAX까지 허용한다. MAX/초과/잘못된 버전의 실제 APPLIED 보고는 사실 접수하되 RUNNING으로 확정하지 않고 UNKNOWN/VERSION_LIMIT 및 RELEASE_POLICY를 발행한다. 보고 HTTP ACCEPTED는 실행 성공이 아니다. 실제 해제 확인 전 잠금을 유지한다.
- 종료/RELEASED/FAILED/UNCONFIRMED/reconcile END 등 안전 처리에서 기존 version이 1..MAX−1이면 정상 증가, MAX 또는 역사 초과이면 값을 그대로 보존하고 증가하지 않는다. 새 초과 값을 생성하거나 기존 값을 clamp/초기화하지 않는다. MAX는 9007199254740991. Session version은 이 예외에서 상태 변경 감지용 단독 validator로 사용할 수 없다.
- Session 응답의 version은 정상 범위 number, 역사 초과는 정확한 십진 string(number|string). version_increment_blocked:boolean은 증가 불가 여부이며 종료 금지나 해제 완료를 뜻하지 않는다. get/current/list/start/end/멱등 재전송에 적용한다. 과거 응답 캐시의 DB 원문도 보존하고 응답 표현만 정규화한다. Web은 Number/parseInt로 변환하지 않는다.
- session resource version과 desired_revision/known_revision/local_action_seq는 별개다. 현재 Session 종료 API는 If-Match session.version에 의존하지 않으며 소유권/설치 인증/행 잠금/명령 revision/보고 hash·중복/행동 sequence 검사를 그대로 사용한다. Event1.1/1.2, Snapshot1.1/1.2, Journal1.1 및 frozen payload는 변경하지 않는다. 독립 revision/seq 극단값의 별도 확대 변경은 이번 범위가 아니다.
- 실제 HTTP/격리 MySQL에서 1/MAX−1/MAX/MAX+1/Long.MAX_VALUE의 명령 종료·UNCONFIRMED·RELEASED와 오프라인 Journal END/reconcile, 중복·잘못된 revision·다른 소유자 거절을 확인한다. 역사 version/Snapshot 불변, 잠금 해제 및 확인된 500ms 집계 유지. Backend 최종127/127·패키징(21:01:59 KST), Frontend114/114·빌드 PASS. mail/OAuth/실제 Chrome·회원 Core·Content는 NOT RUN. 상세 증거는 PR18_D03_session버전_최종호환_수정검증보고서.md.
- Snapshot1.2 신규 발급 기본 OFF, 테스트 profile만 합성 검증 gate 사용. 전체 자동복구는 후속이며 전체 AC/MVP 완료로 승격하지 않는다. 이번 로컬 수정은 독립 재리뷰가 필요하다. Commit/Push/PR 변경/병합 없음.

최종 추가 경합 검증: 미전달 APPLY는 상한 검사 후 해제 명령으로 전환한다. 이미 적용된 APPLY가 상한 감지/해제 명령과 경합하면 유효 실행 구간 증거만 보존하며 현재 revision·UNKNOWN을 되돌리지 않는다. 실제 RELEASED 뒤 구간을 닫고 잠금을 해제한다. 최신 보고서와 session-version-backend.log 참조.


## 2026-10-09 RELEASED 보고 순서 의존성 로컬 수정·검증

독립 재리뷰의 High R-D03-01(당시 RELEASED 선행 409/잠금 유지)을 후속 로컬 수정했다. 과거 판정·이력은 보존한다. 기준 HEAD b05d9a095b229efe310d5c791189eefb0d30300b, codex/server-event12-integration, 김다훈 Server/API/DB 담당. 제품 변경은 ExecutionService의 RELEASED 구간 복구 및 실제 HTTP 회귀 테스트이며 새 상태/API/마이그레이션은 없다.

- 인증된 설치·소유자·세션·현재 명령/revision 검증을 통과한 RELEASED의 닫힌 RUN 증거를, 선행 APPLY 보고가 없고 DB 구간도 없을 때 원래 APPLY 명령·frozen Snapshot에 결속해 복구한다. APPLY 발급 시각(기존 60초 허용)·실행 기한·시작/종료/관측 시각·duration·interval ID를 검증한다. 기존 구간은 덮어쓰지 않고 알려진 RUN의 누락/열린 증거·잘못된 원문은 거절한다. 해제 확인은 인증된 Core의 RELEASED/observed_at 보고 계약이며 Server가 Chrome DNR을 직접 관측한 의미가 아니다.
- 동일 트랜잭션에서 구간 종료·확인된 시간 집계·ENDED 또는 START_FAILED·명령 ACK·잠금 해제를 수행한다. 늦은 구 revision APPLY는 감사 기록만 남기며 종료 상태/시간/버전을 되돌리지 않는다. 동일 report_id/동일 원문은 DUPLICATE, 다른 원문은 REPORT_CONFLICT이다.
- Codex 실행: Backend138/138·패키징, Frontend114/114·빌드 PASS. 추가 HTTP/MySQL 테스트10개(복수 하위 사례 포함), 별도 독립 HTTP 재현 probe PASS. 격리 MySQL8.4.8 127.0.0.1:60046/focurve_contract_test, 합성 회원/설치/보고 사용. 실제 Chrome·회원 Core/Content 통합 NOT RUN. 응답 유실은 클라이언트가 첫 결과를 무시하고 재전송한 모의 사례이며 Server 프로세스 강제 중단은 NOT RUN.
- MAX/MAX+1/Long.MAX_VALUE 버전 원본·frozen Snapshot 보존 및 잠금 해제 확인. 운영 Snapshot1.2 기본 OFF 유지(테스트 프로필만 ON). D01/D05 자동복구 전체 미구현 경계 유지. AC-SESSION-02/03/04의 -01/-03 중 Server 합성 보고 부분만 검증했으며 실제 적용/해제·전체 AC·MVP 완료로 승격하지 않는다.
- 증거: C:\Users\dahun\capstone-project\.reviews\pr18-20261009\PR18_RELEASED_보고순서_수정검증보고서.md 및 released-order 로그. 후속: 독립 재리뷰, 실제 Core 해제 증거·역순/재전송 통합. 이번 Commit/Push/PR 업데이트/병합 없음.

## 2026-10-10 APPLY 기간 전달 사용자 확정·로컬 구현

이전 ‘APPLY 명령에 기간 없음’ 설명은 develop 기준의 과거 구현 이력이다. 새 회원 APPLY_POLICY는 root duration_minutes(JSON 정수1~180)를 저장된 focus_sessions 목표값에서 생성해 포함한다. 조회/멱등·기존Snapshot/보고/Journal은 유지한다. 구형 저장명령은 다시 쓰지 않으며 기간 없는 APPLY를 Core가 기본시간으로 실행하지 않는다. RELEASE는 기간 필수화하지 않는다. 실제 Core 회원 adapter·Chrome 검증 및 자동복구는 미완료; 기본Snapshot1.2OFF 유지. 상세 규칙은 [APPLY 기간 전달 확정 계약](FOCURVE_APPLY_POLICY_기간전달_확정계약.md)을 따른다.
