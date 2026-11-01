package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.core.io.FileSystemResource;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import jakarta.servlet.http.Cookie;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real isolated MySQL. Capability/publication are explicitly synthetic trusted adapters. */
@EnabledIfEnvironmentVariable(named="FOCURVE_AMVP_TEST_URL",matches="jdbc:mysql://127\\.0\\.0\\.1:[0-9]+/amvp_test_[a-f0-9]+.*")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class AdditionalConfigMysqlTest {
 JdbcTemplate db;MemberAuth auth;DataSourceTransactionManager manager;ObjectMapper json=new ObjectMapper();
 @BeforeAll void schema() {
  var ds=new DriverManagerDataSource(System.getenv("FOCURVE_AMVP_TEST_URL"),System.getenv("FOCURVE_AMVP_TEST_USER"),System.getenv("FOCURVE_AMVP_TEST_PASSWORD"));db=new JdbcTemplate(ds);manager=new DataSourceTransactionManager(ds);
  // Empty disposable database only. Refuse an existing schema rather than cleaning it.
  assertThat(db.queryForObject("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE()",Integer.class)).isZero();
  String database=db.queryForObject("SELECT DATABASE()",String.class);
  assertThat(database).matches("amvp_test_[a-f0-9]+");
  // Docker's MYSQL_DATABASE defaults to ai_ci; match the runtime candidate only
  // while this explicitly disposable database is still verified empty.
  db.execute("ALTER DATABASE `"+database+"` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin");
  Flyway.configure().dataSource(ds).locations("classpath:db/migration").load().migrate();
  new ResourceDatabasePopulator(new FileSystemResource("../contracts/additional-mvp/rc1/mysql-runtime-candidate.sql")).execute(ds);
  auth=new MemberAuth(db,json,"https://localhost:33339",Base64.getEncoder().encodeToString(new byte[32]),"chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/popup/popup.html");
 }
 record Fixture(String executor,String binding,MemberAuth.Identity identity,AdditionalConfigStore store){}
 Fixture fixture() {
  String executor=UUID.randomUUID().toString(),binding=UUID.randomUUID().toString();
  var generated=new org.springframework.jdbc.support.GeneratedKeyHolder();
  db.update(connection->{var statement=connection.prepareStatement("INSERT INTO users(display_name,email_verified,status,created_at,terms_version,terms_accepted_at) VALUES('Synthetic test',true,'ACTIVE',UTC_TIMESTAMP(3),'test',UTC_TIMESTAMP(3))",java.sql.Statement.RETURN_GENERATED_KEYS);return statement;},generated);
  long user=generated.getKey().longValue();
  db.update("INSERT INTO extension_installations(id,current_user_id,proof_hash,client_version) VALUES(?,?,?,'test')",executor,user,"0".repeat(64));
  db.update("INSERT INTO amvp_owner_bindings VALUES(?,?,?,1,'ACTIVE',UTC_TIMESTAMP(3),NULL)",binding,executor,user);
  return new Fixture(executor,binding,new MemberAuth.Identity(user,null),new AdditionalConfigStore(auth,manager,publication(false)));
 }
 AdditionalConfigStore.Admission publication(boolean fail) {return new AdditionalConfigStore.Admission(){
  public void verify(MemberAuth.Identity principal,String executor,String binding,boolean mutation){}
  public void publish(String binding,String id,long revision,JsonNode value,boolean deleted){
   // Synthetic publication participates in the real transaction; not product capability proof.
   db.update("INSERT INTO amvp_outbox VALUES(?,?,'RUNTIME_POLICY',?,?, 'PENDING',0,UTC_TIMESTAMP(3))",UUID.randomUUID().toString(),binding,"{}","0".repeat(64));
   if(fail)throw new MemberAuth.Failure(503,"CAPABILITY_NOT_VERIFIED");
  }
 };}
 ObjectNode value(String kind)throws Exception {try(var input=getClass().getResourceAsStream("/amvp/rc2/examples.json")){return (ObjectNode)json.readTree(input).path("definitions").path(kind).deepCopy();}}
 ObjectNode body(Fixture f,String kind)throws Exception {return auth.obj("executor_id",f.executor,"value",value(kind));}
 String id(){return UUID.randomUUID().toString();}
 ObjectNode create(Fixture f,String config,ObjectNode body,String key){return f.store.put(f.identity,config,body,null,"*",key);}
 @Test void savedRecordIsNotRuntimeAppliedAndSingletonCannotDuplicate()throws Exception {
  var f=fixture();String config=id();var row=create(f,config,body(f,"CadenceConfig"),id());
  assertThat(row.path("version").asLong()).isEqualTo(1);assertThat(row.path("runtime_apply_state").asText()).isEqualTo("PENDING");assertThat(row.path("applied_runtime_revision").isNull()).isTrue();
  assertThatThrownBy(()->create(f,id(),body(f,"CadenceConfig"),id())).hasMessage("IDEMPOTENCY_CONFLICT");
  assertThat(f.store.get(f.identity,config)).isEqualTo(row);
 }
 @Test void allKindsStoreAndReadWithoutMutatingLegacySites()throws Exception {
  var f=fixture();for(String kind:List.of("ContentConfig","SiteTimePolicy","FocusSchedule")){
   String config=id();var request=body(f,kind);ObjectNode value=(ObjectNode)request.path("value");
   if(kind.equals("SiteTimePolicy"))value.put("policy_id",config);if(kind.equals("FocusSchedule"))value.put("schedule_id",config);
   assertThat(create(f,config,request,id()).path("saved_state").asText()).isEqualTo("SAVED");
  }
  assertThat(f.store.list(f.identity,f.executor,null,null,100).path("items").size()).isEqualTo(3);
  assertThat(db.queryForObject("SELECT COUNT(*) FROM sites WHERE user_id=?",Integer.class,f.identity.user())).isZero();
 }
 @Test void duplicateReceiptPrecedesCurrentVersionAndCannotChangeBody()throws Exception {
  var f=fixture();String config=id(),key=id();var request=body(f,"CadenceConfig");var first=create(f,config,request,key);
  var changed=request.deepCopy();((ObjectNode)changed.path("value")).put("cycles",2);var second=f.store.put(f.identity,config,changed,"\"1\"",null,id());
  assertThat(second.path("version").asLong()).isEqualTo(2);assertThat(AdditionalConfigContract.canonical(create(f,config,request,key))).isEqualTo(AdditionalConfigContract.canonical(first));
  assertThatThrownBy(()->create(f,config,changed,key)).hasMessage("IDEMPOTENCY_CONFLICT");
  assertThat(db.queryForObject("SELECT COUNT(*) FROM amvp_config_versions WHERE config_id=?",Integer.class,config)).isEqualTo(2);
 }
 @Test void foreignMemberForeignExecutorAndClosedBindingAreRejected()throws Exception {
  var f=fixture();String config=id();create(f,config,body(f,"CadenceConfig"),id());
  assertThatThrownBy(()->f.store.get(new MemberAuth.Identity(f.identity.user()+10000,null),config)).hasMessage("RESOURCE_NOT_FOUND");
  assertThatThrownBy(()->f.store.get(new MemberAuth.Identity(f.identity.user(),id()),config)).hasMessage("RESOURCE_NOT_FOUND");
  db.update("UPDATE amvp_owner_bindings SET state='CLOSED',closed_at=UTC_TIMESTAMP(3) WHERE binding_id=?",f.binding);
  assertThatThrownBy(()->f.store.get(f.identity,config)).hasMessage("STALE_OWNER");
 }
 @Test void sameMemberNewOwnerEpochCannotReadOrDeleteTheOldBinding()throws Exception {
  var f=fixture();String config=id();create(f,config,body(f,"CadenceConfig"),id());
  db.update("UPDATE amvp_owner_bindings SET state='CLOSED',closed_at=UTC_TIMESTAMP(3) WHERE binding_id=?",f.binding);
  db.update("INSERT INTO amvp_owner_bindings VALUES(?,?,?,2,'ACTIVE',UTC_TIMESTAMP(3),NULL)",id(),f.executor,f.identity.user());
  assertThatThrownBy(()->f.store.get(f.identity,config)).hasMessage("RESOURCE_NOT_FOUND");
  assertThatThrownBy(()->f.store.delete(f.identity,config,"\"1\"",id())).hasMessage("RESOURCE_NOT_FOUND");
 }
 @Test void publicationFailureRollsBackConfigVersionAndOutbox()throws Exception {
  var f=fixture();var failed=new AdditionalConfigStore(auth,manager,publication(true));String config=id();
  assertThatThrownBy(()->failed.put(f.identity,config,body(f,"CadenceConfig"),null,"*",id())).hasMessage("CAPABILITY_NOT_VERIFIED");
  for(String table:List.of("amvp_configs","amvp_config_versions"))assertThat(db.queryForObject("SELECT COUNT(*) FROM "+table+" WHERE config_id=?",Integer.class,config)).isZero();
  assertThat(db.queryForObject("SELECT COUNT(*) FROM amvp_outbox WHERE owner_binding_id=?",Integer.class,f.binding)).isZero();
 }
 @Test void concurrentExpectedVersionHasOneWinner()throws Exception {
  var f=fixture();String config=id();var request=body(f,"CadenceConfig");create(f,config,request,id());var start=new CountDownLatch(1);
  try(var workers=Executors.newFixedThreadPool(2)) {
   List<Future<String>> work=new ArrayList<>();for(int n=0;n<2;n++)work.add(workers.submit(()->{start.await();try{f.store.put(f.identity,config,request,"\"1\"",null,id());return "SAVED";}catch(MemberAuth.Failure e){return e.code;}}));start.countDown();
   assertThat(List.of(work.get(0).get(10,TimeUnit.SECONDS),work.get(1).get(10,TimeUnit.SECONDS))).containsExactlyInAnyOrder("SAVED","VERSION_CONFLICT");
  }
 }
 @Test void deletionPreservesImmutableVersionsReplaysAndFreesSingleton()throws Exception {
  var f=fixture();String config=id(),key=id();create(f,config,body(f,"CadenceConfig"),id());var deleted=f.store.delete(f.identity,config,"\"1\"",key);
  assertThat(deleted.path("actual_effect_confirmed").asBoolean()).isFalse();assertThat(deleted.path("state").asText()).isEqualTo("RELEASE_PENDING");assertThat(f.store.delete(f.identity,config,"\"1\"",key)).isEqualTo(deleted);
  assertThat(db.queryForObject("SELECT COUNT(*) FROM amvp_config_versions WHERE config_id=?",Integer.class,config)).isEqualTo(2);
  create(f,id(),body(f,"CadenceConfig"),id());
 }
 @Test void cursorIsBoundToOwnerKindLimitAndTamperingIsRejected()throws Exception {
  var f=fixture();for(int n=0;n<3;n++){String config=id();var request=body(f,"SiteTimePolicy");((ObjectNode)request.path("value")).put("policy_id",config);create(f,config,request,id());}
  var first=f.store.list(f.identity,f.executor,"SITE_TIME",null,1);String cursor=first.path("next_cursor").asText();assertThat(first.path("has_more").asBoolean()).isTrue();var next=f.store.list(f.identity,f.executor,"SITE_TIME",cursor,1);
  assertThat(first.path("items").get(0).path("config_id")).isNotEqualTo(next.path("items").get(0).path("config_id"));
  assertThatThrownBy(()->f.store.list(f.identity,f.executor,"CONTENT",cursor,1)).hasMessage("VALIDATION_FAILED");
  assertThatThrownBy(()->f.store.list(f.identity,f.executor,"SITE_TIME",cursor+"x",1)).hasMessage("VALIDATION_FAILED");
 }
 @Test void httpUsesExistingCookieCsrfAndFailsClosedWithoutCapabilityAdapter()throws Exception {
  var f=fixture();String cookie=id(),csrf=id();db.update("INSERT INTO web_sessions(id_hash,user_id,csrf_hash,expires_at,auth_version) VALUES(?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 1 HOUR),1)",MemberAuth.hash(cookie),f.identity.user(),MemberAuth.hash(csrf));
  var beans=new StaticListableBeanFactory();var denied=MockMvcBuilders.standaloneSetup(new AdditionalConfigApi(auth,manager,beans.getBeanProvider(AdditionalConfigStore.Admission.class))).build();
  denied.perform(get("/api/v1/amvp/configs").param("executor_id",f.executor)).andExpect(status().isUnauthorized());
  denied.perform(get("/api/v1/amvp/configs").cookie(new Cookie("FOCURVE_WEB",cookie)).param("executor_id",f.executor)).andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.error.code").value("CAPABILITY_NOT_VERIFIED"));
  beans.addBean("syntheticAdmission",publication(false));var http=MockMvcBuilders.standaloneSetup(new AdditionalConfigApi(auth,manager,beans.getBeanProvider(AdditionalConfigStore.Admission.class))).build();String config=id(),key=id();var request=body(f,"CadenceConfig");
  http.perform(put("/api/v1/amvp/configs/"+config).cookie(new Cookie("FOCURVE_WEB",cookie)).contentType("application/json").content(request.toString()).header("If-None-Match","*").header("Idempotency-Key",key)).andExpect(status().isForbidden());
  http.perform(put("/api/v1/amvp/configs/"+config).cookie(new Cookie("FOCURVE_WEB",cookie)).header("Origin",auth.origin).header("X-CSRF-Token",csrf).contentType("application/json").content(request.toString()).header("If-None-Match","*").header("Idempotency-Key",key)).andExpect(status().isOk()).andExpect(jsonPath("$.runtime_apply_state").value("PENDING"));
  var statsHttp=MockMvcBuilders.standaloneSetup(new AdditionalStatisticsApi(auth,manager,beans.getBeanProvider(AdditionalConfigStore.Admission.class))).build();
  statsHttp.perform(get("/api/v1/amvp/statistics/browser-usage").cookie(new Cookie("FOCURVE_WEB",cookie)).param("scope","ACCOUNT_TOTAL").param("from_date","2026-10-29").param("to_date","2026-10-29")).andExpect(status().isOk()).andExpect(jsonPath("$.quality").value("NO_DATA")).andExpect(jsonPath("$.browser_ms").doesNotExist()).andExpect(jsonPath("$.quota_debit").value(false));

 }
 String usage(Fixture f,long milliseconds,String state,String zone,String day)throws Exception {
  String segment=id();ObjectNode raw=value("ClockedUsageSegment");
  raw.put("segment_id",segment).put("owner_binding_id",f.binding).put("executor_id",f.executor).put("timezone",zone).put("day_start_at",day).put("quality","COMPLETE");
  raw.put("confirmed_ms",state.equals("COUNTED")?milliseconds:0).put("uncertain_ms",state.equals("COUNTED")?0:milliseconds);
  ((ObjectNode)raw.path("clock")).put("quality","TRUSTED");
  db.update("INSERT INTO amvp_usage_segments(segment_id,owner_binding_id,executor_id,collector_epoch,local_usage_seq,actual_host,start_at,end_at,confirmed_ms,uncertain_ms,payload_json,payload_sha256,measurement_state) VALUES(?,?,?,?,1,'video.example.test','2026-10-29 01:00:00','2026-10-29 01:01:00',?,?,?,?,?)",segment,f.binding,f.executor,id(),state.equals("COUNTED")?milliseconds:0,state.equals("COUNTED")?0:milliseconds,raw.toString(),"0".repeat(64),state);
  return segment;
 }
 AdditionalUsageStatistics.Range range(String scope,String executor,String from,String to) {return new AdditionalUsageStatistics.Range(scope,executor,java.time.LocalDate.parse(from),java.time.LocalDate.parse(to));}
 @Test void browserStatisticsExcludesQuarantineAndDoesNotMutateQuota()throws Exception {
  var f=fixture();usage(f,5000,"COUNTED","Asia/Seoul","2026-10-28T15:00:00.000Z");usage(f,9000,"QUARANTINED","Asia/Seoul","2026-10-28T15:00:00.000Z");
  var stats=new AdditionalUsageStatistics(auth,manager,publication(false)).query(f.identity,range("INSTALLATION",f.executor,"2026-10-29","2026-10-29"));
  assertThat(stats.path("browser_ms").asLong()).isEqualTo(5000);assertThat(stats.path("quality").asText()).isEqualTo("PARTIAL");assertThat(stats.path("focus_ms").isNull()).isTrue();assertThat(stats.path("repeat_count").isNull()).isTrue();assertThat(stats.path("quota_debit").asBoolean()).isFalse();
  new AdditionalConfigContract(json).validate("Statistics",stats);
  assertThat(db.queryForObject("SELECT COUNT(*) FROM amvp_day_budgets WHERE executor_id=?",Integer.class,f.executor)).isZero();
 }
 @Test void rawTrustedTextWithoutCountedProjectionDoesNotBecomeConfirmedUsage()throws Exception {
  var f=fixture();usage(f,9000,"QUARANTINED","Asia/Seoul","2026-10-28T15:00:00.000Z");
  var stats=new AdditionalUsageStatistics(auth,manager,publication(false)).query(f.identity,range("INSTALLATION",f.executor,"2026-10-29","2026-10-29"));
  assertThat(stats.path("browser_ms").isNull()).isTrue();assertThat(stats.path("quality").asText()).isEqualTo("UNKNOWN");
 }
 @Test void usageRangeUsesStoredTimezoneAndNeverIncludesForeignMember()throws Exception {
  var f=fixture();var other=fixture();usage(f,6000,"COUNTED","America/New_York","2026-10-29T04:00:00.000Z");usage(other,7000,"COUNTED","America/New_York","2026-10-29T04:00:00.000Z");
  var query=new AdditionalUsageStatistics(auth,manager,publication(false));var stats=query.query(f.identity,range("ACCOUNT_TOTAL",null,"2026-10-29","2026-10-29"));assertThat(stats.path("browser_ms").asLong()).isEqualTo(6000);
  var empty=query.query(f.identity,range("INSTALLATION",f.executor,"2026-10-28","2026-10-28"));assertThat(empty.path("browser_ms").isNull()).isTrue();assertThat(empty.path("quality").asText()).isEqualTo("NO_DATA");
  assertThatThrownBy(()->query.query(new MemberAuth.Identity(f.identity.user(),f.executor),range("ACCOUNT_TOTAL",null,"2026-10-29","2026-10-29"))).hasMessage("FORBIDDEN_EXECUTOR");
 }
 @Test void historicalUsageStaysWithItsOriginalMemberAfterOwnerBindingCloses()throws Exception {
  var f=fixture();usage(f,3000,"COUNTED","Asia/Seoul","2026-10-28T15:00:00.000Z");db.update("UPDATE amvp_owner_bindings SET state='CLOSED',closed_at=UTC_TIMESTAMP(3) WHERE binding_id=?",f.binding);
  var stats=new AdditionalUsageStatistics(auth,manager,publication(false)).query(f.identity,range("ACCOUNT_TOTAL",null,"2026-10-29","2026-10-29"));assertThat(stats.path("browser_ms").asLong()).isEqualTo(3000);
 }
 @Test void correctedUsageRequiresVerifiedAnchorAndUsesResolvedDay()throws Exception {
  var f=fixture();String segment=usage(f,4000,"COUNTED","Asia/Seoul","2026-10-28T15:00:00.000Z"),anchor=id();
  db.update("INSERT INTO amvp_clock_anchors VALUES(?,?,?,'epoch','boot',1,'2026-10-30 01:00:00','PENDING',?)",anchor,f.binding,f.executor,"0".repeat(64));
  db.update("INSERT INTO amvp_clock_resolutions VALUES(?,?,?,?,?,?,?,5000,'2026-10-30 01:00:00','2026-10-30 01:00:05','2026-10-29 15:00:00','2026-10-30 15:00:00','{}')",id(),segment,anchor,f.binding,f.executor,"0".repeat(64),"0".repeat(64));
  var query=new AdditionalUsageStatistics(auth,manager,publication(false));var dates=range("INSTALLATION",f.executor,"2026-10-30","2026-10-30");
  assertThat(query.query(f.identity,dates).path("browser_ms").isNull()).isTrue();
  db.update("UPDATE amvp_clock_anchors SET verification_state='VERIFIED' WHERE anchor_id=?",anchor);
  assertThat(query.query(f.identity,dates).path("browser_ms").asLong()).isEqualTo(5000);
  assertThat(query.query(f.identity,range("INSTALLATION",f.executor,"2026-10-29","2026-10-29")).path("browser_ms").isNull()).isTrue();
 }
 @Test void usageRangeRejectsRepeatedUnknownInvalidOrExcessiveDateInputs() {
  assertThatThrownBy(()->AdditionalUsageStatistics.Range.parse(Map.of("scope",new String[]{"ACCOUNT_TOTAL"},"from_date",new String[]{"2026-10-29","2026-10-30"},"to_date",new String[]{"2026-10-29"}))).hasMessage("VALIDATION_FAILED");
  assertThatThrownBy(()->AdditionalUsageStatistics.Range.parse(Map.of("scope",new String[]{"ACCOUNT_TOTAL"},"from_date",new String[]{"2026-02-30"},"to_date",new String[]{"2026-10-29"}))).hasMessage("VALIDATION_FAILED");
  assertThatThrownBy(()->AdditionalUsageStatistics.Range.parse(Map.of("scope",new String[]{"ACCOUNT_TOTAL"},"from_date",new String[]{"2025-01-01"},"to_date",new String[]{"2026-10-29"}))).hasMessage("VALIDATION_FAILED");
 }

 long hourlySession(Fixture f){
  String snapshot=id(),session=id();db.update("INSERT INTO policy_snapshots(id,user_id,executor_id,format_version,payload,payload_hash,created_at) VALUES(?,?,?,'1.0','{}',?,UTC_TIMESTAMP(3))",snapshot,f.identity.user(),f.executor,"0".repeat(64));
  db.update("INSERT INTO focus_sessions(source_session_id,user_id,executor_id,policy_snapshot_id,execution_status,duration_minutes,desired_revision,body,record_status,source,origin) VALUES(?,?,?,?,'ENDED',10,1,'{}','COMPLETE','MANUAL','MEMBER')",session,f.identity.user(),f.executor,snapshot);
  return db.queryForObject("SELECT id FROM focus_sessions WHERE source_session_id=?",Long.class,session);
 }
 void hourlyEvent(Fixture f,long session,long sequence,String at,String status){
  String event=id(),snapshot=db.queryForObject("SELECT policy_snapshot_id FROM focus_sessions WHERE id=?",String.class,session),source=db.queryForObject("SELECT source_session_id FROM focus_sessions WHERE id=?",String.class,session);
  var payload=auth.obj("event_id",event,"executor_id",f.executor,"session_id",source,"occurred_at",at,"event_type","RECORDED_ACCESS","policy_snapshot_id",snapshot,"payload",auth.obj("target_kind","SITE","target_host","example.org","target_key","SITE:example.org","access_seq",sequence));
  db.update("INSERT INTO event_receipts VALUES(?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(3))",event,f.identity.user(),f.executor,session,"Event1.2","RECORDED_ACCESS","0".repeat(64),payload.toString(),status,sequence);
  db.update("INSERT INTO access_events(event_id,session_id,occurred_at,access_seq,target_kind,target_host,target_key,reason,navigation_id,policy_snapshot_id) VALUES(?,?,?,?,?,'example.org','SITE:example.org','RECORDED_ACCESS',?,?)",event,session,java.sql.Timestamp.from(java.time.Instant.parse(at)),sequence,"SITE",id(),snapshot);
 }
 @Test void hourlyReadsAcceptedOwnedHistoryOverHttpWithoutExecutionOrNewSchema()throws Exception {
  var f=fixture();long session=hourlySession(f);hourlyEvent(f,session,1,"2026-11-10T14:59:59.999Z","ACCEPTED");hourlyEvent(f,session,2,"2026-11-10T15:00:00.000Z","ACCEPTED");hourlyEvent(f,session,3,"2026-11-10T15:30:00.000Z","ACCEPTED");hourlyEvent(f,session,4,"2026-11-10T15:45:00.000Z","PENDING");hourlyEvent(f,session,5,"2026-11-11T15:00:00.000Z","ACCEPTED");
  var foreign=fixture();hourlyEvent(foreign,hourlySession(foreign),1,"2026-11-10T15:00:00.000Z","ACCEPTED");String otherExecutor=id();db.update("INSERT INTO extension_installations(id,current_user_id,proof_hash,client_version) VALUES(?,?,?,'test')",otherExecutor,f.identity.user(),"0".repeat(64));var other=new Fixture(otherExecutor,id(),f.identity,f.store);hourlyEvent(other,hourlySession(other),1,"2026-11-10T16:00:00.000Z","ACCEPTED");
  String cookie=id();db.update("INSERT INTO web_sessions(id_hash,user_id,csrf_hash,expires_at,auth_version) VALUES(?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 1 HOUR),1)",MemberAuth.hash(cookie),f.identity.user(),MemberAuth.hash(id()));
  var http=MockMvcBuilders.standaloneSetup(new MemberHourlyStatisticsApi(auth,new MemberReadModel(auth,new MemberExecution(auth,json)),manager)).build();String path="/api/v1/statistics/hourly?from_date=2026-11-11&to_date=2026-11-11";
  http.perform(get(path)).andExpect(status().isUnauthorized());
  var response=http.perform(get(path).cookie(new Cookie("FOCURVE_WEB",cookie))).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store")).andExpect(jsonPath("$[0].total_access").value(2)).andExpect(jsonPath("$[0].repeat_access").value(2)).andExpect(jsonPath("$[0].quality").value("PARTIAL")).andExpect(jsonPath("$[1].total_access").value(1)).andReturn();assertThat(json.readTree(response.getResponse().getContentAsString()).size()).isEqualTo(24);
  http.perform(get(path+"&scope=ACCOUNT_TOTAL").cookie(new Cookie("FOCURVE_WEB",cookie))).andExpect(status().isUnprocessableEntity());http.perform(get("/api/v1/statistics/hourly?from_date=2026-02-30&to_date=2026-11-11").cookie(new Cookie("FOCURVE_WEB",cookie))).andExpect(status().isUnprocessableEntity());
  String token=new org.springframework.transaction.support.TransactionTemplate(manager).execute(tx->auth.mint(f.executor,f.identity.user(),id(),1)).path("access_token").asText();
  long receipts=db.queryForObject("SELECT COUNT(*) FROM event_receipts",Long.class),commands=db.queryForObject("SELECT COUNT(*) FROM execution_commands",Long.class);
  try(var tcp=new AmvpLoopbackHttp(auth,manager,publication(false),null,null,null)){
   var result=tcp.send("GET",path,token,null);assertThat(result.statusCode()).isEqualTo(200);var rows=json.readTree(result.body());assertThat(rows.get(0).path("total_access").asLong()).isEqualTo(2);assertThat(rows.get(1).path("total_access").isNull()).isTrue();assertThat(rows.get(0).path("active_duration_ms").isNull()).isTrue();assertThat(result.headers().firstValue("Cache-Control")).contains("no-store");
  }
  assertThat(db.queryForObject("SELECT COUNT(*) FROM event_receipts",Long.class)).isEqualTo(receipts);assertThat(db.queryForObject("SELECT COUNT(*) FROM execution_commands",Long.class)).isEqualTo(commands);
 }

}
