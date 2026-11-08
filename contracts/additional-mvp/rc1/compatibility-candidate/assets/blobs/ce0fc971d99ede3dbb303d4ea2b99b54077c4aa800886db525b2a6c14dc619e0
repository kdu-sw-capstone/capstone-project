package kr.ac.kdu.focurve;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.Profiles;
/** Runs after configuration resolution, before any DataSource/Flyway bean is created. */
public final class MemberEnvironmentGuard implements EnvironmentPostProcessor, Ordered {
 public int getOrder(){return Ordered.LOWEST_PRECEDENCE;}
 public void postProcessEnvironment(ConfigurableEnvironment e,SpringApplication app){validate(e);}
 static void validate(ConfigurableEnvironment e){
  boolean runtime=e.acceptsProfiles(Profiles.of("member-runtime")),local=e.acceptsProfiles(Profiles.of("local-integration")),fixture=e.acceptsProfiles(Profiles.of("member-fixture"));
  boolean enabled=e.getProperty("member.fixture.enabled",Boolean.class,false),sink=e.getProperty("member.mail.test-sink",Boolean.class,false);
  if(runtime&&local)throw new IllegalStateException("RUNTIME_TEST_PROFILE_CONFLICT");
  if((fixture||enabled)&&(!local||runtime||!fixture||!enabled))throw new IllegalStateException("EXPLICIT_ISOLATED_FIXTURE_REQUIRED");
  if(sink&&(!local||runtime))throw new IllegalStateException("TEST_MAIL_SINK_FORBIDDEN_IN_RUNTIME");
  if(runtime&&e.getProperty("spring.flyway.enabled",Boolean.class,true))throw new IllegalStateException("RUNTIME_AUTOMIGRATION_FORBIDDEN");
  if(local||fixture||enabled||sink){String url=e.getProperty("spring.datasource.url",e.getProperty("DB_URL",""));if(!url.matches("jdbc:mysql://127\\.0\\.0\\.1:[0-9]+/focurve_member_test_[a-f0-9]+\\?.*"))throw new IllegalStateException("ISOLATED_DATABASE_REQUIRED_BEFORE_FLYWAY");}
  if(enabled&&e.getProperty("member.test-password","").length()<24)throw new IllegalStateException("TEST_PASSWORD_REQUIRED");
 }
}
