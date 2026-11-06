package kr.ac.kdu.focurve;
import java.time.*;import java.time.temporal.ChronoUnit;import java.util.*;import java.nio.file.*;
import org.junit.jupiter.api.*;import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.mockito.Mockito.*;import static org.junit.jupiter.api.Assertions.*;
import static kr.ac.kdu.focurve.AmvpP1Preparation.*;
/** One opt-in CAS case. Reuses schema/fixture code, NOT inherited HTTP/PKCE test methods. */
@EnabledIfEnvironmentVariable(named="FOCURVE_P1_CAS_EVIDENCE_TEST",matches="1")
@EnabledIfEnvironmentVariable(named="FOCURVE_AMVP_TEST_URL",matches="jdbc:mysql://127\\.0\\.0\\.1:[0-9]+/amvp_test_[a-f0-9]+.*")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@org.junit.jupiter.api.parallel.Execution(org.junit.jupiter.api.parallel.ExecutionMode.SAME_THREAD)
class AmvpP1CasEvidenceMysqlTest {
 @org.junit.jupiter.api.extension.RegisterExtension static final P1StopOnFirstFailure stop=new P1StopOnFirstFailure();
 final AmvpP1ConnectionMysqlTest fixture=new AmvpP1ConnectionMysqlTest();
 @BeforeAll void schema(){fixture.schema();}
 @Test void preparationCancellationCasKeepsExactTimesAcrossEveryBoundary()throws Exception{
  var h=fixture.h;var evidence=new P1TimeEvidence(Path.of("target/p1-cas-time-evidence.jsonl"));
  // Explicit test clock/policy, never a deployed default. No source data or credentials in evidence.
  Instant input=Instant.ofEpochSecond(Instant.now().getEpochSecond(),149011900),expected=input.truncatedTo(ChronoUnit.MILLIS);
  String created=expected.toString(),expires=expected.plusSeconds(300).toString();
  evidence.literals("initial_clock",Map.of("inputClock",input.toString(),"expectedCreatedAt",created,"expectedExpiresAt",expires));
  JdbcTemplate observed=spy(h.db);
  doAnswer(call->{String sql=call.getArgument(0);
   if(sql.startsWith("INSERT INTO amvp_p1_preparations"))evidence.payload("jdbc_bind_creation",call.getArgument(4,String.class));
   if(sql.startsWith("INSERT INTO amvp_p1_request_results"))evidence.payload("jdbc_bind_result",call.getArgument(8,String.class));
   if(sql.startsWith("UPDATE amvp_p1_preparations SET cas_revision"))evidence.payload("jdbc_bind_termination",call.getArgument(2,String.class));
   return call.callRealMethod();
  }).when(observed).update(anyString(),any(Object[].class));
  doAnswer(call->{var rows=(List<Map<String,Object>>)call.callRealMethod();
   for(var row:rows){if(row.get("creation_json")!=null)evidence.payload("jdbc_return_creation",row.get("creation_json").toString());
    if(row.get("result_json")!=null)evidence.payload("jdbc_return_result",row.get("result_json").toString());}
   return rows;
  }).when(observed).queryForList(anyString(),any(Object[].class));
  fixture.c=new AmvpP1ServerConnection(h.auth,new MemberAccounts(h.auth),new AmvpP1JdbcRepository(observed,h.manager,h.json),Clock.fixed(input,ZoneOffset.UTC),(handle,id)->{
   if(handle!=fixture.policy)throw new Rejected("POLICY_NOT_VERIFIED");return new Policy("TEST_ONLY_NOT_DEPLOYABLE",Duration.ofMinutes(5));
  });
  var f=h.fixture();var request=fixture.authenticated(f);long sessions=count(h.db,"focus_sessions"),commands=count(h.db,"execution_commands"),locks=count(h.db,"active_execution_locks");
  var stored=fixture.prepare(f,request);var original=stored.original();
  evidence.payload("create_response",h.json.writeValueAsString(h.auth.obj("createdAt",original.createdAt().toString(),"expiresAt",original.expiresAt().toString())));
  var dbLiteral=h.db.queryForMap("SELECT JSON_EXTRACT(creation_json,'$.original.createdAt') AS c,JSON_EXTRACT(creation_json,'$.original.expiresAt') AS e FROM amvp_p1_preparations WHERE preparation_id=? AND executor_id=? AND user_id=?",original.reference().toString(),f.executor(),f.identity().user());
  evidence.literals("db_json_extract_creation",Map.of("createdAt_json_literal",dbLiteral.get("c").toString(),"expiresAt_json_literal",dbLiteral.get("e").toString()));
  var source=fixture.c.readOwnedSource(request,UUID.fromString(f.executor()),original.reference(),1);evidence.payload("source_response",source.raw());
  var service=fixture.c.authenticated(request);var cancel=new ExactAttempt(UUID.randomUUID(),"cancel-time-evidence");
  var first=service.retirePreparation(request,UUID.fromString(f.executor()),cancel,original.reference(),1,RetirementIntent.USER_CANCEL);
  var replay=service.retirePreparation(request,UUID.fromString(f.executor()),cancel,original.reference(),1,RetirementIntent.USER_CANCEL);
  evidence.payload("cancel_response",h.json.writeValueAsString(h.auth.obj("createdAt",first.original().createdAt().toString(),"expiresAt",first.original().expiresAt().toString(),"at",first.storedTermination().at().toString())));
  evidence.payload("replay_response",h.json.writeValueAsString(h.auth.obj("createdAt",replay.original().createdAt().toString(),"expiresAt",replay.original().expiresAt().toString(),"at",replay.storedTermination().at().toString())));
  var terminal=h.db.queryForMap("SELECT JSON_EXTRACT(termination_json,'$.at') AS t,cas_revision AS v FROM amvp_p1_preparations WHERE preparation_id=? AND executor_id=? AND user_id=?",original.reference().toString(),f.executor(),f.identity().user());
  evidence.literals("db_json_extract_termination",Map.of("terminationAt_json_literal",terminal.get("t").toString(),"casRevision",terminal.get("v").toString()));
  evidence.requireStages("initial_clock","jdbc_bind_creation","jdbc_bind_result","db_json_extract_creation","jdbc_return_creation","jdbc_return_result","create_response","source_response","jdbc_bind_termination","db_json_extract_termination","cancel_response","replay_response");
  evidence.assertExact(created,expires);evidence.assertTermination(created);assertEquals(first,replay);assertEquals(2,replay.savedRevision());assertEquals(expected,first.storedTermination().at());
  assertThrows(Rejected.class,()->fixture.c.readOwnedSource(request,UUID.fromString(f.executor()),original.reference(),1));
  assertEquals(sessions,count(h.db,"focus_sessions"));assertEquals(commands,count(h.db,"execution_commands"));assertEquals(locks,count(h.db,"active_execution_locks"));
 }
 long count(JdbcTemplate db,String table){return db.queryForObject("SELECT COUNT(*) FROM "+table,Long.class);}
}
