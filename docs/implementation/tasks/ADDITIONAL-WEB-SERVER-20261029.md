# Additional MVP Web·Server·DB — 김다훈

- Branch: `feature/additional-mvp-web-server`
- Start/base: `e2b3fc318fe52acc45145a30def07b874b2255f6` (RC2 contract merge).
- Scope: settings persistence/UI adapters only. Existing Shorts/Core/Content/Native/installation tracks unchanged.
- Contract source: `contracts/additional-mvp/rc1/{schema.json,api.json,mysql-runtime-candidate.sql}`; directory name rc1 contains revision `AMVP-CONTRACT-20261029-RC2`.
- Latest user instruction fixes the development baseline. Historical REVIEW_PENDING metadata was preserved; no human approval receipt was invented and no runtime capability was activated.
- Related cards: OPTION-01~08, OPTION-10~12; exact feature/role mapping remains the RC2 feature registry and existing cards. This card records Kim Dahun's implementation, not completion of teammates' execution work.

## Slice 1 — configuration persistence and settings UI

**IMPLEMENTED / TESTED, runtime integration BLOCKED.**

`runtime-server` is the selected packaged module. No backend replacement, production DB access, numbered migration or automatic DDL was performed. V1~V9 remain unchanged; V10 remains unreserved until deployment is coordinated. The existing RC2 additive SQL is consumed only by the new isolated test database.

- Unmodified RC2 Draft 2020-12 schema is bundled as a resource. NetworkNT JSON Schema Validator 1.5.9 consumes it; the API definition is selected separately from the root Wire union. Custom timezone, duplicate feature/window identity, numeric type and time ordering checks supplement schema validation.
- ConfigValue: CONTENT (16 existing YT/IG options, keyword/adult/blur), SITE_TIME (daily limit and block/allow windows), FOCUS_SCHEDULE (once/weekly), CADENCE (focus/rest/cycles).
- Installation/current member/active owner binding checks; old epoch config cannot be read or deleted using a new binding, even for the same member.
- Installation-before-binding lock order, singleton CONTENT/CADENCE, immutable versions, safe version limits, If-None-Match/If-Match, canonical request hash, durable scoped idempotency receipt before stale-version evaluation.
- Package/outbox publication adapter participates in the same SQL transaction. Publication failure rolls back config/version/outbox/receipt. This adapter has **no production implementation in this slice**. Tests use an explicitly synthetic trusted adapter; its empty test publication is not a real RuntimePackage.
- DELETE preserves versions, returns 202 RELEASE_PENDING/actual_effect_confirmed=false. It does not perform DOM/DNR release or claim ENDED.
- Owner/filter/limit-bound encrypted pagination cursor; no silent truncation or foreign lookup.
- Opt-in HTTP controller reuses MemberAuth cookie/bearer and Origin/CSRF. Default `focurve.additional.config-api.enabled=false`; enabling it alone returns CAPABILITY_NOT_VERIFIED without a trusted Admission bean. No deployment flag was set.
- Existing AdditionalUi/CSS and 16 option descriptions were copied from the additional-MVP design worktree without altering that worktree. Settings contains installation selection, loading/error/empty states, config editing, explicit read retry, save/readback and release-pending display. Actual application is never inferred from saving.
- Lost save/delete response reuses an immutable payload/idempotency key. Concurrent changed readback is not presented as saved confirmation. This is a Web HTTP client/component integration, **not an actual Chrome policy acceptance**.

### Fresh verification

Environment: Windows, Java21, Node24, MySQL8.4.8; isolated `.local/amvp-mysql-*` directories only. No product Server/Chrome/Native session.

- Web: **235/235 PASS** (including new API and component checks), TypeScript and Vite build PASS.
- runtime-server: **74/74 PASS**, 0 skipped in the full isolated-DB run; includes 6 schema/semantic tests and 10 real-MySQL tests. Existing tests were run because a dependency/resource/controller boundary was added. MockMvc requests use the real cookie/CSRF and real JDBC database; capability/publication remains SYNTHETIC.
- MySQL tests: all four kinds; singleton; immutable/replay/conflicting payload; foreign member/executor/closed/replaced owner epoch; concurrent expected-version single winner; publication rollback; tombstone/replay; cursor tampering; unauthenticated and CSRF rejection; capability absence; owner-bound HTTP PUT.
- Full verified evidence: `.local/verified-20261029/results.json` and copied Surefire XML. Test data/credentials are ignored and never staged. Earlier readiness/representation/test-helper failures are retained in local logs, not rewritten into PASS.
- Real DB after final test: graceful mysqladmin shutdown confirmed in that invocation's `server.stderr`; no force stop. Windows TCP inventory can retain PID0 rows after shutdown, so authenticated `@@datadir` plus exact launched process path is the readiness ownership check. No tooling policy was bypassed.
- Extension/Core/Content/Native source diff: **0**; existing mandatory/Shorts automatic results are reused, not rerun.
- Actual Chrome/Native policy application, Figma pixel/visual acceptance, deployed HTTP, operational migration: **NOT_RUN**.

### Reproduce

```powershell
npm --prefix frontend ci
npm --prefix frontend test -- --maxWorkers=2
npm --prefix frontend run build
# Set JAVA_HOME to an existing Java21 runtime. No credential prompts.
./scripts/test-additional-config-mysql.ps1 -BinaryDirectory <existing-MySQL-binaries> -MavenCommand <existing-mvn.cmd> -Port <free-test-port> -Tests '*'
```

CI `additional-web-server.yml` targets the existing integration branch; it uses a fresh MySQL service and synthetic runner-only credentials. It does not deploy, merge, run Chrome, or register Native hosts. New source is reviewed through a Draft PR, never merged by this execution.

## Runtime activation and remaining work

| Work | State | Exact boundary / next step |
|---|---|---|
| Config Web→HTTP adapter→transaction→DB | TESTED | Real isolated SQL and in-process HTTP, synthetic capability/publication |
| Four config shapes and settings editor | IMPLEMENTED / TESTED | Existing UI assets; visual review NOT_RUN |
| Runtime artifact/capability gate and package issuer | BLOCKED | Core issued artifact/verified owner binding + canonical publisher must supply Admission, in the same transaction |
| Actual 16-option/keyword/adult/blur effect | NOT_RUN | Content/registry/license/profile/ACK and runtime capability; no activation merely because a setting is saved |
| Focus scheduler/cadence execution | NOT_RUN | Core occurrence/fixed-end/claim execution; this slice stores the approved setting, not execution success |
| Usage ingest/resolution/timezone/quota projections | NOT_RUN | Requires verified clock/anchor and durable Core collector; do not accept client TRUSTED strings |
| Browser usage/day/record statistics API | NOT_RUN | Separate next slice; raw receipt and measurement quality remain distinct |
| Existing member/guest transfer/import | REUSED | Legacy paths unchanged; new adapter requires verified source and owner transfer contract |

Keep development enabled for independent query/UI work. Do not turn an absent runtime publisher into a no-op production success. Do not reuse failed installations or change contract files to unblock this slice.

## Resume point

After the settings slice is published, implement independent read-side usage/statistics projection and its quality/null states against RC2 fixtures and isolated MySQL, then connect only verified existing sources. Runtime activation/operational migration remains gated. PR Merge/develop changes are not authorized.
