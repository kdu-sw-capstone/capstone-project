package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.support.TransactionTemplate;
import static org.assertj.core.api.Assertions.*;
import static kr.ac.kdu.focurve.MemberAuth.*;

/** Real disposable MySQL/TCP; confirmed input and account cookies are SYNTHETIC.
 * No product bootstrap, email, Chrome, Native, policy START or provider call. */
@EnabledIfEnvironmentVariable(named="FOCURVE_OPTION12_TESTS",matches="1")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class DailyFocusGoalMysqlTest {
 MemberAuth a;JdbcTemplate db;DataSourceTransactionManager manager;TransactionTemplate tx;ObjectMapper json=new ObjectMapper();
 final Instant at=Instant.parse("2026-11-11T03:00:00Z");
 @BeforeAll void schema(){
  String url=System.getenv("FOCURVE_AMVP_TEST_URL");assertThat(url).matches("jdbc:mysql://127\\.0\\.0\\.1:[0-9]+/amvp_test_[a-f0-9]+.*");
  var ds=new DriverManagerDataSource(url,System.getenv("FOCURVE_AMVP_TEST_USER"),System.getenv("FOCURVE_AMVP_TEST_PASSWORD"));db=new JdbcTemplate(ds);manager=new DataSourceTransactionManager(ds);tx=new TransactionTemplate(manager);
  assertThat(db.queryForObject("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE()",Integer.class)).isZero();
  Flyway.configure().dataSource(ds).locations("classpath:db/migration").load().migrate();
  a=new MemberAuth(db,json,"https://localhost:33339",Base64.getEncoder().encodeToString(new byte[32]),"chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/popup/popup.html");
 }
 long user(){
  String name=id();db.update("INSERT INTO users(display_name,email_verified,status,created_at,terms_version,terms_accepted_at) VALUES(?,true,'ACTIVE',UTC_TIMESTAMP(3),'test',UTC_TIMESTAMP(3))",name);
  return db.queryForObject("SELECT id FROM users WHERE display_name=?",Long.class,name);
 }
 ObjectNode body(Integer minutes,String zone){return a.obj("goal_minutes",minutes,"timezone",zone);}
 ObjectNode save(long user,Integer n,String zone,long v,Instant now){return tx.execute(t->new DailyFocusGoal(a).save(user,body(n,zone),"\""+v+"\"",id(),now));}
 ObjectNode today(long user,Instant now){return tx.execute(t->new DailyFocusGoal(a).today(user,now));}
 long interval(long user,Instant start,Instant until,String state){
  String executor=id(),snapshot=id(),session=id();db.update("INSERT INTO extension_installations(id,current_user_id,proof_hash,client_version) VALUES(?,?,?,'fixture')",executor,user,"0".repeat(64));
  db.update("INSERT INTO policy_snapshots(id,user_id,executor_id,format_version,payload,payload_hash,created_at) VALUES(?,?,?,'1.2','{}',?,UTC_TIMESTAMP(3))",snapshot,user,executor,"0".repeat(64));
  var s=a.obj("session_id",session,"duration_minutes",180);
  db.update("INSERT INTO focus_sessions(source_session_id,user_id,executor_id,policy_snapshot_id,execution_status,duration_minutes,desired_revision,body,source,origin,record_status) VALUES(?,?,?,?,?,180,1,?,'MANUAL','MEMBER','PARTIAL')",session,user,executor,snapshot,state,s.toString());
  long sid=db.queryForObject("SELECT id FROM focus_sessions WHERE source_session_id=?",Long.class,session);
  var report=a.obj("report_id",id(),"command_id",id(),"session_id",session,"executor_id",executor,"desired_revision",1,"result","APPLIED","observed_at",until.toString(),"intervals",List.of(a.obj("interval_id",id(),"kind","RUN","start_at",start.toString(),"quality","CONFIRMED")));
  tx.execute(t->{new MemberExecution(a,json).intervals(sid,s,report);return null;});return sid;
 }
 @Test void accountNullBoundsConflictAndIdempotentLostReply()throws Exception{
  long u=user(),other=user();assertThat(today(u,at).path("confirmed_ms").isNull()).isTrue();
  String key=id();var b=body(1440,"Asia/Seoul");var first=tx.execute(t->new DailyFocusGoal(a).save(u,b,"\"0\"",key,at));
  assertThat(first.path("version").asLong()).isEqualTo(1);assertThat(first.path("goal_minutes").asInt()).isEqualTo(1440);
  assertThat((Object)tx.<ObjectNode>execute(t->new DailyFocusGoal(a).save(u,b,"\"0\"",key,at))).isEqualTo(json.readTree(first.toString()));
  assertThatThrownBy(()->save(u,10,"Asia/Seoul",0,at)).hasMessage("VERSION_CONFLICT");
  assertThatThrownBy(()->tx.execute(t->new DailyFocusGoal(a).save(u,body(30,"Asia/Seoul"),"\"1\"",key,at))).hasMessage("IDEMPOTENCY_CONFLICT");
  assertThat(today(other,at).path("goal_minutes").isNull()).isTrue();save(u,null,"Asia/Seoul",1,at);
  assertThat(today(u,at).path("goal_minutes").isNull()).isTrue();
  assertThatThrownBy(()->save(u,1441,"Asia/Seoul",2,at)).hasMessage("VALIDATION_FAILED");
 }
 @Test void ongoingConfirmedOverlapAndUnknownTailNeverUseNow(){
  long u=user();save(u,30,"UTC",0,at);interval(u,at.minusSeconds(120),at.minusSeconds(60),"UNKNOWN");interval(u,at.minusSeconds(90),at.minusSeconds(30),"RUNNING");
  var row=today(u,at);assertThat(row.path("confirmed_ms").asLong()).isEqualTo(90000);assertThat(row.path("has_unconfirmed_session").asBoolean()).isTrue();
  assertThat(today(u,at.plusSeconds(15)).path("confirmed_ms").asLong()).isEqualTo(90000);
  assertThat(db.queryForObject("SELECT COUNT(*) FROM session_intervals WHERE quality='CONFIRMED'",Integer.class)).isGreaterThanOrEqualTo(2);
 }
 @Test void timezoneChangePreservesOldLedgerAndOnlyAffectsSubsequentPortion(){
  long u=user();save(u,60,"Asia/Seoul",0,at.minusSeconds(600));interval(u,at.minusSeconds(300),at,"RUNNING");
  var old=db.queryForObject("SELECT payload FROM session_intervals i JOIN focus_sessions s ON i.session_id=s.id WHERE s.user_id=?",String.class,u);
  save(u,60,"America/New_York",1,at.minusSeconds(120));
  assertThat(today(u,at).path("confirmed_ms").asLong()).isEqualTo(120000);assertThat(today(u,at).path("partial_day").asBoolean()).isTrue();
  assertThat(db.queryForObject("SELECT payload FROM session_intervals i JOIN focus_sessions s ON i.session_id=s.id WHERE s.user_id=?",String.class,u)).isEqualTo(old);
  assertThat(db.queryForObject("SELECT COUNT(*) FROM daily_focus_timezones WHERE user_id=?",Integer.class,u)).isEqualTo(2);
 }
 @Test void midnightAndDstUseConfirmedPiecesWithoutCountingAWholeTimer(){
  long u=user();var now=Instant.parse("2026-11-01T06:30:00Z");save(u,90,"America/New_York",0,now);interval(u,Instant.parse("2026-11-01T03:30:00Z"),Instant.parse("2026-11-01T05:30:00Z"),"RUNNING");
  var row=today(u,now);assertThat(row.path("confirmed_ms").asLong()).isEqualTo(5400000);
  assertThat(Duration.between(Instant.parse(row.path("day_start").asText()),Instant.parse(row.path("day_end").asText())).toHours()).isEqualTo(25);
 }
 @Test void concurrentWritesHaveOneWinnerAndRollbackRestoresSettings(){
  long u=user();save(u,60,"UTC",0,at);var start=new CountDownLatch(1);
  try(var pool=Executors.newFixedThreadPool(2)){
   var tasks=new ArrayList<Future<Boolean>>();for(int n:List.of(10,20))tasks.add(pool.submit(()->{start.await();try{save(u,n,"UTC",1,at);return true;}catch(Failure f){assertThat(f.code).isEqualTo("VERSION_CONFLICT");return false;}}));start.countDown();
   int winners=0;for(var task:tasks)if(task.get(10,TimeUnit.SECONDS))winners++;assertThat(winners).isEqualTo(1);
  }catch(Exception e){throw new AssertionError(e);}
  var before=today(u,at);assertThatThrownBy(()->tx.execute(t->{new DailyFocusGoal(a).save(u,body(100,"Asia/Seoul"),"\"2\"",id(),at);throw new Failure(503,"fixture rollback");})).hasMessage("fixture rollback");
  assertThat(today(u,at)).isEqualTo(before);
 }
 @Test void withdrawalRevisionAndUnavailableProviderCannotDispatchOrEraseJobs()throws Exception{
  long u=user();var safety=new AnalysisSafety(a);db.update("INSERT INTO analysis_consents VALUES(?,true,'old-notice',1,UTC_TIMESTAMP(3))",u);
  var withdraw=a.obj("accepted",false,"notice_version","old-notice");String key=id();
  var result=tx.execute(t->safety.withdraw(u,withdraw,"\"1\"",key,at));assertThat(result.path("accepted").asBoolean()).isFalse();
  assertThat((Object)tx.<ObjectNode>execute(t->safety.withdraw(u,withdraw,"\"1\"",key,at))).isEqualTo(json.readTree(result.toString()));
  assertThatThrownBy(()->tx.execute(t->safety.withdraw(u,withdraw,"\"1\"",id(),at))).hasMessage("VERSION_CONFLICT");
  assertThatThrownBy(()->tx.execute(t->safety.withdraw(u,a.obj("accepted",true,"notice_version","unapproved"),"\"2\"",id(),at))).hasMessage("PROVIDER_UNAVAILABLE");
  assertThatThrownBy(()->safety.rejectSubmission(u,a.obj("from_date","2026-11-01","to_date","2026-11-11","consent_version","old-notice"))).hasMessage("CONSENT_REQUIRED");
  assertThat(db.queryForObject("SELECT COUNT(*) FROM analysis_jobs",Integer.class)).isZero();
 }
 @Test void snapshotAndInFlightHistorySurviveWithdrawalAndDatabaseReconnect(){
  long u=user();String job=id();var input=AnalysisSafety.freeze("2026-11-01","2026-11-11",at.toString(),a.obj("completed_sessions",3,"active_duration_ms",1800000));
  db.update("INSERT INTO analysis_consents VALUES(?,true,'old-notice',1,UTC_TIMESTAMP(3))",u);
  db.update("INSERT INTO analysis_jobs(id,user_id,from_date,to_date,input_hash,input_snapshot,status,consent_version,provider,model_version,created_at) VALUES(?,?,'2026-11-01','2026-11-11',?,?,'RUNNING','old-notice','fixture-only','fixture-only',UTC_TIMESTAMP(3))",job,u,input.hash(),input.json());
  String before=db.queryForObject("SELECT input_snapshot FROM analysis_jobs WHERE id=?",String.class,job);
  tx.execute(t->new AnalysisSafety(a).withdraw(u,a.obj("accepted",false,"notice_version","old-notice"),"\"1\"",id(),at));
  var reopened=new JdbcTemplate(new DriverManagerDataSource(System.getenv("FOCURVE_AMVP_TEST_URL"),System.getenv("FOCURVE_AMVP_TEST_USER"),System.getenv("FOCURVE_AMVP_TEST_PASSWORD")));
  assertThat(reopened.queryForObject("SELECT input_snapshot FROM analysis_jobs WHERE id=?",String.class,job)).isEqualTo(before);
  assertThat(reopened.queryForObject("SELECT input_hash FROM analysis_jobs WHERE id=?",String.class,job)).isEqualTo(input.hash());
  assertThat(reopened.queryForObject("SELECT status FROM analysis_jobs WHERE id=?",String.class,job)).isEqualTo("RUNNING");
  assertThatThrownBy(()->new AnalysisSafety(a).rejectSubmission(u,a.obj("from_date","2026-11-01","to_date","2026-11-11","consent_version","old-notice"))).hasMessage("CONSENT_REQUIRED");
 }
 @Test void loopbackCookieCsrfOwnershipAndProviderRefusal()throws Exception{
  long u=user();String cookie=id(),csrf=id();db.update("INSERT INTO web_sessions(id_hash,user_id,csrf_hash,expires_at,auth_version) VALUES(?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 1 HOUR),(SELECT auth_version FROM users WHERE id=?))",hash(cookie),u,hash(csrf),u);
  try(var http=new AmvpLoopbackHttp(a,manager,null,null,null,null)){
   assertThat(http.send("GET","/api/v1/daily-focus-goal/today",null,null).statusCode()).isEqualTo(401);
   var get=http.send("GET","/api/v1/daily-focus-goal/today",null,null,"Cookie","FOCURVE_WEB="+cookie);assertThat(get.statusCode()).isEqualTo(200);assertThat(json.readTree(get.body()).path("time_status").asText()).isEqualTo("TIMEZONE_NOT_SET");
   String body=body(30,"UTC").toString();assertThat(http.send("PUT","/api/v1/daily-focus-goal",null,body,"Cookie","FOCURVE_WEB="+cookie,"If-Match","\"0\"","Idempotency-Key",id()).statusCode()).isEqualTo(403);
   var put=http.send("PUT","/api/v1/daily-focus-goal",null,body,"Cookie","FOCURVE_WEB="+cookie,"Origin",a.origin,"X-CSRF-Token",csrf,"If-Match","\"0\"","Idempotency-Key",id());assertThat(put.statusCode()).isEqualTo(200);assertThat(put.headers().firstValue("etag")).contains("\"1\"");
   assertThat(http.send("PUT","/api/v1/daily-focus-goal",null,"{\"goal_minutes\":1,\"goal_minutes\":2,\"timezone\":\"UTC\"}","Cookie","FOCURVE_WEB="+cookie,"Origin",a.origin,"X-CSRF-Token",csrf,"If-Match","\"1\"","Idempotency-Key",id()).statusCode()).isEqualTo(422);
   var ai=http.send("GET","/api/v1/analysis-consent",null,null,"Cookie","FOCURVE_WEB="+cookie);assertThat(ai.statusCode()).isEqualTo(200);assertThat(json.readTree(ai.body()).path("provider_configured").asBoolean()).isFalse();
  }
 }
}
