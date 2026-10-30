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

/** RC2 FOC-02/03. Core receipts enter the internal receiver, not a new public message contract. */
@RestController @Profile("member-runtime | local-integration")
@ConditionalOnProperty(name="focurve.additional.runtime-bridge.enabled",havingValue="true")
final class AmvpCadenceApi {
 private final MemberAuth a;private final PlatformTransactionManager manager;private final ObjectProvider<AmvpBridgeSupport.CapabilitySource> capabilities;private final ObjectProvider<AmvpCadenceControl.Authority> authorities;
 AmvpCadenceApi(MemberAuth auth,PlatformTransactionManager manager,ObjectProvider<AmvpBridgeSupport.CapabilitySource> capabilities,ObjectProvider<AmvpCadenceControl.Authority> authorities){a=auth;this.manager=manager;this.capabilities=capabilities;this.authorities=authorities;}
 @GetMapping("/api/v1/amvp/focus/{sessionId}/state")
 ResponseEntity<?> state(HttpServletRequest request,@PathVariable String sessionId){return run(request,false,(principal,service)->response(service.get(principal,sessionId),200));}
 @PostMapping("/api/v1/amvp/focus/{sessionId}/commands")
 ResponseEntity<?> command(HttpServletRequest request,@PathVariable String sessionId,@RequestBody String raw){return run(request,true,(principal,service)->{
  check(raw.length()<=32768,413,"TOO_LARGE");ObjectNode body;
  try(var parser=a.json.getFactory().createParser(raw)){parser.enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION);var parsed=a.json.readTree(parser);check(parsed!=null&&parsed.isObject()&&parser.nextToken()==null,400,"VALIDATION_FAILED");body=(ObjectNode)parsed;}catch(java.io.IOException invalid){throw new Failure(400,"VALIDATION_FAILED");}
  return response(service.command(principal,sessionId,body,request.getHeader("If-Match"),request.getHeader("Idempotency-Key")),202);
 });}
 private ResponseEntity<?> response(AmvpCadenceControl.View view,int status){
  // Read-side transport metadata reuses existing binding/capability/attachment IDs. Never an authority grant.
  // ETag is the coordinated resource version; it is not D06 desired_revision or the frozen Snapshot version.
  return ResponseEntity.status(status).eTag("\""+view.version()+"\"").header("Cache-Control","no-store").header("X-Focurve-Control-Context",view.context().toString()).body(view.state());
 }
 private interface Action{ResponseEntity<?> apply(Identity principal,AmvpCadenceControl service);}
 private ResponseEntity<?> run(HttpServletRequest request,boolean mutation,Action action){
  try{return new TransactionTemplate(manager).execute(tx->{var principal=a.identity(request,mutation);AdditionalConfigApi.normalChannel(a);check(request.getParameterMap().isEmpty()&&(mutation||request.getContentLengthLong()<=0),400,"VALIDATION_FAILED");var source=capabilities.getIfAvailable();var authority=authorities.getIfAvailable();check(source!=null&&authority!=null,503,"CAPABILITY_NOT_VERIFIED");return action.apply(principal,new AmvpCadenceControl(a,manager,source,authority,Clock.systemUTC()));});}
  catch(Failure failure){return error(failure.status,failure.code);}
  catch(IllegalArgumentException|java.time.DateTimeException invalid){return error(422,"VALIDATION_FAILED");}
  catch(org.springframework.dao.DataAccessException unavailable){return error(503,"STORE_UNCONFIRMED");}
 }
 private ResponseEntity<?> error(int status,String code){return ResponseEntity.status(status).body(a.obj("error",Map.of("code",code,"retryable",false),"request_id",id()));}
}
