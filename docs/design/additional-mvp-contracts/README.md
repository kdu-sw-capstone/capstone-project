# 추가 MVP 공통 계약 RC1 — 공동 검토용

Revision: `AMVP-CONTRACT-20261029-RC1`. 상태: **REVIEW_PENDING**. 기준: `9868a0f5914d7a173c102fc198a9a908b043381f`, base `integration/additional-mvp-20261029`. 필수 MVP 최종 릴리스 PASS 선언이 아니다.

사용자 확정 정책 DEC-01~07을 유지한다. 새 Schema/API/DDL/알고리즘은 **검토 가능한 제안**이며 배포·지원 완료·3인 승인으로 해석하지 않는다. 이 PR은 제품 코드를 바꾸지 않는다. 기존 PR #17·#21·#22 및 미커밋 추가 구현을 흡수하거나 승인하지 않는다.

읽는 순서: [조사·차이](01_조사와호환성.md) → [API·DB](02_API_DB.md) → [Wire·복원](03_Wire_D06_복원.md) → [정책·시간](04_정책_시간.md) → [Content·이벤트·UI](05_Content_Event_UI.md) → [담당·승인](06_인계_승인.md) → [실행 결과](07_검증결과.md).

기계 판독 원본은 `contracts/additional-mvp/rc1/`의 `schema.json`(Draft 2020-12), `api.json`, `feature-registry.json`, `traceability.json`, `mysql-candidate.sql`이다. 필드 타입·필수값·enum은 Schema가 원본, 인과·소유권·상태 규칙은 본 문서와 실행 참조 모델이 원본이다. 차이가 생기면 릴리스를 중지하고 공동 수정한다. `examples.json`은 **합성 형상 예제**이며 실제 API 성공 기록이 아니다.

18개 영역은 traceability F01~F18, 확정 16개 옵션은 registry YT-01~10/IG-01~06으로 연결된다. 옵션 존재/ON-OFF 요구는 확정, DOM selector·모델 임계값·wire 필드·실제 성능은 별도 검토다. PC 확장은 필수·추가 MVP 검증 후 진행할 후속 단계로 유지한다.

재현: Python 3.14 가상환경에서 `python -m pip install -r contracts/additional-mvp/rc1/requirements.lock`, `python -m unittest discover -s contracts/additional-mvp/rc1/tests -v`. 전체 제품 빌드·실제 Chrome 수용 시험을 대체하지 않는다. 오프라인 registry로 Schema를 해석하며 네트워크 참조를 허용하지 않는다.

Git SHA는 자기 자신을 문서에 순환 기입하지 않는다. PR 본문 head SHA와 `revision-manifest.json`의 파일별 SHA256을 함께 검토한다. 공동 승인 후 파일 하나라도 바뀌면 승인 대상을 새 head로 갱신한다.
