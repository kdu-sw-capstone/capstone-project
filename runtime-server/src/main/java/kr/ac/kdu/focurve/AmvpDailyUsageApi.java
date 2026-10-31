package kr.ac.kdu.focurve;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;
import static kr.ac.kdu.focurve.MemberAuth.*;

@RestController @Profile("member-runtime | local-integration")
@ConditionalOnProperty(name="focurve.additional.config-api.enabled",havingValue="true")
final class AmvpDailyUsageApi {
 private final MemberAuth auth;private final PlatformTransactionManager manager;private final ObjectProvider<AdditionalConfigStore.Admission> admissions;
 AmvpDailyUsageApi(MemberAuth auth,PlatformTransactionManager manager,ObjectProvider<AdditionalConfigStore.Admission> admissions){this.auth=auth;this.manager=manager;this.admissions=admissions;}
 @GetMapping("/api/v1/amvp/site-time-policies/{policyId}/usage")
 ResponseEntity<?> get(HttpServletRequest request,@PathVariable String policyId){
  // Existing identity() uses FOR UPDATE to fence token revocation. Preserve that lock;
  // business reads below never mutate quota, raw data or receipts (covered by SQL tests).
  try{var read=new TransactionTemplate(manager);read.setIsolationLevel(org.springframework.transaction.TransactionDefinition.ISOLATION_REPEATABLE_READ);return read.execute(tx->{
   var principal=auth.identity(request,false);AdditionalConfigApi.normalChannel(auth);var admission=admissions.getIfAvailable();check(admission!=null,503,"CAPABILITY_NOT_VERIFIED");
   check(request.getContentLengthLong()<=0,400,"VALIDATION_FAILED");
   var query=AmvpDailyUsage.Query.parse(request.getParameterMap());return ResponseEntity.ok(new AmvpDailyUsage(auth,manager,admission).get(principal,policyId,query));
  });}catch(Failure failure){return error(failure.status,failure.code);}
  catch(IllegalArgumentException|java.time.DateTimeException failure){return error(422,"VALIDATION_FAILED");}
  catch(org.springframework.dao.DataAccessException failure){return error(503,"STORE_UNCONFIRMED");}
 }
 private ResponseEntity<?> error(int status,String code){return ResponseEntity.status(status).body(auth.obj("error",Map.of("code",code,"retryable",false),"request_id",id()));}
}
