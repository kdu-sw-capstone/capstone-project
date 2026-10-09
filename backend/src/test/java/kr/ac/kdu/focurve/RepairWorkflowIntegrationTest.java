package kr.ac.kdu.focurve;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.net.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import kr.ac.kdu.focurve.api.ApiFailure;
import kr.ac.kdu.focurve.auth.*;
import kr.ac.kdu.focurve.execution.*;
import kr.ac.kdu.focurve.imports.*;
import kr.ac.kdu.focurve.sites.*;
import org.junit.jupiter.api.*;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.*;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/** Real isolated MySQL transactions; provider and Extension responses are synthetic. */
@ActiveProfiles("test")
@SpringBootTest(
    properties = {
      "AUTH_COOKIE_SECURE=false",
      "AUTH_PUBLIC_URL=http://localhost:5175",
      "OAUTH_CALLBACK_BASE=http://localhost:5175",
      "GOOGLE_CLIENT_ID=synthetic-client",
      "GOOGLE_CLIENT_SECRET=synthetic-only",
      "KAKAO_CLIENT_ID=synthetic-client",
      "EXTENSION_CALLBACK_URIS=https://synthetic.chromiumapp.org/callback"
    })
class RepairWorkflowIntegrationTest {
  @Autowired JdbcTemplate db;
  @Autowired AuthService auth;
  @Autowired WebAuthentication web;
  @Autowired MemberLinks links;
  @Autowired ExecutionService execution;
  @Autowired SiteService sites;
  @Autowired ImportService imports;
  @Autowired ImportQueries queries;
  @Autowired SocialAuthentication social;
  @MockitoBean MailDelivery mail;
  @MockitoBean SocialProviderClient provider;

  String key() {
    return UUID.randomUUID().toString();
  }

  Instant now() {
    return Instant.now().truncatedTo(ChronoUnit.MILLIS);
  }

  @SuppressWarnings("unchecked")
  Map<String, Object> map(Object o) {
    return (Map<String, Object>) o;
  }

  void failure(Runnable r, String code) {
    assertThatThrownBy(r::run)
        .isInstanceOfSatisfying(ApiFailure.class, e -> assertThat(e.code).isEqualTo(code));
  }

  long user() {
    String email = key() + "@repair.invalid";
    db.update(
        "INSERT INTO"
            + " users(display_name,email,email_verified,status,created_at,terms_version,terms_accepted_at)"
            + " VALUES ('REPAIR"
            + " synthetic',?,true,'ACTIVE',UTC_TIMESTAMP(3),'dev-v1',UTC_TIMESTAMP(3))",
        email);
    return db.queryForObject("SELECT id FROM users WHERE email=?", Long.class, email);
  }

  MemberLinks.Principal installation() {
    long u = user();
    String ex = key();
    db.update(
        "INSERT INTO extension_installations VALUES (?,?,?,'repair-synthetic',UTC_TIMESTAMP(3))",
        ex,
        u,
        AuthSupport.hash(key()));
    return new MemberLinks.Principal(u, ex);
  }

  MockHttpServletRequest browser(Long user) {
    var req = new MockHttpServletRequest();
    var res = new MockHttpServletResponse();
    if (user == null) web.csrf(req, res);
    else web.login(user, req, res);
    req.setCookies(res.getCookie("focurve_session"));
    return req;
  }

  String parameter(String url, String name) {
    String query =
        url.contains("#") ? url.substring(url.indexOf('?') + 1) : URI.create(url).getRawQuery();
    for (String part : query.split("&")) {
      var kv = part.split("=", 2);
      if (kv[0].equals(name)) return URLDecoder.decode(kv[1], StandardCharsets.UTF_8);
    }
    throw new AssertionError("missing parameter");
  }

  String ticket(MockHttpServletRequest req, String mode, String p, Map<String, Object> identity) {
    String url = social.authorize(p, mode, "/", req, new MockHttpServletResponse());
    when(provider.exchange(eq(p), anyString(), any(), anyString()))
        .thenAnswer(i -> new LinkedHashMap<>(identity));
    return parameter(
        social.callback(
            p, parameter(url, "state"), "synthetic-code", null, req, new MockHttpServletResponse()),
        "ticket");
  }

  @Test
  void kakaoMissingEmailRequiresSingleUseVerifiedContactBeforeSignup() {
    var req = browser(null);
    String t = ticket(req, "login", "kakao", Map.of("subject", key()));
    failure(
        () -> social.complete(t, "dev-v1", "새 계정", req, new MockHttpServletResponse()),
        "CONTACT_EMAIL_REQUIRED");
    String email = key() + "@repair.invalid";
    social.requestContact(t, email, req);
    var token = ArgumentCaptor.forClass(String.class);
    verify(mail).send(eq(email), eq("SOCIAL_EMAIL"), token.capture());
    social.verifyContact(token.getValue());
    failure(() -> social.verifyContact(token.getValue()), "USED_TOKEN");
    assertThat(map(social.signupInfo(t, req)))
        .containsEntry("email_verified", true)
        .containsEntry("email", email);
    var result = map(social.complete(t, "dev-v1", "새 계정", req, new MockHttpServletResponse()));
    assertThat(result).containsEntry("email_verified", true);
    assertThat(result.get("providers")).isEqualTo(List.of("KAKAO"));
    failure(
        () -> social.complete(t, "dev-v1", "새 계정", req, new MockHttpServletResponse()),
        "USED_TOKEN");
  }

  @Test
  void contactMailFailureRollsBackChallengeButKeepsRateLimit() {
    var req = browser(null);
    String t = ticket(req, "login", "kakao", Map.of("subject", key())),
        email = key() + "@repair.invalid";
    doThrow(new ApiFailure(503, "MAIL_UNAVAILABLE"))
        .when(mail)
        .send(eq(email), eq("SOCIAL_EMAIL"), anyString());
    failure(() -> social.requestContact(t, email, req), "MAIL_UNAVAILABLE");
    assertThat(
            db.queryForObject(
                "SELECT COUNT(*) FROM auth_challenges WHERE kind='SOCIAL_EMAIL' AND"
                    + " JSON_UNQUOTE(JSON_EXTRACT(payload,'$.email'))=?",
                Integer.class,
                email))
        .isZero();
    failure(() -> social.requestContact(t, email, req), "RATE_LIMITED");
    assertThat(map(social.signupInfo(t, req))).containsEntry("email_verified", false);
  }

  @Test
  void socialTicketIsBrowserBoundAndExpiredContactCannotVerify() {
    var req = browser(null);
    String t = ticket(req, "login", "kakao", Map.of("subject", key()));
    failure(() -> social.signupInfo(t, browser(null)), "INVALID_STATE");
    String email = key() + "@repair.invalid";
    social.requestContact(t, email, req);
    var token = ArgumentCaptor.forClass(String.class);
    verify(mail).send(eq(email), eq("SOCIAL_EMAIL"), token.capture());
    db.update(
        "UPDATE auth_challenges SET expires_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND) WHERE"
            + " token_hash=?",
        AuthSupport.hash(token.getValue()));
    failure(() -> social.verifyContact(token.getValue()), "TOKEN_EXPIRED");
    assertThat(map(social.signupInfo(t, req))).containsEntry("email_verified", false);
  }

  @Test
  void equalEmailNeverAutomaticallyLinksAndSubjectReloginUsesExistingUser() {
    long owner = user();
    String email = db.queryForObject("SELECT email FROM users WHERE id=?", String.class, owner),
        subject = key();
    var req = browser(null);
    String t = ticket(req, "login", "google", Map.of("subject", subject, "email", email));
    failure(
        () -> social.complete(t, "dev-v1", "중복 이메일", req, new MockHttpServletResponse()),
        "IDENTITY_CONFLICT");
    assertThat(
            db.queryForObject(
                "SELECT COUNT(*) FROM auth_identities WHERE provider='GOOGLE' AND subject=?",
                Integer.class,
                subject))
        .isZero();
    db.update(
        "INSERT INTO auth_identities(user_id,provider,subject,updated_at) VALUES"
            + " (?,'GOOGLE',?,UTC_TIMESTAMP(3))",
        owner,
        subject);
    String url = social.authorize("google", "login", "/", req, new MockHttpServletResponse());
    when(provider.exchange(eq("google"), anyString(), any(), anyString()))
        .thenAnswer(
            i ->
                new LinkedHashMap<>(
                    Map.of("subject", subject, "email", key() + "@changed.invalid")));
    var res = new MockHttpServletResponse();
    assertThat(social.callback("google", parameter(url, "state"), "synthetic", null, req, res))
        .isEqualTo("http://localhost:5175/");
    req.setCookies(res.getCookie("focurve_session"));
    assertThat(web.require(req)).isEqualTo(owner);
  }

  @Test
  void linkingRequiresRecentReauthenticationAndRefusesOtherOwner() {
    long owner = user(), other = user();
    var req = browser(owner);
    String subject = key(), t = ticket(req, "link", "google", Map.of("subject", subject));
    failure(() -> social.link(t, req), "REAUTHENTICATION_REQUIRED");
    db.update(
        "UPDATE web_sessions SET reauthenticated_at=UTC_TIMESTAMP(3) WHERE id_hash=?",
        web.session(req).hash());
    db.update(
        "INSERT INTO auth_identities(user_id,provider,subject,updated_at) VALUES"
            + " (?,'GOOGLE',?,UTC_TIMESTAMP(3))",
        other,
        subject);
    failure(() -> social.link(t, req), "IDENTITY_ALREADY_LINKED");
    assertThat(
            db.queryForObject(
                "SELECT user_id FROM auth_identities WHERE provider='GOOGLE' AND subject=?",
                Long.class,
                subject))
        .isEqualTo(other);
    String fresh = ticket(req, "link", "kakao", Map.of("subject", key()));
    assertThat(map(social.link(fresh, req)).get("providers")).isEqualTo(List.of("KAKAO"));
  }

  @Test
  void canceledOrWrongStateCannotAuthenticateAndSocialOnlyResetSendsRecovery() {
    var req = browser(null);
    String url = social.authorize("google", "login", "/", req, new MockHttpServletResponse()),
        state = parameter(url, "state");
    assertThat(
            social.callback(
                "google", state, null, "access_denied", req, new MockHttpServletResponse()))
        .endsWith("/#social-canceled");
    failure(
        () -> social.callback("google", state, "code", null, req, new MockHttpServletResponse()),
        "INVALID_STATE");
    verifyNoInteractions(provider);
    long u = user();
    String email = db.queryForObject("SELECT email FROM users WHERE id=?", String.class, u);
    db.update(
        "INSERT INTO auth_identities(user_id,provider,subject,updated_at) VALUES"
            + " (?,'KAKAO',?,UTC_TIMESTAMP(3))",
        u,
        key());
    auth.requestMail(email, "RESET");
    verify(mail).send(email, "SOCIAL_RECOVERY", "KAKAO");
    assertThat(
            db.queryForObject(
                "SELECT COUNT(*) FROM auth_challenges WHERE user_id=? AND kind='RESET'",
                Integer.class,
                u))
        .isZero();
  }

  record Link(String id, String executor, String proof, String state, String verifier) {}

  Link newLink() {
    String ex = key(), state = AuthSupport.token(), verifier = AuthSupport.token();
    var installed = map(links.install(ex, "synthetic"));
    String proof = installed.get("installation_proof").toString();
    var request =
        map(
            links.request(
                ex,
                Base64.getUrlEncoder()
                    .withoutPadding()
                    .encodeToString(HexFormat.of().parseHex(AuthSupport.hash(verifier))),
                state,
                "https://synthetic.chromiumapp.org/callback",
                proof));
    return new Link(request.get("link_request_id").toString(), ex, proof, state, verifier);
  }

  Map<String, Object> evidence(Link l) {
    var e = new LinkedHashMap<String, Object>();
    e.put("observation_id", key());
    e.put("link_request_id", l.id());
    e.put("owner_context", "GUEST:" + l.executor());
    e.put("transition", "LINK_PENDING");
    e.put("active_session_id", null);
    e.put("owned_rule_ids", List.of());
    e.put("pending_action_count", 0);
    e.put("observed_at", now().toString());
    return e;
  }

  @Test
  void linkRequiresFreshReleaseEvidenceAndAuthenticatedPkceClaim() {
    var l = newLink();
    long u = user();
    failure(() -> links.approve(u, l.id(), true), "EXECUTION_EVIDENCE_REQUIRED");
    var e = evidence(l);
    e.put("owned_rule_ids", List.of(101));
    failure(() -> links.evidence(l.id(), l.proof(), e), "GUEST_SESSION_ACTIVE");
    links.evidence(l.id(), l.proof(), evidence(l));
    links.approve(u, l.id(), true);
    var claim = map(links.claim(l.id(), l.state(), l.proof()));
    assertThat(links.claim(l.id(), l.state(), l.proof())).isEqualTo(claim);
    failure(
        () -> links.exchange(l.id(), claim.get("code").toString(), AuthSupport.token(), l.proof()),
        "INVALID_GRANT");
    var tokens = map(links.exchange(l.id(), claim.get("code").toString(), l.verifier(), l.proof()));
    assertThat(links.access("Bearer " + tokens.get("access_token")).user()).isEqualTo(u);
    failure(
        () -> links.exchange(l.id(), claim.get("code").toString(), l.verifier(), l.proof()),
        "INVALID_GRANT");
  }

  @Test
  void linkDenialExpiryAndCrossUserApprovalNeverChangeInstallation() {
    var l = newLink();
    links.evidence(l.id(), l.proof(), evidence(l));
    long u = user();
    links.approve(u, l.id(), true);
    failure(() -> links.approve(user(), l.id(), true), "IDENTITY_CONFLICT");
    links.approve(u, l.id(), false);
    failure(() -> links.claim(l.id(), l.state(), l.proof()), "LINK_EXPIRED");
    assertThat(
            db.queryForMap(
                    "SELECT current_user_id FROM extension_installations WHERE id=?", l.executor())
                .get("current_user_id"))
        .isNull();
    var expired = newLink();
    db.update(
        "UPDATE link_requests SET expires_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND) WHERE"
            + " id=?",
        expired.id());
    failure(() -> links.approve(u, expired.id(), true), "LINK_EXPIRED");
  }

  record Run(
      MemberLinks.Principal p, Map<String, Object> s, long id, String interval, Instant start) {}

  Run run(boolean apply) {
    var p = installation();
    sites.create(
        p.user(),
        key(),
        new SiteInput("example.org", "합성", true, "DISTRACTION", "BLOCK", List.of()));
    var s = execution.start(p.user(), p.executor(), 1, key());
    long id =
        ((Number) execution.byUuid(p.user(), s.get("session_id").toString()).get("id")).longValue();
    var r = new Run(p, s, id, key(), now().minusSeconds(1));
    if (apply) {
      var report = releaseReport(r, now());
      report.put(
          "command_id",
          db.queryForObject(
              "SELECT id FROM execution_commands WHERE session_id=?", String.class, id));
      report.put("result", "APPLIED");
      var interval = map(((List<?>) report.get("intervals")).getFirst());
      interval.remove("end_at");
      interval.remove("duration_ms");
      execution.report(p, report);
    }
    return r;
  }

  Map<String, Object> releaseReport(Run r, Instant at) {
    var out = new LinkedHashMap<String, Object>();
    out.put("report_id", key());
    out.put("executor_id", r.p().executor());
    out.put("session_id", r.s().get("session_id"));
    out.put("command_id", null);
    out.put("desired_revision", 1);
    out.put("result", "RELEASED");
    out.put("observed_at", at.toString());
    out.put(
        "intervals",
        List.of(
            new LinkedHashMap<>(
                Map.of(
                    "interval_id",
                    r.interval(),
                    "kind",
                    "RUN",
                    "start_at",
                    r.start().toString(),
                    "end_at",
                    at.toString(),
                    "duration_ms",
                    Duration.between(r.start(), at).toMillis(),
                    "quality",
                    "CONFIRMED"))));
    return out;
  }

  Map<String, Object> reconciliation(
      Run r, boolean finalSummary, List<?> actions, long access, long local) {
    return Map.of(
        "journal_summary",
        Map.of(
            "format_version",
            "1.1",
            "session_id",
            r.s().get("session_id"),
            "known_revision",
            1,
            "last_access_seq",
            access,
            "last_local_seq",
            local,
            "observed_at",
            now().toString(),
            "observed_state",
            finalSummary ? "RELEASED" : "APPLIED",
            "final",
            finalSummary),
        "local_actions",
        actions);
  }

  Map<String, Object> action(Run r) {
    Instant at = now();
    return Map.of(
        "action_id",
        key(),
        "session_id",
        r.s().get("session_id"),
        "local_action_seq",
        1,
        "base_revision",
        1,
        "type",
        "END",
        "observed_at",
        at.toString(),
        "reason",
        "EXPIRED",
        "report",
        releaseReport(r, at));
  }

  @Test
  void offlineEndIsAtomicIdempotentAndCompletesOnlyDeclaredEvents() {
    var r = run(true);
    var a = action(r);
    var body = reconciliation(r, true, List.of(a), 0, 0);
    var response = map(execution.reconcile(r.p(), body));
    assertThat(response)
        .containsEntry("desired_state", "RELEASED")
        .containsEntry("record_status", "COMPLETE");
    assertThat(execution.reconcile(r.p(), body)).isEqualTo(response);
    assertThat(execution.current(r.p().user())).isNull();
    assertThat(execution.get(r.p().user(), r.id()).get("execution_status")).isEqualTo("ENDED");
    var changed = new LinkedHashMap<>(a);
    changed.put("reason", "MANUAL");
    failure(
        () -> execution.reconcile(r.p(), reconciliation(r, true, List.of(changed), 0, 0)),
        "RECONCILE_REQUIRED");
  }

  @Test
  void reconciliationCannotPretendRunningWithoutApplyReportOrCreditArbitraryPast() {
    var r = run(false);
    failure(
        () -> execution.reconcile(r.p(), reconciliation(r, false, List.of(), 0, 0)),
        "REPORT_NOT_RECEIVED");
    assertThat(execution.current(r.p().user()).get("execution_status")).isEqualTo("STARTING");
    var a = action(r);
    var report = map(a.get("report"));
    map(((List<?>) report.get("intervals")).getFirst())
        .put("start_at", now().minusSeconds(86400).toString());
    failure(
        () -> execution.reconcile(r.p(), reconciliation(r, true, List.of(a), 0, 0)),
        "INVALID_INTERVAL");
    assertThat(
            db.queryForObject(
                "SELECT COUNT(*) FROM execution_reconciliations WHERE session_id=?",
                Integer.class,
                r.id()))
        .isZero();
  }

  @Test
  void finalWatermarkGapsRemainPendingAndOtherExecutorIsRejected() {
    var r = run(true);
    execution.reconcile(r.p(), reconciliation(r, true, List.of(action(r)), 1, 1));
    assertThat(execution.get(r.p().user(), r.id()).get("record_status")).isEqualTo("PENDING");
    failure(
        () ->
            execution.reconcile(
                new MemberLinks.Principal(r.p().user(), key()),
                reconciliation(r, true, List.of(), 1, 1)),
        "EXECUTOR_MISMATCH");
  }

  Map<String, Object> site() {
    return Map.of(
        "url",
        "import.example.org",
        "display_name",
        "선택한 사이트",
        "include_subdomains",
        true,
        "purpose",
        "GENERAL",
        "access_policy",
        "ALLOW",
        "feature_policies",
        List.of());
  }

  Map<String, Object> item(String type, String source, Map<String, Object> payload) {
    return Map.of(
        "type",
        type,
        "source_item_id",
        source,
        "source_hash",
        AuthSupport.hash(auth.encoded(payload)),
        "payload",
        payload);
  }

  Map<String, Object> batch(MemberLinks.Principal p, List<Map<String, Object>> items) {
    return map(
        imports.create(
            p,
            key(),
            Map.of(
                "source_installation_id",
                p.executor(),
                "manifest",
                items.stream()
                    .map(
                        i ->
                            Map.of(
                                "type",
                                i.get("type"),
                                "source_item_id",
                                i.get("source_item_id"),
                                "source_hash",
                                i.get("source_hash")))
                    .toList())));
  }

  @Test
  void selectedSiteImportRetriesAcrossBatchesWithoutOverwriteOrDuplicate() {
    var p = installation();
    var i = item("SITE", key(), site());
    var b = batch(p, List.of(i));
    String source = i.get("source_item_id").toString();
    assertThat(map(imports.upload(p, b.get("batch_id").toString(), source, i)))
        .containsEntry("status", "SUCCEEDED");
    var retry = batch(p, List.of(i));
    assertThat(map(imports.upload(p, retry.get("batch_id").toString(), source, i)))
        .containsEntry("status", "SUCCEEDED");
    assertThat(
            db.queryForObject(
                "SELECT COUNT(*) FROM sites WHERE user_id=?", Integer.class, p.user()))
        .isEqualTo(1);
    var different = item("SITE", key(), site());
    var second = batch(p, List.of(different));
    assertThat(
            map(
                imports.upload(
                    p,
                    second.get("batch_id").toString(),
                    different.get("source_item_id").toString(),
                    different)))
        .containsEntry("status", "SKIPPED_CONFLICT");
    assertThat(queries.get(p.user(), b.get("batch_id").toString()))
        .containsEntry("status", "COMPLETE");
  }

  @Test
  void failedItemDoesNotRollBackGoodItemAndOriginalCannotMoveToAnotherUser() {
    var p = installation();
    var good = item("SITE", key(), site());
    var invalid = new LinkedHashMap<>(site());
    invalid.put("url", "not a host");
    var bad = item("SITE", key(), invalid);
    var b = batch(p, List.of(good, bad));
    String bid = b.get("batch_id").toString();
    imports.upload(p, bid, good.get("source_item_id").toString(), good);
    assertThat(map(imports.upload(p, bid, bad.get("source_item_id").toString(), bad)))
        .containsEntry("status", "FAILED");
    assertThat(queries.get(p.user(), bid)).containsEntry("status", "PARTIAL");
    long other = user();
    db.update(
        "UPDATE extension_installations SET current_user_id=? WHERE id=?", other, p.executor());
    failure(
        () -> batch(new MemberLinks.Principal(other, p.executor()), List.of(good)),
        "SOURCE_BOUND_TO_OTHER_ACCOUNT");
    failure(() -> queries.get(other, bid), "IMPORT_NOT_FOUND");
  }

  Map<String, Object> guestSession(MemberLinks.Principal p, String source) {
    Instant end = now().minusSeconds(1), start = end.minusSeconds(30);
    String snapshot = key();
    var policy = new LinkedHashMap<String, Object>();
    policy.put("policy_snapshot_id", snapshot);
    policy.put("format_version", "1.2");
    policy.put("site_match_strategy", "MOST_SPECIFIC_HOST");
    policy.put("owner_user_id", null);
    policy.put("executor_id", p.executor());
    policy.put("created_at", start.toString());
    policy.put("source_version", 1);
    policy.put("sites", List.of());
    policy.put("content_policy", ExecutionService.defaultContent());
    var session = new LinkedHashMap<String, Object>();
    session.put("session_id", source);
    session.put("executor_id", p.executor());
    session.put("policy_snapshot_id", snapshot);
    session.put("source", "MANUAL");
    session.put("execution_status", "ENDED");
    session.put("duration_minutes", 1);
    session.put("started_at", start.toString());
    session.put("ended_at", end.toString());
    session.put("policy_released_at", end.toString());
    session.put("end_reason", "MANUAL");
    return new LinkedHashMap<>(
        Map.of(
            "snapshot",
            policy,
            "session",
            session,
            "intervals",
            List.of(
                Map.of(
                    "interval_id",
                    key(),
                    "kind",
                    "RUN",
                    "start_at",
                    start.toString(),
                    "end_at",
                    end.toString(),
                    "duration_ms",
                    30000,
                    "quality",
                    "CONFIRMED")),
            "events",
            List.of(),
            "usage_segments",
            List.of(),
            "note",
            "가져온 합성 기록",
            "watermark",
            Map.of("last_access_seq", 0, "last_local_seq", 0)));
  }

  @Test
  void completedGuestSessionPreservesHistoryWithoutLiveCommands() {
    var p = installation();
    String source = key();
    var i = item("SESSION", source, guestSession(p, source));
    var b = batch(p, List.of(i));
    assertThat(map(imports.upload(p, b.get("batch_id").toString(), source, i)))
        .containsEntry("status", "SUCCEEDED");
    var row = execution.byUuid(p.user(), source);
    assertThat(row)
        .containsEntry("origin", "GUEST_IMPORT")
        .containsEntry("active_duration_ms", 30000L)
        .containsEntry("record_status", "COMPLETE");
    assertThat(execution.current(p.user())).isNull();
    assertThat(
            db.queryForObject(
                "SELECT COUNT(*) FROM execution_commands WHERE session_id=?",
                Integer.class,
                row.get("id")))
        .isZero();
  }

  @Test
  void invalidGuestEventRollsBackSnapshotSessionAndNoteAsOneItem() {
    var p = installation();
    String source = key();
    var payload = guestSession(p, source);
    payload.put(
        "events",
        List.of(
            Map.of(
                "event_id",
                key(),
                "session_id",
                source,
                "executor_id",
                p.executor(),
                "policy_snapshot_id",
                map(payload.get("snapshot")).get("policy_snapshot_id"))));
    var i = item("SESSION", source, payload);
    var b = batch(p, List.of(i));
    assertThat(map(imports.upload(p, b.get("batch_id").toString(), source, i)))
        .containsEntry("status", "FAILED");
    assertThat(
            db.queryForObject(
                "SELECT COUNT(*) FROM focus_sessions WHERE user_id=?", Integer.class, p.user()))
        .isZero();
    assertThat(
            db.queryForObject(
                "SELECT COUNT(*) FROM policy_snapshots WHERE user_id=?", Integer.class, p.user()))
        .isZero();
  }
}
