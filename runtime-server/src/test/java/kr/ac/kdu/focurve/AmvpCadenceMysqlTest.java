package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static kr.ac.kdu.focurve.MemberAuth.*;
import static kr.ac.kdu.focurve.AmvpBridgeSupport.*;

/** Real isolated JDBC/HTTP; all coordinated Core scope and effect producers are SYNTHETIC. */
@EnabledIfEnvironmentVariable(named="FOCURVE_AMVP_TEST_URL",matches="jdbc:mysql://127\\.0\\.0\\.1:[0-9]+/amvp_test_[a-f0-9]+.*")
@EnabledIfEnvironmentVariable(named="FOCURVE_AMVP_CADENCE_TESTS",matches="1")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class AmvpCadenceMysqlTest {
 final AmvpRuntimeBridgeMysqlTest helper=new AmvpRuntimeBridgeMysqlTest();
 @BeforeAll void schema(){helper.schema();new ResourceDatabasePopulator(new ClassPathResource("amvp/cadence-bridge.sql")).execute(helper.base.db.getDataSource());}
 static class TestClock extends Clock{Instant at=Instant.now().truncatedTo(ChronoUnit.MILLIS);public Instant instant(){return at;}public ZoneId getZone(){return ZoneOffset.UTC;}public Clock withZone(ZoneId zone){return this;}}
 class Producer implements AmvpCadenceControl.Authority{
  long generation=7;boolean valid=true;String initialState="STARTING";
  public AmvpCadenceControl.Bootstrap inspect(Identity principal,Binding binding,ObjectNode frozen){return new AmvpCadenceControl.Bootstrap(generation,helper.base.auth.obj("operation_id",frozen.path("focus_ref").path("session_id"),"focus_ref",frozen.path("focus_ref"),"state",initialState,"confirmed_ms",0,"remaining_ms",frozen.path("cadence").path("focus_minutes").asLong()*60000,"runtime_policy_unchanged",true,"last_error_code",null));}
  public void verify(Identity principal,Binding binding,ObjectNode issued,ObjectNode frozen,AmvpCadenceControl.Receipt receipt){check(valid&&receipt.evidenceSha().equals(hash("SYNTHETIC:"+receipt.state().path("operation_id").asText())),409,"RELEASE_UNCONFIRMED");}
 }
 record Fixture(AmvpRuntimeBridgeMysqlTest.Harness base,AdditionalConfigStore store,ObjectNode config,String session,Producer producer,TestClock clock,AmvpCadenceControl control){}
 Fixture fixture()throws Exception{
  var h=helper.fixture();var a=helper.base.auth;((ObjectNode)h.selection().path("selected")).put("FOCUS_CONTROL","AMVP_FOCUS_CONTROL_1");
  a.db.update("UPDATE amvp_capability_receipts SET selected_json=? WHERE receipt_id=?",AdditionalConfigContract.canonical(h.selection().path("selected")),h.selection().path("capability_receipt_id").asText());
  var store=new AdditionalConfigStore(a,helper.base.manager,new AmvpCadenceAdmission(a,h.publisher(),helper.source(h.selection())));var value=helper.example("CadenceConfig");value.put("enabled",true).put("focus_minutes",25).put("rest_minutes",5).put("cycles",3).put("auto_start_next",false).putNull("deadline_at");
  var config=store.put(h.fixture().identity(),id(),a.obj("executor_id",h.fixture().executor(),"value",value),null,"*",id());
  String sid=id(),snapshot=id();a.db.update("INSERT INTO policy_snapshots(id,user_id,executor_id,format_version,payload,payload_hash,created_at) VALUES(?,?,?,'1.1','{}',?,UTC_TIMESTAMP(3))",snapshot,h.fixture().identity().user(),h.fixture().executor(),hash("{}"));
  a.db.update("INSERT INTO focus_sessions(source_session_id,user_id,executor_id,policy_snapshot_id,execution_status,duration_minutes,desired_revision,body,source,origin,record_status) VALUES(?,?,?,?,'STARTING',25,1,'{}','MANUAL','MEMBER','PENDING')",sid,h.fixture().identity().user(),h.fixture().executor(),snapshot);
  var producer=new Producer();var clock=new TestClock();return new Fixture(h,store,config,sid,producer,clock,new AmvpCadenceControl(a,helper.base.manager,helper.source(h.selection()),producer,clock));
 }
 Identity principal(Fixture f){return helper.bearer(f.base);}
 AmvpCadenceControl.View view(Fixture f){return f.control.get(principal(f),f.session);}
 ObjectNode body(Fixture f,String action){var view=view(f);var context=view.context();return helper.base.auth.obj("stream","FOCUS_CONTROL","schema_version","AMVP_FOCUS_CONTROL_1","request_id",id(),"owner_binding_id",context.path("owner_binding_id"),"executor_id",context.path("executor_id"),"owner_epoch",context.path("owner_epoch"),"capability_receipt_id",context.path("capability_receipt_id"),"execute_before",utc(f.clock.instant().plusMillis(5000)),"command",helper.base.auth.obj("operation_id",id(),"focus_ref",view.state().path("focus_ref"),"action",action,"expected_version",view.version(),"attachment_id",context.path("attachment_id"),"duration_minutes",action.equals("START")?25:null));}
 AmvpCadenceControl.View command(Fixture f,String action){var body=body(f,action);return f.control.command(principal(f),f.session,body,"\""+body.path("command").path("expected_version").asLong()+"\"",id());}
 ObjectNode frozen(Fixture f){try{return (ObjectNode)helper.base.json.readTree(helper.base.auth.one("SELECT frozen_json FROM amvp_focus_runs WHERE session_uuid=?",f.session).get("frozen_json").toString());}catch(Exception e){throw new AssertionError(e);}}
 AmvpCadenceControl.Receipt receipt(Fixture f,String state,long sequence){var stateBody=view(f).state().deepCopy().put("state",state);if(state.equals("UNKNOWN"))stateBody.put("last_error_code","CORE_EFFECT_UNCONFIRMED");return new AmvpCadenceControl.Receipt(id(),7,sequence,f.clock.instant(),stateBody,frozen(f),hash("SYNTHETIC:"+stateBody.path("operation_id").asText()));}
 ObjectNode receive(Fixture f,AmvpCadenceControl.Receipt receipt){return f.control.receive(()->principal(f),f.session,receipt);}
 void started(Fixture f){command(f,"START");assertThat(receive(f,receipt(f,"RUNNING",1)).path("projected").asBoolean()).isTrue();}
 @Test void editedDeadlineIsPersistedButDoesNotReplaceTheRunningFrozenDeadline()throws Exception{
  var f=fixture();String first=utc(f.clock.instant().plusSeconds(3600)),second=utc(f.clock.instant().plusSeconds(7200));var value=f.config.path("value").deepCopy();((ObjectNode)value).put("deadline_at",first);
  f.store.put(f.base.fixture().identity(),f.config.path("config_id").asText(),helper.base.auth.obj("executor_id",f.base.fixture().executor(),"value",value),"\"1\"",null,id());started(f);var original=frozen(f);
  assertThat(original.path("cadence").path("deadline_at").asText()).isEqualTo(first);((ObjectNode)value).put("deadline_at",second);
  var saved=f.store.put(f.base.fixture().identity(),f.config.path("config_id").asText(),helper.base.auth.obj("executor_id",f.base.fixture().executor(),"value",value),"\"2\"",null,id());assertThat(saved.path("value").path("deadline_at").asText()).isEqualTo(second);
  command(f,"PAUSE");receive(f,receipt(f,"PAUSED",2));command(f,"RESUME");receive(f,receipt(f,"RUNNING",3));assertThat(frozen(f)).isEqualTo(original);
 }
 @Test void savedCadenceIsSeparateFromRuntimePackageAndReadDoesNotCreateExecution()throws Exception{
  var f=fixture();assertThat(f.config.path("runtime_apply_state").asText()).isEqualTo("PENDING");assertThat(view(f).context().path("start_allowed").asBoolean()).isTrue();view(f);
  assertThat(helper.base.db.queryForObject("SELECT COUNT(*) FROM amvp_focus_runs WHERE session_uuid=?",Integer.class,f.session)).isZero();
  assertThat(helper.base.db.queryForObject("SELECT COUNT(*) FROM amvp_outbox WHERE owner_binding_id=?",Integer.class,f.base.fixture().binding())).isEqualTo(1);
 }
 @Test void focusOnlyCapabilityCanSaveCadenceButCannotPublishARuntimePackage()throws Exception{
  var f=fixture();((ObjectNode)f.base.selection().path("selected")).remove("RUNTIME_POLICY");helper.base.db.update("UPDATE amvp_capability_receipts SET selected_json=? WHERE receipt_id=?",AdditionalConfigContract.canonical(f.base.selection().path("selected")),f.base.selection().path("capability_receipt_id").asText());
  var saved=f.store.put(f.base.fixture().identity(),f.config.path("config_id").asText(),helper.base.auth.obj("executor_id",f.base.fixture().executor(),"value",f.config.path("value")),"\"1\"",null,id());assertThat(saved.path("version").asLong()).isEqualTo(2);
  var value=f.base.policy().deepCopy().put("policy_id",id());assertThatThrownBy(()->f.store.put(f.base.fixture().identity(),value.path("policy_id").asText(),helper.base.auth.obj("executor_id",f.base.fixture().executor(),"value",value),null,"*",id())).hasMessage("CAPABILITY_NOT_VERIFIED");
 }
 @Test void bootstrapScopeInspectionCannotPretendThatRuntimeWasApplied()throws Exception{
  var f=fixture();f.producer.initialState="RUNNING";assertThatThrownBy(()->view(f)).hasMessage("CAPABILITY_NOT_VERIFIED");assertThat(helper.base.db.queryForObject("SELECT COUNT(*) FROM amvp_focus_runs WHERE session_uuid=?",Integer.class,f.session)).isZero();
 }
 @Test void commandsWaitForVerifiedEffectsAndPauseResumeEndKeepFrozenInputs()throws Exception{
  var f=fixture();command(f,"START");assertThat(view(f).state().path("state").asText()).isEqualTo("STARTING");var original=frozen(f);
  f.producer.valid=false;assertThatThrownBy(()->receive(f,receipt(f,"RUNNING",1))).hasMessage("RELEASE_UNCONFIRMED");f.producer.valid=true;
  receive(f,receipt(f,"RUNNING",1));command(f,"PAUSE");receive(f,receipt(f,"PAUSED",2));assertThat(view(f).state().path("state").asText()).isEqualTo("PAUSED");
  command(f,"RESUME");receive(f,receipt(f,"RUNNING",3));command(f,"END");receive(f,receipt(f,"ENDED",4));assertThat(view(f).state().path("state").asText()).isEqualTo("ENDED");assertThat(frozen(f)).isEqualTo(original);
  assertThat(helper.base.db.queryForObject("SELECT execution_status FROM focus_sessions WHERE source_session_id=?",String.class,f.session)).isEqualTo("STARTING"); // no legacy actor mutation
 }
 @Test void duplicateRequestIgnoresOnlyTransportIdAndRejectsChangedIntent()throws Exception{
  var f=fixture();var body=body(f,"START");String key=id();var first=f.control.command(principal(f),f.session,body,"\"1\"",key);
  assertThat(f.control.command(principal(f),f.session,body.deepCopy().put("request_id",id()),"\"1\"",key).state()).isEqualTo(first.state());
  var changed=body.deepCopy();((ObjectNode)changed.path("command")).put("duration_minutes",26);assertThatThrownBy(()->f.control.command(principal(f),f.session,changed,"\"1\"",key)).hasMessage("IDEMPOTENCY_CONFLICT");
  assertThat(helper.base.db.queryForObject("SELECT COUNT(*) FROM amvp_focus_controls WHERE session_uuid=?",Integer.class,f.session)).isEqualTo(1);
 }
 @Test void sequenceGapAndDuplicateReceiptSurviveReceiverRecreation()throws Exception{
  var f=fixture();command(f,"START");var second=receipt(f,"RUNNING",2);assertThat(receive(f,second).path("projected").asBoolean()).isFalse();
  receive(f,receipt(f,"RUNNING",1));var recreated=new AmvpCadenceControl(helper.base.auth,helper.base.manager,helper.source(f.base.selection()),f.producer,f.clock);
  assertThat(recreated.receive(()->principal(f),f.session,second).path("projected").asBoolean()).isTrue();assertThat(receive(f,second).path("duplicate").asBoolean()).isTrue();
 }
 @Test void lateReceiptCannotConvertUnknownIntoSuccess()throws Exception{
  var f=fixture();command(f,"START");var proof=receipt(f,"RUNNING",1);f.clock.at=f.clock.at.plusMillis(5001);assertThat(view(f).state().path("state").asText()).isEqualTo("UNKNOWN");assertThat(receive(f,proof).path("projected").asBoolean()).isFalse();
  assertThat(view(f).state().path("state").asText()).isEqualTo("UNKNOWN");assertThat(helper.base.auth.one("SELECT first_failure_json FROM amvp_focus_runs WHERE session_uuid=?",f.session).get("first_failure_json")).isNotNull();
 }
 @Test void unknownIsStickyWhileVerifiedEndRetainsFirstFailure()throws Exception{
  var f=fixture();command(f,"START");receive(f,receipt(f,"UNKNOWN",1));var first=helper.base.auth.one("SELECT first_failure_json FROM amvp_focus_runs WHERE session_uuid=?",f.session).get("first_failure_json").toString();
  assertThatThrownBy(()->command(f,"RESUME")).hasMessage("RELEASE_UNCONFIRMED");command(f,"END");receive(f,receipt(f,"ENDED",2));assertThat(view(f).state().path("state").asText()).isEqualTo("ENDED");
  assertThat(helper.base.auth.one("SELECT first_failure_json FROM amvp_focus_runs WHERE session_uuid=?",f.session).get("first_failure_json").toString()).isEqualTo(first);
 }
 @Test void laterRuntimeFailureIsNotMistakenForAnExpiredInitialAck()throws Exception{
  var f=fixture();started(f);f.clock.at=f.clock.at.plusSeconds(30);assertThat(receive(f,receipt(f,"RUNNING",2)).path("projected").asBoolean()).isTrue();
  assertThat(receive(f,receipt(f,"UNKNOWN",3)).path("projected").asBoolean()).isTrue();assertThat(view(f).state().path("last_error_code").asText()).isEqualTo("CORE_EFFECT_UNCONFIRMED");
 }
 @Test void endCannotProjectUntilTheOriginalServerLockWasNormallyReleased()throws Exception{
  var f=fixture();started(f);long internal=helper.base.db.queryForObject("SELECT id FROM focus_sessions WHERE source_session_id=?",Long.class,f.session);helper.base.db.update("INSERT INTO active_execution_locks VALUES(?,?,?,1)",f.base.fixture().identity().user(),f.base.fixture().executor(),internal);
  command(f,"END");var proof=receipt(f,"ENDED",2);assertThat(receive(f,proof).path("projected").asBoolean()).isFalse();assertThat(view(f).state().path("state").asText()).isEqualTo("ENDING");
  helper.base.db.update("DELETE FROM active_execution_locks WHERE session_id=? AND user_id=? AND executor_id=?",internal,f.base.fixture().identity().user(),f.base.fixture().executor()); // SYNTHETIC normal release producer in this fresh isolated DB only
  assertThat(receive(f,proof).path("projected").asBoolean()).isTrue();assertThat(view(f).state().path("state").asText()).isEqualTo("ENDED");
 }
 @Test void positiveAttachmentAndExplicitAbsenceAreFrozenSeparately()throws Exception{
  var f=fixture();var attachment=helper.example("FocusAttachment");attachment.put("owner_binding_id",f.base.fixture().binding()).put("executor_id",f.base.fixture().executor()).put("capability_receipt_id",f.base.selection().path("capability_receipt_id").asText()).set("focus_ref",view(f).state().path("focus_ref"));seal(attachment);new AdditionalConfigContract(helper.base.json).validate("FocusAttachment",attachment);
  helper.base.db.update("INSERT INTO amvp_focus_attachments VALUES(?,?,?,?,?,?,?)",attachment.path("attachment_id").asText(),f.base.fixture().binding(),f.session,attachment.path("focus_ref").path("snapshot_sha256").asText(),f.base.selection().path("capability_receipt_id").asText(),AdditionalConfigContract.canonical(attachment),attachment.path("payload_sha256").asText());
  started(f);var original=frozen(f);command(f,"PAUSE");receive(f,receipt(f,"PAUSED",2));command(f,"RESUME");assertThat(frozen(f)).isEqualTo(original);
  var absent=fixture();started(absent);var other=attachment.deepCopy().put("attachment_id",id()).put("owner_binding_id",absent.base.fixture().binding()).put("executor_id",absent.base.fixture().executor()).put("capability_receipt_id",absent.base.selection().path("capability_receipt_id").asText());other.set("focus_ref",view(absent).state().path("focus_ref"));seal(other);
  helper.base.db.update("INSERT INTO amvp_focus_attachments VALUES(?,?,?,?,?,?,?)",other.path("attachment_id").asText(),absent.base.fixture().binding(),absent.session,other.path("focus_ref").path("snapshot_sha256").asText(),absent.base.selection().path("capability_receipt_id").asText(),AdditionalConfigContract.canonical(other),other.path("payload_sha256").asText());assertThatThrownBy(()->view(absent)).hasMessage("SOURCE_CONFLICT");
 }
 @Test void editedOrDeletedSettingsDoNotRefreshAnExistingFrozenRun()throws Exception{
  var f=fixture();started(f);var original=frozen(f);var value=f.config.path("value").deepCopy();((ObjectNode)value).put("focus_minutes",40);
  f.store.put(f.base.fixture().identity(),f.config.path("config_id").asText(),helper.base.auth.obj("executor_id",f.base.fixture().executor(),"value",value),"\"1\"",null,id());f.store.delete(f.base.fixture().identity(),f.config.path("config_id").asText(),"\"2\"",id());
  command(f,"PAUSE");receive(f,receipt(f,"PAUSED",2));command(f,"RESUME");assertThat(frozen(f)).isEqualTo(original);
 }
 @Test void changedSnapshotGenerationOrAttachmentIsRejected()throws Exception{
  var f=fixture();started(f);f.producer.generation=8;assertThatThrownBy(()->view(f)).hasMessage("STALE_OWNER");f.producer.generation=7;
  helper.base.db.update("UPDATE policy_snapshots SET payload='{\"changed\":true}',payload_hash=? WHERE id=?",hash("{\"changed\":true}"),view(f).state().path("focus_ref").path("snapshot_id").asText());assertThatThrownBy(()->view(f)).hasMessage("SOURCE_CONFLICT");
 }
 @Test void wrongScopeVersionAndPhaseAreRejectedWithoutIssuingControls()throws Exception{
  var f=fixture();var wrong=body(f,"START").put("owner_epoch",99);assertThatThrownBy(()->f.control.command(principal(f),f.session,wrong,"\"1\"",id())).hasMessage("FORBIDDEN_EXECUTOR");
  var valid=body(f,"START");assertThatThrownBy(()->f.control.command(principal(f),f.session,valid,"\"2\"",id())).hasMessage("VERSION_CONFLICT");assertThatThrownBy(()->command(f,"PAUSE")).hasMessage("RELEASE_UNCONFIRMED");
 }
 @Test void outboxFailureRollsBackTheRunAndCommandTogether()throws Exception{
  var f=fixture();var body=body(f,"START");String collision=helper.base.db.queryForObject("SELECT item_id FROM amvp_outbox WHERE owner_binding_id=? LIMIT 1",String.class,f.base.fixture().binding());((ObjectNode)body.path("command")).put("operation_id",collision);
  assertThatThrownBy(()->f.control.command(principal(f),f.session,body,"\"1\"",id())).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
  assertThat(helper.base.db.queryForObject("SELECT COUNT(*) FROM amvp_focus_runs WHERE session_uuid=?",Integer.class,f.session)).isZero();assertThat(helper.base.db.queryForObject("SELECT COUNT(*) FROM amvp_focus_controls WHERE session_uuid=?",Integer.class,f.session)).isZero();
 }
 @Test void concurrentVersionOneStartsHaveOneWinner()throws Exception{
  var f=fixture();var first=body(f,"START");var second=body(f,"START");var pool=java.util.concurrent.Executors.newFixedThreadPool(2);
  try{var one=pool.submit(()->attempt(f,first));var two=pool.submit(()->attempt(f,second));assertThat(List.of(one.get(),two.get())).containsExactlyInAnyOrder("STARTING","VERSION_CONFLICT");}finally{pool.shutdownNow();}
  assertThat(helper.base.db.queryForObject("SELECT COUNT(*) FROM amvp_focus_controls WHERE session_uuid=?",Integer.class,f.session)).isEqualTo(1);
 }
 String attempt(Fixture f,ObjectNode body){try{return f.control.command(principal(f),f.session,body,"\"1\"",id()).state().path("state").asText();}catch(Failure failure){return failure.code;}}
 @Test void failureWithMissingPredecessorIsVisibleImmediatelyAndDeadlineCannotStart()throws Exception{
  var f=fixture();command(f,"START");receive(f,receipt(f,"UNKNOWN",2));assertThat(view(f).state().path("state").asText()).isEqualTo("UNKNOWN");
  var expired=fixture();var value=(ObjectNode)expired.config.path("value").deepCopy();value.put("deadline_at",utc(expired.clock.at.minusMillis(1)));expired.store.put(expired.base.fixture().identity(),expired.config.path("config_id").asText(),helper.base.auth.obj("executor_id",expired.base.fixture().executor(),"value",value),"\"1\"",null,id());assertThat(view(expired).context().path("start_allowed").asBoolean()).isFalse();assertThatThrownBy(()->command(expired,"START")).hasMessage("RELEASE_UNCONFIRMED");
 }
 @Test void publicHttpUsesExistingFocusSchemasAndRequiresVerifiedProvider()throws Exception{
  var f=fixture();var a=helper.base.auth;String token=new org.springframework.transaction.support.TransactionTemplate(helper.base.manager).execute(tx->a.mint(f.base.fixture().executor(),f.base.fixture().identity().user(),id(),1)).path("access_token").asText();
  var beans=new StaticListableBeanFactory();beans.addBean("source",helper.source(f.base.selection()));beans.addBean("authority",f.producer);
  var mvc=MockMvcBuilders.standaloneSetup(new AmvpCadenceApi(a,helper.base.manager,beans.getBeanProvider(CapabilitySource.class),beans.getBeanProvider(AmvpCadenceControl.Authority.class))).build();
  mvc.perform(get("/api/v1/amvp/focus/"+f.session+"/state").header("Authorization","Bearer "+token)).andExpect(status().isOk()).andExpect(header().string("ETag","\"1\"")).andExpect(jsonPath("$.state").value("STARTING"));
  mvc.perform(post("/api/v1/amvp/focus/"+f.session+"/commands").header("Authorization","Bearer "+token).header("If-Match","\"1\"").header("Idempotency-Key",id()).contentType("application/json").content(body(f,"START").toString())).andExpect(status().isAccepted()).andExpect(jsonPath("$.state").value("STARTING"));
  var none=new StaticListableBeanFactory();var unavailable=MockMvcBuilders.standaloneSetup(new AmvpCadenceApi(a,helper.base.manager,none.getBeanProvider(CapabilitySource.class),none.getBeanProvider(AmvpCadenceControl.Authority.class))).build();unavailable.perform(get("/api/v1/amvp/focus/"+f.session+"/state").header("Authorization","Bearer "+token)).andExpect(status().isServiceUnavailable());
 }
}
