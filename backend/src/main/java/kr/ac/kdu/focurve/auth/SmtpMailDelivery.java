package kr.ac.kdu.focurve.auth;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import kr.ac.kdu.focurve.api.ApiFailure;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Component;

@Component
public class SmtpMailDelivery implements MailDelivery {
  private final JavaMailSenderImpl sender = new JavaMailSenderImpl();
  private final String host, from, url;

  @Value("${MAIL_MODE:mailpit}")
  private String mode = "mailpit";

  @Value("${MAIL_SSL:false}")
  private boolean ssl;

  private final boolean tls;

  public SmtpMailDelivery(
      @Value("${MAIL_HOST:}") String host,
      @Value("${MAIL_PORT:1025}") int port,
      @Value("${MAIL_USERNAME:}") String user,
      @Value("${MAIL_PASSWORD:}") String pass,
      @Value("${MAIL_FROM:}") String from,
      @Value("${AUTH_PUBLIC_URL:http://127.0.0.1:5173}") String url,
      @Value("${MAIL_TLS:false}") boolean tls) {
    this.host = host;
    this.from = from;
    this.url = url;
    this.tls = tls;
    sender.setHost(host);
    sender.setPort(port);
    sender.setUsername(user);
    sender.setPassword(pass);
    var p = sender.getJavaMailProperties();
    p.setProperty("mail.smtp.auth", Boolean.toString(!user.isBlank()));
    p.setProperty("mail.smtp.starttls.enable", Boolean.toString(tls));
    p.setProperty("mail.smtp.starttls.required", Boolean.toString(tls));
    p.setProperty("mail.smtp.connectiontimeout", "5000");
    p.setProperty("mail.smtp.timeout", "5000");
    p.setProperty("mail.smtp.writetimeout", "5000");
  }

  public void send(String address, String kind, String token) {
    if (host.isBlank() || from.isBlank()) throw new ApiFailure(503, "MAIL_UNAVAILABLE");
    if (!java.util.Set.of("mailpit", "external").contains(mode)
        || tls && ssl
        || mode.equals("external") && !tls && !ssl) throw new ApiFailure(503, "MAIL_UNAVAILABLE");
    try {
      var base = java.net.URI.create(url);
      if (!java.util.Set.of("http", "https").contains(base.getScheme())
          || base.getHost() == null
          || base.getUserInfo() != null
          || base.getRawQuery() != null
          || base.getRawFragment() != null) throw new IllegalArgumentException();
    } catch (IllegalArgumentException e) {
      throw new ApiFailure(503, "MAIL_UNAVAILABLE");
    }
    sender.getJavaMailProperties().setProperty("mail.smtp.ssl.enable", Boolean.toString(ssl));
    sender.getJavaMailProperties().setProperty("mail.smtp.ssl.checkserveridentity", "true");
    if(kind.equals("SIGNUP_CODE")){
      try {
        var message=sender.createMimeMessage();
        var helper=new org.springframework.mail.javamail.MimeMessageHelper(message,true,"UTF-8");
        helper.setFrom(from);helper.setTo(address);helper.setSubject("FOCURVE 회원가입 이메일 인증");
        helper.setText(SignupCodeEmail.text(token,mode.equals("mailpit")),SignupCodeEmail.html(token,mode.equals("mailpit")));
        sender.send(message);return;
      } catch(org.springframework.mail.MailException | jakarta.mail.MessagingException e){throw new ApiFailure(503,"MAIL_UNAVAILABLE");}
    }
    var m = new SimpleMailMessage();
    m.setFrom(from);
    m.setTo(address);
    boolean verification = kind.equals("VERIFY") || kind.equals("SOCIAL_EMAIL");
    m.setSubject(
        "FOCURVE "
            + (verification
                ? "이메일 인증"
                : kind.equals("SOCIAL_RECOVERY") ? "소셜 계정 복구 안내" : "비밀번호 재설정"));
    String prefix =
        mode.equals("mailpit")
            ? "개발용 Mailpit 수신 메일입니다. 외부 메일 발송이 아닙니다.\n"
            : "FOCURVE에서 요청하신 안내입니다.\n";
    if (kind.equals("SOCIAL_RECOVERY")) {
      m.setText(
          prefix
              + "이 계정은 소셜 제공자로 로그인하며 FOCURVE 비밀번호가 없습니다.\n"
              + (token.contains("GOOGLE")
                  ? "Google 계정 복구: https://accounts.google.com/signin/recovery\n"
                  : "")
              + (token.contains("KAKAO") ? "카카오 계정 복구: https://accounts.kakao.com/\n" : "")
              + "요청하지 않았다면 이 메일을 무시하세요.\n");
    } else {
      String route =
          kind.equals("SOCIAL_EMAIL") ? "social-email-verify" : verification ? "verify" : "reset";
      m.setText(
          prefix
              + url.replaceAll("/+$", "")
              + "/#"
              + route
              + "?token="
              + URLEncoder.encode(token, StandardCharsets.UTF_8)
              + "\n"
              + (kind.equals("VERIFY") ? "24시간" : kind.equals("SOCIAL_EMAIL") ? "20분" : "30분")
              + " 안에 한 번만 사용할 수 있습니다. 요청하지 않았다면 이 메일을 무시하세요.");
    }
    try {
      sender.send(m);
    } catch (org.springframework.mail.MailException e) {
      throw new ApiFailure(503, "MAIL_UNAVAILABLE");
    }
  }
}
