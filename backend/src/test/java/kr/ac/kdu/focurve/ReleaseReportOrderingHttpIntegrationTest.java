package kr.ac.kdu.focurve;
import static org.assertj.core.api.Assertions.*;
import java.time.*;import java.util.*;import java.util.concurrent.*;
import kr.ac.kdu.focurve.auth.*;import kr.ac.kdu.focurve.execution.*;
import org.junit.jupiter.api.Test;import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;import org.springframework.test.context.bean.override.mockito.MockitoBean;
/** Real Spring HTTP/MySQL, authenticated synthetic installation reports; no actual Chrome. */
@ActiveProfiles("test") @SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT)
class ReleaseReportOrderingHttpIntegrationTest {
 @Autowired TestRestTemplate http;@Autowired JdbcTemplate db;@MockitoBean MailDelivery mail;
 record F(long owner,String ex,String token,String sid,long session,String apply,String release,String interval,Instant begin,Instant end,String frozen,long version){}
 String id(){return UUID.randomUUID().toString();}
 @SuppressWarnings("unchecked") Map<String,Object> req(F f,String path,String method,Object body,int status) {
  var h=new HttpHeaders();h.setBearerAuth(f.token());h.setContentType(MediaType.APPLICATION_JSON);h.set("Idempotency-Key",id());
  var r=http.exchange(path,HttpMethod.valueOf(method),new HttpEntity<>(body,h),Map.class);assertThat(r.getStatusCode().value()).isEqualTo(status);return r.getBody();
 }
 F fixture(boolean applied,long version){
  String email=id()+"@example.invalid",ex=id(),refresh=id(),token=AuthSupport.token();
  db.update("INSERT INTO users(display_name,email,email_verified,status,created_at,terms_version,terms_accepted_at) VALUES ('release HTTP synthetic',?,true,'ACTIVE',UTC_TIMESTAMP(3),'dev-v1',UTC_TIMESTAMP(3))",email);
  long owner=db.queryForObject("SELECT id FROM users WHERE email=?",Long.class,email);
  db.update("INSERT INTO extension_installations VALUES (?,?,?,'RELEASE_HTTP_SYNTHETIC',UTC_TIMESTAMP(3))",ex,owner,AuthSupport.hash(id()));
  db.update("INSERT INTO extension_tokens VALUES (?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 1 DAY),NULL)",refresh,ex,owner,AuthSupport.hash(id()),id());
  db.update("INSERT INTO extension_access_tokens VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 15 MINUTE))",AuthSupport.hash(token),refresh);
  var auth=new F(owner,ex,token,null,0,null,null,id(),Instant.now().minusSeconds(2).truncatedTo(java.time.temporal.ChronoUnit.MILLIS),null,null,version);
  String sid=req(auth,"/api/v1/sessions","POST",Map.of("executor_id",ex,"duration_minutes",1),202).get("session_id").toString();
  long session=db.queryForObject("SELECT id FROM focus_sessions WHERE source_session_id=?",Long.class,sid);
  String apply=db.queryForObject("SELECT id FROM execution_commands WHERE session_id=?",String.class,session);
  String frozen=db.queryForObject("SELECT payload FROM policy_snapshots WHERE id=(SELECT policy_snapshot_id FROM focus_sessions WHERE id=?)",String.class,session);
  var f=new F(owner,ex,token,sid,session,apply,null,auth.interval(),auth.begin(),auth.begin().plusMillis(1000),frozen,version);
  if(applied)req(f,reports(f),"POST",apply(f),200);
  db.update("UPDATE focus_sessions SET version=? WHERE id=?",version,session);
  if(applied)req(f,"/api/v1/sessions/"+sid+"/end","POST",Map.of(),202);
  var commands=(List<?>)req(f,"/api/v1/executors/"+ex+"/commands","GET",null,200).get("commands");
  var release=(Map<?,?>)commands.getFirst();assertThat(release.get("type")).isEqualTo("RELEASE_POLICY");
  return new F(owner,ex,token,sid,session,apply,release.get("command_id").toString(),f.interval(),f.begin(),f.end(),frozen,version);
 }
 String reports(F f){return "/api/v1/executors/"+f.ex()+"/reports";}
 Map<String,Object> interval(F f,boolean closed){var i=new LinkedHashMap<String,Object>();i.put("interval_id",f.interval());i.put("kind","RUN");i.put("start_at",f.begin().toString());i.put("quality","CONFIRMED");if(closed){i.put("end_at",f.end().toString());i.put("duration_ms",1000);}return i;}
 Map<String,Object> apply(F f){return Map.of("report_id",id(),"command_id",f.apply(),"session_id",f.sid(),"executor_id",f.ex(),"desired_revision",1,"result","APPLIED","observed_at",f.begin().toString(),"intervals",List.of(interval(f,false)));}
 Map<String,Object> release(F f){return new LinkedHashMap<>(Map.of("report_id",id(),"command_id",f.release(),"session_id",f.sid(),"executor_id",f.ex(),"desired_revision",2,"result","RELEASED","observed_at",f.end().toString(),"intervals",List.of(interval(f,true))));}
 Map<String,Object> state(F f){return req(f,"/api/v1/sessions/"+f.sid(),"GET",null,200);}
 void finished(F f){
  var state=state(f);assertThat(state.get("execution_status")).isIn("ENDED","START_FAILED");
  assertThat(((Number)state.get("active_duration_ms")).longValue()).isEqualTo(1000);
  assertThat(db.queryForObject("SELECT COUNT(*) FROM active_execution_locks WHERE session_id=?",Long.class,f.session())).isZero();
  assertThat(db.queryForObject("SELECT COUNT(*) FROM session_intervals WHERE session_id=?",Long.class,f.session())).isEqualTo(1L);
  assertThat(db.queryForObject("SELECT SUM(duration_ms) FROM session_intervals WHERE session_id=?",Long.class,f.session())).isEqualTo(1000);
  assertThat(db.queryForObject("SELECT version FROM focus_sessions WHERE id=?",Long.class,f.session())).isEqualTo(f.version());
  assertThat(db.queryForObject("SELECT payload FROM policy_snapshots WHERE id=(SELECT policy_snapshot_id FROM focus_sessions WHERE id=?)",String.class,f.session())).isEqualTo(f.frozen());
 }
 @Test void normalAppliedThenReleasedStillClosesConfirmedRun(){var f=fixture(true,Long.MAX_VALUE);req(f,reports(f),"POST",release(f),200);assertThat(state(f).get("execution_status")).isEqualTo("ENDED");finished(f);}
 @Test void reverseOrderAndLateApplyNeverReopenOrDoubleCount(){var f=fixture(false,Long.MAX_VALUE);req(f,reports(f),"POST",release(f),200);var before=state(f);var applied=apply(f);req(f,reports(f),"POST",applied,200);req(f,reports(f),"POST",applied,200);assertThat(state(f)).isEqualTo(before);finished(f);}
 @Test void missingApplyReportCanFinishAllHistoricalUpperVersions(){for(long version:List.of(SafeVersion.MAX,SafeVersion.MAX+1,Long.MAX_VALUE)){var f=fixture(false,version);req(f,reports(f),"POST",release(f),200);finished(f);}}
 @Test void duplicateResponseLossAndPayloadConflictRemainIdempotent(){var f=fixture(false,Long.MAX_VALUE);var body=release(f);req(f,reports(f),"POST",body,200); // First result intentionally not used: simulate lost response.
  assertThat(req(f,reports(f),"POST",body,200).get("result")).isEqualTo("DUPLICATE");var changed=new LinkedHashMap<>(body);changed.put("observed_at",f.end().plusMillis(1).toString());
  assertThat(((Map<?,?>)req(f,reports(f),"POST",changed,409).get("error")).get("code")).isEqualTo("REPORT_CONFLICT");finished(f);
 }
 @Test void wrongCommandRevisionOwnerAndInstallationAreRejected(){var f=fixture(false,Long.MAX_VALUE);for(String field:List.of("command_id","desired_revision","executor_id")){var body=release(f);body.put(field,field.equals("desired_revision")?99:id());req(f,reports(f),"POST",body,field.equals("executor_id")?403:409);}
  var other=fixture(false,Long.MAX_VALUE);req(other,reports(f),"POST",release(f),403);var wrong=release(f);wrong.put("executor_id",other.ex());req(other,reports(other),"POST",wrong,404);
  assertThat(db.queryForObject("SELECT COUNT(*) FROM active_execution_locks WHERE session_id=?",Long.class,f.session())).isEqualTo(1);req(f,reports(f),"POST",release(f),200);finished(f);
 }
 @Test void openOrInventedIntervalEvidenceRollsBackReceiptAndRecovery(){var f=fixture(false,Long.MAX_VALUE);
  for(String invalid:List.of("open","beforeApply","afterDeadline","afterObserved","duration")){
   var i=interval(f,true);int status=422;
   switch(invalid){case "open"->i.remove("end_at");case "beforeApply"->i.put("start_at",f.begin().minusSeconds(120).toString());case "afterDeadline"->{i.put("start_at",f.begin().plusSeconds(100).toString());i.put("end_at",f.begin().plusSeconds(101).toString());}case "afterObserved"->i.put("end_at",f.end().plusSeconds(1).toString());case "duration"->{i.put("duration_ms",1001);status=409;}}
   var body=release(f);body.put("intervals",List.of(i));req(f,reports(f),"POST",body,status);
   assertThat(db.queryForObject("SELECT COUNT(*) FROM execution_reports WHERE id=?",Long.class,body.get("report_id"))).isZero();
   assertThat(db.queryForObject("SELECT COUNT(*) FROM session_intervals WHERE session_id=?",Long.class,f.session())).isZero();
   assertThat(db.queryForObject("SELECT COUNT(*) FROM active_execution_locks WHERE session_id=?",Long.class,f.session())).isEqualTo(1);
  }req(f,reports(f),"POST",release(f),200);finished(f);
 }
 @Test void missingEvidenceCannotEraseKnownRunOrConfirmUnconfirmedRelease(){var f=fixture(true,Long.MAX_VALUE);var body=release(f);body.put("intervals",List.of());req(f,reports(f),"POST",body,409);
  var unknown=release(f);unknown.put("result","UNCONFIRMED");unknown.put("intervals",List.of());req(f,reports(f),"POST",unknown,200);
  assertThat(state(f).get("execution_status")).isEqualTo("ENDING");assertThat(db.queryForObject("SELECT COUNT(*) FROM active_execution_locks WHERE session_id=?",Long.class,f.session())).isEqualTo(1);
  req(f,reports(f),"POST",release(f),200);finished(f);
 }
 @Test void concurrentIdenticalReleasedReportsCloseAndAggregateExactlyOnce() throws Exception {var f=fixture(false,Long.MAX_VALUE);var body=release(f);
  var a=CompletableFuture.supplyAsync(()->req(f,reports(f),"POST",body,200));var b=CompletableFuture.supplyAsync(()->req(f,reports(f),"POST",body,200));
  assertThat(List.of(a.get(15,TimeUnit.SECONDS).get("result"),b.get(15,TimeUnit.SECONDS).get("result"))).containsExactlyInAnyOrder("ACCEPTED","DUPLICATE");finished(f);
 }
 @Test void unconfirmedRecoveredRunIsNotCreditedAsConfirmedTime(){var f=fixture(false,Long.MAX_VALUE);var body=release(f);var i=interval(f,true);i.put("quality","UNCONFIRMED");body.put("intervals",List.of(i));req(f,reports(f),"POST",body,200);
  assertThat(((Number)state(f).get("active_duration_ms")).longValue()).isZero();assertThat(state(f).get("record_status")).isEqualTo("REVIEW_REQUIRED");
  assertThat(db.queryForObject("SELECT duration_ms FROM session_intervals WHERE session_id=?",Long.class,f.session())).isNull();
 }
 @Test void missingReleaseObservationOrResultCannotUnlock() {var f=fixture(false,Long.MAX_VALUE);
  for(String field:List.of("observed_at","result")){var body=release(f);body.remove(field);req(f,reports(f),"POST",body,422);
   assertThat(db.queryForObject("SELECT COUNT(*) FROM execution_reports WHERE id=?",Long.class,body.get("report_id"))).isZero();
   assertThat(db.queryForObject("SELECT COUNT(*) FROM active_execution_locks WHERE session_id=?",Long.class,f.session())).isEqualTo(1);
  }req(f,reports(f),"POST",release(f),200);finished(f);
 }
}
