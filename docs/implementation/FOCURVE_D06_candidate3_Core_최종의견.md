# candidate-3 Core 최종 의견과 독립 반례 대조

EXT-02 / 종민 Core 검토 의견 / 브랜치 feature/extension-core-ext-02 / 시작c6303690052bb7122ddf64cff452402f8ad60d9d. 사용자 첨부6개와 직전 candidate3 묶음을 대조했다. 원본/manifest 승인란은 수정하지 않았고 사람의 서명·3인 공동 승인·착수 승인으로 대신하지 않는다.

## A0 계약 — Core 의견 수락

버전 d06-shorts-a0-candidate-3. 승인 대상 manifest SHA256:
25365535dffd6fd52f9706ff3fae83f4e69317e99150798e63cf656ae78ceef6

해당 묶음의 대상9개 원본 byte hash 모두 일치. source_manifest는 별도 참고자료이며 이9개에 포함되지 않는다. 누락되었던 schema·사용자회신txt·재승인준비보고서를 추가로 읽고 hash 검증했다. 이전묶음 승인 자동이월 없음.

Core 담당자 의견으로 candidate3 최소 계약을 수락한다. §5.1 정상/CLEANUP_ONLY RELEASE fingerprint·최초응답을 일반FIFO 밖 APPLY전 예약32슬롯에 instance/A0수명 보존하는 방식, 동일operation 재전송 슬롯추가0, 새복원시도 슬롯1, 소진/저장실패 BLOCKED·cleanup_pending·원본보존 조건에 동의한다. 이 설계는 현재registry에 구현돼 있지 않으며 저장공간 예약/순서/ledger/실제restore 안전성은 후속 runtime검증이 필요하다. 32회는 시험프로필이며 무한복원·물리저장보장값이 아니다.

projection1.2+MOST_SPECIFIC_HOST, fingerprint-only eviction 오류와 freshQUERY/새RELEASE, 결과A/접근Event0/격리범위도 수락. 기본Guesttrue거절·Server Snapshot1.2 신규발급gate/회원API변경 없음.

자체 실행: jsonschema Draft202012Validator metaschema1 + JSON예시13 + 본문JSON3 + negative18 =35/35 PASS. negative는 이전버전/member/1.1/전략누락null잘못값/잘못source/feature/seq/cleanup/eviction응답 등에 대한 자체 케이스이며 다훈 실행스크립트를 직접 재실행한 것은 아니다. 실제 Core supported predicate도7/7 PASS. 정적JSON은 의미동등성·sender·storage·DOM의 런타임 안전성 증거가 아니다.

제품 연결은3인 동일해시승인 및 Windows MV3 sender안전식별/부속규칙재확인 전 BLOCKED 유지. sender계획은 candidate2에서 계승된 부속문서로 읽었고 실제현재wire는candidate3만 사용한다. 실험코드/로드/실행은별도요청과격리범위가필요하다. 현재sender실험NOT RUN, 본문/manifest승인0/3 상태를 임의변경하지 않는다.

## Core 독립 재리뷰 — 기존 수정에 정확 반례 추가

보고서 기준790d35a(제품c746동일)의 R17-LATEST-01/WRF12는 다음2조건이다.

- journal.snapshot.source_version만0: JOURNAL_SCOPE_MISMATCH에서 유효ServerRELEASE 조회 차단.
- journal 및 control.command.snapshot.source_version모두0: INVALID_SNAPSHOT에서 같은 차단.

기존c630369 수정이 적용증거복구오류를 RELEASE전용 pass로 분리하므로 추가제품수정없이 해결된다. 정확2변이를 새시험으로 추가: 각3tick, 첫tick부터ownedrules제거/foreignrule보존/RELEASED보고1회/모의ServerENDED/재적용0/변이원문보존 및 이후중복보고0을 확인. 새시험추가후전체238/238 PASS. 기존negative staleRELEASE·잘못journalexecutor도계속통과한다. 코드가RuntimeRUNNING을 허용하거나 Snapshot을 보정한 것이 아니다.

이번변경은 회귀테스트1파일과 문서뿐, 제품source/bundle은c630369와동일. 관련기존29/29·전체237 및LinuxCRLF237은c630실행근거, 이번확장전체238은LF자체실행근거로구분한다. JS구문/diff검사PASS. manifest0.1.20 유지, 최신commitSHA로식별한다.

## 남은 검증·보존

새SHA독립재리뷰/WindowsCRLF238/격리Chrome WRF01~12/실제HTTP·MySQL NOT RUN. 제공WRF절차는새시험프로필/새회원·설치/독립Server·DB와정확productDB명을요구하므로 기존사용자자료에임의변조하지않는다. c746의정상사용자회귀와이번 격리 실패 시험은구분한다. 원문보고서FIX REQUIRED 판정은다훈의새재리뷰전덮어쓰지않는다.

PR17문서/시험만갱신, PR21/기존Guest·회원·추가MVP보존, develop미병합. 기존Core약90%추정유지. 이번계약최종의견검토·정확반례자동대조는완료, A0구현·sender·실제실패검증은남음.

[RELEASE 수정 근거](evidence/EXT-02-recovery-fault-server-release.md)

## 최신 독립 재리뷰 결과 접수

[다훈 회신 REVIEW PASS·출처·남은 검증](evidence/EXT-02-independent-release-review-pass.md). Windows LF/CRLF 각238·반례34·잘못RELEASE4·HTTP/격리MySQL3 통과 회신. 과거 NOT RUN은 당시 기록으로 보존하며 이번 독립 판정 접수로 갱신한다. 실제Chrome 실패/sender 및 A0공동승인 미완료·develop 미병합.
