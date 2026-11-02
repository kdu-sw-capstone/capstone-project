package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class AnalysisSafetyTest {
 final ObjectMapper json=new ObjectMapper();final String at="2026-11-11T00:00:00Z";
 @Test void snapshotIsCanonicalImmutableAndBoundToTheActualCutoff()throws Exception{
  var a=json.readTree("{\"completed_sessions\":3,\"active_duration_ms\":1800000}");
  var b=json.readTree("{\"active_duration_ms\":1800000,\"completed_sessions\":3}");
  var frozen=AnalysisSafety.freeze("2026-11-01","2026-11-11",at,a);
  assertThat(frozen).isEqualTo(AnalysisSafety.freeze("2026-11-01","2026-11-11",at,b));
  ((com.fasterxml.jackson.databind.node.ObjectNode)a).put("active_duration_ms",0);
  assertThat(frozen.json()).contains("1800000");
  assertThat(frozen.hash()).isNotEqualTo(AnalysisSafety.freeze("2026-11-01","2026-11-11","2026-11-11T00:00:01Z",b).hash());
 }
 @Test void rawNotesEmailsUrlsAndFreeTextNeverEnterTheInput(){
  for(String name:List.of("email","note","url","full_url","body","keyword","raw"))assertThatThrownBy(()->AnalysisSafety.freeze("2026-11-01","2026-11-11",at,json.createObjectNode().put(name,"private"))).hasMessage("VALIDATION_FAILED");
 }
 @Test void cacheDoesNotChangeSnapshotAndExpiresAt24Hours(){
  var input=AnalysisSafety.freeze("2026-11-01","2026-11-11",at,json.createObjectNode().put("completed_sessions",3));
  var created=Instant.parse(at);
  assertThat(AnalysisSafety.reusable(input,input,created,created.plusSeconds(86399),"m","m")).isTrue();
  assertThat(AnalysisSafety.reusable(input,input,created,created.plusSeconds(86400),"m","m")).isFalse();
  assertThat(AnalysisSafety.reusable(input,input,created,created.minusSeconds(1),"m","m")).isFalse();
  assertThat(AnalysisSafety.reusable(input,input,created,created,"m","other")).isFalse();
  assertThat(AnalysisSafety.TIMEOUT_SECONDS).isEqualTo(60);assertThat(AnalysisSafety.RETRIES).isEqualTo(1);
 }
}
