package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.transaction.support.TransactionTemplate;
import static org.assertj.core.api.Assertions.*;
import static kr.ac.kdu.focurve.MemberAuth.*;
import static kr.ac.kdu.focurve.AmvpBridgeSupport.*;

/** Reuses PR25's empty isolated MySQL fixture; authority/clock producers are explicitly synthetic. */
@EnabledIfEnvironmentVariable(named="FOCURVE_AMVP_TEST_URL",matches="jdbc:mysql://127\\.0\\.0\\.1:[0-9]+/amvp_test_[a-f0-9]+.*")
@EnabledIfEnvironmentVariable(named="FOCURVE_AMVP_BRIDGE_TESTS",matches="1")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class AmvpRuntimeBridgeMysqlTest {
 final AdditionalConfigMysqlTest base=new AdditionalConfigMysqlTest();
 @BeforeAll void schema(){base.schema();}
 ObjectNode example(String type)throws Exception{return (ObjectNode)base.json.readTree(getClass().getResourceAsStream("/amvp/rc2/examples.json")).path("definitions").path(type).deepCopy();}
 record Harness(AdditionalConfigMysqlTest.Fixture fixture,ObjectNode selection,AmvpPolicyPublisher publisher,AdditionalConfigStore configs,ObjectNode policy){}
 Harness fixture()throws Exception{
  var f=base.fixture();ObjectNode selected=example("CapabilitySelection");selected.put("executor_id",f.executor()).put("owner_binding_id",f.binding()).put("capability_receipt_id",id()).put("expires_at",utc(Instant.now().plusSeconds(3600)));
  base.db.update("INSERT INTO amvp_capability_receipts(receipt_id,owner_binding_id,verified_artifact_sha256,selected_json,verification_ref,expires_at) VALUES(?,?,?,?,?,?)",selected.path("capability_receipt_id").asText(),f.binding(),selected.path("verified_artifact_sha256").asText(),AdditionalConfigContract.canonical(selected.path("selected")),selected.path("verification_ref").asText(),Timestamp.from(Instant.parse(selected.path("expires_at").asText())));
  base.db.update("INSERT INTO amvp_timezone_states VALUES(?,'UTC',1,'UTC',1,UTC_TIMESTAMP(3),'synthetic-test')",f.executor());
  base.db.update("INSERT INTO amvp_clock_anchors(anchor_id,owner_binding_id,executor_id,clock_epoch,boot_id,anchor_mono_ms,anchor_utc,verification_state,proof_sha256) VALUES(?,?,?,'clock-fixture',?,0,'2026-10-29 00:00:00.000','VERIFIED',?)",f.binding(),f.binding(),f.executor(),f.binding(),hash("synthetic-clock-fixture:"+f.binding()));
  var publisher=new AmvpPolicyPublisher(base.auth,source(selected),Clock.fixed(Instant.parse("2026-10-29T00:00:00Z"),ZoneOffset.UTC));var store=new AdditionalConfigStore(base.auth,base.manager,publisher);
  ObjectNode policy=example("SiteTimePolicy");policy.put("policy_id",id()).put("enabled",true).put("daily_limit_ms",60000);((ObjectNode)policy.path("scope")).put("host","example.org").put("include_subdomains",true);policy.putArray("windows");
  var body=base.auth.obj("executor_id",f.executor(),"value",policy);store.put(f.identity(),policy.path("policy_id").asText(),body,null,"*",id());return new Harness(f,selected,publisher,store,policy);
 }
 CapabilitySource source(ObjectNode selected){return new CapabilitySource(){public ObjectNode verifiedSelection(Identity principal,Binding binding,String stream){return selected.deepCopy();}public void verifyContentProfiles(Binding binding,com.fasterxml.jackson.databind.JsonNode content,ObjectNode selection){throw new Failure(503,"UNSUPPORTED_CONTRACT");}};}
 ObjectNode current(Harness h){return new TransactionTemplate(base.manager).execute(tx->h.publisher.current(h.fixture.identity(),h.fixture.executor()));}
 Identity bearer(Harness h){return new Identity(h.fixture.identity().user(),h.fixture.executor());}
 AmvpUsageReceiver receiver(Harness h,boolean counted){return new AmvpUsageReceiver(base.auth,base.manager,source(h.selection),(principal,binding,segment,previous)->new AmvpUsageReceiver.VerifiedCapture(counted,Map.of(h.policy.path("policy_id").asText(),0L)));}
 ObjectNode segment(Harness h,long sequence,ObjectNode predecessor)throws Exception{
  var item=example("ClockedUsageSegment");var pack=current(h);item.put("segment_id",id()).put("owner_binding_id",h.fixture.binding()).put("executor_id",h.fixture.executor()).put("collector_epoch",h.fixture.binding()).put("local_usage_seq",sequence).put("package_id",pack.path("package_id").asText()).put("runtime_revision",pack.path("runtime_revision").asLong()).put("actual_host","example.org").put("enforcement_day_chain_id",h.fixture.binding());
  if(predecessor==null)item.putNull("previous_segment_sha256");else item.put("previous_segment_sha256",predecessor.path("payload_sha256").asText());
  long lo=(sequence-1)*5000,hi=sequence*5000;Instant anchor=Instant.parse("2026-10-29T00:00:00Z");item.put("start_at",utc(anchor.plusMillis(lo))).put("end_at",utc(anchor.plusMillis(hi)));
  var clock=(ObjectNode)item.path("clock");clock.put("anchor_id",h.fixture.binding()).put("boot_id",h.fixture.binding()).put("mono_start_ms",lo).put("mono_end_ms",hi).put("observed_wall_start_at",item.path("start_at").asText()).put("observed_wall_end_at",item.path("end_at").asText());
  item.putArray("policy_attributions").add(base.auth.obj("policy_id",h.policy.path("policy_id").asText(),"policy_version",1,"matched_policy_host","example.org"));seal(item);return item;
 }
 ObjectNode batch(Harness h,ObjectNode...items){var body=base.auth.obj("stream","RUNTIME_USAGE","schema_version","AMVP_BROWSER_USAGE_2","batch_id",id(),"executor_id",h.fixture.executor());var array=body.putArray("segments");for(var item:items)array.add(item);return body;}
 ObjectNode send(Harness h,AmvpUsageReceiver r,ObjectNode...items){return r.batch(()->bearer(h),batch(h,items));}
 long budget(Harness h){return base.db.queryForObject("SELECT COALESCE(SUM(confirmed_ms),0) FROM amvp_day_budgets WHERE executor_id=?",Long.class,h.fixture.executor());}
 @Test void configCreatesCanonicalPackageCurrentPointerAndOutboxAtomically()throws Exception{
  var h=fixture();var pack=current(h);new AdditionalConfigContract(base.json).validate("RuntimePackage",pack);hashMatches(pack);
  assertThat(pack.path("runtime_policies").size()).isEqualTo(1);assertThat(pack.path("focus_defaults").isNull()).isTrue();assertThat(pack.path("runtime_revision").asLong()).isEqualTo(1);
  assertThat(base.db.queryForObject("SELECT COUNT(*) FROM amvp_outbox WHERE owner_binding_id=? AND payload_sha256=?",Integer.class,h.fixture.binding(),pack.path("payload_sha256").asText())).isEqualTo(1);
 }
 @Test void missingCapabilityAndUnsupportedCarrierRollbackConfigAndPackage()throws Exception{
  var h=fixture();var before=current(h);var cadence=base.auth.obj("executor_id",h.fixture.executor(),"value",example("CadenceConfig"));assertThatThrownBy(()->h.configs.put(h.fixture.identity(),id(),cadence,null,"*",id())).hasMessage("UNSUPPORTED_CONTRACT");
  assertThat(current(h)).isEqualTo(before);assertThat(base.db.queryForObject("SELECT COUNT(*) FROM amvp_configs WHERE owner_binding_id=?",Integer.class,h.fixture.binding())).isEqualTo(1);
  h.selection.put("expires_at","2000-01-01T00:00:00.000Z");assertThatThrownBy(()->current(h)).hasMessage("CAPABILITY_NOT_VERIFIED");
 }
 @Test void immutableReplayAndConcurrentDuplicatesCountOnce()throws Exception{
  var h=fixture();var item=segment(h,1,null);var pool=Executors.newFixedThreadPool(2);
  try{var a=pool.submit(()->send(h,receiver(h,true),item));var b=pool.submit(()->send(h,receiver(h,true),item));assertThat(List.of(a.get().path("items").get(0).path("status").asText(),b.get().path("items").get(0).path("status").asText())).containsExactlyInAnyOrder("ACCEPTED","DUPLICATE");}finally{pool.shutdownNow();}
  assertThat(budget(h)).isEqualTo(5000);var recreated=receiver(h,true);assertThat(recreated.knownStatus(()->bearer(h),h.fixture.executor(),item.path("segment_id").asText()).orElseThrow().path("measurement_state").asText()).isEqualTo("COUNTED");
  var changed=item.deepCopy().put("quality","PARTIAL");seal(changed);assertThat(send(h,recreated,changed).path("items").get(0).path("error_code").asText()).isEqualTo("SOURCE_CONFLICT");assertThat(budget(h)).isEqualTo(5000);
 }
 @Test void gapReservationSurvivesReceiverRecreationAndRejectsPositionReuse()throws Exception{
  var h=fixture();var first=segment(h,1,null);var second=segment(h,2,first);assertThat(send(h,receiver(h,true),second).path("items").get(0).path("status").asText()).isEqualTo("PENDING_DEPENDENCY");
  var duplicatePosition=second.deepCopy().put("segment_id",id());seal(duplicatePosition);assertThat(send(h,receiver(h,true),duplicatePosition).path("items").get(0).path("error_code").asText()).isEqualTo("SEQUENCE_REUSE");
  assertThat(receiver(h,true).knownStatus(()->bearer(h),h.fixture.executor(),second.path("segment_id").asText()).orElseThrow().path("status").asText()).isEqualTo("PENDING_DEPENDENCY");
  send(h,receiver(h,true),first);assertThat(send(h,receiver(h,true),second).path("items").get(0).path("status").asText()).isEqualTo("ACCEPTED");assertThat(budget(h)).isEqualTo(10000);
 }
 @Test void trustedLabelAloneIsQuarantinedAndDoesNotDebitQuota()throws Exception{
  var h=fixture();var item=segment(h,1,null);assertThat(send(h,receiver(h,false),item).path("items").get(0).path("measurement_state").asText()).isEqualTo("QUARANTINED");assertThat(budget(h)).isZero();
  assertThat(send(h,receiver(h,true),item).path("items").get(0).path("measurement_state").asText()).isEqualTo("QUARANTINED");assertThat(budget(h)).isZero();
 }
 @Test void attributionOwnershipHashAndGeometryFailuresDoNotCommit()throws Exception{
  var h=fixture();var item=segment(h,1,null);var wrong=item.deepCopy().put("owner_binding_id",id());seal(wrong);assertThat(send(h,receiver(h,true),wrong).path("items").get(0).path("error_code").asText()).isEqualTo("FORBIDDEN_EXECUTOR");
  var attribution=item.deepCopy();attribution.putArray("policy_attributions");seal(attribution);assertThat(send(h,receiver(h,true),attribution).path("items").get(0).path("error_code").asText()).isEqualTo("POLICY_ATTRIBUTION_MISMATCH");
  var geometry=item.deepCopy().put("confirmed_ms",4999);seal(geometry);assertThat(send(h,receiver(h,true),geometry).path("items").get(0).path("error_code").asText()).isEqualTo("DURATION_MISMATCH");
  var hash=item.deepCopy().put("quality","PARTIAL");assertThat(send(h,receiver(h,true),hash).path("items").get(0).path("error_code").asText()).isEqualTo("HASH_MISMATCH");assertThat(budget(h)).isZero();
 }
 @Test void perItemFailureDoesNotDiscardAnotherItemOrAcceptOverlap()throws Exception{
  var h=fixture();var first=segment(h,1,null);var second=segment(h,2,first);second.put("confirmed_ms",1);seal(second);var result=send(h,receiver(h,true),first,second);assertThat(result.path("items").get(0).path("status").asText()).isEqualTo("ACCEPTED");assertThat(result.path("items").get(1).path("status").asText()).isEqualTo("REJECTED");assertThat(budget(h)).isEqualTo(5000);
  var overlap=segment(h,1,null);overlap.put("collector_epoch",id());seal(overlap);assertThat(send(h,receiver(h,true),overlap).path("items").get(0).path("error_code").asText()).isEqualTo("MONOTONIC_OVERLAP");
 }
 @Test void closedOwnerCannotReadReceiptsAndUnknownStatusDoesNotInventHash()throws Exception{
  var h=fixture();assertThat(receiver(h,false).knownStatus(()->bearer(h),h.fixture.executor(),id())).isEmpty();base.db.update("UPDATE amvp_owner_bindings SET state='CLOSED',closed_at=UTC_TIMESTAMP(3) WHERE binding_id=?",h.fixture.binding());assertThatThrownBy(()->current(h)).hasMessage("STALE_OWNER");assertThatThrownBy(()->receiver(h,false).knownStatus(()->bearer(h),h.fixture.executor(),id())).hasMessage("STALE_OWNER");
 }
 @Test void projectionConflictRollsBackRawInsertAndReceipt()throws Exception{
  var h=fixture();var first=segment(h,1,null);send(h,receiver(h,true),first);var second=segment(h,2,first);second.put("enforcement_day_chain_id",id());seal(second);
  assertThat(send(h,receiver(h,true),second).path("items").get(0).path("error_code").asText()).isEqualTo("DAY_PROJECTION_CONFLICT");assertThat(budget(h)).isEqualTo(5000);assertThat(receiver(h,true).knownStatus(()->bearer(h),h.fixture.executor(),second.path("segment_id").asText())).isEmpty();assertThat(base.db.queryForObject("SELECT COUNT(*) FROM amvp_usage_segments WHERE segment_id=?",Integer.class,second.path("segment_id").asText())).isZero();
 }
 @Test void packageDependencyAndUnverifiedCarryStayExplicit()throws Exception{
  var h=fixture();var item=segment(h,1,null);item.put("package_id",id());seal(item);assertThat(send(h,receiver(h,true),item).path("items").get(0).path("status").asText()).isEqualTo("PENDING_DEPENDENCY");assertThat(budget(h)).isZero();
  var nextFixture=fixture();var next=segment(nextFixture,1,null);var noCarry=new AmvpUsageReceiver(base.auth,base.manager,source(nextFixture.selection),(principal,binding,segment,previous)->new AmvpUsageReceiver.VerifiedCapture(true,Map.of()));assertThat(send(nextFixture,noCarry,next).path("items").get(0).path("measurement_state").asText()).isEqualTo("COUNTED");assertThat(budget(nextFixture)).isZero();
 }
 @Test void immutableAttachmentUsesIssuedContentAndRefusesRebinding()throws Exception{
  var h=fixture();var content=example("ContentConfig");content.putArray("features");for(String field:List.of("keyword","adult","blur"))((ObjectNode)content.path(field)).put("enabled",false);
  String contentId=id();h.configs.put(h.fixture.identity(),contentId,base.auth.obj("executor_id",h.fixture.executor(),"value",content),null,"*",id());
  var request=example("FocusAttachmentRequest");request.put("executor_id",h.fixture.executor()).put("config_revision",2);var expected=request.path("focus_ref").deepCopy();
  var factory=new AmvpFocusAttachments(base.auth,base.manager,source(h.selection),(principal,binding,ref)->check(ref.equals(expected),409,"SNAPSHOT_MISMATCH"));String key=id();var attached=factory.issue(h.fixture.identity(),request,key);
  assertThat(attached.path("config_revision").asLong()).isEqualTo(2);hashMatches(attached);
  h.configs.put(h.fixture.identity(),contentId,base.auth.obj("executor_id",h.fixture.executor(),"value",content),"\"1\"",null,id());assertThat(AdditionalConfigContract.canonical(factory.issue(h.fixture.identity(),request,key))).isEqualTo(AdditionalConfigContract.canonical(attached));assertThat(AdditionalConfigContract.canonical(factory.issue(h.fixture.identity(),request,id()))).isEqualTo(AdditionalConfigContract.canonical(attached));
  var replacement=request.deepCopy().put("config_revision",3);assertThatThrownBy(()->factory.issue(h.fixture.identity(),replacement,key)).hasMessage("IDEMPOTENCY_CONFLICT");assertThatThrownBy(()->factory.issue(h.fixture.identity(),replacement,id())).hasMessage("SOURCE_CONFLICT");
  assertThat(base.db.queryForObject("SELECT COUNT(*) FROM amvp_focus_attachments WHERE owner_binding_id=?",Integer.class,h.fixture.binding())).isEqualTo(1);
 }
 @Test void realBearerTransportDoesNotSuspendItsOwnLockAndRejectsRevocation()throws Exception{
  var h=fixture();var token=new TransactionTemplate(base.manager).execute(tx->base.auth.mint(h.fixture.executor(),h.fixture.identity().user(),id(),1)).path("access_token").asText();
  var beans=new StaticListableBeanFactory();beans.addBean("capability",source(h.selection));beans.addBean("clock",(AmvpUsageReceiver.ClockProof)(principal,binding,item,previous)->new AmvpUsageReceiver.VerifiedCapture(true,Map.of(h.policy.path("policy_id").asText(),0L)));
  var http=MockMvcBuilders.standaloneSetup(new AmvpRuntimeBridgeApi(base.auth,base.manager,beans.getBeanProvider(CapabilitySource.class),beans.getBeanProvider(AmvpUsageReceiver.ClockProof.class),beans.getBeanProvider(AmvpFocusAttachments.FrozenFocusProof.class))).build();
  http.perform(get("/api/v1/amvp/runtime-packages/current").header("Authorization","Bearer "+token).param("executor_id",h.fixture.executor())).andExpect(status().isOk()).andExpect(jsonPath("$.owner_binding_id").value(h.fixture.binding()));
  var first=segment(h,1,null);var second=segment(h,2,first);http.perform(post("/api/v1/amvp/usage/batch").header("Authorization","Bearer "+token).contentType("application/json").content(batch(h,first,second).toString())).andExpect(status().isOk()).andExpect(jsonPath("$.items[0].status").value("ACCEPTED")).andExpect(jsonPath("$.items[1].status").value("ACCEPTED"));assertThat(budget(h)).isEqualTo(10000);
  base.db.update("UPDATE extension_tokens SET revoked_at=UTC_TIMESTAMP(3) WHERE executor_id=?",h.fixture.executor());http.perform(get("/api/v1/amvp/runtime-packages/current").header("Authorization","Bearer "+token).param("executor_id",h.fixture.executor())).andExpect(status().isUnauthorized());assertThat(budget(h)).isEqualTo(10000);
 }
 @Test void allMatchingQuotaCountsEachConstraintButStatisticsCountsTheCaptureOnlyOnce()throws Exception{
  var h=fixture();var second=h.policy.deepCopy().put("policy_id",id());h.configs.put(h.fixture.identity(),second.path("policy_id").asText(),base.auth.obj("executor_id",h.fixture.executor(),"value",second),null,"*",id());
  var item=segment(h,1,null);((com.fasterxml.jackson.databind.node.ArrayNode)item.path("policy_attributions")).add(base.auth.obj("policy_id",second.path("policy_id").asText(),"policy_version",1,"matched_policy_host","example.org"));seal(item);
  var receiver=new AmvpUsageReceiver(base.auth,base.manager,source(h.selection),(principal,binding,segment,previous)->new AmvpUsageReceiver.VerifiedCapture(true,Map.of(h.policy.path("policy_id").asText(),0L,second.path("policy_id").asText(),0L)));
  assertThat(send(h,receiver,item).path("items").get(0).path("measurement_state").asText()).isEqualTo("COUNTED");assertThat(budget(h)).isEqualTo(10000);
  var statistics=new AdditionalUsageStatistics(base.auth,base.manager,h.publisher);var range=new AdditionalUsageStatistics.Range("INSTALLATION",h.fixture.executor(),LocalDate.of(2026,10,29),LocalDate.of(2026,10,29));assertThat(statistics.query(h.fixture.identity(),range).path("browser_ms").asLong()).isEqualTo(5000);
  base.db.update("UPDATE amvp_owner_bindings SET state='CLOSED',closed_at=UTC_TIMESTAMP(3) WHERE binding_id=?",h.fixture.binding());base.db.update("UPDATE extension_installations SET current_user_id=NULL WHERE id=?",h.fixture.executor());assertThat(statistics.query(h.fixture.identity(),range).path("browser_ms").asLong()).isEqualTo(5000);
 }
 @Test void missingServerAnchorCannotBeReplacedByTrustedTextOrVerifierBoolean()throws Exception{
  var h=fixture();var item=segment(h,1,null);((ObjectNode)item.path("clock")).put("anchor_id",id());seal(item);assertThat(send(h,receiver(h,true),item).path("items").get(0).path("measurement_state").asText()).isEqualTo("QUARANTINED");assertThat(budget(h)).isZero();
 }
}
