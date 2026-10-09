package kr.ac.kdu.focurve.imports;

import static kr.ac.kdu.focurve.imports.ImportService.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import kr.ac.kdu.focurve.api.ApiFailure;
import kr.ac.kdu.focurve.auth.*;
import kr.ac.kdu.focurve.events.EventService;
import kr.ac.kdu.focurve.execution.*;
import kr.ac.kdu.focurve.sites.SiteInput;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Imported history never creates a live execution lock or an APPLY command. */
@Service
public class ImportedSession {
  private final JdbcTemplate db;
  private final AuthService json;
  private final ObjectMapper mapper;
  private final EventService events;
  private final ExecutionService execution;

  public ImportedSession(
      JdbcTemplate db,
      AuthService json,
      ObjectMapper mapper,
      EventService events,
      ExecutionService execution) {
    this.db = db;
    this.json = json;
    this.mapper = mapper;
    this.events = events;
    this.execution = execution;
  }

  public String save(MemberLinks.Principal p, String source, Map<String, Object> payload) {
    keys(
        payload,
        Set.of(
            "snapshot", "session", "events", "intervals", "usage_segments", "note", "watermark"));
    var s = object(payload.get("session"));
    keys(
        s,
        Set.of(
            "session_id",
            "executor_id",
            "policy_snapshot_id",
            "source",
            "execution_status",
            "duration_minutes",
            "started_at",
            "ended_at",
            "policy_released_at",
            "end_reason"));
    if (!source.equals(s.get("session_id")) || !p.executor().equals(s.get("executor_id")))
      throw new ApiFailure(422, "INVALID_SCHEMA");
    if (!Set.of("ENDED", "START_FAILED").contains(str(s, "execution_status")))
      throw new ApiFailure(422, "IMPORT_ACTIVE_SESSION");
    if (!Set.of("MANUAL", "SCHEDULE").contains(str(s, "source")))
      throw new ApiFailure(422, "INVALID_SCHEMA");
    if (!Set.of("MANUAL", "EXPIRED", "INTERRUPTED", "APPLY_FAILED").contains(str(s, "end_reason")))
      throw new ApiFailure(422, "INVALID_SCHEMA");
    long minutes = ExecutionService.number(s, "duration_minutes");
    if (minutes < 1 || minutes > 180) throw new ApiFailure(422, "VALIDATION_FAILED");
    Instant end = ExecutionService.instant(s, "ended_at"),
        released = ExecutionService.instant(s, "policy_released_at");
    if (!released.equals(end)
        || end.isAfter(Instant.now().plusSeconds(60))
        || !end.isAfter(Instant.now().minus(Duration.ofDays(30))))
      throw new ApiFailure(422, "IMPORT_RETENTION_EXPIRED");
    Instant start = s.get("started_at") == null ? null : ExecutionService.instant(s, "started_at");
    if (start != null
        && (!start.isBefore(end)
            || Duration.between(start, end).compareTo(Duration.ofDays(30)) > 0))
      throw new ApiFailure(422, "INVALID_INTERVAL");
    var intervals = list(payload.get("intervals"), 500);
    var ev = list(payload.get("events"), 10000);
    var snapshot = new LinkedHashMap<>(object(payload.get("snapshot")));
    keys(
        snapshot,
        Set.of(
            "policy_snapshot_id",
            "format_version",
            "site_match_strategy",
            "owner_user_id",
            "executor_id",
            "created_at",
            "sites",
            "content_policy",
            "source_version",
            "catalog_version",
            "model_profile_version"));
    String oldSnapshot = str(snapshot, "policy_snapshot_id");
    AuthService.uuid(oldSnapshot);
    if (!oldSnapshot.equals(s.get("policy_snapshot_id"))
        || !p.executor().equals(snapshot.get("executor_id"))
        || snapshot.get("owner_user_id") != null) throw new ApiFailure(422, "INVALID_SCHEMA");
    if (!Set.of("1.1", "1.2").contains(str(snapshot, "format_version"))
        || ("1.2".equals(snapshot.get("format_version"))
            && !"MOST_SPECIFIC_HOST".equals(snapshot.get("site_match_strategy"))))
      throw new ApiFailure(422, "INVALID_SCHEMA");
    var hosts = new HashSet<String>();
    for (var policy : list(snapshot.get("sites"), 1000)) {
      keys(
          policy,
          Set.of(
              "site_id",
              "canonical_host",
              "display_name",
              "include_subdomains",
              "purpose",
              "access_policy",
              "feature_policies",
              "version",
              "created_at",
              "updated_at",
              "deleted_at"));
      var fields = new LinkedHashMap<>(policy);
      fields.put("url", fields.remove("canonical_host"));
      for (String k : List.of("site_id", "version", "created_at", "updated_at", "deleted_at"))
        fields.remove(k);
      SiteInput input;
      try {
        input = mapper.convertValue(fields, SiteInput.class);
      } catch (IllegalArgumentException failure) {
        throw new ApiFailure(422, "INVALID_SCHEMA");
      }
      var valid = input.validate();
      if (!valid.host().equals(policy.get("canonical_host")) || !hosts.add(valid.host()))
        throw new ApiFailure(422, "INVALID_SCHEMA");
    }
    // Additional content-policy and usage collectors are not implemented by the required-MVP
    // importer.
    var content = object(snapshot.get("content_policy"));
    if (!json.encoded(content).equals(json.encoded(ExecutionService.defaultContent())))
      throw new ApiFailure(422, "IMPORT_TYPE_UNSUPPORTED");
    if (payload.get("usage_segments") != null
        && !list(payload.get("usage_segments"), 10000).isEmpty())
      throw new ApiFailure(422, "IMPORT_TYPE_UNSUPPORTED");
    long total = 0;
    Instant previous = null;
    var intervalIds = new HashSet<String>();
    for (var interval : intervals) {
      keys(interval, Set.of("interval_id", "kind", "start_at", "end_at", "duration_ms", "quality"));
      String iid = str(interval, "interval_id");
      AuthService.uuid(iid);
      Instant from = ExecutionService.instant(interval, "start_at"),
          to = ExecutionService.instant(interval, "end_at");
      long duration = ExecutionService.number(interval, "duration_ms");
      if (!intervalIds.add(iid)
          || !"RUN".equals(interval.get("kind"))
          || !Set.of("CONFIRMED", "UNCONFIRMED").contains(str(interval, "quality"))
          || start == null
          || from.isBefore(start)
          || to.isAfter(end)
          || !to.isAfter(from)
          || previous != null && from.isBefore(previous)
          || duration < 0
          || duration != Duration.between(from, to).toMillis())
        throw new ApiFailure(422, "INVALID_INTERVAL");
      if ("CONFIRMED".equals(interval.get("quality"))) total = Math.addExact(total, duration);
      previous = to;
    }
    boolean ended = "ENDED".equals(s.get("execution_status"));
    if (ended
        && (start == null
            || intervals.isEmpty()
            || !ExecutionService.instant(intervals.getFirst(), "start_at").equals(start)
            || !end.equals(previous))) throw new ApiFailure(422, "INVALID_INTERVAL");
    if (!ended && (start != null || !intervals.isEmpty() || !ev.isEmpty()))
      throw new ApiFailure(422, "INVALID_INTERVAL");
    if (!db.queryForList(
            "SELECT id FROM focus_sessions WHERE user_id=? AND executor_id=? AND"
                + " source_session_id=?",
            p.user(),
            p.executor(),
            source)
        .isEmpty()) throw new ApiFailure(409, "SOURCE_CONFLICT");
    String snapshotId = UUID.randomUUID().toString();
    snapshot.put("policy_snapshot_id", snapshotId);
    snapshot.put("owner_user_id", Long.toString(p.user()));
    db.update(
        "INSERT INTO"
            + " policy_snapshots(id,user_id,executor_id,format_version,payload,source_version,created_at)"
            + " VALUES (?,?,?,?,?,?,?)",
        snapshotId,
        p.user(),
        p.executor(),
        snapshot.get("format_version"),
        json.encoded(snapshot),
        ExecutionService.number(snapshot, "source_version"),
        Timestamp.from(ExecutionService.instant(snapshot, "created_at")));
    db.update(
        "INSERT INTO"
            + " focus_sessions(source_session_id,user_id,executor_id,policy_snapshot_id,source,origin,execution_status,record_status,duration_minutes,active_duration_ms,overrun_ms,desired_revision,version,started_at,planned_end_at,ended_at,policy_released_at,end_reason)"
            + " VALUES (?,?,?,?,?,'GUEST_IMPORT',?,'PARTIAL',?,?,?,0,1,?,?,?,?,?)",
        source,
        p.user(),
        p.executor(),
        snapshotId,
        s.get("source"),
        s.get("execution_status"),
        minutes,
        Math.min(total, minutes * 60000),
        Math.max(0, total - minutes * 60000),
        start == null ? null : Timestamp.from(start),
        start == null ? null : Timestamp.from(start.plusSeconds(minutes * 60)),
        Timestamp.from(end),
        Timestamp.from(end),
        s.get("end_reason"));
    long id =
        db.queryForObject(
            "SELECT id FROM focus_sessions WHERE user_id=? AND executor_id=? AND"
                + " source_session_id=?",
            Long.class,
            p.user(),
            p.executor(),
            source);
    for (var i : intervals)
      db.update(
          "INSERT INTO session_intervals VALUES (?,?,'RUN',?,?,?,?)",
          i.get("interval_id"),
          id,
          Timestamp.from(ExecutionService.instant(i, "start_at")),
          Timestamp.from(ExecutionService.instant(i, "end_at")),
          i.get("duration_ms"),
          i.get("quality"));
    for (int offset = 0; offset < ev.size(); offset += 100) {
      var chunk = new ArrayList<Map<String, Object>>();
      for (var original : ev.subList(offset, Math.min(ev.size(), offset + 100))) {
        var e = new LinkedHashMap<>(original);
        if (!source.equals(e.get("session_id"))
            || !oldSnapshot.equals(e.get("policy_snapshot_id"))
            || !p.executor().equals(e.get("executor_id")))
          throw new ApiFailure(422, "INVALID_SCHEMA");
        e.put("policy_snapshot_id", snapshotId);
        chunk.add(e);
      }
      var received = object(events.batch(p, chunk));
      if (list(received.get("items"), 100).stream()
          .anyMatch(r -> "REJECTED".equals(r.get("status"))))
        throw new ApiFailure(422, "IMPORT_EVENT_REJECTED");
    }
    if (payload.get("note") != null) {
      if (!(payload.get("note") instanceof String note) || note.length() > 2000)
        throw new ApiFailure(422, "INVALID_SCHEMA");
      db.update("INSERT INTO session_notes VALUES (?,?,1,UTC_TIMESTAMP(3))", id, note);
    }
    if (payload.get("watermark") != null) {
      var w = object(payload.get("watermark"));
      keys(w, Set.of("last_access_seq", "last_local_seq"));
      long a = ExecutionService.number(w, "last_access_seq"),
          l = ExecutionService.number(w, "last_local_seq");
      if (a < 0 || l < a) throw new ApiFailure(422, "INVALID_SCHEMA");
      db.update("INSERT INTO session_watermarks VALUES (?,?,?,?)", id, a, l, Timestamp.from(end));
      execution.refreshRecordQuality(id);
    }
    return source;
  }
}
