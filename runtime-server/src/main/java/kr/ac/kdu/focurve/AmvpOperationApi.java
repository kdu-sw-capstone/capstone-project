package kr.ac.kdu.focurve;
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

/** Existing RC2 OP-01, initially backed by configuration DELETE obligations only. */
@RestController @Profile("member-runtime | local-integration")
@ConditionalOnProperty(name="focurve.additional.config-api.enabled",havingValue="true")
final class AmvpOperationApi {
 private final MemberAuth a;private final PlatformTransactionManager manager;
 private final ObjectProvider<AdditionalConfigStore.Admission> admissions;
 AmvpOperationApi(MemberAuth a,PlatformTransactionManager manager,ObjectProvider<AdditionalConfigStore.Admission> admissions){this.a=a;this.manager=manager;this.admissions=admissions;}
 @GetMapping("/api/v1/amvp/operations/{operationId}")
 ResponseEntity<?> get(HttpServletRequest request,@PathVariable String operationId){
  try{var read=new TransactionTemplate(manager);read.setIsolationLevel(org.springframework.transaction.TransactionDefinition.ISOLATION_REPEATABLE_READ);return read.execute(tx->{
   var principal=a.identity(request,false);AdditionalConfigApi.normalChannel(a);
   check(request.getParameterMap().isEmpty()&&request.getContentLengthLong()<=0,400,"VALIDATION_FAILED");
   var admission=admissions.getIfAvailable();check(admission!=null,503,"CAPABILITY_NOT_VERIFIED");
   return ResponseEntity.ok().header("Cache-Control","no-store").body(new AdditionalConfigStore(a,manager,admission).operation(principal,operationId));
  });}catch(Failure failure){return error(failure.status,failure.code);}catch(IllegalArgumentException invalid){return error(422,"VALIDATION_FAILED");}catch(org.springframework.dao.DataAccessException unavailable){return error(503,"STORE_UNCONFIRMED");}
 }
 private ResponseEntity<?> error(int status,String code){return ResponseEntity.status(status).body(a.obj("error",Map.of("code",code,"retryable",false),"request_id",id()));}
}
