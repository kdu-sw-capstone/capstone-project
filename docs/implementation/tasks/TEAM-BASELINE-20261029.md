# TEAM-BASELINE-20261029 — 필수 후보 게시와 팀 개발 기준

- 기능 ID: 필수 MVP 전체 연결 기반, 추가 MVP 개발 준비. 실제 추가 기능 구현 카드 아님.
- 담당: Codex 게시·재현 검증 / 기존 3인 기능 배정 유지.
- branch: integration/mandatory-mvp-baseline-20261029
- 시작 Git SHA: 90ad32be5d282f3b44c917a29e156dffc5e29187
- 사용자 승인: 2026-10-29 첨부 「필수 MVP 통합본 GitHub 게시 및 추가 MVP 팀 개발 환경 구축」. 선택 Stage·Commit·정상 Push·신규 Draft PR·여섯 기준 브랜치 게시까지. Merge/Ready/기존 PR 수정/실제 정책 실행 제외.
- 기준 설계: docs/design/00_문서안내.md, API/데이터/검증 상세 명세, MVP-INTEGRATION-20261025, ADDITIONAL_MVP_BASELINE_HANDOFF.md. 우선순위: 최신 사용자 명시 지시→현행 상세→요약.
- 상태: 게시·원격 재현 검증 중. 결과와 실제 전체 SHA는 신규 Draft PR/최종 보고에 기록한다. MVP_FINAL_COMPLETE=false.

## AC

- TB-01: 822파일 동결 Manifest와 선택 소스 hash 일치. 문서 보완/보안 정리·생성물 변화는 별도 목록. 후보 ZIP SHA와 Git SHA 혼동 금지.
- TB-02: PR17/21 최신 head 대조, 기존 의미 해소33항목/32경로·원격전용115경로 재사용. PR 자체 보존. PR22 설계·현재 추가 MVP dirty 보존.
- TB-03: 명시 Stage, diff/전체 게시 대상 보안 검사, 불필요한 ZIP·개인설정·DB·Credential·프로필 제외. 소스/lock/필요 번들 유지.
- TB-04: Web·backend 비DB·runtime-server·Core/Content·distribution 자동 시험과 빌드. 실제 Chrome/Native/전체DB NOT_RUN을 별도 표기.
- TB-05: 정상 Push 뒤 원격 전체 SHA 검증, develop 대상 Draft PR, 동일 기준 여섯 브랜치. main/develop·동료 branch·기존PR 변경 없음.
- TB-06: 원격 새 clone, 개인 .env/node_modules/출력/빌드 캐시 없이 lock 설치/빌드/기본 시험. 팀원 PC와 계정권한은 직접 증거 전 NOT_VERIFIED.
- TB-07: README→TEAM-START, 3인 파일 책임·실제 명령·16옵션·DEC01~07·D06/Wire/측정 pending·11/15 일정·수용/PR 조건 명시.

## 증거와 남은 상태

[팀 시작 가이드](../TEAM-START-20261029.md), [게시 검토·보존 기록](../baseline-20261029/README.md), frozen-source-manifest.json, pr-semantic-resolutions.json. 로컬 원문 로그/개인경로/실패 설치 자료는 .local과 기존 증거 위치에 보존하며 게시하지 않는다.

최신 후보 Chrome NOT_RUN, 이전 정책 FAIL/UNKNOWN/HOLD 보존. Shorts STORE_UNCONFIRMED 원인·전체 탐색 경로·정상 END/Binding/DOM/DNR 복원·Native 재연결·재기동은 P0/미검증. 담당 김다훈의 별도 안정화. D06 단일 revision/new Wire/측정 기준은 3인 REVIEW_PENDING. 구현·자동 시험 PASS와 실제 수용을 구분한다.

다음 행동: 게시 후 remote SHA·Draft/CI·깨끗한 clone 재현을 확인하고 각 담당자가 자기 PC 첫 빌드/작은 기능 PR을 제출한다. 이 카드는 제품 검증완료 상태로 바꾸지 않는다.
