package kr.ac.kdu.focurve;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.time.*;
import java.util.*;
import kr.ac.kdu.focurve.api.ApiFailure;
import kr.ac.kdu.focurve.auth.*;
import kr.ac.kdu.focurve.events.*;
import kr.ac.kdu.focurve.execution.*;
import kr.ac.kdu.focurve.records.*;
import kr.ac.kdu.focurve.sites.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

@ActiveProfiles("test")
@SpringBootTest(properties = "AUTH_PUBLIC_URL=http://127.0.0.1:5173")
@Transactional
class RequiredMvpIntegrationTest {
  @Autowired JdbcTemplate db;
  @Autowired AuthService auth;
  @Autowired EmailSignupCodes codes;
  @Autowired SiteService sites;
  @Autowired ExecutionService sessions;
  @Autowired EventService events;
  @Autowired RecordQueries records;
  @MockitoBean MailDelivery mail;
  @Autowired MemberLinks links;
  @Autowired SocialAuthentication social;
  @Autowired kr.ac.kdu.focurve.imports.ImportQueries imports;

  private long user() {
    String e = UUID.randomUUID() + "@example.invalid";
    db.update(
        "INSERT INTO"
            + " users(display_name,email,email_verified,status,created_at,terms_version,terms_accepted_at)"
            + " VALUES ('검증',?,true,'ACTIVE',UTC_TIMESTAMP(3),'dev-v1',UTC_TIMESTAMP(3))",
        e);
    return db.queryForObject("SELECT id FROM users WHERE email=?", Long.class, e);
  }

  private SiteInput site(String url) {
    return new SiteInput(url, "사이트", true, "DISTRACTION", "BLOCK", List.of());
  }

  private String key() {
    return UUID.randomUUID().toString();
  }

  private String proof(String email,String credential) {
    var captured=new java.util.concurrent.atomic.AtomicReference<String>();
    doAnswer(i->{captured.set(i.getArgument(2));return null;}).when(mail).send(eq(AuthSupport.email(email)),eq("SIGNUP_CODE"),anyString());
    var sent=codes.request(email,credential,UUID.randomUUID().toString());
    return codes.verify(sent.get("request_id").toString(),email,captured.get(),credential,UUID.randomUUID().toString()).get("verification_proof").toString();
  }

  @Test
  void signupIdempotencyAndSingleUseEmailChallenge() {
    String credential = AuthSupport.token(), owner = AuthSupport.hash(credential);
    db.update(
        "INSERT INTO web_sessions(id_hash,user_id,csrf_hash,expires_at,reauthenticated_at) VALUES"
            + " (?,NULL,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 1 DAY),NULL)",
        owner,
        AuthSupport.hash(key()));
    String email = key() + "@EXAMPLE.invalid", request = key();
    var input = new AuthService.Signup(" " + email + " ", "test-password-1234", "가입 테스트", "dev-v1", proof(email,credential));
    var result = auth.signup(input, credential, request);
    assertThat(auth.signup(input, credential, request)).isEqualTo(result);
    assertThat(
            db.queryForObject(
                "SELECT body_hash FROM idempotency_keys WHERE owner_key=?",
                String.class,
                "ANON:" + owner))
        .isNotEqualTo(AuthSupport.hash(auth.encoded(input)));
    verify(mail, times(1)).send(eq(email.replace("EXAMPLE", "example")), eq("SIGNUP_CODE"), anyString());
    assertThatThrownBy(() -> auth.signup(input, credential, key()))
        .isInstanceOfSatisfying(
            ApiFailure.class, e -> assertThat(e.code).isEqualTo("CODE_USED"));
    long id = Long.parseLong(result.get("user_id").toString());
    assertThat(
            db.queryForObject(
                "SELECT password_hash FROM auth_identities WHERE user_id=?", String.class, id))
        .startsWith("$argon2id$");
    String token = auth.challenge(id, "VERIFY", Duration.ofHours(24));
    auth.verify(token);
    assertThat(db.queryForObject("SELECT status FROM users WHERE id=?", String.class, id))
        .isEqualTo("ACTIVE");
    assertThatThrownBy(() -> auth.verify(token))
        .isInstanceOfSatisfying(ApiFailure.class, e -> assertThat(e.code).isEqualTo("USED_TOKEN"));
  }

  @Test
  void mailFailureRollsBackIdentityAndUser() {
    String credential = AuthSupport.token(), owner = AuthSupport.hash(credential);
    db.update(
        "INSERT INTO web_sessions(id_hash,user_id,csrf_hash,expires_at,reauthenticated_at) VALUES"
            + " (?,NULL,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 1 DAY),NULL)",
        owner,
        AuthSupport.hash(key()));
    String email = key() + "@example.invalid";
    doThrow(new ApiFailure(503, "MAIL_UNAVAILABLE"))
        .when(mail)
        .send(eq(email), eq("SIGNUP_CODE"), anyString());
    assertThatThrownBy(() -> codes.request(email,credential,key()))
        .isInstanceOfSatisfying(ApiFailure.class, e -> assertThat(e.status).isEqualTo(503));
  }

  @Test
  void siteScopeVersionOwnershipArchiveAndRetry() {
    long owner = user(), other = user();
    String request = key();
    var saved = sites.create(owner, request, site("https://Example.org/path?private=query"));
    long id = Long.parseLong(saved.get("site_id").toString());
    assertThat(saved.get("canonical_host")).isEqualTo("example.org");
    assertThat(
            auth.decoded(
                auth.encoded(
                    sites.create(owner, request, site("https://Example.org/path?private=query")))))
        .isEqualTo(auth.decoded(auth.encoded(saved)));
    assertThat(sites.create(owner, key(), site("sub.example.org")).get("canonical_host"))
        .isEqualTo("sub.example.org");
    assertThatThrownBy(() -> sites.create(owner, key(), site("https://EXAMPLE.org./other")))
        .isInstanceOfSatisfying(ApiFailure.class, e -> assertThat(e.status).isEqualTo(409));
    assertThatThrownBy(() -> sites.get(other, id))
        .isInstanceOfSatisfying(ApiFailure.class, e -> assertThat(e.status).isEqualTo(404));
    String patchKey = key();
    var changed =
        sites.patch(
            owner, id, patchKey, "\"1\"", Map.of("purpose", "FOCUS", "access_policy", "ALLOW"));
    assertThat(((Number) changed.get("version")).longValue()).isEqualTo(2);
    assertThat(
            auth.decoded(
                auth.encoded(
                    sites.patch(
                        owner,
                        id,
                        patchKey,
                        "\"1\"",
                        Map.of("purpose", "FOCUS", "access_policy", "ALLOW")))))
        .isEqualTo(auth.decoded(auth.encoded(changed)));
    assertThatThrownBy(
            () -> sites.patch(owner, id, key(), "\"1\"", Map.of("display_name", "다른 이름")))
        .isInstanceOfSatisfying(ApiFailure.class, e -> assertThat(e.status).isEqualTo(412));
    String delKey = key();
    sites.delete(owner, id, delKey, "\"2\"");
    sites.delete(owner, id, delKey, "\"2\"");
    assertThat(db.queryForObject("SELECT COUNT(*) FROM sites WHERE id=?", Integer.class, id))
        .isEqualTo(1);
    var restored = sites.create(owner, key(), site("example.org"));
    assertThat(restored.get("site_id")).isEqualTo(id + "");
    assertThat(((Number) restored.get("version")).longValue()).isEqualTo(4);
  }

  @Test
  void rejectsInvalidUrlsAndPolicyCombinations() {
    for (String url :
        List.of(
            "localhost",
            "127.0.0.1",
            "https://user:secret@example.org",
            "https://example.org:443",
            "file:///test",
            "https://[::1]",
            "https://example.org\\evil"))
      assertThatThrownBy(() -> site(url).validate()).isInstanceOf(ApiFailure.class);
    assertThat(SiteInput.host("https://한글.example/path")).startsWith("xn--");
    assertThatThrownBy(
            () -> new SiteInput("example.org", "검증", true, "FOCUS", "BLOCK", List.of()).validate())
        .isInstanceOf(ApiFailure.class);
  }

  @Test
  void requiresActualExecutionReportAndEndRelease() {
    long owner = user();
    String executor = key();
    db.update(
        "INSERT INTO extension_installations VALUES (?,?,?,'test',UTC_TIMESTAMP(3))",
        executor,
        owner,
        AuthSupport.hash(key()));
    String startKey = key();
    var started = sessions.start(owner, executor, 10, startKey);
    assertThat(started.get("execution_status")).isEqualTo("STARTING");
    assertThat(auth.decoded(auth.encoded(sessions.start(owner, executor, 10, startKey))))
        .isEqualTo(auth.decoded(auth.encoded(started)));
    assertThatThrownBy(() -> sessions.start(owner, executor, 10, key()))
        .isInstanceOfSatisfying(
            ApiFailure.class, e -> assertThat(e.code).isEqualTo("ACTIVE_SESSION_EXISTS"));
    var principal = new MemberLinks.Principal(owner, executor);
    String uuid = started.get("session_id").toString();
    long id = ((Number) sessions.byUuid(owner, uuid).get("id")).longValue();
    String apply =
        db.queryForObject(
            "SELECT id FROM execution_commands WHERE session_id=? AND kind='APPLY_POLICY'",
            String.class,
            id);
    Instant begin = Instant.now().minusSeconds(5);
    String intervalId = key();
    sessions.report(
        principal,
        Map.of(
            "report_id",
            key(),
            "session_id",
            uuid,
            "command_id",
            apply,
            "desired_revision",
            1,
            "result",
            "APPLIED",
            "observed_at",
            begin.toString(),
            "executor_id",
            executor,
            "intervals",
            List.of(
                Map.of(
                    "interval_id",
                    intervalId,
                    "kind",
                    "RUN",
                    "start_at",
                    begin.toString(),
                    "quality",
                    "CONFIRMED"))));
    assertThat(sessions.current(owner).get("execution_status")).isEqualTo("RUNNING");
    sessions.end(owner, uuid, key());
    assertThat(sessions.current(owner).get("execution_status")).isEqualTo("ENDING");
    String release =
        db.queryForObject(
            "SELECT id FROM execution_commands WHERE session_id=? AND kind='RELEASE_POLICY'",
            String.class,
            id);
    sessions.report(
        principal,
        Map.of(
            "report_id",
            key(),
            "session_id",
            uuid,
            "command_id",
            apply,
            "desired_revision",
            1,
            "result",
            "APPLIED",
            "observed_at",
            begin.toString(),
            "executor_id",
            executor,
            "intervals",
            List.of(
                Map.of(
                    "interval_id",
                    intervalId,
                    "kind",
                    "RUN",
                    "start_at",
                    begin.toString(),
                    "quality",
                    "CONFIRMED"))));
    assertThat(sessions.current(owner).get("execution_status")).isEqualTo("ENDING");
    sessions.report(
        principal,
        Map.of(
            "report_id",
            key(),
            "session_id",
            uuid,
            "command_id",
            release,
            "desired_revision",
            2,
            "result",
            "RELEASED",
            "observed_at",
            begin.plusSeconds(4).toString(),
            "executor_id",
            executor,
            "intervals",
            List.of(
                Map.of(
                    "interval_id",
                    intervalId,
                    "kind",
                    "RUN",
                    "start_at",
                    begin.toString(),
                    "end_at",
                    begin.plusSeconds(4).toString(),
                    "duration_ms",
                    4000,
                    "quality",
                    "CONFIRMED"))));
    assertThat(sessions.current(owner)).isNull();
    assertThat(sessions.get(owner, id).get("execution_status")).isEqualTo("ENDED");
    assertThat(((Number) sessions.get(owner, id).get("active_duration_ms")).longValue())
        .isEqualTo(4000);
  }

  @Test
  void repeatsRankBeforeDateFilterAndOutOfOrderArrivals() {
    long owner = user();
    sites.create(owner, key(), site("example.org"));
    String executor = key();
    db.update(
        "INSERT INTO extension_installations VALUES (?,?,?,'test',UTC_TIMESTAMP(3))",
        executor,
        owner,
        AuthSupport.hash(key()));
    var started = sessions.start(owner, executor, 10, key());
    String uuid = started.get("session_id").toString();
    long id = ((Number) sessions.byUuid(owner, uuid).get("id")).longValue();
    String snapshot = started.get("policy_snapshot_id").toString();
    db.update(
        "INSERT INTO session_intervals VALUES (?,?,'RUN','2026-10-06 14:59:00','2026-10-06"
            + " 15:10:00',660000,'CONFIRMED')",
        key(),
        id);
    var principal = new MemberLinks.Principal(owner, executor);
    var first = event(executor, uuid, snapshot, 1, "2026-10-06T14:59:30Z");
    var second = event(executor, uuid, snapshot, 2, "2026-10-06T15:00:30Z");
    var third = event(executor, uuid, snapshot, 3, "2026-10-06T15:01:30Z");
    events.batch(principal, List.of(third, first, second));
    events.batch(principal, List.of(second));
    var stats = records.summary(owner, "2026-10-07", "2026-10-07");
    assertThat(((Number) stats.get("total_access")).longValue()).isEqualTo(2);
    assertThat(((Number) stats.get("repeat_access")).longValue()).isEqualTo(2);
    assertThat(
            ((Number) records.summary(owner, "2026-10-06", "2026-10-07").get("total_access"))
                .longValue())
        .isEqualTo(3);
    var entries =
        (List<?>)
            records
                .list(owner, "2026-10-07", "2026-10-07", null, null, null, null, 20)
                .get("items");
    assertThat(entries).hasSize(2);
    assertThat(records.summary(user(), "2026-10-07", "2026-10-07").get("repeat_ratio")).isNull();
  }

  @Test
  void snapshotRemainsImmutableAfterSiteChangesAndDelete() {
    long owner = user();
    var saved = sites.create(owner, key(), site("example.org"));
    String executor = key();
    db.update(
        "INSERT INTO extension_installations VALUES (?,?,?,'test',UTC_TIMESTAMP(3))",
        executor,
        owner,
        AuthSupport.hash(key()));
    var started = sessions.start(owner, executor, 5, key());
    String uuid = started.get("session_id").toString();
    String before = auth.encoded(sessions.policy(owner, uuid));
    long internalId = ((Number) sessions.byUuid(owner, uuid).get("id")).longValue();
    db.update("INSERT INTO session_intervals VALUES (?,?,'RUN',DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 10 SECOND),NULL,NULL,'CONFIRMED')",key(),internalId);
    var access = event(executor, uuid, started.get("policy_snapshot_id").toString(), 1, Instant.now().toString());
    events.batch(new MemberLinks.Principal(owner,executor),List.of(access));
    long id = Long.parseLong(saved.get("site_id").toString());
    sites.patch(owner, id, key(), "\"1\"", Map.of("access_policy", "RECORD"));
    sites.delete(owner, id, key(), "\"2\"");
    assertThat(auth.encoded(sessions.policy(owner, uuid))).isEqualTo(before);
    var detail = (Map<?,?>) records.detail(owner,access.get("event_id").toString());
    assertThat(detail.get("target_host")).isEqualTo("example.org");
    assertThat(auth.encoded(detail.get("policy"))).isEqualTo(before);
    assertThat((List<?>)records.list(owner,null,null,null,null,null,null,20).get("items")).hasSize(1);
  }

  @Test
  void passwordResetRevokesAuthenticationButKeepsRecords() {
    String credential = AuthSupport.token(), owner = AuthSupport.hash(credential);
    db.update(
        "INSERT INTO web_sessions(id_hash,user_id,csrf_hash,expires_at,reauthenticated_at) VALUES"
            + " (?,NULL,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 1 DAY),NULL)",
        owner,
        AuthSupport.hash(key()));
    String email = key() + "@example.invalid";
    long id =
        Long.parseLong(
            auth.signup(
                    new AuthService.Signup(email, "test-password-1234", "검증", "dev-v1",proof(email,credential)),
                    credential,
                    key())
                .get("user_id")
                .toString());
    auth.verify(auth.challenge(id, "VERIFY", Duration.ofHours(24)));
    sites.create(id, key(), site("example.org"));
    db.update(
        "INSERT INTO web_sessions(id_hash,user_id,csrf_hash,expires_at,reauthenticated_at) VALUES"
            + " (?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 1 DAY),NULL)",
        AuthSupport.hash(key()),
        id,
        AuthSupport.hash(key()));
    String executor = key();
    db.update(
        "INSERT INTO extension_installations VALUES (?,?,?,'test',UTC_TIMESTAMP(3))",
        executor,
        id,
        AuthSupport.hash(key()));
    db.update(
        "INSERT INTO extension_tokens VALUES (?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 30"
            + " DAY),NULL)",
        key(),
        executor,
        id,
        AuthSupport.hash(key()),
        key());
    String reset = auth.challenge(id, "RESET", Duration.ofMinutes(30));
    auth.reset(reset, "new-test-password-1234");
    assertThatThrownBy(() -> auth.credentials(email, "test-password-1234"))
        .isInstanceOfSatisfying(
            ApiFailure.class, e -> assertThat(e.code).isEqualTo("INVALID_CREDENTIALS"));
    assertThatThrownBy(() -> auth.reset(reset, "replayed-password-1234"))
        .isInstanceOfSatisfying(ApiFailure.class, e -> assertThat(e.code).isEqualTo("USED_TOKEN"));
    String expiredReset = auth.challenge(id, "RESET", Duration.ofSeconds(-1));
    assertThatThrownBy(() -> auth.reset(expiredReset, "expired-password-1234"))
        .isInstanceOfSatisfying(
            ApiFailure.class, e -> assertThat(e.code).isEqualTo("TOKEN_EXPIRED"));
    assertThat(
            db.queryForObject(
                "SELECT consumed_at IS NULL FROM auth_challenges WHERE token_hash=?",
                Boolean.class,
                AuthSupport.hash(expiredReset)))
        .isTrue();
    assertThat(auth.credentials(email, "new-test-password-1234")).isEqualTo(id);
    assertThat(
            db.queryForObject(
                "SELECT COUNT(*) FROM web_sessions WHERE user_id=?", Integer.class, id))
        .isZero();
    assertThat(
            db.queryForObject(
                "SELECT COUNT(*) FROM extension_tokens WHERE user_id=? AND revoked_at IS NULL",
                Integer.class,
                id))
        .isZero();
    assertThat(((List<?>) sites.list(id, null, null, 20).get("items"))).hasSize(1);
  }

  @Test
  void expiredChallengeDoesNotActivateUser() {
    long id = user();
    db.update("UPDATE users SET email_verified=false,status='PENDING_VERIFICATION' WHERE id=?", id);
    String token = auth.challenge(id, "VERIFY", Duration.ofSeconds(-1));
    assertThatThrownBy(() -> auth.verify(token))
        .isInstanceOfSatisfying(ApiFailure.class, e -> assertThat(e.status).isEqualTo(410));
    assertThat(db.queryForObject("SELECT email_verified FROM users WHERE id=?", Boolean.class, id))
        .isFalse();
  }

  @Test
  void emailLocalPartCasePreservedAndDomainNormalized() {
    assertThat(AuthSupport.email(" Local.Part@EXAMPLE.ORG ")).isEqualTo("Local.Part@example.org");
    assertThat(AuthSupport.email("local.part@example.org"))
        .isNotEqualTo(AuthSupport.email("Local.Part@example.org"));
  }

  @Test
  void refreshReuseRevokesWholeFamilyAndDoesNotDeleteAccount() {
    long owner = user();
    String executor = key(), refresh = AuthSupport.token(), family = key();
    db.update(
        "INSERT INTO extension_installations VALUES (?,?,?,'test',UTC_TIMESTAMP(3))",
        executor,
        owner,
        AuthSupport.hash(key()));
    db.update(
        "INSERT INTO extension_tokens VALUES (?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 30"
            + " DAY),NULL)",
        key(),
        executor,
        owner,
        AuthSupport.hash(refresh),
        family);
    var rotated = (Map<?, ?>) links.refresh(refresh);
    assertThat(links.access("Bearer " + rotated.get("access_token")).user()).isEqualTo(owner);
    assertThatThrownBy(() -> links.refresh(refresh))
        .isInstanceOfSatisfying(ApiFailure.class, e -> assertThat(e.code).isEqualTo("TOKEN_REUSE"));
    assertThatThrownBy(() -> links.access("Bearer " + rotated.get("access_token")))
        .isInstanceOfSatisfying(ApiFailure.class, e -> assertThat(e.status).isEqualTo(401));
    assertThat(db.queryForObject("SELECT COUNT(*) FROM users WHERE id=?", Integer.class, owner))
        .isEqualTo(1);
  }

  @Test
  void syntheticSocialTicketMustMatchCurrentAccountAndIsSingleUse() {
    long owner = user();
    String cookie = AuthSupport.token();
    String hash = AuthSupport.hash(cookie);
    db.update(
        "INSERT INTO web_sessions(id_hash,user_id,csrf_hash,expires_at,reauthenticated_at) VALUES"
            + " (?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 1 DAY),NULL)",
        hash,
        owner,
        AuthSupport.hash(key()));
    db.update(
        "INSERT INTO auth_identities(user_id,provider,subject,updated_at) VALUES"
            + " (?,'GOOGLE','test-subject',UTC_TIMESTAMP(3))",
        owner);
    String ticket = AuthSupport.token();
    db.update(
        "INSERT INTO auth_challenges(id,user_id,kind,token_hash,provider,payload,expires_at) VALUES"
            + " (?,?, 'SOCIAL_TICKET',?,'google',?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 5 MINUTE))",
        key(),
        owner,
        AuthSupport.hash(ticket),
        auth.encoded(Map.of("mode", "link", "session_hash", hash, "subject", "test-subject")));
    var req = new org.springframework.mock.web.MockHttpServletRequest();
    req.setCookies(new jakarta.servlet.http.Cookie("focurve_session", cookie));
    social.reauthenticate(ticket, req);
    assertThat(
            db.queryForObject(
                "SELECT reauthenticated_at IS NOT NULL FROM web_sessions WHERE id_hash=?",
                Boolean.class,
                hash))
        .isTrue();
    assertThatThrownBy(() -> social.reauthenticate(ticket, req))
        .isInstanceOfSatisfying(ApiFailure.class, e -> assertThat(e.code).isEqualTo("USED_TOKEN"));
  }

  @Test
  void accessSchemaRejectsPrivatePayloadAndOtherExecutor() {
    long owner = user();
    String executor = key();
    db.update(
        "INSERT INTO extension_installations VALUES (?,?,?,'test',UTC_TIMESTAMP(3))",
        executor,
        owner,
        AuthSupport.hash(key()));
    var started = sessions.start(owner, executor, 5, key());
    String uuid = started.get("session_id").toString(),
        snapshot = started.get("policy_snapshot_id").toString();
    var e = new LinkedHashMap<>(event(executor, uuid, snapshot, 1, Instant.now().toString()));
    e.put("private_url", "https://example.org/?secret=not-for-storage");
    var result = (Map<?, ?>) events.batch(new MemberLinks.Principal(owner, executor), List.of(e));
    assertThat(((Map<?, ?>) ((List<?>) result.get("items")).getFirst()).get("status"))
        .isEqualTo("REJECTED");
    assertThat(
            db.queryForObject(
                "SELECT COUNT(*) FROM event_receipts WHERE event_id=?",
                Integer.class,
                e.get("event_id")))
        .isZero();
  }

  @Test
  void importReadSideIsOwnerScopedAndProvenanceIsPermanent() {
    long owner = user(), other = user();
    String executor = key(), batch = key(), source = key();
    db.update(
        "INSERT INTO extension_installations VALUES (?,?,?,'test',UTC_TIMESTAMP(3))",
        executor,
        owner,
        AuthSupport.hash(key()));
    db.update(
        "INSERT INTO guest_import_batches VALUES (?,?,?,'PARTIAL',UTC_TIMESTAMP(3),NULL)",
        batch,
        owner,
        executor);
    db.update(
        "INSERT INTO guest_import_items VALUES (?,?,?,?,?,"
            + " 'SITE',?,'SUCCEEDED','fixture-result',NULL)",
        key(),
        batch,
        executor,
        source,
        AuthSupport.hash("test-source"),
        owner);
    db.update(
        "INSERT INTO guest_import_batch_items SELECT batch_id,id FROM guest_import_items WHERE"
            + " batch_id=?",
        batch);
    assertThat(((List<?>) imports.get(owner, batch).get("items"))).hasSize(1);
    assertThatThrownBy(() -> imports.get(other, batch))
        .isInstanceOfSatisfying(ApiFailure.class, e -> assertThat(e.status).isEqualTo(404));
    assertThatThrownBy(
            () ->
                db.update(
                    "INSERT INTO guest_import_items VALUES"
                        + " (?,?,?,?,?,'SITE',?,'PENDING',NULL,NULL)",
                    key(),
                    batch,
                    executor,
                    source,
                    AuthSupport.hash("changed"),
                    other))
        .isInstanceOf(org.springframework.dao.DuplicateKeyException.class);
  }

  @Test
  void failedApplyAndUnconfirmedReleaseKeepLockAndLatestRevision() {
    long owner = user();
    String executor = key();
    db.update(
        "INSERT INTO extension_installations VALUES (?,?,?,'test',UTC_TIMESTAMP(3))",
        executor,
        owner,
        AuthSupport.hash(key()));
    var start = sessions.start(owner, executor, 5, key());
    String uuid = start.get("session_id").toString();
    long id = ((Number) sessions.byUuid(owner, uuid).get("id")).longValue();
    var principal = new MemberLinks.Principal(owner, executor);
    String apply =
        db.queryForObject("SELECT id FROM execution_commands WHERE session_id=?", String.class, id);
    sessions.report(principal, report(executor, uuid, apply, 1, "FAILED"));
    assertThat(sessions.current(owner).get("execution_status")).isEqualTo("UNKNOWN");
    assertThatThrownBy(() -> sessions.start(owner, executor, 5, key()))
        .isInstanceOf(ApiFailure.class);
    String release =
        db.queryForObject(
            "SELECT id FROM execution_commands WHERE session_id=? AND desired_revision=2",
            String.class,
            id);
    sessions.report(principal, report(executor, uuid, release, 2, "UNCONFIRMED"));
    assertThat(sessions.current(owner)).isNotNull();
    var commands = (Map<?, ?>) sessions.commands(principal);
    var list = (List<?>) commands.get("commands");
    assertThat(list).hasSize(1);
    assertThat(((Number) ((Map<?, ?>) list.getFirst()).get("desired_revision")).longValue())
        .isEqualTo(2);
    sessions.report(principal, report(executor, uuid, release, 2, "RELEASED"));
    assertThat(sessions.current(owner)).isNull();
    assertThat(sessions.get(owner, id).get("execution_status")).isEqualTo("START_FAILED");
  }

  private Map<String, Object> report(
      String executor, String session, String command, long revision, String result) {
    return Map.of(
        "report_id",
        key(),
        "executor_id",
        executor,
        "session_id",
        session,
        "command_id",
        command,
        "desired_revision",
        revision,
        "result",
        result,
        "observed_at",
        Instant.now().toString(),
        "intervals",
        List.of());
  }

  @Test
  void syntheticCanceledSocialStateCreatesNoUserAndCannotReplay() {
    String cookie = AuthSupport.token(),
        hash = AuthSupport.hash(cookie),
        state = AuthSupport.token();
    db.update(
        "INSERT INTO web_sessions(id_hash,user_id,csrf_hash,expires_at,reauthenticated_at) VALUES"
            + " (?,NULL,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 1 DAY),NULL)",
        hash,
        AuthSupport.hash(key()));
    db.update(
        "INSERT INTO auth_challenges(id,kind,token_hash,provider,payload,expires_at) VALUES"
            + " (?,'SOCIAL_STATE',?,'google',?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 5 MINUTE))",
        key(),
        AuthSupport.hash(state),
        auth.encoded(Map.of("mode", "login", "session_hash", hash, "return_path", "/")));
    var req = new org.springframework.mock.web.MockHttpServletRequest();
    req.setCookies(new jakarta.servlet.http.Cookie("focurve_session", cookie));
    int before = db.queryForObject("SELECT COUNT(*) FROM users", Integer.class);
    assertThat(
            social.callback(
                "google",
                state,
                null,
                "access_denied",
                req,
                new org.springframework.mock.web.MockHttpServletResponse()))
        .isEqualTo("http://127.0.0.1:5173/#social-canceled");
    assertThat(db.queryForObject("SELECT COUNT(*) FROM users", Integer.class)).isEqualTo(before);
    assertThatThrownBy(
            () ->
                social.callback(
                    "google",
                    state,
                    null,
                    "access_denied",
                    req,
                    new org.springframework.mock.web.MockHttpServletResponse()))
        .isInstanceOfSatisfying(
            ApiFailure.class, e -> assertThat(e.code).isEqualTo("INVALID_STATE"));
  }

  @Test
  void syntheticFirstSocialTicketCreatesAccountOnlyAtConfirmation() {
    String cookie = AuthSupport.token(),
        hash = AuthSupport.hash(cookie),
        ticket = AuthSupport.token(),
        subject = "fixture-" + key();
    db.update(
        "INSERT INTO web_sessions(id_hash,user_id,csrf_hash,expires_at,reauthenticated_at) VALUES"
            + " (?,NULL,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 1 DAY),NULL)",
        hash,
        AuthSupport.hash(key()));
    db.update(
        "INSERT INTO auth_challenges(id,kind,token_hash,provider,payload,expires_at) VALUES"
            + " (?,'SOCIAL_TICKET',?,'kakao',?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 5 MINUTE))",
        key(),
        AuthSupport.hash(ticket),
        auth.encoded(
            Map.of(
                "mode",
                "login",
                "session_hash",
                hash,
                "subject",
                subject,
                "email",
                subject + "@example.invalid")));
    assertThat(
            db.queryForObject(
                "SELECT COUNT(*) FROM auth_identities WHERE subject=?", Integer.class, subject))
        .isZero();
    var req = new org.springframework.mock.web.MockHttpServletRequest();
    req.setCookies(new jakarta.servlet.http.Cookie("focurve_session", cookie));
    var created =
        (Map<?, ?>)
            social.complete(
                ticket,
                "dev-v1",
                "소셜 확인",
                req,
                new org.springframework.mock.web.MockHttpServletResponse());
    assertThat(created.get("email")).isEqualTo(subject + "@example.invalid");
    assertThat(created.get("providers")).isEqualTo(List.of("KAKAO"));
    assertThat(
            db.queryForObject(
                "SELECT COUNT(*) FROM auth_identities WHERE subject=?", Integer.class, subject))
        .isEqualTo(1);
    assertThatThrownBy(
            () ->
                social.complete(
                    ticket,
                    "dev-v1",
                    "다시 확인",
                    req,
                    new org.springframework.mock.web.MockHttpServletResponse()))
        .isInstanceOfSatisfying(ApiFailure.class, e -> assertThat(e.code).isEqualTo("USED_TOKEN"));
  }

  @Test
  void statisticsSeparateOverrunFromConfirmedFocusTime() {
    long owner = user();
    String executor = key();
    db.update(
        "INSERT INTO extension_installations VALUES (?,?,?,'test',UTC_TIMESTAMP(3))",
        executor,
        owner,
        AuthSupport.hash(key()));
    var session = sessions.start(owner, executor, 1, key());
    long id =
        ((Number) sessions.byUuid(owner, session.get("session_id").toString()).get("id"))
            .longValue();
    db.update(
        "INSERT INTO session_intervals VALUES (?,?,'RUN',DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 70"
            + " SECOND),UTC_TIMESTAMP(3),70000,'CONFIRMED')",
        key(),
        id);
    assertThat(((Number) records.summary(owner, null, null).get("active_duration_ms")).longValue())
        .isEqualTo(60000);
  }

  @Test
  void recordedAndShortsEventsAreSeparateValidAccessesAndFailuresAreRejected() {
    long owner = user();
    sites.create(
        owner, key(), new SiteInput("example.org", "기록", true, "DISTRACTION", "RECORD", List.of()));
    sites.create(
        owner,
        key(),
        new SiteInput(
            "youtube.com",
            "쇼츠",
            true,
            "GENERAL",
            "ALLOW",
            List.of(new SiteInput.Feature("YOUTUBE_SHORTS", true))));
    String executor = key();
    db.update(
        "INSERT INTO extension_installations VALUES (?,?,?,'test',UTC_TIMESTAMP(3))",
        executor,
        owner,
        AuthSupport.hash(key()));
    var session = sessions.start(owner, executor, 5, key());
    String uuid = session.get("session_id").toString(),
        snapshot = session.get("policy_snapshot_id").toString();
    long id = ((Number) sessions.byUuid(owner, uuid).get("id")).longValue();
    db.update(
        "INSERT INTO session_intervals VALUES (?,?,'RUN',DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 10"
            + " SECOND),NULL,NULL,'CONFIRMED')",
        key(),
        id);
    var recorded =
        new LinkedHashMap<>(event(executor, uuid, snapshot, 1, Instant.now().toString()));
    recorded.put("event_type", "RECORDED_ACCESS");
    var recordPayload = new LinkedHashMap<>((Map<String, Object>) recorded.get("payload"));
    recordPayload.put("reason", "RECORD");
    recorded.put("payload", recordPayload);
    var feature = new LinkedHashMap<>(event(executor, uuid, snapshot, 2, Instant.now().toString()));
    feature.put("event_type", "BLOCKED_FEATURE_ACCESS");
    feature.put(
        "payload",
        Map.of(
            "access_seq",
            2,
            "navigation_id",
            key(),
            "target_kind",
            "FEATURE",
            "target_host",
            "youtube.com",
            "target_key",
            "FEATURE:youtube.com:YOUTUBE_SHORTS",
            "feature_code",
            "YOUTUBE_SHORTS",
            "reason",
            "FEATURE"));
    events.batch(new MemberLinks.Principal(owner, executor), List.of(recorded, feature));
    var metrics = records.summary(owner, null, null);
    assertThat(((Number) metrics.get("total_access")).longValue()).isEqualTo(2);
    assertThat(((Number) metrics.get("blocked_access")).longValue()).isEqualTo(1);
    var invalid = new LinkedHashMap<>(feature);
    invalid.put("event_id", key());
    invalid.put("result", "FAILED");
    var result =
        (Map<?, ?>) events.batch(new MemberLinks.Principal(owner, executor), List.of(invalid));
    assertThat(((Map<?, ?>) ((List<?>) result.get("items")).getFirst()).get("status"))
        .isEqualTo("REJECTED");
    assertThat(((Number) records.summary(owner, null, null).get("total_access")).longValue())
        .isEqualTo(2);
  }

  @Test
  void malformedDatesAndEventFiltersAreRejectedInsteadOfEmptySuccess() {
    long owner = user();
    assertThatThrownBy(() -> records.list(owner, null, null, null, null, "NOT_AN_EVENT", null, 20))
        .isInstanceOfSatisfying(ApiFailure.class, e -> assertThat(e.status).isEqualTo(422));
    assertThatThrownBy(() -> records.summary(owner, "2026-10-08", "2026-10-07"))
        .isInstanceOfSatisfying(ApiFailure.class, e -> assertThat(e.status).isEqualTo(422));
    assertThatThrownBy(() -> records.summary(owner, "2025-01-01", "2026-10-07"))
        .isInstanceOf(ApiFailure.class);
  }

  private Map<String, Object> event(
      String executor, String session, String snapshot, int seq, String time) {
    return Map.of(
        "event_id",
        key(),
        "schema_version",
        "1.1",
        "executor_id",
        executor,
        "session_id",
        session,
        "policy_snapshot_id",
        snapshot,
        "event_type",
        "BLOCKED_SITE_ACCESS",
        "occurred_at",
        time,
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
            "SITE:example.org",
            "reason",
            "USER_SITE"));
  }

  @Test
  @SuppressWarnings("unchecked")
  void event12ActualHostRankingMatchedPolicyReasonsAndDuplicateReceipt() {
    long owner=user();
    sites.create(owner,key(),new SiteInput("naver.com","contract",true,"DISTRACTION","RECORD",List.of()));
    String executor=key();
    db.update("INSERT INTO extension_installations VALUES (?,?,?,'test',UTC_TIMESTAMP(3))",executor,owner,AuthSupport.hash(key()));
    var started=sessions.start(owner,executor,10,key());
    // Synthetic Content snapshot for ingestion validation; not actual Content detection/config UI.
    var frozen=new LinkedHashMap<String,Object>((Map<String,Object>)sessions.policy(owner,started.get("session_id").toString()));
    var content=new LinkedHashMap<>(ExecutionService.defaultContent());
    content.put("adult_domains",Map.of("enabled",true,"custom_hosts",List.of(),"exceptions",List.of()));
    content.put("keywords",Map.of("enabled",true,"rules",List.of(),"exceptions",List.of()));
    frozen.put("content_policy",content);
    db.update("UPDATE policy_snapshots SET payload=? WHERE id=?",auth.encoded(frozen),started.get("policy_snapshot_id"));
    long id=((Number)sessions.byUuid(owner,started.get("session_id").toString()).get("id")).longValue();
    db.update("INSERT INTO session_intervals VALUES (?,?,'RUN',DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 120 SECOND),UTC_TIMESTAMP(3),120000,'CONFIRMED')",key(),id);
    var principal=new MemberLinks.Principal(owner,executor);
    var batch=new ArrayList<Map<String,Object>>();
    String[] hosts={"naver.com","chzzk.naver.com","chzzk.naver.com","www.naver.com","chzzk.naver.com"};
    for(int i=0;i<hosts.length;i++) {
      var e=new LinkedHashMap<>(event(executor,started.get("session_id").toString(),started.get("policy_snapshot_id").toString(),i+1,Instant.now().minusSeconds(60-i).toString()));
      var payload=new LinkedHashMap<>((Map<String,Object>)e.get("payload"));
      e.put("schema_version","1.2");e.put("event_type","RECORDED_ACCESS");
      payload.put("target_host",hosts[i]);payload.put("target_key",hosts[i]);payload.put("reason","RECORD");payload.put("matched_policy_host","naver.com");payload.put("blocked_reasons",List.of());e.put("payload",payload);batch.add(e);
    }
    events.batch(principal,List.of(batch.get(2),batch.get(0),batch.get(4),batch.get(1),batch.get(3)));
    var duplicate=(Map<?,?>)events.batch(principal,List.of(batch.get(2)));
    assertThat(duplicate.toString()).contains("DUPLICATE");
    assertThat(db.queryForObject("SELECT COUNT(*) FROM access_events WHERE session_id=?",Integer.class,id)).isEqualTo(5);
    var one=(Map<?,?>)records.detail(owner,batch.get(1).get("event_id").toString());
    var two=(Map<?,?>)records.detail(owner,batch.get(2).get("event_id").toString());
    var three=(Map<?,?>)records.detail(owner,batch.get(4).get("event_id").toString());
    assertThat(one.get("repeat_count")).isEqualTo(0L);assertThat(two.get("repeat_count")).isEqualTo(1L);assertThat(three.get("repeat_count")).isEqualTo(2L);
    assertThat(three.get("target_key")).isEqualTo("chzzk.naver.com");assertThat(three.get("matched_policy_host")).isEqualTo("naver.com");assertThat((List<?>)three.get("blocked_reasons")).isEmpty();
    assertThat(((Number)records.summary(owner,null,null).get("repeat_access")).intValue()).isEqualTo(2);
    // Existing stored minimal receipts must remain readable without invented policy metadata.
    db.update("UPDATE event_receipts SET payload='{}' WHERE event_id=?",batch.get(0).get("event_id"));
    var old=(Map<?,?>)records.detail(owner,batch.get(0).get("event_id").toString());
    assertThat(old.get("matched_policy_host")).isNull();
    var multiple=new LinkedHashMap<>(event(executor,started.get("session_id").toString(),started.get("policy_snapshot_id").toString(),6,Instant.now().minusSeconds(30).toString()));
    var reasons=new LinkedHashMap<>((Map<String,Object>)multiple.get("payload"));
    multiple.put("schema_version","1.2");multiple.put("event_type","BLOCKED_SITE_ACCESS");
    reasons.put("target_host","chzzk.naver.com");reasons.put("target_key","chzzk.naver.com");reasons.put("matched_policy_host","naver.com");reasons.put("reason","ADULT_DOMAIN");reasons.put("blocked_reasons",List.of("ADULT_DOMAIN","KEYWORD"));multiple.put("payload",reasons);
    events.batch(principal,List.of(multiple));events.batch(principal,List.of(multiple));
    var combined=(Map<?,?>)records.detail(owner,multiple.get("event_id").toString());
    assertThat(combined.get("blocked_reasons")).isEqualTo(List.of("ADULT_DOMAIN","KEYWORD"));
    assertThat(db.queryForObject("SELECT COUNT(*) FROM access_events WHERE session_id=?",Integer.class,id)).isEqualTo(6);
    var badEvent=new LinkedHashMap<>(multiple);badEvent.put("event_id",key());badEvent.put("local_seq",99L);
    var malformed=new LinkedHashMap<>(reasons);malformed.put("access_seq",7.5);badEvent.put("payload",malformed);
    assertThat(events.batch(principal,List.of(badEvent)).toString()).contains("REJECTED");
    assertThat(db.queryForObject("SELECT COUNT(*) FROM access_events WHERE session_id=?",Integer.class,id)).isEqualTo(6);
  }

}
