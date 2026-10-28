package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

/** Actual report branches with an isolated repository stub; no service or DB starts. */
class ReportConfirmationTest {
 final ObjectMapper json=new ObjectMapper();
 final String ex="11111111-1111-4111-8111-111111111111",sid="22222222-2222-4222-8222-222222222222",cmd="33333333-3333-4333-8333-333333333333",tid="44444444-4444-4444-8444-444444444444",snapshot="55555555-5555-4555-8555-555555555555";
 class Harness {
  final long now=System.currentTimeMillis(),start=now-500;
  Map<String,Object> old;boolean newer;int inserted,saved;
  final ObjectNode state=json.createObjectNode().put("session_id",sid).put("owner_user_id","1").put("executor_id",ex).put("policy_snapshot_id",snapshot).put("desired_revision",1).put("execution_status","NATIVE_VERIFYING").put("native_transition_contract","NR01_1").put("time_accounting_mode","MEMBER_A1_CONFIRMED_1").put("started_at",Instant.ofEpochMilli(start-1000).toString());
  final ObjectNode command=json.createObjectNode().put("command_id",cmd).put("executor_id",ex).put("desired_revision",1).put("type","APPLY_POLICY").put("native_transition_contract","NR01_1").put("execute_before",Instant.ofEpochMilli(now+60000).toString());
  final MemberAuth auth=new MemberAuth(new JdbcTemplate(){@Override public int update(String sql,Object...args){return 1;}},json,"https://localhost:30175",Base64.getEncoder().encodeToString(new byte[32]),"chrome-extension://"+"a".repeat(32)+"/popup/popup.html"){
   @Override Map<String,Object> one(String sql,Object...args){
    if(sql.contains("execution_commands"))return Map.of("payload",command.toString());
    if(sql.contains("execution_reports WHERE id="))return old;
    if(sql.contains("observed_at>"))return newer?Map.of("id","newer"):null;
    return null;
   }
  };
  final MemberExecution execution=new MemberExecution(auth,json){
   @Override void executor(MemberAuth.Identity i,String e){}
   @Override void ownerLock(MemberAuth.Identity i){}
   @Override ObjectNode session(String id,MemberAuth.Identity i){return state;}
   @Override long internal(String id){return 1;}
   @Override void intervals(long id,ObjectNode s,JsonNode r){}
   @Override void save(ObjectNode s){saved++;}
   @Override void insertReport(long id,JsonNode r,String raw){inserted++;old=Map.of("payload_hash",MemberAuth.hash(raw));}
  };
  Harness(){command.set("snapshot",json.createObjectNode().put("policy_snapshot_id",snapshot).put("owner_user_id","1"));state.set("native_transition",transition("VERIFYING"));}
  ObjectNode transition(String phase){return json.createObjectNode().put("version","NR01_1").put("transition_id",tid).put("root_generation",2).put("phase",phase).put("started_at",Instant.ofEpochMilli(start).toString()).put("deadline_at",Instant.ofEpochMilli(start+5000).toString()).put("root_evidence_sha256","a".repeat(64));}
  ObjectNode report(){ObjectNode r=json.createObjectNode().put("report_id",UUID.randomUUID().toString()).put("command_id",cmd).put("session_id",sid).put("executor_id",ex).put("desired_revision",1).put("result","APPLIED").put("observed_at",Instant.ofEpochMilli(now).toString());r.set("intervals",json.createArrayNode());r.set("transition_context",transition("CONFIRMED"));return r;}
  ObjectNode send(ObjectNode r){return execution.report(new MemberAuth.Identity(1L,ex),ex,r,r.toString());}
 }
 @Test void acceptedReportReturnsSameTransactionStateWithoutSecretsOrMutableAliases(){
  var h=new Harness();h.state.put("credential","PRIVATE_SENTINEL");var r=h.report();var ack=h.send(r);var c=ack.path("execution_confirmation");
  assertThat(ack.path("result").asText()).isEqualTo("ACCEPTED");assertThat(c.path("report_id").asText()).isEqualTo(r.path("report_id").asText());
  assertThat(c.path("command_id").asText()).isEqualTo(cmd);assertThat(c.path("state").path("execution_status").asText()).isEqualTo("RUNNING");
  assertThat(c.path("state").path("native_transition").path("root_generation").asInt()).isEqualTo(2);
  assertThat(ack.toString()).doesNotContain("PRIVATE_SENTINEL","root_evidence_sha256");
  h.state.put("execution_status","UNKNOWN");assertThat(c.path("state").path("execution_status").asText()).isEqualTo("RUNNING");
 }
 @Test void duplicateDoesNotReapplyAndReturnsCurrentUnknownInsteadOfOldRunning(){
  var h=new Harness();var r=h.report();h.send(r);h.state.put("execution_status","UNKNOWN");h.state.set("first_nr_failure",json.createObjectNode().put("code","ROOT_UNCONFIRMED"));
  var ack=h.send(r);assertThat(ack.path("result").asText()).isEqualTo("DUPLICATE");assertThat(h.inserted).isEqualTo(1);assertThat(h.saved).isEqualTo(1);
  assertThat(ack.path("execution_confirmation").path("state").path("execution_status").asText()).isEqualTo("UNKNOWN");
 }
 @Test void duplicateWithDifferentPayloadIsStillRejected(){
  var h=new Harness();var r=h.report();h.send(r);
  assertThatThrownBy(()->h.execution.report(new MemberAuth.Identity(1L,ex),ex,r,r+" ")).hasMessage("REPORT_CONFLICT");
 }
 @Test void lateAppliedReportCannotClearStickyFailure(){
  var h=new Harness();h.state.put("execution_status","UNKNOWN");h.state.set("first_nr_failure",json.createObjectNode().put("code","ROOT_UNCONFIRMED"));
  var ack=h.send(h.report());assertThat(ack.path("execution_confirmation").path("state").path("execution_status").asText()).isEqualTo("UNKNOWN");
  assertThat(h.state.path("first_nr_failure").path("code").asText()).isEqualTo("ROOT_UNCONFIRMED");
 }
 @Test void olderObservedReportDoesNotReplaceANewerTransition(){
  var h=new Harness();h.newer=true;var before=h.state.deepCopy();h.send(h.report());assertThat(h.state).isEqualTo(before);assertThat(h.saved).isZero();
 }
 @Test void executorMismatchCannotObtainConfirmation(){
  var h=new Harness();var r=h.report();r.put("executor_id","66666666-6666-4666-8666-666666666666");
  assertThatThrownBy(()->h.send(r)).hasMessage("REPORT_CONFLICT");assertThat(h.inserted).isZero();
 }
}
