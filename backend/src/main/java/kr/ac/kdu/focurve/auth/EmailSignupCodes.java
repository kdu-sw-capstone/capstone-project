package kr.ac.kdu.focurve.auth;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import kr.ac.kdu.focurve.api.ApiFailure;
import kr.ac.kdu.focurve.api.DbTime;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EmailSignupCodes {
  private final JdbcTemplate db;
  private final MailDelivery mail;
  private final AuthRateLimits rates;
  private final SecureRandom random = new SecureRandom();
  public EmailSignupCodes(JdbcTemplate db, MailDelivery mail, AuthRateLimits rates) {
    this.db=db; this.mail=mail; this.rates=rates;
  }
  private String lockSession(String credential) {
    if(credential==null) throw new ApiFailure(401,"UNAUTHENTICATED");
    String owner=AuthSupport.hash(credential);
    if(db.queryForList("SELECT id_hash FROM web_sessions WHERE id_hash=? AND expires_at>UTC_TIMESTAMP(3) FOR UPDATE",owner).isEmpty())
      throw new ApiFailure(401,"UNAUTHENTICATED");
    return owner;
  }
  @Transactional
  public Map<String,Object> request(String address,String credential,String ip) {
    String email=AuthSupport.email(address), owner=lockSession(credential);
    rates.check("SIGNUP-CODE-IP:"+ip,20,3600,0);
    rates.check("SIGNUP-CODE-MAIL:"+email,5,3600,60);
    String id=UUID.randomUUID().toString(), code=String.format(java.util.Locale.ROOT,"%06d",random.nextInt(1_000_000));
    Instant expires=Instant.now().plusSeconds(600);
    // DB-only disclosure cannot brute-force the 6 digits: HMAC uses the high-entropy
    // HttpOnly credential, which is never stored in the challenge table or response.
    db.update("INSERT INTO email_signup_codes(id,owner_hash,email,code_hash,expires_at) VALUES (?,?,?,?,?)",
      id,owner,email,AuthSupport.fingerprint(credential,id+":"+code),Timestamp.from(expires));
    mail.send(email,"SIGNUP_CODE",code);
    // Failed delivery rolls back the new row and preserves the previously valid code/proof.
    db.update("UPDATE email_signup_codes SET superseded_at=UTC_TIMESTAMP(3) WHERE owner_hash=? AND email=? AND id<>? AND superseded_at IS NULL AND consumed_at IS NULL",owner,email,id);
    return Map.of("request_id",id,"expires_at",expires.toString(),"resend_after_seconds",60,"max_attempts",5);
  }
  @Transactional(noRollbackFor=ApiFailure.class)
  public Map<String,Object> verify(String id,String address,String code,String credential,String ip) {
    String email=AuthSupport.email(address), owner=lockSession(credential);
    rates.check("SIGNUP-CODE-CHECK-IP:"+ip,30,60,0);
    AuthService.uuid(id);
    if(code==null || !code.matches("[0-9]{6}")) throw new ApiFailure(422,"CODE_FORMAT_INVALID");
    var rows=db.queryForList("SELECT * FROM email_signup_codes WHERE id=? AND owner_hash=? AND email=? FOR UPDATE",id,owner,email);
    if(rows.isEmpty()) throw new ApiFailure(410,"CODE_EXPIRED");
    var row=rows.getFirst();
    if(row.get("superseded_at")!=null) throw new ApiFailure(409,"CODE_SUPERSEDED");
    if(row.get("verified_at")!=null || row.get("consumed_at")!=null) throw new ApiFailure(409,"CODE_USED");
    if(!DbTime.instant(row.get("expires_at")).isAfter(Instant.now())) throw new ApiFailure(410,"CODE_EXPIRED");
    int attempts=((Number)row.get("attempts")).intValue();
    if(attempts>=5) throw new ApiFailure(429,"CODE_ATTEMPTS_EXCEEDED");
    String candidate=AuthSupport.fingerprint(credential,id+":"+code);
    if(!MessageDigest.isEqual(candidate.getBytes(StandardCharsets.US_ASCII),row.get("code_hash").toString().getBytes(StandardCharsets.US_ASCII))) {
      db.update("UPDATE email_signup_codes SET attempts=attempts+1 WHERE id=?",id);
      // Commit the failed-attempt counter even though the HTTP response is an error.
      throw new ApiFailure(attempts==4?429:422,attempts==4?"CODE_ATTEMPTS_EXCEEDED":"CODE_INVALID");
    }
    String proof=AuthSupport.token(); Instant expires=Instant.now().plusSeconds(600);
    db.update("UPDATE email_signup_codes SET verified_at=UTC_TIMESTAMP(3),proof_hash=?,proof_expires_at=? WHERE id=?",AuthSupport.hash(proof),Timestamp.from(expires),id);
    return Map.of("verified",true,"verification_proof",proof,"proof_expires_at",expires.toString());
  }
  // Called inside the signup transaction, after the same session lock. Consuming a
  // proof and creating user+identity+idempotency result commit or roll back together.
  public void consume(String address,String credential,String proof) {
    if(proof==null || proof.isBlank()) throw new ApiFailure(403,"EMAIL_CODE_REQUIRED");
    var rows=db.queryForList("SELECT * FROM email_signup_codes WHERE proof_hash=? AND owner_hash=? AND email=? FOR UPDATE",AuthSupport.hash(proof),AuthSupport.hash(credential),address);
    if(rows.isEmpty()) throw new ApiFailure(403,"EMAIL_CODE_REQUIRED");
    var row=rows.getFirst();
    if(row.get("consumed_at")!=null) throw new ApiFailure(409,"CODE_USED");
    if(row.get("superseded_at")!=null) throw new ApiFailure(409,"CODE_SUPERSEDED");
    if(row.get("verified_at")==null || !DbTime.instant(row.get("proof_expires_at")).isAfter(Instant.now())) throw new ApiFailure(410,"CODE_EXPIRED");
    db.update("UPDATE email_signup_codes SET consumed_at=UTC_TIMESTAMP(3) WHERE id=?",row.get("id"));
  }
}
