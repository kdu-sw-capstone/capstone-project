package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.assertj.core.api.Assertions.*;

class AdditionalConfigContractTest {
 final ObjectMapper json=new ObjectMapper();
 final AdditionalConfigContract contract=new AdditionalConfigContract(json);
 ObjectNode example(String name)throws Exception {
  try(var in=getClass().getResourceAsStream("/amvp/rc2/examples.json")){return (ObjectNode)json.readTree(in).path("definitions").path(name).deepCopy();}
 }
 @Test void allFourStoredKindsConsumeUnmodifiedRc2Examples()throws Exception {
  for(String name:List.of("CadenceConfig","ContentConfig","SiteTimePolicy","FocusSchedule")) {
   var value=example(name);contract.validate("ConfigValue",value);
  }
 }
 @Test void strictTypesUnknownFieldsAndSafeIntegers()throws Exception {
  for(JsonNode bad:List.of(json.readTree("true"),json.readTree("\"2\""),json.readTree("1.1"),json.readTree("0"),json.readTree("181"))) {
   var value=example("CadenceConfig");value.set("focus_minutes",bad);assertThatThrownBy(()->contract.validate("ConfigValue",value)).isInstanceOf(MemberAuth.Failure.class);
  }
  var value=example("CadenceConfig");value.put("user_id",2);assertThatThrownBy(()->contract.validate("ConfigValue",value)).hasMessage("VALIDATION_FAILED");
 }
 @Test void sameFeatureIdCannotBeSavedTwiceWithDifferentBoolean()throws Exception {
  var value=example("ContentConfig");var features=json.createArrayNode();features.add(json.readTree("{\"feature_id\":\"YT-02\",\"enabled\":true,\"required\":true}"));features.add(json.readTree("{\"feature_id\":\"YT-02\",\"enabled\":false,\"required\":true}"));value.set("features",features);
  assertThatThrownBy(()->contract.validate("ConfigValue",value)).hasMessage("VALIDATION_FAILED");
 }
 @Test void timezoneCannotPassAsAnUncheckedCustomFormat()throws Exception {
  var value=example("FocusSchedule");var when=json.createObjectNode().put("recurrence","WEEKLY").put("start_local","09:00").put("timezone","Mars/City").put("dst_gap","SKIP").put("dst_overlap","EARLIER_ONCE");when.set("weekdays",json.createArrayNode().add(1));value.set("when",when);
  assertThatThrownBy(()->contract.validate("ConfigValue",value)).hasMessage("INVALID_TIMEZONE");
  when.put("timezone","Asia/Seoul");contract.validate("ConfigValue",value);
 }
 @Test void missingAndStalePreconditionsDoNotBecomeCreates() {
  assertThatThrownBy(()->AdditionalConfigContract.precondition(null,null,null)).hasMessage("PRECONDITION_REQUIRED");
  assertThatThrownBy(()->AdditionalConfigContract.precondition("\"1\"",null,null)).hasMessage("VERSION_CONFLICT");
  assertThatThrownBy(()->AdditionalConfigContract.precondition(null,"*",1L)).hasMessage("VERSION_CONFLICT");
  assertThatThrownBy(()->AdditionalConfigContract.precondition("\"1\"",null,2L)).hasMessage("VERSION_CONFLICT");
  AdditionalConfigContract.precondition(null,"*",null);AdditionalConfigContract.precondition("\"2\"",null,2L);
 }
 @Test void canonicalObjectOrderIsStableButArrayOrderIsPreserved()throws Exception {
  assertThat(AdditionalConfigContract.canonical(json.readTree("{\"z\":1,\"a\":{\"c\":2,\"b\":3}}"))).isEqualTo(AdditionalConfigContract.canonical(json.readTree("{\"a\":{\"b\":3,\"c\":2},\"z\":1}")));
  assertThat(AdditionalConfigContract.canonical(json.readTree("[1,2]"))).isNotEqualTo(AdditionalConfigContract.canonical(json.readTree("[2,1]")));
  assertThatThrownBy(()->AdditionalConfigContract.next(AdditionalConfigContract.MAX_VERSION)).hasMessage("VERSION_LIMIT");
 }
}
