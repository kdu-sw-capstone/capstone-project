package kr.ac.kdu.focurve;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.*;import java.util.*;import java.net.*;import java.net.http.*;
import com.sun.net.httpserver.HttpServer;
import static org.junit.jupiter.api.Assertions.*;
import static kr.ac.kdu.focurve.AmvpP1Preparation.*;
/** Opt-in disposable DB + loopback TCP only. NEVER enabled by default. */
@EnabledIfEnvironmentVariable(named="FOCURVE_P1_CONNECTION_TESTS",matches="1")
@EnabledIfEnvironmentVariable(named="FOCURVE_AMVP_TEST_URL",matches="jdbc:mysql://127\\.0\\.0\\.1:[0-9]+/amvp_test_[a-f0-9]+.*")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@org.junit.jupiter.api.parallel.Execution(org.junit.jupiter.api.parallel.ExecutionMode.SAME_THREAD)
class AmvpP1ConnectionMysqlTest {
 @org.junit.jupiter.api.extension.RegisterExtension static final P1StopOnFirstFailure stopOnFirstFailure=new P1StopOnFirstFailure();

 final AdditionalConfigMysqlTest h=new AdditionalConfigMysqlTest();AmvpP1ServerConnection c;Object policy=new Object();
 @BeforeAll void schema(){
  h.schema(); // Existing official helper refuses any nonempty DB before migrations.
  new ResourceDatabasePopulator(new ClassPathResource("p1-preparation-opt-in.sql")).execute(Objects.requireNonNull(h.db.getDataSource()));
  c=new AmvpP1ServerConnection(h.auth,new MemberAccounts(h.auth),new AmvpP1JdbcRepository(h.db,h.manager,h.json.findAndRegisterModules()),Clock.systemUTC(),(handle,id)->{
   if(handle!=policy)throw new Rejected("POLICY_NOT_VERIFIED");return new Policy("TEST_ONLY_NOT_DEPLOYABLE",Duration.ofMinutes(5));
  });
 }
 MockHttpServletRequest authenticated(AdditionalConfigMysqlTest.Fixture f){
  var tokens=new TransactionTemplate(h.manager).execute(tx->h.auth.mint(f.executor(),f.identity().user(),MemberAuth.id(),h.auth.authVersion(f.identity().user())));
  var req=new MockHttpServletRequest();req.addHeader("Authorization","Bearer "+tokens.path("access_token").asText());return req;
 }
 StoredPreparation prepare(AdditionalConfigMysqlTest.Fixture f,MockHttpServletRequest req)throws Exception{
  h.create(f,h.id(),h.body(f,"CadenceConfig"),h.id());
  long version=h.db.queryForObject("SELECT MAX(saved_runtime_revision) FROM amvp_configs WHERE owner_binding_id=?",Long.class,f.binding());
  return c.authenticated(req).createPreparation(req,UUID.fromString(f.executor()),new ExactAttempt(UUID.randomUUID(),"owned-prepare"),new BindingExpectation(UUID.fromString(f.binding()),1),version,policy);
 }
 @Test @Order(1) void preparedStoreReadCasAndNoExecutionWrites()throws Exception{
  var f=h.fixture();var req=authenticated(f);long sessions=count("focus_sessions"),commands=count("execution_commands"),locks=count("active_execution_locks");
  var stored=prepare(f,req);var key=new ByReference(stored.original().reference(),stored.original().requestDigest());
  var source=c.readOwnedSource(req,UUID.fromString(f.executor()),stored.original().reference(),1);assertEquals(AmvpP1Preparation.hash(source.raw()),source.rawSha256());
  var cancel=new ExactAttempt(UUID.randomUUID(),"cancel");var service=c.authenticated(req);
  var result=service.retirePreparation(req,UUID.fromString(f.executor()),cancel,stored.original().reference(),1,RetirementIntent.USER_CANCEL);
  assertEquals(2,result.savedRevision());assertEquals(result,service.retirePreparation(req,UUID.fromString(f.executor()),cancel,stored.original().reference(),1,RetirementIntent.USER_CANCEL));
  assertThrows(Rejected.class,()->c.readOwnedSource(req,UUID.fromString(f.executor()),stored.original().reference(),1));
  assertEquals(sessions,count("focus_sessions"));assertEquals(commands,count("execution_commands"));assertEquals(locks,count("active_execution_locks"));
 }
 @Test @Order(2) void actualAuthenticationOverLoopbackHttpSourceRead()throws Exception{
  var f=h.fixture();var req=authenticated(f);var stored=prepare(f,req);var key=new ByReference(stored.original().reference(),stored.original().requestDigest());
  // Test-only endpoint, never a product route. Explicit authorization also covers this ephemeral listener.
  HttpServer server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
  server.createContext("/p1-test/source",exchange->{try{
   var incoming=new MockHttpServletRequest();incoming.addHeader("Authorization",Objects.toString(exchange.getRequestHeaders().getFirst("Authorization"),""));
   byte[] bytes=h.json.writeValueAsBytes(c.readOwnedSource(incoming,UUID.fromString(f.executor()),stored.original().reference(),1));exchange.sendResponseHeaders(200,bytes.length);exchange.getResponseBody().write(bytes);
  }catch(MemberAuth.Failure error){exchange.sendResponseHeaders(error.status,-1);}catch(Exception error){exchange.sendResponseHeaders(503,-1);}finally{exchange.close();}});
  server.start();try{var url=URI.create("http://127.0.0.1:"+server.getAddress().getPort()+"/p1-test/source");var client=HttpClient.newHttpClient();
   assertEquals(200,client.send(HttpRequest.newBuilder(url).header("Authorization",req.getHeader("Authorization")).build(),HttpResponse.BodyHandlers.ofString()).statusCode());
   assertEquals(401,client.send(HttpRequest.newBuilder(url).header("Authorization","Bearer invalid-test-token").build(),HttpResponse.BodyHandlers.ofString()).statusCode());
  }finally{server.stop(0);}
 }
 @Test @Order(3) void officialPkceLinkAndDisconnectShareBindingTransaction()throws Exception{
  var f=h.fixture();String proof=UUID.randomUUID().toString(),verifier="v".repeat(43),code=UUID.randomUUID().toString();
  String challenge=Base64.getUrlEncoder().withoutPadding().encodeToString(java.security.MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
  var request=new MockHttpServletRequest();request.addHeader("X-Installation-Proof",proof);
  String link=new TransactionTemplate(h.manager).execute(tx->{
   h.db.update("UPDATE extension_installations SET proof_hash=? WHERE id=?",MemberAuth.hash(proof),f.executor());
   var created=h.auth.link(request,h.auth.obj("executor_id",f.executor(),"callback_uri","chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/popup/popup.html","code_challenge",challenge,"state","s".repeat(32)));
   String id=created.path("link_request_id").asText();
   // Synthetic approval fixture only; not an actual user's approval/login.
   h.db.update("UPDATE link_requests SET approved_user_id=?,approved_auth_version=?,code_hash=?,code_expires_at=? WHERE id=?",f.identity().user(),h.auth.authVersion(f.identity().user()),MemberAuth.hash(code),MemberAuth.after(60),id);return id;
  });
  var result=c.link(request,h.auth.obj("link_request_id",link,"code_verifier",verifier,"code",code),new ExactAttempt(UUID.randomUUID(),"owned-link"),new CurrentOwner(UUID.fromString(f.binding()),1));
  assertEquals(2,result.transition().created().epoch());
  var authenticated=new MockHttpServletRequest();authenticated.addHeader("Authorization","Bearer "+result.authentication().path("access_token").asText());
  var ended=c.disconnect(authenticated,UUID.fromString(f.executor()),new ExactAttempt(UUID.randomUUID(),"owned-disconnect"),new CurrentOwner(result.transition().created().id(),2));
  assertNull(ended.created());assertNull(h.db.queryForObject("SELECT current_user_id FROM extension_installations WHERE id=?",Long.class,f.executor()));
  assertThrows(MemberAuth.Failure.class,()->c.authenticated(authenticated).queryTransition(authenticated,UUID.fromString(f.executor()),new ExactAttempt(ended.requestId(),ended.requestOriginal())));
 }
 long count(String table){return h.db.queryForObject("SELECT COUNT(*) FROM "+table,Long.class);}
}
