package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.assertj.core.api.Assertions.*;
import static kr.ac.kdu.focurve.MemberAuth.*;
import static kr.ac.kdu.focurve.AmvpBridgeSupport.*;

/** Production SQL/auth/projection and concrete clock code; Core effect proofs remain SYNTHETIC. */
@EnabledIfEnvironmentVariable(named="FOCURVE_AMVP_TEST_URL",matches="jdbc:mysql://127\\.0\\.0\\.1:[0-9]+/amvp_test_[a-f0-9]+.*")
@EnabledIfEnvironmentVariable(named="FOCURVE_AMVP_RECEIPT_TESTS",matches="1")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class AmvpRuntimeReceiptMysqlTest {
 final AmvpRuntimeBridgeMysqlTest helper=new AmvpRuntimeBridgeMysqlTest();
 @BeforeAll void schema(){helper.schema();}
 ObjectNode report(AmvpRuntimeBridgeMysqlTest.Harness h,long seq,String state)throws Exception{
  var r=helper.example("RuntimeReport");var pack=helper.current(h);r.put("report_id",id()).put("owner_binding_id",h.fixture().binding()).put("executor_id",h.fixture().executor()).put("report_epoch",h.fixture().binding()).put("report_seq",seq).put("runtime_execution_id",h.fixture().executor()).put("operation_id",id()).put("package_id",pack.path("package_id").asText()).put("runtime_revision",pack.path("runtime_revision").asLong()).put("state",state).put("observed_at","2026-10-29T00:00:05.000Z");seal(r);return r;
 }
 AmvpReportReceiver.EvidenceVerifier proof(AmvpRuntimeBridgeMysqlTest.Harness h){return (principal,binding,report,pack,previous)->new AmvpReportReceiver.VerifiedReport(Set.of(h.policy().path("policy_id").asText()));}
 AmvpReportReceiver receiver(AmvpRuntimeBridgeMysqlTest.Harness h){return new AmvpReportReceiver(helper.base.auth,helper.base.manager,helper.source(h.selection()),proof(h));}
 ObjectNode body(AmvpRuntimeBridgeMysqlTest.Harness h,ObjectNode...reports){var b=helper.base.auth.obj("stream","RUNTIME_REPORT","schema_version","AMVP_RUNTIME_REPORT_1","batch_id",id(),"executor_id",h.fixture().executor());var items=b.putArray("reports");for(var report:reports)items.add(report);return b;}
 ObjectNode send(AmvpRuntimeBridgeMysqlTest.Harness h,ObjectNode...reports){return receiver(h).batch(()->helper.bearer(h),body(h,reports));}
 ObjectNode config(AmvpRuntimeBridgeMysqlTest.Harness h){return h.configs().get(h.fixture().identity(),h.policy().path("policy_id").asText());}
 @Test void verifiedAckPersistsAcrossObjectRecreationAndDuplicates()throws Exception{
  var h=helper.fixture();var r=report(h,1,"APPLIED");assertThat(send(h,r).path("items").get(0).path("status").asText()).isEqualTo("ACCEPTED");assertThat(config(h).path("runtime_apply_state").asText()).isEqualTo("APPLIED");
  assertThat(receiver(h).batch(()->helper.bearer(h),body(h,r)).path("items").get(0).path("status").asText()).isEqualTo("DUPLICATE");assertThat(config(h).path("applied_runtime_revision").asLong()).isEqualTo(1);
  assertThat(helper.base.db.queryForObject("SELECT COUNT(*) FROM amvp_reports WHERE owner_binding_id=?",Integer.class,h.fixture().binding())).isEqualTo(1);
 }
 @Test void acceptedTransportWithoutWholePolicyCoverageDoesNotClaimApplication()throws Exception{
  var h=helper.fixture();var r=report(h,1,"APPLIED");var noCoverage=new AmvpReportReceiver(helper.base.auth,helper.base.manager,helper.source(h.selection()),(principal,binding,report,pack,previous)->new AmvpReportReceiver.VerifiedReport(Set.of()));
  assertThat(noCoverage.batch(()->helper.bearer(h),body(h,r)).path("items").get(0).path("status").asText()).isEqualTo("ACCEPTED");assertThat(config(h).path("runtime_apply_state").asText()).isEqualTo("PENDING");
 }
 @Test void gapsAndReservationsAreDurableWithoutInventingMissingReports()throws Exception{
  var h=helper.fixture();var first=report(h,1,"APPLYING");var second=report(h,2,"APPLIED");assertThat(send(h,second).path("items").get(0).path("status").asText()).isEqualTo("PENDING_DEPENDENCY");
  var reused=second.deepCopy().put("report_id",id());seal(reused);assertThat(send(h,reused).path("items").get(0).path("error_code").asText()).isEqualTo("SEQUENCE_REUSE");
  send(h,first);assertThat(config(h).path("runtime_apply_state").asText()).isEqualTo("PENDING");assertThat(send(h,second).path("items").get(0).path("status").asText()).isEqualTo("ACCEPTED");assertThat(config(h).path("runtime_apply_state").asText()).isEqualTo("APPLIED");
 }
 @Test void unknownAndFailurePreserveOriginalReportsAndClearOnlyProjectionCertainty()throws Exception{
  var h=helper.fixture();send(h,report(h,1,"APPLIED"));send(h,report(h,2,"UNKNOWN"));assertThat(config(h).path("runtime_apply_state").asText()).isEqualTo("UNKNOWN");assertThat(config(h).path("applied_runtime_revision").isNull()).isTrue();send(h,report(h,3,"FAILED"));
  assertThat(config(h).path("runtime_apply_state").asText()).isEqualTo("UNKNOWN");assertThat(helper.base.db.queryForObject("SELECT COUNT(*) FROM amvp_reports WHERE owner_binding_id=?",Integer.class,h.fixture().binding())).isEqualTo(3);
 }
 @Test void newerPackageCanConfirmUnchangedConfigButOlderAckCannotConfirmAnEdit()throws Exception{
  var h=helper.fixture();var b=h.policy().deepCopy().put("policy_id",id());h.configs().put(h.fixture().identity(),b.path("policy_id").asText(),helper.base.auth.obj("executor_id",h.fixture().executor(),"value",b),null,"*",id());send(h,report(h,1,"APPLIED"));
  assertThat(config(h).path("saved_runtime_revision").asLong()).isEqualTo(1);assertThat(config(h).path("applied_runtime_revision").asLong()).isEqualTo(2);
  h.configs().put(h.fixture().identity(),h.policy().path("policy_id").asText(),helper.base.auth.obj("executor_id",h.fixture().executor(),"value",h.policy().deepCopy().put("daily_limit_ms",120000)),"\"1\"",null,id());assertThat(config(h).path("runtime_apply_state").asText()).isEqualTo("PENDING");send(h,report(h,2,"APPLIED"));assertThat(config(h).path("applied_runtime_revision").asLong()).isEqualTo(3);
 }
 @Test void hashOwnerAndUnverifiedEffectCannotMutateProjection()throws Exception{
  var h=helper.fixture();var r=report(h,1,"APPLIED");var bad=r.deepCopy().put("owner_binding_id",id());seal(bad);assertThat(send(h,bad).path("items").get(0).path("error_code").asText()).isEqualTo("FORBIDDEN_EXECUTOR");
  var reject=new AmvpReportReceiver(helper.base.auth,helper.base.manager,helper.source(h.selection()),(principal,binding,item,pack,previous)->{throw new Failure(409,"INVALID_EFFECT_EVIDENCE");});assertThat(reject.batch(()->helper.bearer(h),body(h,r)).path("items").get(0).path("error_code").asText()).isEqualTo("INVALID_EFFECT_EVIDENCE");assertThat(config(h).path("runtime_apply_state").asText()).isEqualTo("PENDING");
  send(h,r);var changed=r.deepCopy().put("state","FAILED");seal(changed);assertThat(send(h,changed).path("items").get(0).path("error_code").asText()).isEqualTo("SOURCE_CONFLICT");assertThat(config(h).path("runtime_apply_state").asText()).isEqualTo("APPLIED");
 }
 @Test void concurrentDuplicateReportsProduceOneReceipt()throws Exception{
  var h=helper.fixture();var r=report(h,1,"APPLIED");var pool=Executors.newFixedThreadPool(2);try{var a=pool.submit(()->send(h,r));var b=pool.submit(()->send(h,r));assertThat(List.of(a.get().path("items").get(0).path("status").asText(),b.get().path("items").get(0).path("status").asText())).containsExactlyInAnyOrder("ACCEPTED","DUPLICATE");}finally{pool.shutdownNow();}
 }
 @Test void projectionWriteFailureRollsBackRawAndReceipt()throws Exception{
  var h=helper.fixture();var r=report(h,1,"APPLIED");helper.base.db.execute("ALTER TABLE amvp_operations ADD CONSTRAINT amvp_receipt_rollback CHECK (NOT(owner_binding_id='"+h.fixture().binding()+"' AND route='RPT_STATE'))");
  try{assertThatThrownBy(()->send(h,r)).isInstanceOf(org.springframework.dao.DataAccessException.class);}finally{helper.base.db.execute("ALTER TABLE amvp_operations DROP CHECK amvp_receipt_rollback");}
  assertThat(helper.base.db.queryForObject("SELECT COUNT(*) FROM amvp_reports WHERE owner_binding_id=?",Integer.class,h.fixture().binding())).isZero();assertThat(helper.base.db.queryForObject("SELECT COUNT(*) FROM amvp_operations WHERE operation_id=?",Integer.class,r.path("report_id").asText())).isZero();
 }
 @Test void realBearerReportHttpIsDurableAndRevocationDoesNotEraseEvidence()throws Exception{
  var h=helper.fixture();var token=new TransactionTemplate(helper.base.manager).execute(tx->helper.base.auth.mint(h.fixture().executor(),h.fixture().identity().user(),id(),1)).path("access_token").asText();var beans=new StaticListableBeanFactory();beans.addBean("capability",helper.source(h.selection()));beans.addBean("evidence",proof(h));
  var http=MockMvcBuilders.standaloneSetup(new AmvpReportApi(helper.base.auth,helper.base.manager,beans.getBeanProvider(CapabilitySource.class),beans.getBeanProvider(AmvpReportReceiver.EvidenceVerifier.class))).build();var r=report(h,1,"APPLIED");
  http.perform(post("/api/v1/amvp/reports/batch").header("Authorization","Bearer "+token).contentType("application/json").content(body(h,r).toString())).andExpect(status().isOk()).andExpect(jsonPath("$.items[0].status").value("ACCEPTED"));
  helper.base.db.update("UPDATE extension_tokens SET revoked_at=UTC_TIMESTAMP(3) WHERE executor_id=?",h.fixture().executor());http.perform(post("/api/v1/amvp/reports/batch").header("Authorization","Bearer "+token).contentType("application/json").content(body(h,r).toString())).andExpect(status().isUnauthorized());assertThat(config(h).path("runtime_apply_state").asText()).isEqualTo("APPLIED");
 }
 @Test void concreteRegisteredClockFeedsStatisticsAcrossReceiverRecreation()throws Exception{
  var h=helper.fixture();var first=helper.segment(h,1,null);var concrete=new AmvpRegisteredClockProof(helper.base.auth,Duration.ZERO);var receiver=new AmvpUsageReceiver(helper.base.auth,helper.base.manager,helper.source(h.selection()),concrete);assertThat(helper.send(h,receiver,first).path("items").get(0).path("measurement_state").asText()).isEqualTo("COUNTED");
  var next=helper.segment(h,2,first);var recreated=new AmvpUsageReceiver(helper.base.auth,helper.base.manager,helper.source(h.selection()),new AmvpRegisteredClockProof(helper.base.auth,Duration.ZERO));helper.send(h,recreated,next);
  var stats=new AdditionalUsageStatistics(helper.base.auth,helper.base.manager,h.publisher()).query(h.fixture().identity(),new AdditionalUsageStatistics.Range("INSTALLATION",h.fixture().executor(),LocalDate.of(2026,10,29),LocalDate.of(2026,10,29)));assertThat(stats.path("browser_ms").asLong()).isEqualTo(10000);assertThat(helper.budget(h)).isZero();
 }
 @Test void concreteClockKeepsDriftAndUnprovenRestartQuarantined()throws Exception{
  var h=helper.fixture();var first=helper.segment(h,1,null);var concrete=new AmvpUsageReceiver(helper.base.auth,helper.base.manager,helper.source(h.selection()),new AmvpRegisteredClockProof(helper.base.auth,Duration.ZERO));helper.send(h,concrete,first);
  var second=helper.segment(h,2,first);((ObjectNode)second.path("clock")).put("observed_wall_start_at","2026-10-29T00:00:05.001Z");seal(second);assertThat(helper.send(h,concrete,second).path("items").get(0).path("measurement_state").asText()).isEqualTo("QUARANTINED");
  var third=helper.segment(h,3,second);String anchor=id(),boot=id();((ObjectNode)third.path("clock")).put("anchor_id",anchor).put("boot_id",boot);seal(third);helper.base.db.update("INSERT INTO amvp_clock_anchors VALUES(?,?,?,'clock-fixture',?,0,'2026-10-29 00:00:00.000','VERIFIED',?)",anchor,h.fixture().binding(),h.fixture().executor(),boot,hash("synthetic restart fixture"));assertThat(helper.send(h,concrete,third).path("items").get(0).path("measurement_state").asText()).isEqualTo("QUARANTINED");
  var reset=helper.segment(h,1,null).put("collector_epoch",id()).put("enforcement_day_chain_id",id());((ObjectNode)reset.path("clock")).put("anchor_id",anchor).put("boot_id",boot);seal(reset);assertThat(helper.send(h,concrete,reset).path("items").get(0).path("measurement_state").asText()).isEqualTo("QUARANTINED");
 }
 @Test void delayedOlderPackageCannotDowngradeCurrentProjection()throws Exception{
  var h=helper.fixture();var delayed=report(h,2,"FAILED");var second=h.policy().deepCopy().put("policy_id",id());h.configs().put(h.fixture().identity(),second.path("policy_id").asText(),helper.base.auth.obj("executor_id",h.fixture().executor(),"value",second),null,"*",id());send(h,report(h,1,"APPLIED"));send(h,delayed);assertThat(config(h).path("runtime_apply_state").asText()).isEqualTo("APPLIED");assertThat(config(h).path("applied_runtime_revision").asLong()).isEqualTo(2);
 }
 @Test void authorityScopeAndOwnerClosureCannotBeBypassed()throws Exception{
  var h=helper.fixture();var r=report(h,1,"APPLIED");var unrelated=new AmvpReportReceiver(helper.base.auth,helper.base.manager,helper.source(h.selection()),(principal,binding,item,pack,previous)->new AmvpReportReceiver.VerifiedReport(Set.of(id())));assertThat(unrelated.batch(()->helper.bearer(h),body(h,r)).path("items").get(0).path("error_code").asText()).isEqualTo("INVALID_EFFECT_EVIDENCE");
  helper.base.db.update("UPDATE amvp_owner_bindings SET state='CLOSED',closed_at=UTC_TIMESTAMP(3) WHERE binding_id=?",h.fixture().binding());assertThat(send(h,r).path("items").get(0).path("error_code").asText()).isEqualTo("STALE_OWNER");assertThat(helper.base.db.queryForObject("SELECT COUNT(*) FROM amvp_reports WHERE owner_binding_id=?",Integer.class,h.fixture().binding())).isZero();
 }
}
