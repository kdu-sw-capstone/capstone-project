package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class NativeFailureTimelineTest {
 final ObjectMapper json=new ObjectMapper();
 final String transition="11111111-1111-4111-8111-111111111111";
 final long start=Instant.parse("2026-10-27T07:44:30.130Z").toEpochMilli();
 ObjectNode session(){return json.createObjectNode().put("execution_status","RUNNING").put("native_transition_contract","NR01_1").put("started_at","2026-10-27T07:43:52.994Z");}
 ObjectNode command(){return json.createObjectNode().put("native_transition_contract","NR01_1").put("execute_before","2026-10-27T07:44:52.000Z");}
 ObjectNode report(String result,String phase){
  ObjectNode r=json.createObjectNode().put("result",result),n=r.putObject("transition_context");
  n.put("version","NR01_1").put("transition_id",transition).put("root_generation",2).put("phase",phase)
   .put("started_at",Instant.ofEpochMilli(start).toString()).put("deadline_at",Instant.ofEpochMilli(start+5000).toString()).put("root_evidence_sha256","a".repeat(64));
  return r;
 }
 @Test void clientNegativeReportAfterConfirmationProducesRootUnconfirmedRatherThanServerTimeout(){
  ObjectNode s=session(),c=command();
  assertThat(NativeTransition.accept(s,c,report("REVALIDATING","VERIFYING"),start+22)).isTrue();
  assertThat(NativeTransition.accept(s,c,report("APPLIED","CONFIRMED"),start+4990)).isTrue();s.put("execution_status","RUNNING");
  assertThat(NativeTransition.expire(s,start+6000)).isFalse();
  assertThat(NativeTransition.accept(s,c,report("UNCONFIRMED","FAILED"),start+7021)).isTrue();
  assertThat(s.path("execution_status").asText()).isEqualTo("UNKNOWN");
  assertThat(s.path("first_nr_failure").path("code").asText()).isEqualTo("ROOT_UNCONFIRMED");
  ObjectNode first=(ObjectNode)s.path("first_nr_failure").deepCopy();
  assertThat(NativeTransition.accept(s,c,report("APPLIED","CONFIRMED"),start+8000)).isFalse();
  assertThat(s.path("first_nr_failure")).isEqualTo(first);
 }
 @Test void absentConfirmationExpiresWithADifferentServerDeadlineCode(){
  ObjectNode s=session();NativeTransition.accept(s,command(),report("REVALIDATING","VERIFYING"),start+22);
  assertThat(NativeTransition.expire(s,start+5000)).isTrue();
  assertThat(s.path("first_nr_failure").path("code").asText()).isEqualTo("SERVER_DEADLINE");
 }
 @Test void mismatchedTransitionIdentityCannotConfirmThePendingRoot(){
  ObjectNode s=session();NativeTransition.accept(s,command(),report("REVALIDATING","VERIFYING"),start+22);
  ObjectNode wrong=report("APPLIED","CONFIRMED");((ObjectNode)wrong.path("transition_context")).put("transition_id","22222222-2222-4222-8222-222222222222");
  assertThatThrownBy(()->NativeTransition.accept(s,command(),wrong,start+1000)).hasMessage("NR_TRANSITION_CONFLICT");
  assertThat(s.path("execution_status").asText()).isEqualTo("NATIVE_VERIFYING");
  assertThat(s.hasNonNull("first_nr_failure")).isFalse();
 }
 @Test void duplicateConfirmationAfterConfirmationDoesNotRenewOrInvalidateTheRoot(){
  ObjectNode s=session(),c=command(),r=report("APPLIED","CONFIRMED");
  NativeTransition.accept(s,c,report("REVALIDATING","VERIFYING"),start+10);
  assertThat(NativeTransition.accept(s,c,r,start+100)).isTrue();s.put("execution_status","RUNNING");
  var before=s.deepCopy();assertThat(NativeTransition.accept(s,c,r,start+6000)).isTrue();
  assertThat(s).isEqualTo(before);assertThat(s.hasNonNull("first_nr_failure")).isFalse();
 }
 @Test void olderGenerationCannotReplaceANewerConfirmedTransition(){
  ObjectNode s=session(),c=command();NativeTransition.accept(s,c,report("REVALIDATING","VERIFYING"),start+10);
  NativeTransition.accept(s,c,report("APPLIED","CONFIRMED"),start+100);s.put("execution_status","RUNNING");
  ObjectNode next=report("REVALIDATING","VERIFYING");((ObjectNode)next.path("transition_context")).put("root_generation",3).put("transition_id","33333333-3333-4333-8333-333333333333");
  assertThat(NativeTransition.accept(s,c,next,start+200)).isTrue();var before=s.deepCopy();
  assertThatThrownBy(()->NativeTransition.accept(s,c,report("UNCONFIRMED","FAILED"),start+250)).hasMessage("NR_TRANSITION_CONFLICT");
  assertThat(s).isEqualTo(before);
 }
}
