package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static kr.ac.kdu.focurve.MemberAuth.*;
import static kr.ac.kdu.focurve.AmvpBridgeSupport.*;

/** Real isolated JDBC and bearer HTTP. The actor and effect proof producer are SYNTHETIC. */
@EnabledIfEnvironmentVariable(named="FOCURVE_AMVP_TEST_URL",matches="jdbc:mysql://127\\.0\\.0\\.1:[0-9]+/amvp_test_[a-f0-9]+.*")
@EnabledIfEnvironmentVariable(named="FOCURVE_AMVP_SCHEDULE_TESTS",matches="1")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class AmvpScheduleMysqlTest {
 final AmvpRuntimeBridgeMysqlTest helper=new AmvpRuntimeBridgeMysqlTest();
 final Instant start=Instant.parse("2026-10-29T09:00:00Z");
 @BeforeAll void schema(){helper.schema();var ds=helper.base.db.getDataSource();new ResourceDatabasePopulator(new ClassPathResource("amvp/schedule-bridge.sql")).execute(ds);}
 record Fixture(AmvpRuntimeBridgeMysqlTest.Harness base,AmvpScheduleBridge bridge,AdditionalConfigStore store,ObjectNode config,AmvpScheduleBridge.Actor actor){}
 Fixture fixture(Instant at,boolean connected)throws Exception{
  var h=helper.fixture();var actor=new AmvpScheduleBridge.Actor(){
   public ObjectNode enqueue(Identity principal,AmvpScheduleBridge.Request request){
    var a=helper.base.auth;String sid=id(),snapshot=id();var session=a.obj("session_id",sid,"executor_id",request.owner().executor(),"source","SCHEDULE","execution_status","STARTING","planned_end_at",utc(request.end()),"desired_revision",1,"policy_snapshot_id",snapshot);
    a.db.update("INSERT INTO policy_snapshots(id,user_id,executor_id,format_version,payload,payload_hash,created_at) VALUES(?,?,?,'1.1','{}',?,UTC_TIMESTAMP(3))",snapshot,principal.user(),principal.executor(),hash("{}"));
    a.db.update("INSERT INTO focus_sessions(source_session_id,user_id,executor_id,policy_snapshot_id,execution_status,duration_minutes,desired_revision,body,source,origin,record_status) VALUES(?,?,?,?,'STARTING',10,1,?,'SCHEDULE','MEMBER','PENDING')",sid,principal.user(),principal.executor(),snapshot,session.toString());
    long internal=a.db.queryForObject("SELECT id FROM focus_sessions WHERE source_session_id=?",Long.class,sid);
    a.db.update("INSERT INTO active_execution_locks VALUES(?,?,?,1)",principal.user(),principal.executor(),internal);
    a.db.update("INSERT INTO execution_commands VALUES(?,?,?,1,'APPLY_POLICY','{}','PENDING',UTC_TIMESTAMP(3),NULL)",id(),internal,principal.executor());return session;
   }
   public void verifyReport(Identity principal,AmvpScheduleBridge.Request request,ObjectNode report){check(report.path("synthetic_effect_verified").asBoolean(),409,"RESPONSE_UNCONFIRMED");}
  };
  var bridge=new AmvpScheduleBridge(helper.base.auth,h.publisher(),connected?actor:null,Clock.fixed(at,ZoneOffset.UTC));
  var store=new AdditionalConfigStore(helper.base.auth,helper.base.manager,bridge);var value=helper.example("FocusSchedule");String id=id();value.put("schedule_id",id).put("enabled",true).put("duration_minutes",10);value.set("when",helper.base.auth.obj("recurrence","WEEKLY","weekdays",List.of(4),"start_local","09:00","timezone","UTC","dst_gap","SKIP","dst_overlap","EARLIER_ONCE"));
  var config=store.put(h.fixture().identity(),id,helper.base.auth.obj("executor_id",h.fixture().executor(),"value",value),null,"*",id());return new Fixture(h,bridge,store,config,actor);
 }
 Identity bearer(Fixture f){return helper.bearer(f.base);}
 ObjectNode body(Fixture f){return helper.base.auth.obj("schedule_id",f.config.path("config_id").asText(),"version",f.config.path("version").asLong(),"scheduled_start_at",utc(start));}
 ObjectNode claim(Fixture f){return new TransactionTemplate(helper.base.manager).execute(tx->f.bridge.claim(bearer(f),body(f)));}
 ObjectNode row(Fixture f){return new TransactionTemplate(helper.base.manager).execute(tx->f.bridge.occurrences(f.base.fixture().identity(),f.config.path("config_id").asText())).path("items").get(0).deepCopy();}
 void report(Fixture f,String state,String result,boolean verified,Instant observed){
  String sid=row(f).path("session_id").asText();var a=helper.base.auth;var record=a.one("SELECT * FROM focus_sessions WHERE source_session_id=?",sid);var session=parse(record.get("body"));long revision=result.equals("RELEASED")?2:1;session.put("execution_status",state).put("desired_revision",revision);if(state.equals("ENDED"))session.put("policy_released_at",utc(observed));a.db.update("UPDATE focus_sessions SET execution_status=?,desired_revision=?,body=? WHERE id=?",state,revision,session.toString(),record.get("id"));
  var payload=a.obj("report_id",id(),"session_id",sid,"result",result,"desired_revision",revision,"rollback_confirmed",result.equals("RELEASED"),"synthetic_effect_verified",verified);
  String command;
  if(result.equals("RELEASED")){command=id();a.db.update("INSERT INTO execution_commands VALUES(?,?,?,2,'RELEASE_POLICY','{}','PENDING',UTC_TIMESTAMP(3),NULL)",command,record.get("id"),f.base.fixture().executor());}
  else command=a.db.queryForObject("SELECT id FROM execution_commands WHERE session_id=? AND desired_revision=1",String.class,record.get("id"));
  a.db.update("INSERT INTO execution_reports(id,session_id,command_id,executor_id,desired_revision,payload_hash,result,observed_at,payload) VALUES(?,?,?,?,?,?,?,?,?)",payload.path("report_id").asText(),record.get("id"),command,f.base.fixture().executor(),revision,hash(payload.toString()),result,Timestamp.from(observed),payload.toString());
  if(state.equals("ENDED"))a.db.update("DELETE FROM active_execution_locks WHERE session_id=?",record.get("id")); // synthetic normal release producer, isolated DB only
 }
 ObjectNode parse(Object raw){try{return (ObjectNode)helper.base.json.readTree(raw.toString());}catch(Exception e){throw new AssertionError(e);}}
 @Test void settingsPublishOnlyToTheSingleLegacyActorRow()throws Exception{
  var f=fixture(start,true);assertThat(f.config.path("runtime_apply_state").asText()).isEqualTo("PENDING");
  assertThat(helper.base.db.queryForObject("SELECT COUNT(*) FROM schedules WHERE id=?",Integer.class,f.config.path("config_id").asText())).isEqualTo(1);
  assertThat(helper.base.db.queryForObject("SELECT COUNT(*) FROM amvp_outbox WHERE owner_binding_id=?",Integer.class,f.base.fixture().binding())).isEqualTo(1); // existing SITE_TIME only
  assertThat(new TransactionTemplate(helper.base.manager).execute(tx->f.bridge.schedules(bearer(f),f.base.fixture().executor())).path("items").size()).isEqualTo(1);
 }
 @Test void claimIsIdempotentAndKeepsOriginalFixedEnd()throws Exception{
  var f=fixture(start.plusSeconds(20),true);var first=claim(f);assertThat(first.path("execution_status").asText()).isEqualTo("STARTING");claim(f);
  assertThat(row(f).path("scheduled_end_at").asText()).isEqualTo(utc(start.plusSeconds(600)));
  assertThat(helper.base.db.queryForObject("SELECT COUNT(*) FROM focus_sessions WHERE executor_id=?",Integer.class,f.base.fixture().executor())).isEqualTo(1);
 }
 @Test void exactSixtySecondsCanStartButLessThanSixtySkips()throws Exception{
  var exact=fixture(start.plusSeconds(540),true);assertThat(claim(exact).path("execution_status").asText()).isEqualTo("STARTING");
  var late=fixture(start.plusSeconds(540).plusMillis(1),true);assertThat(claim(late).path("status").asText()).isEqualTo("SKIPPED");assertThat(row(late).path("reason").asText()).isEqualTo("EXPIRED");
 }
 @Test void absentActorNeverCreatesAFakeExecution()throws Exception{
  var f=fixture(start,false);assertThatThrownBy(()->claim(f)).hasMessage("CAPABILITY_NOT_VERIFIED");
  assertThat(helper.base.db.queryForObject("SELECT COUNT(*) FROM schedule_occurrences WHERE schedule_id=?",Integer.class,f.config.path("config_id").asText())).isZero();
 }
 @Test void activeSessionWinsAndDeletingAnUnstartedOccurrenceOnlyCancelsThatOccurrence()throws Exception{
  var f=fixture(start,true);claim(f);var value=(ObjectNode)f.config.path("value").deepCopy();String second=id();value.put("schedule_id",second);
  var config=f.store.put(f.base.fixture().identity(),second,helper.base.auth.obj("executor_id",f.base.fixture().executor(),"value",value),null,"*",id());
  var waiting=new Fixture(f.base,f.bridge,f.store,config,f.actor);assertThat(claim(waiting).path("status").asText()).isEqualTo("WAITING_CONFLICT");
  f.store.delete(f.base.fixture().identity(),second,"\"1\"",id());assertThat(row(waiting).path("reason").asText()).isEqualTo("CONFIG_CHANGED");assertThat(row(f).path("session_id").asText()).isNotBlank();
 }
 @Test void changedOwnerAndWrongVersionCannotClaim()throws Exception{
  var f=fixture(start,true);var bad=body(f).put("version",2);assertThatThrownBy(()->new TransactionTemplate(helper.base.manager).execute(tx->f.bridge.claim(bearer(f),bad))).hasMessage("VERSION_CONFLICT");
  helper.base.db.update("UPDATE extension_installations SET current_user_id=NULL WHERE id=?",f.base.fixture().executor());assertThatThrownBy(()->claim(f)).hasMessage("RESOURCE_NOT_FOUND");
 }
 @Test void secondFoldInstantIsRejectedByTheActorBoundary()throws Exception{
  var earlier=Instant.parse("2026-11-01T05:30:00Z");var f=fixture(earlier,true);var value=(ObjectNode)f.config.path("value").deepCopy();value.set("when",helper.base.auth.obj("recurrence","WEEKLY","weekdays",List.of(7),"start_local","01:30","timezone","America/New_York","dst_gap","SKIP","dst_overlap","EARLIER_ONCE"));
  f.store.put(f.base.fixture().identity(),f.config.path("config_id").asText(),helper.base.auth.obj("executor_id",f.base.fixture().executor(),"value",value),"\"1\"",null,id());
  var request=body(f).put("version",2).put("scheduled_start_at",utc(earlier.plusSeconds(3600)));assertThatThrownBy(()->new TransactionTemplate(helper.base.manager).execute(tx->f.bridge.claim(bearer(f),request))).hasMessage("VALIDATION_FAILED");
  request.put("scheduled_start_at",utc(earlier));assertThat(new TransactionTemplate(helper.base.manager).execute(tx->f.bridge.claim(bearer(f),request)).path("execution_status").asText()).isEqualTo("STARTING");
 }
 @Test void resultRequiresActualProofAndReleaseIsSeparateFromApply()throws Exception{
  var f=fixture(start,true);claim(f);report(f,"RUNNING","APPLIED",false,start.plusSeconds(1));assertThat(row(f).path("reason").asText()).isEqualTo("EVIDENCE_UNCONFIRMED");
  report(f,"RUNNING","APPLIED",true,start.plusSeconds(2));assertThat(row(f).path("status").asText()).isEqualTo("RUNNING");
  report(f,"ENDED","RELEASED",true,start.plusSeconds(600));assertThat(row(f).path("status").asText()).isEqualTo("FINISHED");
  var recreated=new AmvpScheduleBridge(helper.base.auth,f.base.publisher(),f.actor,Clock.systemUTC());
  assertThat(new TransactionTemplate(helper.base.manager).execute(tx->recreated.occurrences(bearer(f),f.config.path("config_id").asText())).path("items").get(0).path("status").asText()).isEqualTo("FINISHED");
 }
 @Test void delayedSuccessCannotOverwriteFailureHistory()throws Exception{
  var f=fixture(start,true);claim(f);report(f,"UNKNOWN","UNCONFIRMED",true,start.plusSeconds(3));report(f,"RUNNING","APPLIED",true,start.plusSeconds(2));
  assertThat(row(f).path("reason").asText()).isEqualTo("EXECUTION_UNKNOWN");
  assertThat(helper.base.db.queryForObject("SELECT COUNT(*) FROM execution_reports WHERE executor_id=?",Integer.class,f.base.fixture().executor())).isEqualTo(2);
 }
 @Test void mismatchedAckRevisionCannotConfirmApply()throws Exception{
  var f=fixture(start,true);claim(f);report(f,"RUNNING","APPLIED",true,start.plusSeconds(1));helper.base.db.update("UPDATE execution_reports SET desired_revision=2 WHERE executor_id=?",f.base.fixture().executor());assertThat(row(f).path("reason").asText()).isEqualTo("EVIDENCE_UNCONFIRMED");
 }
 @Test void confirmedReleaseDoesNotEraseAnUnconfirmedExecution()throws Exception{
  var f=fixture(start,true);claim(f);report(f,"UNKNOWN","UNCONFIRMED",true,start.plusSeconds(1));report(f,"ENDED","RELEASED",true,start.plusSeconds(600));assertThat(row(f).path("status").asText()).isEqualTo("FINISHED");assertThat(row(f).path("reason").asText()).isEqualTo("EXECUTION_UNKNOWN");
 }
 @Test void aRemainingDatabaseLockPreventsReleaseConfirmation()throws Exception{
  var f=fixture(start,true);claim(f);report(f,"ENDED","RELEASED",true,start.plusSeconds(600));String sid=row(f).path("session_id").asText();long internal=helper.base.db.queryForObject("SELECT id FROM focus_sessions WHERE source_session_id=?",Long.class,sid);
  helper.base.db.update("INSERT INTO active_execution_locks VALUES(?,?,?,1)",f.base.fixture().identity().user(),f.base.fixture().executor(),internal);assertThat(row(f).path("reason").asText()).isEqualTo("EVIDENCE_UNCONFIRMED");
 }
 @Test void configChangeAndDeletionRetainTheIssuedSession()throws Exception{
  var f=fixture(start,true);claim(f);String session=row(f).path("session_id").asText();var value=f.config.path("value").deepCopy();((ObjectNode)value).put("duration_minutes",5);
  var saved=f.store.put(f.base.fixture().identity(),f.config.path("config_id").asText(),helper.base.auth.obj("executor_id",f.base.fixture().executor(),"value",value),"\"1\"",null,id());
  assertThat(saved.path("version").asLong()).isEqualTo(2);assertThatThrownBy(()->claim(f)).hasMessage("VERSION_CONFLICT");
  assertThatThrownBy(()->new TransactionTemplate(helper.base.manager).execute(tx->f.bridge.claim(bearer(f),body(f).put("version",2)))).hasMessage("VERSION_CONFLICT");
  f.store.delete(f.base.fixture().identity(),f.config.path("config_id").asText(),"\"2\"",id());assertThat(row(f).path("session_id").asText()).isEqualTo(session);assertThat(row(f).path("schedule_version").asLong()).isEqualTo(1);assertThat(row(f).path("scheduled_end_at").asText()).isEqualTo(utc(start.plusSeconds(600)));
 }
 @Test void legacyOnceAndSecondFoldAreNotInvented()throws Exception{
  var f=fixture(start,true);var value=(ObjectNode)f.config.path("value").deepCopy();value.set("when",helper.base.auth.obj("recurrence","ONCE","start_at",utc(start)));
  assertThatThrownBy(()->f.store.put(f.base.fixture().identity(),f.config.path("config_id").asText(),helper.base.auth.obj("executor_id",f.base.fixture().executor(),"value",value),"\"1\"",null,id())).hasMessage("UNSUPPORTED_CONTRACT");
  assertThat(f.store.get(f.base.fixture().identity(),f.config.path("config_id").asText()).path("version").asLong()).isEqualTo(1);
 }
 @Test void concurrentClaimsDispatchOnlyOnce()throws Exception{
  var f=fixture(start,true);var pool=Executors.newFixedThreadPool(2);try{var results=pool.invokeAll(List.of(()->claim(f),()->claim(f)));for(var result:results)result.get(10,TimeUnit.SECONDS);}finally{pool.shutdownNow();}
  assertThat(helper.base.db.queryForObject("SELECT COUNT(*) FROM focus_sessions WHERE executor_id=?",Integer.class,f.base.fixture().executor())).isEqualTo(1);
 }
 @Test void existingBearerRoutesRejectForeignOwnerAndRevokedToken()throws Exception{
  var f=fixture(Instant.now(),true);var a=helper.base.auth;var token=new TransactionTemplate(helper.base.manager).execute(tx->a.mint(f.base.fixture().executor(),f.base.fixture().identity().user(),id(),1)).path("access_token").asText();
  var beans=new StaticListableBeanFactory();beans.addBean("admission",f.bridge);beans.addBean("actor",f.actor);
  var http=MockMvcBuilders.standaloneSetup(new AmvpScheduleApi(a,helper.base.manager,beans.getBeanProvider(AdditionalConfigStore.Admission.class),beans.getBeanProvider(AmvpScheduleBridge.Actor.class))).build();
  http.perform(get("/api/v1/schedules").param("executor_id",f.base.fixture().executor()).header("Authorization","Bearer "+token)).andExpect(status().isOk()).andExpect(jsonPath("$.items[0].schedule_id").value(f.config.path("config_id").asText()));
  var at=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MINUTES);var local=at.atZone(ZoneOffset.UTC);var value=(ObjectNode)f.config.path("value").deepCopy();value.set("when",a.obj("recurrence","WEEKLY","weekdays",List.of(local.getDayOfWeek().getValue()),"start_local",local.toLocalTime().toString(),"timezone","UTC","dst_gap","SKIP","dst_overlap","EARLIER_ONCE"));
  f.store.put(f.base.fixture().identity(),f.config.path("config_id").asText(),a.obj("executor_id",f.base.fixture().executor(),"value",value),"\"1\"",null,id());
  String claim=a.obj("schedule_id",f.config.path("config_id").asText(),"version",2,"scheduled_start_at",utc(at)).toString();
  http.perform(post("/api/v1/schedule-occurrences/claim").header("Authorization","Bearer "+token).contentType("application/json").content(claim)).andExpect(status().isAccepted()).andExpect(jsonPath("$.execution_status").value("STARTING"));
  http.perform(post("/api/v1/schedule-occurrences/claim").header("Authorization","Bearer "+token).contentType("application/json").content(claim)).andExpect(status().isAccepted());
  http.perform(get("/api/v1/schedules/"+f.config.path("config_id").asText()+"/occurrences").header("Authorization","Bearer "+token)).andExpect(status().isOk()).andExpect(jsonPath("$.items[0].schedule_version").value(2));
  var other=fixture(start,true);http.perform(get("/api/v1/schedules/"+other.config.path("config_id").asText()+"/occurrences").header("Authorization","Bearer "+token)).andExpect(status().isNotFound());
  a.db.update("UPDATE extension_tokens SET revoked_at=UTC_TIMESTAMP(3) WHERE executor_id=?",f.base.fixture().executor());http.perform(get("/api/v1/schedules").param("executor_id",f.base.fixture().executor()).header("Authorization","Bearer "+token)).andExpect(status().isUnauthorized());
 }
}
