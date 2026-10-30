package kr.ac.kdu.focurve;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import static kr.ac.kdu.focurve.MemberAuth.*;
import static org.assertj.core.api.Assertions.*;

/** Fresh MySQL + authenticated MockMvc. Inherits PR35 regressions; effect producer remains SYNTHETIC. */
@EnabledIfEnvironmentVariable(named="FOCURVE_AMVP_TEST_URL",matches="jdbc:mysql://127\\.0\\.0\\.1:[0-9]+/amvp_test_[a-f0-9]+.*")
@EnabledIfEnvironmentVariable(named="FOCURVE_AMVP_RECEIPT_TESTS",matches="1")
@EnabledIfEnvironmentVariable(named="FOCURVE_AMVP_RELEASE_TESTS",matches="1")
@EnabledIfEnvironmentVariable(named="FOCURVE_AMVP_DELETION_HISTORY_TESTS",matches="1")
class AmvpDeletionHistoryMysqlTest extends AmvpReleaseMysqlTest {
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
