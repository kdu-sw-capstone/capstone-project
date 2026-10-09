package kr.ac.kdu.focurve;

import static org.assertj.core.api.Assertions.*;
import java.time.*;
import java.util.*;
import kr.ac.kdu.focurve.api.ApiFailure;
import kr.ac.kdu.focurve.auth.*;
import kr.ac.kdu.focurve.execution.*;
import kr.ac.kdu.focurve.sites.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

@ActiveProfiles("test")
@SpringBootTest(properties="AUTH_PUBLIC_URL=http://127.0.0.1:5173")
@Transactional
class HostPolicyIntegrationTest {
  @Autowired JdbcTemplate db;
  @Autowired SiteService sites;
  @Autowired ExecutionService sessions;
  @Autowired AuthService json;
  @MockitoBean MailDelivery mail;
  String key(){return UUID.randomUUID().toString();}
  long user(){String e=key()+"@example.invalid";db.update("INSERT INTO users(display_name,email,email_verified,status,created_at,terms_version,terms_accepted_at) VALUES ('호스트 정책 합성 검증',?,true,'ACTIVE',UTC_TIMESTAMP(3),'dev-v1',UTC_TIMESTAMP(3))",e);return db.queryForObject("SELECT id FROM users WHERE email=?",Long.class,e);}
  SiteInput input(String host,boolean sub,String policy){return new SiteInput(host,"호스트 정책",sub,policy.equals("ALLOW")?"GENERAL":"DISTRACTION",policy,List.of());}
  long id(Map<String,Object> s){return Long.parseLong(s.get("site_id").toString());}
  void failure(int status,Runnable f){assertThatThrownBy(f::run).isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.status).isEqualTo(status));}

  @Test void canonicalHostKeepsAllLabelsAndRejectsOnlyTheSameOwnerHost(){
    long u=user();
    sites.create(u,key(),input("https://NAVER.com./path?q=private#fragment",true,"ALLOW"));
    var child=sites.create(u,key(),input("https://chzzk.naver.com/watch",false,"BLOCK"));
    assertThat(child.get("canonical_host")).isEqualTo("chzzk.naver.com");
    assertThat(sites.create(u,key(),input("www.naver.com",true,"RECORD")).get("canonical_host")).isEqualTo("www.naver.com");
    sites.create(u,key(),input("notnaver.com",true,"BLOCK"));
    failure(409,()->sites.create(u,key(),input("https://CHZZK.NAVER.COM./another",true,"ALLOW")));
    assertThat(sites.create(user(),key(),input("chzzk.naver.com",true,"ALLOW"))).isNotEmpty();
    assertThat(db.queryForList("SELECT canonical_host FROM sites WHERE user_id=? ORDER BY canonical_host",String.class,u))
      .containsExactly("chzzk.naver.com","naver.com","notnaver.com","www.naver.com");
  }

  @Test void idnaNormalizationPreservesSubdomainsAndCanonicalDuplicates(){
    long u=user();
    assertThat(SiteInput.host("https://Sub.BÜCHER.de./x")).isEqualTo("sub.xn--bcher-kva.de");
    sites.create(u,key(),input("bücher.de",true,"ALLOW"));
    sites.create(u,key(),input("sub.bücher.de",true,"BLOCK"));
    failure(409,()->sites.create(u,key(),input("SUB.XN--BCHER-KVA.DE",false,"BLOCK")));
    for(String invalid:List.of("https://name:secret@naver.com/","naver.com:443","127.0.0.1","localhost"))
      failure(422,()->sites.create(u,key(),input(invalid,true,"ALLOW")));
  }

  @Test void editingAnOverlapIsAllowedButExactConflictAndStaleVersionPreserveRows(){
    long u=user();var parent=sites.create(u,key(),input("naver.com",true,"ALLOW"));
    var other=sites.create(u,key(),input("chzzk.example.com",false,"BLOCK"));long child=id(other);
    var updated=sites.patch(u,child,key(),"\"1\"",Map.of("url","chzzk.naver.com","include_subdomains",true));
    assertThat(updated.get("canonical_host")).isEqualTo("chzzk.naver.com");
    failure(409,()->sites.patch(u,child,key(),"\"2\"",Map.of("url","NAVER.COM.")));
    failure(412,()->sites.patch(u,child,key(),"\"1\"",Map.of("access_policy","RECORD")));
    assertThat(sites.get(u,child)).isEqualTo(updated);
    assertThat(sites.get(u,id(parent)).get("access_policy")).isEqualTo("ALLOW");
    sites.delete(u,id(parent),key(),"\"1\"");
    failure(409,()->sites.patch(u,child,key(),"\"2\"",Map.of("url","naver.com")));
    var restored=sites.create(u,key(),input("naver.com",true,"RECORD"));
    assertThat(restored.get("site_id")).isEqualTo(parent.get("site_id"));
    assertThat(sites.get(u,child)).isEqualTo(updated);
  }

  @SuppressWarnings("unchecked")
  Map<String,Object> policy(long owner,String uuid){return (Map<String,Object>)sessions.policy(owner,uuid);}
  @SuppressWarnings("unchecked")
  List<Map<String,Object>> rules(Map<String,Object> policy){return (List<Map<String,Object>>)policy.get("sites");}
  // Reference consumer of the documented ordered snapshot, independent of registration order.
  Map<String,Object> resolve(Map<String,Object> p,String host){return rules(p).stream().filter(s->host.equals(s.get("canonical_host")) || Boolean.TRUE.equals(s.get("include_subdomains")) && host.endsWith("."+s.get("canonical_host"))).findFirst().orElse(null);}
  String command(long sid){return db.queryForObject("SELECT c.id FROM execution_commands c JOIN focus_sessions s ON s.id=c.session_id WHERE s.id=? AND c.desired_revision=s.desired_revision",String.class,sid);}

  @Test void snapshotSpecificityOverridesSeverityAndRunningSnapshotSurvivesEdits(){
    long u=user();var parent=sites.create(u,key(),input("naver.com",true,"ALLOW"));
    var child=sites.create(u,key(),input("chzzk.naver.com",true,"BLOCK"));
    sites.create(u,key(),input("clips.chzzk.naver.com",false,"ALLOW"));
    String executor=key();db.update("INSERT INTO extension_installations VALUES (?,?,?,'synthetic-host-policy',UTC_TIMESTAMP(3))",executor,u,AuthSupport.hash(key()));
    var principal=new MemberLinks.Principal(u,executor);
    var start=sessions.start(u,executor,5,key());String uuid=start.get("session_id").toString();
    long sid=((Number)sessions.byUuid(u,uuid).get("id")).longValue();var p=policy(u,uuid);
    assertThat(p.get("format_version")).isEqualTo("1.2");assertThat(p.get("site_match_strategy")).isEqualTo("MOST_SPECIFIC_HOST");
    assertThat(rules(p).stream().map(s->s.get("canonical_host"))).containsExactly("clips.chzzk.naver.com","chzzk.naver.com","naver.com");
    assertThat(resolve(p,"naver.com").get("access_policy")).isEqualTo("ALLOW");
    assertThat(resolve(p,"live.chzzk.naver.com").get("access_policy")).isEqualTo("BLOCK");
    assertThat(resolve(p,"clips.chzzk.naver.com").get("access_policy")).isEqualTo("ALLOW");
    assertThat(resolve(p,"x.clips.chzzk.naver.com").get("canonical_host")).isEqualTo("chzzk.naver.com");
    for(String host:List.of("notnaver.com","naver.com.evil.example","notchzzk.naver.com")) {
      var winner=resolve(p,host);if(host.equals("notchzzk.naver.com"))assertThat(winner.get("canonical_host")).isEqualTo("naver.com");else assertThat(winner).isNull();
    }
    String before=json.encoded(p), dbBefore=db.queryForObject("SELECT payload FROM policy_snapshots WHERE id=?",String.class,start.get("policy_snapshot_id"));
    var commandPayload=json.decoded(db.queryForObject("SELECT payload FROM execution_commands WHERE id=?",String.class,command(sid)));
    assertThat(commandPayload.get("snapshot")).isEqualTo(p);
    String interval=key();Instant begin=Instant.now().minusSeconds(1).truncatedTo(java.time.temporal.ChronoUnit.MILLIS);
    sessions.report(principal,Map.of("report_id",key(),"session_id",uuid,"executor_id",executor,"command_id",command(sid),"desired_revision",1,"result","APPLIED","observed_at",begin.toString(),"intervals",List.of(Map.of("interval_id",interval,"kind","RUN","start_at",begin.toString(),"quality","CONFIRMED"))));
    assertThat(sessions.current(u).get("execution_status")).isEqualTo("RUNNING");
    sites.patch(u,id(child),key(),"\"1\"",Map.of("access_policy","RECORD","include_subdomains",false));
    sites.patch(u,id(parent),key(),"\"1\"",Map.of("purpose","DISTRACTION","access_policy","BLOCK"));
    assertThat(json.encoded(policy(u,uuid))).isEqualTo(before);
    assertThat(db.queryForObject("SELECT payload FROM policy_snapshots WHERE id=?",String.class,start.get("policy_snapshot_id"))).isEqualTo(dbBefore);
    sessions.end(u,uuid,key());Instant end=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MILLIS);
    sessions.report(principal,Map.of("report_id",key(),"session_id",uuid,"executor_id",executor,"command_id",command(sid),"desired_revision",2,"result","RELEASED","observed_at",end.toString(),"intervals",List.of(Map.of("interval_id",interval,"kind","RUN","start_at",begin.toString(),"end_at",end.toString(),"duration_ms",Duration.between(begin,end).toMillis(),"quality","CONFIRMED"))));
    var next=sessions.start(u,executor,5,key());var nextPolicy=policy(u,next.get("session_id").toString());
    assertThat(resolve(nextPolicy,"chzzk.naver.com").get("access_policy")).isEqualTo("RECORD");
    assertThat(resolve(nextPolicy,"live.chzzk.naver.com").get("canonical_host")).isEqualTo("naver.com");
    assertThat(resolve(nextPolicy,"naver.com").get("access_policy")).isEqualTo("BLOCK");
    assertThat(json.encoded(policy(u,uuid))).isEqualTo(before);
  }
}
