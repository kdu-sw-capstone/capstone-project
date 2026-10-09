package kr.ac.kdu.focurve;

import static org.assertj.core.api.Assertions.assertThat;
import java.time.*;
import java.util.*;
import kr.ac.kdu.focurve.auth.*;
import kr.ac.kdu.focurve.execution.ExecutionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/** Real HTTP/MySQL; guest history and installation credentials are synthetic, not Chrome. */
@ActiveProfiles("test")
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT)
class ImportSnapshotHttpIntegrationTest {
 @Autowired TestRestTemplate http;
 @Autowired JdbcTemplate db;
 @Autowired AuthService json;
 @MockitoBean MailDelivery mail;
 record Fixture(long owner,String executor,String token) {}
 String id(){return UUID.randomUUID().toString();}
 Fixture fixture(){
  String email=id()+"@example.invalid",executor=id(),refresh=id(),token=AuthSupport.token();
  db.update("INSERT INTO users(display_name,email,email_verified,status,created_at,terms_version,terms_accepted_at) VALUES ('import HTTP synthetic',?,true,'ACTIVE',UTC_TIMESTAMP(3),'dev-v1',UTC_TIMESTAMP(3))",email);
  long owner=db.queryForObject("SELECT id FROM users WHERE email=?",Long.class,email);
  db.update("INSERT INTO extension_installations VALUES (?,?,?,'HTTP_SYNTHETIC',UTC_TIMESTAMP(3))",executor,owner,AuthSupport.hash(id()));
  db.update("INSERT INTO extension_tokens VALUES (?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 1 DAY),NULL)",refresh,executor,owner,AuthSupport.hash(id()),id());
  db.update("INSERT INTO extension_access_tokens VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 15 MINUTE))",AuthSupport.hash(token),refresh);
  return new Fixture(owner,executor,token);
 }
 @SuppressWarnings("unchecked") Map<String,Object> request(Fixture f,String path,HttpMethod method,Object body,int status){
  var h=new HttpHeaders();h.setContentType(MediaType.APPLICATION_JSON);h.setBearerAuth(f.token());h.set("Idempotency-Key",id());
  var response=http.exchange(path,method,new HttpEntity<>(body,h),Map.class);
  assertThat(response.getStatusCode().value()).isEqualTo(status);return response.getBody();
 }
 Map<String,Object> bundle(Fixture f,String source,String format,Object version){
  Instant end=Instant.now().minusSeconds(1),start=end.minusSeconds(30);String snapshot=id();
  var policies=new ArrayList<Map<String,Object>>();
  for(int i=0;i<2;i++){
   var site=new LinkedHashMap<String,Object>();site.put("site_id",id());site.put("canonical_host","site"+i+".example.org");site.put("display_name","guest");site.put("include_subdomains",true);site.put("purpose","GENERAL");site.put("access_policy","ALLOW");site.put("feature_policies",List.of());site.put("version",i==0?1:version);site.put("created_at",start.toString());site.put("updated_at",start.toString());policies.add(site);
  }
  var policy=new LinkedHashMap<String,Object>();policy.put("format_version",format);if(format.equals("1.2"))policy.put("site_match_strategy","MOST_SPECIFIC_HOST");policy.put("policy_snapshot_id",snapshot);policy.put("owner_user_id",null);policy.put("executor_id",f.executor());policy.put("created_at",start.toString());policy.put("source_version",1);policy.put("sites",policies);policy.put("content_policy",new LinkedHashMap<>(ExecutionService.defaultContent()));
  var session=new LinkedHashMap<String,Object>();session.put("session_id",source);session.put("executor_id",f.executor());session.put("policy_snapshot_id",snapshot);session.put("source","MANUAL");session.put("execution_status","ENDED");session.put("duration_minutes",1);session.put("started_at",start.toString());session.put("ended_at",end.toString());session.put("policy_released_at",end.toString());session.put("end_reason","MANUAL");
  return new LinkedHashMap<>(Map.of("snapshot",policy,"session",session,"intervals",List.of(Map.of("interval_id",id(),"kind","RUN","start_at",start.toString(),"end_at",end.toString(),"duration_ms",30000,"quality","CONFIRMED")),"events",List.of(),"note","synthetic","watermark",Map.of("last_access_seq",0,"last_local_seq",0)));
 }
 Map<String,Object> item(String type,String source,Map<String,Object> payload){return Map.of("type",type,"source_item_id",source,"source_hash",AuthSupport.hash(json.encoded(payload)),"payload",payload);}
 String batch(Fixture f,List<Map<String,Object>> items){
  var manifest=items.stream().map(i->Map.of("type",i.get("type"),"source_item_id",i.get("source_item_id"),"source_hash",i.get("source_hash"))).toList();
  return request(f,"/api/v1/guest-imports",HttpMethod.POST,Map.of("source_installation_id",f.executor(),"manifest",manifest),202).get("batch_id").toString();
 }
 Map<String,Object> upload(Fixture f,String batch,Map<String,Object> item){return request(f,"/api/v1/guest-imports/"+batch+"/items/"+item.get("source_item_id"),HttpMethod.PUT,item,200);}
 long count(String table,long owner){return db.queryForObject("SELECT COUNT(*) FROM "+table+" WHERE user_id=?",Long.class,owner);}
 void noBundleSaved(Fixture f){
  assertThat(count("policy_snapshots",f.owner())).isZero();assertThat(count("focus_sessions",f.owner())).isZero();
  assertThat(db.queryForObject("SELECT COUNT(*) FROM guest_import_payloads p JOIN guest_import_items i ON p.item_id=i.id WHERE i.bound_user_id=?",Long.class,f.owner())).isZero();
 }
 @Test void validGuestVersionsPreservedWithUuidSiteIdsAndStatistics() {
  var f=fixture();long imported=0;
  for(String format:List.of("1.1","1.2"))for(Object version:List.of(1,2L)){
   String source=id();var i=item("SESSION",source,bundle(f,source,format,version));String batch=batch(f,List.of(i));
   assertThat(upload(f,batch,i).get("status")).isEqualTo("SUCCEEDED");assertThat(upload(f,batch,i).get("status")).isEqualTo("SUCCEEDED");imported++;
   String payload=db.queryForObject("SELECT p.payload FROM policy_snapshots p JOIN focus_sessions s ON s.policy_snapshot_id=p.id WHERE s.user_id=? AND s.source_session_id=?",String.class,f.owner(),source);
   var saved=json.decoded(payload);var second=(Map<?,?>)((List<?>)saved.get("sites")).get(1);
   assertThat(((Number)second.get("version")).longValue()).isEqualTo(((Number)version).longValue());
   assertThat(saved.get("format_version")).isEqualTo(format);
   assertThat(request(f,"/api/v1/sessions/"+source,HttpMethod.GET,null,200).get("origin")).isEqualTo("GUEST_IMPORT");
  }
  assertThat(count("focus_sessions",f.owner())).isEqualTo(imported);
  assertThat(((Number)request(f,"/api/v1/statistics/summary",HttpMethod.GET,null,200).get("active_duration_ms")).longValue()).isEqualTo(imported*30000);
  assertThat(db.queryForObject("SELECT COUNT(*) FROM active_execution_locks WHERE user_id=?",Long.class,f.owner())).isZero();
 }
 @Test void invalidSecondSiteRollsBackWholeBundleInBothFormats() {
  var f=fixture();
  for(String format:List.of("1.1","1.2"))for(Object version:Arrays.asList(0,-1,1.5,"1",null)){
   String source=id();var i=item("SESSION",source,bundle(f,source,format,version));String batch=batch(f,List.of(i));
   var result=upload(f,batch,i);assertThat(result.get("status")).isEqualTo("FAILED");
   assertThat(result.get("error_code")).isEqualTo(version instanceof Double?"INVALID_SCHEMA":"INVALID_SNAPSHOT");noBundleSaved(f);
  }
 }
 @Test @SuppressWarnings("unchecked") void sourceAndContentVersionAlsoRequirePositiveIntegers() {
  var f=fixture();
  for(String format:List.of("1.1","1.2"))for(String field:List.of("source_version","content_policy")){
   String source=id();var payload=bundle(f,source,format,1);var snapshot=(Map<String,Object>)payload.get("snapshot");
   if(field.equals("source_version"))snapshot.put(field,0);else ((Map<String,Object>)snapshot.get(field)).put("version",0);
   var i=item("SESSION",source,payload);String batch=batch(f,List.of(i));var result=upload(f,batch,i);
   assertThat(result.get("status")).isEqualTo("FAILED");assertThat(result.get("error_code")).isEqualTo("INVALID_SNAPSHOT");noBundleSaved(f);
  }
 }
 @Test void mixedManifestRetainsSuccessfulSiteAndFailedBundleWithoutDuplicates() {
  var f=fixture();String source=id();var bad=item("SESSION",source,bundle(f,source,"1.2",0));
  var good=item("SITE",id(),new LinkedHashMap<>(Map.of("url","chosen.example.org","display_name","selected","include_subdomains",true,"purpose","GENERAL","access_policy","ALLOW","feature_policies",List.of())));
  String batch=batch(f,List.of(good,bad));assertThat(upload(f,batch,good).get("status")).isEqualTo("SUCCEEDED");assertThat(upload(f,batch,bad).get("status")).isEqualTo("FAILED");
  assertThat(upload(f,batch,good).get("status")).isEqualTo("SUCCEEDED");assertThat(upload(f,batch,bad).get("status")).isEqualTo("FAILED");
  assertThat(count("sites",f.owner())).isEqualTo(1);assertThat(count("policy_snapshots",f.owner())).isZero();assertThat(count("focus_sessions",f.owner())).isZero();
  assertThat(db.queryForObject("SELECT version FROM sites WHERE user_id=?",Long.class,f.owner())).isEqualTo(1L);
  assertThat(request(f,"/api/v1/guest-imports/"+batch,HttpMethod.GET,null,200).get("status")).isEqualTo("PARTIAL");
 }
 @Test @SuppressWarnings("unchecked") void startFailedHistoryAlsoUsesVersionGuard() {
  for(String format:List.of("1.1","1.2"))for(int version:List.of(0,1)){
   var f=fixture();String source=id();var payload=bundle(f,source,format,version);
   var session=(Map<String,Object>)payload.get("session");session.put("execution_status","START_FAILED");session.put("started_at",null);session.put("end_reason","APPLY_FAILED");payload.put("intervals",List.of());
   var i=item("SESSION",source,payload);String batch=batch(f,List.of(i));var result=upload(f,batch,i);
   if(version==0){assertThat(result.get("status")).isEqualTo("FAILED");assertThat(result.get("error_code")).isEqualTo("INVALID_SNAPSHOT");noBundleSaved(f);}
   else {assertThat(result.get("status")).isEqualTo("SUCCEEDED");assertThat(request(f,"/api/v1/sessions/"+source,HttpMethod.GET,null,200).get("execution_status")).isEqualTo("START_FAILED");}
  }
 }
}
