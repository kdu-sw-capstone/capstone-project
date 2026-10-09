package kr.ac.kdu.focurve.auth;

import java.sql.Timestamp;
import java.time.*;
import kr.ac.kdu.focurve.api.ApiFailure;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
public class AuthRateLimits {
  private final JdbcTemplate db;

  public AuthRateLimits(JdbcTemplate db) {
    this.db = db;
  }

  @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = ApiFailure.class)
  public void check(String bucket, int max, long windowSeconds, long gapSeconds) {
    String key = AuthSupport.hash(bucket);
    Instant now = Instant.now();
    db.update(
        "INSERT IGNORE INTO auth_rate_limits(bucket_hash,window_start,attempts,last_attempt) VALUES"
            + " (?,?,0,?)",
        key,
        Timestamp.from(now),
        Timestamp.from(Instant.EPOCH));
    var r = db.queryForMap("SELECT * FROM auth_rate_limits WHERE bucket_hash=? FOR UPDATE", key);
    Instant start = kr.ac.kdu.focurve.api.DbTime.instant(r.get("window_start")),
        last = kr.ac.kdu.focurve.api.DbTime.instant(r.get("last_attempt"));
    int count = ((Number) r.get("attempts")).intValue();
    if (start.plusSeconds(windowSeconds).isBefore(now)) {
      count = 0;
      start = now;
    }
    if (count >= max || last.plusSeconds(gapSeconds).isAfter(now))
      throw new ApiFailure(429, "RATE_LIMITED");
    db.update(
        "UPDATE auth_rate_limits SET window_start=?,attempts=?,last_attempt=? WHERE bucket_hash=?",
        Timestamp.from(start),
        count + 1,
        Timestamp.from(now),
        key);
  }

  public void available(String bucket, int max, long windowSeconds) {
    var rows =
        db.queryForList(
            "SELECT window_start,attempts FROM auth_rate_limits WHERE bucket_hash=?",
            AuthSupport.hash(bucket));
    if (!rows.isEmpty()
        && kr.ac.kdu.focurve.api.DbTime.instant(rows.getFirst().get("window_start"))
            .plusSeconds(windowSeconds)
            .isAfter(Instant.now())
        && ((Number) rows.getFirst().get("attempts")).intValue() >= max)
      throw new ApiFailure(429, "RATE_LIMITED");
  }

  public void success(String bucket) {
    db.update("DELETE FROM auth_rate_limits WHERE bucket_hash=?", AuthSupport.hash(bucket));
  }
}
