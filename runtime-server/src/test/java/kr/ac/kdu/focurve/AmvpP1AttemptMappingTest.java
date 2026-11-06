package kr.ac.kdu.focurve;
import java.util.*;import java.util.function.Function;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import jakarta.servlet.http.HttpServletRequest;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
import static kr.ac.kdu.focurve.AmvpP1Preparation.*;
/** Actual Server preparation/connection code with in-memory transaction source, not HTTP/MySQL. */
class AmvpP1AttemptMappingTest {
 AmvpP1PreparationTest f;AmvpP1ServerConnection c;MemberAuth auth;HttpServletRequest request;StoredPreparation stored;ExactAttempt lastReadAttempt;
 static final Map<String,Object> exports=new LinkedHashMap<>();
 @BeforeEach void setup(){
  f=new AmvpP1PreparationTest();f.setup();var binding=f.link().created();
  var db=mock(JdbcTemplate.class);auth=spy(new MemberAuth(db,new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules(),"https://test.invalid",Base64.getEncoder().encodeToString(new byte[32]),"https://test.invalid"));
  request=mock(HttpServletRequest.class);doReturn(new MemberAuth.Identity(1,AmvpP1PreparationTest.EXEC.toString())).when(auth).identity(any(),anyBoolean());
  var jdbc=mock(AmvpP1JdbcRepository.class);
  doAnswer(call->((Function<Repository,Object>)call.getArgument(0)).apply(f.repo)).when(jdbc).own(any());
  c=new AmvpP1ServerConnection(auth,mock(MemberAccounts.class),jdbc,f.clock,f.policies);
  when(db.queryForList(anyString(),any(Object[].class))).thenReturn(List.of(Map.of("config_id",UUID.randomUUID().toString(),"kind","CONTENT","version",3L,"saved_runtime_revision",3L,"value_json","{}")));
  f.settings.set(f.repo.atomic(false,tx->c.settings(tx,new Identity(1,AmvpP1PreparationTest.EXEC))));
  stored=f.service.createPreparation(f.context,AmvpP1PreparationTest.EXEC,f.attempt("protected-create-original"),f.expectation(binding),3,f.policyHandle);
 }
 ExactAttempt readAttempt(UUID reference,long version){return new ExactAttempt(UUID.randomUUID(),AdditionalConfigContract.canonical(auth.obj("sourceRef",auth.obj("id",reference.toString(),"version",version))));}
 AmvpP1ServerConnection.SourceRead read(){lastReadAttempt=readAttempt(stored.original().reference(),1);return c.readOwnedSource(request,AmvpP1PreparationTest.EXEC,stored.original().reference(),1);}
 @Test void authenticatedReadResolvesCreationDigestFromProtectedJournal(){
  var source=read();assertEquals(stored.original().reference().toString(),source.sourceRef());assertEquals(1,source.sourceVersion());
  try{var raw=auth.json.readTree(source.raw());exports.put("core_read_attempt_fixture",Map.of("requestId",lastReadAttempt.requestId().toString(),"original",auth.json.readTree(lastReadAttempt.original()),"originalDigest",lastReadAttempt.digest()));assertEquals(stored.original().requestDigest(),raw.path("requestDigest").asText());assertEquals(3,raw.path("snapshot").path("settingsVersion").asInt());}catch(Exception x){throw new AssertionError(x);}
  exports.put("normal",source);
 }
 @Test void callerDigestCannotOverrideProtectedCreationDigest(){
  var body=auth.obj("sourceRef",auth.obj("id",stored.original().reference().toString(),"version",1,"requestDigest","0".repeat(64)));
  assertThrows(Rejected.class,()->c.readAttemptSource(request,AmvpP1PreparationTest.EXEC,new ExactAttempt(UUID.randomUUID(),AdditionalConfigContract.canonical(body)),stored.original().reference(),1));
 }
 @Test void corruptedCreationJournalOriginalIsRejectedNotNormalAbsence(){
  var key=new RequestKey(AmvpP1PreparationTest.EXEC,1,stored.original().requestId());var j=f.repo.state.journal.get(key);
  f.repo.state.journal.put(key,new Journal(j.requestOriginal(),"0".repeat(64),j.fingerprint(),j.kind(),j.result()));
  var failure=assertThrows(Rejected.class,this::read);assertEquals("SOURCE_CONFLICT",failure.internalReason);exports.put("wrong_creation_digest",failure.internalReason);
 }
 @Test void changedPreparationOriginalCannotBorrowAnotherJournal(){
  var row=f.repo.state.prepared.get(stored.original().reference());var o=stored.original();
  var altered=new PreparationOriginal(o.reference(),o.executor(),o.user(),o.requestId(),o.requestDigest(),o.binding(),new Snapshot(o.snapshot().format(),"changed-bytes",3),o.policyId(),o.createdAt(),o.expiresAt());
  var different=new StoredPreparation(altered,1,null,stored.resultAttempt());f.repo.state.prepared.put(o.reference(),new PreparationRow(different,1,null));
  assertEquals("SOURCE_CONFLICT",assertThrows(Rejected.class,this::read).internalReason);
 }
 @Test void missingBackingJournalIsCorruptionWhileMissingOwnedReferenceIsNormalNull(){
  f.repo.state.journal.remove(new RequestKey(AmvpP1PreparationTest.EXEC,1,stored.original().requestId()));assertThrows(Rejected.class,this::read);
  UUID absent=UUID.randomUUID();assertNull(c.readAttemptSource(request,AmvpP1PreparationTest.EXEC,readAttempt(absent,1),absent,1));exports.put("absent",null);
 }
 @Test void expiryRejectsWithoutChangingOriginal(){
  var original=stored.original();f.clock.now=original.expiresAt();assertEquals("SOURCE_UNCONFIRMED",assertThrows(Rejected.class,this::read).internalReason);
  assertEquals(original,f.repo.state.prepared.get(original.reference()).creation().original());exports.put("expired","SOURCE_UNCONFIRMED");
 }
 @Test void ownerTransitionCannotReadPreviousOwnerPrepared(){
  f.repo.state.users.put(AmvpP1PreparationTest.EXEC,2L);assertEquals("STALE_OWNER",assertThrows(Rejected.class,this::read).internalReason);exports.put("owner_changed","STALE_OWNER");
 }
 @Test void postcommitOwnerFailureKeepsStoredPreparationButRejectsConsumption(){
  f.repo.afterCommit=()->f.repo.state.users.put(AmvpP1PreparationTest.EXEC,2L);var b=stored.original().binding();var attempt=f.attempt("postcommit-create");
  assertThrows(Rejected.class,()->f.service.createPreparation(f.context,AmvpP1PreparationTest.EXEC,attempt,b,3,f.policyHandle));
  var saved=f.repo.state.journal.get(new RequestKey(AmvpP1PreparationTest.EXEC,1,attempt.requestId()));assertNotNull(saved);
  stored=(StoredPreparation)saved.result();assertThrows(Rejected.class,this::read);assertTrue(f.repo.state.prepared.containsKey(stored.original().reference()));exports.put("postcommit_rejected","STALE_OWNER");
 }
 @Test void existingContractExampleIsAvailableWithoutStartingDatabase()throws Exception{
  var helper=new AdditionalConfigMysqlTest();var value=helper.value("CadenceConfig");
  new AdditionalConfigContract(helper.json).validate("CadenceConfig",value);
 }
 @AfterAll static void export()throws Exception{
  java.nio.file.Files.writeString(java.nio.file.Path.of("target/server-core-attempt-fixtures.json"),new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules().writeValueAsString(exports));
 }
}
