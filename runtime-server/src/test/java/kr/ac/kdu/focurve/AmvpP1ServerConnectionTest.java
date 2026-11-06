package kr.ac.kdu.focurve;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import java.time.*;import java.util.*;import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.*;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
import static kr.ac.kdu.focurve.AmvpP1Preparation.*;
/** Mock SQL/authentication boundary, NOT MySQL/HTTP execution. */
class AmvpP1ServerConnectionTest {
 final UUID e=UUID.randomUUID(),b=UUID.randomUUID();final Clock clock=Clock.fixed(Instant.parse("2026-11-06T00:00:00Z"),ZoneOffset.UTC);
 JdbcTemplate db;MemberAuth auth;MemberAccounts accounts;PlatformTransactionManager manager;AmvpP1JdbcRepository repo;AmvpP1ServerConnection c;HttpServletRequest request;
 @BeforeEach void setup(){
  db=mock(JdbcTemplate.class);manager=mock(PlatformTransactionManager.class);accounts=mock(MemberAccounts.class);request=mock(HttpServletRequest.class);
  var json=new ObjectMapper().findAndRegisterModules();auth=spy(new MemberAuth(db,json,"https://test.invalid",Base64.getEncoder().encodeToString(new byte[32]),"https://test.invalid"));
  repo=new AmvpP1JdbcRepository(db,manager,json);c=spy(new AmvpP1ServerConnection(auth,accounts,repo,clock,(h,i)->{throw new Rejected("POLICY_NOT_VERIFIED");}));
  when(manager.getTransaction(any())).thenAnswer(x->{TransactionSynchronizationManager.setActualTransactionActive(true);return new SimpleTransactionStatus();});
  doAnswer(x->{TransactionSynchronizationManager.setActualTransactionActive(false);return null;}).when(manager).commit(any());
  doAnswer(x->{TransactionSynchronizationManager.setActualTransactionActive(false);return null;}).when(manager).rollback(any());
 }
 @AfterEach void cleanup(){TransactionSynchronizationManager.clear();}
 @Test void outerCommitAndHandleCannotEscape(){
  AtomicReference<Repository> escape=new AtomicReference<>();assertEquals("ok",repo.own(r->{escape.set(r);assertTrue(TransactionSynchronizationManager.isActualTransactionActive());return "ok";}));
  verify(manager).commit(any());assertThrows(Rejected.class,()->escape.get().atomic(false,t->null));
 }
 @Test void failureRollbackAndUnknownOuterRejected(){
  assertThrows(IllegalStateException.class,()->repo.own(r->{throw new IllegalStateException();}));verify(manager).rollback(any());
  TransactionSynchronizationManager.setActualTransactionActive(true);assertThrows(Rejected.class,()->repo.own(r->null));
 }
 void rows(boolean active){
  when(db.queryForList(anyString(),any(Object[].class))).thenAnswer(call->{String sql=call.getArgument(0);
   if(sql.contains("SELECT current_user_id"))return List.of(Map.of("current_user_id",1L));
   if(sql.contains("FROM link_requests"))return List.of(Map.of("executor_id",e.toString()));
   if(sql.contains("SELECT * FROM amvp_owner_bindings")&&active)return List.of(Map.of("binding_id",b.toString(),"executor_id",e.toString(),"user_id",1L,"owner_epoch",1L,"created_at",java.sql.Timestamp.from(clock.instant())));
   return List.of();});
  when(db.queryForObject(anyString(),eq(Long.class),any(Object[].class))).thenReturn(0L);when(db.update(anyString(),any(Object[].class))).thenReturn(1);
  doReturn(new MemberAuth.Identity(1,e.toString())).when(auth).identity(any(),anyBoolean());
 }
 @Test void tokenAndBindingUseOneOuterTransaction(){
  rows(false);doAnswer(call->{assertTrue(TransactionSynchronizationManager.isActualTransactionActive());return auth.obj("access_token","synthetic-token");}).when(auth).token(eq(request),any());
  var result=c.link(request,auth.obj("link_request_id",UUID.randomUUID().toString()),new ExactAttempt(UUID.randomUUID(),"link"),new AbsentOwner());
  assertEquals(1,result.transition().created().epoch());verify(manager).commit(any());verify(db).update(startsWith("INSERT INTO amvp_owner_bindings"),any(Object[].class));
 }
 @Test void accountFailureRollsBackBindingClosure(){
  rows(true);doThrow(new IllegalStateException()).when(accounts).disconnect(any(),eq(e.toString()));
  assertThrows(IllegalStateException.class,()->c.disconnect(request,e,new ExactAttempt(UUID.randomUUID(),"unlink"),new CurrentOwner(b,1)));
  verify(db).update(startsWith("UPDATE amvp_owner_bindings"),any(Object[].class));verify(manager).rollback(any());verify(manager,never()).commit(any());
 }
 Tx tx(){Tx t=mock(Tx.class);when(t.currentUser(e)).thenReturn(1L);when(t.activeBindings(e)).thenReturn(List.of(new Binding(b,e,1,1,clock.instant(),null)));return t;}
 Map<String,Object> row(long revision,boolean deleted){var m=new HashMap<String,Object>();m.put("config_id",UUID.randomUUID().toString());m.put("kind","CONTENT");m.put("version",revision);m.put("saved_runtime_revision",revision);m.put("deleted_at",deleted?clock.instant():null);m.put("value_json","{}");return m;}
 @Test void savedRevisionAndTombstonesAreRealSettingsInput(){
  when(db.queryForList(anyString(),any(Object[].class))).thenReturn(List.of(row(2,false),row(8,true)));
  var s=c.settings(tx(),new Identity(1,e));assertEquals(8,s.settingsVersion());assertEquals("AMVP_P1_SETTINGS_SOURCE_1",s.format());assertTrue(s.bytes().contains("true"));
 }
 @Test void noSettingsNoInventedVersionAndOwnerMismatchRejects(){
  when(db.queryForList(anyString(),any(Object[].class))).thenReturn(List.of());assertThrows(Rejected.class,()->c.settings(tx(),new Identity(1,e)));
  Tx t=tx();when(t.currentUser(e)).thenReturn(2L);assertThrows(Rejected.class,()->c.settings(t,new Identity(1,e)));
 }
 Observation<StoredPreparation> observed(PreparationStatus status){var a=new ExactAttempt(UUID.randomUUID(),"request-original");
  var o=new PreparationOriginal(UUID.randomUUID(),e,1,a.requestId(),a.digest(),new BindingExpectation(b,7),new Snapshot("AMVP_P1_SETTINGS_SOURCE_1","{}",3),"synthetic-policy",clock.instant(),clock.instant().plusSeconds(60));
  return new Observation<>(new StoredPreparation(o,1,null,a),new CurrentStatus(new Binding(b,e,1,7,clock.instant(),null),3L,1,status,clock.instant()));
 }
 @Test void coreMappingHashesWholeOriginalAndKeepsVersionDomainsDistinct(){
  var service=mock(AmvpP1Preparation.class);doReturn(service).when(c).authenticated(request);var o=observed(PreparationStatus.CURRENT);var key=new ByReference(o.stored().original().reference(),o.stored().original().requestDigest());
  when(service.queryPreparation(request,e,key)).thenReturn(o);var r=c.readSource(request,e,key,1);
  try{java.nio.file.Files.writeString(java.nio.file.Path.of("target/p1-source-mapping.json"),auth.json.writeValueAsString(r));}catch(java.io.IOException x){throw new AssertionError(x);}
  assertEquals(1,r.sourceVersion());assertEquals(7,r.ownerEpoch());assertEquals(AmvpP1Preparation.hash(r.raw()),r.rawSha256());assertNotEquals("{}",r.raw());assertTrue(r.raw().contains(o.stored().original().reference().toString()));
  assertThrows(Rejected.class,()->c.readSource(request,e,key,3));
 }
 @Test void authenticatedAbsenceOnlyIsNullAndRetiredSourceRejects(){
  var service=mock(AmvpP1Preparation.class);doReturn(service).when(c).authenticated(request);var o=observed(PreparationStatus.EXPIRED);var key=new ByReference(o.stored().original().reference(),o.stored().original().requestDigest());
  when(service.queryPreparation(request,e,key)).thenReturn(o);assertThrows(Rejected.class,()->c.readSource(request,e,key,1));
  when(service.queryPreparation(request,e,key)).thenReturn(null);assertNull(c.readSource(request,e,key,1));
  when(service.queryPreparation(request,e,key)).thenThrow(new MemberAuth.Failure(401,"UNAUTHENTICATED"));assertEquals(401,assertThrows(MemberAuth.Failure.class,()->c.readSource(request,e,key,1)).status);
 }
 @Test void authReadOwnsSqlWriteCapableBoundaryButDoesNotCreateRows(){
  rows(false);var service=c.authenticated(request);
  assertNull(service.queryTransition(request,e,new ExactAttempt(UUID.randomUUID(),"absent")));
  verify(manager).getTransaction(argThat(definition->!definition.isReadOnly()));
  verify(db,never()).update(anyString(),any(Object[].class));
 }
 @Test void resetFailureRollsBackSecurityTransition(){
  rows(true);when(db.queryForList(startsWith("SELECT id FROM extension_installations"),any(Object[].class))).thenReturn(List.of(Map.of("id",e.toString())));
  when(accounts.token(any(),eq("PASSWORD_RESET"))).thenReturn(Map.of("user_id",1L));
  doThrow(new IllegalStateException("password update failed")).when(accounts).reset(any());
  assertThrows(IllegalStateException.class,()->c.resetPassword(auth.obj("token","synthetic-challenge"),Map.of(e,new ExactAttempt(UUID.randomUUID(),"reset"))));
  verify(db).update(startsWith("UPDATE amvp_owner_bindings"),any(Object[].class));verify(manager).rollback(any());
 }

}
