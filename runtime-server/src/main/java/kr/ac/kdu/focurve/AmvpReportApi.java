package kr.ac.kdu.focurve;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import static kr.ac.kdu.focurve.MemberAuth.*;

@RestController @Profile("member-runtime | local-integration")
@ConditionalOnProperty(name="focurve.additional.runtime-bridge.enabled",havingValue="true")
final class AmvpReportApi {
 private final MemberAuth auth;private final PlatformTransactionManager manager;private final ObjectProvider<AmvpBridgeSupport.CapabilitySource> sources;private final ObjectProvider<AmvpReportReceiver.EvidenceVerifier> proofs;
 AmvpReportApi(MemberAuth auth,PlatformTransactionManager manager,ObjectProvider<AmvpBridgeSupport.CapabilitySource> sources,ObjectProvider<AmvpReportReceiver.EvidenceVerifier> proofs){this.auth=auth;this.manager=manager;this.sources=sources;this.proofs=proofs;}
 @PostMapping("/api/v1/amvp/reports/batch")
 ResponseEntity<?> batch(HttpServletRequest request,@RequestBody String raw){
  try{
   check(request.getParameterMap().isEmpty(),400,"VALIDATION_FAILED");check(raw.getBytes(java.nio.charset.StandardCharsets.UTF_8).length<=1048576,413,"TOO_LARGE");ObjectNode body;
   try(var parser=auth.json.getFactory().createParser(raw)){parser.enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION);var parsed=auth.json.readTree(parser);check(parsed!=null&&parsed.isObject()&&parser.nextToken()==null,400,"VALIDATION_FAILED");body=(ObjectNode)parsed;}
   catch(java.io.IOException invalid){throw new Failure(400,"VALIDATION_FAILED");}
   new TransactionTemplate(manager).execute(tx->{var principal=auth.identity(request,true);AdditionalConfigApi.normalChannel(auth);check(principal.executor()!=null,403,"FORBIDDEN_EXECUTOR");return null;});
   var source=sources.getIfAvailable();var proof=proofs.getIfAvailable();check(source!=null&&proof!=null,503,"CAPABILITY_NOT_VERIFIED");
   return ResponseEntity.ok(new AmvpReportReceiver(auth,manager,source,proof).batch(()->{AdditionalConfigApi.normalChannel(auth);return auth.identity(request,true);},body));
  }catch(Failure rejected){return error(rejected.status,rejected.code);}catch(IllegalArgumentException|java.time.DateTimeException invalid){return error(422,"VALIDATION_FAILED");}catch(org.springframework.dao.DataAccessException failure){return error(503,"STORE_UNCONFIRMED");}
 }
 private ResponseEntity<?> error(int status,String code){return ResponseEntity.status(status).body(auth.obj("error",Map.of("code",code,"retryable",false),"request_id",id()));}
}
