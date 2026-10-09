package kr.ac.kdu.focurve;

import static org.assertj.core.api.Assertions.*;

import java.sql.*;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.*;
import javax.sql.DataSource;
import kr.ac.kdu.focurve.auth.*;
import kr.ac.kdu.focurve.events.*;
import kr.ac.kdu.focurve.execution.*;
import kr.ac.kdu.focurve.records.*;
import kr.ac.kdu.focurve.sites.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/**
 * Audit regressions against repaired product services; isolated MySQL; synthetic executor reports.
 */
@ActiveProfiles("test")
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {"AUTH_COOKIE_SECURE=false", "AUTH_ALLOWED_ORIGINS=http://localhost:5174"})
class AuditBoundaryIntegrationTest {
  @Autowired JdbcTemplate db;
  @Autowired DataSource dataSource;
  @Autowired TestRestTemplate http;
  @Autowired ExecutionService execution;
  @Autowired EventService events;
  @Autowired RecordQueries records;
  @Autowired SiteService sites;
  @Autowired AuthService auth;
  @MockitoBean MailDelivery mail;

  String key() {
    return UUID.randomUUID().toString();
  }

  Instant now() {
    return Instant.now().truncatedTo(ChronoUnit.MILLIS);
  }

  long user() {
    String email = key() + "@audit.invalid";
    db.update(
        "INSERT INTO"
            + " users(display_name,email,email_verified,status,created_at,terms_version,terms_accepted_at)"
            + " VALUES ('AUDIT"
            + " synthetic',?,true,'ACTIVE',UTC_TIMESTAMP(3),'dev-v1',UTC_TIMESTAMP(3))",
        email);
    return db.queryForObject("SELECT id FROM users WHERE email=?", Long.class, email);
  }

  record Fixture(
      long owner,
      String executor,
      String session,
      String snapshot,
      long id,
      String apply,
      String interval,
      Instant began) {
    MemberLinks.Principal p() {
      return new MemberLinks.Principal(owner, executor);
    }
  }

  Fixture start(Instant began) {
    long u = user();
    String ex = key();
    db.update(
        "INSERT INTO extension_installations VALUES (?,?,?,'audit-synthetic',UTC_TIMESTAMP(3))",
        ex,
        u,
        AuthSupport.hash(key()));
    sites.create(
        u, key(), new SiteInput("example.org", "AUDIT", true, "DISTRACTION", "BLOCK", List.of()));
    var s = execution.start(u, ex, 1, key());
    String uuid = s.get("session_id").toString();
    long id = ((Number) execution.byUuid(u, uuid).get("id")).longValue();
    return new Fixture(
        u, ex, uuid, s.get("policy_snapshot_id").toString(), id, command(id), key(), began);
  }

  String command(long id) {
    return db.queryForObject(
        "SELECT c.id FROM execution_commands c JOIN focus_sessions s ON s.id=c.session_id WHERE"
            + " s.id=? AND c.desired_revision=s.desired_revision",
        String.class,
        id);
  }

  Map<String, Object> report(Fixture f, String result, Instant observed, Instant end) {
    var r = new LinkedHashMap<String, Object>();
    r.put("report_id", key());
    r.put("executor_id", f.executor());
    r.put("session_id", f.session());
    r.put("command_id", command(f.id()));
    r.put("desired_revision", result.equals("APPLIED") ? 1 : 2);
    r.put("result", result);
    r.put("observed_at", observed.toString());
    var i = new LinkedHashMap<String, Object>();
    i.put("interval_id", f.interval());
    i.put("kind", "RUN");
    i.put("start_at", f.began().toString());
    i.put("quality", "CONFIRMED");
    if (end != null) {
      i.put("end_at", end.toString());
      i.put("duration_ms", Duration.between(f.began(), end).toMillis());
    }
    r.put("intervals", List.of(i));
    return r;
  }

  Map<String, Object> event(Fixture f, int seq, String target, Instant at) {
    return Map.of(
        "event_id",
        key(),
        "schema_version",
        "1.1",
        "executor_id",
        f.executor(),
        "session_id",
        f.session(),
        "policy_snapshot_id",
        f.snapshot(),
        "event_type",
        "BLOCKED_SITE_ACCESS",
        "occurred_at",
        at.toString(),
        "local_seq",
        seq,
        "payload",
        Map.of(
            "access_seq",
            seq,
            "navigation_id",
            key(),
            "target_kind",
            "SITE",
            "target_host",
            "example.org",
            "target_key",
            target,
            "reason",
            "USER_SITE"));
  }

  Object send(Fixture f, Map<String, Object> e) {
    return events.batch(f.p(), List.of(e));
  }

  @Test
  void backdatedApplyMustNotCreditTimeBeforeCommandCreation() {
    var f = start(now().minusSeconds(86400));
    var r = report(f, "APPLIED", now(), null);
    assertThatThrownBy(() -> execution.report(f.p(), r))
        .isInstanceOf(kr.ac.kdu.focurve.api.ApiFailure.class);
    assertThat(execution.current(f.owner()).get("execution_status")).isEqualTo("STARTING");
    assertThat(
            db.queryForObject(
                "SELECT COUNT(*) FROM session_intervals WHERE session_id=?", Integer.class, f.id()))
        .isZero();
  }

  @Test
  void mismatchedTargetKeyMustNotDefeatRepeatCalculation() {
    var f = start(now());
    execution.report(f.p(), report(f, "APPLIED", now(), null));
    send(f, event(f, 1, "SITE:example.org", now()));
    Object response = send(f, event(f, 2, "SITE:unrelated.invalid", now()));
    var summary = records.summary(f.owner(), null, null);
    System.out.println("AUDIT wrong target key: " + response + " summary=" + summary);
    assertThat(
            ((Map<?, ?>) ((List<?>) ((Map<?, ?>) response).get("items")).getFirst()).get("status"))
        .as("target_key must match kind/host or be rejected before ranking")
        .isEqualTo("REJECTED");
  }

  @Test
  void snapshotMismatchMustNotCreateSuccessfulBlockedAccess() {
    var f = start(now());
    execution.report(f.p(), report(f, "APPLIED", now(), null));
    var e = new LinkedHashMap<>(event(f, 1, "SITE:unregistered.invalid", now()));
    var p = new LinkedHashMap<>((Map<String, Object>) e.get("payload"));
    p.put("target_host", "unregistered.invalid");
    e.put("payload", p);
    Object response = send(f, e);
    long count =
        db.queryForObject(
            "SELECT COUNT(*) FROM access_events WHERE session_id=?", Long.class, f.id());
    System.out.println(
        "AUDIT snapshot-unregistered blocked access: " + response + " rows=" + count);
    assertThat(count)
        .as("snapshot has only example.org, unregistered host cannot be successful USER_SITE block")
        .isZero();
  }

  @Test
  void concurrentDuplicateEventMustReturnReceiptsNotDatabaseFailure() throws Exception {
    var failures = new ArrayList<String>();
    for (int n = 0; n < 5; n++) {
      var f = start(now());
      execution.report(f.p(), report(f, "APPLIED", now(), null));
      var event = event(f, 1, "SITE:example.org", now());
      var gate = new CountDownLatch(1);
      String token = key(), refresh = key();
      db.update(
          "INSERT INTO extension_tokens(id,executor_id,user_id,refresh_hash,family_id,expires_at)"
              + " VALUES (?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 1 DAY))",
          refresh,
          f.executor(),
          f.owner(),
          AuthSupport.hash(key()),
          key());
      db.update(
          "INSERT INTO extension_access_tokens VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 15"
              + " MINUTE))",
          AuthSupport.hash(token),
          refresh);
      var headers = new HttpHeaders();
      headers.setContentType(MediaType.APPLICATION_JSON);
      headers.setBearerAuth(token);
      try (var pool = Executors.newFixedThreadPool(6)) {
        var jobs = new ArrayList<Future<String>>();
        for (int t = 0; t < 6; t++)
          jobs.add(
              pool.submit(
                  () -> {
                    gate.await();
                    var response =
                        http.postForEntity(
                            "/api/v1/events/batch",
                            new HttpEntity<>(Map.of("events", List.of(event)), headers),
                            Map.class);
                    return response.getStatusCode().value() == 200
                        ? "OK"
                        : "FAIL HTTP " + response.getStatusCode().value();
                  }));
        gate.countDown();
        for (var job : jobs) {
          String outcome = job.get(20, TimeUnit.SECONDS);
          if (outcome.startsWith("FAIL")) failures.add(outcome);
        }
      }
      assertThat(
              db.queryForObject(
                  "SELECT COUNT(*) FROM access_events WHERE session_id=?", Integer.class, f.id()))
          .isEqualTo(1);
    }
    System.out.println("AUDIT duplicate concurrency failures=" + failures);
    assertThat(failures)
        .as("30 duplicate HTTP requests should all return ACCEPTED/DUPLICATE receipts")
        .isEmpty();
  }

  @Test
  void resetDuringLoginMustNotLeaveFreshSessionAuthenticatedByOldPassword() throws Exception {
    long u = user();
    String email = db.queryForObject("SELECT email FROM users WHERE id=?", String.class, u),
        old = "audit-old-" + key(),
        replacement = "audit-new-" + key();
    db.update(
        "INSERT INTO auth_identities(user_id,provider,subject,password_hash,updated_at) VALUES"
            + " (?,'EMAIL',?,?,UTC_TIMESTAMP(3))",
        u,
        email,
        new org.springframework.security.crypto.argon2.Argon2PasswordEncoder(16, 32, 1, 19456, 2)
            .encode(old));
    String reset = key();
    db.update(
        "INSERT INTO auth_challenges(id,user_id,kind,token_hash,payload,expires_at) VALUES"
            + " (?,?,'RESET',?,'{}',DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 30 MINUTE))",
        key(),
        u,
        AuthSupport.hash(reset));
    var c = http.getForEntity("/api/v1/auth/csrf", Map.class);
    String cookie = c.getHeaders().getFirst("Set-Cookie").split(";", 2)[0];
    String hash = AuthSupport.hash(cookie.split("=", 2)[1]);
    var h = new HttpHeaders();
    h.setContentType(MediaType.APPLICATION_JSON);
    h.set("Cookie", cookie);
    h.set("X-CSRF-Token", c.getBody().get("csrf_token").toString());
    h.set("Origin", "http://localhost:5174");
    try (var lock = dataSource.getConnection();
        var pool = Executors.newSingleThreadExecutor()) {
      lock.setAutoCommit(false);
      try (var stmt =
          lock.prepareStatement("SELECT id_hash FROM web_sessions WHERE id_hash=? FOR UPDATE")) {
        stmt.setString(1, hash);
        stmt.executeQuery().close();
      }
      var login =
          pool.submit(
              () ->
                  http.postForEntity(
                      "/api/v1/auth/login",
                      new HttpEntity<>(Map.of("email", email, "password", old), h),
                      Map.class));
      boolean blocked = false;
      for (int n = 0; n < 100; n++) {
        blocked =
            db.queryForList("SHOW FULL PROCESSLIST").stream()
                .anyMatch(
                    row ->
                        Objects.toString(row.get("Info"), "")
                            .contains("DELETE FROM web_sessions WHERE id_hash"));
        if (blocked) break;
        Thread.sleep(50);
      }
      assertThat(blocked)
          .as("old password has been checked and login reached session replacement")
          .isTrue();
      try {
        auth.reset(reset, replacement);
      } finally {
        lock.commit();
      }
      var result = login.get(10, TimeUnit.SECONDS);
      String newCookie = result.getHeaders().getFirst("Set-Cookie");
      int authenticated = 0;
      if (newCookie != null) {
        var requestHeaders = new HttpHeaders();
        requestHeaders.set("Cookie", newCookie.split(";", 2)[0]);
        authenticated =
            http.exchange(
                    "/api/v1/auth/me", HttpMethod.GET, new HttpEntity<>(requestHeaders), Map.class)
                .getStatusCode()
                .value();
      }
      System.out.println(
          "AUDIT reset completed before stale login response: login="
              + result.getStatusCode().value()
              + " me="
              + authenticated);
      assertThat(authenticated)
          .as("reset must not allow a session created afterward from pre-reset password validation")
          .isNotEqualTo(200);
    }
  }

  @Test
  void concurrentExactHostRegistrationHasOneWinner() throws Exception {
    long u = user();
    var gate = new CountDownLatch(1);
    var outcomes = new ArrayList<Integer>();
    try (var pool = Executors.newFixedThreadPool(6)) {
      var jobs = new ArrayList<Future<Integer>>();
      for (int i = 0; i < 6; i++)
        jobs.add(
            pool.submit(
                () -> {
                  gate.await();
                  try {
                    sites.create(
                        u,
                        key(),
                        new SiteInput(
                            "same.example.org", "Concurrent", true, "GENERAL", "ALLOW", List.of()));
                    return 201;
                  } catch (kr.ac.kdu.focurve.api.ApiFailure e) {
                    return e.status;
                  }
                }));
      gate.countDown();
      for (var job : jobs) outcomes.add(job.get(10, TimeUnit.SECONDS));
    }
    assertThat(Collections.frequency(outcomes, 201)).isEqualTo(1);
    assertThat(Collections.frequency(outcomes, 409)).isEqualTo(5);
    assertThat(db.queryForObject("SELECT COUNT(*) FROM sites WHERE user_id=?", Integer.class, u))
        .isEqualTo(1);
    System.out.println("AUDIT concurrent site writes: " + outcomes);
  }

  @Test
  void idnNormalizationMustRetainTheHostUsedByBrowserAndExtension() {
    String host = SiteInput.host("https://faß.de/path");
    System.out.println(
        "AUDIT IDN source URL host: Server=" + host + "; WHATWG URL/Extension=xn--fa-hia.de");
    assertThat(host)
        .as("URL must not silently target the different fass.de host")
        .isEqualTo("xn--fa-hia.de");
  }

  @Test
  void invalidReleaseRollsBackReportAndKeepsExecutionLock() {
    var f = start(now());
    execution.report(f.p(), report(f, "APPLIED", now(), null));
    execution.end(f.owner(), f.session(), key());
    var release = report(f, "RELEASED", now(), now());
    var interval = (Map<String, Object>) ((List<?>) release.get("intervals")).getFirst();
    interval.put("duration_ms", 999999999);
    assertThatThrownBy(() -> execution.report(f.p(), release))
        .isInstanceOf(kr.ac.kdu.focurve.api.ApiFailure.class);
    assertThat(execution.current(f.owner()).get("execution_status")).isEqualTo("ENDING");
    assertThat(
            db.queryForObject(
                "SELECT COUNT(*) FROM execution_reports WHERE id=?",
                Integer.class,
                release.get("report_id")))
        .isZero();
    assertThat(
            db.queryForObject(
                "SELECT COUNT(*) FROM session_intervals WHERE session_id=? AND end_at IS NULL",
                Integer.class,
                f.id()))
        .isEqualTo(1);
    System.out.println("AUDIT invalid release rolled back report+interval; lock retained");
  }

  @Test
  void realTransactionsKeepGoodBatchItemAndRollBackInvalidItem() {
    var f = start(now());
    execution.report(f.p(), report(f, "APPLIED", now(), null));
    var good = event(f, 1, "SITE:example.org", now());
    var bad = new LinkedHashMap<>(event(f, 2, "SITE:example.org", now()));
    var payload = new LinkedHashMap<>((Map<String, Object>) bad.get("payload"));
    payload.put("private_url", "https://private.invalid/?secret=test");
    bad.put("payload", payload);
    var response = events.batch(f.p(), List.of(good, bad));
    assertThat(
            db.queryForObject(
                "SELECT COUNT(*) FROM access_events WHERE session_id=?", Integer.class, f.id()))
        .isEqualTo(1);
    assertThat(
            db.queryForObject(
                "SELECT COUNT(*) FROM event_receipts WHERE event_id=?",
                Integer.class,
                bad.get("event_id")))
        .isZero();
    System.out.println("AUDIT batch partial success: " + response);
  }

  @Test
  void confirmedRunSplitsAtSeoulMidnightAndDoesNotDoubleCount() {
    var f = start(now());
    execution.report(f.p(), report(f, "APPLIED", now(), null));
    Instant began = Instant.parse("2026-10-07T14:59:50Z"), end = began.plusSeconds(20);
    db.update(
        "UPDATE session_intervals SET start_at=?,end_at=?,duration_ms=20000 WHERE session_id=?",
        Timestamp.from(began),
        Timestamp.from(end),
        f.id());
    db.update(
        "UPDATE focus_sessions SET"
            + " started_at=?,ended_at=?,execution_status='ENDED',record_status='COMPLETE',active_duration_ms=20000"
            + " WHERE id=?",
        Timestamp.from(began),
        Timestamp.from(end),
        f.id());
    var first = records.summary(f.owner(), "2026-10-07", "2026-10-07");
    var second = records.summary(f.owner(), "2026-10-08", "2026-10-08");
    assertThat(first.get("active_duration_ms")).isEqualTo(10000L);
    assertThat(second.get("active_duration_ms")).isEqualTo(10000L);
    assertThat(records.summary(f.owner(), "2026-10-07", "2026-10-08").get("active_duration_ms"))
        .isEqualTo(20000L);
    System.out.println("AUDIT KST midnight: 10000+10000=20000 ms");
  }
}
