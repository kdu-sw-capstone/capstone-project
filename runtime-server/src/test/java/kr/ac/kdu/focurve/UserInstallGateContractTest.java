package kr.ac.kdu.focurve;

import static org.assertj.core.api.Assertions.*;
import java.nio.file.*;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

/** Servlet contract only: no browser, DB, credentials or network services. */
class UserInstallGateContractTest {
 @TempDir Path dir;
 final String key="synthetic-test-key-never-a-user-secret-000";
 UserInstallGate gate(String deadline){return new UserInstallGate(dir.resolve("closed").toString(),key,deadline,dir.resolve("ready").toString());}
 MockHttpServletResponse request(UserInstallGate gate,String method,String uri,String body,AtomicBoolean reached)throws Exception{
  var req=new MockHttpServletRequest(method,uri);req.setContent(body.getBytes(java.nio.charset.StandardCharsets.UTF_8));
  var res=new MockHttpServletResponse();gate.doFilter(req,res,(r,s)->{reached.set(true);assertThat(new String(r.getInputStream().readAllBytes(),java.nio.charset.StandardCharsets.UTF_8)).isEqualTo(body);});return res;
 }
 @Test void ordinaryServerDoesNotAccidentallyRequireInstallationEnvironment(){
  try(var context=new AnnotationConfigApplicationContext()){
   context.register(UserInstallGate.class);context.refresh();assertThat(context.getBeansOfType(UserInstallGate.class)).isEmpty();
  }
 }
 @Test void installationProfileRegistersTheFailClosedGate(){
  try(var context=new AnnotationConfigApplicationContext()){
   context.getEnvironment().setActiveProfiles("user-install");context.register(UserInstallGate.class);context.refresh();assertThat(context.getBeansOfType(UserInstallGate.class)).hasSize(1);
  }
 }
 @Test void missingConfigurationDoesNotReachApplication()throws Exception{
  var reached=new AtomicBoolean();var res=request(new UserInstallGate(null,null,null,null),"GET","/actuator/health","",reached);assertThat(res.getStatus()).isEqualTo(503);assertThat(reached).isFalse();
 }
 @Test void readOnlyHealthIsAllowedButNotEvidenceOfReadiness()throws Exception{
  var reached=new AtomicBoolean();assertThat(request(gate(null),"GET","/actuator/health","",reached).getStatus()).isEqualTo(200);assertThat(reached).isTrue();
 }
 @Test void missingReadyMarkerRejectsStart()throws Exception{
  var reached=new AtomicBoolean();var res=request(gate(Instant.now().plusSeconds(3600).toString()),"POST","/api/v1/sessions","{\"duration_minutes\":1}",reached);assertThat(res.getStatus()).isEqualTo(409);assertThat(res.getContentAsString()).contains("INSTALLATION_NOT_READY");assertThat(reached).isFalse();
 }
 @Test void validStartPreservesExactRequestBody()throws Exception{
  Files.createFile(dir.resolve("ready"));var reached=new AtomicBoolean();assertThat(request(gate(Instant.now().plusSeconds(3600).toString()),"POST","/api/v1/sessions","{\"duration_minutes\":25}",reached).getStatus()).isEqualTo(200);assertThat(reached).isTrue();
 }
 @Test void expiredOrInsufficientDeadlineRejectsStart()throws Exception{
  Files.createFile(dir.resolve("ready"));for(String deadline:new String[]{Instant.now().minusSeconds(1).toString(),Instant.now().plusSeconds(500).toString()}){
   var reached=new AtomicBoolean();assertThat(request(gate(deadline),"POST","/api/v1/sessions","{\"duration_minutes\":1}",reached).getStatus()).isEqualTo(409);assertThat(reached).isFalse();
  }
 }
 @Test void closedAdmissionBlocksPolicyMutationButKeepsNormalEndRoute()throws Exception{
  Files.createFile(dir.resolve("closed"));var blocked=new AtomicBoolean();assertThat(request(gate(null),"POST","/api/v1/sites","{}",blocked).getStatus()).isEqualTo(409);assertThat(blocked).isFalse();
  var finish=new AtomicBoolean();assertThat(request(gate(null),"POST","/api/v1/sessions/12345678-1234-1234-1234-123456789012/end","{}",finish).getStatus()).isEqualTo(200);assertThat(finish).isTrue();
 }
}
