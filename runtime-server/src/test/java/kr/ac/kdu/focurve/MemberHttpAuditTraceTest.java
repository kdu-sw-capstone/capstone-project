package kr.ac.kdu.focurve;

import static org.assertj.core.api.Assertions.*;
import jakarta.servlet.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.annotation.AnnotationAwareOrderComparator;
import org.springframework.mock.web.*;

class MemberHttpAuditTraceTest {
 @TempDir Path dir;
 record Result(MockHttpServletResponse response,String log,boolean applicationReached){}
 Result invoke(String deadline)throws Exception {
  Files.createFile(dir.resolve("ready"));
  var request=new MockHttpServletRequest("POST","/api/v1/sessions");
  request.setContent("{\"duration_minutes\":3,\"private_test_value\":\"DO_NOT_LOG_BODY\"}".getBytes(StandardCharsets.UTF_8));
  request.addHeader("Authorization","Bearer DO_NOT_LOG_AUTH");request.addHeader("Cookie","DO_NOT_LOG_COOKIE");
  request.addHeader("X-FOCURVE-Request-ID","DO_NOT_TRUST_INCOMING_ID");
  var response=new MockHttpServletResponse();var reached=new AtomicBoolean();
  var filters=new ArrayList<Filter>(List.of(new MemberHttpAudit(),new UserInstallGate(dir.resolve("closed").toString(),"test-installation-key-not-a-user-secret-000",deadline,dir.resolve("ready").toString())));
  AnnotationAwareOrderComparator.sort(filters);
  var bytes=new ByteArrayOutputStream();var previous=System.out;
  synchronized(MemberHttpAudit.class){try{
   System.setOut(new PrintStream(bytes,true,StandardCharsets.UTF_8));
   new FilterChain(){int index;public void doFilter(ServletRequest r,ServletResponse s)throws IOException,ServletException{if(index<filters.size())filters.get(index++).doFilter(r,s,this);else reached.set(true);}}.doFilter(request,response);
  }finally{System.setOut(previous);}}
  return new Result(response,bytes.toString(StandardCharsets.UTF_8),reached.get());
 }
 @Test void startRejectedBeforeControllerStillHasTimestampRequestIdAndExactGateCode()throws Exception{
  var result=invoke(Instant.now().minusSeconds(1).toString());
  assertThat(result.response.getStatus()).isEqualTo(409);assertThat(result.applicationReached).isFalse();
  assertThat(result.response.getContentAsString()).isEqualTo("{\"error\":{\"code\":\"INSTALLATION_START_WINDOW_CLOSED\",\"retryable\":false}}");
  assertThat(result.log).contains("MEMBER_HTTP at=","request_id=","method=POST","path=/api/v1/sessions","status=409","stage=INSTALLATION_GATE","code=INSTALLATION_START_WINDOW_CLOSED");
  assertThat(result.response.getHeader("X-FOCURVE-Request-ID")).matches("[a-f0-9-]{36}");
 }
 @Test void auditAddsNoBodyHeaderOrIncomingIdentifierAndDoesNotChangeValidAdmission()throws Exception{
  var result=invoke(Instant.now().plusSeconds(3600).toString());
  assertThat(result.applicationReached).isTrue();assertThat(result.response.getStatus()).isEqualTo(200);
  assertThat(result.log).contains("status=200").doesNotContain("DO_NOT_LOG_BODY","DO_NOT_LOG_AUTH","DO_NOT_LOG_COOKIE","DO_NOT_TRUST_INCOMING_ID");
 }
 @Test void applicationRejectionKeepsItsActualCodeAndResponseWithoutLeakingRequestBody()throws Exception{
  var auth=new MemberAuth(new org.springframework.jdbc.core.JdbcTemplate(),new com.fasterxml.jackson.databind.ObjectMapper(),"https://localhost:29511",Base64.getEncoder().encodeToString(new byte[32]),"chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/popup/popup.html");
  var manager=new org.springframework.transaction.PlatformTransactionManager(){public org.springframework.transaction.TransactionStatus getTransaction(org.springframework.transaction.TransactionDefinition definition){return new org.springframework.transaction.support.SimpleTransactionStatus();}public void commit(org.springframework.transaction.TransactionStatus status){}public void rollback(org.springframework.transaction.TransactionStatus status){}};
  var api=new MemberApi(auth,null,manager){@Override com.fasterxml.jackson.databind.node.ObjectNode route(jakarta.servlet.http.HttpServletRequest r,jakarta.servlet.http.HttpServletResponse s,String p,String method,com.fasterxml.jackson.databind.JsonNode b,String raw){throw new MemberAuth.Failure(422,"INVALID_SNAPSHOT");}};
  var request=new MockHttpServletRequest("POST","/api/v1/sessions");var response=new MockHttpServletResponse();var bytes=new ByteArrayOutputStream();var previous=System.out;
  synchronized(MemberHttpAudit.class){try{System.setOut(new PrintStream(bytes,true,StandardCharsets.UTF_8));new MemberHttpAudit().doFilter(request,response,(r,s)->{var result=api.handle((jakarta.servlet.http.HttpServletRequest)r,(jakarta.servlet.http.HttpServletResponse)s,"{\"private_value\":\"DO_NOT_LOG_BODY\"}");assertThat(result.getStatusCode().value()).isEqualTo(422);assertThat(((com.fasterxml.jackson.databind.JsonNode)result.getBody()).path("error").path("code").asText()).isEqualTo("INVALID_SNAPSHOT");((jakarta.servlet.http.HttpServletResponse)s).setStatus(result.getStatusCode().value());});}finally{System.setOut(previous);}}
  assertThat(bytes.toString(StandardCharsets.UTF_8)).contains("stage=MEMBER_API","code=INVALID_SNAPSHOT","status=422").doesNotContain("DO_NOT_LOG_BODY");
 }
}
