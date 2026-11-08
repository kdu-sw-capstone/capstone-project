package kr.ac.kdu.focurve;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;
import static kr.ac.kdu.focurve.MemberAuth.*;
@Profile("member-fixture & local-integration & !member-runtime")
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name="member.fixture.enabled",havingValue="true")
@Component
class IsolatedFixture implements ApplicationRunner {
 final MemberAuth a;final String password;IsolatedFixture(MemberAuth a,@Value("${member.test-password}")String p){this.a=a;password=p;}
 public void run(ApplicationArguments args){String name=a.db.queryForObject("SELECT DATABASE()",String.class);check(name!=null&&name.startsWith("focurve_member_test_"),500,"ISOLATED_DATABASE_REQUIRED");check(password.length()>=24,500,"TEST_PASSWORD_REQUIRED");for(String email:java.util.List.of("member1@example.invalid","member2@example.invalid")){
  if(a.one("SELECT id FROM users WHERE email=?",email)==null){a.db.update("INSERT INTO users(display_name,email,email_verified,status,created_at,terms_version,terms_accepted_at) VALUES(?,?,true,'ACTIVE',?,'TEST_ONLY',?)","Isolated test member",email,now(),now());long user=a.db.queryForObject("SELECT id FROM users WHERE email=?",Long.class,email);a.db.update("INSERT INTO auth_identities(user_id,provider,subject,password_hash,updated_at) VALUES(?,'EMAIL',?,?,?)",user,email,a.passwords.encode(password),now());}
  long user=a.db.queryForObject("SELECT id FROM users WHERE email=?",Long.class,email);
  for(String host:java.util.List.of(email.startsWith("member1")?"www.youtube.com":"example.org")){if(a.one("SELECT id FROM sites WHERE user_id=? AND canonical_host=?",user,host)==null){boolean yt=host.equals("www.youtube.com");a.db.update("INSERT INTO sites(user_id,canonical_host,display_name,include_subdomains,purpose,access_policy,version,created_at,updated_at) VALUES(?,?,?,false,?,?,1,?,?)",user,host,host,yt?"GENERAL":"DISTRACTION",yt?"ALLOW":"RECORD",now(),now());if(yt){long site=a.db.queryForObject("SELECT id FROM sites WHERE user_id=? AND canonical_host=?",Long.class,user,host);a.db.update("INSERT INTO site_feature_policies VALUES(?,'YOUTUBE_SHORTS',true)",site);}}}
  if(a.one("SELECT user_id FROM content_policies WHERE user_id=?",user)==null){var content=a.obj("version",1,"keywords",java.util.Map.of("enabled",false,"rules",java.util.List.of(),"exceptions",java.util.List.of()),"adult_domains",java.util.Map.of("enabled",false,"custom_hosts",java.util.List.of(),"exceptions",java.util.List.of()),"image_blur",java.util.Map.of("enabled",false,"sensitivity","MEDIUM","strength","MEDIUM"),"usage_tracking",java.util.Map.of("enabled",false));a.db.update("INSERT INTO content_policies(user_id,version,payload,updated_at) VALUES(?,1,?,?)",user,content.toString(),now());}
 a.db.update("UPDATE content_policies SET keywords=JSON_EXTRACT(payload,'$.keywords'),adult_domains=JSON_EXTRACT(payload,'$.adult_domains'),image_blur=JSON_EXTRACT(payload,'$.image_blur'),usage_tracking=JSON_EXTRACT(payload,'$.usage_tracking') WHERE user_id=?",user);}}
}
