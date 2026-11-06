package kr.ac.kdu.focurve.execution;

import java.sql.*;
import java.time.*;
import java.util.*;
import kr.ac.kdu.focurve.api.ApiFailure;
import kr.ac.kdu.focurve.auth.*;
import kr.ac.kdu.focurve.sites.SiteService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ExecutionService {
  private final JdbcTemplate db;
  private final AuthService json;
  private final SiteService sites;
  @org.springframework.beans.factory.annotation.Autowired
  private org.springframework.core.env.Environment environment;

  public ExecutionService(JdbcTemplate db, AuthService json, SiteService sites) {
    this.db = db;
    this.json = json;
    this.sites = sites;
  }

  public Map<String, Object> current(long owner) {
    var rows =
        db.queryForList("SELECT session_id FROM active_execution_locks WHERE user_id=?", owner);
    return rows.isEmpty()
        ? null
        : get(owner, ((Number) rows.getFirst().get("session_id")).longValue());
  }

  public Map<String, Object> get(long owner, long id) {
    var r = owned(owner, id, false);
    return view(r);
  }

  public Map<String, Object> byUuid(long owner, String uuid) {
    var rows =
        db.queryForList(
            "SELECT id FROM focus_sessions WHERE user_id=? AND source_session_id=?", owner, uuid);
    if (rows.isEmpty()) throw new ApiFailure(404, "SESSION_NOT_FOUND");
    return owned(owner, ((Number) rows.getFirst().get("id")).longValue(), false);
  }

  public Object list(long owner, String from, String to, String status, String cursor) {
    if (status != null
        && !Set.of(
                "STARTING",
                "RUNNING",
                "PAUSING",
                "PAUSED",
                "RESUMING",
                "ENDING",
                "ENDED",
                "START_FAILED",
                "UNKNOWN")
            .contains(status)) throw new ApiFailure(422, "VALIDATION_FAILED");
    var range = kr.ac.kdu.focurve.records.RecordQueries.range(from, to);
    long after = Long.MAX_VALUE;
    try {
      if (cursor != null)
        after =
            Long.parseLong(
                new String(
                    Base64.getUrlDecoder().decode(cursor),
                    java.nio.charset.StandardCharsets.UTF_8));
    } catch (IllegalArgumentException e) {
      throw new ApiFailure(400, "INVALID_CURSOR");
    }
    String sql =
        "SELECT * FROM focus_sessions WHERE user_id=? AND id<? AND (started_at IS NULL OR"
            + " (started_at>=? AND started_at<?))";
    var args =
        new ArrayList<Object>(
            List.of(owner, after, Timestamp.from(range.from()), Timestamp.from(range.to())));
    if (status != null) {
      sql += " AND execution_status=?";
      args.add(status);
    }
    sql += " ORDER BY id DESC LIMIT 21";
    var rows = db.queryForList(sql, args.toArray());
    boolean more = rows.size() > 20;
    if (more) rows = new ArrayList<>(rows.subList(0, 20));
    var result = new LinkedHashMap<String, Object>();
    result.put("items", rows.stream().map(this::view).toList());
    result.put("has_more", more);
    result.put(
        "next_cursor",
        more
            ? Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(
                    rows.getLast()
                        .get("id")
                        .toString()
                        .getBytes(java.nio.charset.StandardCharsets.UTF_8))
            : null);
    return result;
  }

  public Object policy(long owner, String uuid) {
    var r = byUuid(owner, uuid);
    return json.decoded(
        db.queryForObject(
            "SELECT payload FROM policy_snapshots WHERE id=? AND user_id=?",
            String.class,
            r.get("policy_snapshot_id"),
            owner));
  }

  @Transactional
  public Map<String, Object> start(long owner, String executor, int minutes, String key) {
    if (minutes < 1 || minutes > 180) throw new ApiFailure(422, "VALIDATION_FAILED");
    AuthService.uuid(executor);
    AuthService.uuid(key);
    db.queryForList("SELECT id FROM users WHERE id=? FOR UPDATE", owner);
    String path = "/api/v1/sessions";
    Map<String, Object> body = Map.of("executor_id", executor, "duration_minutes", minutes);
    var previous = replay(owner, path, key, body);
    if (previous != null) return previous;
    String verified=environment.getProperty("SNAPSHOT_1_2_VERIFIED_EXECUTORS", "");
    boolean tested=Arrays.asList(verified.split(",")).contains(executor)
        || verified.equals("*") && environment.acceptsProfiles(org.springframework.core.env.Profiles.of("test"));
    if(!environment.getProperty("SNAPSHOT_1_2_ENABLED",Boolean.class,false)||!tested)
      throw new ApiFailure(503,"SNAPSHOT_COMPATIBILITY_REQUIRED");
    var installs =
        db.queryForList(
            "SELECT * FROM extension_installations WHERE id=? AND current_user_id=? FOR UPDATE",
            executor,
            owner);
    if (installs.isEmpty()) throw new ApiFailure(403, "EXECUTOR_MISMATCH");
    var i = installs.getFirst();
    if (i.get("last_seen_at") == null
        || kr.ac.kdu.focurve.api.DbTime.instant(i.get("last_seen_at"))
            .plusSeconds(60)
            .isBefore(Instant.now())) throw new ApiFailure(409, "EXECUTOR_OFFLINE");
    if (!db.queryForList(
            "SELECT user_id FROM active_execution_locks WHERE user_id=? OR executor_id=?",
            owner,
            executor)
        .isEmpty()) throw new ApiFailure(409, "ACTIVE_SESSION_EXISTS");
    String snapshot = UUID.randomUUID().toString(), session = UUID.randomUUID().toString();
    var payload = new LinkedHashMap<String, Object>();
    payload.put("policy_snapshot_id", snapshot);
    payload.put("format_version", "1.2");
    payload.put("site_match_strategy", "MOST_SPECIFIC_HOST");
    payload.put("owner_user_id", owner + "");
    payload.put("executor_id", executor);
    payload.put("created_at", Instant.now().toString());
    var all = new ArrayList<Object>();
    String cursor = null;
    do {
      var page = sites.list(owner, null, cursor, 100);
      all.addAll((List<?>) page.get("items"));
      cursor = (String) page.get("next_cursor");
    } while (cursor != null);
    // Descendants precede ancestors; policy severity and registration order never win.
    all.sort(
        Comparator.comparingInt(
                (Object site) ->
                    ((Map<?, ?>) site).get("canonical_host").toString().split("\\.").length)
            .reversed()
            .thenComparing(site -> ((Map<?, ?>) site).get("canonical_host").toString()));
    payload.put("sites", all);
    payload.put("content_policy", defaultContent());
    payload.put("source_version", 1);
    SnapshotValidation.validate(payload);
    db.update(
        "INSERT INTO"
            + " policy_snapshots(id,user_id,executor_id,format_version,payload,source_version,created_at)"
            + " VALUES (?,?,?,'1.2',?,1,UTC_TIMESTAMP(3))",
        snapshot,
        owner,
        executor,
        json.encoded(payload));
    var keys = new GeneratedKeyHolder();
    db.update(
        c -> {
          var p =
              c.prepareStatement(
                  "INSERT INTO"
                      + " focus_sessions(source_session_id,user_id,executor_id,policy_snapshot_id,source,origin,execution_status,record_status,duration_minutes,active_duration_ms,overrun_ms,desired_revision,version)"
                      + " VALUES (?,?,?,?,'MANUAL','MEMBER','STARTING','PENDING',?,0,0,1,1)",
                  Statement.RETURN_GENERATED_KEYS);
          p.setString(1, session);
          p.setLong(2, owner);
          p.setString(3, executor);
          p.setString(4, snapshot);
          p.setInt(5, minutes);
          return p;
        },
        keys);
    long id = keys.getKey().longValue();
    db.update("INSERT INTO active_execution_locks VALUES (?,?,?,1)", owner, executor, id);
    String operation = createOperation(owner, session);
    command(id, executor, 1, "APPLY_POLICY", payload);
    var result = get(owner, id);
    result.put("operation_id", operation);
    remember(owner, path, key, body, result);
    return result;
  }

  @Transactional
  public Map<String, Object> end(long owner, String uuid, String key) {
    AuthService.uuid(key);
    db.queryForList("SELECT id FROM users WHERE id=? FOR UPDATE", owner);
    String path = "/api/v1/sessions/" + uuid + "/end";
    var old = replay(owner, path, key, Map.of());
    if (old != null) return old;
    var r = byUuid(owner, uuid);
    long id = ((Number) r.get("id")).longValue();
    r = owned(owner, id, true);
    if (!Set.of("RUNNING", "UNKNOWN", "ENDING").contains(r.get("execution_status")))
      throw new ApiFailure(409, "INVALID_TRANSITION");
    if (!r.get("execution_status").equals("ENDING")) {
      long revision = ((Number) r.get("desired_revision")).longValue() + 1;
      db.update(
          "UPDATE focus_sessions SET"
              + " execution_status='ENDING',desired_revision=?,version=CASE WHEN version BETWEEN 1 AND 9007199254740990 THEN version+1 ELSE version END,end_reason='MANUAL'"
              + " WHERE id=?",
          revision,
          id);
      db.update("UPDATE active_execution_locks SET revision=? WHERE session_id=?", revision, id);
      command(id, r.get("executor_id").toString(), revision, "RELEASE_POLICY", null);
    }
    var result = get(owner, id);
    result.put("operation_id", createOperation(owner, uuid));
    remember(owner, path, key, Map.of(), result);
    return result;
  }

  @Transactional
  public Object commands(MemberLinks.Principal p) {
    db.queryForList("SELECT id FROM users WHERE id=? FOR UPDATE", p.user());
    // Never deliver a new APPLY for a session whose next resource version is exhausted.
    for (var session : db.queryForList(
        "SELECT s.* FROM focus_sessions s JOIN execution_commands c ON c.session_id=s.id"
            + " AND c.desired_revision=s.desired_revision WHERE s.user_id=? AND s.executor_id=?"
            + " AND c.kind='APPLY_POLICY' AND c.status='PENDING'"
            + " AND s.execution_status IN ('STARTING','UNKNOWN') FOR UPDATE", p.user(), p.executor())) {
      if (!SafeVersion.valid(session.get("version"))
          || ((Number) session.get("version")).longValue() == SafeVersion.MAX)
        releaseAfterFailure(session, ((Number) session.get("id")).longValue(), "VERSION_LIMIT");
    }
    heartbeat(p);
    var rows =
        db.queryForList(
            "SELECT c.* FROM execution_commands c JOIN focus_sessions s ON s.id=c.session_id WHERE"
                + " c.executor_id=? AND s.user_id=? AND c.desired_revision=s.desired_revision AND"
                + " c.status='PENDING' ORDER BY c.created_at,c.id",
            p.executor(),
            p.user());
    return Map.of(
        "commands",
        rows.stream().map(r -> json.decoded(r.get("payload").toString())).toList(),
        "next_cursor",
        "",
        "server_time",
        Instant.now().toString());
  }

  @Transactional
  public Object report(MemberLinks.Principal p, Map<String, Object> report) {
    db.queryForList("SELECT id FROM users WHERE id=? FOR UPDATE", p.user());
    if (!Set.of(
            "report_id",
            "command_id",
            "session_id",
            "executor_id",
            "desired_revision",
            "result",
            "observed_at",
            "error_code",
            "rollback_confirmed",
            "intervals",
            "local_action_seq")
        .containsAll(report.keySet())) throw new ApiFailure(422, "VALIDATION_FAILED");
    if (report.get("error_code") != null
        && (!(report.get("error_code") instanceof String code)
            || !code.matches("[A-Z][A-Z0-9_]{0,79}")))
      throw new ApiFailure(422, "VALIDATION_FAILED");
    if (report.get("rollback_confirmed") != null
        && !(report.get("rollback_confirmed") instanceof Boolean))
      throw new ApiFailure(422, "VALIDATION_FAILED");
    if (report.get("local_action_seq") != null && number(report, "local_action_seq") <= 0)
      throw new ApiFailure(422, "VALIDATION_FAILED");
    if (!p.executor().equals(report.get("executor_id")))
      throw new ApiFailure(403, "EXECUTOR_MISMATCH");
    if (report.get("command_id") == null) throw new ApiFailure(409, "RECONCILE_REQUIRED");
    var intervals = intervals(report);
    String reportId = str(report, "report_id"),
        sessionId = str(report, "session_id"),
        commandId = str(report, "command_id"),
        result = str(report, "result");
    AuthService.uuid(reportId);
    if (!Set.of("APPLIED", "RELEASED", "FAILED", "UNCONFIRMED").contains(result))
      throw new ApiFailure(422, "VALIDATION_FAILED");
    var r = byUuid(p.user(), sessionId);
    if (!p.executor().equals(r.get("executor_id"))) throw new ApiFailure(403, "EXECUTOR_MISMATCH");
    long id = ((Number) r.get("id")).longValue();
    r = owned(p.user(), id, true);
    long revision = number(report, "desired_revision");
    String hash = AuthSupport.hash(json.encoded(report));
    var old = db.queryForList("SELECT payload_hash FROM execution_reports WHERE id=?", reportId);
    if (!old.isEmpty()) {
      if (!old.getFirst().get("payload_hash").equals(hash))
        throw new ApiFailure(409, "REPORT_CONFLICT");
      return Map.of("result", "DUPLICATE", "desired_revision", r.get("desired_revision"));
    }
    var cmd =
        db.queryForList(
            "SELECT * FROM execution_commands WHERE id=? AND session_id=? AND executor_id=? AND"
                + " desired_revision=?",
            commandId,
            id,
            p.executor(),
            revision);
    if (cmd.isEmpty()) throw new ApiFailure(409, "REPORT_CONFLICT");
    long desired = ((Number) r.get("desired_revision")).longValue();
    // A new report ID cannot revise a command that already completed this revision.
    // Older revisions are retained for audit but cannot change the current execution intent.
    if (revision == desired) {
      String kind = cmd.getFirst().get("kind").toString();
      String state = r.get("execution_status").toString();
      if ("ACKNOWLEDGED".equals(cmd.getFirst().get("status"))
          || (result.equals("APPLIED") && !kind.equals("APPLY_POLICY"))
          || (kind.equals("APPLY_POLICY") && !Set.of("STARTING", "UNKNOWN").contains(state)))
        throw new ApiFailure(409, "REPORT_CONFLICT");
    }
    Instant observed = instant(report, "observed_at");
    if (observed.isAfter(Instant.now().plusSeconds(60)))
      throw new ApiFailure(422, "VALIDATION_FAILED");
    db.update(
        "INSERT INTO execution_reports VALUES (?,?,?,?,?,?,?,?,?)",
        reportId,
        id,
        commandId,
        p.executor(),
        revision,
        hash,
        result,
        Timestamp.from(observed),
        json.encoded(report));
    // A limit-triggered release can race with an already-delivered APPLY report.
    // Retain validated evidence, without changing current intent/revision or acknowledging old APPLY.
    if (revision < desired && result.equals("APPLIED")
        && "APPLY_POLICY".equals(cmd.getFirst().get("kind"))
        && "VERSION_LIMIT".equals(r.get("last_error_code"))
        && Set.of("UNKNOWN", "ENDING").contains(r.get("execution_status")))
      preserveCleanupApplyInterval(id, cmd.getFirst(), observed, intervals);
    if (revision == desired) {
      String kind = cmd.getFirst().get("kind").toString(),
          state = r.get("execution_status").toString();
      if (result.equals("APPLIED")
          && kind.equals("APPLY_POLICY")
          && Set.of("STARTING", "UNKNOWN").contains(state)) {
        Object deadline = cmd.getFirst().get("execute_before");
        if (!SafeVersion.valid(r.get("version"))
            || ((Number) r.get("version")).longValue() == SafeVersion.MAX) {
          preserveCleanupApplyInterval(id, cmd.getFirst(), observed, intervals);
          // Accept the observed fact, but never authorize new RUN at an exhausted version.
          releaseAfterFailure(r, id, "VERSION_LIMIT");
        } else if (deadline != null && observed.isAfter(kr.ac.kdu.focurve.api.DbTime.instant(deadline))) {
          releaseAfterFailure(r, id, "APPLY_EXPIRED");
        } else {
          if (intervals.size() != 1 || intervals.getFirst().get("end_at") != null)
            throw new ApiFailure(422, "INVALID_INTERVAL");
          var interval = intervals.getFirst();
          Instant began = instant(interval, "start_at");
          Instant issued = kr.ac.kdu.focurve.api.DbTime.instant(cmd.getFirst().get("created_at"));
          if (began.isAfter(observed) || began.isBefore(issued.minusSeconds(60)))
            throw new ApiFailure(422, "INVALID_INTERVAL");
          db.update(
              "UPDATE focus_sessions SET"
                  + " execution_status='RUNNING',started_at=?,planned_end_at=?,record_status='PARTIAL',version=version+1"
                  + " WHERE id=?",
              Timestamp.from(began),
              Timestamp.from(
                  began.plusSeconds(((Number) r.get("duration_minutes")).longValue() * 60)),
              id);
          db.update(
              "INSERT INTO session_intervals VALUES (?,?,'RUN',?,NULL,NULL,?)",
              interval.get("interval_id"),
              id,
              Timestamp.from(began),
              interval.get("quality"));
          completeOperations(sessionId, "SUCCEEDED", null);
        }
      } else if (result.equals("RELEASED")
          && (kind.equals("RELEASE_POLICY")
              || (kind.equals("APPLY_POLICY") && Set.of("STARTING", "UNKNOWN").contains(state)))) {
        recoverReleasedInterval(r, cmd.getFirst(), observed, intervals);
        closeIntervals(id, observed, intervals);
        String finalState = state.equals("ENDING") ? "ENDED" : "START_FAILED";
        db.update(
            "UPDATE focus_sessions SET"
                + " execution_status=?,ended_at=?,policy_released_at=?,record_status='PARTIAL',version=CASE WHEN version BETWEEN 1 AND 9007199254740990 THEN version+1 ELSE version END"
                + " WHERE id=?",
            finalState,
            Timestamp.from(observed),
            Timestamp.from(observed),
            id);
        db.update("DELETE FROM active_execution_locks WHERE session_id=?", id);
        completeOperations(
            sessionId,
            finalState.equals("ENDED") ? "SUCCEEDED" : "FAILED",
            (String) r.get("last_error_code"));
      } else if (result.equals("FAILED") && kind.equals("APPLY_POLICY")) {
        releaseAfterFailure(r, id, Objects.toString(report.get("error_code"), "APPLY_FAILED"));
      } else if (result.equals("UNCONFIRMED") || result.equals("FAILED")) {
        db.update(
            "UPDATE focus_sessions SET"
                + " execution_status=IF(execution_status='STARTING','UNKNOWN',execution_status),"
                + " last_error_code=?,record_status='REVIEW_REQUIRED',version=CASE WHEN version BETWEEN 1 AND 9007199254740990 THEN version+1 ELSE version END WHERE id=?",
            Objects.toString(report.get("error_code"), "UNCONFIRMED"),
            id);
      }
      if (result.equals("APPLIED") || result.equals("RELEASED"))
        db.update("UPDATE execution_commands SET status='ACKNOWLEDGED' WHERE id=?", commandId);
    }
    if (db.queryForObject(
            "SELECT COUNT(*) FROM session_intervals WHERE session_id=? AND quality='UNCONFIRMED'",
            Integer.class,
            id)
        > 0) db.update("UPDATE focus_sessions SET record_status='REVIEW_REQUIRED' WHERE id=?", id);
    heartbeat(p);
    return Map.of(
        "result",
        "ACCEPTED",
        "desired_revision",
        db.queryForObject(
            "SELECT desired_revision FROM focus_sessions WHERE id=?", Long.class, id));
  }

  private void preserveCleanupApplyInterval(long id, Map<String, Object> command,
      Instant observed, List<Map<String, Object>> intervals) {
    // Existing intervals remain authoritative; a stale report never rewrites them.
    if (db.queryForObject("SELECT COUNT(*) FROM session_intervals WHERE session_id=?", Long.class, id) > 0)
      return;
    if (intervals.size() != 1 || intervals.getFirst().get("end_at") != null)
      throw new ApiFailure(422, "INVALID_INTERVAL");
    var interval = intervals.getFirst();
    Instant began = instant(interval, "start_at");
    Instant issued = kr.ac.kdu.focurve.api.DbTime.instant(command.get("created_at"));
    Instant deadline = kr.ac.kdu.focurve.api.DbTime.instant(command.get("execute_before"));
    if (began.isAfter(observed) || began.isBefore(issued.minusSeconds(60)) || began.isAfter(deadline))
      throw new ApiFailure(422, "INVALID_INTERVAL");
    db.update("INSERT INTO session_intervals VALUES (?,?,'RUN',?,NULL,NULL,?)",
        interval.get("interval_id"), id, Timestamp.from(began), interval.get("quality"));
    long minutes = db.queryForObject("SELECT duration_minutes FROM focus_sessions WHERE id=?", Long.class, id);
    db.update("UPDATE focus_sessions SET started_at=?,planned_end_at=? WHERE id=?",
        Timestamp.from(began), Timestamp.from(began.plusSeconds(minutes * 60)), id);
  }

  private List<Map<String, Object>> intervals(Map<String, Object> report) {
    if (!(report.get("intervals") instanceof List<?> list))
      throw new ApiFailure(422, "INVALID_INTERVAL");
    var result = new ArrayList<Map<String, Object>>();
    var ids = new HashSet<String>();
    for (var value : list) {
      if (!(value instanceof Map)) throw new ApiFailure(422, "INVALID_INTERVAL");
      var i = json.decoded(json.encoded(value));
      if (!Set.of("interval_id", "kind", "start_at", "end_at", "duration_ms", "quality")
          .containsAll(i.keySet())) throw new ApiFailure(422, "INVALID_INTERVAL");
      String id = str(i, "interval_id");
      AuthService.uuid(id);
      if (!ids.add(id)
          || !"RUN".equals(i.get("kind"))
          || !Set.of("CONFIRMED", "UNCONFIRMED").contains(i.get("quality")))
        throw new ApiFailure(422, "INVALID_INTERVAL");
      instant(i, "start_at");
      if (i.get("end_at") != null) instant(i, "end_at");
      result.add(i);
    }
    return result;
  }

  private void releaseAfterFailure(Map<String, Object> r, long id, String error) {
    long revision = ((Number) r.get("desired_revision")).longValue() + 1;
    db.update(
        "UPDATE focus_sessions SET"
            + " execution_status='UNKNOWN',last_error_code=?,desired_revision=?,version=CASE WHEN version BETWEEN 1 AND 9007199254740990 THEN version+1 ELSE version END"
            + " WHERE id=?",
        error,
        revision,
        id);
    db.update("UPDATE active_execution_locks SET revision=? WHERE session_id=?", revision, id);
    command(id, r.get("executor_id").toString(), revision, "RELEASE_POLICY", null);
  }

  private void recoverReleasedInterval(Map<String, Object> session, Map<String, Object> release,
      Instant observed, List<Map<String, Object>> reports) {
    long id = ((Number) session.get("id")).longValue();
    // Existing intervals remain authoritative. Empty evidence cannot replace a known RUN.
    if (reports.isEmpty() || db.queryForObject(
        "SELECT COUNT(*) FROM session_intervals WHERE session_id=?", Long.class, id) > 0) return;
    if (reports.size() != 1) throw new ApiFailure(422, "INVALID_INTERVAL");
    var interval = reports.getFirst();
    if (interval.get("end_at") == null) throw new ApiFailure(422, "INVALID_INTERVAL");
    // Bind recovered evidence to the actual frozen session, installation, owner and issued APPLY.
    var applies = db.queryForList(
        "SELECT c.* FROM execution_commands c JOIN focus_sessions s ON s.id=c.session_id"
            + " JOIN policy_snapshots p ON p.id=s.policy_snapshot_id AND p.user_id=s.user_id"
            + " AND p.executor_id=s.executor_id WHERE s.id=? AND s.user_id=? AND s.executor_id=?"
            + " AND c.executor_id=s.executor_id AND c.kind='APPLY_POLICY' AND c.desired_revision<=?"
            + " ORDER BY c.desired_revision DESC LIMIT 1", id, session.get("user_id"),
        session.get("executor_id"), release.get("desired_revision"));
    if (applies.isEmpty()) throw new ApiFailure(409, "REPORT_CONFLICT");
    var apply = applies.getFirst();
    Instant began = instant(interval, "start_at"), ended = instant(interval, "end_at");
    Instant issued = kr.ac.kdu.focurve.api.DbTime.instant(apply.get("created_at"));
    Instant deadline = kr.ac.kdu.focurve.api.DbTime.instant(apply.get("execute_before"));
    if (deadline == null || began.isBefore(issued.minusSeconds(60)) || began.isAfter(deadline)
        || ended.isBefore(began) || ended.isAfter(observed))
      throw new ApiFailure(422, "INVALID_INTERVAL");
    long duration = Duration.between(began, ended).toMillis();
    if (interval.get("duration_ms") != null && number(interval, "duration_ms") != duration)
      throw new ApiFailure(409, "REPORT_CONFLICT");
    if (!db.queryForList("SELECT id FROM session_intervals WHERE id=?", interval.get("interval_id")).isEmpty())
      throw new ApiFailure(409, "REPORT_CONFLICT");
    db.update("INSERT INTO session_intervals VALUES (?,?,'RUN',?,NULL,NULL,?)",
        interval.get("interval_id"), id, Timestamp.from(began), interval.get("quality"));
    db.update("UPDATE focus_sessions SET started_at=?,planned_end_at=? WHERE id=?",
        Timestamp.from(began), Timestamp.from(began.plusSeconds(
            ((Number) session.get("duration_minutes")).longValue() * 60)), id);
    // closeIntervals validates/closes this evidence and aggregates it in the same transaction.
  }

  private void closeIntervals(long id, Instant observed, List<Map<String, Object>> reports) {
    for (var interval :
        db.queryForList(
            "SELECT * FROM session_intervals WHERE session_id=? AND end_at IS NULL FOR UPDATE",
            id)) {
      Instant start = kr.ac.kdu.focurve.api.DbTime.instant(interval.get("start_at"));
      var matching =
          reports.stream().filter(x -> x.get("interval_id").equals(interval.get("id"))).toList();
      if (matching.size() != 1
          || matching.getFirst().get("end_at") == null
          || !instant(matching.getFirst(), "start_at").equals(start))
        throw new ApiFailure(409, "REPORT_CONFLICT");
      Instant ended = instant(matching.getFirst(), "end_at");
      if (ended.isBefore(start) || ended.isAfter(observed))
        throw new ApiFailure(409, "REPORT_CONFLICT");
      long duration = Duration.between(start, ended).toMillis();
      if (matching.getFirst().get("duration_ms") != null
          && number(matching.getFirst(), "duration_ms") != duration)
        throw new ApiFailure(409, "REPORT_CONFLICT");
      db.update(
          "UPDATE session_intervals SET end_at=?,duration_ms=?,quality=? WHERE id=?",
          Timestamp.from(ended),
          matching.getFirst().get("quality").equals("CONFIRMED") ? duration : null,
          matching.getFirst().get("quality"),
          interval.get("id"));
    }
    for (var item : reports)
      if (db.queryForList(
              "SELECT id FROM session_intervals WHERE id=? AND session_id=?",
              item.get("interval_id"),
              id)
          .isEmpty()) throw new ApiFailure(409, "REPORT_CONFLICT");
    long total =
        db.queryForObject(
            "SELECT COALESCE(SUM(duration_ms),0) FROM session_intervals WHERE session_id=? AND"
                + " kind='RUN' AND quality='CONFIRMED'",
            Long.class,
            id);
    long target =
        db.queryForObject(
            "SELECT duration_minutes*60000 FROM focus_sessions WHERE id=?", Long.class, id);
    db.update(
        "UPDATE focus_sessions SET active_duration_ms=?,overrun_ms=? WHERE id=?",
        Math.min(total, target),
        Math.max(0, total - target),
        id);
  }

  @Transactional
  public Object reconcile(MemberLinks.Principal p, Map<String, Object> body) {
    if (!Set.of("journal_summary", "local_actions").containsAll(body.keySet())
        || !(body.get("journal_summary") instanceof Map)
        || !(body.get("local_actions") instanceof List<?> actions)
        || actions.size() > 100
        || json.encoded(body).length() > 1048576) throw new ApiFailure(422, "INVALID_SCHEMA");
    var summary = json.decoded(json.encoded(body.get("journal_summary")));
    if (!Set.of(
                "format_version",
                "session_id",
                "known_revision",
                "last_report_id",
                "last_access_seq",
                "last_local_seq",
                "observed_at",
                "observed_state",
                "final")
            .containsAll(summary.keySet())
        || !"1.1".equals(summary.get("format_version"))
        || !(summary.get("final") instanceof Boolean)) throw new ApiFailure(422, "INVALID_SCHEMA");
    String uuid = str(summary, "session_id");
    AuthService.uuid(uuid);
    long known = number(summary, "known_revision"),
        access = number(summary, "last_access_seq"),
        local = number(summary, "last_local_seq");
    Instant observed = instant(summary, "observed_at");
    if (known < 0
        || access < 0
        || local < access
        || observed.isAfter(Instant.now().plusSeconds(60))
        || !Set.of("APPLIED", "RELEASED", "UNCONFIRMED").contains(summary.get("observed_state")))
      throw new ApiFailure(422, "INVALID_SCHEMA");
    db.queryForList("SELECT id FROM users WHERE id=? FOR UPDATE", p.user());
    var r = byUuid(p.user(), uuid);
    long id = ((Number) r.get("id")).longValue();
    r = owned(p.user(), id, true);
    if (!p.executor().equals(r.get("executor_id"))) throw new ApiFailure(403, "EXECUTOR_MISMATCH");
    if (known > ((Number) r.get("desired_revision")).longValue())
      throw new ApiFailure(409, "RECONCILE_REQUIRED");
    if (summary.get("last_report_id") != null
        && db.queryForList(
                "SELECT id FROM execution_reports WHERE id=? AND session_id=? AND executor_id=?",
                summary.get("last_report_id"),
                id,
                p.executor())
            .isEmpty()) throw new ApiFailure(409, "REPORT_NOT_RECEIVED");
    var acknowledged = new ArrayList<Map<String, Object>>();
    for (Object input : actions) {
      if (!(input instanceof Map)) throw new ApiFailure(422, "INVALID_SCHEMA");
      var action = json.decoded(json.encoded(input));
      if (!Set.of(
              "action_id",
              "local_action_seq",
              "session_id",
              "base_revision",
              "type",
              "observed_at",
              "reason",
              "report")
          .containsAll(action.keySet())) throw new ApiFailure(422, "INVALID_SCHEMA");
      String actionId = str(action, "action_id");
      AuthService.uuid(actionId);
      long sequence = number(action, "local_action_seq"), base = number(action, "base_revision");
      if (!uuid.equals(action.get("session_id"))
          || !"END".equals(action.get("type"))
          || base < 1
          || base > ((Number) r.get("desired_revision")).longValue())
        throw new ApiFailure(409, "RECONCILE_REQUIRED");
      String hash = AuthSupport.hash(json.encoded(action));
      var old =
          db.queryForList(
              "SELECT payload_hash,response FROM execution_reconciliations WHERE executor_id=? AND"
                  + " action_id=?",
              p.executor(),
              actionId);
      if (!old.isEmpty()) {
        if (!hash.equals(old.getFirst().get("payload_hash")))
          throw new ApiFailure(409, "RECONCILE_REQUIRED");
        acknowledged.add(json.decoded(old.getFirst().get("response").toString()));
        continue;
      }
      long last =
          db.queryForObject(
              "SELECT COALESCE(MAX(local_action_seq),0) FROM execution_reconciliations WHERE"
                  + " session_id=?",
              Long.class,
              id);
      if (sequence != last + 1) throw new ApiFailure(409, "ACTION_SEQUENCE_GAP");
      if (!(action.get("report") instanceof Map)) throw new ApiFailure(422, "INVALID_SCHEMA");
      var report = json.decoded(json.encoded(action.get("report")));
      if (!Set.of(
                  "report_id",
                  "command_id",
                  "executor_id",
                  "session_id",
                  "desired_revision",
                  "result",
                  "observed_at",
                  "intervals")
              .containsAll(report.keySet())
          || !p.executor().equals(report.get("executor_id"))
          || !uuid.equals(report.get("session_id"))
          || report.get("command_id") != null
          || !"RELEASED".equals(report.get("result"))
          || number(report, "desired_revision") != base)
        throw new ApiFailure(422, "INVALID_SCHEMA");
      AuthService.uuid(str(report, "report_id"));
      Instant released = instant(report, "observed_at");
      if (!released.equals(instant(action, "observed_at")) || released.isAfter(observed))
        throw new ApiFailure(422, "INVALID_INTERVAL");
      String reason = str(action, "reason");
      if (!Set.of("MANUAL", "EXPIRED", "BROWSER_RESTART", "APPLY_FAILED").contains(reason))
        throw new ApiFailure(422, "INVALID_SCHEMA");
      var reported = intervals(report);
      if (Set.of("ENDED", "START_FAILED").contains(r.get("execution_status")))
        throw new ApiFailure(409, "REPORT_CONFLICT");
      var stored = db.queryForList("SELECT * FROM session_intervals WHERE session_id=?", id);
      if (stored.isEmpty() && !reported.isEmpty()) {
        // An offline journal may contain an applied-and-released interval whose APPLY report was
        // lost.
        if (reported.size() != 1) throw new ApiFailure(422, "INVALID_INTERVAL");
        var interval = reported.getFirst();
        Instant began = instant(interval, "start_at");
        var apply =
            db.queryForMap(
                "SELECT created_at,execute_before FROM execution_commands WHERE session_id=? AND"
                    + " kind='APPLY_POLICY' ORDER BY desired_revision LIMIT 1",
                id);
        if (began.isBefore(
                kr.ac.kdu.focurve.api.DbTime.instant(apply.get("created_at")).minusSeconds(60))
            || began.isAfter(kr.ac.kdu.focurve.api.DbTime.instant(apply.get("execute_before")))
            || interval.get("end_at") == null) throw new ApiFailure(422, "INVALID_INTERVAL");
        db.update(
            "INSERT INTO session_intervals VALUES (?,?,'RUN',?,NULL,NULL,?)",
            interval.get("interval_id"),
            id,
            Timestamp.from(began),
            interval.get("quality"));
        db.update(
            "UPDATE focus_sessions SET started_at=?,planned_end_at=? WHERE id=?",
            Timestamp.from(began),
            Timestamp.from(
                began.plusSeconds(((Number) r.get("duration_minutes")).longValue() * 60)),
            id);
      }
      closeIntervals(id, released, reported);
      long intervalCount =
          db.queryForObject(
              "SELECT COUNT(*) FROM session_intervals WHERE session_id=?", Long.class, id);
      String finalState = intervalCount == 0 ? "START_FAILED" : "ENDED";
      db.update(
          "UPDATE focus_sessions SET"
              + " execution_status=?,ended_at=?,policy_released_at=?,end_reason=?,record_status='PARTIAL',desired_revision=desired_revision+1,version=CASE WHEN version BETWEEN 1 AND 9007199254740990 THEN version+1 ELSE version END"
              + " WHERE id=?",
          finalState,
          Timestamp.from(released),
          Timestamp.from(released),
          reason.equals("BROWSER_RESTART") ? "INTERRUPTED" : reason,
          id);
      db.update(
          "UPDATE execution_commands SET status='SUPERSEDED' WHERE session_id=? AND"
              + " status='PENDING'",
          id);
      db.update("DELETE FROM active_execution_locks WHERE session_id=?", id);
      completeOperations(
          uuid,
          finalState.equals("ENDED") ? "SUCCEEDED" : "FAILED",
          finalState.equals("ENDED") ? null : "APPLY_FAILED");
      var ack = Map.<String, Object>of("action_id", actionId, "status", "ACCEPTED");
      db.update(
          "INSERT INTO execution_reconciliations VALUES (?,?,?,?,?,?,?)",
          p.executor(),
          actionId,
          id,
          sequence,
          hash,
          json.encoded(action),
          json.encoded(ack));
      acknowledged.add(ack);
      r = owned(p.user(), id, true);
    }
    if (Boolean.TRUE.equals(summary.get("final"))) {
      if (!Set.of("ENDED", "START_FAILED").contains(r.get("execution_status"))
          || !"RELEASED".equals(summary.get("observed_state"))
          || r.get("policy_released_at") == null
          || observed.isBefore(kr.ac.kdu.focurve.api.DbTime.instant(r.get("policy_released_at"))))
        throw new ApiFailure(409, "RELEASE_UNCONFIRMED");
      var old =
          db.queryForList("SELECT * FROM session_watermarks WHERE session_id=? FOR UPDATE", id);
      if (!old.isEmpty()
          && (access < ((Number) old.getFirst().get("last_access_seq")).longValue()
              || local < ((Number) old.getFirst().get("last_local_seq")).longValue()))
        throw new ApiFailure(409, "WATERMARK_CONFLICT");
      db.update(
          "INSERT INTO session_watermarks VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE"
              + " last_access_seq=VALUES(last_access_seq),last_local_seq=VALUES(last_local_seq),observed_at=VALUES(observed_at)",
          id,
          access,
          local,
          Timestamp.from(observed));
      refreshRecordQuality(id);
    } else if (!Set.of("ENDED", "START_FAILED").contains(r.get("execution_status"))) {
      if ("STARTING".equals(r.get("execution_status"))
          && "APPLIED".equals(summary.get("observed_state")))
        throw new ApiFailure(409, "REPORT_NOT_RECEIVED");
      if (!"APPLIED".equals(summary.get("observed_state"))
          || known != ((Number) r.get("desired_revision")).longValue()) {
        if (!"ENDING".equals(r.get("execution_status"))
            && !"UNKNOWN".equals(r.get("execution_status")))
          releaseAfterFailure(r, id, "RECONCILIATION_REQUIRED");
      }
    }
    heartbeat(p);
    r = owned(p.user(), id, false);
    return Map.of(
        "desired_state",
        r.get("execution_status").equals("RUNNING") ? "APPLIED" : "RELEASED",
        "revision",
        r.get("desired_revision"),
        "acknowledged_actions",
        acknowledged,
        "record_status",
        r.get("record_status"));
  }

  public void refreshRecordQuality(long id) {
    var watermarks = db.queryForList("SELECT * FROM session_watermarks WHERE session_id=?", id);
    if (watermarks.isEmpty()) return;
    var w = watermarks.getFirst();
    long expectedAccess = ((Number) w.get("last_access_seq")).longValue(),
        expectedLocal = ((Number) w.get("last_local_seq")).longValue();
    var count =
        db.queryForMap(
            "SELECT COUNT(*) total,COUNT(DISTINCT"
                + " CAST(JSON_UNQUOTE(JSON_EXTRACT(payload,'$.local_seq')) AS UNSIGNED))"
                + " unique_seq,COALESCE(MAX(CAST(JSON_UNQUOTE(JSON_EXTRACT(payload,'$.local_seq'))"
                + " AS UNSIGNED)),0) max_seq FROM event_receipts WHERE resolved_session_id=?",
            id);
    long accessCount =
        db.queryForObject("SELECT COUNT(*) FROM access_events WHERE session_id=?", Long.class, id);
    long maxAccess =
        db.queryForObject(
            "SELECT COALESCE(MAX(access_seq),0) FROM access_events WHERE session_id=?",
            Long.class,
            id);
    long localCount = ((Number) count.get("total")).longValue(),
        maxLocal = ((Number) count.get("max_seq")).longValue();
    long uncertain =
        db.queryForObject(
            "SELECT COUNT(*) FROM session_intervals WHERE session_id=? AND (quality<>'CONFIRMED' OR"
                + " end_at IS NULL)",
            Long.class,
            id);
    boolean complete =
        accessCount == expectedAccess
            && maxAccess == expectedAccess
            && localCount == expectedLocal
            && maxLocal == expectedLocal
            && ((Number) count.get("unique_seq")).longValue() == expectedLocal;
    String quality =
        uncertain > 0 || maxAccess > expectedAccess || maxLocal > expectedLocal
            ? "REVIEW_REQUIRED"
            : complete ? "COMPLETE" : "PENDING";
    db.update(
        "UPDATE focus_sessions SET"
            + " record_status=IF(record_status='REVIEW_REQUIRED',record_status,?) WHERE id=?",
        quality,
        id);
  }

  public Object operation(long owner, String operation) {
    var rows =
        db.queryForList(
            "SELECT status,resource_id,error_code FROM operations WHERE user_id=? AND id=?",
            owner,
            operation);
    if (rows.isEmpty()) throw new ApiFailure(404, "OPERATION_NOT_FOUND");
    var r = rows.getFirst();
    var out = new LinkedHashMap<String, Object>();
    out.put("status", r.get("status"));
    out.put("resource_id", r.get("resource_id"));
    out.put("error", r.get("error_code"));
    return out;
  }

  public void heartbeat(MemberLinks.Principal p) {
    db.update(
        "UPDATE extension_installations SET last_seen_at=UTC_TIMESTAMP(3) WHERE id=? AND"
            + " current_user_id=?",
        p.executor(),
        p.user());
  }

  private String createOperation(long owner, String uuid) {
    String id = UUID.randomUUID().toString();
    db.update(
        "INSERT INTO operations VALUES (?,?,?,'PENDING',NULL,UTC_TIMESTAMP(3))", id, owner, uuid);
    return id;
  }

  private void completeOperations(String uuid, String status, String error) {
    db.update(
        "UPDATE operations SET status=?,error_code=? WHERE resource_id=? AND status='PENDING'",
        status,
        error,
        uuid);
  }

  private void command(long id, String executor, long revision, String kind, Object snapshot) {
    String command = UUID.randomUUID().toString();
    String session =
        db.queryForObject(
            "SELECT source_session_id FROM focus_sessions WHERE id=?", String.class, id);
    Instant deadline = Instant.now().plusSeconds(60);
    var payload = new LinkedHashMap<String, Object>();
    payload.put("command_id", command);
    payload.put("session_id", session);
    payload.put("executor_id", executor);
    payload.put("type", kind);
    payload.put("desired_revision", revision);
    payload.put("created_at", Instant.now().toString());
    payload.put("execute_before", kind.equals("APPLY_POLICY") ? deadline.toString() : null);
    if (kind.equals("APPLY_POLICY")) {
      Integer minutes = db.queryForObject(
          "SELECT duration_minutes FROM focus_sessions WHERE id=?", Integer.class, id);
      if (minutes == null || minutes < 1 || minutes > 180)
        throw new ApiFailure(422, "VALIDATION_FAILED");
      payload.put("duration_minutes", minutes);
    }
    if (snapshot != null) payload.put("snapshot", snapshot);
    payload.put("reason", "MANUAL");
    db.update(
        "INSERT INTO execution_commands VALUES (?,?,?,?,?,?,'PENDING',UTC_TIMESTAMP(3),?)",
        command,
        id,
        executor,
        revision,
        kind,
        json.encoded(payload),
        kind.equals("APPLY_POLICY") ? Timestamp.from(deadline) : null);
  }

  private Map<String, Object> owned(long owner, long id, boolean lock) {
    var rows =
        db.queryForList(
            "SELECT * FROM focus_sessions WHERE id=? AND user_id=?" + (lock ? " FOR UPDATE" : ""),
            id,
            owner);
    if (rows.isEmpty()) throw new ApiFailure(404, "SESSION_NOT_FOUND");
    return rows.getFirst();
  }

  private Map<String, Object> view(Map<String, Object> r) {
    var out = new LinkedHashMap<String, Object>();
    out.put("session_id", r.get("source_session_id"));
    // Explicit support boundary: legacy wall-clock sessions, not active-time auto recovery.
    out.put("automatic_recovery_supported", false);
    out.put("time_accounting_mode", "LEGACY_WALL_CLOCK");
    for (String name :
        List.of(
            "executor_id",
            "policy_snapshot_id",
            "origin",
            "source",
            "execution_status",
            "record_status",
            "duration_minutes",
            "active_duration_ms",
            "overrun_ms",
            "version",
            "desired_revision",
            "end_reason",
            "last_error_code")) out.put(name, r.get(name));
    sessionVersionView(out);
    for (String name : List.of("started_at", "planned_end_at", "ended_at", "policy_released_at"))
      out.put(
          name,
          r.get(name) == null
              ? null
              : kr.ac.kdu.focurve.api.DbTime.instant(r.get(name)).toString());
    out.put(
        "remaining_ms",
        Math.max(
            0,
            ((Number) r.get("duration_minutes")).longValue() * 60000
                - ((Number) r.get("active_duration_ms")).longValue()));
    return out;
  }

  private void sessionVersionView(Map<String, Object> response) {
    Object version = response.get("version");
    // Never truncate floating-point, overflowed, missing or malformed historical cache values.
    // Refetch the authoritative session/commands and reconcile instead of claiming success.
    long value;
    if (version instanceof Integer || version instanceof Long) {
      value = ((Number) version).longValue();
    } else if (version instanceof String text && text.matches("[1-9][0-9]*")) {
      try { value = Long.parseLong(text); }
      catch (NumberFormatException e) { throw new ApiFailure(409, "RECONCILE_REQUIRED"); }
    } else {
      throw new ApiFailure(409, "RECONCILE_REQUIRED");
    }
    if (value < 1) throw new ApiFailure(409, "RECONCILE_REQUIRED");
    // Normalize only the outgoing representation; retain DB/cache bytes exactly.
    response.put("version", value > SafeVersion.MAX ? Long.toString(value) : (Object) value);
    response.put("version_increment_blocked", value >= SafeVersion.MAX);
  }

  private Map<String, Object> replay(long owner, String path, String key, Object body) {
    var rows =
        db.queryForList(
            "SELECT body_hash,response FROM idempotency_keys WHERE owner_key=? AND method='POST'"
                + " AND path=? AND request_key=? AND expires_at>UTC_TIMESTAMP(3)",
            "MEMBER:" + owner,
            path,
            key);
    if (rows.isEmpty()) return null;
    if (!rows.getFirst().get("body_hash").equals(AuthSupport.hash(json.encoded(body))))
      throw new ApiFailure(409, "IDEMPOTENCY_CONFLICT");
    var response = json.decoded(rows.getFirst().get("response").toString());
    sessionVersionView(response);
    return response;
  }

  private void remember(long owner, String path, String key, Object body, Object result) {
    db.update(
        "DELETE FROM idempotency_keys WHERE owner_key=? AND method='POST' AND path=? AND"
            + " request_key=?",
        "MEMBER:" + owner,
        path,
        key);
    db.update(
        "INSERT INTO idempotency_keys VALUES (?,'POST',?,?,?,?,?)",
        "MEMBER:" + owner,
        path,
        key,
        AuthSupport.hash(json.encoded(body)),
        json.encoded(result),
        Timestamp.from(Instant.now().plus(Duration.ofDays(7))));
  }

  public static String str(Map<String, Object> m, String key) {
    Object v = m.get(key);
    if (!(v instanceof String s) || s.isBlank()) throw new ApiFailure(422, "VALIDATION_FAILED");
    return s;
  }

  public static long number(Map<String, Object> m, String key) {
    Object v = m.get(key);
    if (!(v instanceof Number n)
        || !(v instanceof Integer || v instanceof Long)
        || n.doubleValue() != n.longValue()) throw new ApiFailure(422, "VALIDATION_FAILED");
    return n.longValue();
  }

  public static Instant instant(Map<String, Object> m, String key) {
    try {
      return Instant.parse(str(m, key)).truncatedTo(java.time.temporal.ChronoUnit.MILLIS);
    } catch (java.time.format.DateTimeParseException e) {
      throw new ApiFailure(422, "VALIDATION_FAILED");
    }
  }

  public static Map<String, Object> defaultContent() {
    return Map.of(
        "version",
        1,
        "keywords",
        Map.of("enabled", false, "rules", List.of(), "exceptions", List.of()),
        "adult_domains",
        Map.of("enabled", false, "custom_hosts", List.of(), "exceptions", List.of()),
        "image_blur",
        Map.of("enabled", false, "sensitivity", "MEDIUM", "strength", "MEDIUM"),
        "usage_tracking",
        Map.of("enabled", false));
  }
}
