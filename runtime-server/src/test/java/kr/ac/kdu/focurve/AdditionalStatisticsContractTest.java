package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

/** Checks the existing Statistics DTO; no runtime producer or clock authority is issued here. */
class AdditionalStatisticsContractTest {
 final ObjectMapper json=new ObjectMapper();
 final AdditionalConfigContract contract=new AdditionalConfigContract(json);
 ObjectNode example()throws Exception {
  try(var in=getClass().getResourceAsStream("/amvp/rc2/examples.json")) {
   return (ObjectNode)json.readTree(in).path("definitions").path("Statistics").deepCopy();
  }
 }
 @Test void validObservationTimePreservesNullUnknownMeasurements()throws Exception {
  var value=example();value.put("quality","UNKNOWN");value.put("as_of","2026-10-29T00:00:00.123Z");
  contract.validate("Statistics",value);
  assertThat(value.path("browser_ms").isNull()).isTrue();assertThat(value.path("focus_ms").isNull()).isTrue();
 }
 @Test void missingMalformedAndNonCanonicalObservationTimesAreRejected()throws Exception {
  var missing=example();missing.remove("as_of");assertThatThrownBy(()->contract.validate("Statistics",missing)).hasMessage("VALIDATION_FAILED");
  for(String time:new String[]{"","invalid","2026-02-30T00:00:00.000Z","2026-10-29T00:00:00Z","2026-10-29T09:00:00.000+09:00"}) {
   var value=example();value.put("as_of",time);assertThatThrownBy(()->contract.validate("Statistics",value)).hasMessage("VALIDATION_FAILED");
  }
  for(var invalid:new com.fasterxml.jackson.databind.JsonNode[]{json.nullNode(),json.valueToTree(123)}) {
   var value=example();value.set("as_of",invalid);assertThatThrownBy(()->contract.validate("Statistics",value)).hasMessage("VALIDATION_FAILED");
  }
 }
}
