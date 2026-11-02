package kr.ac.kdu.focurve;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;
import static kr.ac.kdu.focurve.MemberAuth.*;

@RestController @Profile("member-runtime | local-integration")
final class Option12Api {
 final MemberAuth auth;final TransactionTemplate tx;
 Option12Api(MemberAuth auth,PlatformTransactionManager manager){this.auth=auth;tx=new TransactionTemplate(manager);}
 @RequestMapping(value={"/api/v1/daily-focus-goal","/api/v1/daily-focus-goal/today","/api/v1/analysis-consent","/api/v1/analysis-jobs"})
 ResponseEntity<?> handle(HttpServletRequest request,@RequestBody(required=false)String raw){
  try{return tx.execute(ignored->{
   String method=request.getMethod(),path=request.getRequestURI();boolean write=!method.equals("GET");
   AdditionalConfigApi.normalChannel(auth);var identity=auth.identity(request,write);
   check(identity.executor()==null,403,"FORBIDDEN_EXECUTOR");
   check(request.getParameterMap().isEmpty(),422,"VALIDATION_FAILED");
   check(method.equals("GET")||method.equals("PUT")||path.equals("/api/v1/analysis-jobs")&&method.equals("POST"),405,"VALIDATION_FAILED");
   var goal=new DailyFocusGoal(auth);goal.owner(identity.user());
   JsonNode result;
   if(!write){
    check(raw==null||raw.isBlank(),422,"VALIDATION_FAILED");
    if(path.equals("/api/v1/daily-focus-goal"))result=goal.settings(identity.user());
    else if(path.endsWith("/today"))result=goal.today(identity.user(),Instant.now());
    else if(path.equals("/api/v1/analysis-consent"))result=new AnalysisSafety(auth).consent(identity.user());
    else throw new Failure(503,"PROVIDER_UNAVAILABLE");
   }else{
    var body=body(raw);
    if(path.equals("/api/v1/daily-focus-goal")&&method.equals("PUT"))result=goal.save(identity.user(),body,request.getHeader("If-Match"),request.getHeader("Idempotency-Key"),Instant.now());
    else if(path.equals("/api/v1/analysis-consent")&&method.equals("PUT"))result=new AnalysisSafety(auth).withdraw(identity.user(),body,request.getHeader("If-Match"),request.getHeader("Idempotency-Key"),Instant.now());
    else if(path.equals("/api/v1/analysis-jobs")&&method.equals("POST")){new AnalysisSafety(auth).rejectSubmission(identity.user(),body);throw new Failure(503,"PROVIDER_UNAVAILABLE");}
    else throw new Failure(405,"VALIDATION_FAILED");
   }
   var response=ResponseEntity.ok().header("Cache-Control","no-store");
   if(result.has("version"))response.eTag("\""+result.path("version").asLong()+"\"");return response.body(result);
  });}
  catch(Failure failure){return error(failure.status,failure.code);}
  catch(java.time.DateTimeException|IllegalArgumentException failure){return error(422,"VALIDATION_FAILED");}
  catch(org.springframework.dao.DataAccessException failure){return error(503,"TEMPORARILY_UNAVAILABLE");}
 }
 JsonNode body(String raw){
  check(raw!=null&&raw.getBytes(StandardCharsets.UTF_8).length<=8192,422,"VALIDATION_FAILED");
  try(var parser=auth.json.getFactory().createParser(raw)){
   parser.enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION);JsonNode value=auth.json.readTree(parser);
   check(value!=null&&value.isObject()&&parser.nextToken()==null,422,"VALIDATION_FAILED");return value;
  }catch(java.io.IOException failure){throw new Failure(422,"VALIDATION_FAILED");}
 }
 ResponseEntity<?> error(int status,String code){return ResponseEntity.status(status).header("Cache-Control","no-store").body(MemberMvpApi.error(auth,code));}
}
