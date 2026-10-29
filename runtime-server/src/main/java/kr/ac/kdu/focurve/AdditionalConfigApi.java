package kr.ac.kdu.focurve;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static kr.ac.kdu.focurve.MemberAuth.*;

/** Opt-in HTTP adapter. A property alone cannot substitute for verified execution capability. */
@RestController @Profile("member-runtime | local-integration")
@ConditionalOnProperty(name="focurve.additional.config-api.enabled",havingValue="true")
final class AdditionalConfigApi {
 private final MemberAuth auth;
 private final PlatformTransactionManager manager;
 private final ObjectProvider<AdditionalConfigStore.Admission> admissions;
 AdditionalConfigApi(MemberAuth auth,PlatformTransactionManager manager,ObjectProvider<AdditionalConfigStore.Admission> admissions){this.auth=auth;this.manager=manager;this.admissions=admissions;}
 @RequestMapping({"/api/v1/amvp/configs","/api/v1/amvp/configs/{configId}"})
 ResponseEntity<?> handle(HttpServletRequest req,@PathVariable(required=false)String configId,@RequestBody(required=false)String raw) {
  try {
   return new TransactionTemplate(manager).execute(tx->{
    boolean mutation=!req.getMethod().equals("GET");Identity identity=auth.identity(req,mutation);
    var admission=admissions.getIfAvailable();check(admission!=null,503,"CAPABILITY_NOT_VERIFIED");
    var store=new AdditionalConfigStore(auth,manager,admission);String method=req.getMethod();
    if(method.equals("GET")) {
     check(raw==null||raw.isBlank(),400,"VALIDATION_FAILED");
     if(configId!=null){check(req.getParameterMap().isEmpty(),400,"VALIDATION_FAILED");var row=store.get(identity,configId);return ResponseEntity.ok().eTag("\""+row.path("version").asLong()+"\"").body(row);}
     check(req.getParameterMap().keySet().stream().allMatch(Set.of("executor_id","kind","cursor","limit")::contains),400,"VALIDATION_FAILED");
     for(var values:req.getParameterMap().values())check(values.length==1,400,"VALIDATION_FAILED");
     int limit=50;try {if(req.getParameter("limit")!=null){check(req.getParameter("limit").matches("[1-9][0-9]{0,2}"),400,"VALIDATION_FAILED");limit=Integer.parseInt(req.getParameter("limit"));}}catch(NumberFormatException error){throw new Failure(400,"VALIDATION_FAILED");}
     return ResponseEntity.ok(store.list(identity,req.getParameter("executor_id"),req.getParameter("kind"),req.getParameter("cursor"),limit));
    }
    check(configId!=null&&Set.of("PUT","DELETE").contains(method),405,"VALIDATION_FAILED");
    check(req.getParameterMap().isEmpty(),400,"VALIDATION_FAILED");
    check(raw==null||raw.getBytes(StandardCharsets.UTF_8).length<=1048576,413,"TOO_LARGE");
    JsonNode body;
    try(var parser=auth.json.getFactory().createParser(raw==null||raw.isBlank()?"{}":raw)) {
     parser.enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION);body=auth.json.readTree(parser);
     check(parser.nextToken()==null&&body!=null&&body.isObject(),400,"VALIDATION_FAILED");
    }catch(java.io.IOException error){throw new Failure(400,"VALIDATION_FAILED");}
    if(method.equals("DELETE")){check(body.isEmpty(),400,"VALIDATION_FAILED");return ResponseEntity.accepted().body(store.delete(identity,configId,req.getHeader("If-Match"),req.getHeader("Idempotency-Key")));}
    var row=store.put(identity,configId,body,req.getHeader("If-Match"),req.getHeader("If-None-Match"),req.getHeader("Idempotency-Key"));return ResponseEntity.ok().eTag("\""+row.path("version").asLong()+"\"").body(row);
   });
  }catch(Failure failure){return ResponseEntity.status(failure.status).body(auth.obj("error",Map.of("code",failure.code,"retryable",false),"request_id",id()));}
  catch(IllegalArgumentException failure){return ResponseEntity.unprocessableEntity().body(auth.obj("error",Map.of("code","VALIDATION_FAILED","retryable",false),"request_id",id()));}
  catch(org.springframework.dao.DataIntegrityViolationException failure){return ResponseEntity.status(409).body(auth.obj("error",Map.of("code","IDEMPOTENCY_CONFLICT","retryable",false),"request_id",id()));}
 }
}
