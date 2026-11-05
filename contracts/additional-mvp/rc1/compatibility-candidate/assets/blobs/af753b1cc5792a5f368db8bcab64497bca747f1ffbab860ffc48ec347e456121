package kr.ac.kdu.focurve.execution;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import kr.ac.kdu.focurve.api.ApiFailure;
import kr.ac.kdu.focurve.auth.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MemberLinks {
  public record Principal(long user, String executor) {}

  private final JdbcTemplate db;
  private final Set<String> callbacks;
  private final String publicUrl;

  public MemberLinks(
      JdbcTemplate db,
      @Value("${EXTENSION_CALLBACK_URIS:}") String callbacks,
      @Value("${AUTH_PUBLIC_URL:http://127.0.0.1:5173}") String publicUrl) {
    this.db = db;
    this.callbacks = Set.of(callbacks.split(","));
    this.publicUrl = publicUrl;
  }

  @Transactional
  public Object install(String executor, String version) {
    AuthService.uuid(executor);
    AuthSupport.text(version, 1, 40);
    String proof = AuthSupport.token();
    try {
      db.update(
          "INSERT INTO extension_installations(id,proof_hash,client_version) VALUES (?,?,?)",
          executor,
          AuthSupport.hash(proof),
          version);
    } catch (org.springframework.dao.DuplicateKeyException e) {
      throw new ApiFailure(409, "INSTALLATION_EXISTS");
    }
    return Map.of("executor_id", executor, "installation_proof", proof);
  }

  public String proof(String executor, String proof) {
    if (proof == null
        || db.queryForList(
                "SELECT id FROM extension_installations WHERE id=? AND proof_hash=?",
                executor,
                AuthSupport.hash(proof))
            .isEmpty()) throw new ApiFailure(401, "INVALID_INSTALLATION");
    return executor;
  }

  public Principal access(String value) {
    if (value == null || !value.startsWith("Bearer ")) throw new ApiFailure(401, "UNAUTHENTICATED");
    var rows =
        db.queryForList(
            "SELECT t.user_id,t.executor_id FROM extension_access_tokens a JOIN extension_tokens t"
                + " ON t.id=a.refresh_id JOIN extension_installations i ON i.id=t.executor_id WHERE"
                + " a.token_hash=? AND a.expires_at>UTC_TIMESTAMP(3) AND t.revoked_at IS NULL AND"
                + " t.expires_at>UTC_TIMESTAMP(3) AND i.current_user_id=t.user_id",
            AuthSupport.hash(value.substring(7)));
    if (rows.isEmpty()) throw new ApiFailure(401, "INVALID_TOKEN");
    return new Principal(
        ((Number) rows.getFirst().get("user_id")).longValue(),
        rows.getFirst().get("executor_id").toString());
  }

  @Transactional
  public Object request(String executor, String challenge, String state, String uri, String proof) {
    proof(executor, proof);
    if (!callbacks.contains(uri)
        || (challenge == null || !challenge.matches("[A-Za-z0-9_-]{43}"))
        || state == null
        || state.isBlank()) throw new ApiFailure(422, "INVALID_CALLBACK");
    String id = UUID.randomUUID().toString();
    Instant expires = Instant.now().plusSeconds(300);
    db.update(
        "INSERT INTO"
            + " link_requests(id,executor_id,code_challenge,state_hash,callback_uri,expires_at)"
            + " VALUES (?,?,?,?,?,?)",
        id,
        executor,
        challenge,
        AuthSupport.hash(state),
        uri,
        Timestamp.from(expires));
    db.update("INSERT INTO link_evidence(link_request_id,status) VALUES (?,'PENDING')", id);
    return Map.of(
        "link_request_id",
        id,
        "verification_uri",
        publicUrl + "/#link?id=" + id,
        "expires_at",
        expires.toString());
  }

  @Transactional
  public Object approve(long owner, String id, boolean approve) {
    db.queryForList("SELECT id FROM users WHERE id=? FOR UPDATE", owner);
    var r = linkRequest(id);
    if (r.get("approved_user_id") != null
        && ((Number) r.get("approved_user_id")).longValue() != owner)
      throw new ApiFailure(409, "IDENTITY_CONFLICT");
    if (!approve) {
      db.update("UPDATE link_requests SET consumed_at=UTC_TIMESTAMP(3) WHERE id=?", id);
      db.update("UPDATE link_evidence SET status='DENIED' WHERE link_request_id=?", id);
      return Map.of("approved", false);
    }
    var evidence = db.queryForList("SELECT * FROM link_evidence WHERE link_request_id=?", id);
    if (evidence.isEmpty()
        || evidence.getFirst().get("received_at") == null
        || kr.ac.kdu.focurve.api.DbTime.instant(evidence.getFirst().get("received_at"))
            .isBefore(Instant.now().minusSeconds(30))
        || kr.ac.kdu.focurve.api.DbTime.instant(evidence.getFirst().get("observed_at"))
            .isBefore(Instant.now().minusSeconds(30)))
      throw new ApiFailure(409, "EXECUTION_EVIDENCE_REQUIRED");
    String executor = r.get("executor_id").toString();
    idleInstallation(executor);
    if (!db.queryForList("SELECT user_id FROM active_execution_locks WHERE user_id=?", owner)
        .isEmpty()) throw new ApiFailure(409, "ACTIVE_SESSION_EXISTS");
    db.update("UPDATE link_requests SET approved_user_id=? WHERE id=?", owner, id);
    db.update("UPDATE link_evidence SET status='APPROVED' WHERE link_request_id=?", id);
    return Map.of("approved", true, "delivery", "EXTENSION_POLL");
  }

  private Map<String, Object> linkRequest(String id) {
    AuthService.uuid(id);
    var rows = db.queryForList("SELECT * FROM link_requests WHERE id=? FOR UPDATE", id);
    if (rows.isEmpty()) throw new ApiFailure(404, "LINK_NOT_FOUND");
    var r = rows.getFirst();
    if (r.get("consumed_at") != null
        || !kr.ac.kdu.focurve.api.DbTime.instant(r.get("expires_at")).isAfter(Instant.now()))
      throw new ApiFailure(410, "LINK_EXPIRED");
    return r;
  }

  private void idleInstallation(String executor) {
    var row =
        db.queryForMap(
            "SELECT current_user_id FROM extension_installations WHERE id=? FOR UPDATE", executor);
    if (row.get("current_user_id") != null) throw new ApiFailure(409, "IDENTITY_ALREADY_LINKED");
    if (!db.queryForList("SELECT user_id FROM active_execution_locks WHERE executor_id=?", executor)
        .isEmpty()) throw new ApiFailure(409, "RELEASE_UNCONFIRMED");
  }

  @Transactional
  public Object evidence(String id, String installationProof, Map<String, Object> body) {
    var r = linkRequest(id);
    String executor = r.get("executor_id").toString();
    proof(executor, installationProof);
    if (!Set.of(
                "observation_id",
                "link_request_id",
                "owner_context",
                "transition",
                "active_session_id",
                "owned_rule_ids",
                "pending_action_count",
                "observed_at")
            .equals(body.keySet())
        || !id.equals(body.get("link_request_id"))
        || !("GUEST:" + executor).equals(body.get("owner_context"))
        || !"LINK_PENDING".equals(body.get("transition")))
      throw new ApiFailure(422, "INVALID_SCHEMA");
    AuthService.uuid(ExecutionService.str(body, "observation_id"));
    if (body.get("active_session_id") != null
        || !(body.get("owned_rule_ids") instanceof List<?> rules)
        || !rules.isEmpty()
        || ExecutionService.number(body, "pending_action_count") != 0)
      throw new ApiFailure(409, "GUEST_SESSION_ACTIVE");
    Instant at = ExecutionService.instant(body, "observed_at");
    if (at.isBefore(Instant.now().minusSeconds(30)) || at.isAfter(Instant.now().plusSeconds(5)))
      throw new ApiFailure(409, "EXECUTION_EVIDENCE_REQUIRED");
    idleInstallation(executor);
    String encoded;
    try {
      encoded = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(body);
    } catch (Exception e) {
      throw new ApiFailure(422, "INVALID_SCHEMA");
    }
    db.update(
        "UPDATE link_evidence SET evidence=?,observed_at=?,received_at=UTC_TIMESTAMP(3) WHERE"
            + " link_request_id=?",
        encoded,
        Timestamp.from(at),
        id);
    return Map.of("accepted", true);
  }

  @Transactional
  public Object claim(String id, String state, String installationProof) {
    var r = linkRequest(id);
    proof(r.get("executor_id").toString(), installationProof);
    if (state == null || !AuthSupport.hash(state).equals(r.get("state_hash")))
      throw new ApiFailure(401, "INVALID_STATE");
    if (r.get("approved_user_id") == null) return Map.of("status", "PENDING");
    // Deterministic for one approved request: a lost poll response can be retried without storing
    // raw code.
    String code =
        AuthSupport.fingerprint(
            installationProof, id + ":" + state + ":" + r.get("approved_user_id"));
    if (r.get("code_hash") == null)
      db.update(
          "UPDATE link_requests SET code_hash=?,expires_at=LEAST(expires_at,?) WHERE id=?",
          AuthSupport.hash(code),
          Timestamp.from(Instant.now().plusSeconds(60)),
          id);
    return Map.of("status", "APPROVED", "code", code, "state", state);
  }

  @Transactional
  public Object exchange(String id, String code, String verifier, String proof) {
    var lookup = db.queryForList("SELECT approved_user_id FROM link_requests WHERE id=?", id);
    if (lookup.isEmpty() || lookup.getFirst().get("approved_user_id") == null)
      throw new ApiFailure(401, "INVALID_GRANT");
    db.queryForList(
        "SELECT id FROM users WHERE id=? FOR UPDATE", lookup.getFirst().get("approved_user_id"));
    var rows = db.queryForList("SELECT * FROM link_requests WHERE id=? FOR UPDATE", id);
    if (rows.isEmpty()) throw new ApiFailure(401, "INVALID_GRANT");
    var r = rows.getFirst();
    String executor = r.get("executor_id").toString();
    proof(executor, proof);
    if (code == null
        || verifier == null
        || !verifier.matches("[A-Za-z0-9._~-]{43,128}")
        || r.get("approved_user_id") == null
        || r.get("consumed_at") != null
        || !kr.ac.kdu.focurve.api.DbTime.instant(r.get("expires_at")).isAfter(Instant.now())
        || !AuthSupport.hash(code).equals(r.get("code_hash"))
        || !s256(verifier).equals(r.get("code_challenge")))
      throw new ApiFailure(401, "INVALID_GRANT");
    long owner = ((Number) r.get("approved_user_id")).longValue();
    idleInstallation(executor);
    if (!db.queryForList("SELECT user_id FROM active_execution_locks WHERE user_id=?", owner)
        .isEmpty()) throw new ApiFailure(409, "ACTIVE_SESSION_EXISTS");
    db.update("UPDATE link_requests SET consumed_at=UTC_TIMESTAMP(3) WHERE id=?", id);
    db.update(
        "UPDATE extension_installations SET current_user_id=?,last_seen_at=UTC_TIMESTAMP(3) WHERE"
            + " id=?",
        owner,
        executor);
    return issue(owner, executor, UUID.randomUUID().toString());
  }

  @Transactional(noRollbackFor = ApiFailure.class)
  public Object refresh(String refresh) {
    var rows =
        db.queryForList(
            "SELECT * FROM extension_tokens WHERE refresh_hash=? FOR UPDATE",
            AuthSupport.hash(Objects.toString(refresh, "")));
    if (rows.isEmpty()) throw new ApiFailure(401, "INVALID_GRANT");
    var r = rows.getFirst();
    if (r.get("revoked_at") != null) {
      db.update(
          "UPDATE extension_tokens SET revoked_at=UTC_TIMESTAMP(3) WHERE family_id=?",
          r.get("family_id"));
      throw new ApiFailure(401, "TOKEN_REUSE");
    }
    if (!kr.ac.kdu.focurve.api.DbTime.instant(r.get("expires_at")).isAfter(Instant.now()))
      throw new ApiFailure(401, "INVALID_GRANT");
    if (db.queryForList(
            "SELECT id FROM extension_installations WHERE id=? AND current_user_id=?",
            r.get("executor_id"),
            r.get("user_id"))
        .isEmpty()) throw new ApiFailure(401, "INVALID_GRANT");
    db.update("UPDATE extension_tokens SET revoked_at=UTC_TIMESTAMP(3) WHERE id=?", r.get("id"));
    return issue(
        ((Number) r.get("user_id")).longValue(),
        r.get("executor_id").toString(),
        r.get("family_id").toString());
  }

  private Object issue(long owner, String executor, String family) {
    String id = UUID.randomUUID().toString(),
        refresh = AuthSupport.token(),
        access = AuthSupport.token();
    db.update(
        "INSERT INTO extension_tokens(id,executor_id,user_id,refresh_hash,family_id,expires_at)"
            + " VALUES (?,?,?,?,?,?)",
        id,
        executor,
        owner,
        AuthSupport.hash(refresh),
        family,
        Timestamp.from(Instant.now().plus(Duration.ofDays(30))));
    db.update(
        "INSERT INTO extension_access_tokens VALUES (?,?,?)",
        AuthSupport.hash(access),
        id,
        Timestamp.from(Instant.now().plusSeconds(900)));
    return Map.of("access_token", access, "refresh_token", refresh, "expires_in", 900);
  }

  @Transactional
  public void disconnect(long owner, String executor) {
    if (!db.queryForList(
            "SELECT id FROM extension_installations WHERE id=? AND current_user_id=? FOR UPDATE",
            executor,
            owner)
        .isEmpty()) {
      if (!db.queryForList(
              "SELECT user_id FROM active_execution_locks WHERE executor_id=?", executor)
          .isEmpty()) throw new ApiFailure(409, "RELEASE_UNCONFIRMED");
      db.update(
          "UPDATE extension_tokens SET revoked_at=UTC_TIMESTAMP(3) WHERE executor_id=? AND"
              + " user_id=?",
          executor,
          owner);
      db.update("UPDATE extension_installations SET current_user_id=NULL WHERE id=?", executor);
    } else throw new ApiFailure(404, "INSTALLATION_NOT_FOUND");
  }

  public Object installations(long owner) {
    return db
        .queryForList(
            "SELECT i.id"
                + " executor_id,i.current_user_id,i.last_seen_at,i.client_version,COALESCE(s.execution_status,'IDLE')"
                + " execution_status FROM extension_installations i LEFT JOIN"
                + " active_execution_locks l ON l.executor_id=i.id LEFT JOIN focus_sessions s ON"
                + " s.id=l.session_id WHERE i.current_user_id=?",
            owner)
        .stream()
        .map(
            r -> {
              r.put("current_user_id", r.get("current_user_id").toString());
              if (r.get("last_seen_at") != null)
                r.put(
                    "last_seen_at",
                    kr.ac.kdu.focurve.api.DbTime.instant(r.get("last_seen_at")).toString());
              return r;
            })
        .toList();
  }

  private static String s256(String s) {
    try {
      return Base64.getUrlEncoder()
          .withoutPadding()
          .encodeToString(
              MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.US_ASCII)));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }
}
