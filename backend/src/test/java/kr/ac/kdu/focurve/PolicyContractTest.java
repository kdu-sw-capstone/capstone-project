package kr.ac.kdu.focurve;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import org.junit.jupiter.api.Test;
import kr.ac.kdu.focurve.events.SnapshotAccess;
import kr.ac.kdu.focurve.execution.*;
import kr.ac.kdu.focurve.api.ApiFailure;

class PolicyContractTest {
 Map<String,Object> snapshot(String version,String policy) {
  var s=new LinkedHashMap<String,Object>();
  s.put("format_version",version);if(version.equals("1.2"))s.put("site_match_strategy","MOST_SPECIFIC_HOST");
  s.put("policy_snapshot_id",UUID.randomUUID().toString());s.put("executor_id",UUID.randomUUID().toString());s.put("owner_user_id","1");s.put("created_at","2026-10-09T00:00:00Z");s.put("source_version",1);
  var site=new LinkedHashMap<String,Object>();site.put("canonical_host","naver.com");site.put("include_subdomains",true);site.put("purpose",policy.equals("ALLOW")?"GENERAL":"DISTRACTION");site.put("access_policy",policy);site.put("feature_policies",List.of());site.put("site_id","1");site.put("display_name","fixture");site.put("version",1);site.put("created_at","2026-10-09T00:00:00Z");site.put("updated_at","2026-10-09T00:00:00Z");s.put("sites",List.of(site));
  s.put("content_policy",ExecutionService.defaultContent());return s;
 }
 Map<String,Object> access(String host,String matched,String primary,List<String> reasons) {
  var p=new LinkedHashMap<String,Object>();p.put("target_host",host);p.put("target_key",host);p.put("target_kind","SITE");p.put("matched_policy_host",matched);p.put("reason",primary);p.put("blocked_reasons",reasons);return p;
 }
 @Test void actualAndMatchedHostsAreSeparateAndParentKeyIsRejected() {
  var s=snapshot("1.2","RECORD");var p=access("chzzk.naver.com","naver.com","RECORD",List.of());
  SnapshotAccess.validate12(s,"RECORDED_ACCESS",p);p.put("target_key","naver.com");
  assertThatThrownBy(()->SnapshotAccess.validate12(s,"RECORDED_ACCESS",p)).isInstanceOf(ApiFailure.class);
 }
 @Test void globalReasonsIndependentWithNullMatchedPolicyAndOneEvent() {
  var s=snapshot("1.2","ALLOW");s.put("sites",List.of());
  var c=new LinkedHashMap<>(ExecutionService.defaultContent());
  c.put("adult_domains",Map.of("enabled",true,"custom_hosts",List.of(),"exceptions",List.of()));
  c.put("keywords",Map.of("enabled",true,"rules",List.of(),"exceptions",List.of()));s.put("content_policy",c);
  var p=access("example.org",null,"ADULT_DOMAIN",List.of("ADULT_DOMAIN","KEYWORD"));
  SnapshotAccess.validate12(s,"BLOCKED_SITE_ACCESS",p);
  c.put("adult_domains",Map.of("enabled",true,"custom_hosts",List.of(),"exceptions",List.of(Map.of("host","example.org","include_subdomains",false))));
  p.put("blocked_reasons",List.of("KEYWORD"));p.put("reason","KEYWORD");SnapshotAccess.validate12(s,"BLOCKED_SITE_ACCESS",p);
  p.put("blocked_reasons",List.of("ADULT_DOMAIN"));p.put("reason","ADULT_DOMAIN");assertThatThrownBy(()->SnapshotAccess.validate12(s,"BLOCKED_SITE_ACCESS",p)).isInstanceOf(ApiFailure.class);
 }
 @Test void siteBlockSurvivesGlobalExceptionsAndAllowDoesNotBypassGlobal() {
  var s=snapshot("1.2","BLOCK");var p=access("chzzk.naver.com","naver.com","USER_SITE",List.of("USER_SITE"));
  SnapshotAccess.validate12(s,"BLOCKED_SITE_ACCESS",p);
  s=snapshot("1.2","ALLOW");var c=new LinkedHashMap<>(ExecutionService.defaultContent());c.put("keywords",Map.of("enabled",true,"rules",List.of(),"exceptions",List.of()));s.put("content_policy",c);
  SnapshotAccess.validate12(s,"BLOCKED_SITE_ACCESS",access("chzzk.naver.com","naver.com","KEYWORD",List.of("KEYWORD")));
 }
 @Test void versionsAndMandatoryFieldsRejectedBeforeIssuance() {
  SnapshotValidation.validate(snapshot("1.1","BLOCK"));SnapshotValidation.validate(snapshot("1.2","BLOCK"));
  for(String field:List.of("format_version","policy_snapshot_id","executor_id","owner_user_id","created_at","sites","source_version","content_policy","site_match_strategy")) {
   var s=snapshot("1.2","BLOCK");s.remove(field);assertThatThrownBy(()->SnapshotValidation.validate(s)).isInstanceOf(ApiFailure.class);
  }
  var s=snapshot("1.2","BLOCK");s.put("format_version","9.9");assertThatThrownBy(()->SnapshotValidation.validate(s)).isInstanceOf(ApiFailure.class);
 }
 @Test void malformedSiteAndContentPoliciesRejectAsWhole() {
  for(Object value:List.of("BLOCK",123,List.of("bad"))) {
   var s=snapshot("1.2","BLOCK");s.put("sites",value);assertThatThrownBy(()->SnapshotValidation.validate(s)).isInstanceOf(ApiFailure.class);
  }
  final var invalid=snapshot("1.2","INVALID");assertThatThrownBy(()->SnapshotValidation.validate(invalid)).isInstanceOf(ApiFailure.class);
  var c=new LinkedHashMap<>(ExecutionService.defaultContent());c.put("keywords",Map.of("enabled","true","rules",List.of(),"exceptions",List.of()));var s=snapshot("1.2","BLOCK");s.put("content_policy",c);assertThatThrownBy(()->SnapshotValidation.validate(s)).isInstanceOf(ApiFailure.class);
 }

 @Test @SuppressWarnings("unchecked") void siteAndContentVersionsArePositiveIntegralInBothFormats() {
  for(String format:List.of("1.1","1.2")) {
   for(Object invalid:Arrays.asList(0,-1,1.5,1.0,"1",null,true,Double.POSITIVE_INFINITY,SafeVersion.MAX+1,Long.MAX_VALUE)) {
    for(String field:List.of("site","content","source")) {
     var s=snapshot(format,"BLOCK");s.put("content_policy",new LinkedHashMap<>((Map<String,Object>)s.get("content_policy")));
     var value=field.equals("site")?(Map<String,Object>)((List<?>)s.get("sites")).getFirst():(Map<String,Object>)s.get("content_policy");
     if(field.equals("source"))s.put("source_version",invalid);else value.put("version",invalid);
     assertThatThrownBy(()->SnapshotValidation.validate(s)).as(format+" "+field+" "+invalid).isInstanceOf(ApiFailure.class);
    }
   }
   for(Object valid:List.of(1,2L,SafeVersion.MAX)) {
    var s=snapshot(format,"BLOCK");s.put("content_policy",new LinkedHashMap<>((Map<String,Object>)s.get("content_policy")));((Map<String,Object>)((List<?>)s.get("sites")).getFirst()).put("version",valid);
    ((Map<String,Object>)s.get("content_policy")).put("version",valid);s.put("source_version",valid);SnapshotValidation.validate(s);
   }
  }
 }
}
