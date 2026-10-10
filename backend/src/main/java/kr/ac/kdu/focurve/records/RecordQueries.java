package kr.ac.kdu.focurve.records;

import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import kr.ac.kdu.focurve.api.ApiFailure;
import kr.ac.kdu.focurve.auth.AuthService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class RecordQueries {
  private final JdbcTemplate db;
  private final AuthService json;
  private static final String RANKED =
      "WITH ranked AS (SELECT a.*,s.source_session_id,s.executor_id,s.user_id,r.event_type,r.status"
          + " receipt_status,r.payload receipt_payload, ROW_NUMBER() OVER(PARTITION BY a.session_id,CASE WHEN r.schema_version='1.2' THEN a.target_host ELSE a.target_key END ORDER BY"
          + " a.access_seq) target_access_index FROM access_events a JOIN focus_sessions s ON"
          + " s.id=a.session_id JOIN event_receipts r ON r.event_id=a.event_id WHERE s.user_id=?) ";

  public RecordQueries(JdbcTemplate db, AuthService json) {
    this.db = db;
    this.json = json;
  }

  public record Range(Instant from, Instant to) {}

  public static Range range(String from, String to) {
    try {
      // Public date-only input: Gregorian years 0001..9999. Keep ordinary
      // four-digit dates (including 9999) compatible; reject extended ISO years.
      for (String value : Arrays.asList(from, to)) {
        if (value != null && (!value.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")
            || value.startsWith("0000-"))) throw new ApiFailure(422, "INVALID_DATE_RANGE");
      }
      ZoneId zone = ZoneId.of("Asia/Seoul");
      LocalDate end = to == null ? LocalDate.now(zone) : LocalDate.parse(to),
          start = from == null ? end.minusDays(6) : LocalDate.parse(from);
      long days = java.time.temporal.ChronoUnit.DAYS.between(start, end) + 1;
      if (days < 1 || days > 366) throw new ApiFailure(422, "INVALID_DATE_RANGE");
      return new Range(
          start.atStartOfDay(zone).toInstant(), end.plusDays(1).atStartOfDay(zone).toInstant());
    } catch (DateTimeException e) {
      throw new ApiFailure(422, "INVALID_DATE_RANGE");
    }
  }

  public Map<String, Object> list(
      long user,
      String from,
      String to,
      String session,
      String host,
      String type,
      String cursor,
      int limit) {
    if (type != null
        && !Set.of("BLOCKED_SITE_ACCESS", "RECORDED_ACCESS", "BLOCKED_FEATURE_ACCESS")
            .contains(type)) throw new ApiFailure(422, "VALIDATION_FAILED");
    if (session != null) AuthService.uuid(session);
    if (host != null) host = kr.ac.kdu.focurve.sites.SiteInput.host(host);
    Range range = range(from, to);
    if (limit < 1 || limit > 100) throw new ApiFailure(422, "VALIDATION_FAILED");
    String sql = RANKED + "SELECT * FROM ranked WHERE occurred_at>=? AND occurred_at<?";
    var args =
        new ArrayList<Object>(
            List.of(user, Timestamp.from(range.from()), Timestamp.from(range.to())));
    if (session != null) {
      sql += " AND source_session_id=?";
      args.add(session);
    }
    if (host != null) {
      sql += " AND target_host=?";
      args.add(host);
    }
    if (type != null) {
      sql += " AND event_type=?";
      args.add(type);
    }
    if (cursor != null) {
      try {
        String decoded =
            new String(
                Base64.getUrlDecoder().decode(cursor), java.nio.charset.StandardCharsets.UTF_8);
        var parts = decoded.split("\\|", 2);
        Instant at = Instant.parse(parts[0]);
        if (parts.length != 2) throw new IllegalArgumentException();
        sql += " AND (occurred_at<? OR (occurred_at=? AND event_id<?))";
        args.add(Timestamp.from(at));
        args.add(Timestamp.from(at));
        args.add(parts[1]);
      } catch (Exception e) {
        throw new ApiFailure(400, "INVALID_CURSOR");
      }
    }
    sql += " ORDER BY occurred_at DESC,event_id DESC LIMIT ?";
    args.add(limit + 1);
    var rows = db.queryForList(sql, args.toArray());
    boolean more = rows.size() > limit;
    if (more) rows = new ArrayList<>(rows.subList(0, limit));
    var result = new LinkedHashMap<String, Object>();
    result.put("items", rows.stream().map(this::access).toList());
    result.put("has_more", more);
    result.put(
        "next_cursor",
        more
            ? encode(
                kr.ac.kdu.focurve.api.DbTime.instant(rows.getLast().get("occurred_at"))
                    + "|"
                    + rows.getLast().get("event_id"))
            : null);
    return result;
  }

  public Object detail(long user, String event) {
    var rows = db.queryForList(RANKED + "SELECT * FROM ranked WHERE event_id=?", user, event);
    if (rows.isEmpty()) throw new ApiFailure(404, "EVENT_NOT_FOUND");
    var result = access(rows.getFirst());
    result.put(
        "policy",
        json.decoded(
            db.queryForObject(
                "SELECT payload FROM policy_snapshots WHERE id=? AND user_id=?",
                String.class,
                rows.getFirst().get("policy_snapshot_id"),
                user)));
    return result;
  }

  public Map<String, Object> summary(long user, String from, String to) {
    Range range = range(from, to);
    var r =
        db.queryForMap(
            RANKED
                + "SELECT COUNT(*) total_access,COALESCE(SUM(target_access_index>1),0)"
                + " repeat_access,COALESCE(SUM(event_type IN"
                + " ('BLOCKED_SITE_ACCESS','BLOCKED_FEATURE_ACCESS')),0) blocked_access FROM ranked"
                + " WHERE occurred_at>=? AND occurred_at<?",
            user,
            Timestamp.from(range.from()),
            Timestamp.from(range.to()));
    long incomplete =
        db.queryForObject(
            "SELECT COUNT(*) FROM focus_sessions WHERE user_id=? AND record_status IN"
                + " ('PENDING','PARTIAL','REVIEW_REQUIRED') AND (started_at IS NULL OR"
                + " started_at<?) AND (ended_at IS NULL OR ended_at>?)",
            Long.class,
            user,
            Timestamp.from(range.to()),
            Timestamp.from(range.from()));
    long measured =
        db.queryForObject(
            "WITH confirmed AS (SELECT i.*,s.duration_minutes*60000"
                + " target_ms,COALESCE(SUM(i.duration_ms) OVER(PARTITION BY i.session_id ORDER BY"
                + " i.start_at,i.id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0) before_ms"
                + " FROM session_intervals i JOIN focus_sessions s ON s.id=i.session_id WHERE"
                + " s.user_id=? AND i.kind='RUN' AND i.quality='CONFIRMED' AND i.end_at IS NOT"
                + " NULL), credited AS (SELECT start_at,DATE_ADD(start_at,INTERVAL"
                + " (LEAST(duration_ms,GREATEST(target_ms-before_ms,0))*1000) MICROSECOND)"
                + " credited_end FROM confirmed) SELECT"
                + " COALESCE(SUM(TIMESTAMPDIFF(MICROSECOND,GREATEST(start_at,?),LEAST(credited_end,?))"
                + " DIV 1000),0) FROM credited WHERE start_at<? AND credited_end>?",
            Long.class,
            user,
            Timestamp.from(range.from()),
            Timestamp.from(range.to()),
            Timestamp.from(range.to()),
            Timestamp.from(range.from()));
    long count = ((Number) r.get("total_access")).longValue();
    var result = new LinkedHashMap<String, Object>(r);
    result.put("active_duration_ms", incomplete > 0 && measured == 0 ? null : measured);
    result.put(
        "repeat_ratio",
        count == 0 ? null : ((Number) r.get("repeat_access")).doubleValue() / count * 100);
    result.put(
        "quality",
        incomplete > 0 ? "PARTIAL" : count == 0 && measured == 0 ? "NO_DATA" : "COMPLETE");
    result.put("as_of", Instant.now().toString());
    if (incomplete > 0 && count == 0) {
      result.put("total_access", null);
      result.put("repeat_access", null);
      result.put("blocked_access", null);
      if (measured == 0) result.put("active_duration_ms", null);
    }
    return result;
  }

  @org.springframework.transaction.annotation.Transactional(readOnly = true)
  public List<Map<String, Object>> hourly(long user, String from, String to) {
    Range range = range(from, to);
    var args = new ArrayList<Object>();
    args.add(user);
    // Use Java's Asia/Seoul rules, including historical offsets/DST, without
    // depending on MySQL's optional named-timezone tables. Aggregate in SQL.
    var rules = ZoneId.of("Asia/Seoul").getRules();
    Instant position = range.from();
    StringBuilder offset = new StringBuilder("CASE ");
    var transition = rules.nextTransition(position);
    while (transition != null && transition.getInstant().isBefore(range.to())) {
      offset.append("WHEN occurred_at<? THEN ? ");
      args.add(Timestamp.from(transition.getInstant()));
      args.add(rules.getOffset(position).getTotalSeconds());
      position = transition.getInstant();
      transition = rules.nextTransition(position);
    }
    int lastOffset = rules.getOffset(position).getTotalSeconds();
    String offsetSql;
    if (args.size() == 1) {
      offsetSql = "?";
    } else {
      offsetSql = offset.append("ELSE ? END").toString();
    }
    args.add(lastOffset);
    args.add(Timestamp.from(range.from()));
    args.add(Timestamp.from(range.to()));
    var rows = db.queryForList(RANKED
        + "SELECT HOUR(DATE_ADD(occurred_at,INTERVAL (" + offsetSql + ") SECOND)) hour,"
        + "COUNT(*) total_access,SUM(target_access_index>1) repeat_access,"
        + "SUM(event_type IN ('BLOCKED_SITE_ACCESS','BLOCKED_FEATURE_ACCESS')) blocked_access"
        + " FROM ranked WHERE occurred_at>=? AND occurred_at<? GROUP BY hour", args.toArray());
    long incomplete = db.queryForObject(
        "SELECT COUNT(*) FROM focus_sessions WHERE user_id=? AND record_status IN"
            + " ('PENDING','PARTIAL','REVIEW_REQUIRED') AND (started_at IS NULL OR started_at<?)"
            + " AND (ended_at IS NULL OR ended_at>?)", Long.class, user,
        Timestamp.from(range.to()), Timestamp.from(range.from()));
    long total = rows.stream().mapToLong(r -> ((Number) r.get("total_access")).longValue()).sum();
    String quality = incomplete > 0 ? "PARTIAL" : total == 0 ? "NO_DATA" : "COMPLETE";
    String asOf = Instant.now().toString();
    var result = new ArrayList<Map<String, Object>>();
    for (int hour = 0; hour < 24; hour++) {
      int h = hour;
      var row = rows.stream().filter(r -> ((Number) r.get("hour")).intValue() == h)
          .findFirst().orElse(Map.of());
      long count = row.isEmpty() ? 0 : ((Number) row.get("total_access")).longValue();
      long repeats = row.isEmpty() ? 0 : ((Number) row.get("repeat_access")).longValue();
      long blocked = row.isEmpty() ? 0 : ((Number) row.get("blocked_access")).longValue();
      var bucket = new LinkedHashMap<String, Object>();
      bucket.put("hour", hour);
      bucket.put("timezone", "Asia/Seoul");
      // A partial bucket with no received records is unknown, not measured zero.
      bucket.put("total_access", incomplete > 0 && count == 0 ? null : count);
      bucket.put("repeat_access", incomplete > 0 && count == 0 ? null : repeats);
      bucket.put("blocked_access", incomplete > 0 && count == 0 ? null : blocked);
      bucket.put("active_duration_ms", null); // Access counts do not measure usage/focus time.
      bucket.put("repeat_ratio", count == 0 ? null : repeats * 100.0 / count);
      bucket.put("quality", quality);
      bucket.put("as_of", asOf);
      result.add(bucket);
    }
    return result;
  }

  public Object targets(long user, String from, String to, String cursor) {
    Range range = range(from, to);
    String after = "";
    try {
      if (cursor != null)
        after =
            new String(
                Base64.getUrlDecoder().decode(cursor), java.nio.charset.StandardCharsets.UTF_8);
    } catch (IllegalArgumentException e) {
      throw new ApiFailure(400, "INVALID_CURSOR");
    }
    var rows =
        db.queryForList(
            RANKED
                + "SELECT target_host host,COUNT(*) total_access,SUM(target_access_index>1)"
                + " repeat_access,SUM(event_type IN"
                + " ('BLOCKED_SITE_ACCESS','BLOCKED_FEATURE_ACCESS')) blocked_access FROM ranked"
                + " WHERE occurred_at>=? AND occurred_at<? AND target_host>? GROUP BY target_host"
                + " ORDER BY target_host LIMIT 21",
            user,
            Timestamp.from(range.from()),
            Timestamp.from(range.to()),
            after);
    boolean more = rows.size() > 20;
    if (more) rows = new ArrayList<>(rows.subList(0, 20));
    Object quality = summary(user, from, to).get("quality");
    for (var r : rows) {
      r.put(
          "repeat_ratio",
          ((Number) r.get("repeat_access")).doubleValue()
              / ((Number) r.get("total_access")).longValue()
              * 100);
      r.put("active_duration_ms", null);
      r.put("quality", quality);
      r.put("as_of", Instant.now().toString());
    }
    var out = new LinkedHashMap<String, Object>();
    out.put("items", rows);
    out.put("has_more", more);
    out.put("next_cursor", more ? encode(rows.getLast().get("host").toString()) : null);
    return out;
  }

  public Object dashboard(long user, Object current) {
    var result = new LinkedHashMap<String, Object>();
    result.put("current_session", current);
    result.put(
        "recent_sessions",
        db
            .queryForList(
                "SELECT source_session_id"
                    + " session_id,execution_status,record_status,started_at,ended_at FROM"
                    + " focus_sessions WHERE user_id=? ORDER BY id DESC LIMIT 5",
                user)
            .stream()
            .map(
                r -> {
                  for (String field : List.of("started_at", "ended_at"))
                    if (r.get(field) != null)
                      r.put(field, kr.ac.kdu.focurve.api.DbTime.instant(r.get(field)).toString());
                  return r;
                })
            .toList());
    result.put("recent_access", list(user, null, null, null, null, null, null, 5).get("items"));
    result.put("summary", summary(user, null, null));
    return result;
  }

  private Map<String, Object> access(Map<String, Object> row) {
    var result = new LinkedHashMap<String, Object>();
    for (String key :
        List.of(
            "event_id",
            "executor_id",
            "event_type",
            "target_kind",
            "target_host",
            "feature_code",
            "target_key",
            "access_seq",
            "target_access_index",
            "policy_snapshot_id")) result.put(key, row.get(key));
    result.put("session_id", row.get("source_session_id"));
    result.put(
        "occurred_at", kr.ac.kdu.focurve.api.DbTime.instant(row.get("occurred_at")).toString());
    result.put("repeat_count", ((Number) row.get("target_access_index")).longValue() - 1);
    var envelope=json.decoded(row.get("receipt_payload").toString());
    // Earlier imported/fixture receipts may have only metadata; preserve their existing readback.
    var payload=envelope.get("payload") instanceof Map<?,?> p ? p : Map.of();
    result.put("matched_policy_host",payload.get("matched_policy_host"));
    result.put("blocked_reasons",payload.containsKey("blocked_reasons")?payload.get("blocked_reasons"):List.of(row.get("reason")));
    result.put("is_repeat", ((Number) row.get("target_access_index")).longValue() > 1);
    result.put(
        "quality", row.get("receipt_status").equals("ACCEPTED") ? "CONFIRMED" : "UNCONFIRMED");
    return result;
  }

  private static String encode(String value) {
    return Base64.getUrlEncoder()
        .withoutPadding()
        .encodeToString(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
  }
}
