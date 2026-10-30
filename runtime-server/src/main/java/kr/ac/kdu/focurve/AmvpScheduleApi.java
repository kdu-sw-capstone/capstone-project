package kr.ac.kdu.focurve;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Clock;
import java.util.Map;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;
import static kr.ac.kdu.focurve.MemberAuth.*;

/** Existing legacy actor routes. No new Wire messages, timer actor or default verifier. */
@RestController @Profile("member-runtime | local-integration")
@ConditionalOnProperty(name="focurve.additional.runtime-bridge.enabled",havingValue="true")
final class AmvpScheduleApi {
 private final MemberAuth a;private final PlatformTransactionManager manager;
 private final ObjectProvider<AdditionalConfigStore.Admission> admissions;private final ObjectProvider<AmvpScheduleBridge.Actor> actors;
 AmvpScheduleApi(MemberAuth auth,PlatformTransactionManager manager,ObjectProvider<AdditionalConfigStore.Admission> admissions,ObjectProvider<AmvpScheduleBridge.Actor> actors){a=auth;this.manager=manager;this.admissions=admissions;this.actors=actors;}
 @GetMapping("/api/v1/schedules")
 ResponseEntity<?> schedules(HttpServletRequest request){return run(request,false,(principal,bridge)->{
  check(request.getParameterMap().size()==1&&request.getParameterValues("executor_id")!=null&&request.getParameterValues("executor_id").length==1,400,"VALIDATION_FAILED");
  return ResponseEntity.ok(bridge.schedules(principal,request.getParameter("executor_id")));
 });}
 @GetMapping("/api/v1/schedules/{scheduleId}/occurrences")
 ResponseEntity<?> occurrences(HttpServletRequest request,@PathVariable String scheduleId){return run(request,false,(principal,bridge)->{
  check(request.getParameterMap().isEmpty(),400,"VALIDATION_FAILED");return ResponseEntity.ok(bridge.occurrences(principal,scheduleId));
 });}
 @PostMapping("/api/v1/schedule-occurrences/claim")
 ResponseEntity<?> claim(HttpServletRequest request,@RequestBody String raw){return run(request,true,(principal,bridge)->{
  check(request.getParameterMap().isEmpty()&&raw.length()<=4096,400,"VALIDATION_FAILED");ObjectNode body;
  try(var parser=a.json.getFactory().createParser(raw)){parser.enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION);var value=a.json.readTree(parser);check(value!=null&&value.isObject()&&parser.nextToken()==null,400,"VALIDATION_FAILED");body=(ObjectNode)value;}catch(java.io.IOException invalid){throw new Failure(400,"VALIDATION_FAILED");}
  var result=bridge.claim(principal,body);return ResponseEntity.status(result.has("execution_status")?202:200).body(result);
 });}
 private interface Action{ResponseEntity<?> execute(Identity principal,AmvpScheduleBridge bridge);}
 private ResponseEntity<?> run(HttpServletRequest request,boolean mutation,Action action){
  try{return new TransactionTemplate(manager).execute(tx->{var principal=a.identity(request,mutation);AdditionalConfigApi.normalChannel(a);var admission=admissions.getIfAvailable();check(admission!=null,503,"CAPABILITY_NOT_VERIFIED");if(!mutation)check(request.getContentLengthLong()<=0,400,"VALIDATION_FAILED");return action.execute(principal,new AmvpScheduleBridge(a,admission,actors.getIfAvailable(),Clock.systemUTC()));});}
  catch(Failure failure){return error(failure.status,failure.code);}
  catch(IllegalArgumentException|java.time.DateTimeException invalid){return error(422,"VALIDATION_FAILED");}
  catch(org.springframework.dao.DataAccessException unavailable){return error(503,"STORE_UNCONFIRMED");}
 }
 private ResponseEntity<?> error(int status,String code){return ResponseEntity.status(status).body(a.obj("error",Map.of("code",code,"retryable",false),"request_id",id()));}
}
