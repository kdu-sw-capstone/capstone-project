package kr.ac.kdu.focurve;

import static org.assertj.core.api.Assertions.*;

import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.Properties;
import java.util.concurrent.*;
import kr.ac.kdu.focurve.api.ApiFailure;
import kr.ac.kdu.focurve.auth.SmtpMailDelivery;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** Actual SMTP TCP exchange with a local test receiver; not external email delivery. */
class SmtpMailDeliveryTest {
  @ParameterizedTest
  @ValueSource(strings={"VERIFY","SIGNUP_CODE"})
  void sendsVerificationLinkToLocalSmtpReceiver(String kind) throws Exception {
    try (var server = new ServerSocket(0, 1, InetAddress.getLoopbackAddress());
        var executor = Executors.newVirtualThreadPerTaskExecutor()) {
      server.setSoTimeout(10000);
      var received =
          executor.submit(
              () -> {
                try (var socket = server.accept()) {
                  socket.setSoTimeout(10000);
                  var in =
                      new BufferedReader(
                          new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
                  var out =
                      new PrintWriter(
                          new OutputStreamWriter(socket.getOutputStream(), StandardCharsets.UTF_8),
                          true);
                  out.print("220 local test receiver\r\n");
                  out.flush();
                  String line;
                  String content = null;
                  while ((line = in.readLine()) != null) {
                    if (line.equals("DATA")) {
                      out.print("354 Send message\r\n");
                      out.flush();
                      var data = new StringBuilder();
                      while ((line = in.readLine()) != null && !line.equals("."))
                        data.append(line.startsWith("..") ? line.substring(1) : line)
                            .append("\r\n");
                      content = data.toString();
                      out.print("250 Accepted\r\n");
                    } else if (line.equals("QUIT")) {
                      out.print("221 Bye\r\n");
                      out.flush();
                      return content;
                    } else out.print("250 OK\r\n");
                    out.flush();
                  }
                  return content;
                }
              });
      var sender =
          new SmtpMailDelivery(
              "127.0.0.1",
              server.getLocalPort(),
              "",
              "",
              "test@example.invalid",
              "http://127.0.0.1:5173",
              false);
      sender.send("recipient@example.invalid", kind, kind.equals("SIGNUP_CODE") ? "001234" : "test-only-single-use-link");
      var message =
          new MimeMessage(
              Session.getInstance(new Properties()),
              new ByteArrayInputStream(
                  received.get(10, TimeUnit.SECONDS).getBytes(StandardCharsets.UTF_8)));
      assertThat(message.getAllRecipients()[0].toString()).isEqualTo("recipient@example.invalid");
      if(kind.equals("SIGNUP_CODE")) {
        var parts=new java.util.HashMap<String,String>(); collect(message,parts);
        assertThat(message.getSubject()).isEqualTo("FOCURVE 회원가입 이메일 인증");
        assertThat(parts).containsKeys("text/plain","text/html");
        for(var content:parts.values())assertThat(content).contains("001234", "10분", "공유하지").doesNotContain("/#verify", "token=", "{{CODE}}");
        assertThat(parts.get("text/html")).contains("prefers-color-scheme:dark", "FOCURVE").doesNotContain("<img", "<script");
      }
      else assertThat(message.getContent().toString()).contains("개발용 Mailpit", "/#verify?token=test-only-single-use-link");
    }
  }

  private static void collect(jakarta.mail.Part part,java.util.Map<String,String> values) throws Exception {
    if(part.isMimeType("multipart/*")){var multipart=(jakarta.mail.Multipart)part.getContent();for(int n=0;n<multipart.getCount();n++)collect(multipart.getBodyPart(n),values);}
    else if(part.isMimeType("text/plain"))values.put("text/plain",part.getContent().toString());
    else if(part.isMimeType("text/html"))values.put("text/html",part.getContent().toString());
  }
  @Test void templateRejectsMarkupAndShowsPlainFallbackWithoutExternalImages(){
    assertThatThrownBy(()->kr.ac.kdu.focurve.auth.SignupCodeEmail.html("<script>",false)).isInstanceOf(IllegalArgumentException.class);
    assertThat(kr.ac.kdu.focurve.auth.SignupCodeEmail.text("001234",false)).contains("001234", "일", "자동 발송").doesNotContain("Mailpit");
    assertThat(kr.ac.kdu.focurve.auth.SignupCodeEmail.html("001234",false)).contains("001234", "회원가입 이메일 인증").doesNotContain("Mailpit", "{{");
  }

  @Test
  void externalModeRequiresEncryptedSmtpAndSafeWebUrl() {
    var sender =
        new SmtpMailDelivery(
            "localhost", 1025, "", "", "sender@example.invalid", "http://localhost:5175", false);
    org.springframework.test.util.ReflectionTestUtils.setField(sender, "mode", "external");
    assertThatThrownBy(() -> sender.send("a@example.invalid", "RESET", "synthetic"))
        .isInstanceOf(ApiFailure.class);
    var invalid =
        new SmtpMailDelivery(
            "localhost",
            1025,
            "",
            "",
            "sender@example.invalid",
            "https://name:password@example.invalid",
            true);
    assertThatThrownBy(() -> invalid.send("a@example.invalid", "RESET", "synthetic"))
        .isInstanceOf(ApiFailure.class);
  }

  @Test
  void missingMailSettingsNeverReportDeliverySuccess() {
    var sender = new SmtpMailDelivery("", 1025, "", "", "", "http://127.0.0.1:5173", false);
    assertThatThrownBy(() -> sender.send("test@example.invalid", "VERIFY", "test-only"))
        .isInstanceOfSatisfying(
            ApiFailure.class, failure -> assertThat(failure.code).isEqualTo("MAIL_UNAVAILABLE"));
  }
}
