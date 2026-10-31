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

@RestController @Profile("member-runtime | local-integration")
@ConditionalOnProperty(name="focurve.additional.config-api.enabled",havingValue="true")
final class AdditionalStatisticsApi {
 private final MemberAuth auth;private final PlatformTransactionManager manager;private final ObjectProvider<AdditionalConfigStore.Admission> admissions;
 AdditionalStatisticsApi(MemberAuth auth,PlatformTransactionManager manager,ObjectProvider<AdditionalConfigStore.Admission> admissions){this.auth=auth;this.manager=manager;this.admissions=admissions;}
 @GetMapping("/api/v1/amvp/statistics/browser-usage")
 ResponseEntity<?> get(HttpServletRequest req) {
  try {return new TransactionTemplate(manager).execute(tx->{
   Identity identity=auth.identity(req,false);AdditionalConfigApi.normalChannel(auth);var gate=admissions.getIfAvailable();check(gate!=null,503,"CAPABILITY_NOT_VERIFIED");
   var range=AdditionalUsageStatistics.Range.parse(req.getParameterMap());
   return ResponseEntity.ok(new AdditionalUsageStatistics(auth,manager,gate).query(identity,range));
  });}catch(Failure failure){return ResponseEntity.status(failure.status).body(auth.obj("error",Map.of("code",failure.code,"retryable",false),"request_id",id()));}
  catch(org.springframework.dao.DataAccessException failure){return ResponseEntity.status(503).body(auth.obj("error",Map.of("code","TEMPORARILY_UNAVAILABLE","retryable",false),"request_id",id()));}
 }
}
