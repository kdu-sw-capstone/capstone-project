package kr.ac.kdu.focurve;

import static org.assertj.core.api.Assertions.*;
import java.time.*;
import java.util.*;
import kr.ac.kdu.focurve.api.ApiFailure;
import kr.ac.kdu.focurve.auth.*;
import kr.ac.kdu.focurve.execution.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

@ActiveProfiles("test")
@SpringBootTest(properties = "AUTH_PUBLIC_URL=http://127.0.0.1:5173")
@Transactional
class ExecutionRecoveryIntegrationTest {
  @Autowired JdbcTemplate db;
  @Autowired ExecutionService service;
  @MockitoBean MailDelivery mail;
  record Fixture(long owner, String executor, String session, long id, String apply, String interval, Instant began) {
    MemberLinks.Principal principal() { return new MemberLinks.Principal(owner, executor); }
  }
  String key() { return UUID.randomUUID().toString(); }
  Fixture start() {
    String email = key() + "@example.invalid", executor = key();
    db.update("INSERT INTO users(display_name,email,email_verified,status,created_at,terms_version,terms_accepted_at) VALUES ('복구 합성 검증',?,true,'ACTIVE',UTC_TIMESTAMP(3),'dev-v1',UTC_TIMESTAMP(3))", email);
    long owner = db.queryForObject("SELECT id FROM users WHERE email=?", Long.class, email);
    db.update("INSERT INTO extension_installations VALUES (?,?,?,'synthetic-test',UTC_TIMESTAMP(3))", executor, owner, AuthSupport.hash(key()));
    var s = service.start(owner, executor, 1, key());
    String uuid = s.get("session_id").toString();
    long id = ((Number) service.byUuid(owner, uuid).get("id")).longValue();
    return new Fixture(owner, executor, uuid, id, command(id), key(), Instant.now().minusSeconds(3).truncatedTo(java.time.temporal.ChronoUnit.MILLIS));
  }
  String command(long id) {
    return db.queryForObject("SELECT c.id FROM execution_commands c JOIN focus_sessions s ON s.id=c.session_id WHERE s.id=? AND c.desired_revision=s.desired_revision", String.class, id);
  }
  Map<String,Object> report(Fixture f, String result, long revision, String command, boolean interval) {
    var r = new LinkedHashMap<String,Object>();
    r.put("report_id",key()); r.put("executor_id",f.executor()); r.put("session_id",f.session()); r.put("command_id",command);
    r.put("desired_revision",revision); r.put("result",result); r.put("observed_at",f.began().plusSeconds(2).toString());
    var i = new LinkedHashMap<String,Object>(); i.put("interval_id",f.interval()); i.put("kind","RUN"); i.put("start_at",f.began().toString()); i.put("quality","CONFIRMED");
    if(result.equals("RELEASED")){i.put("end_at",f.began().plusSeconds(2).toString());i.put("duration_ms",2000);}
    r.put("intervals",interval?List.of(i):List.of()); return r;
  }
  void applied(Fixture f) { service.report(f.principal(),report(f,"APPLIED",1,f.apply(),true)); }
  void conflict(Runnable action) { assertThatThrownBy(action::run).isInstanceOfSatisfying(ApiFailure.class,e->{assertThat(e.status).isEqualTo(409);assertThat(e.code).isEqualTo("REPORT_CONFLICT");}); }

  @Test void completedReleaseCannotRewriteEndedSessionWithNewReportId() {
    var f=start(); applied(f); service.end(f.owner(),f.session(),key());
    var release=report(f,"RELEASED",2,command(f.id()),true);
    service.report(f.principal(),release);
    var finalState=service.get(f.owner(),f.id());
    assertThat(((Map<?,?>)service.report(f.principal(),release)).get("result")).isEqualTo("DUPLICATE");
    var changed=new LinkedHashMap<>(release);changed.put("report_id",key());
    conflict(()->service.report(f.principal(),changed));
    assertThat(service.get(f.owner(),f.id())).isEqualTo(finalState);
    assertThat(finalState.get("execution_status")).isEqualTo("ENDED");
    assertThat(service.current(f.owner())).isNull();
  }
  @Test void appliedReportCannotAcknowledgeReleaseCommand() {
    var f=start();applied(f);service.end(f.owner(),f.session(),key());String release=command(f.id());
    conflict(()->service.report(f.principal(),report(f,"APPLIED",2,release,true)));
    assertThat(db.queryForObject("SELECT status FROM execution_commands WHERE id=?",String.class,release)).isEqualTo("PENDING");
    service.report(f.principal(),report(f,"UNCONFIRMED",2,release,false));
    assertThat(service.current(f.owner()).get("execution_status")).isEqualTo("ENDING");
    service.report(f.principal(),report(f,"RELEASED",2,release,true));
    assertThat(service.get(f.owner(),f.id()).get("execution_status")).isEqualTo("ENDED");
  }
  @Test void unconfirmedApplyKeepsLockAndMatchingEvidenceRecoversRunning() {
    var f=start();service.report(f.principal(),report(f,"UNCONFIRMED",1,f.apply(),false));
    assertThat(service.current(f.owner()).get("execution_status")).isEqualTo("UNKNOWN");
    assertThatThrownBy(()->service.start(f.owner(),f.executor(),1,key())).isInstanceOf(ApiFailure.class);
    applied(f);
    assertThat(service.current(f.owner()).get("execution_status")).isEqualTo("RUNNING");
    assertThat(service.current(f.owner()).get("record_status")).isEqualTo("PARTIAL");
  }
  @Test void failedApplyReturnsLatestRevisionAndOnlyReleaseAllowsNewStart() {
    var f=start();var response=(Map<?,?>)service.report(f.principal(),report(f,"FAILED",1,f.apply(),false));
    assertThat(((Number)response.get("desired_revision")).longValue()).isEqualTo(2);
    assertThat(service.current(f.owner()).get("execution_status")).isEqualTo("UNKNOWN");
    service.report(f.principal(),report(f,"RELEASED",2,command(f.id()),false));
    assertThat(service.get(f.owner(),f.id()).get("execution_status")).isEqualTo("START_FAILED");
    assertThat(service.current(f.owner())).isNull();
    assertThat(service.start(f.owner(),f.executor(),1,key()).get("execution_status")).isEqualTo("STARTING");
  }
  @Test void expiredApplyNeverBecomesRunningAndKeepsReleaseLock() {
    var f=start();db.update("UPDATE execution_commands SET execute_before=? WHERE id=?",java.sql.Timestamp.from(f.began().minusSeconds(1)),f.apply());
    applied(f);
    var s=service.current(f.owner());assertThat(s.get("execution_status")).isEqualTo("UNKNOWN");
    assertThat(s.get("started_at")).isNull();assertThat(s.get("last_error_code")).isEqualTo("APPLY_EXPIRED");
    assertThat(db.queryForObject("SELECT COUNT(*) FROM session_intervals WHERE session_id=?",Integer.class,f.id())).isZero();
    assertThat(db.queryForObject("SELECT kind FROM execution_commands WHERE id=?",String.class,command(f.id()))).isEqualTo("RELEASE_POLICY");
  }
}
