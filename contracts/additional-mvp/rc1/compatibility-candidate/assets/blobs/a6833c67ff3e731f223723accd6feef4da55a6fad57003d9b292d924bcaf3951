package kr.ac.kdu.focurve.auth;

import java.sql.Timestamp;
import java.time.*;
import java.util.*;
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
    checkAll(new Limit(bucket, max, windowSeconds, gapSeconds));
  }

  public record Limit(String bucket, int max, long windowSeconds, long gapSeconds) {}
  private static class State {
    Limit limit; String key; Instant start, last; int count;
    State(Limit limit, String key, Instant start, Instant last, int count) {
      this.limit=limit;this.key=key;this.start=start;this.last=last;this.count=count;
    }
    Instant deadline(Instant now) {
      return retryAt(count,limit.max(),start,last,limit.windowSeconds(),limit.gapSeconds(),now);
    }
  }

  // Lock all applicable buckets before deciding the retry time. Preserve the
  // existing ordered accounting: an allowed IP attempt still counts when the
  // following email bucket rejects it. No bucket after a rejection is consumed.
  @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = ApiFailure.class)
  public Instant checkAll(Limit... limits) {
    Instant now = Instant.now();
    var states = new ArrayList<State>();
    for (Limit limit : limits) {
      String key = AuthSupport.hash(limit.bucket());
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
      states.add(new State(limit,key,start,last,count));
    }
    Instant observedAt = Instant.now();
    for (State state : states) {
      if (!state.start.plusSeconds(state.limit.windowSeconds()).isAfter(observedAt)) {
        state.count=0;state.start=observedAt;
      }
    }
    for (State state : states) {
      if (state.deadline(observedAt).isAfter(observedAt)) {
        Instant retry = states.stream().map(s->s.deadline(observedAt)).max(Instant::compareTo).orElse(observedAt);
        throw new ApiFailure(429,"RATE_LIMITED",secondsUntil(observedAt,retry));
      }
      state.count++;state.last=observedAt;
      db.update(
        "UPDATE auth_rate_limits SET window_start=?,attempts=?,last_attempt=? WHERE bucket_hash=?",
        Timestamp.from(state.start),state.count,Timestamp.from(observedAt),state.key);
    }
    return states.stream().map(s->s.deadline(observedAt)).max(Instant::compareTo).orElse(observedAt);
  }

  static Instant retryAt(int count,int max,Instant start,Instant last,long window,long gap,Instant now) {
    Instant deadline=now;
    if(count>=max && start.plusSeconds(window).isAfter(now)) deadline=start.plusSeconds(window);
    if(last.plusSeconds(gap).isAfter(deadline)) deadline=last.plusSeconds(gap);
    return deadline;
  }

  public static long secondsUntil(Instant now,Instant deadline) {
    if(!deadline.isAfter(now)) return 0;
    Duration remaining=Duration.between(now,deadline);
    return remaining.getSeconds()+(remaining.getNano()==0?0:1);
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
      throw new ApiFailure(429, "RATE_LIMITED",secondsUntil(Instant.now(),
          kr.ac.kdu.focurve.api.DbTime.instant(rows.getFirst().get("window_start")).plusSeconds(windowSeconds)));
  }

  public void success(String bucket) {
    db.update("DELETE FROM auth_rate_limits WHERE bucket_hash=?", AuthSupport.hash(bucket));
  }
}
