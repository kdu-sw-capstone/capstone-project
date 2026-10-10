package kr.ac.kdu.focurve;

import static org.assertj.core.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import kr.ac.kdu.focurve.api.ApiFailure;
import kr.ac.kdu.focurve.auth.*;
import kr.ac.kdu.focurve.execution.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties="AUTH_PUBLIC_URL=http://127.0.0.1:5173")
@ActiveProfiles("test")
@Transactional
class ApplyDurationIntegrationTest {
  @Autowired JdbcTemplate db;
  @Autowired ExecutionService service;
  @Autowired ObjectMapper mapper;
  @MockitoBean MailDelivery mail;
  String key(){return UUID.randomUUID().toString();}
  MemberLinks.Principal install(){
    String email=key()+"@example.invalid",executor=key();
    db.update("INSERT INTO users(display_name,email,email_verified,status,created_at,terms_version,terms_accepted_at) VALUES ('duration synthetic',?,true,'ACTIVE',UTC_TIMESTAMP(3),'dev-v1',UTC_TIMESTAMP(3))",email);
    long owner=db.queryForObject("SELECT id FROM users WHERE email=?",Long.class,email);
    db.update("INSERT INTO extension_installations VALUES (?,?,?,'synthetic-test',UTC_TIMESTAMP(3))",executor,owner,AuthSupport.hash(key()));
    return new MemberLinks.Principal(owner,executor);
  }
  @SuppressWarnings("unchecked") Map<String,Object> command(MemberLinks.Principal p){
    return (Map<String,Object>)((List<?>)((Map<?,?>)service.commands(p)).get("commands")).getFirst();
  }
  @Test void applyCarriesSavedMinimumNormalMaximumAndSessionQueryRemainsCompatible(){
    for(int minutes:List.of(1,25,180)){
      var p=install();var session=service.start(p.user(),p.executor(),minutes,key());var cmd=command(p);
      assertThat(((Number)cmd.get("duration_minutes")).intValue()).isEqualTo(minutes);
      assertThat(cmd.get("session_id")).isEqualTo(session.get("session_id"));
      assertThat(cmd.get("executor_id")).isEqualTo(p.executor());
      assertThat(cmd.get("desired_revision")).isEqualTo(1);
      assertThat(cmd.get("type")).isEqualTo("APPLY_POLICY");
      assertThat(((Map<?,?>)cmd.get("snapshot")).containsKey("duration_minutes")).isFalse();
      assertThat(((Number)service.current(p.user()).get("duration_minutes")).intValue()).isEqualTo(minutes);
      assertThat(command(p)).isEqualTo(cmd);
      assertThat(db.queryForObject("SELECT duration_minutes FROM focus_sessions WHERE source_session_id=?",Integer.class,session.get("session_id"))).isEqualTo(minutes);
    }
  }
  @Test void replayPreservesCommandBodyAndDifferentDurationConflicts() throws Exception {
    var p=install();String request=key();var first=service.start(p.user(),p.executor(),25,request);var cmd=command(p);
    assertThat(mapper.readTree(mapper.writeValueAsString(service.start(p.user(),p.executor(),25,request)))).isEqualTo(mapper.readTree(mapper.writeValueAsString(first)));
    assertThat(command(p)).isEqualTo(cmd);
    assertThatThrownBy(()->service.start(p.user(),p.executor(),26,request)).isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.code).isEqualTo("IDEMPOTENCY_CONFLICT"));
    assertThat(command(p)).isEqualTo(cmd);
  }
  @Test void missingNullOutOfRangeAndNonIntegerInputsNeverCreateSession() throws Exception {
    var p=install();
    for(String value:List.of("MISSING","null","0","-1","181","\"25\"","25.5","true","{}","[]")){
      String raw="{\"executor_id\":\""+p.executor()+"\""+(value.equals("MISSING")?"":",\"duration_minutes\":"+value)+"}";
      try {
        var input=mapper.readValue(raw,ExecutionController.Start.class);
        assertThatThrownBy(()->service.start(p.user(),input.executor_id(),input.duration_minutes(),key())).isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.status).isEqualTo(422));
      } catch(com.fasterxml.jackson.core.JsonProcessingException expected) { /* strict type rejection */ }
      assertThat(db.queryForObject("SELECT COUNT(*) FROM focus_sessions WHERE user_id=?",Integer.class,p.user())).isZero();
      assertThat(db.queryForObject("SELECT COUNT(*) FROM idempotency_keys WHERE owner_key=?",Integer.class,"MEMBER:"+p.user())).isZero();
    }
  }
  @Test void historicalCommandWithoutDurationIsNotRewrittenOrGivenDefault() throws Exception {
    var p=install();service.start(p.user(),p.executor(),25,key());var cmd=command(p);cmd.remove("duration_minutes");String raw=mapper.writeValueAsString(cmd);
    db.update("UPDATE execution_commands SET payload=? WHERE id=?",raw,cmd.get("command_id"));
    String storedBefore=db.queryForObject("SELECT payload FROM execution_commands WHERE id=?",String.class,cmd.get("command_id"));
    assertThat(command(p)).isEqualTo(cmd);assertThat(command(p)).doesNotContainKey("duration_minutes");
    assertThat(db.queryForObject("SELECT payload FROM execution_commands WHERE id=?",String.class,cmd.get("command_id"))).isEqualTo(storedBefore);
  }
  @Test void endedIntentFiltersOldApplyAndReleaseNeverRequiresDuration(){
    var helper=new ExecutionRecoveryIntegrationTest();helper.db=db;helper.service=service;
    var f=helper.start();helper.applied(f);service.end(f.owner(),f.session(),key());
    var release=command(f.principal());assertThat(release.get("type")).isEqualTo("RELEASE_POLICY");assertThat(((Number)release.get("desired_revision")).longValue()).isEqualTo(2);
    assertThat(release).doesNotContainKey("duration_minutes");assertThat(release.get("command_id")).isNotEqualTo(f.apply());
    service.report(f.principal(),helper.report(f,"RELEASED",2,release.get("command_id").toString(),true));
    assertThat(service.get(f.owner(),f.id()).get("execution_status")).isEqualTo("ENDED");
  }
  @Test void sessionQueryRetainsOwnerChecks(){
    var p=install();var other=install();var s=service.start(p.user(),p.executor(),25,key());
    assertThatThrownBy(()->service.byUuid(other.user(),s.get("session_id").toString())).isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.status).isEqualTo(404));
  }
}
