package kr.ac.kdu.focurve;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import jakarta.servlet.http.Cookie;
import kr.ac.kdu.focurve.auth.*;
import kr.ac.kdu.focurve.api.ApiFailure;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.*;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/** Actual product transactions/MySQL; provider identities and error responses are synthetic. */
@ActiveProfiles("test")
@SpringBootTest(properties={"AUTH_COOKIE_SECURE=false", "AUTH_PUBLIC_URL=http://localhost:5175",
    "OAUTH_CALLBACK_BASE=http://localhost:5175", "GOOGLE_CLIENT_ID=synthetic",
    "GOOGLE_CLIENT_SECRET=synthetic", "KAKAO_CLIENT_ID=synthetic"})
class AuthAcceptanceIntegrationTest {
  @Autowired JdbcTemplate db;
  @Autowired SocialAuthentication social;
  @Autowired WebAuthentication web;
  @MockitoBean SocialProviderClient provider;
  @MockitoBean MailDelivery mail;

  MockHttpServletRequest browser() {
    var req=new MockHttpServletRequest(); var res=new MockHttpServletResponse();
    web.csrf(req,res); req.setCookies(res.getCookie("focurve_session")); return req;
  }
  String param(String url,String key) {
    String query=url.substring(url.indexOf('?')+1);
    for(String part:query.split("&")) { String[] kv=part.split("=",2);
      if(kv[0].equals(key)) return URLDecoder.decode(kv[1],StandardCharsets.UTF_8); }
    throw new AssertionError("parameter missing");
  }
  String state(String p,MockHttpServletRequest req) {
    return param(social.authorize(p,"login","/",req,new MockHttpServletResponse()),"state");
  }
  List<Integer> counts() {
    return List.of(db.queryForObject("SELECT COUNT(*) FROM users",Integer.class),
        db.queryForObject("SELECT COUNT(*) FROM auth_identities",Integer.class),
        db.queryForObject("SELECT COUNT(*) FROM web_sessions WHERE user_id IS NOT NULL",Integer.class));
  }
  void rejects(Runnable action,String code) {
    assertThatThrownBy(action::run).isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.code).isEqualTo(code));
  }
  void identity(String p,String subject,String email) {
    when(provider.exchange(eq(p),anyString(),any(),anyString()))
      .thenAnswer(i->new LinkedHashMap<>(Map.of("subject",subject,"email",email)));
  }
  String ticket(String p,MockHttpServletRequest req,String subject,String email) {
    identity(p,subject,email);
    return param(social.callback(p,state(p,req),"synthetic-code",null,req,new MockHttpServletResponse()),"ticket");
  }

  @ParameterizedTest @ValueSource(strings={"google","kakao"})
  void cancellationAndReplayCreateNeitherAccountNorAuthenticatedSession(String p) {
    var req=browser(); var before=counts(); String s=state(p,req);
    var res=new MockHttpServletResponse();
    assertThat(social.callback(p,s,null,"access_denied",req,res)).endsWith("/#social-canceled");
    assertThat(res.getCookie("focurve_session")).isNull(); assertThat(counts()).isEqualTo(before);
    rejects(()->social.callback(p,s,"synthetic",null,req,new MockHttpServletResponse()),"INVALID_STATE");
    assertThat(counts()).isEqualTo(before); verifyNoInteractions(provider);
  }
  @ParameterizedTest @ValueSource(strings={"google","kakao"})
  void wrongStateBrowserProviderAndExpiredStateCreateNothing(String p) {
    var req=browser(); var before=counts();
    rejects(()->social.callback(p,"wrong-state","code",null,req,new MockHttpServletResponse()),"INVALID_STATE");
    String bound=state(p,req); var other=browser();
    rejects(()->social.callback(p,bound,"code",null,other,new MockHttpServletResponse()),"INVALID_STATE");
    String mismatch=state(p,req);
    rejects(()->social.callback(p.equals("google")?"kakao":"google",mismatch,"code",null,req,new MockHttpServletResponse()),"INVALID_STATE");
    String expired=state(p,req);
    db.update("UPDATE auth_challenges SET expires_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND) WHERE token_hash=?",AuthSupport.hash(expired));
    rejects(()->social.callback(p,expired,"code",null,req,new MockHttpServletResponse()),"INVALID_STATE");
    assertThat(counts()).isEqualTo(before); verifyNoInteractions(provider);
  }
  @ParameterizedTest @ValueSource(strings={"google","kakao"})
  void providerFailureAndMissingCodeCreateNothingAndCannotReplay(String p) {
    var req=browser(); var before=counts(); String missing=state(p,req);
    rejects(()->social.callback(p,missing,null,null,req,new MockHttpServletResponse()),"INVALID_STATE");
    when(provider.exchange(eq(p),anyString(),any(),anyString())).thenThrow(new ApiFailure(401,"INVALID_CREDENTIALS"));
    String s=state(p,req); var res=new MockHttpServletResponse();
    rejects(()->social.callback(p,s,"synthetic",null,req,res),"INVALID_CREDENTIALS");
    assertThat(res.getCookie("focurve_session")).isNull();
    rejects(()->social.callback(p,s,"synthetic",null,req,new MockHttpServletResponse()),"INVALID_STATE");
    assertThat(counts()).isEqualTo(before);
  }
  @ParameterizedTest @ValueSource(strings={"google","kakao"})
  void firstSignupGateRepeatedCallbackAndReturningSubject(String p) {
    var req=browser(); String subject=UUID.randomUUID().toString(),email=subject+"@acceptance.invalid";
    var before=counts(); identity(p,subject,email); String s=state(p,req);
    var callbackResponse=new MockHttpServletResponse();
    String t=param(social.callback(p,s,"synthetic",null,req,callbackResponse),"ticket");
    assertThat(counts()).isEqualTo(before); assertThat(callbackResponse.getCookie("focurve_session")).isNull();
    social.signupInfo(t,req); assertThat(counts()).isEqualTo(before);
    rejects(()->social.complete(t,"wrong-terms","test",req,new MockHttpServletResponse()),"VALIDATION_FAILED");
    assertThat(counts()).isEqualTo(before);
    rejects(()->social.callback(p,s,"synthetic",null,req,new MockHttpServletResponse()),"INVALID_STATE");
    var completed=new MockHttpServletResponse(); social.complete(t,"dev-v1","test",req,completed);
    long id=db.queryForObject("SELECT user_id FROM auth_identities WHERE provider=? AND subject=?",Long.class,p.toUpperCase(Locale.ROOT),subject);
    assertThat(counts()).isEqualTo(List.of(before.get(0)+1,before.get(1)+1,before.get(2)+1));
    rejects(()->social.complete(t,"dev-v1","test",req,new MockHttpServletResponse()),"USED_TOKEN");
    req.setCookies(completed.getCookie("focurve_session")); assertThat(web.require(req)).isEqualTo(id);
    identity(p,subject,UUID.randomUUID()+"@changed.invalid");
    var again=new MockHttpServletResponse();
    assertThat(social.callback(p,state(p,req),"synthetic",null,req,again)).isEqualTo("http://localhost:5175/");
    req.setCookies(again.getCookie("focurve_session")); assertThat(web.require(req)).isEqualTo(id);
    assertThat(counts()).isEqualTo(List.of(before.get(0)+1,before.get(1)+1,before.get(2)+1));
  }
  @ParameterizedTest @ValueSource(strings={"google","kakao"})
  void concurrentConfirmationCreatesExactlyOneAccountIdentityAndSession(String p) throws Exception {
    var req=browser(); var before=counts(); String subject=UUID.randomUUID().toString();
    String t=ticket(p,req,subject,subject+"@acceptance.invalid"); var start=new CountDownLatch(1);
    try(var pool=Executors.newVirtualThreadPerTaskExecutor()) {
      Callable<Boolean> confirm=()->{start.await();try{social.complete(t,"dev-v1","test",req,new MockHttpServletResponse());return true;}
        catch(ApiFailure e){assertThat(e.code).isEqualTo("USED_TOKEN");return false;}};
      var a=pool.submit(confirm); var b=pool.submit(confirm); start.countDown();
      assertThat(List.of(a.get(15,TimeUnit.SECONDS),b.get(15,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
    }
    assertThat(counts()).isEqualTo(List.of(before.get(0)+1,before.get(1)+1,before.get(2)+1));
    assertThat(db.queryForObject("SELECT COUNT(*) FROM auth_identities WHERE provider=? AND subject=?",Integer.class,p.toUpperCase(Locale.ROOT),subject)).isEqualTo(1);
  }
}
