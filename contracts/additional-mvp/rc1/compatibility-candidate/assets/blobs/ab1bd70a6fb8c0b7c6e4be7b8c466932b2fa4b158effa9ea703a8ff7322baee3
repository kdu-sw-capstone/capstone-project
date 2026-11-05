package kr.ac.kdu.focurve;
import org.springframework.stereotype.Component;import org.springframework.context.annotation.*;import org.springframework.beans.factory.annotation.Value;import kr.ac.kdu.focurve.auth.*;import static kr.ac.kdu.focurve.MemberAuth.*;
/** Test sink is gated by MemberEnvironmentGuard and never enabled in member-runtime. */
@Profile("member-runtime | local-integration") @Component @Primary
class MemberSignupMail implements MailDelivery {
 final MemberAuth a;final SmtpMailDelivery smtp;final boolean sink;
 MemberSignupMail(MemberAuth a,SmtpMailDelivery smtp,@Value("${member.mail.test-sink:false}")boolean sink){this.a=a;this.smtp=smtp;this.sink=sink;}
 public void send(String address,String kind,String token){if(!sink){smtp.send(address,kind,token);return;}String cid=id();a.db.update("INSERT INTO auth_challenges(id,user_id,kind,token_hash,payload,expires_at) VALUES(?,NULL,?,?,?,?)",cid,kind,hash(token+cid),"{}",after(600));a.db.update("INSERT INTO auth_mail_outbox(id,challenge_id,recipient,kind,token_cipher,status,created_at) VALUES(?,?,?,?,?,'CAPTURED_TEST',?)",id(),cid,address,kind,a.crypt(token,true),now());}
}
