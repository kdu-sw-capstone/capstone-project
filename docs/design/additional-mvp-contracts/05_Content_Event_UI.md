# Content·Event·UI 계약

## 16개 옵션

`feature-registry.json`의 ID·적용 페이지·route hint·ON/OFF·오류·SPA·증거·수용 기준이 개별 원본이다. route hint는 실제 selector 검증 성공 선언이 아니다. 16개 요구사항은 사용자 확정이다. 기존 feature enum과 일치하는6개도 baseline executor 실제 지원을 별도 확인해야 한다. selector/domain/route profile은 version+hash로 묶고 프로필 불일치 시 UNCONFIRMED/FAILED로 반환한다.

YT-01홈,02Shorts,03댓글,04추천,05구독,06탐색,07상단바,08종료카드,09흑백,10자동재생. IG-01스토리,02Reels,03탐색,04댓글,05제안항목,06흑백. 상단바는 YouTube 내부 검색 포함, browser주소창/FOCURVE탈출UI 제외; 구독숨김은 구독취소가 아니다. 추천과 종료카드는 별개. IG탐색이 검색 전체까지 확대되는지 추가 검토이며 기본은 explore만. 자동재생OFF는 다음 자동 전환 방지이며 사용자의 수동 재생을 막지 않는다.

공통 ON: 검증 scope에서 observer 준비+현재 eligible targets 적용+동적 재등장 대응. OFF: 이 옵션의 claim/observer/media만 실제 해제, 다른 owner·사용자 원래 상태 보존. 대상없는 적합 document는 observer_ready와 NOT_APPLICABLE, 실패는 error/미확인, 한 옵션 실패를 전체 APPLIED로 숨기지 않는다. evidence의 restricted<=eligible, errors>0이면 APPLIED 불가. Shorts/Reels direct·search·추천·SPA·BFCache는 문서/URL 재검증 후 eligible media를 실제 멈추고 hiding만 성공했다고 주장하지 않는다. Core가 navigation ID를 발급하고 Content는 candidate/effect만 보고한다.

blur는 로컬 이미지/thumbnail만, HIGH 고정, 클릭보기/재클릭가림. src/srcset 변경 시 reveal cache 무효화, 모델·image generation hash 일치 결과만 사용, stale 결과 폐기. CORS로 픽셀 접근 불가/추론실패는 SAFE로 간주하지 않고 mask+이유/재시도를 표시한다. 비디오 프레임/canvas/CSS background 및 서버 이미지 proxy 확대는 제외한다. InceptionV3→MobileNetV2 2단계 방향을 유지하되 thresholds/분류종류/timeout/동시성/메모리는 검증 전 profile activation 금지. [NSFWJS upstream](https://github.com/infinitered/nsfwjs)은 코드·모델 사용 근거이며 FOCURVE 정확도 증명이 아니다.

URL_BOUNDARY_1 후보: http(s) 파싱→UTS46 nontransitional/STD3 host→host/path/query/fragment값만 1회 percent UTF-8 decode→NFKC+casefold→Unicode letter/number 경계 일치. key명·title/body/comment·사용자 입력중문자열은 검사하지 않는다. 중복 decode/invalid percent는 검사불가 오류, 임의 우회성공으로 표시하지 않는다. 원본 URL·query를 Server로 전송/로그하지 않는다. host path만 차단하는 전역 DNR과 Content local URL 검사는 구분한다. 제한된 keyword 차단 사유를 사용자에게 보여주되 민감 query는 표시하지 않는다. 이 canonicalization은 기존 lowercase draft와 달라 joint vector 승인 대상이다.

성인 도메인은 출처 commit·개별 license·정규화·suffix·검증된 hash·배포 크기를 고정한다. [StevenBlack upstream](https://github.com/StevenBlack/hosts)의 기본+확장 병합 목록을 그대로 성인 목록으로 쓰면 광고/추적까지 막으므로 porn 출처 전용 추출/중복/false positive 검증이 필요하다. 업데이트 실패는 마지막 검증 artifact 유지; 첫 artifact 없으면 미지원/오류를 숨기지 않는다. 실제 Chrome DNR quotas는 [공식 DNR API](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)와 runtime constants로 budget 검사한다. 무제한 rule 삽입을 가정하지 않는다.

## 이벤트·통계

기존 Event1.2는 기존 endpoint/raw/집계 그룹(session_id,target_key)/index−1 반복 semantics를 보존한다. 신규 AMVP_ACCESS_EVENT_1은 별도 endpoint/table이며 migration으로 구형 raw를 고치지 않는다. actual target_host==target_key(정규화 실제host), matched_policy_host는 실제 매치된 정책host(없으면null). FEATURE는 YT-02/IG-02 실제 route 접근만; 댓글/흑백 토글은 접근이벤트가 아니다. Core는 한 navigation+binding에 최종 확정 한 이벤트만 발급, blocked reason freeze 후 늦은 classifier가 기존 event를 수정하지 않는다. 차단은 다른 classifier 대기 없이 즉시, 후속 정보는 별도 진단 report.

RECORDED_ACCESS는 RECORD대상 실제 접근, ALLOW는 허용 의도이지 모든 브라우징 수집 동의가 아니므로 접근기록을 만들지 않는다. blocked SITE/FEATURE는 실제정책·증거와 reason이 필요. dedup(event_id,hash)와 unique(executor,event_epoch,seq), nav identity 중복을 추가 검증한다. 권장 신규 반복 group=(owner_binding,analysis_group_id,target_key), analysis_group는 사용자day 범위이며 focus의 기존 group을 소급 교체하지 않는다. sort=(occurred_at,event_epoch,seq,event_id)로 안정화, 동일 timestamp도 unique event를 보존한다. 집계 n건의 repeat=max(n−1,0), ratio=repeat/n(n0이면null). 기간 경계에서 전체group index를 먼저 계산하고 조회구간에 투영하는 안과 조회구간 내 재계산 대안을 검토해야 한다. RC2 권장은 전체day group index 보존이며 조회기간에 count한 event의 repeat flag 합이다.

usage는 physical segment 합, policy attribution은 drilldown 전용이어서 account 합계를 늘리지 않는다. guest import 완료 history는 analysis projection에만 포함하고 source provenance/quality 유지; current quota와 분리한다. quality UNKNOWN/NOT_COLLECTED/NO_DATA/PARTIAL/COMPLETE를 0과 구분. session note 저장 실패는 이미 해제된 session을 다시 RUNNING으로 돌리지 않는다.

## Figma/UI 연결

file BeixHumD7TSoo9xMVzJkhO / node3053:8252, 기존 UI_BINDINGS 13쌍 유지. 이번 공식metadata는 Transport closed로 fresh NOT_VERIFIED; 원본 수정0, 시각적 일치 PASS0. Light/Dark node pairs: 대시보드10370/11606, 집중20396/20778, 사이트12843/13154, 기록26137/26417, 통계27496/27845, 예약29239/29412, 한도66352/69018, YT14119/14270, IG15556/15683, 키워드14421/14558, 성인블러14695/15122, 설정30010/30149, 차단37608/37896(모두3053:prefix).

| 기존 충돌 | 계약 처리 |
|---|---|
| UI-CON-01 키워드 본문/부분일치 문구 | URL전용·경계 유지, 문구만 추후 정리 |
| UI-CON-02 완료기록/설정 가져오기 혼재 | DEC07 records-only; settings import 별도 기존 계약 검토 |
| UI-CON-03 다음집중/상시 적용 혼재 | focus frozen vs runtime saved/applied 분리 |
| UI-CON-04 자정 초기화 | ledger삭제 아님, DEC06carry 표시 |
| UI-CON-05 40/44px·외부token·팝업폭 | node별 시각 확인 전 미검증 |

UIState는 저장·실제runtime·focus·수집quality를 분리한다. 저장성공→적용완료로 바꾸지 않는다. Empty/Loading/Error/dirty편집/취소/저장중/412/오프라인/미지원/UNKNOWN/부분해제 상태, applied/desired zone·효력시각·잔여한도·다음사용시각불명 안내를 모두 마련한다. 기존 잠정44개를 확정 누락 목록으로 재사용하지 않는다. 최종frame 갱신시 기존03_UI_검수.md UI_BINDINGS/수용기준만 갱신하며 3인 실행프롬프트 전체 재작성 불필요. actual API왕복/Chrome/LightDark/1280·1440·1920/팝업/zoom/keyboard/대비는 제품 PR에서 증거를 남긴다.

## RC2 T-01~03: 실제 결과 집합과 증거

`AMVP_CONTENT_2` Control의 Projection.features가 요청 원본이다. content.features는 호환 mirror로만 허용하고 enabled/required까지 동일해야 한다. 등록된 issued operation에서 요청·owner/full scope·epoch/generation·semantic hash·scan/profile·요청 ID를 조회한 후 응답을 대조한다. 응답 body를 곧 발급 기록으로 믿지 않는다. 같은 semantic 재시도는 새 request_id/채널 credential 허용, 의미가 달라지면 충돌이다.

결과 집합은 활성 FEATURE 각 1개 + 활성 KEYWORD/BLUR/ADULT_DOMAIN 각 1개 + block reason이 있으면 PAGE_GATE 1개다. 최대 16+4개. 필수 옵션 전부를 포함하며 중복·누락·미요청 결과는 거절한다. UPDATE에서 사라진 자기 claim도 RELEASE 결과로 포함하고, RELEASE는 실제 prior footprint 전체와 대조한다. 사용하지 않는 feature를 결과에 채워 성공을 부풀리지 않는다.

| 대상 | APPLIED/NOT_APPLICABLE 기준 | 실패·해제 |
|---|---|---|
| YT-02/IG-02 direct viewer | 현재 route profile/scan, 실제 viewer≥1·media≥1, 모든 대상 stopped/hidden/inert, playing/stop_error=0, media_stopped=true | 대상0/증거 부족은 OBSERVING/UNCONFIRMED, APPLIED나 N/A 금지. 재생 정지 실패는 FAILED/부분이면 PARTIAL |
| 일반 entry surface/기타 옵션 | 현재 전체 scan+observer, eligible>0이고 모두 restriction 확인. eligible0인 정상 비viewer만 NOT_APPLICABLE | DOM/SPA 생성 시 새 scan·현재 generation으로 재평가. N/A는 기능 적용 성공과 다름 |
| BLUR 독립 정책 | model profile/hash·현재 image generation, 대상 전체 분류, 민감 결과 mask 또는 사용자 reveal intent, click 재가림 준비 | 실패 mask를 유지해도 분류 성공 아님. stale 결과 적용 금지. 실패는 FAILED/PARTIAL+원장 보존 |
| KEYWORD 독립 정책 | URL_BOUNDARY_1·현재 URL hash·policy hash, MATCH 시 Core 확정 block reason+별도 PAGE_GATE 증거 | 검사 불가/예외 불일치 실패, 원본 URL/query 전송 금지. NOMATCH는 검사 수행 결과이며 차단 효과 주장이 아님 |
| ADULT_DOMAIN/PAGE_GATE | 검증 artifact의 검사 결과와 Core reason 대조, 게이트 DOM·media 증거 별도 | Content는 DNR 적용 성공을 주장할 수 없음. DNR은 Core 재조회 보고 |

형상 원본은 EffectEvidence(kind FEATURE), ContentPolicyEvidence(kind CONTENT_POLICY의4분기)이다. 모든 effect는 owner_binding_id/evidence_scope_sha256/scan_id/action/result/remaining_claim_count와 타입별 profile 또는 policy hash를 결속한다. keyword/blur만 켜도 features=[]로 독립 적용·해제할 수 있다. wire fixture와 content-review-fixtures의9시퀀스는 단독·복합·게이트·해제를 표현한다.

RECEIVED/APPLYING는 접수/진행이다. 모든 예상 결과가 APPLIED 또는 적절한 N/A이면 APPLIED, 전부 N/A이면 NOT_APPLICABLE, 일부 실패면 PARTIAL NACK, 전체 실패면 FAILED/UNCONFIRMED NACK이다. root remaining count는 자기 effect 합이며, 개별 실패를 root ACK로 감추지 않는다. 전역 UNSUPPORTED/FAILED NACK은 오류코드를 가진 무효과 거절로만 허용한다.

RELEASED는 prior own footprint·policy/profile/scan이 맞고 자기 remaining0, DOM/observer/resource 정리와 다른 owner 보존이 모두 확인된 경우뿐이다. media ownership이 있었다면 USER_CONTROL_RESTORED 또는 다른 owner가 유지하는 STILL_BLOCKED_OTHER_OWNER를 증명한다. 강제 autoplay/무조건 unmute로 복원하지 않는다. 관측된 DOM pause는 실제 오디오 출력 수용 증거가 아니므로 audio_verification은 NOT_VERIFIED만 허용한다. 실제 viewer·오디오/SPA·BFCache 수용은 채지민의 독립 Chrome 시험이 필요하다.

REVIEW_PENDING: 실제 selector/profile·영상/오디오 복원·이미지 generation 검증·추가 보안 채널 구현·성능·16개 페이지 수용. T-01/02/03의 모델 PASS는 제품 Shorts P0 해결이나 Figma 구현 완료를 뜻하지 않는다.
