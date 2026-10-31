package kr.ac.kdu.focurve;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import static kr.ac.kdu.focurve.MemberAuth.*;

/** Web read-model extension. Does not change RC2 CFG01/02 or Core Wire contracts. */
@RestController @Profile("member-runtime | local-integration")
@ConditionalOnProperty(name="focurve.additional.config-api.enabled",havingValue="true")
final class AmvpWebDeletionApi {
 private final MemberAuth a;private final PlatformTransactionManager manager;private final ObjectProvider<AdditionalConfigStore.Admission> admissions;
 AmvpWebDeletionApi(MemberAuth a,PlatformTransactionManager manager,ObjectProvider<AdditionalConfigStore.Admission> admissions){this.a=a;this.manager=manager;this.admissions=admissions;}
 @GetMapping("/api/v1/amvp/web/site-time-deletions")
 ResponseEntity<?> list(HttpServletRequest req){try{return new TransactionTemplate(manager).execute(tx->{
  var identity=a.identity(req,false);AdditionalConfigApi.normalChannel(a);check(req.getContentLengthLong()<=0&&req.getParameterMap().keySet().stream().allMatch(Set.of("executor_id","cursor","limit")::contains),400,"VALIDATION_FAILED");for(var values:req.getParameterMap().values())check(values.length==1,400,"VALIDATION_FAILED");
  String limit=req.getParameter("limit");check(limit==null||limit.matches("[1-9][0-9]{0,2}"),400,"VALIDATION_FAILED");int size=limit==null?50:Integer.parseInt(limit);var admission=admissions.getIfAvailable();check(admission!=null,503,"CAPABILITY_NOT_VERIFIED");
  return ResponseEntity.ok().header("Cache-Control","no-store").body(new AdditionalConfigStore(a,manager,admission).deletions(identity,req.getParameter("executor_id"),req.getParameter("cursor"),size));
 });}catch(Failure failure){return error(failure.status,failure.code);}catch(IllegalArgumentException invalid){return error(422,"VALIDATION_FAILED");}catch(org.springframework.dao.DataAccessException unavailable){return error(503,"STORE_UNCONFIRMED");}}
 private ResponseEntity<?> error(int status,String code){return ResponseEntity.status(status).body(a.obj("error",Map.of("code",code,"retryable",false),"request_id",id()));}
}
