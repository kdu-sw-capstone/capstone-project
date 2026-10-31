package kr.ac.kdu.focurve;
import java.time.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class AmvpScheduleBridgeTest {
 @Test void dstGapSkipsWithoutShiftingTheReservation(){assertThat(AmvpScheduleBridge.weekly(LocalDate.parse("2026-03-08"),LocalTime.parse("02:30"),ZoneId.of("America/New_York"))).isEmpty();}
 @Test void dstFoldSelectsEarlierInstantExactlyOnce(){assertThat(AmvpScheduleBridge.weekly(LocalDate.parse("2026-11-01"),LocalTime.parse("01:30"),ZoneId.of("America/New_York"))).contains(Instant.parse("2026-11-01T05:30:00Z"));}
 @Test void fixedEndUsesElapsedDurationAcrossTimezoneChange(){var start=AmvpScheduleBridge.weekly(LocalDate.parse("2026-11-01"),LocalTime.parse("01:30"),ZoneId.of("America/New_York")).orElseThrow();assertThat(start.plusSeconds(90*60)).isEqualTo(Instant.parse("2026-11-01T07:00:00Z"));}
}
