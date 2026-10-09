package kr.ac.kdu.focurve;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import kr.ac.kdu.focurve.auth.*;
import kr.ac.kdu.focurve.api.ApiFailure;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.jdbc.core.JdbcTemplate;
@ActiveProfiles("test") @SpringBootTest
class EmailSignupCodesIntegrationTest {
 @Autowired JdbcTemplate db; @Autowired EmailSignupCodes codes; @Autowired AuthService auth;
 @MockitoBean MailDelivery mail;
 String credential,owner,email,ip,id; AtomicReference<String> code=new AtomicReference<>();
 @BeforeEach void prepare(){
  credential=AuthSupport.token();owner=AuthSupport.hash(credential);email=UUID.randomUUID()+"@example.invalid";ip=UUID.randomUUID().toString();
  db.update("INSERT INTO web_sessions(id_hash,csrf_hash,expires_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 1 DAY))",owner,AuthSupport.hash("test"));
  doAnswer(i->{code.set(i.getArgument(2));return null;}).when(mail).send(eq(email),eq("SIGNUP_CODE"),anyString());
 }
 @AfterEach void cleanup(){
  db.update("DELETE FROM idempotency_keys WHERE owner_key=?","ANON:"+owner);
  db.update("DELETE FROM email_signup_codes WHERE owner_hash=?",owner);
  db.update("DELETE FROM web_sessions WHERE id_hash=?",owner);
  for(long user:db.queryForList("SELECT id FROM users WHERE email=?",Long.class,email)){
   db.update("DELETE FROM auth_identities WHERE user_id=?",user);db.update("DELETE FROM users WHERE id=?",user);
  }
  for(String bucket:List.of("SIGNUP-CODE-IP:"+ip,"SIGNUP-CODE-CHECK-IP:"+ip,"SIGNUP-CODE-MAIL:"+email))db.update("DELETE FROM auth_rate_limits WHERE bucket_hash=?",AuthSupport.hash(bucket));
 }
 void send(){id=codes.request(email,credential,ip).get("request_id").toString();assertThat(code.get()).matches("[0-9]{6}");}
 void expect(String error,Runnable action){assertThatThrownBy(action::run).isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.code).isEqualTo(error));}
 String verify(){return codes.verify(id,email,code.get(),credential,ip).get("verification_proof").toString();}
 void allowResend(){db.update("UPDATE auth_rate_limits SET last_attempt=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 61 SECOND) WHERE bucket_hash=?",AuthSupport.hash("SIGNUP-CODE-MAIL:"+email));}
 @Test void activeSignupRequiresProofAndIsSingleUseAndIdempotent(){
  send();expect("EMAIL_CODE_REQUIRED",()->auth.signup(new AuthService.Signup(email,"test-password-1234","test","dev-v1"),credential,UUID.randomUUID().toString()));
  String proof=verify(); expect("CODE_USED",()->verify());
  var input=new AuthService.Signup(email,"test-password-1234","test","dev-v1",proof);String key=UUID.randomUUID().toString();
  var result=auth.signup(input,credential,key);assertThat(result.get("status")).isEqualTo("ACTIVE");assertThat(result.get("email_verified")).isEqualTo(true);
  assertThat(auth.signup(input,credential,key)).isEqualTo(result);expect("CODE_USED",()->auth.signup(input,credential,UUID.randomUUID().toString()));
  assertThat(db.queryForObject("SELECT COUNT(*) FROM users WHERE email=?",Integer.class,email)).isEqualTo(1);
 }
 @Test void wrongAttemptsCommitAndLockOutEvenCorrectCode(){send();String wrong=code.get().equals("000000")?"111111":"000000";
  for(int n=0;n<5;n++){String error=n==4?"CODE_ATTEMPTS_EXCEEDED":"CODE_INVALID";expect(error,()->codes.verify(id,email,wrong,credential,ip));}
  assertThat(db.queryForObject("SELECT attempts FROM email_signup_codes WHERE id=?",Integer.class,id)).isEqualTo(5);expect("CODE_ATTEMPTS_EXCEEDED",()->verify());
 }
 @Test void expiredAndSupersededCodesCannotVerify(){send();String old=id,oldCode=code.get();allowResend();send();
  expect("CODE_SUPERSEDED",()->codes.verify(old,email,oldCode,credential,ip));db.update("UPDATE email_signup_codes SET expires_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND) WHERE id=?",id);expect("CODE_EXPIRED",()->verify());
 }
 @Test void expiredProofCannotCreateUser(){send();String proof=verify();db.update("UPDATE email_signup_codes SET proof_expires_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND) WHERE id=?",id);
  expect("CODE_EXPIRED",()->auth.signup(new AuthService.Signup(email,"test-password-1234","test","dev-v1",proof),credential,UUID.randomUUID().toString()));
  assertThat(db.queryForObject("SELECT COUNT(*) FROM users WHERE email=?",Integer.class,email)).isZero();
 }
 @Test void resendLimitsAndFailedDeliveryPreservePriorCode(){send();expect("RATE_LIMITED",()->codes.request(email,credential,ip));allowResend();
  doThrow(new ApiFailure(503,"MAIL_UNAVAILABLE")).when(mail).send(eq(email),eq("SIGNUP_CODE"),anyString());expect("MAIL_UNAVAILABLE",()->codes.request(email,credential,ip));
  assertThat(db.queryForObject("SELECT COUNT(*) FROM email_signup_codes WHERE owner_hash=?",Integer.class,owner)).isEqualTo(1);assertThat(verify()).isNotBlank();
 }
 @Test void emailHourlyLimitIsPersistent(){for(int n=0;n<5;n++){allowResend();send();}allowResend();expect("RATE_LIMITED",()->codes.request(email,credential,ip));}
 @Test void proofAndCodeCannotCrossEmailOrSession(){send();expect("CODE_EXPIRED",()->codes.verify(id,"other@example.invalid",code.get(),credential,ip));expect("UNAUTHENTICATED",()->codes.verify(id,email,code.get(),AuthSupport.token(),ip));
  String proof=verify();expect("EMAIL_CODE_REQUIRED",()->auth.signup(new AuthService.Signup("other@example.invalid","test-password-1234","test","dev-v1",proof),credential,UUID.randomUUID().toString()));
 }
 @Test void concurrentVerificationProducesOnlyOneProof() throws Exception {send();try(var pool=Executors.newVirtualThreadPerTaskExecutor()){
  var start=new CountDownLatch(1);Callable<Boolean> attempt=()->{start.await();try{verify();return true;}catch(ApiFailure e){assertThat(e.code).isEqualTo("CODE_USED");return false;}};
  var a=pool.submit(attempt);var b=pool.submit(attempt);start.countDown();assertThat(List.of(a.get(10,TimeUnit.SECONDS),b.get(10,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
 }}
 @Test void concurrentSignupWithSameRequestKeyReturnsOneResultAndCreatesNoLoginSession() throws Exception {
  send();String proof=verify(),key=UUID.randomUUID().toString();
  var input=new AuthService.Signup(email,"test-password-1234","test","dev-v1",proof);
  int sessions=db.queryForObject("SELECT COUNT(*) FROM web_sessions WHERE user_id IS NOT NULL",Integer.class);
  try(var pool=Executors.newVirtualThreadPerTaskExecutor()){
   var start=new CountDownLatch(1);Callable<Map<String,Object>> attempt=()->{start.await();return auth.signup(input,credential,key);};
   var a=pool.submit(attempt);var b=pool.submit(attempt);start.countDown();assertThat(a.get(15,TimeUnit.SECONDS)).isEqualTo(b.get(15,TimeUnit.SECONDS));
  }
  assertThat(db.queryForObject("SELECT COUNT(*) FROM users WHERE email=?",Integer.class,email)).isEqualTo(1);
  assertThat(db.queryForObject("SELECT COUNT(*) FROM auth_identities WHERE provider='EMAIL' AND subject=?",Integer.class,email)).isEqualTo(1);
  assertThat(db.queryForObject("SELECT COUNT(*) FROM web_sessions WHERE user_id IS NOT NULL",Integer.class)).isEqualTo(sessions);
 }
 @Test void concurrentSignupWithDifferentRequestKeysConsumesProofOnlyOnce() throws Exception {
  send();String proof=verify();var input=new AuthService.Signup(email,"test-password-1234","test","dev-v1",proof);
  try(var pool=Executors.newVirtualThreadPerTaskExecutor()){
   var start=new CountDownLatch(1);Callable<Boolean> attempt=()->{start.await();try{auth.signup(input,credential,UUID.randomUUID().toString());return true;}
    catch(ApiFailure failure){assertThat(failure.code).isEqualTo("CODE_USED");return false;}};
   var a=pool.submit(attempt);var b=pool.submit(attempt);start.countDown();assertThat(List.of(a.get(15,TimeUnit.SECONDS),b.get(15,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
  }
  assertThat(db.queryForObject("SELECT COUNT(*) FROM users WHERE email=?",Integer.class,email)).isEqualTo(1);
  assertThat(db.queryForObject("SELECT COUNT(*) FROM auth_identities WHERE provider='EMAIL' AND subject=?",Integer.class,email)).isEqualTo(1);
 }
}
