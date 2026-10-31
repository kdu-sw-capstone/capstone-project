package kr.ac.kdu.focurve;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import static kr.ac.kdu.focurve.MemberAuth.*;
import static org.assertj.core.api.Assertions.*;

/** Fresh MySQL + authenticated MockMvc and loopback TCP. Effect producer remains SYNTHETIC. */
@EnabledIfEnvironmentVariable(named="FOCURVE_AMVP_TEST_URL",matches="jdbc:mysql://127\\.0\\.0\\.1:[0-9]+/amvp_test_[a-f0-9]+.*")
@EnabledIfEnvironmentVariable(named="FOCURVE_AMVP_RECEIPT_TESTS",matches="1")
@EnabledIfEnvironmentVariable(named="FOCURVE_AMVP_RELEASE_TESTS",matches="1")
@EnabledIfEnvironmentVariable(named="FOCURVE_AMVP_DELETION_HISTORY_TESTS",matches="1")
class AmvpDeletionHistoryMysqlTest extends AmvpReleaseMysqlTest {
 @Test void operationQueryRequiresActualReleaseAndNeverRewritesTheOriginalAck()throws Exception{
  var h=helper.fixture();String operation=h.configs().delete(h.fixture().identity(),h.policy().path("policy_id").asText(),"\"1\"",id()).path("operation_id").asText();String original=helper.base.auth.one("SELECT response_json FROM amvp_operations WHERE operation_id=?",operation).get("response_json").toString();
  assertThat(h.configs().operation(h.fixture().identity(),operation).path("state").asText()).isEqualTo("RELEASE_PENDING");
  assertThat(h.configs().operation(h.fixture().identity(),operation).path("actual_effect_confirmed").asBoolean()).isFalse();
  send(h,report(h,1,"UNKNOWN"));assertThat(h.configs().operation(h.fixture().identity(),operation).path("state").asText()).isEqualTo("IN_DOUBT");
  send(h,report(h,2,"RELEASED"));String before=fingerprint(h);var current=h.configs().operation(h.fixture().identity(),operation);
  assertThat(current.path("state").asText()).isEqualTo("CONFIRMED");assertThat(current.path("actual_effect_confirmed").asBoolean()).isTrue();assertThat(fingerprint(h)).isEqualTo(before);
  assertThat(helper.base.auth.one("SELECT response_json FROM amvp_operations WHERE operation_id=?",operation).get("response_json").toString()).isEqualTo(original);
  helper.base.db.update("UPDATE amvp_operations SET response_json=NULL WHERE operation_id=?",operation);
  assertThat(h.configs().operation(h.fixture().identity(),operation).path("actual_effect_confirmed").asBoolean()).isTrue();assertThat(helper.base.auth.one("SELECT response_json FROM amvp_operations WHERE operation_id=?",operation).get("response_json")).isNull();
 }
 @Test void operationLookupKeepsOwnerBindingAndOtherStreamBoundaries()throws Exception{
  var h=helper.fixture();String operation=h.configs().delete(h.fixture().identity(),h.policy().path("policy_id").asText(),"\"1\"",id()).path("operation_id").asText();var other=helper.fixture();
  assertThatThrownBy(()->h.configs().operation(other.fixture().identity(),operation)).hasMessage("RESOURCE_NOT_FOUND");
  assertThatThrownBy(()->h.configs().operation(new Identity(h.fixture().identity().user(),other.fixture().executor()),operation)).hasMessage("RESOURCE_NOT_FOUND");
  assertThatThrownBy(()->h.configs().operation(h.fixture().identity(),id())).hasMessage("RESOURCE_NOT_FOUND");
  var report=report(h,1,"UNKNOWN");send(h,report);assertThatThrownBy(()->h.configs().operation(h.fixture().identity(),report.path("report_id").asText())).hasMessage("UNSUPPORTED_CONTRACT");
  helper.base.db.update("UPDATE amvp_owner_bindings SET state='CLOSED',closed_at=UTC_TIMESTAMP(3) WHERE binding_id=?",h.fixture().binding());
  helper.base.db.update("INSERT INTO amvp_owner_bindings VALUES(?,?,?,2,'ACTIVE',UTC_TIMESTAMP(3),NULL)",id(),h.fixture().executor(),h.fixture().identity().user());
  assertThatThrownBy(()->h.configs().operation(h.fixture().identity(),operation)).hasMessage("RESOURCE_NOT_FOUND");
 }
 @Test void malformedReceiptCannotBeConfirmedByAnOperationQuery()throws Exception{
  var h=helper.fixture();String operation=h.configs().delete(h.fixture().identity(),h.policy().path("policy_id").asText(),"\"1\"",id()).path("operation_id").asText();
  helper.base.db.update("UPDATE amvp_operations SET request_sha256=? WHERE operation_id=?","0".repeat(64),operation);assertThatThrownBy(()->h.configs().operation(h.fixture().identity(),operation)).hasMessage("STORE_UNCONFIRMED");
 }
 @Test void realLoopbackHttpReplaysLostDeleteAndPreservesEvidenceAcrossDatabaseReconnection()throws Exception{
  var h=helper.fixture();var a=helper.base.auth;String policy=h.policy().path("policy_id").asText();
  String token=new org.springframework.transaction.support.TransactionTemplate(helper.base.manager).execute(tx->a.mint(h.fixture().executor(),h.fixture().identity().user(),id(),1)).path("access_token").asText();
  var source=helper.source(h.selection());
  String historyPath="/api/v1/amvp/web/site-time-deletions?executor_id="+h.fixture().executor();
  var clock=(AmvpUsageReceiver.ClockProof)(principal,binding,item,previous)->new AmvpUsageReceiver.VerifiedCapture(true,java.util.Map.of(policy,0L));
  try(var http=new AmvpLoopbackHttp(a,helper.base.manager,h.publisher(),source,proof(h),clock)){
   assertThat(http.send("GET",historyPath,null,null).statusCode()).isEqualTo(401);
   assertThat(http.send("GET",historyPath+"&include_deleted=true",token,null).statusCode()).isEqualTo(400);
   var update=http.send("PUT","/api/v1/amvp/configs/"+policy,token,a.obj("executor_id",h.fixture().executor(),"value",h.policy()).toString(),"If-Match","\"1\"","Idempotency-Key",id());
   assertThat(update.statusCode()).isEqualTo(200);assertThat(a.json.readTree(update.body()).path("version").asInt()).isEqualTo(2);
   var current=http.send("GET","/api/v1/amvp/runtime-packages/current?executor_id="+h.fixture().executor(),token,null);
   assertThat(current.statusCode()).isEqualTo(200);assertThat(a.json.readTree(current.body()).path("runtime_revision").asInt()).isEqualTo(2);
   var applied=http.send("POST","/api/v1/amvp/reports/batch",token,body(h,report(h,1,"APPLIED")).toString());
   assertThat(applied.statusCode()).isEqualTo(200);assertThat(a.json.readTree(applied.body()).path("items").get(0).path("status").asText()).isEqualTo("ACCEPTED");
   var segment=helper.segment(h,1,null);((com.fasterxml.jackson.databind.node.ObjectNode)segment.path("policy_attributions").get(0)).put("policy_version",2);AmvpBridgeSupport.seal(segment);
   var usage=http.send("POST","/api/v1/amvp/usage/batch",token,helper.batch(h,segment).toString());
   assertThat(usage.statusCode()).isEqualTo(200);assertThat(a.json.readTree(usage.body()).path("items").get(0).path("measurement_state").asText()).isEqualTo("COUNTED");
   var unanchored=helper.segment(h,2,segment);((com.fasterxml.jackson.databind.node.ObjectNode)unanchored.path("policy_attributions").get(0)).put("policy_version",2);((com.fasterxml.jackson.databind.node.ObjectNode)unanchored.path("clock")).put("anchor_id",id());AmvpBridgeSupport.seal(unanchored);
   var quarantine=http.send("POST","/api/v1/amvp/usage/batch",token,helper.batch(h,unanchored).toString());
   assertThat(quarantine.statusCode()).isEqualTo(200);assertThat(a.json.readTree(quarantine.body()).path("items").get(0).path("measurement_state").asText()).isEqualTo("QUARANTINED");assertThat(helper.budget(h)).isEqualTo(5000);
   String key=id();var deleted=http.send("DELETE","/api/v1/amvp/configs/"+policy,token,null,"If-Match","\"2\"","Idempotency-Key",key);
   assertThat(deleted.statusCode()).isEqualTo(202); // Simulate losing this response: retry the immutable key.
   var replay=http.send("DELETE","/api/v1/amvp/configs/"+policy,token,null,"If-Match","\"2\"","Idempotency-Key",key);
   assertThat(replay.statusCode()).isEqualTo(202);assertThat(a.json.readTree(replay.body())).isEqualTo(a.json.readTree(deleted.body()));
   String operationPath="/api/v1/amvp/operations/"+a.json.readTree(deleted.body()).path("operation_id").asText();
   var operationPending=http.send("GET",operationPath,token,null);assertThat(operationPending.statusCode()).isEqualTo(200);assertThat(a.json.readTree(operationPending.body()).path("actual_effect_confirmed").asBoolean()).isFalse();
   var pending=http.send("GET",historyPath,token,null);assertThat(pending.statusCode()).isEqualTo(200);assertThat(a.json.readTree(pending.body()).path("items").get(0).path("runtime_apply_state").asText()).isEqualTo("PENDING");
   var unknown=http.send("POST","/api/v1/amvp/reports/batch",token,body(h,report(h,2,"UNKNOWN")).toString());assertThat(unknown.statusCode()).isEqualTo(200);
   assertThat(a.json.readTree(http.send("GET",historyPath,token,null).body()).path("items").get(0).path("runtime_apply_state").asText()).isEqualTo("UNKNOWN");
   var release=report(h,3,"RELEASED");var accepted=http.send("POST","/api/v1/amvp/reports/batch",token,body(h,release).toString());
   assertThat(accepted.statusCode()).isEqualTo(200);assertThat(a.json.readTree(accepted.body()).path("items").get(0).path("status").asText()).isEqualTo("ACCEPTED");
   assertThat(a.json.readTree(http.send("GET",historyPath,token,null).body()).path("items").get(0).path("runtime_apply_state").asText()).isEqualTo("NOT_APPLICABLE");
   var operationReleased=http.send("GET",operationPath,token,null);assertThat(operationReleased.statusCode()).isEqualTo(200);assertThat(a.json.readTree(operationReleased.body()).path("actual_effect_confirmed").asBoolean()).isTrue();assertThat(operationReleased.headers().firstValue("Cache-Control")).hasValue("no-store");
  }
  String before=fingerprint(h);
  var ds=new org.springframework.jdbc.datasource.DriverManagerDataSource(System.getenv("FOCURVE_AMVP_TEST_URL"),System.getenv("FOCURVE_AMVP_TEST_USER"),System.getenv("FOCURVE_AMVP_TEST_PASSWORD"));
  try(var connection=ds.getConnection()){assertThat(connection.isValid(2)).isTrue();}
  var db=new org.springframework.jdbc.core.JdbcTemplate(ds);var manager=new org.springframework.jdbc.datasource.DataSourceTransactionManager(ds);
  var reopened=new MemberAuth(db,a.json,"https://localhost:33339",java.util.Base64.getEncoder().encodeToString(new byte[32]),"chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/popup/popup.html");
  var publisher=new AmvpPolicyPublisher(reopened,source);
  try(var http=new AmvpLoopbackHttp(reopened,manager,publisher,source,proof(h),clock)){
   var restored=http.send("GET",historyPath,token,null);assertThat(restored.statusCode()).isEqualTo(200);
   var item=a.json.readTree(restored.body()).path("items").get(0);assertThat(item.path("config_id").asText()).isEqualTo(policy);assertThat(item.path("version").asInt()).isEqualTo(3);assertThat(item.path("runtime_apply_state").asText()).isEqualTo("NOT_APPLICABLE");
   assertThat(http.send("GET",historyPath+"&executor_id="+h.fixture().executor(),token,null).statusCode()).isEqualTo(400);
  }
  assertThat(fingerprint(h)).isEqualTo(before);assertThat(db.queryForObject("SELECT COUNT(*) FROM amvp_usage_segments WHERE owner_binding_id=?",Integer.class,h.fixture().binding())).isEqualTo(2);
  assertThat(db.queryForObject("SELECT COUNT(*) FROM amvp_reports WHERE owner_binding_id=?",Integer.class,h.fixture().binding())).isEqualTo(3);
 }
 @Test void focusBoundUsageCannotBypassTheMissingFrozenFocusVerifier()throws Exception{
  var h=helper.fixture();var segment=helper.segment(h,1,null);segment.set("focus_ref",helper.example("FocusAttachmentRequest").path("focus_ref"));AmvpBridgeSupport.seal(segment);
  var result=helper.send(h,helper.receiver(h,true),segment).path("items").get(0);
  assertThat(result.path("status").asText()).isEqualTo("REJECTED");assertThat(result.path("error_code").asText()).isEqualTo("UNSUPPORTED_CONTRACT");assertThat(helper.budget(h)).isZero();
  assertThat(helper.base.db.queryForObject("SELECT COUNT(*) FROM amvp_usage_segments WHERE owner_binding_id=?",Integer.class,h.fixture().binding())).isZero();
 }
 @Test void failedDeletionPublicationRollsBackVersionsPackagesAndReceipts()throws Exception{
  var h=helper.fixture();String before=fingerprint(h),pack=helper.current(h).toString();int versions=helper.base.db.queryForObject("SELECT COUNT(*) FROM amvp_config_versions WHERE config_id=?",Integer.class,h.policy().path("policy_id").asText());
  var failing=new AdditionalConfigStore.Admission(){
   public void verify(Identity i,String executor,String binding,boolean mutation){h.publisher().verify(i,executor,binding,mutation);}
   public void publish(String binding,String id,long revision,com.fasterxml.jackson.databind.JsonNode value,boolean deleted){h.publisher().publish(binding,id,revision,value,deleted);throw new Failure(503,"STORE_UNCONFIRMED");}
  };
  assertThatThrownBy(()->new AdditionalConfigStore(helper.base.auth,helper.base.manager,failing).delete(h.fixture().identity(),h.policy().path("policy_id").asText(),"\"1\"",id())).hasMessage("STORE_UNCONFIRMED");
  assertThat(fingerprint(h)).isEqualTo(before);assertThat(helper.current(h).toString()).isEqualTo(pack);
  assertThat(helper.base.db.queryForObject("SELECT COUNT(*) FROM amvp_config_versions WHERE config_id=?",Integer.class,h.policy().path("policy_id").asText())).isEqualTo(versions);
 }
 @Test void failedReleaseProjectionDoesNotCommitReportOrClearTombstone()throws Exception{
  var h=helper.fixture();delete(h);String before=fingerprint(h);var release=report(h,1,"RELEASED");
  helper.base.db.execute("ALTER TABLE amvp_operations ADD CONSTRAINT amvp_deleted_rollback CHECK (NOT(owner_binding_id='"+h.fixture().binding()+"' AND route='RPT_STATE'))");
  try{assertThatThrownBy(()->send(h,release)).isInstanceOf(org.springframework.dao.DataAccessException.class);}finally{helper.base.db.execute("ALTER TABLE amvp_operations DROP CHECK amvp_deleted_rollback");}
  assertThat(fingerprint(h)).isEqualTo(before);assertThat(history(h).path("items").get(0).path("runtime_apply_state").asText()).isEqualTo("PENDING");
  assertThat(helper.base.db.queryForObject("SELECT COUNT(*) FROM amvp_reports WHERE owner_binding_id=?",Integer.class,h.fixture().binding())).isZero();
  assertThat(send(h,release).path("items").get(0).path("status").asText()).isEqualTo("ACCEPTED");
 }
 AdditionalConfigStore store(AmvpRuntimeBridgeMysqlTest.Harness h){return new AdditionalConfigStore(helper.base.auth,helper.base.manager,h.publisher());}
 com.fasterxml.jackson.databind.node.ObjectNode history(AmvpRuntimeBridgeMysqlTest.Harness h){return store(h).deletions(h.fixture().identity(),h.fixture().executor(),null,100);}
 String add(AmvpRuntimeBridgeMysqlTest.Harness h){String id=id();var value=h.policy().deepCopy().put("policy_id",id);h.configs().put(h.fixture().identity(),id,helper.base.auth.obj("executor_id",h.fixture().executor(),"value",value),null,"*",id());return id;}
 @Test void recreatedReaderRestoresPendingUnknownAndVerifiedRelease()throws Exception{
  var h=helper.fixture();delete(h);assertThat(history(h).path("items").get(0).path("runtime_apply_state").asText()).isEqualTo("PENDING");
  send(h,report(h,1,"UNKNOWN"));assertThat(history(h).path("items").get(0).path("runtime_apply_state").asText()).isEqualTo("UNKNOWN");send(h,report(h,2,"RELEASED"));assertThat(history(h).path("items").get(0).path("runtime_apply_state").asText()).isEqualTo("NOT_APPLICABLE");assertThat(store(h).list(h.fixture().identity(),h.fixture().executor(),null,null,100).path("items").size()).isZero();
 }
 @Test void readsDoNotCreateCommandsReceiptsOrAlterObligations()throws Exception{
  var h=helper.fixture();delete(h);String before=fingerprint(h);history(h);history(h);assertThat(fingerprint(h)).isEqualTo(before);
 }
 String fingerprint(AmvpRuntimeBridgeMysqlTest.Harness h){var a=helper.base.auth;return a.db.queryForList("SELECT * FROM amvp_configs WHERE owner_binding_id=? ORDER BY config_id",h.fixture().binding()).toString()+a.db.queryForList("SELECT * FROM amvp_operations WHERE owner_binding_id=? ORDER BY operation_id",h.fixture().binding())+a.db.queryForList("SELECT * FROM amvp_outbox WHERE owner_binding_id=? ORDER BY item_id",h.fixture().binding());}
 @Test void paginationKeepsOwnerLimitAndReadModelBound()throws Exception{
  var h=helper.fixture();String second=add(h);delete(h);h.configs().delete(h.fixture().identity(),second,"\"1\"",id());add(h);add(h);var reader=store(h);var page=reader.deletions(h.fixture().identity(),h.fixture().executor(),null,1);String cursor=page.path("next_cursor").asText();assertThat(page.path("has_more").asBoolean()).isTrue();var next=reader.deletions(h.fixture().identity(),h.fixture().executor(),cursor,1);assertThat(next.path("items").get(0).path("config_id")).isNotEqualTo(page.path("items").get(0).path("config_id"));assertThat(next.path("has_more").asBoolean()).isFalse();
  assertThatThrownBy(()->reader.list(h.fixture().identity(),h.fixture().executor(),"SITE_TIME",cursor,1)).hasMessage("VALIDATION_FAILED");assertThatThrownBy(()->reader.deletions(h.fixture().identity(),h.fixture().executor(),cursor,2)).hasMessage("VALIDATION_FAILED");String active=reader.list(h.fixture().identity(),h.fixture().executor(),"SITE_TIME",null,1).path("next_cursor").asText();assertThatThrownBy(()->reader.deletions(h.fixture().identity(),h.fixture().executor(),active,1)).hasMessage("VALIDATION_FAILED");
  var other=helper.fixture();assertThatThrownBy(()->store(other).deletions(other.fixture().identity(),other.fixture().executor(),cursor,1)).hasMessage("VALIDATION_FAILED");
 }
 @Test void inconsistentDeleteReceiptFailsClosedInsteadOfReportingEmptyOrComplete()throws Exception{
  var h=helper.fixture();delete(h);helper.base.db.update("UPDATE amvp_operations SET request_sha256=? WHERE owner_binding_id=? AND route=?","0".repeat(64),h.fixture().binding(),"DELETE:/api/v1/amvp/configs/"+h.policy().path("policy_id").asText());assertThatThrownBy(()->history(h)).hasMessage("STORE_UNCONFIRMED");
 }
 @Test void expiredResponseCacheDoesNotEraseTheDurableDeletionIdentity()throws Exception{
  var h=helper.fixture();delete(h);helper.base.db.update("UPDATE amvp_operations SET response_json=NULL WHERE owner_binding_id=? AND route=?",h.fixture().binding(),"DELETE:/api/v1/amvp/configs/"+h.policy().path("policy_id").asText());assertThat(history(h).path("items").get(0).path("runtime_apply_state").asText()).isEqualTo("PENDING");assertThat(helper.base.auth.one("SELECT response_json FROM amvp_operations WHERE owner_binding_id=? AND route=?",h.fixture().binding(),"DELETE:/api/v1/amvp/configs/"+h.policy().path("policy_id").asText()).get("response_json")).isNull();
 }
 @Test void closedOwnerCannotReadItsOldDeletionThroughANewBinding()throws Exception{
  var h=helper.fixture();delete(h);helper.base.db.update("UPDATE amvp_owner_bindings SET state='CLOSED',closed_at=UTC_TIMESTAMP(3) WHERE binding_id=?",h.fixture().binding());assertThatThrownBy(()->history(h)).hasMessage("STALE_OWNER");assertThat(helper.base.db.queryForObject("SELECT COUNT(*) FROM amvp_configs WHERE owner_binding_id=? AND deleted_at IS NOT NULL",Integer.class,h.fixture().binding())).isEqualTo(1);
 }
 @Test void contentTombstonesAndActiveSettingsAreNotSiteTimeHistory()throws Exception{
  var h=helper.fixture();var content=helper.example("ContentConfig");content.putArray("features");for(String field:java.util.List.of("keyword","adult","blur"))((com.fasterxml.jackson.databind.node.ObjectNode)content.path(field)).put("enabled",false);String config=id();h.configs().put(h.fixture().identity(),config,helper.base.auth.obj("executor_id",h.fixture().executor(),"value",content),null,"*",id());h.configs().delete(h.fixture().identity(),config,"\"1\"",id());assertThat(history(h).path("items").size()).isZero();delete(h);assertThat(history(h).path("items").size()).isEqualTo(1);
 }
 @Test void authenticatedHttpRestoresADeletionWithoutAnyBrowserReference()throws Exception{
  var h=helper.fixture();delete(h);var a=helper.base.auth;String token=new org.springframework.transaction.support.TransactionTemplate(helper.base.manager).execute(tx->a.mint(h.fixture().executor(),h.fixture().identity().user(),id(),1)).path("access_token").asText();var beans=new org.springframework.beans.factory.support.StaticListableBeanFactory();beans.addBean("admission",h.publisher());var http=org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(new AmvpWebDeletionApi(a,helper.base.manager,beans.getBeanProvider(AdditionalConfigStore.Admission.class))).build();
  http.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/amvp/web/site-time-deletions").param("executor_id",h.fixture().executor()).header("Authorization","Bearer "+token)).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk()).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.items[0].runtime_apply_state").value("PENDING")).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header().string("Cache-Control","no-store"));
  var other=helper.fixture();http.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/amvp/web/site-time-deletions").param("executor_id",other.fixture().executor()).header("Authorization","Bearer "+token)).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isNotFound());
  http.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/amvp/web/site-time-deletions").param("executor_id",h.fixture().executor()).param("include_deleted","true").header("Authorization","Bearer "+token)).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isBadRequest());
 }
}
