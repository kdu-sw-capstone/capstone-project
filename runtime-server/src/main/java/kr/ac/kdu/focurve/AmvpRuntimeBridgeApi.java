package kr.ac.kdu.focurve;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;
import static kr.ac.kdu.focurve.MemberAuth.*;

/** Opt-in transport. No default capability issuer, clock proof, synthetic producer or startup side effects. */
@RestController @Profile("member-runtime | local-integration")
@ConditionalOnProperty(name="focurve.additional.runtime-bridge.enabled",havingValue="true")
final class AmvpRuntimeBridgeApi {
 private final MemberAuth auth;private final PlatformTransactionManager manager;
 private final ObjectProvider<AmvpBridgeSupport.CapabilitySource> capabilities;private final ObjectProvider<AmvpUsageReceiver.ClockProof> clocks;
 private final ObjectProvider<AmvpFocusAttachments.FrozenFocusProof> focuses;
 AmvpRuntimeBridgeApi(MemberAuth auth,PlatformTransactionManager manager,ObjectProvider<AmvpBridgeSupport.CapabilitySource> capabilities,ObjectProvider<AmvpUsageReceiver.ClockProof> clocks,ObjectProvider<AmvpFocusAttachments.FrozenFocusProof> focuses){this.auth=auth;this.manager=manager;this.capabilities=capabilities;this.clocks=clocks;this.focuses=focuses;}
 @GetMapping("/api/v1/amvp/runtime-packages/current")
 ResponseEntity<?> current(HttpServletRequest request){return guarded(()->new TransactionTemplate(manager).execute(tx->{
  var principal=auth.identity(request,false);AdditionalConfigApi.normalChannel(auth);check(principal.executor()!=null,403,"FORBIDDEN_EXECUTOR");
  check(request.getParameterMap().size()==1&&request.getParameterValues("executor_id")!=null&&request.getParameterValues("executor_id").length==1,400,"VALIDATION_FAILED");
  var source=capabilities.getIfAvailable();check(source!=null,503,"CAPABILITY_NOT_VERIFIED");return ResponseEntity.ok(new AmvpPolicyPublisher(auth,source).current(principal,request.getParameter("executor_id")));
 }));}
 @PostMapping("/api/v1/amvp/focus-attachments")
 ResponseEntity<?> attachment(HttpServletRequest request,@RequestBody String raw){return guarded(()->{
  check(request.getParameterMap().isEmpty(),400,"VALIDATION_FAILED");ObjectNode body=body(raw);
  return new TransactionTemplate(manager).execute(tx->{var principal=auth.identity(request,true);AdditionalConfigApi.normalChannel(auth);var source=capabilities.getIfAvailable();var proof=focuses.getIfAvailable();check(source!=null&&proof!=null,503,"CAPABILITY_NOT_VERIFIED");
   return ResponseEntity.status(201).body(new AmvpFocusAttachments(auth,manager,source,proof).issue(principal,body,request.getHeader("Idempotency-Key")));
  });
 });}
 @PostMapping("/api/v1/amvp/usage/batch")
 ResponseEntity<?> receive(HttpServletRequest request,@RequestBody String raw){return guarded(()->{
  check(request.getParameterMap().isEmpty(),400,"VALIDATION_FAILED");ObjectNode body=body(raw);
  // Do not suspend an authentication transaction which holds the same installation lock as an item writer.
  new TransactionTemplate(manager).execute(tx->{var principal=auth.identity(request,true);AdditionalConfigApi.normalChannel(auth);check(principal.executor()!=null,403,"FORBIDDEN_EXECUTOR");return null;});
  var source=capabilities.getIfAvailable();var proof=clocks.getIfAvailable();check(source!=null&&proof!=null,503,"CAPABILITY_NOT_VERIFIED");
  var receiver=new AmvpUsageReceiver(auth,manager,source,proof);return ResponseEntity.ok(receiver.batch(()->{AdditionalConfigApi.normalChannel(auth);return auth.identity(request,true);},body));
 });}
 private ObjectNode body(String raw){
  check(raw.getBytes(StandardCharsets.UTF_8).length<=1048576,413,"TOO_LARGE");try(var parser=auth.json.getFactory().createParser(raw)){parser.enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION);var parsed=auth.json.readTree(parser);check(parsed!=null&&parsed.isObject()&&parser.nextToken()==null,400,"VALIDATION_FAILED");return (ObjectNode)parsed;}catch(java.io.IOException invalid){throw new Failure(400,"VALIDATION_FAILED");}
 }
 private ResponseEntity<?> guarded(java.util.function.Supplier<ResponseEntity<?>> action){
  try{return action.get();}catch(Failure failure){return error(failure.status,failure.code);}
  catch(IllegalArgumentException|java.time.DateTimeException invalid){return error(422,"VALIDATION_FAILED");}
  catch(org.springframework.dao.DataAccessException unavailable){return error(503,"STORE_UNCONFIRMED");}
 }
 private ResponseEntity<?> error(int status,String code){return ResponseEntity.status(status).body(auth.obj("error",Map.of("code",code,"retryable",false),"request_id",id()));}
}
