# ADDITIONAL-CONTRACT-20261029

- 기능: 추가 MVP 공통 계약 F01~F18, YT-01~10/IG-01~06. 기존 개인별 담당 유지.
- 계약 작성·통합 조정: 김다훈 작업 요청에 따른 Codex 기술 검토. 인간 공동 승인 대행 아님.
- 브랜치: codex/additional-mvp-contracts-20261029
- Worktree: additional-mvp-contracts-20261029/capstone-project (독립 신규)
- 시작 기준:9868a0f5914d7a173c102fc198a9a908b043381f / integration/additional-mvp-20261029
- Revision: AMVP-CONTRACT-20261029-RC1 / REVIEW_PENDING
- 기준 설계: D01~D10, 기존 Member/Guest D06 실제 Schema, 기존 추가 설계6문서/작업카드, Figma UI_BINDINGS13구조.
- 코드/산출물: contracts/additional-mvp/rc1/, docs/design/additional-mvp-contracts/, 전용CI. 제품 코드 변경0.
- 검증: Python135/Node3/격리MySQL12 PASS. 실제Chrome/API통합/장시간 측정은NOT_RUN. 최종 수치는 실행 결과문서/PR을 따른다.
- 미해결: C01~11, FOCUS_CONTROL/coordinated actor, liveowner chain, runtime allmatching, idle 권한·URLprofile·DST·수치범위·blurprofile, 실제성능. 모두 승인대기.
- 담당별 AMVP-CON-01~AMVP-INT-10과 수용 기준: docs/design/additional-mvp-contracts/06_인계_승인.md.
- 다음 행동: 동일 head·manifest를 김다훈/윤종민/채지민이 검토하고 PR에 실제결정 기록. 승인 전 신규계약 제품활성화 금지. Codex는 자동Approve/Merge하지 않는다.
- 보존: PR17/21/22, 기존설계WT 미커밋, Shorts P0,0.1.25환경,Default/Profile2/운영DB를 건드리지 않는다.
