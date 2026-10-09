package kr.ac.kdu.focurve;

import static org.assertj.core.api.Assertions.assertThat;
import java.net.*;
import java.net.http.*;
import java.time.*;
import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import kr.ac.kdu.focurve.auth.*;
import kr.ac.kdu.focurve.execution.*;
import kr.ac.kdu.focurve.records.RecordQueries;
import kr.ac.kdu.focurve.sites.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/** Real HTTP and MySQL; installation/APPLIED evidence is synthetic, never a Chrome result. */
@ActiveProfiles("test")
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties="AUTH_PUBLIC_URL=http://127.0.0.1:5173")
class Event12HttpIntegrationTest {
  @LocalServerPort int port;
  @Autowired JdbcTemplate db;
  @Autowired ExecutionService execution;
  @Autowired SiteService sites;
  @Autowired RecordQueries records;
  @MockitoBean MailDelivery mail;
  private String uuid(){return UUID.randomUUID().toString();}
  @Test @SuppressWarnings("unchecked")
  void authenticatedRealHttpAcceptsEvent12AndDeduplicatesWithoutLosingActualHost() throws Exception {
    String email=uuid()+"@example.invalid";
    db.update("INSERT INTO users(display_name,email,email_verified,status,created_at,terms_version,terms_accepted_at) VALUES ('HTTP synthetic',?,true,'ACTIVE',UTC_TIMESTAMP(3),'dev-v1',UTC_TIMESTAMP(3))",email);
    long owner=db.queryForObject("SELECT id FROM users WHERE email=?",Long.class,email);
    String executor=uuid(),family=uuid(),token=AuthSupport.token(),refresh=uuid();
    db.update("INSERT INTO extension_installations VALUES (?,?,?,'HTTP_SYNTHETIC',UTC_TIMESTAMP(3))",executor,owner,AuthSupport.hash(uuid()));
    db.update("INSERT INTO extension_tokens VALUES (?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 1 DAY),NULL)",refresh,executor,owner,AuthSupport.hash(uuid()),family);
    db.update("INSERT INTO extension_access_tokens VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 15 MINUTE))",AuthSupport.hash(token),refresh);
    sites.create(owner,uuid(),new SiteInput("naver.com","HTTP contract",true,"DISTRACTION","RECORD",List.of()));
    var session=execution.start(owner,executor,10,uuid());
    String sessionId=session.get("session_id").toString();
    String command=db.queryForObject("SELECT c.id FROM execution_commands c JOIN focus_sessions s ON c.session_id=s.id WHERE s.source_session_id=? AND c.kind='APPLY_POLICY'",String.class,sessionId);
    Instant begin=Instant.now().minusSeconds(20);
    execution.report(new MemberLinks.Principal(owner,executor),Map.of("report_id",uuid(),"command_id",command,"session_id",sessionId,"executor_id",executor,"desired_revision",1,"result","APPLIED","observed_at",begin.toString(),"intervals",List.of(Map.of("interval_id",uuid(),"kind","RUN","start_at",begin.toString(),"quality","CONFIRMED"))));
    Map<String,Object> event=new LinkedHashMap<>();
    event.put("schema_version","1.2"); event.put("event_id",uuid()); event.put("executor_id",executor);event.put("session_id",sessionId);
    event.put("policy_snapshot_id",session.get("policy_snapshot_id"));event.put("event_type","RECORDED_ACCESS");event.put("occurred_at",begin.plusSeconds(1).toString());event.put("local_seq",1);
    event.put("payload",Map.of("access_seq",1,"navigation_id",uuid(),"target_kind","SITE","target_host","chzzk.naver.com","target_key","chzzk.naver.com","matched_policy_host","naver.com","reason","RECORD","blocked_reasons",List.of()));
    ObjectMapper json=new ObjectMapper();HttpClient client=HttpClient.newHttpClient();
    String body=json.writeValueAsString(Map.of("events",List.of(event)));
    var request=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/v1/events/batch")).header("Authorization","Bearer "+token).header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString(body)).build();
    var first=client.send(request,HttpResponse.BodyHandlers.ofString());assertThat(first.statusCode()).isEqualTo(200);assertThat(json.readTree(first.body()).path("items").get(0).path("status").asText()).isEqualTo("ACCEPTED");
    var repeat=client.send(request,HttpResponse.BodyHandlers.ofString());assertThat(repeat.statusCode()).isEqualTo(200);assertThat(json.readTree(repeat.body()).path("items").get(0).path("status").asText()).isEqualTo("DUPLICATE");
    assertThat(db.queryForObject("SELECT COUNT(*) FROM access_events WHERE event_id=?",Long.class,event.get("event_id"))).isEqualTo(1L);
    var queried=records.list(owner,null,null,sessionId,null,null,null,100);
    var row=(Map<String,Object>)((List<?>)queried.get("items")).getFirst();
    assertThat(row.get("target_key")).isEqualTo("chzzk.naver.com");assertThat(row.get("matched_policy_host")).isEqualTo("naver.com");assertThat(((Number)row.get("repeat_count")).longValue()).isZero();
    var bad=HttpRequest.newBuilder(request.uri()).header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString(body)).build();
    assertThat(client.send(bad,HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(403);
  }

  @Test @SuppressWarnings("unchecked")
  void mixedFeatureReasonsRoundTripOverHttpAndMysqlAndInvalidCombinationsRollback() throws Exception {
    String email=uuid()+"@example.invalid";
    db.update("INSERT INTO users(display_name,email,email_verified,status,created_at,terms_version,terms_accepted_at) VALUES ('HTTP synthetic',?,true,'ACTIVE',UTC_TIMESTAMP(3),'dev-v1',UTC_TIMESTAMP(3))",email);
    long owner=db.queryForObject("SELECT id FROM users WHERE email=?",Long.class,email);
    String executor=uuid(),family=uuid(),token=AuthSupport.token(),refresh=uuid();
    db.update("INSERT INTO extension_installations VALUES (?,?,?,'HTTP_SYNTHETIC',UTC_TIMESTAMP(3))",executor,owner,AuthSupport.hash(uuid()));
    db.update("INSERT INTO extension_tokens VALUES (?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 1 DAY),NULL)",refresh,executor,owner,AuthSupport.hash(uuid()),family);
    db.update("INSERT INTO extension_access_tokens VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 15 MINUTE))",AuthSupport.hash(token),refresh);
    sites.create(owner,uuid(),new SiteInput("youtube.com","HTTP contract",true,"DISTRACTION","BLOCK",List.of(new SiteInput.Feature("YOUTUBE_SHORTS",true))));
    var session=execution.start(owner,executor,10,uuid());
    String sessionId=session.get("session_id").toString();
    String command=db.queryForObject("SELECT c.id FROM execution_commands c JOIN focus_sessions s ON c.session_id=s.id WHERE s.source_session_id=? AND c.kind='APPLY_POLICY'",String.class,sessionId);
    Instant begin=Instant.now().minusSeconds(20);
    execution.report(new MemberLinks.Principal(owner,executor),Map.of("report_id",uuid(),"command_id",command,"session_id",sessionId,"executor_id",executor,"desired_revision",1,"result","APPLIED","observed_at",begin.toString(),"intervals",List.of(Map.of("interval_id",uuid(),"kind","RUN","start_at",begin.toString(),"quality","CONFIRMED"))));

    // Synthetic frozen Content policy fixture, not a real detector or production mutation API.
    ObjectMapper json=new ObjectMapper();HttpClient client=HttpClient.newHttpClient();
    var frozen=new LinkedHashMap<String,Object>((Map<String,Object>)execution.policy(owner,sessionId));
    var content=new LinkedHashMap<String,Object>((Map<String,Object>)frozen.get("content_policy"));
    for(String key:List.of("keywords","adult_domains")) {
      var policy=new LinkedHashMap<String,Object>((Map<String,Object>)content.get(key));
      policy.put("enabled",true);content.put(key,policy);
    }
    frozen.put("content_policy",content);
    db.update("UPDATE policy_snapshots SET payload=? WHERE id=?",json.writeValueAsString(frozen),session.get("policy_snapshot_id"));
    long seq=0;
    for(var reasons:List.of(List.of("KEYWORD","FEATURE"),List.of("ADULT_DOMAIN","FEATURE"),List.of("USER_SITE","KEYWORD","FEATURE"))) {
      seq++;
      var payload=new LinkedHashMap<String,Object>();
      payload.put("access_seq",seq);payload.put("navigation_id",uuid());payload.put("target_kind","FEATURE");
      payload.put("target_host","www.youtube.com");payload.put("target_key","www.youtube.com");payload.put("matched_policy_host","youtube.com");
      payload.put("reason",reasons.getFirst());payload.put("blocked_reasons",reasons);payload.put("feature_code","YOUTUBE_SHORTS");
      var event=new LinkedHashMap<String,Object>();
      event.put("schema_version","1.2");event.put("event_id",uuid());event.put("executor_id",executor);event.put("session_id",sessionId);
      event.put("policy_snapshot_id",session.get("policy_snapshot_id"));event.put("event_type","BLOCKED_FEATURE_ACCESS");
      event.put("occurred_at",begin.plusSeconds(seq).toString());event.put("local_seq",seq);event.put("payload",payload);
      assertThat(send(client,json,token,event).path("status").asText()).isEqualTo("ACCEPTED");
      assertThat(send(client,json,token,event).path("status").asText()).isEqualTo("DUPLICATE");
      assertThat(db.queryForObject("SELECT COUNT(*) FROM access_events WHERE event_id=?",Long.class,event.get("event_id"))).isEqualTo(1L);
      var rows=(List<Map<String,Object>>)records.list(owner,null,null,sessionId,null,null,null,100).get("items");
      var row=rows.stream().filter(v->v.get("event_id").equals(event.get("event_id"))).findFirst().orElseThrow();
      assertThat(row.get("blocked_reasons")).isEqualTo(reasons);assertThat(row.get("matched_policy_host")).isEqualTo("youtube.com");
      assertThat(((Number)row.get("repeat_count")).longValue()).isEqualTo(seq-1);
      // Same ID changed envelope and same navigation with a new ID may not create another access.
      var conflict=new LinkedHashMap<>(event);conflict.put("occurred_at",begin.plusSeconds(seq+1).toString());
      assertThat(send(client,json,token,conflict).path("error").asText()).isEqualTo("EVENT_CONFLICT");
      conflict=new LinkedHashMap<>(event);conflict.put("event_id",uuid());conflict.put("local_seq",99L);
      assertThat(send(client,json,token,conflict).path("error").asText()).isEqualTo("EVENT_CONFLICT");
    }
    for(String invalid:List.of("primary","missingFeatureReason","siteType","missingCode","disabledFeature","disabledKeyword","globalException","foreignHost")) {
      var payload=new LinkedHashMap<String,Object>();payload.put("access_seq",4);payload.put("navigation_id",uuid());payload.put("target_kind","FEATURE");
      payload.put("target_host","www.youtube.com");payload.put("target_key","www.youtube.com");payload.put("matched_policy_host","youtube.com");
      payload.put("reason","KEYWORD");payload.put("blocked_reasons",List.of("KEYWORD","FEATURE"));payload.put("feature_code","YOUTUBE_SHORTS");
      var event=new LinkedHashMap<String,Object>();event.put("schema_version","1.2");event.put("event_id",uuid());event.put("executor_id",executor);
      event.put("session_id",sessionId);event.put("policy_snapshot_id",session.get("policy_snapshot_id"));event.put("event_type","BLOCKED_FEATURE_ACCESS");
      event.put("occurred_at",begin.plusSeconds(4).toString());event.put("local_seq",4);event.put("payload",payload);
      var invalidSnapshot=json.readValue(json.writeValueAsString(frozen),Map.class);
      switch(invalid) {
        case "primary" -> payload.put("reason","FEATURE");
        case "missingFeatureReason" -> payload.put("blocked_reasons",List.of("KEYWORD"));
        case "siteType" -> {event.put("event_type","BLOCKED_SITE_ACCESS");payload.put("target_kind","SITE");payload.remove("feature_code");}
        case "missingCode" -> payload.remove("feature_code");
        case "disabledFeature" -> ((Map)((List)invalidSnapshot.get("sites")).getFirst()).put("feature_policies",List.of(Map.of("feature_code","YOUTUBE_SHORTS","enabled",false)));
        case "disabledKeyword" -> ((Map)((Map)invalidSnapshot.get("content_policy")).get("keywords")).put("enabled",false);
        case "globalException" -> ((Map)((Map)invalidSnapshot.get("content_policy")).get("keywords")).put("exceptions",List.of(Map.of("host","youtube.com","include_subdomains",true)));
        case "foreignHost" -> {payload.put("target_host","notyoutube.com");payload.put("target_key","notyoutube.com");}
      }
      db.update("UPDATE policy_snapshots SET payload=? WHERE id=?",json.writeValueAsString(invalidSnapshot),session.get("policy_snapshot_id"));
      var result=send(client,json,token,event);assertThat(result.path("status").asText()).as(invalid).isEqualTo("REJECTED");
      assertThat(result.path("error").asText()).isIn("INVALID_SCHEMA","POLICY_MISMATCH");
      assertThat(db.queryForObject("SELECT COUNT(*) FROM event_receipts WHERE event_id=?",Long.class,event.get("event_id"))).isZero();
    }
    assertThat(db.queryForObject("SELECT COUNT(*) FROM access_events a JOIN focus_sessions s ON a.session_id=s.id WHERE s.source_session_id=?",Long.class,sessionId)).isEqualTo(3L);
  }
  private com.fasterxml.jackson.databind.JsonNode send(HttpClient client,ObjectMapper json,String token,Map<String,Object> event) throws Exception {
    var request=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/v1/events/batch"))
        .header("Authorization","Bearer "+token).header("Content-Type","application/json")
        .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(Map.of("events",List.of(event))))).build();
    var response=client.send(request,HttpResponse.BodyHandlers.ofString());assertThat(response.statusCode()).isEqualTo(200);
    return json.readTree(response.body()).path("items").get(0);
  }
}
