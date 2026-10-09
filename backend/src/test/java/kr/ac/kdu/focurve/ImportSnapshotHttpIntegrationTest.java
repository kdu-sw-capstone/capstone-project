package kr.ac.kdu.focurve;

import static org.assertj.core.api.Assertions.assertThat;
import java.time.*;
import java.util.*;
import kr.ac.kdu.focurve.auth.*;
import kr.ac.kdu.focurve.execution.ExecutionService;
import kr.ac.kdu.focurve.execution.SafeVersion;
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
  for(String format:List.of("1.1","1.2"))for(Object version:List.of(1,2L,SafeVersion.MAX)){
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
  for(String format:List.of("1.1","1.2"))for(Object version:Arrays.asList(0,-1,1.5,"1",null,true,SafeVersion.MAX+1,Long.MAX_VALUE)){
   String source=id();var i=item("SESSION",source,bundle(f,source,format,version));String batch=batch(f,List.of(i));
   var result=upload(f,batch,i);assertThat(result.get("status")).isEqualTo("FAILED");
   assertThat(result.get("error_code")).isEqualTo(version instanceof Double || version instanceof Long && ((Long)version)>SafeVersion.MAX?"INVALID_SCHEMA":"INVALID_SNAPSHOT");noBundleSaved(f);
  }
 }
 @Test @SuppressWarnings("unchecked") void sourceAndContentVersionAlsoRequirePositiveIntegers() {
  var f=fixture();
  for(String format:List.of("1.1","1.2"))for(String field:List.of("source_version","content_policy")){
   String source=id();var payload=bundle(f,source,format,1);var snapshot=(Map<String,Object>)payload.get("snapshot");
   if(field.equals("source_version"))snapshot.put(field,SafeVersion.MAX+1);else ((Map<String,Object>)snapshot.get(field)).put("version",SafeVersion.MAX+1);
   var i=item("SESSION",source,payload);String batch=batch(f,List.of(i));var result=upload(f,batch,i);
   assertThat(result.get("status")).isEqualTo("FAILED");assertThat(result.get("error_code")).isEqualTo("INVALID_SCHEMA");noBundleSaved(f);
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
 @Test void siteVersionIncrementStopsAtSafeLimitWithoutChangingStoredRow() {
  var f=fixture();var input=Map.of("url","limit.example.org","display_name","before","include_subdomains",true,"purpose","GENERAL","access_policy","ALLOW","feature_policies",List.of());
  var created=request(f,"/api/v1/sites",HttpMethod.POST,input,201);String site=created.get("site_id").toString();
  db.update("UPDATE sites SET version=? WHERE id=? AND user_id=?",SafeVersion.MAX-1,site,f.owner());
  var h=new HttpHeaders();h.setBearerAuth(f.token());h.setContentType(MediaType.APPLICATION_JSON);h.set("Idempotency-Key",id());h.set("If-Match","\""+(SafeVersion.MAX-1)+"\"");
  assertThat(http.exchange("/api/v1/sites/"+site,HttpMethod.PATCH,new HttpEntity<>(input,h),Map.class).getStatusCode().value()).isEqualTo(200);
  var before=db.queryForMap("SELECT version,display_name,deleted_at FROM sites WHERE id=?",site);
  h.set("Idempotency-Key",id());h.set("If-Match","\""+SafeVersion.MAX+"\"");
  var response=http.exchange("/api/v1/sites/"+site,HttpMethod.PATCH,new HttpEntity<>(input,h),Map.class);
  assertThat(response.getStatusCode().value()).isEqualTo(409);assertThat(((Map<?,?>)response.getBody().get("error")).get("code")).isEqualTo("VERSION_LIMIT");
  h.set("Idempotency-Key",id());assertThat(http.exchange("/api/v1/sites/"+site,HttpMethod.DELETE,new HttpEntity<>(null,h),Map.class).getStatusCode().value()).isEqualTo(409);
  assertThat(db.queryForMap("SELECT version,display_name,deleted_at FROM sites WHERE id=?",site)).isEqualTo(before);
 }
 @Test @SuppressWarnings("unchecked") void historicalSnapshotAboveSafeRangeIsReadWithoutRewrite() {
  var f=fixture();String source=id();var item=item("SESSION",source,bundle(f,source,"1.1",1));
  assertThat(upload(f,batch(f,List.of(item)),item).get("status")).isEqualTo("SUCCEEDED");
  String snapshotId=db.queryForObject("SELECT policy_snapshot_id FROM focus_sessions WHERE user_id=? AND source_session_id=?",String.class,f.owner(),source);
  var stored=json.decoded(db.queryForObject("SELECT payload FROM policy_snapshots WHERE id=?",String.class,snapshotId));
  ((Map<String,Object>)((List<?>)stored.get("sites")).getFirst()).put("version",Long.MAX_VALUE);
  String historical=json.encoded(stored);db.update("UPDATE policy_snapshots SET payload=? WHERE id=?",historical,snapshotId);
  String before=db.queryForObject("SELECT payload FROM policy_snapshots WHERE id=?",String.class,snapshotId);
  var read=request(f,"/api/v1/sessions/"+source+"/policy",HttpMethod.GET,null,200);
  assertThat(((Number)((Map<?,?>)((List<?>)read.get("sites")).getFirst()).get("version")).longValue()).isEqualTo(Long.MAX_VALUE);
  assertThat(db.queryForObject("SELECT payload FROM policy_snapshots WHERE id=?",String.class,snapshotId)).isEqualTo(before);
 }
 @Test void unsupportedResumeActionDoesNotModifySessionSnapshotOrLock() {
  var f=fixture();String sid=request(f,"/api/v1/sessions",HttpMethod.POST,Map.of("executor_id",f.executor(),"duration_minutes",1),202).get("session_id").toString();
  var before=request(f,"/api/v1/sessions/"+sid,HttpMethod.GET,null,200);
  assertThat(before.get("automatic_recovery_supported")).isEqualTo(false);
  var summary=new LinkedHashMap<String,Object>();summary.put("format_version","1.1");summary.put("session_id",sid);summary.put("known_revision",1);summary.put("last_report_id",null);summary.put("last_access_seq",0);summary.put("last_local_seq",0);summary.put("observed_at",Instant.now().toString());summary.put("observed_state","UNCONFIRMED");summary.put("final",false);
  var action=Map.of("action_id",id(),"session_id",sid,"local_action_seq",1,"base_revision",1,"type","RESUME");
  var rejected=request(f,"/api/v1/executors/"+f.executor()+"/reconcile",HttpMethod.POST,Map.of("journal_summary",summary,"local_actions",List.of(action)),409);
  assertThat(((Map<?,?>)rejected.get("error")).get("code")).isEqualTo("RECONCILE_REQUIRED");
  assertThat(request(f,"/api/v1/sessions/"+sid,HttpMethod.GET,null,200)).isEqualTo(before);
  assertThat(db.queryForObject("SELECT COUNT(*) FROM active_execution_locks WHERE user_id=?",Long.class,f.owner())).isEqualTo(1);
 }


 @Test void historicalSessionVersionsReleaseAndReconcileOverRealHttpWithoutRewriting() {
  for(long version:List.of(1L,SafeVersion.MAX-1,SafeVersion.MAX,SafeVersion.MAX+1,Long.MAX_VALUE))for(boolean offline:List.of(false,true)) {
   var f=fixture();String sid=request(f,"/api/v1/sessions",HttpMethod.POST,Map.of("executor_id",f.executor(),"duration_minutes",1),202).get("session_id").toString();
   long session=db.queryForObject("SELECT id FROM focus_sessions WHERE source_session_id=? AND user_id=?",Long.class,sid,f.owner());
   String snapshot=db.queryForObject("SELECT payload FROM policy_snapshots WHERE id=(SELECT policy_snapshot_id FROM focus_sessions WHERE id=?)",String.class,session);
   var commands=(List<?>)request(f,"/api/v1/executors/"+f.executor()+"/commands",HttpMethod.GET,null,200).get("commands");String apply=((Map<?,?>)commands.getFirst()).get("command_id").toString();
   Instant began=Instant.now().minusSeconds(1).truncatedTo(java.time.temporal.ChronoUnit.MILLIS),ended=began.plusMillis(500);String interval=id();
   var run=Map.of("interval_id",interval,"kind","RUN","start_at",began.toString(),"quality","CONFIRMED");
   var applied=Map.of("report_id",id(),"session_id",sid,"executor_id",f.executor(),"command_id",apply,"desired_revision",1,"result","APPLIED","observed_at",began.toString(),"intervals",List.of(run));
   request(f,"/api/v1/executors/"+f.executor()+"/reports",HttpMethod.POST,applied,200);
   db.update("UPDATE focus_sessions SET version=? WHERE id=?",version,session);
   Object expected=version>SafeVersion.MAX?Long.toString(version):version;
   assertThat(request(f,"/api/v1/sessions/"+sid,HttpMethod.GET,null,200).get("version").toString()).isEqualTo(expected.toString());
   if(version>SafeVersion.MAX)assertThat(request(f,"/api/v1/sessions/current",HttpMethod.GET,null,200).get("version")).isEqualTo(expected);
   var other=fixture();request(other,"/api/v1/sessions/"+sid+"/end",HttpMethod.POST,Map.of(),404);
   var closed=Map.of("interval_id",interval,"kind","RUN","start_at",began.toString(),"end_at",ended.toString(),"duration_ms",500,"quality","CONFIRMED");
   if(offline) {
    var release=new LinkedHashMap<String,Object>();release.put("report_id",id());release.put("session_id",sid);release.put("executor_id",f.executor());release.put("command_id",null);release.put("desired_revision",1);release.put("result","RELEASED");release.put("observed_at",ended.toString());release.put("intervals",List.of(closed));
    var action=Map.of("action_id",id(),"session_id",sid,"local_action_seq",1,"base_revision",1,"type","END","observed_at",ended.toString(),"reason","MANUAL","report",release);
    var summary=Map.of("format_version","1.1","session_id",sid,"known_revision",1,"last_access_seq",0,"last_local_seq",0,"observed_at",ended.toString(),"observed_state","RELEASED","final",true);
    var body=Map.of("journal_summary",summary,"local_actions",List.of(action));
    var response=request(f,"/api/v1/executors/"+f.executor()+"/reconcile",HttpMethod.POST,body,200);
    assertThat(request(f,"/api/v1/executors/"+f.executor()+"/reconcile",HttpMethod.POST,body,200)).isEqualTo(response);
    var wrong=new LinkedHashMap<>(action);wrong.put("base_revision",99);
    request(f,"/api/v1/executors/"+f.executor()+"/reconcile",HttpMethod.POST,Map.of("journal_summary",summary,"local_actions",List.of(wrong)),409);
   } else {
    request(f,"/api/v1/sessions/"+sid+"/end",HttpMethod.POST,Map.of(),202);
    commands=(List<?>)request(f,"/api/v1/executors/"+f.executor()+"/commands",HttpMethod.GET,null,200).get("commands");String command=((Map<?,?>)commands.getFirst()).get("command_id").toString();
    var release=Map.of("report_id",id(),"session_id",sid,"executor_id",f.executor(),"command_id",command,"desired_revision",2,"result","RELEASED","observed_at",ended.toString(),"intervals",List.of(closed));
    var unconfirmed=new LinkedHashMap<>(release);unconfirmed.put("report_id",id());unconfirmed.put("result","UNCONFIRMED");unconfirmed.put("intervals",List.of());
    request(f,"/api/v1/executors/"+f.executor()+"/reports",HttpMethod.POST,unconfirmed,200);
    assertThat(request(f,"/api/v1/sessions/current",HttpMethod.GET,null,200).get("execution_status")).isEqualTo("ENDING");
    var stale=new LinkedHashMap<>(release);stale.put("desired_revision",99);request(f,"/api/v1/executors/"+f.executor()+"/reports",HttpMethod.POST,stale,409);
    request(f,"/api/v1/executors/"+f.executor()+"/reports",HttpMethod.POST,release,200);
    assertThat(request(f,"/api/v1/executors/"+f.executor()+"/reports",HttpMethod.POST,release,200).get("result")).isEqualTo("DUPLICATE");
   }
   var finished=request(f,"/api/v1/sessions/"+sid,HttpMethod.GET,null,200);assertThat(finished.get("execution_status")).isEqualTo("ENDED");
   long finalVersion=version>=SafeVersion.MAX?version:Math.min(SafeVersion.MAX,version+(offline?1:3));
   assertThat(db.queryForObject("SELECT version FROM focus_sessions WHERE id=?",Long.class,session)).isEqualTo(finalVersion);
   assertThat(finished.get("version").toString()).isEqualTo(Long.toString(finalVersion));
   assertThat(db.queryForObject("SELECT COUNT(*) FROM active_execution_locks WHERE session_id=?",Long.class,session)).isZero();
   assertThat(db.queryForObject("SELECT payload FROM policy_snapshots WHERE id=(SELECT policy_snapshot_id FROM focus_sessions WHERE id=?)",String.class,session)).isEqualTo(snapshot);
   assertThat(((Number)finished.get("active_duration_ms")).longValue()).isEqualTo(500);
  }
 }

}
