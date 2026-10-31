package kr.ac.kdu.focurve;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import static kr.ac.kdu.focurve.MemberAuth.*;
import static org.assertj.core.api.Assertions.*;

/** Inherits the receipt/clock/HTTP regression suite on the SAME fresh DB. Core proof is SYNTHETIC. */
@EnabledIfEnvironmentVariable(named="FOCURVE_AMVP_TEST_URL",matches="jdbc:mysql://127\\.0\\.0\\.1:[0-9]+/amvp_test_[a-f0-9]+.*")
@EnabledIfEnvironmentVariable(named="FOCURVE_AMVP_RECEIPT_TESTS",matches="1")
@EnabledIfEnvironmentVariable(named="FOCURVE_AMVP_RELEASE_TESTS",matches="1")
class AmvpReleaseMysqlTest extends AmvpRuntimeReceiptMysqlTest {
 void delete(AmvpRuntimeBridgeMysqlTest.Harness h){h.configs().delete(h.fixture().identity(),h.policy().path("policy_id").asText(),"\"1\"",id());}
 @Test void deletedTargetNeedsActualReleaseAndKeepsRawHistory()throws Exception{
  var h=helper.fixture();send(h,report(h,1,"APPLIED"));delete(h);assertThat(config(h).path("runtime_apply_state").asText()).isEqualTo("PENDING");
  var release=report(h,2,"RELEASED");assertThat(send(h,release).path("items").get(0).path("status").asText()).isEqualTo("ACCEPTED");assertThat(config(h).path("runtime_apply_state").asText()).isEqualTo("NOT_APPLICABLE");assertThat(config(h).path("deleted_at").isNull()).isFalse();
  assertThat(send(h,release).path("items").get(0).path("status").asText()).isEqualTo("DUPLICATE");assertThat(helper.base.db.queryForObject("SELECT COUNT(*) FROM amvp_reports WHERE owner_binding_id=?",Integer.class,h.fixture().binding())).isEqualTo(2);
 }
 @Test void replacementPackageOmissionAndTransportAckAreNotReleaseProof()throws Exception{
  var h=helper.fixture();delete(h);var applied=report(h,1,"APPLIED");assertThat(send(h,applied).path("items").get(0).path("error_code").asText()).isEqualTo("INVALID_EFFECT_EVIDENCE");
  var noScope=new AmvpReportReceiver(helper.base.auth,helper.base.manager,helper.source(h.selection()),(principal,binding,item,pack,previous)->new AmvpReportReceiver.VerifiedReport(Set.of()));assertThat(noScope.batch(()->helper.bearer(h),body(h,applied)).path("items").get(0).path("status").asText()).isEqualTo("ACCEPTED");assertThat(config(h).path("runtime_apply_state").asText()).isEqualTo("PENDING");
 }
 @Test void lateOldRevisionCannotClearCurrentTombstone()throws Exception{
  var h=helper.fixture();var old=report(h,1,"RELEASED");delete(h);send(h,old);assertThat(config(h).path("runtime_apply_state").asText()).isEqualTo("PENDING");send(h,report(h,2,"RELEASED"));assertThat(config(h).path("runtime_apply_state").asText()).isEqualTo("NOT_APPLICABLE");
 }
 @Test void gapAndUnknownRemainDurableUntilVerifiedRelease()throws Exception{
  var h=helper.fixture();delete(h);var later=report(h,2,"RELEASED");assertThat(send(h,later).path("items").get(0).path("status").asText()).isEqualTo("PENDING_DEPENDENCY");assertThat(config(h).path("runtime_apply_state").asText()).isEqualTo("PENDING");
  send(h,report(h,1,"UNKNOWN"));assertThat(config(h).path("runtime_apply_state").asText()).isEqualTo("UNKNOWN");send(h,later);assertThat(config(h).path("runtime_apply_state").asText()).isEqualTo("NOT_APPLICABLE");assertThat(helper.base.db.queryForObject("SELECT COUNT(*) FROM amvp_reports WHERE owner_binding_id=? AND JSON_UNQUOTE(JSON_EXTRACT(payload_json,'$.state'))='UNKNOWN'",Integer.class,h.fixture().binding())).isEqualTo(1);
 }
 @Test void foreignDeletedPolicyCannotBeClaimedByThisBinding()throws Exception{
  var h=helper.fixture();delete(h);var other=helper.fixture();delete(other);var receiver=new AmvpReportReceiver(helper.base.auth,helper.base.manager,helper.source(h.selection()),(principal,binding,item,pack,previous)->new AmvpReportReceiver.VerifiedReport(Set.of(other.policy().path("policy_id").asText())));
  assertThat(receiver.batch(()->helper.bearer(h),body(h,report(h,1,"RELEASED"))).path("items").get(0).path("error_code").asText()).isEqualTo("INVALID_EFFECT_EVIDENCE");assertThat(config(other).path("runtime_apply_state").asText()).isEqualTo("PENDING");
 }
 @Test void deletionOfContentDoesNotReleaseExistingFrozenAttachments()throws Exception{
  var h=helper.fixture();var content=helper.example("ContentConfig");content.putArray("features");for(String field:java.util.List.of("keyword","adult","blur"))((com.fasterxml.jackson.databind.node.ObjectNode)content.path(field)).put("enabled",false);String configId=id();
  h.configs().put(h.fixture().identity(),configId,helper.base.auth.obj("executor_id",h.fixture().executor(),"value",content),null,"*",id());h.configs().delete(h.fixture().identity(),configId,"\"1\"",id());var receiver=new AmvpReportReceiver(helper.base.auth,helper.base.manager,helper.source(h.selection()),(principal,binding,item,pack,previous)->new AmvpReportReceiver.VerifiedReport(Set.of(configId)));
  assertThat(receiver.batch(()->helper.bearer(h),body(h,report(h,1,"RELEASED"))).path("items").get(0).path("error_code").asText()).isEqualTo("INVALID_EFFECT_EVIDENCE");assertThat(h.configs().get(h.fixture().identity(),configId).path("runtime_apply_state").asText()).isEqualTo("PENDING");
 }
 @Test void disabledPolicyIsNotReleasedUntilTheVerifierAcceptsItsReceipt()throws Exception{
  var h=helper.fixture();var value=h.policy().deepCopy().put("enabled",false);h.configs().put(h.fixture().identity(),value.path("policy_id").asText(),helper.base.auth.obj("executor_id",h.fixture().executor(),"value",value),"\"1\"",null,id());assertThat(config(h).path("runtime_apply_state").asText()).isEqualTo("PENDING");send(h,report(h,1,"RELEASED"));assertThat(config(h).path("runtime_apply_state").asText()).isEqualTo("NOT_APPLICABLE");
 }
 @Test void existingAuthenticatedConfigHttpReturnsTheVerifiedTombstoneState()throws Exception{
  var h=helper.fixture();delete(h);var a=helper.base.auth;String token=new org.springframework.transaction.support.TransactionTemplate(helper.base.manager).execute(tx->a.mint(h.fixture().executor(),h.fixture().identity().user(),id(),1)).path("access_token").asText();var beans=new org.springframework.beans.factory.support.StaticListableBeanFactory();beans.addBean("admission",h.publisher());
  var http=org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(new AdditionalConfigApi(a,helper.base.manager,beans.getBeanProvider(AdditionalConfigStore.Admission.class))).build();String url="/api/v1/amvp/configs/"+h.policy().path("policy_id").asText();
  http.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(url).header("Authorization","Bearer "+token)).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk()).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.runtime_apply_state").value("PENDING"));
  send(h,report(h,1,"RELEASED"));http.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(url).header("Authorization","Bearer "+token)).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk()).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.runtime_apply_state").value("NOT_APPLICABLE"));
 }
 @Test void corruptedPreviousPackageCannotEstablishRelease()throws Exception{
  var h=helper.fixture();String previous=helper.current(h).path("package_id").asText();delete(h);helper.base.db.update("UPDATE amvp_packages SET payload_sha256=? WHERE package_id=? AND owner_binding_id=?","0".repeat(64),previous,h.fixture().binding());
  assertThat(send(h,report(h,1,"RELEASED")).path("items").get(0).path("error_code").asText()).isEqualTo("STORE_UNCONFIRMED");assertThat(config(h).path("runtime_apply_state").asText()).isEqualTo("PENDING");
 }
}
