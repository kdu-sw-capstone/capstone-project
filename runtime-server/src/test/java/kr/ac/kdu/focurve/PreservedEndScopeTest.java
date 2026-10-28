package kr.ac.kdu.focurve;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.*;
import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.nio.file.*;
import java.time.*;
import java.security.MessageDigest;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

class PreservedEndScopeTest {
 @TempDir Path temp;ObjectMapper json=new ObjectMapper();
 final String install="a".repeat(32),ex=UUID.randomUUID().toString(),sid=UUID.randomUUID().toString(),snapshot=UUID.randomUUID().toString(),origin="https://localhost:30179",callback="chrome-extension://"+"b".repeat(32)+"/popup/popup.html";
 Path grant,marker;ObjectNode scope,state;MemberAuth a;MemberExecution e;boolean ended=false,foreignLock=false,pendingReceipt=false,otherSession=false;String database="";int reconciliationCalls=0,reports=0;
 @BeforeEach void prepare()throws Exception{
  Path root=Files.createDirectory(temp.resolve(install));marker=Files.writeString(root.resolve("admission.closed"),"");grant=root.resolve("preserved-end-grant.json");
  scope=json.createObjectNode().put("contract","FOCURVE_PRESERVED_END_SCOPE_1").put("installation_id",install).put("extension_id","b".repeat(32)).put("profile_instance","c".repeat(32)).put("operation_id","d".repeat(32)).put("executor_id",ex).put("owner_user_id","1").put("session_id",sid).put("policy_snapshot_id",snapshot).put("base_revision",1).put("origin",origin).put("callback",callback).put("not_before",Instant.now().minusSeconds(2).toString()).put("not_after",Instant.now().plusSeconds(600).toString());
  var db=new JdbcTemplate(){@Override public <T>T queryForObject(String sql,Class<T> type){return type.cast(database.isBlank()?"focurve_user_"+install:database);}};
  a=new MemberAuth(db,json,origin,Base64.getEncoder().encodeToString(new byte[32]),callback){@Override Map<String,Object> one(String sql,Object...args){
   if(sql.contains("extension_installations"))return Map.of("id",ex,"current_user_id",1L,"proof_hash",MemberAuth.hash("proof"));
   if(sql.contains("active_execution_locks"))return ended?null:Map.of("executor_id",foreignLock?UUID.randomUUID().toString():ex,"session_id",4L,"revision",1L);
   if(sql.contains("event_receipts"))return pendingReceipt?Map.of("event_id","other"):null;
   if(sql.contains("focus_sessions"))return otherSession?Map.of("id",5L):null;return null;
  }};
  a.preservedEndGrant=grant.toString();a.recoveryGate=marker.toString();saveScope();
  state=json.createObjectNode().put("session_id",sid).put("owner_user_id","1").put("executor_id",ex).put("policy_snapshot_id",snapshot).put("execution_status","UNKNOWN").put("desired_revision",1);
  e=new MemberExecution(a,json){@Override void ownerLock(MemberAuth.Identity i){} @Override long internal(String s){return 4L;} @Override ObjectNode session(String s,MemberAuth.Identity i){return state;}
   @Override ObjectNode reconcile(MemberAuth.Identity i,String executor,JsonNode b){reconciliationCalls++;ended=true;state.put("execution_status","ENDED").put("desired_revision",2).put("policy_released_at",Instant.now().toString());return a.obj("desired_state","RELEASED");}
   @Override ObjectNode report(MemberAuth.Identity i,String executor,JsonNode b,String raw){reports++;assertThat(ended).isTrue();assertThat(raw).isEqualTo(b.toString());return a.obj("result","ACCEPTED","desired_revision",2);}
  };
 }
 void saveScope()throws Exception{Files.writeString(grant,scope.toString());a.preservedEndSHA=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(grant)));}
 ObjectNode call(String method,String p,JsonNode body){var req=new MockHttpServletRequest(method,"/api/v1"+p);req.addHeader("X-Installation-Id",ex);req.addHeader("X-Installation-Proof","proof");return PreservedEndScope.route(a,e,req,p,method,body,body.toString());}
 ObjectNode action(){ObjectNode b=json.createObjectNode();b.putObject("journal_summary").put("session_id",sid);var action=b.putArray("local_actions").addObject().put("type","END").put("session_id",sid).put("policy_snapshot_id",snapshot).put("base_revision",1);action.putObject("report").put("observed_at",Instant.now().toString());return b;}
 @Test void expiredMemberNeedsNoTokenMintButOnlyExactOwnerProofAndClosedBoundScope(){var ready=call("GET","/install/preserved-end",json.createObjectNode());assertThat(ready.path("focus_allowed").asBoolean(true)).isFalse();assertThat(ready.path("server_ended").asBoolean()).isFalse();assertThat(ready.toString()).doesNotContain("token","proof");}
 @Test void refusesStartEndLoginRefreshAndOtherSession(){for(String p:List.of("/sessions","/sessions/"+sid+"/end","/extension-tokens/refresh","/auth/login","/sites"))assertThatThrownBy(()->call("POST",p,json.createObjectNode())).hasMessage("PRESERVED_END_ONLY");assertThatThrownBy(()->call("GET","/sessions/"+UUID.randomUUID(),json.createObjectNode())).hasMessage("PRESERVED_END_ONLY");}
 @Test void staleReportsCannotResumeUnknownAndAreDeliveredOnlyAfterExistingReconcile(){ObjectNode report=json.createObjectNode().put("session_id",sid).put("executor_id",ex).put("desired_revision",1).put("observed_at",Instant.now().minusSeconds(10).toString());assertThatThrownBy(()->call("POST","/executors/"+ex+"/reports",report)).hasMessage("PRESERVED_END_REPORT_MISMATCH");call("POST","/executors/"+ex+"/reconcile",action());for(int n=0;n<50;n++)call("POST","/executors/"+ex+"/reports",report);assertThat(reports).isEqualTo(50);assertThat(reconciliationCalls).isEqualTo(1);assertThat(call("GET","/install/preserved-end",json.createObjectNode()).path("lock_released").asBoolean()).isTrue();}
 @Test void aFreshTerminationGrantCanReconcileAnOlderImmutableLocalEndWithoutRepeatingEnd(){ObjectNode b=action();((ObjectNode)b.path("local_actions").get(0).path("report")).put("observed_at",Instant.now().minusSeconds(600).toString());call("POST","/executors/"+ex+"/reconcile",b);assertThat(reconciliationCalls).isEqualTo(1);}
 @Test void aFutureLocalEndObservationCannotBeImportedByTheTerminationGrant(){ObjectNode b=action();((ObjectNode)b.path("local_actions").get(0).path("report")).put("observed_at",Instant.now().plusSeconds(600).toString());assertThatThrownBy(()->call("POST","/executors/"+ex+"/reconcile",b)).hasMessage("PRESERVED_END_ACTION_MISMATCH");assertThat(reconciliationCalls).isZero();}
 @Test void wrongSessionSnapshotOrOwnerCannotInvokeExistingReconcile(){for(String field:List.of("session_id","policy_snapshot_id")){ObjectNode b=action();((ObjectNode)b.path("local_actions").get(0)).put(field,UUID.randomUUID().toString());assertThatThrownBy(()->call("POST","/executors/"+ex+"/reconcile",b)).hasMessage("PRESERVED_END_ACTION_MISMATCH");}state.put("owner_user_id","2");assertThatThrownBy(()->call("GET","/install/preserved-end",json.createObjectNode())).hasMessage("PRESERVED_END_SESSION_MISMATCH");assertThat(reconciliationCalls).isZero();}
 @Test void lockForeignDatabasePendingReceiptAndOtherSessionReject(){foreignLock=true;assertThatThrownBy(()->call("GET","/install/preserved-end",json.createObjectNode())).hasMessage("PRESERVED_END_LOCK_MISMATCH");foreignLock=false;database="operating";assertThatThrownBy(()->call("GET","/install/preserved-end",json.createObjectNode())).hasMessage("PRESERVED_END_DATABASE_MISMATCH");database="";pendingReceipt=true;assertThatThrownBy(()->call("GET","/install/preserved-end",json.createObjectNode())).hasMessage("PRESERVED_END_OTHER_OBLIGATIONS");pendingReceipt=false;otherSession=true;assertThatThrownBy(()->call("GET","/install/preserved-end",json.createObjectNode())).hasMessage("PRESERVED_END_OTHER_OBLIGATIONS");}
 @Test void hashChangedExpiredOrOverlongScopeFailsClosed()throws Exception{Files.writeString(grant,"{}");assertThatThrownBy(()->PreservedEndScope.read(a,Instant.now())).hasMessage("PRESERVED_END_SCOPE_CHANGED");scope.put("not_after",Instant.now().minusSeconds(1).toString());saveScope();assertThatThrownBy(()->PreservedEndScope.read(a,Instant.now())).hasMessage("PRESERVED_END_SCOPE_EXPIRED");scope.put("not_after",Instant.now().plusSeconds(1300).toString());saveScope();assertThatThrownBy(()->PreservedEndScope.read(a,Instant.now())).hasMessage("PRESERVED_END_SCOPE_EXPIRED");}
 @Test void missingInstallationProofOrOpenAdmissionMarkerRejects()throws Exception{var req=new MockHttpServletRequest("GET","/api/v1/install/preserved-end");req.addHeader("X-Installation-Id",ex);assertThatThrownBy(()->PreservedEndScope.route(a,e,req,"/install/preserved-end","GET",json.createObjectNode(),"{}")).hasMessage("INVALID_INSTALLATION");Files.delete(marker);assertThatThrownBy(()->PreservedEndScope.read(a,Instant.now())).hasMessage("PRESERVED_END_SCOPE_INVALID");}
 @Test void existingReconcileIsIdempotentAndOnlyVerifiedRestorationReleasesLock(){
  Map<String,String> stored=new HashMap<>();int[] deletes={0},inserts={0};String commandId=UUID.randomUUID().toString();
  var db=new JdbcTemplate(){@Override public int update(String sql,Object...args){if(sql.startsWith("INSERT INTO local_execution_actions")){stored.put(args[0].toString(),args[2].toString());inserts[0]++;}if(sql.startsWith("DELETE FROM active_execution_locks"))deletes[0]++;return 1;}};
  ObjectNode command=json.createObjectNode().put("type","APPLY_POLICY").put("executor_id",ex).put("desired_revision",1);
  var auth=new MemberAuth(db,json,origin,Base64.getEncoder().encodeToString(new byte[32]),callback){@Override Map<String,Object> one(String sql,Object...args){
   if(sql.contains("extension_installations"))return Map.of("id",ex);
   if(sql.contains("execution_commands"))return Map.of("payload",command.toString());
   if(sql.contains("local_execution_actions WHERE id="))return stored.containsKey(args[0].toString())?Map.of("payload_hash",stored.get(args[0].toString())):null;
   if(sql.contains("local_execution_actions WHERE session_id="))return stored.isEmpty()?null:Map.of("id",stored.keySet().iterator().next());return null;
  }};
  var execution=new MemberExecution(auth,json){@Override ObjectNode session(String s,MemberAuth.Identity i){return state;}@Override long internal(String id){return 4L;}@Override void intervals(long sid,ObjectNode s,JsonNode r){}@Override void insertReport(long sid,JsonNode r,String raw){}@Override boolean recordGap(long sid){return false;}@Override void save(ObjectNode s){}};
  ObjectNode b=action(),action=(ObjectNode)b.path("local_actions").get(0);action.put("action_id",UUID.randomUUID().toString()).put("local_action_seq",1).put("original_command_id",commandId).put("restoration_digest","e".repeat(64));
  action.putObject("report").put("report_id",UUID.randomUUID().toString()).putNull("command_id").put("session_id",sid).put("executor_id",ex).put("desired_revision",1).put("result","RELEASED").put("observed_at",Instant.now().toString()).put("rollback_confirmed",true).putArray("intervals");
  b.withObject("journal_summary").put("observed_state","RELEASED");var identity=new MemberAuth.Identity(1L,ex);
  execution.reconcile(identity,ex,b);execution.reconcile(identity,ex,b);assertThat(deletes[0]).isEqualTo(1);assertThat(inserts[0]).isEqualTo(1);assertThat(state.path("execution_status").asText()).isEqualTo("ENDED");assertThat(state.path("desired_revision").asLong()).isEqualTo(2);
  action.put("restoration_digest","f".repeat(64));assertThatThrownBy(()->execution.reconcile(identity,ex,b)).hasMessage("RECONCILE_REQUIRED");assertThat(deletes[0]).isEqualTo(1);
 }
 @Test void existingReportContractCannotOverwriteTerminalRevisionWithHistoricalPositiveOrNegativeReports(){
  state.put("execution_status","ENDED").put("desired_revision",2).put("policy_released_at",Instant.now().toString());
  ObjectNode command=json.createObjectNode().put("type","APPLY_POLICY").put("executor_id",ex).put("desired_revision",1);command.putObject("snapshot").put("policy_snapshot_id",snapshot).put("owner_user_id","1");Map<String,String> stored=new HashMap<>();
  var auth=new MemberAuth(new JdbcTemplate(),json,origin,Base64.getEncoder().encodeToString(new byte[32]),callback){@Override Map<String,Object> one(String sql,Object...args){if(sql.contains("extension_installations"))return Map.of("id",ex);if(sql.contains("execution_commands"))return Map.of("payload",command.toString());if(sql.contains("execution_reports WHERE id="))return stored.containsKey(args[0].toString())?Map.of("payload_hash",stored.get(args[0].toString())):null;return null;}};
  var execution=new MemberExecution(auth,json){@Override ObjectNode session(String id,MemberAuth.Identity i){return state;}@Override long internal(String id){return 4L;}@Override void insertReport(long sid,JsonNode r,String raw){stored.put(r.path("report_id").asText(),MemberAuth.hash(raw));}@Override void save(ObjectNode s){throw new AssertionError("historical report must not rewrite session");}};
  for(String result:List.of("APPLIED","UNCONFIRMED","FAILED")){ObjectNode r=json.createObjectNode().put("report_id",UUID.randomUUID().toString()).put("command_id",UUID.randomUUID().toString()).put("session_id",sid).put("executor_id",ex).put("desired_revision",1).put("result",result).put("observed_at",Instant.now().minusSeconds(10).toString());r.putArray("intervals");if(!result.equals("APPLIED"))r.put("error_code","UNAUTHORIZED_SENDER");
   assertThat(execution.report(new MemberAuth.Identity(1,ex),ex,r,r.toString()).path("result").asText()).isEqualTo("ACCEPTED");assertThat(execution.report(new MemberAuth.Identity(1,ex),ex,r,r.toString()).path("result").asText()).isEqualTo("DUPLICATE");assertThat(state.path("execution_status").asText()).isEqualTo("ENDED");
  }
 }
}
