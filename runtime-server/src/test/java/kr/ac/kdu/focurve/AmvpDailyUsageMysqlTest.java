package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.*;
import java.sql.Timestamp;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static kr.ac.kdu.focurve.MemberAuth.*;
import static kr.ac.kdu.focurve.AmvpBridgeSupport.*;

/** Actual DAY HTTP/auth/JDBC reads. Capability, anchor and seeded calendar proofs are SYNTHETIC. */
@EnabledIfEnvironmentVariable(named="FOCURVE_AMVP_TEST_URL",matches="jdbc:mysql://127\\.0\\.0\\.1:[0-9]+/amvp_test_[a-f0-9]+.*")
@EnabledIfEnvironmentVariable(named="FOCURVE_AMVP_DAILY_TESTS",matches="1")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class AmvpDailyUsageMysqlTest {
 final AmvpRuntimeBridgeMysqlTest helper=new AmvpRuntimeBridgeMysqlTest();
 @BeforeAll void schema(){helper.schema();}
 AmvpDailyUsage reader(AmvpRuntimeBridgeMysqlTest.Harness h){return new AmvpDailyUsage(helper.base.auth,helper.base.manager,h.publisher());}
 ObjectNode read(AmvpRuntimeBridgeMysqlTest.Harness h){return reader(h).get(h.fixture().identity(),h.policy().path("policy_id").asText(),new AmvpDailyUsage.Query(h.fixture().executor(),LocalDate.parse("2026-10-29")));}
 void receive(AmvpRuntimeBridgeMysqlTest.Harness h)throws Exception{helper.send(h,helper.receiver(h,true),helper.segment(h,1,null));}
 @Test void deletedPolicyUsageRemainsDiscoverableOverTcpAndCannotMoveToAReplacementPolicy()throws Exception{
  var h=helper.fixture();receive(h);var a=helper.base.auth;String original=h.policy().path("policy_id").asText();
  h.configs().delete(h.fixture().identity(),original,"\"1\"",id());
  String replacement=id();var next=h.policy().deepCopy().put("policy_id",replacement).put("daily_limit_ms",120000);
  h.configs().put(h.fixture().identity(),replacement,a.obj("executor_id",h.fixture().executor(),"value",next),null,"*",id());
  assertThatThrownBy(()->h.configs().put(h.fixture().identity(),original,a.obj("executor_id",h.fixture().executor(),"value",h.policy()),"\"2\"",null,id())).hasMessage("VERSION_CONFLICT");
  String token=new TransactionTemplate(helper.base.manager).execute(tx->a.mint(h.fixture().executor(),h.fixture().identity().user(),id(),1)).path("access_token").asText();
  var source=helper.source(h.selection());
  String before=a.db.queryForList("SELECT * FROM amvp_day_budgets WHERE executor_id=?",h.fixture().executor()).toString()+a.db.queryForList("SELECT * FROM amvp_operations WHERE owner_binding_id=? ORDER BY operation_id",h.fixture().binding());
  // Real TCP/controller/auth/SQL, with deliberately synthetic authority providers.
  try(var http=new AmvpLoopbackHttp(a,helper.base.manager,h.publisher(),source,(p,b,r,pack,prev)->new AmvpReportReceiver.VerifiedReport(Set.of()),(p,b,s,prev)->AmvpUsageReceiver.VerifiedCapture.quarantine())){
   var history=http.send("GET","/api/v1/amvp/web/site-time-deletions?executor_id="+h.fixture().executor(),token,null);
   assertThat(history.statusCode()).isEqualTo(200);assertThat(a.json.readTree(history.body()).path("items").get(0).path("config_id").asText()).isEqualTo(original);
   String query="?executor_id="+h.fixture().executor()+"&date=2026-10-29";
   var response=http.send("GET","/api/v1/amvp/site-time-policies/"+original+"/usage"+query,token,null);
   assertThat(response.statusCode()).isEqualTo(200);var result=a.json.readTree(response.body());
   assertThat(result.path("confirmed_ms").asLong()).isEqualTo(5000);assertThat(result.path("daily_limit_ms").asLong()).isEqualTo(60000);
   assertThat(result.path("remaining_ms").isNull()).isTrue();assertThat(result.path("enforcement_state").asText()).isEqualTo("UNKNOWN");
   assertThat(http.send("GET","/api/v1/amvp/site-time-policies/"+replacement+"/usage"+query,token,null).statusCode()).isEqualTo(404);
   assertThat(http.send("GET","/api/v1/amvp/site-time-policies/"+original+"/usage?executor_id="+id()+"&date=2026-10-29",token,null).statusCode()).isEqualTo(403);
  }
  assertThat(a.db.queryForList("SELECT * FROM amvp_day_budgets WHERE executor_id=?",h.fixture().executor()).toString()+a.db.queryForList("SELECT * FROM amvp_operations WHERE owner_binding_id=? ORDER BY operation_id",h.fixture().binding())).isEqualTo(before);
 }
 @Test void readsCountedPrefixWithoutInventingLiveQuotaAndWritesNothing()throws Exception{
  var h=helper.fixture();receive(h);long receipts=helper.base.db.queryForObject("SELECT COUNT(*) FROM amvp_operations",Long.class);var before=helper.base.db.queryForList("SELECT * FROM amvp_day_budgets WHERE executor_id=?",h.fixture().executor());
  var result=read(h);new AdditionalConfigContract(helper.base.json).validate("DailyUsage",result);
  assertThat(result.path("confirmed_ms").asLong()).isEqualTo(5000);assertThat(result.path("remaining_ms").isNull()).isTrue();assertThat(result.path("enforcement_state").asText()).isEqualTo("UNKNOWN");assertThat(result.path("quality").asText()).isEqualTo("PARTIAL");assertThat(result.path("next_usable_at").isNull()).isTrue();
  assertThat(read(h).path("confirmed_ms")).isEqualTo(result.path("confirmed_ms"));assertThat(helper.base.db.queryForList("SELECT * FROM amvp_day_budgets WHERE executor_id=?",h.fixture().executor())).isEqualTo(before);assertThat(helper.base.db.queryForObject("SELECT COUNT(*) FROM amvp_operations",Long.class)).isEqualTo(receipts);
 }
 @Test void noDataOrQuarantineDoesNotBecomeZero()throws Exception{
  var h=helper.fixture();assertThatThrownBy(()->read(h)).hasMessage("RESOURCE_NOT_FOUND");helper.send(h,helper.receiver(h,false),helper.segment(h,1,null));assertThatThrownBy(()->read(h)).hasMessage("RESOURCE_NOT_FOUND");
 }
 @Test void laterUncertainCaptureRemainsStoredButDoesNotInflateConfirmedPrefix()throws Exception{
  var h=helper.fixture();var first=helper.segment(h,1,null);helper.send(h,helper.receiver(h,true),first);
  var second=helper.segment(h,2,first);var ack=helper.send(h,helper.receiver(h,false),second);
  assertThat(ack.path("items").get(0).path("measurement_state").asText()).isEqualTo("QUARANTINED");
  assertThat(read(h).path("confirmed_ms").asLong()).isEqualTo(5000);
  assertThat(read(h).path("remaining_ms").isNull()).isTrue();assertThat(helper.budget(h)).isEqualTo(5000);
  assertThat(helper.base.db.queryForObject("SELECT COUNT(*) FROM amvp_usage_segments WHERE executor_id=?",Long.class,h.fixture().executor())).isEqualTo(2);
 }
 @Test void ownerAndBearerExecutorCannotReadAnotherResource()throws Exception{
  var h=helper.fixture();receive(h);var query=new AmvpDailyUsage.Query(h.fixture().executor(),LocalDate.parse("2026-10-29"));
  assertThatThrownBy(()->reader(h).get(new Identity(h.fixture().identity().user()+1000,null),h.policy().path("policy_id").asText(),query)).hasMessage("RESOURCE_NOT_FOUND");
  assertThatThrownBy(()->reader(h).get(new Identity(h.fixture().identity().user(),id()),h.policy().path("policy_id").asText(),query)).hasMessage("FORBIDDEN_EXECUTOR");
  assertThatThrownBy(()->reader(h).get(h.fixture().identity(),id(),query)).hasMessage("RESOURCE_NOT_FOUND");
 }
 @Test void originalMemberHistoryRemainsOwnedAfterInstallationTransfer()throws Exception{
  var h=helper.fixture();receive(h);var next=helper.base.fixture();helper.base.db.update("UPDATE amvp_owner_bindings SET state='CLOSED',closed_at=UTC_TIMESTAMP(3) WHERE binding_id=?",h.fixture().binding());helper.base.db.update("UPDATE extension_installations SET current_user_id=? WHERE id=?",next.identity().user(),h.fixture().executor());
  assertThat(read(h).path("confirmed_ms").asLong()).isEqualTo(5000);
  assertThatThrownBy(()->reader(h).get(next.identity(),h.policy().path("policy_id").asText(),new AmvpDailyUsage.Query(h.fixture().executor(),LocalDate.parse("2026-10-29")))).hasMessage("RESOURCE_NOT_FOUND");
 }
 @Test void inconsistentCacheFailsClosedAndDoesNotRepairOrResetIt()throws Exception{
  var h=helper.fixture();receive(h);helper.base.db.update("UPDATE amvp_day_budgets SET confirmed_ms=5001 WHERE executor_id=?",h.fixture().executor());assertThatThrownBy(()->read(h)).hasMessage("STORE_UNCONFIRMED");assertThat(helper.budget(h)).isEqualTo(5001);
 }
 // Seed verified capture metadata directly in the new test DB. This is NOT a clock producer proof.
 void seed(AmvpRuntimeBridgeMysqlTest.Harness h,LocalDate date,String zone,Instant first,Instant last,long seq)throws Exception{
  var item=helper.segment(h,seq,null);Instant start=first.plusSeconds(1),end=start.plusSeconds(5);String anchorId=id();
  if(seq>1)item.put("previous_segment_sha256",helper.base.db.queryForObject("SELECT payload_sha256 FROM amvp_usage_segments WHERE executor_id=? AND local_usage_seq=?",String.class,h.fixture().executor(),seq-1));
  item.put("timezone",zone).put("timezone_version",seq).put("day_start_at",utc(first)).put("day_end_at",utc(last)).put("start_at",utc(start)).put("end_at",utc(end));
  var c=(ObjectNode)item.path("clock");c.put("anchor_id",anchorId).put("anchor_utc",utc(start)).put("anchor_mono_ms",0).put("mono_start_ms",0).put("mono_end_ms",5000).put("boot_id",anchorId).put("observed_wall_start_at",utc(start)).put("observed_wall_end_at",utc(end));seal(item);
  helper.base.db.update("INSERT INTO amvp_usage_segments(segment_id,owner_binding_id,executor_id,collector_epoch,local_usage_seq,actual_host,start_at,end_at,confirmed_ms,uncertain_ms,payload_json,payload_sha256,clock_epoch,clock_boot_id,mono_start_ms,mono_end_ms,measurement_state) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",item.path("segment_id").asText(),h.fixture().binding(),h.fixture().executor(),h.fixture().binding(),seq,"example.org",Timestamp.from(start),Timestamp.from(end),5000,0,AdditionalConfigContract.canonical(item),item.path("payload_sha256").asText(),"clock-fixture",anchorId,0,5000,"COUNTED");
  helper.base.db.update("INSERT INTO amvp_day_budgets VALUES(?,?,?,?,?,?,?,?,1)",h.fixture().executor(),h.policy().path("policy_id").asText(),Timestamp.from(first),Timestamp.from(last),h.fixture().binding(),5000,7000,60000);
 }
 @Test void historicalCaptureTimezoneAndDstDayLengthsArePreserved()throws Exception{
  for(String day:List.of("2026-03-08","2026-11-01")){
   var h=helper.fixture();var date=LocalDate.parse(day);var zone=ZoneId.of("America/New_York");Instant first=date.atStartOfDay(zone).toInstant(),last=date.plusDays(1).atStartOfDay(zone).toInstant();seed(h,date,zone.getId(),first,last,1);
   var value=reader(h).get(h.fixture().identity(),h.policy().path("policy_id").asText(),new AmvpDailyUsage.Query(h.fixture().executor(),date));
   assertThat(value.path("timezone").asText()).isEqualTo("America/New_York");assertThat(value.path("day_kind").asText()).isEqualTo("NORMAL");assertThat(value.path("budget_carry_debit_ms").asLong()).isEqualTo(7000);assertThat(Duration.between(Instant.parse(value.path("day_start_at").asText()),Instant.parse(value.path("day_end_at").asText())).toHours()).isEqualTo(day.contains("03-08")?23:25);
  }
 }
 @Test void overlappingLocalDateTransitionBucketsAreNotSilentlyMerged()throws Exception{
  var h=helper.fixture();var date=LocalDate.parse("2026-10-29");seed(h,date,"UTC",Instant.parse("2026-10-29T00:00:00Z"),Instant.parse("2026-10-30T00:00:00Z"),1);
  seed(h,date,"America/New_York",Instant.parse("2026-10-30T00:00:00Z"),Instant.parse("2026-10-30T04:00:00Z"),2);assertThatThrownBy(()->read(h)).hasMessage("STORE_UNCONFIRMED");
 }
 @Test void realBearerHttpAndRevocationPreserveData()throws Exception{
  var h=helper.fixture();receive(h);String token=new TransactionTemplate(helper.base.manager).execute(tx->helper.base.auth.mint(h.fixture().executor(),h.fixture().identity().user(),id(),1)).path("access_token").asText();
  var beans=new StaticListableBeanFactory();beans.addBean("admission",h.publisher());var http=MockMvcBuilders.standaloneSetup(new AmvpDailyUsageApi(helper.base.auth,helper.base.manager,beans.getBeanProvider(AdditionalConfigStore.Admission.class))).build();
  String path="/api/v1/amvp/site-time-policies/"+h.policy().path("policy_id").asText()+"/usage";
  http.perform(get(path).header("Authorization","Bearer "+token).param("executor_id",h.fixture().executor()).param("date","2026-10-29")).andExpect(status().isOk()).andExpect(jsonPath("$.confirmed_ms").value(5000)).andExpect(jsonPath("$.enforcement_state").value("UNKNOWN"));
  helper.base.db.update("UPDATE extension_tokens SET revoked_at=UTC_TIMESTAMP(3) WHERE executor_id=?",h.fixture().executor());http.perform(get(path).header("Authorization","Bearer "+token).param("executor_id",h.fixture().executor()).param("date","2026-10-29")).andExpect(status().isUnauthorized());assertThat(helper.budget(h)).isEqualTo(5000);
 }
}
