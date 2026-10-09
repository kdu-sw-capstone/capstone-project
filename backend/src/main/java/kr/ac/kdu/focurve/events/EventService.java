package kr.ac.kdu.focurve.events;

import java.sql.*;
import java.time.*;
import java.util.*;
import kr.ac.kdu.focurve.api.ApiFailure;
import kr.ac.kdu.focurve.auth.*;
import kr.ac.kdu.focurve.execution.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class EventService {
  private final JdbcTemplate db;
  private final AuthService json;
  private final ExecutionService execution;
  private final TransactionTemplate transaction;

  public EventService(
      JdbcTemplate db,
      AuthService json,
      ExecutionService execution,
      PlatformTransactionManager manager) {
    this.db = db;
    this.json = json;
    this.execution = execution;
    this.transaction = new TransactionTemplate(manager);
  }

  public Object batch(MemberLinks.Principal owner, List<Map<String, Object>> events) {
    if (events == null
        || events.size() > 100
        || json.encoded(events).getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 1048576)
      throw new ApiFailure(413, "BATCH_TOO_LARGE");
    var results = new ArrayList<Object>();
    for (var event : events) {
      try {
        results.add(receiveWithRetry(owner, event));
      } catch (ApiFailure e) {
        if (e.status >= 500) throw e;
        results.add(
            Map.of(
                "event_id",
                Objects.toString(event == null ? null : event.get("event_id"), ""),
                "status",
                "REJECTED",
                "error",
                e.code));
      }
    }
    execution.heartbeat(owner);
    return Map.of("items", results);
  }

  private Object receiveWithRetry(MemberLinks.Principal owner, Map<String, Object> event) {
    for (int attempt = 0; attempt < 3; attempt++) {
      try {
        return transaction.execute(status -> receive(owner, event));
      } catch (org.springframework.dao.TransientDataAccessException
          | org.springframework.dao.DuplicateKeyException conflict) {
        if (attempt == 2) throw new ApiFailure(503, "EVENT_RETRY_REQUIRED");
      }
    }
    throw new IllegalStateException();
  }

  private Object receive(MemberLinks.Principal owner, Map<String, Object> event) {
    if(event!=null && "1.2".equals(event.get("schema_version"))
        && !(event.get("local_seq") instanceof Integer || event.get("local_seq") instanceof Long))
      throw new ApiFailure(422,"INVALID_SCHEMA");
    if (event == null
        || !Set.of(
                "schema_version",
                "event_id",
                "executor_id",
                "session_id",
                "policy_snapshot_id",
                "event_type",
                "occurred_at",
                "local_seq",
                "payload")
            .containsAll(event.keySet())
        || ExecutionService.number(event, "local_seq") <= 0
        || !(event.get("payload") instanceof Map)) throw new ApiFailure(422, "INVALID_SCHEMA");
    String id = ExecutionService.str(event, "event_id");
    AuthService.uuid(id);
    String type = ExecutionService.str(event, "event_type");
    String hash = AuthSupport.hash(json.encoded(event));
    // A real owner row serializes duplicate ingestion before an absent receipt can take a gap lock.
    db.queryForList("SELECT id FROM users WHERE id=? FOR UPDATE", owner.user());
    var previous =
        db.queryForList(
            "SELECT owner_user_id,executor_id,payload_hash,status FROM event_receipts WHERE"
                + " event_id=? FOR UPDATE",
            id);
    if (!previous.isEmpty()) {
      var old = previous.getFirst();
      if (((Number) old.get("owner_user_id")).longValue() != owner.user()
          || !owner.executor().equals(old.get("executor_id"))
          || !hash.equals(old.get("payload_hash"))) throw new ApiFailure(409, "EVENT_CONFLICT");
      return Map.of("event_id", id, "status", "DUPLICATE");
    }
    if (!Set.of("1.1", "1.2").contains(Objects.toString(event.get("schema_version"), ""))
        || !owner.executor().equals(event.get("executor_id")))
      throw new ApiFailure(422, "INVALID_SCHEMA");
    var session = execution.byUuid(owner.user(), ExecutionService.str(event, "session_id"));
    long sessionId = ((Number) session.get("id")).longValue();
    db.queryForList("SELECT id FROM focus_sessions WHERE id=? FOR UPDATE", sessionId);
    if (!owner.executor().equals(session.get("executor_id"))
        || !session.get("policy_snapshot_id").equals(event.get("policy_snapshot_id")))
      throw new ApiFailure(403, "EXECUTOR_MISMATCH");
    Instant at = ExecutionService.instant(event, "occurred_at");
    if (at.isAfter(Instant.now().plusSeconds(60))) throw new ApiFailure(422, "VALIDATION_FAILED");
    Map<String, Object> payload = json.decoded(json.encoded(event.get("payload")));
    boolean access =
        Set.of("BLOCKED_SITE_ACCESS", "RECORDED_ACCESS", "BLOCKED_FEATURE_ACCESS").contains(type);
    if (!access && !Set.of("SESSION_STARTED", "SESSION_ENDED").contains(type))
      throw new ApiFailure(422, "INVALID_SCHEMA");
    if (!db.queryForList(
            "SELECT event_id FROM event_receipts WHERE resolved_session_id=? AND"
                + " CAST(JSON_UNQUOTE(JSON_EXTRACT(payload,'$.local_seq')) AS UNSIGNED)=?",
            sessionId,
            ExecutionService.number(event, "local_seq"))
        .isEmpty()) throw new ApiFailure(409, "EVENT_SEQUENCE_CONFLICT");
    db.update(
        "INSERT INTO event_receipts VALUES (?,?,?,?,?,?,?,?,'ACCEPTED',UTC_TIMESTAMP(3))",
        id,
        owner.user(),
        owner.executor(),
        sessionId,
        event.get("schema_version"),
        type,
        hash,
        json.encoded(event));
    if (access) {
      boolean modern = "1.2".equals(event.get("schema_version"));
      if(modern && !(payload.get("access_seq") instanceof Integer || payload.get("access_seq") instanceof Long))
        throw new ApiFailure(422,"INVALID_SCHEMA");
      if (!Set.of(
              "access_seq",
              "navigation_id",
              "target_kind",
              "target_host",
              "target_key",
              "reason",
              "feature_code",
              "rule_id",
              "matched_policy_host",
              "blocked_reasons")
          .containsAll(payload.keySet())) throw new ApiFailure(422, "INVALID_SCHEMA");
      long sequence = ExecutionService.number(payload, "access_seq");
      String navigation = ExecutionService.str(payload, "navigation_id"),
          target = ExecutionService.str(payload, "target_key"),
          host = ExecutionService.str(payload, "target_host"),
          kind = ExecutionService.str(payload, "target_kind"),
          reason = ExecutionService.str(payload, "reason");
      AuthService.uuid(navigation);
      if (sequence <= 0
          || !Set.of("SITE", "FEATURE").contains(kind)
          || !(modern ? Set.of("USER_SITE", "ADULT_DOMAIN", "KEYWORD", "FEATURE", "RECORD") : Set.of("USER_SITE", "FEATURE", "RECORD")).contains(reason)
          || host.length() > 253
          || target.length() > 320
          || host.contains("/")
          || host.contains("@")) throw new ApiFailure(422, "INVALID_SCHEMA");
      if (!kr.ac.kdu.focurve.sites.SiteInput.host(host).equals(host)
          || target.contains("/")
          || target.contains("?")
          || target.contains("#")
          || target.contains("@")) throw new ApiFailure(422, "INVALID_SCHEMA");
      if (type.equals("RECORDED_ACCESS") && (!kind.equals("SITE") || !reason.equals("RECORD")))
        throw new ApiFailure(422, "INVALID_SCHEMA");
      if (type.equals("BLOCKED_SITE_ACCESS")
          && (!kind.equals("SITE") || !(modern ? Set.of("USER_SITE", "ADULT_DOMAIN", "KEYWORD") : Set.of("USER_SITE")).contains(reason)))
        throw new ApiFailure(422, "INVALID_SCHEMA");
      if (kind.equals("SITE") && payload.get("feature_code") != null)
        throw new ApiFailure(422, "INVALID_SCHEMA");
      if (type.equals("BLOCKED_FEATURE_ACCESS")
          && (!reason.equals("FEATURE")
              || !(host.equals("youtube.com") || host.endsWith(".youtube.com"))))
        throw new ApiFailure(422, "INVALID_SCHEMA");
      if (type.equals("BLOCKED_FEATURE_ACCESS")
          && (!kind.equals("FEATURE") || !"YOUTUBE_SHORTS".equals(payload.get("feature_code"))))
        throw new ApiFailure(422, "INVALID_SCHEMA");
      var snapshot =
          json.decoded(
              db.queryForObject(
                  "SELECT payload FROM policy_snapshots WHERE id=? AND user_id=?",
                  String.class,
                  session.get("policy_snapshot_id"),
                  owner.user()));
      if (modern) SnapshotAccess.validate12(snapshot, type, payload);
      else {
        if(payload.containsKey("matched_policy_host") || payload.containsKey("blocked_reasons")) throw new ApiFailure(422,"INVALID_SCHEMA");
        SnapshotAccess.validate(snapshot, type, payload);
      }
      // Only confirmed RUN intervals authorize access collection; delayed events use occurred_at.
      var intervals =
          db.queryForList(
              "SELECT id FROM session_intervals WHERE session_id=? AND kind='RUN' AND"
                  + " quality='CONFIRMED' AND start_at<=? AND (end_at IS NULL OR end_at>?)",
              sessionId,
              Timestamp.from(at),
              Timestamp.from(at));
      if (intervals.isEmpty()) throw new ApiFailure(422, "OUTSIDE_RUN_INTERVAL");
      try {
        db.update(
            "INSERT INTO access_events VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            id,
            sessionId,
            Timestamp.from(at),
            sequence,
            kind,
            host,
            target,
            payload.get("feature_code"),
            reason,
            navigation,
            event.get("policy_snapshot_id"));
      } catch (org.springframework.dao.DuplicateKeyException e) {
        throw new ApiFailure(409, "EVENT_CONFLICT");
      }
      long
          count =
              db.queryForObject(
                  "SELECT COUNT(*) FROM access_events WHERE session_id=?", Long.class, sessionId),
          max =
              db.queryForObject(
                  "SELECT MAX(access_seq) FROM access_events WHERE session_id=?",
                  Long.class,
                  sessionId);
      String status = count == max ? "ACCEPTED" : "PENDING_DEPENDENCY";
      db.update(
          "UPDATE event_receipts SET status=? WHERE resolved_session_id=? AND event_type IN"
              + " ('BLOCKED_SITE_ACCESS','RECORDED_ACCESS','BLOCKED_FEATURE_ACCESS')",
          status,
          sessionId);
      db.update(
          "UPDATE focus_sessions SET"
              + " record_status=IF(record_status='REVIEW_REQUIRED',record_status,?) WHERE id=?",
          count == max ? "PARTIAL" : "PENDING",
          sessionId);
      execution.refreshRecordQuality(sessionId);
      return Map.of("event_id", id, "status", status);
    }
    db.update(
        "INSERT INTO session_lifecycle_events VALUES (?,?,?,?,?)",
        id,
        sessionId,
        Timestamp.from(at),
        type,
        ExecutionService.number(payload, "desired_revision"));
    execution.refreshRecordQuality(sessionId);
    return Map.of("event_id", id, "status", "ACCEPTED");
  }

  public Object status(MemberLinks.Principal owner, List<String> ids) {
    if (ids == null || ids.size() > 100) throw new ApiFailure(422, "VALIDATION_FAILED");
    return Map.of(
        "items",
        ids.stream()
            .map(
                id -> {
                  var rows =
                      db.queryForList(
                          "SELECT status FROM event_receipts WHERE event_id=? AND owner_user_id=?"
                              + " AND executor_id=?",
                          id,
                          owner.user(),
                          owner.executor());
                  return Map.of(
                      "event_id",
                      id,
                      "status",
                      rows.isEmpty() ? "NOT_RECEIVED" : rows.getFirst().get("status"));
                })
            .toList());
  }
}
