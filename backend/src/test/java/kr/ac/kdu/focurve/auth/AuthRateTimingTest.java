package kr.ac.kdu.focurve.auth;
import static org.assertj.core.api.Assertions.*;
import java.time.Instant;
import org.junit.jupiter.api.Test;
class AuthRateTimingTest {
  final Instant now=Instant.parse("2026-10-10T00:00:00Z");
  @Test void normalAndGapBoundary(){
    assertThat(AuthRateLimits.retryAt(1,5,now.minusSeconds(100),now.minusSeconds(60),3600,60,now)).isEqualTo(now);
    assertThat(AuthRateLimits.retryAt(1,5,now.minusSeconds(100),now.minusSeconds(59),3600,60,now)).isEqualTo(now.plusSeconds(1));
  }
  @Test void hourlyWindowEndsAtBoundary(){
    assertThat(AuthRateLimits.retryAt(5,5,now.minusSeconds(3600),now.minusSeconds(60),3600,60,now)).isEqualTo(now);
    assertThat(AuthRateLimits.retryAt(5,5,now.minusSeconds(3599),now.minusSeconds(60),3600,60,now)).isEqualTo(now.plusSeconds(1));
    assertThat(AuthRateLimits.retryAt(5,5,now.minusSeconds(3601),now.minusSeconds(60),3600,60,now)).isEqualTo(now);
  }
  @Test void gapCanOutlastWindow(){
    assertThat(AuthRateLimits.retryAt(5,5,now.minusSeconds(3599),now.minusSeconds(2),3600,60,now)).isEqualTo(now.plusSeconds(58));
  }
  @Test void fractionalSecondRoundsUpWithoutEarlyRetry(){
    assertThat(AuthRateLimits.secondsUntil(now,now.plusNanos(1))).isEqualTo(1);
    assertThat(AuthRateLimits.secondsUntil(now,now.plusSeconds(59).plusNanos(1))).isEqualTo(60);
    assertThat(AuthRateLimits.secondsUntil(now,now)).isZero();
  }
}
