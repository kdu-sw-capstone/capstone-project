package kr.ac.kdu.focurve;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.mail.MailSenderAutoConfiguration;
import org.springframework.boot.env.SpringApplicationJsonEnvironmentPostProcessor;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.core.env.SystemEnvironmentPropertySource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.transaction.PlatformTransactionManager;

/** Bean/configuration integration only. No database or SMTP connection. */
class MailOutboxInstallationBindingTest {
  Map<String,Object> completeEnvironment() {
    var e=new HashMap<String,Object>();
    e.put("MEMBER_MAIL_EXTERNAL_ENABLED","true");
    e.put("MEMBER_MAIL_FROM","sender@example.invalid");
    e.put("SPRING_MAIL_HOST","smtp.example.invalid");
    e.put("SPRING_MAIL_PORT","587");
    e.put("SPRING_MAIL_USERNAME","sender@example.invalid");
    e.put("SPRING_MAIL_PASSWORD","SYNTHETIC_TEST_VALUE");
    e.put("SPRING_APPLICATION_JSON","{\"spring\":{\"mail\":{\"properties\":{\"mail.smtp.starttls.required\":true,\"mail.smtp.starttls.enable\":true,\"mail.smtp.ssl.checkserveridentity\":true}}}}");
    return e;
  }
  ApplicationContextRunner runner(Map<String,Object> e) {
    return new ApplicationContextRunner()
      .withInitializer(c->{
        c.getEnvironment().getPropertySources().addFirst(new SystemEnvironmentPropertySource("installation-fixture",e));
        new SpringApplicationJsonEnvironmentPostProcessor().postProcessEnvironment(c.getEnvironment(),new SpringApplication(getClass()));
      })
      .withConfiguration(AutoConfigurations.of(MailSenderAutoConfiguration.class));
  }
  MailOutbox outbox(org.springframework.context.ApplicationContext c) {
    return new MailOutbox(mock(MemberAuth.class),c.getBeanProvider(JavaMailSender.class),c.getEnvironment(),mock(PlatformTransactionManager.class));
  }
  @Test void oldSignupOnlyVariablesDoNotConfigureTheResetOutbox() {
    runner(Map.of("MAIL_HOST","smtp.example.invalid","MAIL_FROM","sender@example.invalid","MEMBER_MAIL_EXTERNAL_ENABLED","true"))
      .run(c->assertThat(outbox(c).configured()).isFalse());
  }
  @Test void installerEnvironmentConfiguresResetAndVerificationSender() {
    runner(completeEnvironment()).run(c->{
      assertThat(outbox(c).configured()).isTrue();
      var sender=c.getBean(JavaMailSenderImpl.class);
      assertThat(sender.getHost()).isEqualTo("smtp.example.invalid");
      assertThat(sender.getUsername()).isEqualTo("sender@example.invalid");
      assertThat(sender.getJavaMailProperties().getProperty("mail.smtp.starttls.required")).isEqualTo("true");
      assertThat(sender.getJavaMailProperties().getProperty("mail.smtp.ssl.checkserveridentity")).isEqualTo("true");
    });
  }
  @Test void missingSenderAddressRemainsUnconfigured() {
    var e=completeEnvironment();e.remove("MEMBER_MAIL_FROM");
    runner(e).run(c->assertThat(outbox(c).configured()).isFalse());
  }
  @Test void explicitDisabledExternalMailDoesNotBecomeEnabledBySmtpHost() {
    var e=completeEnvironment();e.put("MEMBER_MAIL_EXTERNAL_ENABLED","false");
    runner(e).run(c->assertThat(outbox(c).configured()).isFalse());
  }
}
