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
 }
}
