package kr.ac.kdu.focurve;
import java.time.*;import java.util.*;
import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import static org.junit.jupiter.api.Assertions.*;import static org.mockito.Mockito.*;
import static kr.ac.kdu.focurve.AmvpP1Preparation.*;
/** Local JDBC-bind capture and explicitly simulated JSON numeric normalization; no actual DB. */
class AmvpP1PrecisionTest {
 @Test void jsonPersistenceKeepsExactOriginalInstantInsteadOfBinaryFloatTimestamp()throws Exception{
  var db=mock(JdbcTemplate.class);var manager=mock(PlatformTransactionManager.class);when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
  var json=new ObjectMapper().findAndRegisterModules();var repo=new AmvpP1JdbcRepository(db,manager,json);
  UUID executor=UUID.randomUUID(),reference=UUID.randomUUID();Instant created=Instant.parse("2026-11-06T04:39:39.149011900Z");
  var attempt=new ExactAttempt(UUID.randomUUID(),"precise-original");var original=new PreparationOriginal(reference,executor,1,attempt.requestId(),attempt.digest(),new BindingExpectation(UUID.randomUUID(),1),new Snapshot("1.2","{}",1),"test-only",created,created.plusSeconds(300));
  var stored=new StoredPreparation(original,1,null,attempt);var bound=new java.util.concurrent.atomic.AtomicReference<String>();
  when(db.queryForList(startsWith("SELECT current_user_id"),any(Object[].class))).thenReturn(List.of(Map.of("current_user_id",1L)));
  when(db.update(startsWith("INSERT INTO amvp_p1_preparations"),any(Object[].class))).thenAnswer(call->{bound.set(call.getArgument(4,String.class));return 1;});
  repo.atomic(true,tx->{tx.currentUser(executor);tx.savePreparation(new PreparationRow(stored,1,null),null);return null;});
  String jdbcBound=bound.get();assertNotNull(jdbcBound);
  // Direct decode of the JDBC string retains nanos; numeric JSON tree storage can use doubles.
  assertEquals(stored,json.readValue(jdbcBound,StoredPreparation.class));
  JsonNode normalized=json.readTree(jdbcBound);
  // Recorded failed run changed .149011900 to .149012. Replay that observed numeric
  // JSON boundary only; this does NOT claim a newly executed MySQL conversion.
  if(normalized.path("original").path("createdAt").isNumber()){
   ((com.fasterxml.jackson.databind.node.ObjectNode)normalized.path("original")).put("createdAt",new java.math.BigDecimal("1793939979.149012"));
   ((com.fasterxml.jackson.databind.node.ObjectNode)normalized.path("original")).put("expiresAt",new java.math.BigDecimal("1793940279.149012"));
  }
  String simulated=json.writeValueAsString(normalized);
  java.nio.file.Files.writeString(java.nio.file.Path.of("target/precision-boundary.json"),json.writeValueAsString(Map.of("initial",created.toString(),"jdbc_string",jdbcBound,"simulated_json_numeric_storage",simulated)));
  when(db.queryForList(startsWith("SELECT * FROM amvp_p1_preparations"),any(Object[].class))).thenReturn(List.of(Map.of("creation_json",simulated,"cas_revision",1L)));
  var read=repo.atomic(false,tx->tx.preparation(reference));assertEquals(stored,read.creation());
  assertTrue(normalized.path("original").path("createdAt").isTextual(),"Persist immutable Instants as strings, not JSON floating timestamps");
 }
 @Test void serverGeneratedImmutableTimesFollowUtcMillisecondContract(){
  var f=new AmvpP1PreparationTest();f.setup();f.clock.now=Instant.parse("2026-11-06T04:39:39.149011900Z");
  var binding=f.link().created();assertEquals(Instant.parse("2026-11-06T04:39:39.149Z"),binding.createdAt());
  var p=f.service.createPreparation(f.context,AmvpP1PreparationTest.EXEC,f.attempt("precise-create"),f.expectation(binding),1,f.policyHandle);
  assertEquals(Instant.parse("2026-11-06T04:39:39.149Z"),p.original().createdAt());assertEquals(Instant.parse("2026-11-06T04:44:39.149Z"),p.original().expiresAt());
  var retired=f.service.retirePreparation(f.context,AmvpP1PreparationTest.EXEC,f.attempt("precise-cancel"),p.original().reference(),1,RetirementIntent.USER_CANCEL);
  assertEquals(Instant.parse("2026-11-06T04:39:39.149Z"),retired.storedTermination().at());
 }
}
